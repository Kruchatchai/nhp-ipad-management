/* =====================================================================
 *  NHP iPad Management — การตั้งค่าการเชื่อมต่อ Supabase
 *
 *  วิธีเปิดใช้งานโหมดจริง (Live):
 *    1) ใส่ค่า SUPABASE_URL และ SUPABASE_ANON_KEY ด้านล่าง
 *       (ได้จาก Supabase Dashboard -> Project Settings -> API)
 *    2) บันทึกไฟล์แล้วรีเฟรชเว็บ
 *
 *  ถ้าปล่อยว่างไว้ ระบบจะทำงานในโหมด "Demo" ด้วยข้อมูลจำลอง (ไม่ต่อฐานข้อมูล)
 *
 *  หมายเหตุความปลอดภัย: anon key เปิดเผยในฝั่ง client ได้อย่างปลอดภัย
 *  เพราะสิทธิ์การเข้าถึงข้อมูลถูกคุมด้วย Row Level Security (RLS) ในฐานข้อมูล
 * ===================================================================== */
(function () {
  // --- กรอกค่าตรงนี้ ---
  var SUPABASE_URL = "";        // เช่น "https://abcdefgh.supabase.co"
  var SUPABASE_ANON_KEY = "";   // เช่น "eyJhbGciOi..."

  // เผื่อกรณีอยากตั้งค่าชั่วคราวผ่าน localStorage (ไม่ต้องแก้ไฟล์):
  //   localStorage.setItem('nhp-supabase-url', 'https://xxx.supabase.co')
  //   localStorage.setItem('nhp-supabase-key', 'eyJ...')
  try {
    SUPABASE_URL = SUPABASE_URL || localStorage.getItem("nhp-supabase-url") || "";
    SUPABASE_ANON_KEY = SUPABASE_ANON_KEY || localStorage.getItem("nhp-supabase-key") || "";
  } catch (e) {}

  window.NHP_CONFIG = {
    supabaseUrl: SUPABASE_URL.trim(),
    supabaseAnonKey: SUPABASE_ANON_KEY.trim(),
    // live = มีคีย์ครบ + ไลบรารี supabase-js โหลดสำเร็จ
    get live() {
      return !!(this.supabaseUrl && this.supabaseAnonKey && window.supabase);
    },
  };
})();
