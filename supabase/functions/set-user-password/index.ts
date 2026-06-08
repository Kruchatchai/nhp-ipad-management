// Edge Function: set-user-password
// ให้ผู้ดูแล (Super Admin / Admin·ICT) ตั้ง/รีเซ็ตรหัสผ่านของผู้ใช้คนใดก็ได้
// service_role อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น (env อัตโนมัติ) ไม่หลุดไปฝั่ง client
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// ตอบ 200 เสมอพร้อม { ok } เพื่อให้ client อ่านผล/ข้อความผิดพลาดได้ง่าย
const reply = (b: Record<string, unknown>) =>
  new Response(JSON.stringify(b), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return reply({ ok: false, error: "ไม่ได้เข้าสู่ระบบ" });

    const admin = createClient(url, service);
    const { data: prof } = await admin.from("app_users").select("role, active").eq("id", user.id).single();
    if (!prof || prof.active === false || !["Super Admin", "Admin / ICT"].includes(prof.role))
      return reply({ ok: false, error: "ไม่มีสิทธิ์เปลี่ยนรหัสผ่าน" });

    const { userId, password } = await req.json();
    if (!userId || !password || String(password).length < 6) return reply({ ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร" });

    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return reply({ ok: false, error: error.message });
    return reply({ ok: true });
  } catch (e) {
    return reply({ ok: false, error: String(e) });
  }
});
