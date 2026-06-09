/* ===== Shared store + Thai BE date picker ===== */
(function () {
  // Data source is injected into build(D): window.__REMOTE_DATA__ in live (Supabase)
  // mode, or window.NHP (mock) in demo mode. The store can be re-hydrated after login
  // via window.Store.hydrate(newData).

  // persisted external-DB connection state (real, survives reload)
  function loadDrive() {
    try {
      const raw = localStorage.getItem("nhp-drive");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { google: false, onedrive: false, lastSync: null, freq: "ทุกวัน เวลา 02:00 น." };
  }
  // persisted general settings (current academic year + school info)
  function loadSettings() {
    let v = {};
    try { const raw = localStorage.getItem("nhp-settings"); if (raw) v = JSON.parse(raw); } catch (e) {}
    return {
      year: v.year || "2569",
      school: Object.assign({
        name: "โรงเรียนหนองหงส์พิทยาคม", affiliation: "สพม.บุรีรัมย์",
        phone: "044-000-000", email: "contact@nhp.ac.th",
        address: "อ.หนองหงส์ จ.บุรีรัมย์",
        footer: "© 2569 โรงเรียนหนองหงส์พิทยาคม · NHP iPad Management System",
      }, v.school || {}),
    };
  }

  // seed the borrow–return registry with a few realistic completed return transactions
  function buildReturnLog(students, teachers) {
    const accSet = [
      [{ id: 1, name: "สายชาร์จ USB-C", qty: 1 }, { id: 3, name: "เคสกันกระแทก", qty: 1 }],
      [{ id: 1, name: "สายชาร์จ USB-C", qty: 1 }, { id: 2, name: "อะแดปเตอร์ 20W", qty: 1 }, { id: 3, name: "เคสกันกระแทก", qty: 1 }],
      [{ id: 3, name: "เคสกันกระแทก", qty: 1 }, { id: 4, name: "ฟิล์มกันรอย", qty: 1 }],
    ];
    const mk = (id, person, kind, dev, model, date, items) => {
      const damaged = items.filter(it => it.cond !== "สมบูรณ์").map(it => it.assetTag);
      const incomplete = items.some(it => it.missingAcc && it.missingAcc.length);
      return {
        id, date, personName: person.prefix + person.first + " " + person.last,
        personKind: kind, personId: person.id,
        level: kind === "s" ? person.level + "/" + person.room : (person.subject || "ครู"),
        items, damaged, complete: !incomplete,
        receiver: "ครู ICT",
      };
    };
    const s0 = students[3], s1 = students[8], t0 = teachers[1];
    if (!s0 || !s1 || !t0) return [];
    return [
      mk(9001, s0, "s", "NHP-iPad-014", 'iPad (รุ่นที่ 9) 64GB', "2569-06-03", [
        { assetTag: "NHP-iPad-014", model: 'iPad (รุ่นที่ 9) 64GB', cond: "สมบูรณ์", notes: "", accExpected: accSet[0], accReturned: [1, 3], missingAcc: [] },
      ]),
      mk(9002, s1, "s", "NHP-iPad-027", 'iPad (รุ่นที่ 9) 64GB', "2569-06-02", [
        { assetTag: "NHP-iPad-027", model: 'iPad (รุ่นที่ 9) 64GB', cond: "มีรอยเล็กน้อย", notes: "มีรอยขีดข่วนที่ฝาหลัง", accExpected: accSet[1], accReturned: [1, 3], missingAcc: ["อะแดปเตอร์ 20W"] },
      ]),
      mk(9003, t0, "t", "NHP-iPad-051", 'iPad Air (รุ่นที่ 5) 256GB', "2569-05-30", [
        { assetTag: "NHP-iPad-051", model: 'iPad Air (รุ่นที่ 5) 256GB', cond: "ชำรุด", notes: "จอแตกมุมล่างซ้าย ส่งซ่อมต่อ", accExpected: accSet[2], accReturned: [3, 4], missingAcc: [] },
        { assetTag: "NHP-iPad-052", model: 'iPad Air (รุ่นที่ 5) 256GB', cond: "สมบูรณ์", notes: "", accExpected: accSet[0], accReturned: [1, 3], missingAcc: [] },
      ]),
    ];
  }

  // accessory damage/loss tally accumulated from returns: { accId: { damaged, lost } }
  function buildAccStatus(accs) {
    const m = {};
    accs.forEach((a, i) => { m[a.id] = { damaged: i === 0 ? 2 : i === 2 ? 1 : 0, lost: i === 1 ? 1 : 0 }; });
    return m;
  }
  // accessory repair tickets — tied to the person who borrowed the accessory
  function buildAccRepairs(borrows, accs) {
    const out = [];
    const probs = ["สายชาร์จขาด/ชำรุด", "อะแดปเตอร์เสีย", "เคสแตก/ชำรุด"];
    const withAcc = borrows.filter(b => (b.accessories || []).length > 0).slice(0, 3);
    withAcc.forEach((b, i) => {
      const a = b.accessories[0];
      out.push({
        id: 200000 + i, ticket: "AR-" + String(i + 1).padStart(4, "0"),
        accId: a.id, accName: a.name, device: b.device,
        borrowerName: b.holder, borrowerKind: b.borrowerKind, borrowerId: b.borrowerId, level: b.level,
        problem: probs[i % probs.length], date: "2569-06-0" + (2 + i),
        status: i === 0 ? "กำลังซ่อม" : "รอดำเนินการ", statusCls: i === 0 ? "b-info" : "b-warn",
        detail: "แจ้งโดยผู้ดูแลระบบ",
      });
    });
    return out;
  }

  // build a coherent, real-looking activity feed from actual records
  function buildInitialAudit(borrows, repairs, students) {
    const out = [];
    let id = 1;
    const base = new Date(2026, 5, 5, 9, 12, 0);
    let cursor = 0;
    const p = (n) => String(n).padStart(2, "0");
    const push = (action, detail, cls, user, nav, gapMin) => {
      cursor += gapMin || (8 + (id * 13) % 40);
      const dt = new Date(base.getTime() - cursor * 60000);
      out.push({
        id: id++, action, detail, cls, user,
        date: dt.getFullYear() + "-" + p(dt.getMonth() + 1) + "-" + p(dt.getDate()),
        time: p(dt.getHours()) + ":" + p(dt.getMinutes()) + ":" + p(dt.getSeconds()),
        ip: "192.168.1." + (10 + (id * 7) % 200), nav,
      });
    };
    const users = ["ผู้ดูแลระบบ", "ครู ICT", "ครูประสิทธิ์ ตั้งมั่น"];
    push("เข้าสู่ระบบ", "ผู้ดูแลระบบ เข้าสู่ระบบจาก 192.168.1.10", "b-info", "ผู้ดูแลระบบ", "dashboard", 4);
    // recent borrows
    borrows.slice(0, 4).forEach((b, i) => {
      push("ยืมอุปกรณ์", b.device + " → " + b.holder, "b-info", users[i % users.length], "overdue");
    });
    // recent repairs
    (repairs || []).slice(0, 3).forEach((r) => {
      push("แจ้งซ่อม", r.ticket + " · " + r.type + " — " + r.device, "b-warn", "ครู ICT", "repair");
    });
    // a couple of data edits + exports referencing real students/devices
    if (students && students[0]) push("แก้ไขข้อมูล", "นักเรียน " + students[0].first + " " + students[0].last, "b-warn", "ผู้ดูแลระบบ", "students");
    if (borrows[1]) push("ส่งออกรายงาน", "รายงานการยืม–คืน (" + borrows[1].device + ")", "b-purple", "ครู ICT", "reports");
    push("เปลี่ยนการตั้งค่า", "ปรับความถี่การสำรองข้อมูลอัตโนมัติ", "b-muted", "ผู้ดูแลระบบ", "settings");
    return out;
  }

  const accDefaults = [
    { id: 1, name: "สายชาร์จ USB-C", qty: 60, note: "สำหรับ iPad รุ่นใหม่" },
    { id: 2, name: "อะแดปเตอร์ 20W", qty: 48, note: "" },
    { id: 3, name: "เคสกันกระแทก", qty: 120, note: "ติดตั้งพร้อมเครื่อง" },
    { id: 4, name: "ฟิล์มกันรอย", qty: 90, note: "" },
    { id: 5, name: "Apple Pencil", qty: 15, note: "เบิกเฉพาะงานออกแบบ" },
  ];
  // ===== build a complete UI snapshot from a raw data source D =====
  function build(D) {
  // resolve a borrow's holder name back to a real student/teacher record
  const matchPerson = (name, kind) => {
    if (!name) return null;
    const pool = kind === "t" ? D.teachers : D.students;
    return pool.find(p => name.includes(p.first) && name.includes(p.last)) || null;
  };
  // attach owned accessories to existing borrows so detail views can show them,
  // and bind each borrow to a real person id so status/return sync is reliable
  const seededBorrows = D.borrows.map((b, i) => {
    const kind = b.borrowerKind || (b.level && b.level.includes("ครู") ? "t" : "s");
    const person = matchPerson(b.holder, kind) || (kind === "t" ? null : matchPerson(b.holder, "t"));
    return {
      ...b,
      accessories: b.accessories || [
        { id: 1, name: "สายชาร์จ USB-C", qty: 1 },
        { id: 3, name: "เคสกันกระแทก", qty: 1 },
      ].slice(0, (i % 3) + 1),
      borrowerKind: person && person.level === undefined ? "t" : kind,
      borrowerId: b.borrowerId || (person ? person.id : undefined),
      usageStatus: "กำลังใช้งาน",
    };
  });
  const _settings = loadSettings();
  // per-person device-usage status:
  //   "กำลังใช้งาน" (holding) · "คืนแล้ว" (returned) · "ไม่ประสงค์ยืม" (declined) · "ยังไม่แจ้ง" (not declared, default)
  const personStatus = { ...(D.personStatus || {}) };  // base = สถานะที่บันทึกไว้ใน DB
  // (กำลังใช้งาน ถูก derive จาก borrows ด้านล่าง — avoids stale)

  const ipads = D.devices.filter(d => d.type === "ipad").map(d => ({ ...d }));
  // เรียงตามเลขเครื่องแบบธรรมชาติ (SC2 < SC10 < SC100) ทุกหน้าที่อ่านจาก ipads จะได้ลำดับถูก
  ipads.sort((a, b) => String(a.assetTag).localeCompare(String(b.assetTag), undefined, { numeric: true, sensitivity: "base" }));
  const byCode = (a, b) => String(a.code || "").localeCompare(String(b.code || ""), undefined, { numeric: true, sensitivity: "base" });
  // นักเรียน: เรียงตามชั้น→ห้อง→เลขที่ (ห้องน้อยไปมาก)
  const lvNum = (lv) => { const m = String(lv || "").match(/(\d+)/); return m ? +m[1] : 99; };
  const byClass = (a, b) => (lvNum(a.level) - lvNum(b.level)) || ((+a.room || 0) - (+b.room || 0)) || ((+a.no || 0) - (+b.no || 0)) || byCode(a, b);
  // ครู: TC ขึ้นก่อน SC แล้วค่อยตามรหัสแบบธรรมชาติ
  const tPref = (t) => { const c = String(t.code || ""); return c.indexOf("TC") === 0 ? 0 : c.indexOf("SC") === 0 ? 1 : 2; };
  const byTeacher = (a, b) => (tPref(a) - tPref(b)) || byCode(a, b);
  const repairs = D.repairs.map(r => ({ ...r }));
  // ===== Sync repairs <-> iPad status (single source of truth) =====
  const ACTIVE = ["รอดำเนินการ", "กำลังซ่อม"];
  const isActive = (r) => ACTIVE.includes(r.status);
  // 1) every iPad currently "ชำรุด" with NO ticket: leave as-is (broken without repair order).
  //    every iPad with an active repair ticket must show "ชำรุด" — create a ticket for legacy "ส่งซ่อม" devices.
  let rc = repairs.length;
  ipads.forEach(d => {
    if (d.status === "ส่งซ่อม" && !repairs.some(r => r.device === d.assetTag && isActive(r))) {
      rc++;
      repairs.unshift({
        id: 100000 + rc, ticket: "RP-" + String(rc).padStart(4, "0"),
        device: d.assetTag, model: d.model, type: D.repairTypes[d.id % D.repairTypes.length],
        reporter: "ครู ICT", date: "2569-06-01", status: "รอดำเนินการ", statusCls: "b-warn",
        detail: "ตรวจพบขณะตรวจสภาพเครื่อง",
      });
    }
  });
  // 2) every iPad with an active repair must show "ชำรุด" (and not be borrowed)
  const activeTags = new Set(repairs.filter(isActive).map(r => r.device));
  ipads.forEach(d => {
    if (activeTags.has(d.assetTag)) { d.status = "ชำรุด"; d.statusCls = "b-danger"; d.holder = null; d.holderLevel = null; }
  });
  // a device in active repair can't also be on loan — drop any conflicting borrow.
  // also keep ONLY iPad borrows so every count reconciles with the iPad inventory.
  const ipadTags = new Set(ipads.map(d => d.assetTag));
  const _filteredBorrows = seededBorrows.filter(b => ipadTags.has(b.device) && !activeTags.has(b.device));
  // enforce 1 device per person — drop any extra holdings (keep the first)
  const _seenHolder = new Set();
  const repairedBorrows = _filteredBorrows.filter(b => {
    const key = (b.borrowerKind || "?") + ":" + (b.borrowerId != null ? b.borrowerId : b.holder);
    if (_seenHolder.has(key)) return false;
    _seenHolder.add(key); return true;
  });
  // ===== Reconcile device status with borrow records (single source of truth) =====
  // every borrowed iPad shows "ถูกยืม" with its holder; every other non-repair/non-broken/
  // non-lost iPad is "พร้อมใช้งาน". Guarantees: count(ถูกยืม) === borrows.length.
  const borrowByTag = {};
  repairedBorrows.forEach(b => { borrowByTag[b.device] = b; });
  ipads.forEach(d => {
    const b = borrowByTag[d.assetTag];
    if (b) { d.status = "ถูกยืม"; d.statusCls = "b-info"; d.holder = b.holder; d.holderLevel = b.level; }
    else if (d.status === "ถูกยืม") { d.status = "พร้อมใช้งาน"; d.statusCls = "b-ok"; d.holder = null; d.holderLevel = null; }
  });

  // ===== Populate person-status from the FINAL borrow set (avoids stale "กำลังใช้งาน") =====
  repairedBorrows.forEach(b => { if (b.borrowerKind && b.borrowerId != null) personStatus[b.borrowerKind + ":" + b.borrowerId] = "กำลังใช้งาน"; });
  // build the return ledger, then DROP any entry whose person currently holds a device
  // (a holder is "กำลังใช้งาน", not "คืนแล้ว") so dashboard returnLog count === StatusLookup คืนแล้ว count
  const _holderKeys = new Set(repairedBorrows.filter(b => b.borrowerId != null).map(b => b.borrowerKind + ":" + b.borrowerId));
  const _returnLog = D.returnLog || buildReturnLog(D.students, D.teachers)
    .filter(r => !(r.personKind && r.personId != null && _holderKeys.has(r.personKind + ":" + r.personId)));
  // people in the (filtered) return ledger are "คืนแล้ว"
  _returnLog.forEach(r => { if (r.personKind && r.personId != null) personStatus[r.personKind + ":" + r.personId] = "คืนแล้ว"; });
  // (demo เท่านั้น) seed ตัวอย่าง "ไม่ประสงค์ยืม" — ข้ามในโหมด live ที่มี personStatus จาก DB แล้ว
  if (!D.personStatus) {
    D.students.forEach(p => { const k = "s:" + p.id; if (!personStatus[k] && p.id % 7 === 0) personStatus[k] = "ไม่ประสงค์ยืม"; });
    D.teachers.forEach(p => { const k = "t:" + p.id; if (!personStatus[k] && p.id % 5 === 0) personStatus[k] = "ไม่ประสงค์ยืม"; });
  }

  const s = {
    students: D.students.slice().sort(byClass),
    teachers: D.teachers.slice().sort(byTeacher),
    ipads,
    accessories: D.accessories || accDefaults,
    academicYears: D.academicYears || [],
    systemUsers: D.systemUsers || [],
    rooms: D.rooms || (window.NHP && window.NHP.rooms) || [1, 2, 3, 4],
    borrows: repairedBorrows,
    repairs: repairs.filter(r => ipadTags.has(r.device)),  // iPad repair tickets only (reconciles with dashboard)
    accRepairs: D.accRepairs || buildAccRepairs(repairedBorrows, accDefaults),  // accessory repair tickets (separate board)
    accStatus: buildAccStatus(accDefaults),  // { accId: { damaged, lost } } accumulated from returns
    subjects: D.subjects.slice(),
    repairTypes: D.repairTypes.slice(),       // editable list of repair problem types
    accRepairTypes: ["สายชาร์จขาด/ชำรุด", "อะแดปเตอร์เสีย", "เคสแตก/ชำรุด", "ฟิล์มเสียหาย", "ปากกาใช้ไม่ได้", "อื่น ๆ"],
    audit: D.audit || buildInitialAudit(repairedBorrows, repairs.filter(r => ipadTags.has(r.device)), D.students),
    photos: {},          // key "s:<id>" / "t:<id>" -> dataURL
    personStatus,        // key "s:<id>" / "t:<id>" -> usage status
    logo: "assets/logo.png",
    drive: loadDrive(),
    year: D.year || _settings.year,
    school: Object.assign({}, _settings.school, D.school || {}),
    gradHolders: [],     // graduated students still holding a device (kept for tracking)
    deviceEvents: {},    // assetTag -> [{holder, level, from, to, days, kind}] real borrow/return/repair events
    returnLog: _returnLog,  // borrow–return registry ledger
  };
    return s;
  }

  const EMPTY = { students: [], teachers: [], devices: [], borrows: [], repairs: [], repairTypes: [], subjects: [] };
  const subs = new Set();
  let s = build(window.__REMOTE_DATA__ || window.NHP || EMPTY);
  window.Store = {
    snapshot: () => s,
    update: (patch) => {
      const before = s;
      s = { ...s, ...(typeof patch === "function" ? patch(s) : patch) };
      subs.forEach(f => f());
      // Live mode: เขียนการเปลี่ยนแปลงกลับฐานข้อมูลอัตโนมัติ (insert/update/delete)
      if (window.SB && window.SB.live && window.SB.syncDiff) window.SB.syncDiff(before, s);
    },
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    // re-build the whole snapshot from a fresh data source (used after Supabase login)
    hydrate: (D) => { s = build(D || EMPTY); subs.forEach(f => f()); },
  };
})();

/* unique integer id generator (PK ต้องเป็น bigint — ห้ามใช้ float) */
let _uidSeq = Date.now();
window.uid = () => (_uidSeq += 1);

/* append an audit-log entry (newest first) */
window.logAction = (action, detail, cls, user, nav) => {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const entry = {
    id: Date.now() + Math.random(),
    action, detail: detail || "", cls: cls || "b-info",
    user: user || "ผู้ดูแลระบบ", nav: nav || null,
    date: now.getFullYear() + "-" + p(now.getMonth() + 1) + "-" + p(now.getDate()),
    time: p(now.getHours()) + ":" + p(now.getMinutes()) + ":" + p(now.getSeconds()),
    ip: "192.168.1." + (10 + Math.floor(Math.random() * 200)),
  };
  window.Store.update(st => ({ audit: [entry, ...st.audit] }));
  // Live mode: บันทึกลงฐานข้อมูลด้วย (ไม่ block UI)
  if (window.SB && window.SB.live) window.SB.saveAudit(entry);
};

/* return a borrowed device — frees the device, restores accessories, removes the
   borrow record, marks the holder as "คืนแล้ว", and logs the action. */
window.returnBorrow = (b, opts = {}) => {
  window.Store.update(st => {
    const ps = { ...st.personStatus };
    if (b.borrowerKind && b.borrowerId != null) ps[b.borrowerKind + ":" + b.borrowerId] = "คืนแล้ว";
    // close the open ownership event for this device (live timeline)
    const evList = (st.deviceEvents[b.device] || []).slice();
    for (let i = evList.length - 1; i >= 0; i--) {
      if (evList[i].to == null) {
        const fromD = new Date(evList[i].from.replace(/^25/, "20"));
        const toD = new Date("2026-06-05");
        evList[i] = { ...evList[i], to: "2569-06-05", days: Math.max(1, Math.round((toD - fromD) / 86400000)), kind: "borrow" };
        break;
      }
    }
    return {
      ipads: st.ipads.map(d => (d.assetTag === b.device || d.id === b.deviceId)
        ? { ...d, status: "พร้อมใช้งาน", statusCls: "b-ok", holder: null, holderLevel: null } : d),
      accessories: st.accessories.map(x => {
        const r = (b.accessories || []).find(a => a.id === x.id);
        return r ? { ...x, qty: x.qty + r.qty } : x;
      }),
      borrows: st.borrows.filter(r => r.id !== b.id),
      personStatus: ps,
      deviceEvents: { ...st.deviceEvents, [b.device]: evList },
    };
  });
  window.logAction("คืนอุปกรณ์", b.device + " ← " + b.holder + (opts.cond ? " · " + opts.cond : ""), "b-ok", opts.user, "timeline");
};

/* record a full return transaction (one person, one or more devices), update device
   status per condition, restore returned accessories, remove borrow records, set the
   person's usage status, append to the borrow–return registry, and log it.
   tx = { personName, personKind, personId, level, receiver, items:[
          { borrow, assetTag, model, deviceId, cond, notes,
            accExpected:[{id,name,qty}], accReturnedIds:[id...] } ] } */
window.recordReturn = (tx) => {
  window.Store.update(st => {
    const tags = new Set(tx.items.map(it => it.assetTag));
    const ids = new Set(tx.items.map(it => it.deviceId));
    // device status from condition: ชำรุด → "ชำรุด", else "พร้อมใช้งาน"
    const condStatus = (c) => c === "ชำรุด"
      ? { status: "ชำรุด", statusCls: "b-danger" }
      : { status: "พร้อมใช้งาน", statusCls: "b-ok" };
    const byTag = {}; tx.items.forEach(it => { byTag[it.assetTag] = it; });

    // accessory accounting per return: restore good ones to stock, tally damaged/lost
    const accGain = {};
    const accDamageDelta = {};  // { accId: { damaged, lost } }
    const bump = (id, key) => { accDamageDelta[id] = accDamageDelta[id] || { damaged: 0, lost: 0 }; accDamageDelta[id][key]++; };
    tx.items.forEach(it => {
      const details = it.accDetails && it.accDetails.length ? it.accDetails : null;
      (it.accExpected || []).forEach(a => {
        const d = details ? details.find(x => x.id === a.id) : null;
        const cond = d ? d.cond : ((it.accReturnedIds || []).includes(a.id) ? "สมบูรณ์" : "ไม่คืน");
        if (cond === "ชำรุด") bump(a.id, "damaged");
        else if (cond === "ไม่คืน" || (d && d.returned === false)) bump(a.id, "lost");
        else accGain[a.id] = (accGain[a.id] || 0) + a.qty;  // good → back to stock
      });
    });

    // close open timeline events for each returned device
    const deviceEvents = { ...st.deviceEvents };
    tx.items.forEach(it => {
      const evList = (deviceEvents[it.assetTag] || []).slice();
      for (let i = evList.length - 1; i >= 0; i--) {
        if (evList[i].to == null) {
          const fromD = new Date(String(evList[i].from).replace(/^25/, "20"));
          evList[i] = { ...evList[i], to: "2569-06-05", days: Math.max(1, Math.round((new Date("2026-06-05") - fromD) / 86400000)), kind: it.cond === "ชำรุด" ? "repair" : "borrow" };
          break;
        }
      }
      deviceEvents[it.assetTag] = evList;
    });

    // remaining devices still held by this person after this return
    const remaining = st.borrows.filter(b =>
      !tags.has(b.device) && !ids.has(b.deviceId) &&
      ((tx.personId != null && b.borrowerKind === tx.personKind && b.borrowerId === tx.personId)));
    const ps = { ...st.personStatus };
    if (tx.personKind && tx.personId != null) ps[tx.personKind + ":" + tx.personId] = remaining.length ? "กำลังใช้งาน" : "คืนแล้ว";

    // build registry entry
    const logItems = tx.items.map(it => {
      const missing = (it.accExpected || []).filter(a => !(it.accReturnedIds || []).includes(a.id)).map(a => a.name);
      return { assetTag: it.assetTag, model: it.model, cond: it.cond, notes: it.notes || "", accExpected: it.accExpected || [], accReturned: it.accReturnedIds || [], missingAcc: missing, accDetails: it.accDetails || [] };
    });
    const damaged = logItems.filter(it => it.cond !== "สมบูรณ์").map(it => it.assetTag);
    const complete = !logItems.some(it => it.missingAcc.length);
    const now = new Date();
    const entry = {
      id: window.uid(), date: tx.date || window.todayISO(),
      personName: tx.personName, personKind: tx.personKind, personId: tx.personId, level: tx.level,
      items: logItems, damaged, complete, receiver: tx.receiver || "ผู้ดูแลระบบ",
    };

    // auto-create a repair ticket for each device returned ชำรุด, so it enters
    // the แจ้งซ่อม board (รอดำเนินการ) in addition to showing status "ชำรุด"
    const dmgItems = tx.items.filter(it => it.cond === "ชำรุด");
    let rcount = (st.repairs || []).length;
    const newRepairs = dmgItems.map((it, i) => ({
      id: window.uid(),
      ticket: "RP-" + String(rcount + i + 1).padStart(4, "0"),
      device: it.assetTag, model: it.model, type: "เสียหายจากการคืน",
      reporter: tx.receiver || "ผู้ดูแลระบบ", date: "2569-06-05",
      status: "รอดำเนินการ", statusCls: "b-warn",
      detail: (it.notes ? it.notes + " · " : "") + "พบความเสียหายตอนคืนจาก " + tx.personName,
      photos: [],
    }));

    return {
      ipads: st.ipads.map(d => (tags.has(d.assetTag) || ids.has(d.id))
        ? { ...d, ...condStatus(byTag[d.assetTag] ? byTag[d.assetTag].cond : "สมบูรณ์"), holder: null, holderLevel: null } : d),
      accessories: st.accessories.map(x => accGain[x.id] ? { ...x, qty: x.qty + accGain[x.id] } : x),
      repairs: newRepairs.length ? [...newRepairs, ...st.repairs] : st.repairs,
      accStatus: (() => {
        const next = { ...st.accStatus };
        Object.keys(accDamageDelta).forEach(id => {
          const cur = next[id] || { damaged: 0, lost: 0 };
          next[id] = { damaged: cur.damaged + accDamageDelta[id].damaged, lost: cur.lost + accDamageDelta[id].lost };
        });
        return next;
      })(),
      borrows: st.borrows.filter(b => !tags.has(b.device) && !ids.has(b.deviceId)),
      personStatus: ps,
      deviceEvents,
      returnLog: [entry, ...st.returnLog],
    };
  });
  if (tx.items.some(i => i.cond === "ชำรุด")) window.logAction("แจ้งซ่อม", "สร้างงานซ่อมอัตโนมัติจากการคืนเครื่องชำรุด", "b-warn", tx.receiver, "repair");
  window.logAction("คืนอุปกรณ์", tx.personName + " คืน " + tx.items.length + " เครื่อง" + (tx.items.some(i => i.cond !== "สมบูรณ์") ? " · มีอุปกรณ์เสียหาย" : ""), "b-ok", tx.receiver, "registry");
};

/* revert a completed return back to "กำลังยืม" — re-creates borrow records, marks
   devices ถูกยืม again, reverses accessory stock/damage accounting, removes the log entry. */
window.revertReturn = (entry) => {
  window.Store.update(st => {
    const tags = new Set(entry.items.map(it => it.assetTag));
    const accDeduct = {};      // good accessories had returned to stock → take back out
    const accDmgReverse = {};  // damaged/lost had been tallied → reverse
    entry.items.forEach(it => {
      const details = it.accDetails && it.accDetails.length ? it.accDetails : null;
      (it.accExpected || []).forEach(a => {
        const d = details ? details.find(x => x.id === a.id) : null;
        const cond = d ? d.cond : ((it.accReturned || []).includes(a.id) ? "สมบูรณ์" : "ไม่คืน");
        if (cond === "ชำรุด") { accDmgReverse[a.id] = accDmgReverse[a.id] || { damaged: 0, lost: 0 }; accDmgReverse[a.id].damaged++; }
        else if (cond === "ไม่คืน") { accDmgReverse[a.id] = accDmgReverse[a.id] || { damaged: 0, lost: 0 }; accDmgReverse[a.id].lost++; }
        else accDeduct[a.id] = (accDeduct[a.id] || 0) + a.qty;
      });
    });
    const newBorrows = entry.items.map(it => {
      const dev = st.ipads.find(d => d.assetTag === it.assetTag) || {};
      return {
        id: window.uid(), device: it.assetTag, deviceId: dev.id, model: it.model, type: "iPad",
        holder: entry.personName, level: entry.level, borrowDate: "2569-06-05", dueDate: "2570-03-01",
        overdueDays: -200, status: "ปกติ", approver: "ผู้ดูแลระบบ",
        accessories: (it.accExpected || []).map(a => ({ id: a.id, name: a.name, qty: a.qty })),
        borrowerKind: entry.personKind, borrowerId: entry.personId, usageStatus: "กำลังใช้งาน",
      };
    });
    return {
      ipads: st.ipads.map(d => tags.has(d.assetTag) ? { ...d, status: "ถูกยืม", statusCls: "b-info", holder: entry.personName, holderLevel: entry.level } : d),
      accessories: st.accessories.map(x => accDeduct[x.id] ? { ...x, qty: Math.max(0, x.qty - accDeduct[x.id]) } : x),
      accStatus: (() => {
        const next = { ...st.accStatus };
        Object.keys(accDmgReverse).forEach(id => {
          const cur = next[id] || { damaged: 0, lost: 0 };
          next[id] = { damaged: Math.max(0, cur.damaged - accDmgReverse[id].damaged), lost: Math.max(0, cur.lost - accDmgReverse[id].lost) };
        });
        return next;
      })(),
      borrows: [...newBorrows, ...st.borrows],
      personStatus: { ...st.personStatus, [entry.personKind + ":" + entry.personId]: "กำลังใช้งาน" },
      returnLog: st.returnLog.filter(r => r.id !== entry.id),
    };
  });
  window.logAction("แก้ไขสถานะคืน", entry.personName + " เปลี่ยนกลับเป็น “กำลังยืม” (" + entry.items.length + " เครื่อง)", "b-warn", "ผู้ดูแลระบบ", "registry");
};

/* change the accessory set on an active borrow, syncing stock both ways */
window.updateBorrowAccessories = (borrowId, newAcc) => {
  window.Store.update(st => {
    const b = st.borrows.find(x => x.id === borrowId);
    if (!b) return {};
    const delta = {};  // +qty back to stock
    (b.accessories || []).forEach(a => { delta[a.id] = (delta[a.id] || 0) + a.qty; });
    newAcc.forEach(a => { delta[a.id] = (delta[a.id] || 0) - a.qty; });
    return {
      accessories: st.accessories.map(x => delta[x.id] ? { ...x, qty: Math.max(0, x.qty + delta[x.id]) } : x),
      borrows: st.borrows.map(x => x.id === borrowId ? { ...x, accessories: newAcc } : x),
    };
  });
  window.logAction("แก้ไขอุปกรณ์เสริม", "ปรับอุปกรณ์เสริมของรายการยืม", "b-info", "ผู้ดูแลระบบ", "registry");
};

/* edit the accessory set on a RETURNED record's device (in the return ledger).
   accDetails = [{ id, name, cond, notes, returned }]. Syncs accStatus + stock deltas. */
window.updateReturnAccessories = (returnId, assetTag, accDetails) => {
  window.Store.update(st => {
    const entry = st.returnLog.find(r => r.id === returnId);
    if (!entry) return {};
    const it = (entry.items || []).find(x => x.assetTag === assetTag);
    if (!it) return {};
    // recompute stock/damage from OLD vs NEW accDetails
    const tally = (details) => {
      const r = { stock: {}, dmg: {} };
      (details || []).forEach(d => {
        if (d.cond === "ชำรุด") { r.dmg[d.id] = r.dmg[d.id] || { damaged: 0, lost: 0 }; r.dmg[d.id].damaged++; }
        else if (d.cond === "ไม่คืน" || d.returned === false) { r.dmg[d.id] = r.dmg[d.id] || { damaged: 0, lost: 0 }; r.dmg[d.id].lost++; }
        else r.stock[d.id] = (r.stock[d.id] || 0) + 1;
      });
      return r;
    };
    const oldT = tally(it.accDetails && it.accDetails.length ? it.accDetails : (it.accExpected || []).map(a => ({ id: a.id, name: a.name, cond: (it.accReturned || []).includes(a.id) ? "สมบูรณ์" : "ไม่คืน", returned: (it.accReturned || []).includes(a.id) })));
    const newT = tally(accDetails);
    const ids = new Set([...Object.keys(oldT.stock), ...Object.keys(newT.stock)]);
    const accGain = {};
    ids.forEach(id => { accGain[id] = (newT.stock[id] || 0) - (oldT.stock[id] || 0); });
    const dmgIds = new Set([...Object.keys(oldT.dmg), ...Object.keys(newT.dmg)]);
    const accStatus = { ...st.accStatus };
    dmgIds.forEach(id => {
      const o = oldT.dmg[id] || { damaged: 0, lost: 0 }, n = newT.dmg[id] || { damaged: 0, lost: 0 };
      const cur = accStatus[id] || { damaged: 0, lost: 0 };
      accStatus[id] = { damaged: Math.max(0, cur.damaged - o.damaged + n.damaged), lost: Math.max(0, cur.lost - o.lost + n.lost) };
    });
    const newItem = {
      ...it, accDetails,
      accExpected: accDetails.map(d => ({ id: d.id, name: d.name, qty: 1 })),
      accReturned: accDetails.filter(d => d.returned !== false && d.cond !== "ไม่คืน").map(d => d.id),
      missingAcc: accDetails.filter(d => d.returned === false || d.cond === "ไม่คืน").map(d => d.name),
    };
    const newItems = entry.items.map(x => x.assetTag === assetTag ? newItem : x);
    const newEntry = { ...entry, items: newItems, complete: !newItems.some(x => (x.missingAcc || []).length) };
    return {
      accessories: st.accessories.map(x => accGain[x.id] ? { ...x, qty: Math.max(0, x.qty + accGain[x.id]) } : x),
      accStatus,
      returnLog: st.returnLog.map(r => r.id === returnId ? newEntry : r),
    };
  });
  window.logAction("แก้ไขอุปกรณ์เสริม", "ปรับอุปกรณ์เสริมในทะเบียนการคืน", "b-info", "ผู้ดูแลระบบ", "registry");
};

/* remove a single borrowed device from a loan — frees the device, restores its
   accessories to stock, removes the borrow record, syncs person status. */
window.removeBorrowDevice = (borrowId) => {
  window.Store.update(st => {
    const b = st.borrows.find(x => x.id === borrowId);
    if (!b) return {};
    const remaining = st.borrows.filter(x => x.id !== borrowId &&
      x.borrowerKind === b.borrowerKind && x.borrowerId === b.borrowerId);
    const ps = { ...st.personStatus };
    if (b.borrowerKind && b.borrowerId != null) {
      const k = b.borrowerKind + ":" + b.borrowerId;
      if (!remaining.length && ps[k] === "กำลังใช้งาน") ps[k] = "ยังไม่แจ้ง";
    }
    return {
      ipads: st.ipads.map(d => (d.assetTag === b.device || d.id === b.deviceId)
        ? { ...d, status: "พร้อมใช้งาน", statusCls: "b-ok", holder: null, holderLevel: null } : d),
      accessories: st.accessories.map(x => { const a = (b.accessories || []).find(c => c.id === x.id); return a ? { ...x, qty: x.qty + a.qty } : x; }),
      borrows: st.borrows.filter(x => x.id !== borrowId),
      personStatus: ps,
    };
  });
  window.logAction("ลบรายการยืม", "นำอุปกรณ์ออกจากการยืม", "b-warn", "ผู้ดูแลระบบ", "registry");
};

/* create an accessory repair ticket tied to the borrower; logs + returns the ticket */
window.addAccRepair = (rec, accId, accName, problem, opts = {}) => {
  let ticket;
  window.Store.update(st => {
    const n = (st.accRepairs || []).length + 1;
    ticket = {
      id: window.uid(), ticket: "AR-" + String(n).padStart(4, "0"),
      accId, accName, device: rec.device || null,
      borrowerName: rec.holder, borrowerKind: rec.borrowerKind, borrowerId: rec.borrowerId, level: rec.level,
      problem, date: window.todayISO(), status: "รอดำเนินการ", statusCls: "b-warn",
      detail: opts.detail || "แจ้งโดยผู้ดูแลระบบ",
      photos: opts.photos || [],
    };
    return { accRepairs: [ticket, ...(st.accRepairs || [])] };
  });
  window.logAction("แจ้งซ่อมอุปกรณ์เสริม", ticket.ticket + " · " + accName + " — " + rec.holder, "b-warn", opts.user || "ผู้ดูแลระบบ", "repair");
  return ticket;
};

/* does this person have an active accessory repair (รอดำเนินการ/กำลังซ่อม)? */
window.hasActiveAccRepair = (person) => {
  const kind = person.level !== undefined ? "s" : "t";
  return (window.Store.snapshot().accRepairs || []).some(r =>
    r.borrowerKind === kind && r.borrowerId === person.id &&
    (r.status === "รอดำเนินการ" || r.status === "กำลังซ่อม"));
};

/* quick one-tap borrow (used by Quick Station). Mirrors the wizard borrow logic. */
window.quickBorrow = (device, borrower, opts = {}) => {
  const holderLabel = borrower.level ? borrower.level + "/" + borrower.room : "ครู";
  const due = opts.due || "2569-06-18";
  const holderName = borrower.prefix + borrower.first + " " + borrower.last;
  const chosenAcc = opts.accessories || [];
  window.Store.update(st => ({
    ipads: st.ipads.map(d => d.id === device.id ? { ...d, status: "ถูกยืม", statusCls: "b-info", holder: holderName, holderLevel: holderLabel } : d),
    accessories: st.accessories.map(x => { const a = chosenAcc.find(c => c.id === x.id); return a ? { ...x, qty: Math.max(0, x.qty - a.qty) } : x; }),
    borrows: [{ id: window.uid(), device: device.assetTag, deviceId: device.id, model: device.model, type: "iPad", holder: holderName, level: holderLabel, borrowDate: window.todayISO(), dueDate: due, overdueDays: -13, status: "ปกติ", approver: opts.user || "จุดบริการด่วน", accessories: chosenAcc, borrowerKind: borrower.level ? "s" : "t", borrowerId: borrower.id, usageStatus: "กำลังใช้งาน" }, ...st.borrows],
    personStatus: { ...st.personStatus, [(borrower.level !== undefined ? "s:" : "t:") + borrower.id]: "กำลังใช้งาน" },
    deviceEvents: { ...st.deviceEvents, [device.assetTag]: [...(st.deviceEvents[device.assetTag] || []), { holder: holderName, level: holderLabel, from: "2569-06-05", to: null, days: null, kind: "current", year: st.year, term: "1" }] },
  }));
  window.logAction("ยืมอุปกรณ์", device.assetTag + " → " + holderName + (chosenAcc.length ? " · อุปกรณ์เสริม " + chosenAcc.length : "") + " (จุดบริการด่วน)", "b-info", opts.user || "จุดบริการด่วน", "borrow");
};

/* set the academic year for the whole system (dashboard, headers, reports) */
window.setAcademicYear = (year) => {
  window.Store.update(st => {
    const next = { ...st, year };
    try { localStorage.setItem("nhp-settings", JSON.stringify({ year, school: st.school })); } catch (e) {}
    return { year };
  });
  window.logAction("เปลี่ยนปีการศึกษา", "กำหนดปีปัจจุบันเป็น ปีการศึกษา " + year, "b-info", "ผู้ดูแลระบบ", "settings");
};
/* persist school info */
window.saveSchoolInfo = (school) => {
  window.Store.update(st => {
    try { localStorage.setItem("nhp-settings", JSON.stringify({ year: st.year, school })); } catch (e) {}
    return { school };
  });
  // live: บันทึกข้อมูลโรงเรียนลงตาราง settings ด้วย
  if (window.SB && window.SB.live && window.SB.saveSettings)
    window.SB.saveSettings({ school_name: school.name, affiliation: school.affiliation, address: school.address });
};
/* recompute every iPad's repair/availability status from the current repairs list.
   A device with an active repair (รอดำเนินการ/กำลังซ่อม) shows "ชำรุด";
   when its repair is marked ซ่อมเสร็จ it returns to "พร้อมใช้งาน".
   A device that is ชำรุด with NO repair ticket (manually flagged broken) is left untouched. */
window.syncDevicesFromRepairs = () => {
  window.Store.update(st => {
    const active = new Set(st.repairs.filter(r => r.status === "รอดำเนินการ" || r.status === "กำลังซ่อม").map(r => r.device));
    // a device that has any ticket but NONE active → repair concluded (ซ่อมเสร็จ/ยกเลิก)
    const hasTicket = {};
    st.repairs.forEach(r => { hasTicket[r.device] = true; });
    const concluded = new Set(Object.keys(hasTicket).filter(tag => !active.has(tag)));
    return {
      ipads: st.ipads.map(d => {
        // active repair → must show ชำรุด (and not borrowed)
        if (active.has(d.assetTag)) {
          return d.status === "ชำรุด" ? d : { ...d, status: "ชำรุด", statusCls: "b-danger", holder: null, holderLevel: null };
        }
        // ชำรุด with a concluded ticket (ซ่อมเสร็จ or ยกเลิก) → device is resolved → พร้อมใช้งาน (unless borrowed/lost)
        if (d.status === "ชำรุด" && concluded.has(d.assetTag)) {
          const borrowed = st.borrows.some(b => b.device === d.assetTag);
          return borrowed ? { ...d, status: "ถูกยืม", statusCls: "b-info" } : { ...d, status: "พร้อมใช้งาน", statusCls: "b-ok" };
        }
        return d;
      }),
    };
  });
};

/* keep the active iPad-repair count and device statuses fully reconciled — call after any
   repair ticket add/edit/delete OR device status change so the two views never diverge. */
window.reconcileRepairs = () => window.syncDevicesFromRepairs();

/* manual override of a person's device-usage status */
window.setPersonStatus = (person, status) => {
  const kind = person.level !== undefined ? "s" : "t";
  const key = kind + ":" + person.id;
  window.Store.update(st => ({ personStatus: { ...st.personStatus, [key]: status } }));  // persist ผ่าน syncDiff (syncPersonStatus)
  const name = (person.prefix || "") + person.first + " " + person.last;
  window.logAction("เปลี่ยนสถานะผู้ใช้", name + " → " + status, "b-info", "ผู้ดูแลระบบ", person.level !== undefined ? "students" : "teachers");
};
/* derived device-usage status for a person, reflecting real records */
window.personDeviceStatus = (person) => {
  const key = (person.level !== undefined ? "s:" : "t:") + person.id;
  if (window.borrowsOf(person).length > 0) return "กำลังใช้งาน";
  // never report "กำลังใช้งาน" without an actual held device (avoids stale status)
  const manual = window.Store.snapshot().personStatus[key];
  if (manual && manual !== "กำลังใช้งาน") return manual;
  return "ยังไม่แจ้ง";
};

/* real, system-connected activity timeline for a person (student or teacher).
   Built from live borrow records + recorded device events — newest first. */
window.personActivity = (person) => {
  const st = window.Store.snapshot();
  const ipadBy = (tag) => st.ipads.find(d => d.assetTag === tag);
  const nameOf = person.first + " " + person.last;
  const out = [];
  // 1) current active borrows (live)
  window.borrowsOf(person).forEach(b => {
    const dev = ipadBy(b.device);
    out.push({ kind: "borrow", label: "ยืมอุปกรณ์ (กำลังถือครอง)", cls: "b-info", date: b.borrowDate,
      model: b.model, device: b.device, serial: dev ? dev.serial : "—", note: "กำหนดคืน " + b.dueDate });
  });
  // 2) recorded device events that match this person (borrow/return done through the system)
  Object.keys(st.deviceEvents || {}).forEach(tag => {
    (st.deviceEvents[tag] || []).forEach(ev => {
      if (!ev.holder || !ev.holder.includes(person.first) || !ev.holder.includes(person.last)) return;
      const dev = ipadBy(tag);
      out.push({ kind: "borrow", label: "ยืมอุปกรณ์", cls: "b-info", date: ev.from, model: (dev && dev.model) || "", device: tag, serial: dev ? dev.serial : "—" });
      if (ev.to) out.push({ kind: "return", label: "คืนอุปกรณ์", cls: "b-ok", date: ev.to, model: (dev && dev.model) || "", device: tag, serial: dev ? dev.serial : "—", note: ev.days ? ev.days + " วัน" : "" });
    });
  });
  // 3) audit-log entries that name this person (system actions)
  (st.audit || []).forEach(a => {
    if (a.detail && a.detail.includes(nameOf)) {
      out.push({ kind: a.cls === "b-ok" ? "return" : "audit", label: a.action, cls: a.cls || "b-muted", date: a.date, model: "", device: "", serial: "", note: a.detail });
    }
  });
  // de-dup borrow/return by device+date+label, newest first
  const seen = new Set();
  return out.filter(a => { const k = a.label + a.device + a.date; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => (y.date || "").localeCompare(x.date || ""));
};
// เก็บวันที่เป็น ค.ศ. (CE) ทั้งระบบ — แสดงผลเป็น พ.ศ. ผ่าน beShort/beLong (ที่ +543)
window.todayISO = () => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
window.pushDeviceEvent = (assetTag, ev) => {
  window.Store.update(st => {
    const list = (st.deviceEvents[assetTag] || []).slice();
    list.push(ev);
    return { deviceEvents: { ...st.deviceEvents, [assetTag]: list } };
  });
};
/* close the most recent open (to===null) event for a device with a return date */
window.closeDeviceEvent = (assetTag, toISO) => {
  window.Store.update(st => {
    const list = (st.deviceEvents[assetTag] || []).slice();
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].to == null) {
        const fromD = new Date(list[i].from.replace(/^25/, "20"));
        const toD = new Date((toISO || "2569-06-05").replace(/^25/, "20"));
        const days = Math.max(1, Math.round((toD - fromD) / 86400000));
        list[i] = { ...list[i], to: toISO, days, kind: list[i].kind === "current" ? "borrow" : list[i].kind };
        break;
      }
    }
    return { deviceEvents: { ...st.deviceEvents, [assetTag]: list } };
  });
};

