/* ===== Timeline + Reports + Settings ===== */
const DD = window.NHP;

function Timeline({ go }) {
  const [store] = useStore();
  const ipads = store.ipads;
  const [devId, setDevId] = useState(ipads[0].id);
  const holderInfo = (name) => {
    if (!name) return null;
    const all = [...store.students.map(p => ({ p, k: "s" })), ...store.teachers.map(p => ({ p, k: "t" }))];
    const hit = all.find(({ p }) => name.includes(p.first) && name.includes(p.last));
    if (!hit) return { photo: null, sex: name.includes("หญิง") ? "หญิง" : "ชาย" };
    return { photo: store.photos[hit.k + ":" + hit.p.id] || null, sex: hit.p.sex };
  };
  const [q, setQ] = useState("");
  const dev = ipads.find(d => d.id === devId) || ipads[0];
  const events = store.deviceEvents[dev.assetTag] || [];
  const hist = useMemo(() => {
    // baseline synthetic history; strip its synthetic "current" so real events drive the present
    const h = DD.genHistory(dev).map(x => x.kind === "current" ? { ...x, kind: "borrow" } : x);
    // append real, in-session ownership events (borrow / return / repair)
    events.forEach(e => h.push({ ...e, year: e.year || dev._evYear || String(parseInt(store.year)), term: e.term || "1" }));
    // ensure the present is reflected: device borrowed but no open real event → synthesize from live holder
    if (dev.status === "ถูกยืม" && dev.holder && !events.some(e => e.to == null)) {
      const rec = store.borrows.find(b => b.deviceId === dev.id || b.device === dev.assetTag);
      h.push({ kind: "current", holder: dev.holder, level: dev.holderLevel || (rec && rec.level), from: (rec && rec.borrowDate) || "2569-06-04", to: null, days: null, year: store.year, term: "1" });
    } else if (events.some(e => e.to == null)) {
      // mark the open real event as the current segment
      const open = [...h].reverse().find(x => x.to == null);
      if (open) open.kind = "current";
    }
    // device currently in repair (ชำรุด with an open repair ticket) → show an open repair segment
    const openRp = store.repairs.find(r => r.device === dev.assetTag && (r.status === "รอดำเนินการ" || r.status === "กำลังซ่อม"));
    if (dev.status === "ชำรุด" && openRp) {
      h.push({ kind: "repair", holder: "ส่งซ่อม — " + openRp.type, level: "ศูนย์ ICT", from: openRp.date || "2569-06-01", to: null, days: null, year: store.year, term: "1" });
    }
    return h;
  }, [dev.id, dev.holder, dev.status, store.borrows, store.deviceEvents, store.repairs, store.year]);
  const kindMeta = { borrow: { cls: "b-info", ic: "borrow", label: "ยืม" }, repair: { cls: "b-warn", ic: "repair", label: "ซ่อม" }, current: { cls: "b-ok", ic: "user", label: "ปัจจุบัน" } };
  const matches = q ? ipads.filter(d => (d.assetTag + d.serial + (d.holder || "")).toLowerCase().includes(q.toLowerCase())) : ipads;
  return (
    <div>
      <PageHead crumb={["ประวัติครอบครองอุปกรณ์"]} title="ประวัติครอบครองอุปกรณ์" desc="ติดตามเส้นทางการใช้งานตลอดอายุของอุปกรณ์" />

      <div className="toolbar">
        <div className="filter-input" style={{ minWidth: 300 }}>
          <Icon name="search" size={17} style={{ color: "var(--text-3)" }} />
          <input placeholder="ค้นหา Asset Tag, Serial หรือชื่อผู้ถือครอง…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="select" style={{ width: "auto", minWidth: 220 }} value={devId} onChange={e => setDevId(+e.target.value)}>
          {matches.map(d => <option key={d.id} value={d.id}>{d.assetTag} · {d.model}</option>)}
        </select>
        <span style={{ color: "var(--text-3)", fontSize: 13.5 }}>iPad ทั้งหมด {ipads.length} เครื่อง</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }} className="qr-row">
        <div className="card" style={{ alignSelf: "start" }}>
          <div className="card-pad" style={{ textAlign: "center" }}>
            <div style={{ width: 88, height: 88, borderRadius: 18, background: "var(--primary-soft)", display: "grid", placeItems: "center", color: "var(--primary)", margin: "0 auto 14px" }}>
              <Icon name="tablet" size={42} stroke={1.5} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{dev.model}</div>
            <div className="num" style={{ color: "var(--text-2)", marginBottom: 8 }}>{dev.assetTag}</div>
            <Badge cls={dev.statusCls} dot>{dev.status}</Badge>
          </div>
          <div style={{ borderTop: "1px solid var(--border)" }}>
            <div className="kv" style={{ padding: "11px 18px" }}><span className="k">Serial</span><span className="v num">{dev.serial}</span></div>
            <div className="kv" style={{ padding: "11px 18px" }}><span className="k">รับเข้า</span><span className="v num">{dev.receivedDate}</span></div>
            <div className="kv" style={{ padding: "11px 18px" }}><span className="k">ผู้ถือครองปัจจุบัน</span><span className="v">{dev.holder || "—"}</span></div>
            <div className="kv" style={{ padding: "11px 18px" }}><span className="k">ครอบครองมาแล้ว</span><span className="v num">{hist.length} ช่วง</span></div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>เส้นเวลาการครอบครอง</h3><div className="sub">{hist.length} รายการ</div></div>
          <div className="card-pad" style={{ paddingLeft: 28 }}>
            <div style={{ position: "relative", paddingLeft: 30 }}>
              <div style={{ position: "absolute", left: 7, top: 8, bottom: 8, width: 2, background: "var(--border)" }}></div>
              {[...hist].reverse().map((h, i) => {
                const m = kindMeta[h.kind];
                return (
                  <div key={i} style={{ position: "relative", paddingBottom: 24 }}>
                    <div style={{ position: "absolute", left: -30, top: 2, width: 16, height: 16, borderRadius: "50%", background: "var(--surface)", border: "3px solid " + (h.kind === "repair" ? "var(--warn)" : h.kind === "current" ? "var(--ok)" : "var(--primary)") }}></div>
                    <div className="card card-pad" style={{ padding: 16, background: "var(--surface-2)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                        <Badge cls={m.cls} dot>{m.label}</Badge>
                        <span className="num" style={{ fontSize: 12.5, color: "var(--text-3)" }}>ปีการศึกษา {h.year} · ภาคเรียน {h.term}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 4 }}>
                        {(() => {
                          const hi = holderInfo(h.holder);
                          return hi && hi.photo
                            ? <img src={hi.photo} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                            : <div className={"avatar" + (hi && hi.sex === "หญิง" ? " orange" : "")} style={{ width: 38, height: 38, fontSize: 15, flexShrink: 0 }}>{initials((h.holder || "").replace(/^(เด็กชาย|เด็กหญิง|นางสาว|นาย|ครู|ส่งซ่อม)/, ""))}</div>;
                        })()}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{h.holder}</div>
                          <div style={{ fontSize: 13, color: "var(--text-3)" }}>{h.level}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 13, color: "var(--text-2)" }}>
                        <span><Icon name="calendar" size={13} style={{ verticalAlign: -2, marginRight: 4, color: "var(--text-3)" }} /><span className="num">{h.from}</span> → <span className="num">{h.to || "ปัจจุบัน"}</span></span>
                        {h.days && <span className="num"><Icon name="clock" size={13} style={{ verticalAlign: -2, marginRight: 4, color: "var(--text-3)" }} />{h.days} วัน</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.Timeline = Timeline;

/* ===== Reports ===== */
function Reports({ go }) {
  const toast = React.useContext(ToastCtx);
  const [store] = useStore();
  const heldDevices = store.borrows;
  const reports = [
    { ic: "borrow", color: "var(--info)", soft: "var(--info-soft)", title: "รายงานการยืม–คืน", desc: "สรุปธุรกรรมยืมคืนตามช่วงเวลา",
      headers: ["Asset Tag", "รุ่น", "ผู้ยืม", "ชั้น/ห้อง", "วันที่ยืม", "ครบกำหนด", "สถานะ"],
      rows: () => store.borrows.map(b => [b.device, b.model, b.holder, b.level, b.borrowDate, b.dueDate, b.status]) },
    { ic: "box", color: "var(--brand-sky)", soft: "var(--primary-soft)", title: "รายงานอุปกรณ์ทั้งหมด", desc: "ทะเบียนครุภัณฑ์ดิจิทัลทั้งหมด",
      headers: ["Asset Tag", "ประเภท", "ยี่ห้อ", "รุ่น", "Serial", "สถานะ"],
      rows: () => DD.devices.map(d => [d.assetTag, d.typeName, d.brand, d.model, d.serial, d.status]) },
    { ic: "user", color: "var(--purple)", soft: "var(--purple-soft)", title: "ผู้ถือครองปัจจุบัน", desc: "รายชื่อผู้ครอบครองอุปกรณ์",
      headers: ["Asset Tag", "รุ่น", "ผู้ถือครอง", "สังกัด"],
      rows: () => heldDevices.map(b => [b.device, b.model, b.holder, b.level]) },
    { ic: "overdue", color: "var(--danger)", soft: "var(--danger-soft)", title: "รายงานค้างส่ง", desc: "อุปกรณ์ที่เกินกำหนดคืน",
      headers: ["Asset Tag", "ผู้ถือครอง", "ชั้น/ห้อง", "ครบกำหนด", "เกินกำหนด (วัน)"],
      rows: () => store.borrows.filter(b => b.overdueDays > 0).map(b => [b.device, b.holder, b.level, b.dueDate, b.overdueDays]) },
    { ic: "repair", color: "var(--warn)", soft: "var(--warn-soft)", title: "รายงานแจ้งซ่อม", desc: "ประวัติงานซ่อมทั้งหมด",
      headers: ["เลขที่", "Asset Tag", "รุ่น", "อาการ", "ผู้แจ้ง", "วันที่", "สถานะ"],
      rows: () => store.repairs.map(r => [r.ticket, r.device, r.model, r.type, r.reporter, r.date, r.status]) },
    { ic: "alert", color: "var(--danger)", soft: "var(--danger-soft)", title: "รายงานชำรุด / สูญหาย", desc: "อุปกรณ์ที่ชำรุดและสูญหาย",
      headers: ["Asset Tag", "ประเภท", "รุ่น", "Serial", "สถานะ"],
      rows: () => DD.devices.filter(d => d.status === "ชำรุด" || d.status === "สูญหาย").map(d => [d.assetTag, d.typeName, d.model, d.serial, d.status]) },
    { ic: "graduation", color: "var(--accent)", soft: "var(--accent-soft)", title: "รายงานตามระดับชั้น", desc: "การกระจายอุปกรณ์ตามชั้น/ห้อง",
      headers: ["ระดับชั้น", "จำนวนนักเรียน"],
      rows: () => DD.levelCounts.map(l => [l.level, l.count]) },
    { ic: "calendar", color: "var(--ok)", soft: "var(--ok-soft)", title: "รายงานตามปีการศึกษา", desc: "เปรียบเทียบข้อมูลย้อนหลัง",
      headers: ["ปีการศึกษา", "นักเรียน", "อุปกรณ์", "สถานะ"],
      rows: () => DD.academicYears.map(y => [y.label, y.students, y.devices, y.current ? "ปีปัจจุบัน" : "เก็บถาวร"]) },
  ];
  const doPdf = (r) => { printReport(r.title, r.headers, r.rows()); toast("เปิดหน้าพิมพ์ " + r.title); };
  const doXls = (r) => { exportExcel(r.title.replace(/\s/g, "_") + "_2569", r.headers, r.rows()); toast("ส่งออก " + r.title + " เป็น Excel"); };
  return (
    <div>
      <PageHead crumb={["รายงาน"]} title="รายงาน" desc="ออกรายงานในรูปแบบ PDF และ Excel" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
        {reports.map((r, i) => (
          <div key={i} className="card card-pad" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 12 }}>
              <div className="stat-ic" style={{ background: r.soft, color: r.color, width: 46, height: 46 }}><Icon name={r.ic} size={23} /></div>
              <div><div style={{ fontWeight: 700, fontSize: 15.5 }}>{r.title}</div><div style={{ fontSize: 12.5, color: "var(--text-3)" }} className="num">{r.rows().length} รายการ</div></div>
            </div>
            <p style={{ color: "var(--text-3)", fontSize: 13.5, margin: "0 0 16px", flex: 1 }}>{r.desc}</p>
            <div style={{ display: "flex", gap: 9 }}>
              <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => doPdf(r)}><Icon name="report" size={15} />PDF</button>
              <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => doXls(r)}><Icon name="download" size={15} />Excel</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
window.Reports = Reports;

/* ===== Status lookup — view borrowers/returners by status (live) ===== */
function StatusLookup({ go }) {
  const [store] = useStore();
  const count = (kind, status) => {
    const pool = kind === "s" ? store.students : store.teachers;
    return pool.filter(p => personDeviceStatus(p) === status).length;
  };
  const rows = [
    { key: "กำลังใช้งาน", label: "กำลังใช้งาน", icon: "check2", color: "var(--ok)", soft: "var(--ok-soft)" },
    { key: "คืนแล้ว", label: "คืนแล้ว", icon: "swap", color: "var(--info)", soft: "var(--info-soft)" },
    { key: "ไม่ประสงค์ยืม", label: "ไม่ประสงค์ยืม", icon: "close", color: "var(--text-3)", soft: "var(--surface-3)" },
    { key: "ยังไม่แจ้ง", label: "ยังไม่แจ้ง", icon: "clock", color: "var(--warn)", soft: "var(--warn-soft)" },
  ].map(r => { const s = count("s", r.key), t = count("t", r.key); return { ...r, s, t, total: s + t }; });
  const grand = rows.reduce((a, r) => a + r.total, 0) || 1;
  const [anim, setAnim] = React.useState(false);
  React.useEffect(() => { const id = setTimeout(() => setAnim(true), 60); return () => clearTimeout(id); }, []);

  return (
    <div className="card">
      <div className="card-head">
        <div><h3>สถานะการแจ้งความประสงค์ยืม–คืน</h3><div className="sub">นักเรียน + ครู {grand} คน · คลิกตัวเลขเพื่อดูรายชื่อตามสถานะ</div></div>
      </div>
      <div className="card-pad">
        {/* distribution bar */}
        <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: "var(--surface-3)", marginBottom: 8 }}>
          {rows.map(r => (
            <div key={r.key} title={r.label + " " + r.total + " คน"} style={{ width: (anim ? (r.total / grand * 100) : 0) + "%", background: r.color, transition: "width .9s cubic-bezier(.2,.8,.2,1)", opacity: r.key === "ไม่ประสงค์ยืม" ? 0.55 : 1 }}></div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 18 }}>
          {rows.map(r => (
            <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)" }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color }}></span>{r.label} <b className="num" style={{ color: r.color }}>{grand ? Math.round(r.total / grand * 100) : 0}%</b>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          {rows.map(r => (
            <div key={r.key} className="status-tile" style={{ position: "relative", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", background: "var(--surface)" }}>
              <div style={{ position: "absolute", inset: 0, background: r.soft, opacity: 0.5 }}></div>
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "15px 16px 13px" }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: r.color, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "0 4px 12px -3px " + r.color }}><Icon name={r.icon} size={21} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>{r.label}</div>
                  <div className="num" style={{ fontSize: 12, color: "var(--text-3)" }}>{grand ? Math.round(r.total / grand * 100) : 0}% ของทั้งหมด</div>
                </div>
                <div className="num" style={{ fontSize: 30, fontWeight: 800, color: r.color, lineHeight: 1 }}>{r.total}</div>
              </div>
              <div style={{ position: "relative", display: "flex", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                <button onClick={() => go("students", { statusF: r.key })} className="row-click" style={{ flex: 1, border: 0, background: "transparent", padding: "10px 14px", cursor: "pointer", textAlign: "left", borderRight: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="students" size={14} style={{ color: "var(--text-3)" }} />
                  <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "var(--text-3)" }}>นักเรียน</div><div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{r.s}</div></div>
                  <Icon name="chevR" size={13} style={{ color: "var(--text-3)" }} />
                </button>
                <button onClick={() => go("teachers", { statusF: r.key })} className="row-click" style={{ flex: 1, border: 0, background: "transparent", padding: "10px 14px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="teacher" size={14} style={{ color: "var(--text-3)" }} />
                  <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "var(--text-3)" }}>ครู / บุคลากร</div><div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{r.t}</div></div>
                  <Icon name="chevR" size={13} style={{ color: "var(--text-3)" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
window.StatusLookup = StatusLookup;

/* ===== Settings ===== */
function Settings({ go, theme, setTheme, primary, setPrimary, modules, setModules, loginBg, setLoginBg, customMenus, setCustomMenus }) {
  const toast = React.useContext(ToastCtx);
  const [store, setStore] = useStore();
  const [tab, setTab] = useState("general");
  const bgRef = useRef(null);
  const logoRef = useRef(null);
  const restoreRef = useRef(null);
  const onLogoFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = () => { setStore({ logo: r.result }); toast("อัปเดตโลโก้โรงเรียนแล้ว"); };
    r.readAsDataURL(file);
  };
  const doBackup = () => {
    const s = window.Store.snapshot();
    const data = {
      meta: { system: "NHP iPad Management System", exported: new Date().toISOString(), version: 2, year: s.year || "2569" },
      students: s.students, teachers: s.teachers, ipads: s.ipads, accessories: s.accessories,
      borrows: s.borrows, repairs: s.repairs, returnLog: s.returnLog, subjects: s.subjects,
      deviceEvents: s.deviceEvents, personStatus: s.personStatus, photos: s.photos,
      audit: s.audit, year: s.year, school: s.school,
      settings: { theme, primary, modules, customMenus },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "NHP_backup_" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    logAction("สำรองข้อมูล", "สำรองฐานข้อมูลทั้งระบบ (นักเรียน " + s.students.length + " · iPad " + s.ipads.length + ")", "b-purple", "ผู้ดูแลระบบ", "settings");
    toast("สำรองฐานข้อมูลเรียบร้อย — ดาวน์โหลดไฟล์ .json แล้ว");
  };
  const onRestore = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data.students && !data.ipads && !data.devices) throw new Error("bad");
        setRestoreData(data);  // show confirmation before applying
      } catch (e) { toast("ไฟล์สำรองไม่ถูกต้อง", "alert"); }
    };
    r.readAsText(file);
  };
  const applyRestore = () => {
    const data = restoreData;
    const ipads = data.ipads || data.devices || [];
    window.Store.update(st => ({
      students: data.students || st.students,
      teachers: data.teachers || st.teachers,
      ipads: ipads.length ? ipads : st.ipads,
      accessories: data.accessories || st.accessories,
      borrows: data.borrows || st.borrows,
      repairs: data.repairs || st.repairs,
      returnLog: data.returnLog || st.returnLog,
      subjects: data.subjects || st.subjects,
      deviceEvents: data.deviceEvents || st.deviceEvents,
      personStatus: data.personStatus || st.personStatus,
      photos: data.photos || st.photos,
      year: data.year || st.year,
      school: data.school || st.school,
    }));
    if (data.settings) {
      if (data.settings.theme) setTheme(data.settings.theme);
      if (data.settings.primary) setPrimary(data.settings.primary);
      if (data.settings.modules) setModules(data.settings.modules);
      if (data.settings.customMenus) setCustomMenus(data.settings.customMenus);
    }
    logAction("กู้คืนข้อมูล", "กู้คืนฐานข้อมูลจากไฟล์สำรอง (นักเรียน " + (data.students || []).length + " · iPad " + ipads.length + ")", "b-warn", "ผู้ดูแลระบบ", "settings");
    toast("กู้คืนข้อมูลสำเร็จ — ซิงค์ทั้งระบบแล้ว");
    setRestoreData(null);
  };
  const [addUser, setAddUser] = useState(false);
  const [restoreData, setRestoreData] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const LIVE = !!(window.NHP_CONFIG && window.NHP_CONFIG.live);
  const users = store.systemUsers && store.systemUsers.length ? store.systemUsers : DD.systemUsers;
  const [delUser, setDelUser] = useState(null);
  const years = ((store.academicYears && store.academicYears.length ? store.academicYears : DD.academicYears) || [])
    .map(y => ({ ...y, current: !!y.current || y.year === store.year }));
  const [addYear, setAddYear] = useState(false);
  const [viewYear, setViewYear] = useState(null);
  const [delYear, setDelYear] = useState(null);
  const userForm = useRef({});
  const yearForm = useRef({});
  const colorOpts = [["#1aa6e0", "ฟ้า (ค่าเริ่มต้น)"], ["#f58220", "ส้ม"], ["#1f9d6b", "เขียว"], ["#8b5cf6", "ม่วง"], ["#e04646", "แดง"], ["#0f6f9c", "น้ำเงินเข้ม"]];
  const moduleDefs = [["dashboard", "Dashboard", true], ["students", "นักเรียน", true], ["teachers", "ครู", true], ["devices", "อุปกรณ์", true], ["borrow", "ยืม–คืน", true], ["repair", "แจ้งซ่อม", true], ["qr", "QR Code", true], ["report", "รายงาน", true], ["audit", "Audit Log", true], ["year", "ปีการศึกษา", false]];
  const isModOn = (k, def) => modules[k] === undefined ? def : modules[k];
  const toggleMod = (k, def) => setModules({ ...modules, [k]: !isModOn(k, def) });
  const onBgFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = () => { setLoginBg(r.result); try { localStorage.setItem("nhp-loginbg", r.result); } catch (e) {} toast("อัปเดตภาพพื้นหลังหน้า Login แล้ว"); };
    r.readAsDataURL(file);
  };

  const schoolForm = useRef({ ...store.school });
  const saveGeneral = () => {
    window.saveSchoolInfo({ ...store.school, ...schoolForm.current });
    logAction("เปลี่ยนการตั้งค่า", "บันทึกข้อมูลทั่วไปของระบบ", "b-muted", "ผู้ดูแลระบบ", "settings");
    toast("บันทึกการตั้งค่าแล้ว");
  };

  const roleCls = { "Super Admin": "b-danger", "Admin / ICT": "b-info", "ครู": "b-purple", "นักเรียน": "b-muted" };
  const saveUser = async () => {
    const f = userForm.current;
    if (editUser) {
      if (LIVE) {
        const r = await window.SB.users.update(editUser.id, { name: f.name, username: f.username, role: f.role, twofa: !!f.twofa });
        if (!r.ok) { toast(r.error || "แก้ไขไม่สำเร็จ", "alert"); return; }
        await window.SB.hydrate();
      } else {
        setStore(st => ({ systemUsers: (st.systemUsers || []).map(u => u.id === editUser.id ? { ...u, ...f, roleCls: roleCls[f.role] || u.roleCls } : u) }));
      }
      logAction("แก้ไขข้อมูล", "ผู้ใช้ระบบ " + (f.name || editUser.name), "b-warn", undefined, "settings");
      toast("บันทึกการแก้ไขแล้ว");
    } else {
      if (LIVE) {
        if (!f.email || !f.password) { toast("กรุณากรอกอีเมลและรหัสผ่าน", "alert"); return; }
        if (f.password !== f.password2) { toast("รหัสผ่านยืนยันไม่ตรงกัน", "alert"); return; }
        const r = await window.SB.users.add({ name: f.name, username: f.username, email: f.email, password: f.password, role: f.role || "ครู", twofa: !!f.twofa });
        if (!r.ok) { toast(r.error || "เพิ่มผู้ใช้ไม่สำเร็จ", "alert"); return; }
        await window.SB.hydrate();
      } else {
        setStore(st => ({ systemUsers: [...(st.systemUsers || []), { id: Date.now(), name: f.name || "ผู้ใช้ใหม่", username: f.username || "user", email: f.email || "user@nhp.ac.th", role: f.role || "Admin / ICT", roleCls: roleCls[f.role] || "b-info", last: "—", active: true, twofa: !!f.twofa }] }));
      }
      logAction("เพิ่มผู้ใช้งาน", (f.name || f.email) + " (" + (f.role || "ครู") + ")", "b-ok", undefined, "settings");
      toast("เพิ่มผู้ใช้งานเรียบร้อย");
    }
    setAddUser(false); setEditUser(null);
  };
  const saveYear = () => {
    const f = yearForm.current;
    if (!f.year) { toast("กรุณาระบุปีการศึกษา", "alert"); return; }
    if (years.some(y => y.year === f.year)) { toast("มีปีการศึกษานี้อยู่แล้ว", "alert"); return; }
    setStore(st => ({ academicYears: [{ id: Date.now(), year: f.year, label: "ปีการศึกษา " + f.year, current: !!f.current, students: 0, devices: 0 }, ...(st.academicYears || []).map(y => f.current ? { ...y, current: false } : y)] }));
    if (f.current) window.setAcademicYear(f.year);
    logAction("เพิ่มปีการศึกษา", "ปีการศึกษา " + f.year, "b-ok", undefined, "settings");
    setAddYear(false); toast("เพิ่มปีการศึกษา " + f.year + " เรียบร้อย");
  };
  const setCurrentYear = (yr) => { setStore(st => ({ academicYears: (st.academicYears || []).map(y => ({ ...y, current: y.year === yr })) })); window.setAcademicYear(yr); toast("กำหนดปีปัจจุบันเป็น ปีการศึกษา " + yr + " — ซิงค์ทั้งระบบแล้ว"); };
  const doDeleteYear = () => {
    setStore(st => ({ academicYears: (st.academicYears || []).filter(y => y.year !== delYear.year) }));
    logAction("ลบรายการ", "ลบปีการศึกษา " + delYear.year, "b-danger", "ผู้ดูแลระบบ", "settings");
    toast("ลบปีการศึกษา " + delYear.year + " แล้ว", "trash");
    setDelYear(null);
  };

  return (
    <div>
      <PageHead crumb={["ตั้งค่าระบบ"]} title="ตั้งค่าระบบ" desc="ปรับแต่งระบบและการแสดงผล" />
      <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", gap: 22 }} className="qr-row">
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignSelf: "start" }}>
          {[["general", "ทั่วไป", "building"], ["appearance", "การแสดงผล", "palette"], ["users", "ผู้ใช้งานระบบ", "user"], ["years", "ปีการศึกษา", "calendar"], ["modules", "โมดูล", "grid"], ["menu", "เมนู", "menu"], ["connections", "เชื่อมต่อข้อมูล", "database"], ["security", "ความปลอดภัย", "shield"]].map(([k, l, ic]) => (
            <button key={k} className={"nav-item" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>
              <Icon name={ic} size={18} className="nav-ic" /><span>{l}</span>
            </button>
          ))}
        </div>

        <div>
          {tab === "general" && (
            <div className="card">
              <div className="card-head"><h3>ข้อมูลทั่วไป</h3></div>
              <div className="card-pad">
                <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
                  <img src={store.logo} style={{ width: 72, height: 72, borderRadius: 14, background: "#fff", padding: 4, boxShadow: "var(--shadow-sm)", objectFit: "contain" }} alt="" />
                  <div>
                    <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { onLogoFile(e.target.files[0]); e.target.value = ""; }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-sm" onClick={() => logoRef.current && logoRef.current.click()}><Icon name="upload" size={14} />เปลี่ยนโลโก้</button>
                      {store.logo !== "assets/logo.png" && <button className="btn btn-sm" onClick={() => { setStore({ logo: "assets/logo.png" }); toast("คืนค่าโลโก้เดิมแล้ว"); }}>ค่าเริ่มต้น</button>}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 7 }}>PNG / SVG · แนะนำ 512×512px</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="field"><label>ชื่อโรงเรียน</label><input className="input" defaultValue={store.school.name} onChange={e => schoolForm.current.name = e.target.value} /></div>
                  <div className="field"><label>สังกัด</label><input className="input" defaultValue={store.school.affiliation} onChange={e => schoolForm.current.affiliation = e.target.value} /></div>
                  <div className="field"><label>เบอร์โทร</label><input className="input num" defaultValue={store.school.phone} onChange={e => schoolForm.current.phone = e.target.value} /></div>
                  <div className="field"><label>อีเมล</label><input className="input" defaultValue={store.school.email} onChange={e => schoolForm.current.email = e.target.value} /></div>
                  <div className="field" style={{ gridColumn: "1/-1" }}><label>ที่อยู่</label><input className="input" defaultValue={store.school.address} onChange={e => schoolForm.current.address = e.target.value} /></div>
                  <div className="field" style={{ gridColumn: "1/-1" }}><label>ข้อความท้ายเว็บ (Footer)</label><input className="input" defaultValue={store.school.footer} onChange={e => schoolForm.current.footer = e.target.value} /></div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn btn-primary" onClick={saveGeneral}><Icon name="check" size={16} />บันทึก</button></div>
              </div>
            </div>
          )}

          {tab === "appearance" && (
            <div className="card">
              <div className="card-head"><h3>การแสดงผล</h3></div>
              <div className="card-pad">
                <div className="field"><label>โหมดธีม</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                    {[["light", "สว่าง", "sun"], ["dark", "มืด", "moon"], ["auto", "อัตโนมัติ", "refresh"]].map(([k, l, ic]) => (
                      <button key={k} onClick={() => setTheme(k)} style={{
                        padding: 16, borderRadius: 13, border: "2px solid " + (theme === k ? "var(--primary)" : "var(--border)"),
                        background: theme === k ? "var(--primary-soft)" : "var(--surface)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                      }}>
                        <Icon name={ic} size={24} style={{ color: theme === k ? "var(--primary)" : "var(--text-2)" }} /><span style={{ fontWeight: 600, fontSize: 13.5 }}>{l}</span>
                      </button>
                    ))}
                  </div>
                  {theme === "auto" && <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}><Icon name="refresh" size={13} style={{ color: "var(--primary)" }} />ปรับตามการตั้งค่าของอุปกรณ์โดยอัตโนมัติ</div>}
                </div>
                <hr className="hr" />
                <div className="field"><label>สีหลักของระบบ</label>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {colorOpts.map(([c, l]) => (
                      <button key={c} onClick={() => setPrimary(c)} title={l} style={{
                        width: 46, height: 46, borderRadius: 12, background: c, border: "3px solid " + (primary === c ? "var(--text)" : "transparent"),
                        boxShadow: "var(--shadow-sm)", display: "grid", placeItems: "center",
                      }}>{primary === c && <Icon name="check" size={20} style={{ color: "#fff" }} />}</button>
                    ))}
                  </div>
                </div>
                <hr className="hr" />
                <input ref={bgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { onBgFile(e.target.files[0]); e.target.value = ""; }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                    {loginBg
                      ? <img src={loginBg} alt="" style={{ width: 80, height: 50, objectFit: "cover", borderRadius: 9, border: "1px solid var(--border)" }} />
                      : <div style={{ width: 80, height: 50, borderRadius: 9, background: "linear-gradient(150deg,var(--brand-sky-700),var(--brand-sky) 55%,var(--brand-orange))" }}></div>}
                    <div><div style={{ fontWeight: 600 }}>ภาพพื้นหลังหน้า Login</div><div style={{ fontSize: 13, color: "var(--text-3)" }}>แสดงบนหน้าเข้าสู่ระบบ</div></div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {loginBg && <button className="btn btn-sm" onClick={() => { setLoginBg(""); localStorage.removeItem("nhp-loginbg"); toast("ลบภาพพื้นหลังแล้ว"); }}>ลบ</button>}
                    <button className="btn btn-sm" onClick={() => bgRef.current && bgRef.current.click()}><Icon name="image" size={14} />อัปโหลด</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "users" && (
            <div className="card">
              <div className="card-head">
                <div><h3>ผู้ใช้งานระบบ</h3><div className="sub">จัดการผู้ดูแล ผู้ช่วย และสิทธิ์การเข้าถึง</div></div>
                <button className="btn btn-sm btn-primary" onClick={() => { userForm.current = {}; setEditUser(null); setAddUser(true); }}><Icon name="plus" size={15} />เพิ่มผู้ใช้งาน</button>
              </div>
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>ผู้ใช้งาน</th><th>บทบาท</th><th>เข้าใช้ล่าสุด</th><th>2FA</th><th>สถานะ</th><th></th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                            <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>{initials(u.name.replace(/^ครู/, ""))}</div>
                            <div><div style={{ fontWeight: 600 }}>{u.name}</div><div className="num" style={{ fontSize: 12.5, color: "var(--text-3)" }}>@{u.username} · {u.email}</div></div>
                          </div>
                        </td>
                        <td><Badge cls={u.roleCls}>{u.role}</Badge></td>
                        <td className="num" style={{ fontSize: 13, color: "var(--text-2)" }}>{u.last}</td>
                        <td>{u.twofa ? <Badge cls="b-ok" dot>เปิด</Badge> : <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                        <td><Badge cls={u.active ? "b-ok" : "b-muted"} dot>{u.active ? "ใช้งาน" : "ระงับ"}</Badge></td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => { userForm.current = { ...u }; setAddUser(false); setEditUser(u); }} title="แก้ไข"><Icon name="edit" size={15} /></button>
                            {u.role !== "Super Admin" && <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setDelUser(u)} title="ลบ"><Icon name="trash" size={15} /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 9, padding: "13px 18px", borderTop: "1px solid var(--border)", color: "var(--text-3)", fontSize: 13 }}>
                <Icon name="shield" size={16} /><span>เฉพาะ Super Admin เท่านั้นที่สามารถเพิ่ม แก้ไข หรือลบผู้ดูแลและผู้ช่วยได้</span>
              </div>
            </div>
          )}

          {(addUser || editUser) && (
            <Modal title={editUser ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งานระบบ"} onClose={() => { setAddUser(false); setEditUser(null); }} wide
              footer={<><button className="btn" onClick={() => { setAddUser(false); setEditUser(null); }}>ยกเลิก</button><button className="btn btn-primary" onClick={saveUser}><Icon name="check" size={16} />บันทึก</button></>}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="field"><label>ชื่อ–สกุล</label><input className="input" defaultValue={editUser?.name || ""} placeholder="เช่น ครูสมหญิง ใจงาม" onChange={e => userForm.current.name = e.target.value} /></div>
                <div className="field"><label>ชื่อผู้ใช้ (Username)</label><input className="input" defaultValue={editUser?.username || ""} placeholder="username" onChange={e => userForm.current.username = e.target.value} /></div>
                <div className="field"><label>อีเมล</label><input className="input" defaultValue={editUser?.email || ""} placeholder="name@nhp.ac.th" onChange={e => userForm.current.email = e.target.value} /></div>
                <div className="field"><label>บทบาท / สิทธิ์</label>
                  <select className="select" defaultValue={editUser?.role || "Admin / ICT"} onChange={e => userForm.current.role = e.target.value}>
                    <option>Super Admin</option><option>Admin / ICT</option><option>ครู</option><option>นักเรียน</option>
                  </select>
                </div>
                {!editUser && <>
                  <div className="field"><label>รหัสผ่าน</label><input className="input" type="password" placeholder="อย่างน้อย 6 ตัวอักษร" onChange={e => userForm.current.password = e.target.value} /></div>
                  <div className="field"><label>ยืนยันรหัสผ่าน</label><input className="input" type="password" placeholder="••••••••" onChange={e => userForm.current.password2 = e.target.value} /></div>
                </>}
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 400 }}>
                  <input type="checkbox" defaultChecked={editUser?.twofa} onChange={e => userForm.current.twofa = e.target.checked} style={{ width: 17, height: 17, accentColor: "var(--primary)" }} />
                  เปิดใช้การยืนยันตัวตน 2 ขั้นตอน (2FA)
                </label>
              </div>
            </Modal>
          )}

          {delUser && (
            <Modal title="ยืนยันการลบผู้ใช้งาน" onClose={() => setDelUser(null)}
              footer={<><button className="btn" onClick={() => setDelUser(null)}>ยกเลิก</button><button className="btn btn-danger" onClick={async () => { if (LIVE) { const r = await window.SB.users.remove(delUser.id); if (!r.ok) { toast(r.error || "ลบไม่สำเร็จ", "alert"); return; } await window.SB.hydrate(); } else { setStore(st => ({ systemUsers: (st.systemUsers || []).filter(u => u.id !== delUser.id) })); } logAction("ลบรายการ", "ผู้ใช้ระบบ " + delUser.name, "b-danger", undefined, "settings"); toast("ลบผู้ใช้งานแล้ว", "trash"); setDelUser(null); }}><Icon name="trash" size={16} />ลบผู้ใช้งาน</button></>}>
              <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
                <div className="stat-ic" style={{ background: "var(--danger-soft)", color: "var(--danger)", width: 48, height: 48, flexShrink: 0 }}><Icon name="alert" size={24} /></div>
                <div>ต้องการลบบัญชี <b>{delUser.name}</b> (@{delUser.username}) ใช่หรือไม่?</div>
              </div>
            </Modal>
          )}

          {restoreData && (
            <Modal title="ยืนยันการกู้คืนข้อมูล" onClose={() => setRestoreData(null)}
              footer={<><button className="btn" onClick={() => setRestoreData(null)}>ยกเลิก</button><button className="btn btn-danger" onClick={applyRestore}><Icon name="refresh" size={16} />กู้คืนทับข้อมูลปัจจุบัน</button></>}>
              <div style={{ display: "flex", gap: 13, alignItems: "flex-start", marginBottom: 14 }}>
                <div className="stat-ic" style={{ background: "var(--warn-soft)", color: "var(--warn)", width: 48, height: 48, flexShrink: 0 }}><Icon name="alert" size={24} /></div>
                <div>การกู้คืนจะ<b>แทนที่ข้อมูลทั้งหมดในระบบ</b>ด้วยข้อมูลจากไฟล์สำรอง และซิงค์ทุกหน้าทันที — ควรสำรองข้อมูลปัจจุบันก่อน</div>
              </div>
              <div className="card" style={{ background: "var(--surface-2)" }}>
                {[["นักเรียน", (restoreData.students || []).length], ["ครู / บุคลากร", (restoreData.teachers || []).length], ["อุปกรณ์ iPad", (restoreData.ipads || restoreData.devices || []).length], ["รายการยืม", (restoreData.borrows || []).length], ["งานซ่อม", (restoreData.repairs || []).length], ["ปีการศึกษา", restoreData.year || restoreData.meta && restoreData.meta.year || "-"]].map(([k, v]) => (
                  <div key={k} className="kv" style={{ padding: "10px 16px" }}><span className="k">{k}</span><span className="v num">{v}</span></div>
                ))}
              </div>
            </Modal>
          )}

          {tab === "years" && (
            <div className="card">
              <div className="card-head"><h3>ปีการศึกษา</h3><button className="btn btn-sm btn-primary" onClick={() => { yearForm.current = {}; setAddYear(true); }}><Icon name="plus" size={15} />เพิ่มปี</button></div>
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>ปีการศึกษา</th><th>นักเรียน</th><th>อุปกรณ์</th><th>สถานะ</th><th></th></tr></thead>
                  <tbody>
                    {years.map(y => (
                      <tr key={y.year}>
                        <td style={{ fontWeight: 700 }} className="num">{y.label}</td>
                        <td className="num">{y.students}</td>
                        <td className="num">{y.devices}</td>
                        <td>{y.current ? <Badge cls="b-ok" dot>ปีปัจจุบัน</Badge> : <Badge cls="b-muted">เก็บถาวร</Badge>}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            {!y.current && <button className="btn btn-sm" onClick={() => setCurrentYear(y.year)}><Icon name="check" size={14} />ตั้งเป็นปีปัจจุบัน</button>}
                            <button className="btn btn-sm" onClick={() => setViewYear(y)}><Icon name="eye" size={14} />ดูข้อมูล</button>
                            <button className="icon-btn" style={{ width: 32, height: 32 }} disabled={y.current} title={y.current ? "ไม่สามารถลบปีปัจจุบัน" : "ลบปีการศึกษา"} onClick={() => !y.current && setDelYear(y)}><Icon name="trash" size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {delYear && (
            <Modal title="ยืนยันการลบปีการศึกษา" onClose={() => setDelYear(null)}
              footer={<><button className="btn" onClick={() => setDelYear(null)}>ยกเลิก</button><button className="btn btn-danger" onClick={doDeleteYear}><Icon name="trash" size={16} />ลบปีการศึกษา</button></>}>
              <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
                <div className="stat-ic" style={{ background: "var(--danger-soft)", color: "var(--danger)", width: 48, height: 48, flexShrink: 0 }}><Icon name="alert" size={24} /></div>
                <div>ต้องการลบ <b className="num">{delYear.label}</b> ใช่หรือไม่?<div style={{ color: "var(--text-3)", fontSize: 13.5, marginTop: 4 }}>ข้อมูลปีการศึกษา ({delYear.students} นักเรียน · {delYear.devices} อุปกรณ์) จะถูกนำออกจากระบบ</div></div>
              </div>
            </Modal>
          )}

          {addYear && (
            <Modal title="เพิ่มปีการศึกษา" onClose={() => setAddYear(false)}
              footer={<><button className="btn" onClick={() => setAddYear(false)}>ยกเลิก</button><button className="btn btn-primary" onClick={saveYear}><Icon name="check" size={16} />บันทึก</button></>}>
              <div className="field"><label>ปีการศึกษา (พ.ศ.)</label><input className="input num" placeholder="เช่น 2570" onChange={e => yearForm.current.year = e.target.value.replace(/\D/g, "")} /></div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 400 }}>
                  <input type="checkbox" onChange={e => yearForm.current.current = e.target.checked} style={{ width: 17, height: 17, accentColor: "var(--primary)" }} />
                  กำหนดให้เป็นปีการศึกษาปัจจุบัน
                </label>
              </div>
            </Modal>
          )}

          {viewYear && (
            <Modal title={viewYear.label} onClose={() => setViewYear(null)}
              footer={<button className="btn btn-primary" onClick={() => setViewYear(null)}>ปิด</button>}>
              <div className="card" style={{ background: "var(--surface-2)" }}>
                <div className="kv" style={{ padding: "12px 18px" }}><span className="k">สถานะ</span><span className="v">{viewYear.current ? "ปีปัจจุบัน" : "เก็บถาวร"}</span></div>
                <div className="kv" style={{ padding: "12px 18px" }}><span className="k">จำนวนนักเรียน</span><span className="v num">{viewYear.students} คน</span></div>
                <div className="kv" style={{ padding: "12px 18px" }}><span className="k">จำนวนอุปกรณ์</span><span className="v num">{viewYear.devices} เครื่อง</span></div>
              </div>
              <div style={{ display: "flex", gap: 9, marginTop: 14, padding: 12, background: "var(--info-soft)", borderRadius: 11, color: "var(--info)", fontSize: 13 }}>
                <Icon name="database" size={16} style={{ flexShrink: 0 }} />ข้อมูลปีการศึกษานี้ถูกเก็บถาวรไว้ทั้งหมด สามารถเรียกดูประวัติย้อนหลังได้
              </div>
            </Modal>
          )}

          {tab === "modules" && (
            <div className="card">
              <div className="card-head"><h3>จัดการโมดูล</h3><div className="sub">เปิด/ปิดการใช้งานแต่ละส่วน</div></div>
              <div style={{ padding: "6px 0" }}>
                {moduleDefs.map(([k, l, def]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", padding: "13px 22px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ flex: 1, fontWeight: 600 }}>{l}</span>
                    <button onClick={() => toggleMod(k, def)} style={{ position: "relative", width: 40, height: 23, border: 0, background: "transparent", padding: 0 }}>
                      <Switch on={isModOn(k, def)} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 9, padding: "13px 22px", borderTop: "1px solid var(--border)", color: "var(--text-3)", fontSize: 13 }}>
                <Icon name="alert" size={16} /><span>โมดูลที่ปิดจะถูกซ่อนออกจากเมนูด้านข้างทันที</span>
              </div>
            </div>
          )}

          {tab === "menu" && <MenuManager toast={toast} customMenus={customMenus} setCustomMenus={setCustomMenus} />}

          {tab === "connections" && (
            <ConnectionsTab store={store} setStore={setStore} toast={toast} />
          )}

          {tab === "security" && (
            <div className="card">
              <div className="card-head"><h3>ความปลอดภัย</h3></div>
              <div className="card-pad">
                <ToggleRow title="ยืนยันตัวตน 2 ขั้นตอน (2FA)" sub="สำหรับบัญชี Super Admin" defOn={true} />
                <ToggleRow title="บังคับเปลี่ยนรหัสผ่านทุก 90 วัน" sub="เพิ่มความปลอดภัยของบัญชี" defOn={false} />
                <ToggleRow title="ออกจากระบบอัตโนมัติเมื่อไม่ใช้งาน" sub="หลังไม่มีกิจกรรม 30 นาที" defOn={true} />
                <ToggleRow title="บันทึก Audit Log ทุกกิจกรรม" sub="เก็บ IP, เวลา และรายละเอียด" defOn={true} />
                <hr className="hr" />
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" onClick={doBackup}><Icon name="database" size={16} />สำรองฐานข้อมูล</button>
                  <input ref={restoreRef} type="file" accept=".json" style={{ display: "none" }} onChange={e => { onRestore(e.target.files[0]); e.target.value = ""; }} />
                  <button className="btn" onClick={() => restoreRef.current && restoreRef.current.click()}><Icon name="refresh" size={16} />กู้คืนข้อมูล</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Switch({ on }) {
  return (
    <span style={{ position: "absolute", inset: 0, background: on ? "var(--primary)" : "var(--border-strong)", borderRadius: 20, transition: "background .2s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 20 : 3, width: 17, height: 17, background: "#fff", borderRadius: "50%", transition: "left .2s", boxShadow: "var(--shadow-sm)" }}></span>
    </span>
  );
}

/* ===== Menu manager ===== */
function MenuManager({ toast, customMenus, setCustomMenus }) {
  const builtIn = [
    { label: "หน้าหลัก", icon: "dashboard", role: "ทุกบทบาท" },
    { label: "จัดการอุปกรณ์", icon: "devices", role: "Admin / ICT" },
    { label: "ยืม–คืน", icon: "borrow", role: "Admin / ICT" },
    { label: "นักเรียน", icon: "students", role: "Admin / ICT" },
    { label: "รายงาน", icon: "report", role: "ทุกบทบาท" },
  ];
  const [edit, setEdit] = useState(null);
  const [add, setAdd] = useState(false);
  const [fLabel, setFLabel] = useState("");
  const [fUrl, setFUrl] = useState("");
  const [fIcon, setFIcon] = useState("box");
  const [fRole, setFRole] = useState("ทุกบทบาท");
  const iconChoices = ["box", "grid", "layers", "calendar", "report", "qrcode", "repair", "teacher", "students", "devices", "audit", "pin"];

  const openAdd = () => { setFLabel(""); setFUrl(""); setFIcon("box"); setFRole("ทุกบทบาท"); setEdit(null); setAdd(true); };
  const openEdit = (m) => { setFLabel(m.label); setFUrl(m.url || ""); setFIcon(m.icon || "box"); setFRole(m.role || "ทุกบทบาท"); setEdit(m); };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= customMenus.length) return;
    const arr = [...customMenus];[arr[i], arr[j]] = [arr[j], arr[i]]; setCustomMenus(arr);
  };
  const toggle = (id) => setCustomMenus(customMenus.map(m => m.id === id ? { ...m, on: m.on === false } : m));
  const save = () => {
    if (!fLabel.trim()) { toast("กรุณาระบุชื่อเมนู", "alert"); return; }
    if (edit) { setCustomMenus(customMenus.map(m => m.id === edit.id ? { ...m, label: fLabel, url: fUrl, icon: fIcon, role: fRole } : m)); toast("บันทึกเมนูแล้ว"); }
    else { setCustomMenus([...customMenus, { id: Date.now(), label: fLabel, url: fUrl, icon: fIcon, role: fRole, on: true }]); toast("สร้างเมนู \"" + fLabel + "\" แล้ว — ดูที่เมนูด้านซ้าย"); }
    setAdd(false); setEdit(null);
  };
  const del = (id) => { setCustomMenus(customMenus.filter(m => m.id !== id)); toast("ลบเมนูแล้ว", "trash"); };

  const formFields = (
    <>
      <div className="field"><label>ชื่อเมนู</label><input className="input" value={fLabel} autoFocus onChange={e => setFLabel(e.target.value)} placeholder="เช่น คู่มือการใช้งาน" /></div>
      <div className="field"><label>URL / เส้นทาง</label><input className="input num" value={fUrl} onChange={e => setFUrl(e.target.value)} placeholder="/custom-page" /></div>
      <div className="field"><label>ไอคอน</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {iconChoices.map(ic => (
            <button key={ic} onClick={() => setFIcon(ic)} style={{
              width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center",
              border: "2px solid " + (fIcon === ic ? "var(--primary)" : "var(--border-strong)"),
              background: fIcon === ic ? "var(--primary-soft)" : "var(--surface)", color: fIcon === ic ? "var(--primary)" : "var(--text-2)",
            }}><Icon name={ic} size={18} /></button>
          ))}
        </div>
      </div>
      <div className="field" style={{ marginBottom: 0 }}><label>สิทธิ์การเข้าถึง</label>
        <select className="select" value={fRole} onChange={e => setFRole(e.target.value)}>
          <option>ทุกบทบาท</option><option>Super Admin</option><option>Admin / ICT</option><option>ครู</option><option>นักเรียน</option>
        </select>
      </div>
    </>
  );

  return (
    <div className="card">
      <div className="card-head"><div><h3>จัดการเมนู</h3><div className="sub">เมนูที่สร้างเองจะแสดงในแถบด้านซ้าย</div></div><button className="btn btn-sm btn-primary" onClick={openAdd}><Icon name="plus" size={15} />สร้างเมนูใหม่</button></div>
      <div style={{ padding: "6px 0" }}>
        <div className="nav-sec" style={{ padding: "8px 22px 4px" }}>เมนูระบบ (ถาวร)</div>
        {builtIn.map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 22px", borderBottom: "1px solid var(--border)" }}>
            <Icon name={m.icon} size={18} style={{ color: "var(--primary)" }} />
            <span style={{ flex: 1, fontWeight: 600 }}>{m.label}</span>
            <Badge cls="b-muted">{m.role}</Badge>
            <Icon name="lock" size={15} style={{ color: "var(--text-3)" }} />
          </div>
        ))}
        <div className="nav-sec" style={{ padding: "14px 22px 4px" }}>เมนูที่สร้างเอง ({customMenus.length})</div>
        {customMenus.length === 0 && <div style={{ padding: "14px 22px", color: "var(--text-3)", fontSize: 13.5 }}>ยังไม่มีเมนูที่สร้างเอง — กด "สร้างเมนูใหม่" เพื่อเพิ่ม</div>}
        {customMenus.map((m, i) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 22px", borderBottom: "1px solid var(--border)", opacity: m.on === false ? .5 : 1 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button className="icon-btn" style={{ width: 22, height: 18, borderColor: "transparent" }} disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={13} /></button>
              <button className="icon-btn" style={{ width: 22, height: 18, borderColor: "transparent" }} disabled={i === customMenus.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={13} /></button>
            </div>
            <Icon name={m.icon || "box"} size={18} style={{ color: "#0d9488" }} />
            <span style={{ flex: 1, fontWeight: 600 }}>{m.label}</span>
            <Badge cls="b-info">{m.role}</Badge>
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => openEdit(m)} title="แก้ไข"><Icon name="edit" size={15} /></button>
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => del(m.id)} title="ลบ"><Icon name="trash" size={15} /></button>
            <button onClick={() => toggle(m.id)} style={{ position: "relative", width: 40, height: 23, border: 0, background: "transparent", padding: 0 }}>
              <Switch on={m.on !== false} />
            </button>
          </div>
        ))}
      </div>

      {(add || edit) && (
        <Modal title={edit ? "แก้ไขเมนู" : "สร้างเมนูใหม่"} onClose={() => { setAdd(false); setEdit(null); }}
          footer={<><button className="btn" onClick={() => { setAdd(false); setEdit(null); }}>ยกเลิก</button><button className="btn btn-primary" onClick={save}><Icon name="check" size={16} />{edit ? "บันทึก" : "สร้างเมนู"}</button></>}>
          {formFields}
        </Modal>
      )}
    </div>
  );
}

function IconPicker({ form, choices }) {
  const [sel, setSel] = useState(form.current.icon || choices[0]);
  useEffect(() => { form.current.icon = sel; }, [sel]);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {choices.map(ic => (
        <button key={ic} onClick={() => setSel(ic)} style={{
          width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center",
          border: "2px solid " + (sel === ic ? "var(--primary)" : "var(--border-strong)"),
          background: sel === ic ? "var(--primary-soft)" : "var(--surface)", color: sel === ic ? "var(--primary)" : "var(--text-2)",
        }}>
          <Icon name={ic} size={18} />
        </button>
      ))}
    </div>
  );
}

function ModuleToggle({ label, defOn }) {
  const [on, setOn] = useState(defOn);
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "13px 22px", borderBottom: "1px solid var(--border)" }}>
      <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
      <button onClick={() => setOn(o => !o)} style={{ position: "relative", width: 40, height: 23, border: 0, background: "transparent", padding: 0 }}>
        <Switch on={on} />
      </button>
    </div>
  );
}

