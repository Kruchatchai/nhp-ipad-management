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
      users: {
        add: function () { return Promise.resolve({ ok: false, error: "โหมดสาธิต" }); },
        update: function () { return Promise.resolve({ ok: true }); },
        remove: function () { return Promise.resolve({ ok: true }); },
        setPassword: function () { return Promise.resolve({ ok: false, error: "โหมดสาธิต" }); },
      },
      saveSettings: function () { return Promise.resolve({ ok: true }); },
      savePersonStatus: function () { return Promise.resolve({ ok: true }); },
      deviceStatus: function (tag) {
        var s = window.Store && window.Store.snapshot();
        var d = s && s.ipads.find(function (x) { return x.assetTag === tag; });
        return Promise.resolve({ ok: true, data: d ? { asset_tag: d.assetTag, model: d.model, type_name: d.typeName, status: d.status, holder: d.holder, holder_level: d.holderLevel } : null });
      },
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
      sb.from("repairs").select("*"),
      sb.from("repair_types").select("*"),
      sb.from("academic_years").select("*").order("year", { ascending: false }),
      sb.from("app_users").select("*").order("created_at"),
      sb.from("audit_log").select("*").order("at", { ascending: false }).limit(500),
      sb.from("settings").select("*").eq("id", 1).maybeSingle(),
      sb.from("person_status").select("*"),
      sb.from("acc_repairs").select("*"),
    ]);
    for (var i = 0; i < res.length; i++) {
      if (res[i].error) throw new Error(res[i].error.message);
    }
    var subjects = res[0].data || [], deviceTypes = res[1].data || [], accessories = res[2].data || [],
        students = res[3].data || [], teachers = res[4].data || [], devices = res[5].data || [],
        borrows = res[6].data || [], repairs = res[7].data || [], repairTypes = res[8].data || [],
        academicYears = res[9].data || [], appUsers = res[10].data || [], auditRows = res[11].data || [],
        settingsRow = res[12].data || {}, personStatusRows = res[13].data || [], accRepairRows = res[14].data || [];

    // lookup tables
    var typeName = {}; deviceTypes.forEach(function (t) { typeName[t.id] = t.name; });
    var devById = {}; devices.forEach(function (d) { devById[d.id] = d; });
    var today = new Date();

    var mStudents = students.map(function (s) {
      return { id: s.id, code: s.student_code, citizen: s.citizen, prefix: s.prefix, first: s.first_name,
               last: s.last_name, sex: s.sex, level: s.level, room: s.room, no: s.no, phone: s.phone,
               parent: s.parent, parentPhone: s.parent_phone, graduated: !!s.graduated, status: s.status,
               academicYear: s.academic_year };
    });
    var mTeachers = teachers.map(function (t) {
      return { id: t.id, code: t.code, prefix: t.prefix, first: t.first_name, last: t.last_name,
               sex: t.sex, subject: t.subject || "", role: t.role, homeroom: t.homeroom,
               status: t.status, email: t.email, phone: t.phone };
    });
    var mDevices = devices.map(function (d) {
      return { id: d.id, assetTag: d.asset_tag, code: d.inv_code, serial: d.serial, type: d.type,
               typeName: d.type_name || typeName[d.type] || d.type, brand: d.brand, model: d.model,
               color: d.color, cap: d.capacity, budgetYear: d.budget_year, receivedDate: d.received_date,
               price: d.price, status: d.status, statusCls: d.status_cls || devCls(d.status),
               holder: d.holder, holderLevel: d.holder_level, accessories: [], note: d.note || "" };
    });
    // ชื่อผู้ถือ ณ ปัจจุบัน (อิง borrower_kind:borrower_id) → ถ้าเปลี่ยนชื่อครู/นักเรียน ทะเบียนยืมจะอัปเดตตาม
    var personName = {};
    mStudents.forEach(function (p) { personName["s:" + p.id] = p.prefix ? (p.prefix + p.first + " " + p.last) : (p.first + " " + p.last); });
    mTeachers.forEach(function (p) { personName["t:" + p.id] = p.prefix ? (p.prefix + p.first + " " + p.last) : (p.first + " " + p.last); });
    var mBorrows = borrows.map(function (b) {
      var dev = devById[b.device_id] || {};
      var due = b.due_date ? new Date(b.due_date) : null;
      var overdue = due ? daysBetween(today, due) : 0;
      var curName = personName[(b.borrower_kind || "") + ":" + b.borrower_id];
      return { id: b.id, device: dev.asset_tag || b.asset_tag, deviceId: b.device_id, model: dev.model,
               type: typeName[dev.type] || "", holder: curName || b.holder_name, level: b.level,
               borrowDate: b.borrow_date, dueDate: b.due_date, overdueDays: overdue,
               status: b.status, approver: "", borrowerKind: b.borrower_kind, borrowerId: b.borrower_id,
               accessories: b.accessories || [] };
    });
    var mRepairs = repairs.map(function (r) {
      var dev = devById[r.device_id] || {};
      return { id: r.id, ticket: r.ticket, device: dev.asset_tag || r.asset_tag, model: r.model || dev.model, type: r.type,
               status: r.status, statusCls: r.status_cls || repCls(r.status), reporter: r.reporter,
               date: r.report_date, detail: r.note || "" };
    });
    var mRepairTypes = repairTypes.filter(function (r) { return r.scope === "device"; }).map(function (r) { return r.name; });
    if (!mRepairTypes.length) mRepairTypes = ["หน้าจอแตก", "แบตเตอรี่เสื่อม", "เปิดไม่ติด", "อื่น ๆ"];

    var mAccessories = accessories.map(function (a) {
      return { id: a.id, name: a.name, qty: a.qty, damaged: a.damaged || 0, lost: a.lost || 0, note: a.note || "" };
    });
    var mYears = academicYears.map(function (y) {
      return { id: y.id, year: y.year, label: "ปีการศึกษา " + y.year, current: !!y.is_current,
               students: y.is_current ? students.length : 0, devices: y.is_current ? devices.length : 0 };
    });
    var ROLE_CLS = { "Super Admin": "b-danger", "Admin / ICT": "b-info", "ครู": "b-purple", "นักเรียน": "b-muted" };
    var mUsers = appUsers.map(function (u) {
      return { id: u.id, name: u.name || u.email, username: u.username || "", email: u.email,
               role: u.role, roleCls: ROLE_CLS[u.role] || "b-info",
               last: u.last_login ? String(u.last_login).slice(0, 16).replace("T", " ") : "—",
               active: u.active !== false, twofa: !!u.twofa };
    });

    var curYear = (mYears.filter(function (y) { return y.current; })[0] || {}).year;

    var mAudit = auditRows.map(function (a) {
      var at = a.at ? new Date(a.at) : new Date();
      var p = function (n) { return String(n).padStart(2, "0"); };
      return { id: a.id, action: a.action, detail: a.detail || "", cls: a.cls || "b-info",
               user: a.actor || "—", nav: a.nav || null,
               date: at.getFullYear() + "-" + p(at.getMonth() + 1) + "-" + p(at.getDate()),
               time: p(at.getHours()) + ":" + p(at.getMinutes()) + ":" + p(at.getSeconds()),
               ip: a.ip || "" };
    });

    var mPersonStatus = {};
    personStatusRows.forEach(function (p) { mPersonStatus[p.person_kind + ":" + p.person_id] = p.status; });

    var accNameById = {}; accessories.forEach(function (a) { accNameById[a.id] = a.name; });
    var mAccRepairs = accRepairRows.map(function (r) {
      return { id: r.id, ticket: r.ticket, accId: r.accessory_id, accName: accNameById[r.accessory_id] || "", device: null,
               borrowerName: r.borrower_name, borrowerKind: r.borrower_kind, borrowerId: r.borrower_id, level: r.level,
               problem: r.type, date: r.reported_at, status: r.status, statusCls: repCls(r.status), detail: r.note || "" };
    });

    return {
      students: mStudents, teachers: mTeachers, devices: mDevices, borrows: mBorrows,
      repairs: mRepairs, repairTypes: mRepairTypes, subjects: subjects.map(function (s) { return s.name; }),
      accessories: mAccessories, academicYears: mYears, systemUsers: mUsers, year: curYear, audit: mAudit,
      rooms: (settingsRow && settingsRow.rooms) || [1, 2, 3, 4],
      personStatus: mPersonStatus,
      accRepairs: mAccRepairs,
      school: (settingsRow && settingsRow.school_name) ? { name: settingsRow.school_name, affiliation: settingsRow.affiliation, address: settingsRow.address } : undefined,
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
    var r = await sb.from("app_users").select("name, role, active").eq("id", uid).maybeSingle();
    if (r.error) return { role: "ครู", name: "", active: true };   // network error — อย่าล็อกผู้ใช้ออก
    if (!r.data) return { missing: true };                         // ไม่มีแถว = ถูกลบสิทธิ์
    return r.data;
  }

  var auth = {
    async signIn(email, password) {
      var r = await sb.auth.signInWithPassword({ email: email, password: password });
      if (r.error) return { ok: false, error: r.error.message };
      var prof = await fetchProfile(r.data.user.id);
      if (prof.missing) { await sb.auth.signOut(); return { ok: false, error: "บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบ" }; }
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

  // =====================================================================
  //  Auto-sync (write-through): diff snapshot ก่อน/หลังแต่ละ Store.update
  //  แล้ว insert / update / delete ลงฐานข้อมูลให้อัตโนมัติ
  //  ครอบคลุม: นักเรียน · ครู · อุปกรณ์ (iPad) — บันทึกถาวรทันที
  // =====================================================================
  function nn(v) { return v === undefined ? null : v; }
  // แจ้งเตือนเมื่อบันทึกลง DB ล้มเหลว (ให้ผู้ใช้เห็น ไม่ fail เงียบ)
  function notifyErr(table, msg) {
    window.SB.lastSyncError = msg;
    console.error("[NHP sync] " + table + ": " + msg);
    try { window.dispatchEvent(new CustomEvent("nhp-sync-error", { detail: { table: table, message: msg } })); } catch (e) {}
  }
  // UI object -> DB row (กันค่า undefined ไม่ให้ชน NOT NULL)
  function rowStudent(s) {
    return { id: s.id, student_code: nn(s.code), citizen: nn(s.citizen), prefix: nn(s.prefix),
      first_name: s.first || "-", last_name: s.last || "-", sex: nn(s.sex), level: s.level || "ม.1", room: Number(s.room) || 1,
      no: nn(s.no), phone: nn(s.phone), parent: nn(s.parent), parent_phone: nn(s.parentPhone),
      graduated: !!s.graduated, status: nn(s.status) || "กำลังศึกษา", academic_year: nn(s.academicYear) };
  }
  function rowTeacher(t) {
    return { id: t.id, code: nn(t.code), prefix: nn(t.prefix), first_name: t.first || "-", last_name: t.last || "-",
      sex: nn(t.sex), subject: nn(t.subject), role: nn(t.role), homeroom: nn(t.homeroom),
      email: nn(t.email), phone: nn(t.phone), status: nn(t.status) || "ปฏิบัติงาน" };
  }
  function rowDevice(d) {
    return { id: d.id, asset_tag: d.assetTag, inv_code: nn(d.code), type: d.type || "ipad",
      type_name: nn(d.typeName), brand: nn(d.brand), model: nn(d.model), color: nn(d.color),
      capacity: nn(d.cap), serial: nn(d.serial), budget_year: d.budgetYear ? Number(d.budgetYear) : null,
      price: (d.price === "" || d.price == null) ? null : Number(d.price), received_date: nn(d.receivedDate),
      status: nn(d.status) || "พร้อมใช้งาน", status_cls: nn(d.statusCls), holder: nn(d.holder),
      holder_level: nn(d.holderLevel), note: nn(d.note) };
  }

  function rowAccessory(a) {
    return { id: a.id, name: a.name, qty: Number(a.qty) || 0, damaged: Number(a.damaged) || 0,
      lost: Number(a.lost) || 0, note: nn(a.note) };
  }
  function rowYear(y) { return { id: y.id, year: String(y.year), is_current: !!y.current }; }
  function rowBorrow(b) {
    return { id: b.id, device_id: (typeof b.deviceId === "number" ? b.deviceId : null), asset_tag: nn(b.device),
      borrower_kind: nn(b.borrowerKind), borrower_id: (b.borrowerId != null ? b.borrowerId : null),
      holder_name: nn(b.holder), level: nn(b.level), borrow_date: nn(b.borrowDate), due_date: nn(b.dueDate),
      status: nn(b.status) || "ปกติ", accessories: b.accessories || [] };
  }
  function rowRepair(r) {
    return { id: r.id, ticket: nn(r.ticket), asset_tag: nn(r.device), model: nn(r.model), type: nn(r.type),
      status: nn(r.status) || "รอดำเนินการ", status_cls: nn(r.statusCls), reporter: nn(r.reporter),
      report_date: nn(r.date), note: nn(r.detail) };
  }
  function rowAccRepair(r) {
    return { id: r.id, ticket: nn(r.ticket), accessory_id: (typeof r.accId === "number" ? r.accId : null),
      borrower_kind: nn(r.borrowerKind), borrower_id: (r.borrowerId != null ? r.borrowerId : null),
      borrower_name: nn(r.borrowerName), level: nn(r.level), type: nn(r.problem),
      status: nn(r.status) || "รอดำเนินการ", reported_at: nn(r.date), note: nn(r.detail) };
  }

  function indexById(arr) { var m = {}; (arr || []).forEach(function (x) { if (x && x.id != null) m[x.id] = x; }); return m; }

  async function syncTable(table, beforeArr, afterArr, toRow) {
    var a = indexById(beforeArr), b = indexById(afterArr);
    var ins = [], upd = [], del = [], id;
    for (id in b) {
      if (!(id in a)) ins.push(b[id]);
      else if (JSON.stringify(toRow(a[id])) !== JSON.stringify(toRow(b[id]))) upd.push(b[id]);
    }
    for (id in a) { if (!(id in b)) del.push(Number(id)); }
    var ops = [];
    if (ins.length) ops.push(sb.from(table).insert(ins.map(toRow)));
    upd.forEach(function (x) { ops.push(sb.from(table).update(toRow(x)).eq("id", x.id)); });
    if (del.length) ops.push(sb.from(table).delete().in("id", del));
    if (!ops.length) return;
    var results = await Promise.all(ops);
    results.forEach(function (r) { if (r && r.error) notifyErr(table, r.error.message); });
  }

  // กลุ่มสาระ = array ของชื่อ (string) → sync ตามชื่อ (เพิ่ม/ลบ)
  async function syncSubjects(beforeArr, afterArr) {
    var a = {}; (beforeArr || []).forEach(function (n) { a[n] = 1; });
    var b = {}; (afterArr || []).forEach(function (n) { b[n] = 1; });
    var add = (afterArr || []).filter(function (n) { return !a[n]; });
    var del = (beforeArr || []).filter(function (n) { return !b[n]; });
    var ops = [];
    if (add.length) ops.push(sb.from("subjects").insert(add.map(function (n) { return { name: n }; })));
    if (del.length) ops.push(sb.from("subjects").delete().in("name", del));
    if (!ops.length) return;
    var results = await Promise.all(ops);
    results.forEach(function (r) { if (r && r.error) notifyErr("subjects", r.error.message); });
  }

  // personStatus = map (key "s:id"/"t:id" -> สถานะ) → เก็บเฉพาะที่ "ประกาศ" จริง
  // (ไม่ประสงค์ยืม/คืนแล้ว). ส่วน กำลังใช้งาน(derive)/ยังไม่แจ้ง(default) ลบ row ทิ้ง
  async function syncPersonStatus(before, after) {
    before = before || {}; after = after || {};
    var ups = [], dels = [];
    var keys = {}; Object.keys(before).forEach(function (k) { keys[k] = 1; }); Object.keys(after).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var nv = after[k], ov = before[k];
      if (nv === ov) return;
      var parts = k.split(":"); var kind = parts[0], id = Number(parts[1]);
      if (!id) return;
      if (nv === "ไม่ประสงค์ยืม" || nv === "คืนแล้ว") ups.push({ person_kind: kind, person_id: id, status: nv, updated_at: new Date().toISOString() });
      else dels.push({ kind: kind, id: id });  // default/derived → ไม่เก็บ
    });
    if (ups.length) { var r = await sb.from("person_status").upsert(ups, { onConflict: "person_kind,person_id" }); if (r.error) notifyErr("person_status", r.error.message); }
    for (var i = 0; i < dels.length; i++) { await sb.from("person_status").delete().eq("person_kind", dels[i].kind).eq("person_id", dels[i].id); }
  }

  // diff ทั้ง snapshot (เรียกจาก store หลัง update). ข้าม table ที่ไม่เปลี่ยน (อ้างอิงเท่ากัน)
  function syncDiff(before, after) {
    if (!before || !after) return;
    var jobs = [];
    if (before.students !== after.students) jobs.push(syncTable("students", before.students, after.students, rowStudent));
    if (before.teachers !== after.teachers) jobs.push(syncTable("teachers", before.teachers, after.teachers, rowTeacher));
    if (before.ipads !== after.ipads) jobs.push(syncTable("devices", before.ipads, after.ipads, rowDevice));
    if (before.accessories !== after.accessories) jobs.push(syncTable("accessories", before.accessories, after.accessories, rowAccessory));
    if (before.academicYears !== after.academicYears) jobs.push(syncTable("academic_years", before.academicYears, after.academicYears, rowYear));
    if (before.borrows !== after.borrows) jobs.push(syncTable("borrows", before.borrows, after.borrows, rowBorrow));
    if (before.repairs !== after.repairs) jobs.push(syncTable("repairs", before.repairs, after.repairs, rowRepair));
    if (before.accRepairs !== after.accRepairs) jobs.push(syncTable("acc_repairs", before.accRepairs, after.accRepairs, rowAccRepair));
    if (before.subjects !== after.subjects) jobs.push(syncSubjects(before.subjects, after.subjects));
    if (before.personStatus !== after.personStatus) jobs.push(syncPersonStatus(before.personStatus, after.personStatus));
    return Promise.all(jobs).catch(function (e) { window.SB.lastSyncError = String(e); console.error("[NHP sync]", e); });
  }

  // บันทึกการตั้งค่า (เช่น รายการห้องเรียน) ลงตาราง settings (แถวเดียว id=1)
  async function saveSettings(patch) {
    var r = await sb.from("settings").update(patch).eq("id", 1);
    return r.error ? { ok: false, error: r.error.message } : { ok: true };
  }

  // ---- จัดการผู้ใช้ระบบ (app_users + auth) ----
  var users = {
    // เพิ่มผู้ใช้ใหม่ = สร้างบัญชี auth (ใช้ client ชั่วคราวเพื่อไม่ให้ session ผู้ดูแลหลุด) แล้วตั้ง role
    async add(o) {
      if (!o.email || !o.password) return { ok: false, error: "กรุณากรอกอีเมลและรหัสผ่าน" };
      if (String(o.password).length < 6) return { ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร" };
      try {
        var tmp = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        var r = await tmp.auth.signUp({ email: o.email, password: o.password, options: { data: { name: o.name || o.email } } });
        if (r.error) return { ok: false, error: r.error.message };
        var uid = r.data.user && r.data.user.id;
        if (!uid) return { ok: false, error: "สร้างบัญชีไม่สำเร็จ" };
        var up = await sb.from("app_users").update({
          role: o.role || "ครู", name: o.name || o.email,
          username: o.username || String(o.email).split("@")[0], twofa: !!o.twofa, active: true,
        }).eq("id", uid);
        if (up.error) return { ok: false, error: up.error.message };
        return { ok: true, id: uid };
      } catch (e) { return { ok: false, error: String(e) }; }
    },
    async update(id, patch) {
      var r = await sb.from("app_users").update(patch).eq("id", id);
      return r.error ? { ok: false, error: r.error.message } : { ok: true };
    },
    // ลบสิทธิ์ผู้ใช้ (ลบแถว app_users -> ล็อกอินไม่ได้อีกเพราะ signIn ต้องมีแถวสิทธิ์)
    async remove(id) {
      var r = await sb.from("app_users").delete().eq("id", id);
      return r.error ? { ok: false, error: r.error.message } : { ok: true };
    },
    // เปลี่ยน/รีเซ็ตรหัสผ่านของผู้ใช้
    //  - ของตัวเอง: ใช้ updateUser (session ยังอยู่)
    //  - ของผู้อื่น: ผ่าน Edge Function ที่ใช้ service_role ฝั่งเซิร์ฟเวอร์
    async setPassword(userId, password) {
      if (!password || String(password).length < 6) return { ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร" };
      try {
        var cur = (await sb.auth.getUser()).data.user;
        if (cur && cur.id === userId) {
          var u = await sb.auth.updateUser({ password: password });
          return u.error ? { ok: false, error: u.error.message } : { ok: true };
        }
        var r = await sb.functions.invoke("set-user-password", { body: { userId: userId, password: password } });
        if (r.error) return { ok: false, error: "เปลี่ยนรหัสผ่านไม่สำเร็จ: " + r.error.message };
        if (r.data && r.data.ok === false) return { ok: false, error: r.data.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ" };
        return { ok: true };
      } catch (e) { return { ok: false, error: String(e) }; }
    },
  };

  // สถานะอุปกรณ์แบบสาธารณะ (สำหรับสแกน QR — ไม่ต้องล็อกอิน, ดูทีละเครื่อง)
  async function deviceStatus(tag) {
    var r = await sb.rpc("public_device_status", { tag: tag });
    if (r.error) return { ok: false, error: r.error.message };
    return { ok: true, data: (r.data && r.data[0]) || null };
  }

  // บันทึกสถานะการแจ้งความประสงค์ของบุคคล (ยังไม่แจ้ง/กำลังใช้งาน/คืนแล้ว/ไม่ประสงค์ยืม)
  async function savePersonStatus(kind, id, status) {
    var r = await sb.from("person_status").upsert({ person_kind: kind, person_id: id, status: status, updated_at: new Date().toISOString() }, { onConflict: "person_kind,person_id" });
    if (r.error) notifyErr("person_status", r.error.message);
    return r.error ? { ok: false, error: r.error.message } : { ok: true };
  }

  window.SB = { live: true, auth: auth, hydrate: hydrate, loadSnapshot: loadSnapshot, saveAudit: saveAudit, db: db, syncDiff: syncDiff, users: users, saveSettings: saveSettings, deviceStatus: deviceStatus, savePersonStatus: savePersonStatus };
})();