function useStore() {
  const [, bump] = React.useState(0);
  React.useEffect(() => window.Store.subscribe(() => bump(n => n + 1)), []);
  const set = (patch) => window.Store.update(patch);
  return [window.Store.snapshot(), set];
}
window.useStore = useStore;

/* photo key helpers */
window.photoKey = (person) => (person.level !== undefined ? "s:" : "t:") + person.id;
window.getPhoto = (person) => window.Store.snapshot().photos[window.photoKey(person)] || null;

/* borrow records for a person (by kind+id, with name fallback only when unbound) */
window.borrowsOf = (person) => {
  const kind = person.level !== undefined ? "s" : "t";
  return window.Store.snapshot().borrows.filter(b =>
    (b.borrowerKind === kind && b.borrowerId === person.id) ||
    (b.borrowerId == null && b.holder && b.holder.includes(person.first) && b.holder.includes(person.last)));
};
window.hasBorrowed = (person) => window.borrowsOf(person).length > 0;

/* derived: overdue count from store.borrows */
window.overdueCount = () => window.Store.snapshot().borrows.filter(b => b.overdueDays > 0).length;

/* ===== Thai Buddhist-era date helpers ===== */
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function parseISO(iso) {
  if (!iso) return null;
  const m = String(iso).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
function toISO(dt) {
  const p = (n) => String(n).padStart(2, "0");
  return dt.getFullYear() + "-" + p(dt.getMonth() + 1) + "-" + p(dt.getDate());
}
function beLong(iso) {
  const dt = parseISO(iso); if (!dt) return "—";
  return dt.getDate() + " " + TH_MONTHS[dt.getMonth()] + " " + (dt.getFullYear() + 543);
}
function beShort(iso) {
  const dt = parseISO(iso); if (!dt) return "—";
  return dt.getDate() + " " + TH_MONTHS_SHORT[dt.getMonth()] + " " + (dt.getFullYear() + 543);
}
window.beLong = beLong; window.beShort = beShort; window.toISO = toISO; window.parseISO = parseISO;
// วันที่วันนี้แบบไทยย่อ เช่น "8 มิ.ย. 2569" (อิงเวลาจริงของเครื่อง)
window.todayTH = () => { const d = new Date(); return d.getDate() + " " + TH_MONTHS_SHORT[d.getMonth()] + " " + (d.getFullYear() + 543); };

function BEDatePicker({ value, onChange, min }) {
  const { useState, useRef, useEffect } = React;
  const [open, setOpen] = useState(false);
  const today = new Date(2026, 5, 5);
  const sel = parseISO(value) || today;
  const [view, setView] = useState({ y: sel.getFullYear(), m: sel.getMonth() });
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  useEffect(() => { const d = parseISO(value); if (d) setView({ y: d.getFullYear(), m: d.getMonth() }); }, [value]);

  const first = new Date(view.y, view.m, 1).getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const minDt = parseISO(min);
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const prevMonth = () => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 });
  const nextMonth = () => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 });
  const pick = (d) => { onChange(toISO(new Date(view.y, view.m, d))); setOpen(false); };
  const selISO = value ? toISO(sel) : null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="input" style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => setOpen(o => !o)}>
        <Icon name="calendar" size={17} style={{ color: "var(--text-3)", flexShrink: 0 }} />
        <span style={{ flex: 1, color: value ? "var(--text)" : "var(--text-3)" }}>{value ? beLong(value) : "เลือกวันที่"}</span>
        <Icon name="chevD" size={15} style={{ color: "var(--text-3)" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-lg)", padding: 14, width: 286 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={prevMonth}><Icon name="chevL" size={16} /></button>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{TH_MONTHS[view.m]} {view.y + 543}</div>
            <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={nextMonth}><Icon name="chevR" size={16} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
            {TH_DOW.map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 11.5, fontWeight: 600, color: "var(--text-3)", padding: "4px 0" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i}></div>;
              const iso = toISO(new Date(view.y, view.m, d));
              const isSel = iso === selISO;
              const isToday = iso === toISO(today);
              const disabled = minDt && new Date(view.y, view.m, d) < minDt;
              return (
                <button key={i} type="button" disabled={disabled} onClick={() => pick(d)} style={{
                  height: 34, borderRadius: 9, border: 0, fontSize: 13.5, fontWeight: isSel ? 700 : 500,
                  fontFamily: "var(--font-num)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .3 : 1,
                  background: isSel ? "var(--primary)" : "transparent", color: isSel ? "#fff" : "var(--text)",
                  outline: isToday && !isSel ? "1.5px solid var(--primary)" : "none",
                }}>{d}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => { onChange(toISO(today)); setOpen(false); }}>วันนี้</button>
            <span style={{ fontSize: 12, color: "var(--text-3)", alignSelf: "center" }}>พ.ศ. {view.y + 543}</span>
          </div>
        </div>
      )}
    </div>
  );
}
window.BEDatePicker = BEDatePicker;
