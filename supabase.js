/* =====================================================================
 *  NHP iPad Management — Supabase data-access layer (window.SB)
 *
 *  โหมดการทำงานตัดสินจาก config.js:
 *    - Live mode  : มีคีย์ครบ -> ต่อ Supabase จริง (auth + database)
 *    - Demo mode  : ไม่มีคีย์ -> window.SB.live === false, แอปใช้ mock เหมือนเดิม
 *
 *  จุดเชื่อมกับแอป:
 *    - app.jsx เรียก SB.auth.signIn / restore / signOut
 *    - หลัง login เรียก SB.hydrate() เพื่อดึงข้อมูลจริงเข้า window.Store
 *    - store.jsx (build) อ่าน window.__REMOTE_DATA__ ที่ตั้งค่าไว้ตอน hydrate
 * ===================================================================== */
(function () {
  var CFG = window.NHP_CONFIG || { live: false };
  var live = !!CFG.live;

  // โครงข้อมูลว่างสำหรับ build() ก่อน login (live mode) — กันไม่ให้โชว์ mock
  var EMPTY = { students: [], teachers: [], devices: [], borrows: [], repairs: [], repairTypes: [], subjects: [] };

  if (!live) {
    // Demo mode: เปิด API เปล่าไว้เพื่อให้ app.jsx เรียกได้โดยไม่ error
    window.SB = {
      live: false,
      auth: {
        signIn: function () { return Promise.resolve({ ok: false, error: "ยังไม่ได้ตั้งค่า Supabase (โหมดสาธิต)" }); },
        signOut: function () { return Promise.resolve(); },
        restore: function () { return Promise.resolve(null); },
      },
      hydrate: function () { return Promise.resolve(); },
      loadSnapshot: function () { return Promise.resolve(window.NHP); },
      saveAudit: function () { return Promise.resolve(); },
      db: {},
    };
    return;
  }

  // ---- Live mode: สร้าง client ----
  var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  window.sb = sb;
  // ก่อน login ให้ store สร้าง snapshot จากข้อมูลว่าง (ไม่ใช่ mock)
  window.__REMOTE_DATA__ = EMPTY;

  // ---- ตัวช่วยแปลงสถานะ -> คลาสสี (ให้ตรงกับ design system) ----
  var DEV_CLS = { "พร้อมใช้งาน": "b-ok", "ถูกยืม": "b-info", "ชำรุด": "b-danger", "ส่งซ่อม": "b-warn", "สูญหาย": "b-muted" };
  var REP_CLS = { "รอดำเนินการ": "b-warn", "กำลังซ่อม": "b-info", "ซ่อมเสร็จ": "b-ok", "ส่งคืน": "b-ok", "ยกเลิก": "b-muted" };
  function devCls(s) { return DEV_CLS[s] || "b-muted"; }
  function repCls(s) { return REP_CLS[s] || "b-warn"; }
  function daysBetween(a, b) { return Math.floor((a - b) / 86400000); }

  // ---- โหลดข้อมูลทั้งหมดแล้วแปลงเป็น shape ที่ store.jsx ต้องการ ----
  async function loadSnapshot() {
    var res = await Promise.all([
      sb.from("subjects").select("*"),
      sb.from("device_types").select("*"),
      sb.from("accessories").select("*"),
      sb.from("students").select("*").order("level").order("room").order("no"),
      sb.from("teachers").select("*").order("code"),
      sb.from("devices").select("*").order("asset_tag"),
      sb.from("borrows").select("*"),
      sb.from("borrow_accessories").select("*"),
      sb.from("repairs").select("*"),
      sb.from("repair_types").select("*"),
    ]);
    for (var i = 0; i < res.length; i++) {
      if (res[i].error) throw new Error(res[i].error.message);
    }
    var subjects = res[0].data || [], deviceTypes = res[1].data || [], accessories = res[2].data || [],
        students = res[3].data || [], teachers = res[4].data || [], devices = res[5].data || [],
        borrows = res[6].data || [], borrowAcc = res[7].data || [], repairs = res[8].data || [],
        repairTypes = res[9].data || [];

    // lookup tables
    var subjById = {}; subjects.forEach(function (s) { subjById[s.id] = s.name; });
    var typeName = {}; deviceTypes.forEach(function (t) { typeName[t.id] = t.name; });
    var accById = {}; accessories.forEach(function (a) { accById[a.id] = a; });
    var devById = {}; devices.forEach(function (d) { devById[d.id] = d; });
    var accByBorrow = {};
    borrowAcc.forEach(function (ba) {
      (accByBorrow[ba.borrow_id] = accByBorrow[ba.borrow_id] || []).push({
        id: ba.accessory_id, name: (accById[ba.accessory_id] || {}).name || "", qty: ba.qty,
      });
    });

    var today = new Date();

    var mStudents = students.map(function (s) {
      return { id: s.id, code: s.student_code, prefix: s.prefix, first: s.first_name, last: s.last_name,
               sex: s.sex, level: s.level, room: s.room, no: s.no, status: s.status, photo: s.photo_url };
    });
    var mTeachers = teachers.map(function (t) {
      return { id: t.id, code: t.code, prefix: t.prefix, first: t.first_name, last: t.last_name,
               sex: t.sex, subject: subjById[t.subject_id] || "", homeroom: t.homeroom,
               status: t.status, email: t.email, photo: t.photo_url };
    });
    var mDevices = devices.map(function (d) {
      return { id: d.id, assetTag: d.asset_tag, code: "", serial: d.serial, type: d.type,
               typeName: typeName[d.type] || d.type, brand: "", model: d.model, color: "", cap: "",
               budgetYear: "", receivedDate: d.purchased_at, price: "",
               status: d.status, statusCls: devCls(d.status), holder: null, holderLevel: null,
               accessories: [], note: d.note || "" };
    });
    var mBorrows = borrows.map(function (b) {
      var dev = devById[b.device_id] || {};
      var due = b.due_date ? new Date(b.due_date) : null;
      var overdue = due ? daysBetween(today, due) : 0;
      return { id: b.id, device: dev.asset_tag, deviceId: b.device_id, model: dev.model,
               type: typeName[dev.type] || "", holder: b.holder_name, level: b.level,
               borrowDate: b.borrow_date, dueDate: b.due_date, overdueDays: overdue,
               status: b.status, approver: "", borrowerKind: b.borrower_kind, borrowerId: b.borrower_id,
               accessories: accByBorrow[b.id] || [] };
    });
    var mRepairs = repairs.map(function (r) {
      var dev = devById[r.device_id] || {};
      return { id: r.id, ticket: r.ticket, device: dev.asset_tag, model: dev.model, type: r.type,
               status: r.status, statusCls: repCls(r.status), reporter: r.reported_by,
               date: r.reported_at, detail: r.note || "" };
    });
    var mRepairTypes = repairTypes.filter(function (r) { return r.scope === "device"; }).map(function (r) { return r.name; });
    if (!mRepairTypes.length) mRepairTypes = ["หน้าจอแตก", "แบตเตอรี่เสื่อม", "เปิดไม่ติด", "อื่น ๆ"];

    return {
      students: mStudents, teachers: mTeachers, devices: mDevices, borrows: mBorrows,
      repairs: mRepairs, repairTypes: mRepairTypes, subjects: subjects.map(function (s) { return s.name; }),
    };
  }

  // ---- ดึงข้อมูลแล้วป้อนเข้า store ----
  async function hydrate() {
    var data = await loadSnapshot();
    window.__REMOTE_DATA__ = data;
    if (window.Store && window.Store.hydrate) window.Store.hydrate(data);
    return data;
  }

  // ---- อ่านบทบาท (role) ของผู้ใช้ปัจจุบันจากตาราง app_users ----
  async function fetchProfile(uid) {
    var r = await sb.from("app_users").select("name, role, active").eq("id", uid).single();
    if (r.error || !r.data) return { role: "ครู", name: "", active: true };
    return r.data;
  }

  var auth = {
    async signIn(email, password) {
      var r = await sb.auth.signInWithPassword({ email: email, password: password });
      if (r.error) return { ok: false, error: r.error.message };
      var prof = await fetchProfile(r.data.user.id);
      if (prof.active === false) { await sb.auth.signOut(); return { ok: false, error: "บัญชีนี้ถูกระงับการใช้งาน" }; }
      // อัปเดตเวลาล็อกอินล่าสุด (ไม่ critical ถ้า fail)
      sb.from("app_users").update({ last_login: new Date().toISOString() }).eq("id", r.data.user.id).then(function () {});
      return { ok: true, role: prof.role || "ครู", name: prof.name || email };
    },
    async signOut() { try { await sb.auth.signOut(); } catch (e) {} },
    async restore() {
      var r = await sb.auth.getSession();
      var session = r.data && r.data.session;
      if (!session) return null;
      var prof = await fetchProfile(session.user.id);
      return { session: session, role: prof.role || "ครู", name: prof.name || session.user.email };
    },
  };

  // ---- บันทึก Audit Log ลงฐานข้อมูล ----
  async function saveAudit(e) {
    try {
      var u = (await sb.auth.getUser()).data.user;
      await sb.from("audit_log").insert({
        action: e.action, detail: e.detail || "", cls: e.cls || "b-info",
        actor: e.user || null, actor_id: u ? u.id : null, nav: e.nav || null, ip: e.ip || null,
      });
    } catch (err) { /* เงียบไว้ ไม่ให้ขัดการใช้งาน */ }
  }

  // ---- CRUD ทั่วไป (ใช้ต่อยอดผูกกับปุ่มต่าง ๆ ในแต่ละหน้า) ----
  var db = {
    select: function (table, cols) { return sb.from(table).select(cols || "*"); },
    insert: function (table, row) { return sb.from(table).insert(row).select(); },
    update: function (table, id, patch) { return sb.from(table).update(patch).eq("id", id).select(); },
    remove: function (table, id) { return sb.from(table).delete().eq("id", id); },
  };

  window.SB = { live: true, auth: auth, hydrate: hydrate, loadSnapshot: loadSnapshot, saveAudit: saveAudit, db: db };
})();
