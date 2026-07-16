import { createClient } from "@supabase/supabase-js";
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
client.from("organizations").insert({ name: "Test", slug: "test" }).then(res => console.log(res.error));
