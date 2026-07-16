import { NextRequest, NextResponse } from "next/server";
import { processClassJoin } from "@/lib/membership";

export async function POST(req: NextRequest) {
  const body = await req.json();
  
  const classCode = body?.class_code as string | undefined;
  const displayName = body?.display_name as string | undefined;

  const result = await processClassJoin({
    classCode: classCode || "",
    displayName: displayName || "",
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json({ ok: true, classId: result.classId });
}