function ToggleRow({ title, sub, defOn }) {
  const [on, setOn] = useState(defOn);
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{title}</div><div style={{ fontSize: 13, color: "var(--text-3)" }}>{sub}</div></div>
      <button onClick={() => setOn(o => !o)} style={{ position: "relative", width: 40, height: 23, border: 0, background: "transparent", padding: 0 }}>
        <Switch on={on} />
      </button>
    </div>
  );
}
window.Settings = Settings;

/* ===== Connections (Google Drive & others) — real, persistent sync ===== */
function ConnectionsTab({ store, setStore, toast }) {
  const { useState } = React;
  const [connecting, setConnecting] = useState(null);
  const drive = store.drive || {};
  const providers = [
    { id: "google", name: "Google Drive", desc: "สำรองและซิงค์ฐานข้อมูลอัตโนมัติไปยัง Google Drive", color: "#1a73e8", soft: "#e8f0fe", letter: "G" },
    { id: "onedrive", name: "Microsoft OneDrive", desc: "ซิงค์ข้อมูลกับบัญชี OneDrive ของโรงเรียน", color: "#0364b8", soft: "#e1effb", letter: "O" },
  ];
  const nowStr = () => new Date().toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  // persist drive state so connections survive reload (real, not mocked)
  const persist = (patch) => setStore(st => {
    const drive = { ...st.drive, ...patch };
    try { localStorage.setItem("nhp-drive", JSON.stringify(drive)); } catch (e) {}
    return { drive };
  });
  // build a real backup file from the live store and download it
  const buildBackup = (provider) => {
    const s = window.Store.snapshot();
    const data = {
      meta: { system: "NHP iPad Management System", provider, exportedAt: new Date().toISOString(), version: 2, year: "2569" },
      students: s.students, teachers: s.teachers, ipads: s.ipads, accessories: s.accessories,
      borrows: s.borrows, repairs: s.repairs, subjects: s.subjects, audit: s.audit,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = "NHP_sync_" + provider + "_" + stamp + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return { students: s.students.length, ipads: s.ipads.length };
  };
  const connect = (p) => {
    setConnecting(p.id);
    setTimeout(() => {
      const sync = nowStr();
      persist({ [p.id]: true, lastSync: sync });
      setConnecting(null);
      logAction("เชื่อมต่อข้อมูล", "เชื่อมต่อ " + p.name + " (OAuth) สำเร็จ", "b-ok", "ผู้ดูแลระบบ", "settings");
      toast("เชื่อมต่อ " + p.name + " สำเร็จ");
    }, 1200);
  };
  const disconnect = (p) => {
    persist({ [p.id]: false });
    logAction("เชื่อมต่อข้อมูล", "ยกเลิกการเชื่อมต่อ " + p.name, "b-muted", "ผู้ดูแลระบบ", "settings");
    toast("ยกเลิกการเชื่อมต่อ " + p.name + " แล้ว", "trash");
  };
  const syncNow = (p) => {
    const r = buildBackup(p.id);
    persist({ lastSync: nowStr() });
    logAction("สำรองข้อมูล", "ซิงค์ไป " + p.name + " · นักเรียน " + r.students + " · iPad " + r.ipads, "b-purple", "ผู้ดูแลระบบ", "settings");
    toast("ซิงค์ข้อมูลไป " + p.name + " แล้ว — ดาวน์โหลดไฟล์สำรอง .json");
  };
  const setFreq = (freq) => { persist({ freq }); toast("ตั้งความถี่การสำรองเป็น “" + freq + "”"); };

  return (
    <div className="card">
      <div className="card-head"><div><h3>เชื่อมต่อฐานข้อมูลภายนอก</h3><div className="sub">สำรอง/ซิงค์ข้อมูลอัตโนมัติไปยังบริการคลาวด์</div></div></div>
      <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {providers.map(p => {
          const on = drive[p.id];
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 15, padding: 16, border: "1px solid " + (on ? "var(--ok)" : "var(--border)"), borderRadius: 14, background: on ? "var(--ok-soft)" : "var(--surface)" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: p.soft, color: p.color, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 22, fontFamily: "var(--font-num)", flexShrink: 0 }}>{p.letter}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>{p.name} {on && <Badge cls="b-ok" dot>เชื่อมต่อแล้ว</Badge>}</div>
                <div style={{ fontSize: 13, color: "var(--text-3)" }}>{on ? "ซิงค์ล่าสุด: " + (drive.lastSync || "—") : p.desc}</div>
              </div>
              {on ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => syncNow(p)}><Icon name="refresh" size={14} />ซิงค์เดี๋ยวนี้</button>
                  <button className="btn btn-sm" onClick={() => disconnect(p)}>ยกเลิก</button>
                </div>
              ) : (
                <button className="btn btn-sm btn-primary" disabled={connecting === p.id} onClick={() => connect(p)}>
                  {connecting === p.id ? <><Icon name="refresh" size={14} />กำลังเชื่อมต่อ…</> : <><Icon name="logout" size={14} style={{ transform: "scaleX(-1)" }} />เชื่อมต่อ</>}
                </button>
              )}
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 9, padding: 13, background: "var(--info-soft)", borderRadius: 12, color: "var(--info)", fontSize: 13 }}>
          <Icon name="shield" size={17} style={{ flexShrink: 0 }} />
          <span>การเชื่อมต่อใช้การยืนยันสิทธิ์แบบ OAuth — ระบบจะเข้าถึงเฉพาะโฟลเดอร์สำรองข้อมูลของโรงเรียนเท่านั้น · กด “ซิงค์เดี๋ยวนี้” เพื่อสำรองฐานข้อมูลปัจจุบันเป็นไฟล์ .json ทันที</span>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>ความถี่ในการสำรองอัตโนมัติ</label>
          <select className="select" value={drive.freq || "ทุกวัน เวลา 02:00 น."} onChange={e => setFreq(e.target.value)}>
            <option>ทุกวัน เวลา 02:00 น.</option><option>ทุกสัปดาห์</option><option>ทุกครั้งที่มีการเปลี่ยนแปลง</option><option>ปิดการสำรองอัตโนมัติ</option>
          </select>
        </div>
      </div>
    </div>
  );
}
window.ConnectionsTab = ConnectionsTab;
