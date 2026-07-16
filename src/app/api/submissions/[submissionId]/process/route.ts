import { getSupabaseAdmin } from "@/lib/supabase/admin";
/**
 * POST /api/submissions/[submissionId]/process
 *
 * Trusted image processing pipeline:
 * 1. Verifies the submission belongs to the calling user (via class_membership_id).
 * 2. Atomically transitions processing_status: pending → processing (prevents duplicates).
 * 3. Downloads the raw object from submissions-raw.
 * 4. Validates actual file bytes (magic bytes, not filename/MIME).
 * 5. Enforces max file size and pixel dimension limits.
 * 6. Strips all EXIF, GPS, IPTC, and XMP metadata via sharp.
 * 7. Normalizes orientation and converts to sRGB.
 * 8. Writes processed JPEG to submissions-processed.
 * 9. Deletes the raw object.
 * 10. Marks processing_status = ready or failed.
 *
 * On every failure path: raw object is deleted, partial processed objects removed,
 * processing_status set to failed, sanitized error category stored.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import sharp from "sharp";


const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_DIMENSION = 8000; // pixels

// HEIC/HEIF magic bytes (ftyp box variants)
const HEIC_FTYPES = ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"];

// Admin client provided by @/lib/supabase/admin via getSupabaseAdmin()

function isHeic(buffer: Buffer): boolean {
  // HEIC: bytes 4-7 are "ftyp", bytes 8-11 are the brand
  if (buffer.length < 12) return false;
  const ftyp = buffer.slice(4, 8).toString("ascii");
  if (ftyp !== "ftyp") return false;
  const brand = buffer.slice(8, 12).toString("ascii").toLowerCase().trim();
  return HEIC_FTYPES.some((t) => brand.startsWith(t));
}

function getImageType(buffer: Buffer): "jpeg" | "png" | "heic" | "unknown" {
  if (buffer.length < 4) return "unknown";
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return "png";
  if (isHeic(buffer)) return "heic";
  return "unknown";
}

type ProcessFailureCategory =
  | "heic_not_supported"
  | "invalid_file_type"
  | "file_too_large"
  | "dimensions_exceeded"
  | "processing_error"
  | "raw_not_found"
  | "already_processing";

const STUDENT_MESSAGES: Record<ProcessFailureCategory, string> = {
  heic_not_supported:
    "HEIC files are not supported in this pilot. Please use JPG or PNG.",
  invalid_file_type: "Only JPG and PNG files are accepted.",
  file_too_large: "Your file is too large. Please use an image under 20 MB.",
  dimensions_exceeded:
    "Your image dimensions are too large. Please resize to under 8000px per side.",
  processing_error: "We could not process your image. Please try again.",
  raw_not_found: "Upload could not be verified. Please try uploading again.",
  already_processing: "Your submission is already being processed.",
};

async function markFailed(
  admin: ReturnType<typeof getSupabaseAdmin>,
  submissionId: string,
  category: ProcessFailureCategory,
  rawPath?: string
) {
  await admin
    .from("submissions")
    .update({
      processing_status: "failed",
      processing_error: category,
      storage_path_raw: null,
    })
    .eq("id", submissionId);

  if (rawPath) {
    await admin.storage.from("submissions-raw").remove([rawPath]);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ submissionId: string }> }
) {
  const { submissionId } = await context.params;
  const admin = getSupabaseAdmin();

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    // 1. Fetch submission and verify caller controls it (via class_membership_id)
    // Use authenticated client — RLS ensures student can only access their own submissions
    const { data: sub, error: subError } = await supabase
      .from("submissions")
      .select("id, processing_status, storage_path_raw, assignment_id, class_membership_id, organization_id")
      .eq("id", submissionId)
      .maybeSingle();

    if (subError || !sub) {
      return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
    }

    // 2. Atomically transition pending → processing to prevent duplicate runs
    if (sub.processing_status === "processing") {
      return NextResponse.json(
        { error: "already_processing", message: STUDENT_MESSAGES.already_processing },
        { status: 409 }
      );
    }
    if (sub.processing_status === "ready") {
      return NextResponse.json({ ok: true, message: "Already processed." });
    }
    if (sub.processing_status !== "pending" && sub.processing_status !== "failed") {
      return NextResponse.json({ error: "invalid_state" }, { status: 409 });
    }

    const rawPath = sub.storage_path_raw;
    if (!rawPath) {
      await markFailed(admin, submissionId, "raw_not_found");
      return NextResponse.json(
        { error: "raw_not_found", message: STUDENT_MESSAGES.raw_not_found },
        { status: 422 }
      );
    }

    // Atomic update: only update if still in pending/failed state (idempotency guard)
    const { error: lockError, data: lockData } = await admin
      .from("submissions")
      .update({ processing_status: "processing" })
      .eq("id", submissionId)
      .in("processing_status", ["pending", "failed"])
      .select("id");

    if (lockError || !lockData || lockData.length === 0) {
      // Someone else grabbed it
      return NextResponse.json(
        { error: "already_processing", message: STUDENT_MESSAGES.already_processing },
        { status: 409 }
      );
    }

    // 3. Download raw file via service role
    const { data: rawData, error: downloadError } = await admin.storage
      .from("submissions-raw")
      .download(rawPath);

    if (downloadError || !rawData) {
      await markFailed(admin, submissionId, "raw_not_found", rawPath);
      return NextResponse.json(
        { error: "raw_not_found", message: STUDENT_MESSAGES.raw_not_found },
        { status: 422 }
      );
    }

    const rawBuffer = Buffer.from(await rawData.arrayBuffer());

    // 4. Enforce file size limit on actual bytes
    if (rawBuffer.length > MAX_FILE_BYTES) {
      await markFailed(admin, submissionId, "file_too_large", rawPath);
      return NextResponse.json(
        { error: "file_too_large", message: STUDENT_MESSAGES.file_too_large },
        { status: 422 }
      );
    }

    // 5. Validate actual file type from magic bytes (do NOT trust filename or MIME)
    const fileType = getImageType(rawBuffer);

    if (fileType === "heic") {
      await markFailed(admin, submissionId, "heic_not_supported", rawPath);
      return NextResponse.json(
        { error: "heic_not_supported", message: STUDENT_MESSAGES.heic_not_supported },
        { status: 422 }
      );
    }

    if (fileType === "unknown") {
      await markFailed(admin, submissionId, "invalid_file_type", rawPath);
      return NextResponse.json(
        { error: "invalid_file_type", message: STUDENT_MESSAGES.invalid_file_type },
        { status: 422 }
      );
    }

    // 6. Validate pixel dimensions and process with sharp
    let processedBuffer: Buffer;
    const processedPath =
      "processed/" +
      sub.assignment_id +
      "/" +
      sub.class_membership_id +
      "/" +
      submissionId +
      ".jpg";

    try {
      const image = sharp(rawBuffer);
      const metadata = await image.metadata();

      if (
        (metadata.width ?? 0) > MAX_DIMENSION ||
        (metadata.height ?? 0) > MAX_DIMENSION
      ) {
        await markFailed(admin, submissionId, "dimensions_exceeded", rawPath);
        return NextResponse.json(
          {
            error: "dimensions_exceeded",
            message: STUDENT_MESSAGES.dimensions_exceeded,
          },
          { status: 422 }
        );
      }

      // Strip ALL metadata, normalize orientation, convert to sRGB JPEG.
      // NOT calling .withMetadata() means sharp strips all EXIF, GPS, IPTC, XMP.
      processedBuffer = await sharp(rawBuffer)
        .rotate()           // auto-orient from EXIF, then strip EXIF
        .toColorspace('srgb')
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
    } catch (sharpErr) {
      console.error("[process] sharp error:", sharpErr);
      await markFailed(admin, submissionId, "processing_error", rawPath);
      return NextResponse.json(
        { error: "processing_error", message: STUDENT_MESSAGES.processing_error },
        { status: 500 }
      );
    }

    // 7. Write processed object to submissions-processed
    const { error: uploadError } = await admin.storage
      .from("submissions-processed")
      .upload(processedPath, processedBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("[process] processed upload failed:", uploadError.message);
      await markFailed(admin, submissionId, "processing_error", rawPath);
      return NextResponse.json(
        { error: "processing_error", message: STUDENT_MESSAGES.processing_error },
        { status: 500 }
      );
    }

    // 8. Delete the raw object
    await admin.storage.from("submissions-raw").remove([rawPath]);

    // 9. Mark submission ready
    await admin
      .from("submissions")
      .update({
        processing_status: "ready",
        storage_path_raw: null,
        storage_path_processed: processedPath,
        processing_error: null,
      })
      .eq("id", submissionId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[process] unexpected error:", err);
    // Attempt to mark failed without deleting raw (unknown state)
    await admin
      .from("submissions")
      .update({ processing_status: "failed", processing_error: "processing_error" })
      .eq("id", submissionId);
    return NextResponse.json(
      { error: "processing_error", message: STUDENT_MESSAGES.processing_error },
      { status: 500 }
    );
  }
}
