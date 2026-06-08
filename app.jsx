/* ===== App shell: Login + Sidebar + Topbar + Router ===== */
const { useState: uS, useEffect: uE } = React;

const NAV = [
  { sec: "หลัก" },
  { id: "dashboard", label: "หน้าหลัก", icon: "dashboard", color: "#1aa6e0" },
  { sec: "ครุภัณฑ์" },
  { id: "devices", label: "จัดการอุปกรณ์", icon: "devices", color: "#6366f1" },
  { id: "borrow", label: "ยืม–คืนอุปกรณ์", icon: "borrow", color: "#1f9d6b" },
  { id: "quick", label: "จุดบริการด่วน", icon: "qrcode", color: "#0d9488" },
  { id: "registry", label: "ทะเบียนยืม–คืน", icon: "history", color: "#7c3aed" },
  { id: "overdue", label: "ติดตามค้างส่ง", icon: "overdue", color: "#e04646", badge: window.NHP.stats.overdue },
  { id: "timeline", label: "ประวัติอุปกรณ์", icon: "timeline", color: "#8b5cf6" },
  { id: "qr", label: "QR Code & สติกเกอร์", icon: "qrcode", color: "#0ea5a5" },
  { id: "repair", label: "แจ้งซ่อม", icon: "repair", color: "#f58220" },
  { sec: "บุคคล" },
  { id: "students", label: "จัดการนักเรียน", icon: "students", color: "#ec4899" },
  { id: "teachers", label: "จัดการบุคลากรครู", icon: "teacher", color: "#0891b2" },
  { sec: "ระบบ" },
  { id: "reports", label: "รายงาน", icon: "report", color: "#16a34a" },
  { id: "audit", label: "Audit Log", icon: "audit", color: "#64748b" },
  { id: "settings", label: "ตั้งค่าระบบ", icon: "settings", color: "#0f6f9c" },
];

const USER_NAMES = {
  "Super Admin": "นายสมศักดิ์ ศรีบุญเรือง",
  "Admin / ICT": "ครูประสิทธิ์ ตั้งมั่น",
  "ครู": "ครูสมชาย วัฒนา",
  "นักเรียน": "เด็กชายธนกร ศรีสุข",
};

const TITLES = {
  dashboard: "ภาพรวมระบบ", devices: "จัดการอุปกรณ์", borrow: "ยืม–คืนอุปกรณ์", quick: "จุดบริการด่วน", registry: "ทะเบียนยืม–คืน", overdue: "ติดตามค้างส่ง",
  timeline: "ประวัติอุปกรณ์", qr: "QR Code & สติกเกอร์", repair: "แจ้งซ่อม", students: "จัดการนักเรียน",
  teachers: "จัดการบุคลากรครู", reports: "รายงาน", audit: "Audit Log", settings: "ตั้งค่าระบบ",
};

function Login({ onLogin, loginBg, logo }) {
  const LIVE = !!(window.NHP_CONFIG && window.NHP_CONFIG.live);
  const [u, setU] = uS(LIVE ? "" : "admin");
  const [p, setP] = uS(LIVE ? "" : "Nhp@2569");
  const [role, setRole] = uS("Super Admin");
  const [forgot, setForgot] = uS(false);
  const [fgUser, setFgUser] = uS("admin");
  const [fgSent, setFgSent] = uS(false);
  const [showPw, setShowPw] = uS(false);
  const [err, setErr] = uS("");
  const [busy, setBusy] = uS(false);
  const [fgErr, setFgErr] = uS("");
  const [fgBusy, setFgBusy] = uS(false);
  // ส่งลิงก์รีเซ็ตรหัสผ่านจริงไปยังอีเมลของบัญชีที่กรอก (live) — เด้งกลับมาที่เว็บนี้เพื่อตั้งรหัสใหม่
  const sendReset = async () => {
    const email = (fgUser || "").trim();
    if (!email) return;
    if (!LIVE) { setFgSent(true); return; }
    setFgErr(""); setFgBusy(true);
    const redirect = window.location.origin + window.location.pathname;
    const r = await window.sb.auth.resetPasswordForEmail(email, { redirectTo: redirect });
    setFgBusy(false);
    if (r.error) { setFgErr(r.error.message || "ส่งลิงก์ไม่สำเร็จ"); return; }
    setFgSent(true);
  };
  // Demo: เลือกบทบาทแล้วเข้าได้เลย · Live: ยืนยันตัวตนกับ Supabase + ดึงข้อมูลจริง
  const doLogin = async () => {
    if (!LIVE) return onLogin(role);
    setErr(""); setBusy(true);
    const res = await window.SB.auth.signIn(u.trim(), p);
    if (!res.ok) { setBusy(false); setErr(res.error || "เข้าสู่ระบบไม่สำเร็จ"); return; }
    try { await window.SB.hydrate(); }
    catch (e) { setBusy(false); setErr("โหลดข้อมูลไม่สำเร็จ: " + e.message); return; }
    setBusy(false);
    onLogin(res.role, res.name);
  };
  // real, live counts synced from the store
  const _s = window.Store.snapshot();
  const loginStats = [
    [String(_s.ipads.length), "iPad ทั้งหมด"],
    [String(_s.students.length + _s.teachers.length), "ผู้ใช้ในระบบ"],
    [String(_s.borrows.length), "กำลังถูกยืม"],
  ];
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1.1fr 1fr" }} className="login-wrap">
      <div className="login-hero" style={{ position: "relative", background: loginBg ? `linear-gradient(150deg, rgba(15,111,156,.82), rgba(26,166,224,.7) 55%, rgba(245,130,32,.78)), url(${loginBg}) center/cover` : "linear-gradient(150deg, var(--brand-sky-700), var(--brand-sky) 55%, var(--brand-orange))", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 56, color: "#fff", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 480, height: 480, borderRadius: "50%", border: "60px solid rgba(255,255,255,.08)", top: -160, right: -160 }}></div>
        <div style={{ position: "absolute", width: 280, height: 280, borderRadius: "50%", border: "40px solid rgba(255,255,255,.07)", bottom: -90, left: -70 }}></div>
        <div style={{ display: "flex", alignItems: "center", gap: 13, position: "relative" }}>
          <img src={logo || "assets/logo.png"} style={{ width: 52, height: 52, borderRadius: 13, background: "#fff", padding: 4, objectFit: "contain" }} alt="" />
          <div><b style={{ fontSize: 17 }}>NHP iPad Management</b><div style={{ fontSize: 13, opacity: .85 }}>โรงเรียนหนองหงส์พิทยาคม</div></div>
        </div>
        <div style={{ position: "relative" }}>
          <h1 style={{ fontSize: 40, lineHeight: 1.15, margin: "0 0 16px", fontWeight: 700, letterSpacing: "-.02em" }}>ระบบบริหารจัดการ<br />ครุภัณฑ์ดิจิทัล</h1>
          <p style={{ fontSize: 16, opacity: .9, maxWidth: 420, margin: 0 }}>จัดการอุปกรณ์ ยืม–คืน ติดตามครุภัณฑ์ และข้อมูลนักเรียน–ครู ในระบบเดียว รองรับหลายปีการศึกษา</p>
          <div style={{ display: "flex", gap: 28, marginTop: 36 }}>
            {loginStats.map(([n, l], i) => (
              <div key={i}><div className="num" style={{ fontSize: 30, fontWeight: 700 }}>{n}</div><div style={{ fontSize: 13, opacity: .85 }}>{l}</div></div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 13, opacity: .75, position: "relative" }}>© 2569 โรงเรียนหนองหงส์พิทยาคม · สพม.บุรีรัมย์</div>
      </div>

      <div style={{ display: "grid", placeItems: "center", padding: 32, background: "var(--bg)" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <h2 style={{ fontSize: 26, margin: "0 0 6px", fontWeight: 700 }}>เข้าสู่ระบบ</h2>
          <p style={{ color: "var(--text-3)", margin: "0 0 28px" }}>กรอกข้อมูลเพื่อเข้าใช้งานระบบ</p>
          {!LIVE && (
            <div className="field"><label>บทบาทผู้ใช้ (สาธิต)</label>
              <select className="select" value={role} onChange={e => setRole(e.target.value)}>
                <option>Super Admin</option><option>Admin / ICT</option><option>ครู</option><option>นักเรียน</option>
              </select>
            </div>
          )}
          <div className="field"><label>{LIVE ? "อีเมล" : "ชื่อผู้ใช้"}</label>
            <div className="filter-input" style={{ height: 44 }}><Icon name="user" size={17} style={{ color: "var(--text-3)" }} /><input value={u} onChange={e => setU(e.target.value)} placeholder={LIVE ? "name@nhp.ac.th" : ""} type={LIVE ? "email" : "text"} onKeyDown={e => { if (e.key === "Enter") doLogin(); }} /></div>
          </div>
          <div className="field"><label>รหัสผ่าน</label>
            <div className="filter-input" style={{ height: 44 }}><Icon name="lock" size={17} style={{ color: "var(--text-3)" }} /><input type={showPw ? "text" : "password"} value={p} onChange={e => setP(e.target.value)} onKeyDown={e => { if (e.key === "Enter") doLogin(); }} /><button type="button" onClick={() => setShowPw(v => !v)} title={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--text-3)", display: "grid", placeItems: "center", padding: 0 }}><Icon name={showPw ? "eyeOff" : "eye"} size={18} /></button></div>
          </div>
          {err && <div style={{ display: "flex", gap: 8, padding: 12, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 11, fontSize: 13.5, marginBottom: 16 }}><Icon name="alert" size={17} style={{ flexShrink: 0 }} /><span>{err}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 0 22px", fontSize: 13.5 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--text-2)" }}><input type="checkbox" defaultChecked style={{ accentColor: "var(--primary)", width: 16, height: 16 }} />จดจำการเข้าสู่ระบบ</label>
            <a style={{ color: "var(--primary)", fontWeight: 600, cursor: "pointer" }} onClick={() => { setForgot(true); setFgSent(false); setFgErr(""); setFgUser(LIVE ? (u || "") : (u || "admin")); }}>ลืมรหัสผ่าน?</a>
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={busy || (LIVE && (!u.trim() || !p))} onClick={doLogin}><Icon name="logout" size={18} style={{ transform: "scaleX(-1)" }} />{busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
          {!LIVE && role === "Super Admin" && (
            <div style={{ display: "flex", gap: 9, marginTop: 18, padding: 13, background: "var(--info-soft)", borderRadius: 12, color: "var(--info)", fontSize: 13 }}>
              <Icon name="shield" size={18} style={{ flexShrink: 0 }} /><span>บัญชีนี้เปิดใช้การยืนยันตัวตน 2 ขั้นตอน (2FA)</span>
            </div>
          )}
        </div>
      </div>

      {forgot && (
        <Modal title="ลืมรหัสผ่าน" onClose={() => setForgot(false)}
          footer={fgSent
            ? <button className="btn btn-primary" onClick={() => setForgot(false)} style={{ marginLeft: "auto" }}><Icon name="check" size={16} />เข้าใจแล้ว</button>
            : <><button className="btn" onClick={() => setForgot(false)}>ยกเลิก</button><button className="btn btn-primary" disabled={!fgUser.trim() || fgBusy} onClick={sendReset}><Icon name="logout" size={16} style={{ transform: "scaleX(-1)" }} />{fgBusy ? "กำลังส่ง…" : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}</button></>}>
          {fgSent ? (
            <div style={{ textAlign: "center", padding: "8px 4px" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--ok-soft)", color: "var(--ok)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}><Icon name="check2" size={30} /></div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>ส่งคำขอรีเซ็ตรหัสผ่านแล้ว</h3>
              <p style={{ color: "var(--text-2)", margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมล<br />
                <b className="num">{fgUser}</b> แล้ว<br />
                <span style={{ color: "var(--text-3)", fontSize: 13 }}>ลิงก์มีอายุ 1 ชั่วโมง · กรุณาตรวจสอบกล่องจดหมาย (รวมถึงโฟลเดอร์สแปม)</span>
              </p>
              <div style={{ display: "flex", gap: 9, padding: 12, background: "var(--info-soft)", borderRadius: 11, color: "var(--info)", fontSize: 12.5, marginTop: 18, textAlign: "left" }}>
                <Icon name="alert" size={16} style={{ flexShrink: 0 }} /><span>เปิดอีเมลแล้วคลิกลิงก์เพื่อตั้งรหัสผ่านใหม่ ระบบจะพากลับมาที่หน้านี้</span>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: "var(--text-2)", margin: "0 0 16px", fontSize: 14, lineHeight: 1.6 }}>กรอกอีเมลของบัญชีที่ลงทะเบียนไว้ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยัง<b>อีเมลนั้นโดยตรง</b></p>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>อีเมล</label>
                <div className="filter-input" style={{ height: 44 }}><Icon name="user" size={17} style={{ color: "var(--text-3)" }} /><input type="email" value={fgUser} onChange={e => setFgUser(e.target.value)} placeholder="name@nhp.ac.th" autoFocus onKeyDown={e => { if (e.key === "Enter") sendReset(); }} /></div>
              </div>
              {fgErr && <div style={{ display: "flex", gap: 8, padding: 11, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 10, fontSize: 13, marginTop: 12 }}><Icon name="alert" size={16} style={{ flexShrink: 0 }} /><span>{fgErr}</span></div>}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function AuditPage() {
  const toast = React.useContext(ToastCtx);
  const [q, setQ] = uS("");
  const [typeF, setTypeF] = uS("all");
  const [store] = useStore();
  const types = [...new Set(store.audit.map(a => a.action))];
  const list = store.audit.filter(a =>
    (typeF === "all" || a.action === typeF) &&
    (q === "" || (a.action + a.user + a.detail).toLowerCase().includes(q.toLowerCase())));
  const exportLog = () => {
    exportExcel("AuditLog_NHP_2569", ["กิจกรรม", "ผู้ใช้", "รายละเอียด", "วันที่", "เวลา", "IP"],
      list.map(a => [a.action, a.user, a.detail, a.date, a.time, a.ip]));
    toast("ส่งออก Audit Log แล้ว");
  };
  return (
    <div>
      <PageHead crumb={["Audit Log"]} title="บันทึกกิจกรรม" desc={"ประวัติการใช้งานระบบทั้งหมด · " + store.audit.length + " รายการ"}
        actions={<button className="btn" onClick={exportLog}><Icon name="download" size={17} />ส่งออก</button>} />
      <div className="toolbar">
        <div className="filter-input" style={{ minWidth: 280 }}><Icon name="search" size={17} style={{ color: "var(--text-3)" }} /><input placeholder="ค้นหากิจกรรม / ผู้ใช้ / รายละเอียด…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select className="select" style={{ width: "auto", minWidth: 160 }} value={typeF} onChange={e => setTypeF(e.target.value)}>
          <option value="all">ทุกประเภทกิจกรรม</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="spacer"></div>
        <span style={{ color: "var(--text-3)", fontSize: 13.5 }}>{list.length} รายการ</span>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>กิจกรรม</th><th>ผู้ใช้</th><th>รายละเอียด</th><th>วันที่ / เวลา</th><th>IP Address</th></tr></thead>
            <tbody>
              {list.map(a => (
                <tr key={a.id}>
                  <td><Badge cls={a.cls}>{a.action}</Badge></td>
                  <td style={{ fontWeight: 600 }}>{a.user}</td>
                  <td style={{ color: "var(--text-2)" }}>{a.detail}</td>
                  <td className="num" style={{ color: "var(--text-2)", fontSize: 13 }}>{a.date} · {a.time}</td>
                  <td className="num" style={{ color: "var(--text-3)", fontSize: 13 }}>{a.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <Empty icon="audit" title="ไม่พบรายการ" />}
      </div>
    </div>
  );
}

function CustomPage({ menu }) {
  const storeKey = "nhp-custompage-" + menu.id;
  const [blocks, setBlocks] = uS(() => {
    try { return JSON.parse(localStorage.getItem("nhp-custompage-" + menu.id)) || []; } catch (e) { return []; }
  });
  const [edit, setEdit] = uS(false);
  uE(() => { localStorage.setItem(storeKey, JSON.stringify(blocks)); }, [blocks]);

  const addBlock = (type) => setBlocks([...blocks, { id: Date.now(), type, heading: type === "heading" ? "หัวข้อใหม่" : "", text: type === "text" ? "พิมพ์เนื้อหาที่นี่…" : "", items: type === "list" ? ["รายการที่ 1"] : null }]);
  const upd = (id, patch) => setBlocks(blocks.map(b => b.id === id ? { ...b, ...patch } : b));
  const del = (id) => setBlocks(blocks.filter(b => b.id !== id));
  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= blocks.length) return; const a = [...blocks];[a[i], a[j]] = [a[j], a[i]]; setBlocks(a); };

  return (
    <div>
      <PageHead crumb={["เมนูเพิ่มเติม", menu.label]} title={menu.label} desc={menu.url ? "เส้นทาง: " + menu.url : "หน้าเนื้อหาที่ปรับแต่งได้เอง"}
        actions={<button className={"btn" + (edit ? " btn-primary" : "")} onClick={() => setEdit(e => !e)}><Icon name={edit ? "check" : "edit"} size={17} />{edit ? "เสร็จสิ้น" : "แก้ไขหน้านี้"}</button>} />

      {edit && (
        <div className="card card-pad" style={{ marginBottom: 16, display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-2)" }}>เพิ่มบล็อก:</span>
          <button className="btn btn-sm" onClick={() => addBlock("heading")}><Icon name="plus" size={14} />หัวข้อ</button>
          <button className="btn btn-sm" onClick={() => addBlock("text")}><Icon name="plus" size={14} />ข้อความ</button>
          <button className="btn btn-sm" onClick={() => addBlock("list")}><Icon name="plus" size={14} />รายการ</button>
          <button className="btn btn-sm" onClick={() => addBlock("callout")}><Icon name="plus" size={14} />กล่องเน้น</button>
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: "center", padding: 56 }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Icon name={menu.icon || "box"} size={30} /></div>
          <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>{menu.label}</h2>
          <p style={{ color: "var(--text-3)", margin: "0 auto 18px", maxWidth: 420 }}>หน้านี้ยังไม่มีเนื้อหา · กด "แก้ไขหน้านี้" แล้วเพิ่มบล็อกเพื่อปรับแต่งข้อมูลตามต้องการ</p>
          {!edit && <button className="btn btn-primary" style={{ margin: "0 auto" }} onClick={() => setEdit(true)}><Icon name="edit" size={16} />เริ่มแก้ไข</button>}
        </div>
      ) : (
        <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {blocks.map((b, i) => (
            <div key={b.id} style={{ position: "relative", border: edit ? "1px dashed var(--border-strong)" : "0", borderRadius: 12, padding: edit ? 14 : 0 }}>
              {edit && (
                <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4, zIndex: 2 }}>
                  <button className="icon-btn" style={{ width: 28, height: 28 }} disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={13} /></button>
                  <button className="icon-btn" style={{ width: 28, height: 28 }} disabled={i === blocks.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={13} /></button>
                  <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => del(b.id)}><Icon name="trash" size={13} /></button>
                </div>
              )}
              {b.type === "heading" && (edit
                ? <input className="input" style={{ fontWeight: 700, fontSize: 18 }} value={b.heading} onChange={e => upd(b.id, { heading: e.target.value })} />
                : <h2 style={{ fontSize: 21, margin: 0, letterSpacing: "-.01em" }}>{b.heading}</h2>)}
              {b.type === "text" && (edit
                ? <textarea className="input" rows="3" value={b.text} onChange={e => upd(b.id, { text: e.target.value })} />
                : <p style={{ margin: 0, color: "var(--text-2)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{b.text}</p>)}
              {b.type === "callout" && (edit
                ? <textarea className="input" rows="2" value={b.text} placeholder="ข้อความในกล่องเน้น" onChange={e => upd(b.id, { text: e.target.value })} />
                : <div style={{ display: "flex", gap: 11, padding: 15, background: "var(--primary-soft)", borderRadius: 12, color: "var(--brand-sky-700)" }}><Icon name="alert" size={19} style={{ flexShrink: 0 }} /><span style={{ fontWeight: 500 }}>{b.text}</span></div>)}
              {b.type === "list" && (
                <div>
                  {edit && <div style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 7 }}>รายการ (หนึ่งบรรทัดต่อหนึ่งข้อ)</div>}
                  {edit
                    ? <textarea className="input" rows="4" value={b.items.join("\n")} onChange={e => upd(b.id, { items: e.target.value.split("\n") })} />
                    : <ul style={{ margin: 0, paddingLeft: 4, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                        {b.items.filter(x => x.trim()).map((it, j) => <li key={j} style={{ display: "flex", gap: 10, color: "var(--text-2)" }}><Icon name="check2" size={17} style={{ color: "var(--ok)", flexShrink: 0, marginTop: 2 }} />{it}</li>)}
                      </ul>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// หน้าสถานะอุปกรณ์แบบสาธารณะ (เปิดจากการสแกน QR สติกเกอร์ — ไม่ต้องล็อกอิน)
function PublicDeviceStatus({ tag, logo }) {
  const [data, setData] = uS(undefined);
  uE(() => {
    let alive = true;
    (window.SB && window.SB.deviceStatus ? window.SB.deviceStatus(tag) : Promise.resolve({ ok: false }))
      .then(r => { if (alive) setData(r && r.ok ? (r.data || null) : null); })
      .catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [tag]);
  const STC = { "พร้อมใช้งาน": ["#1f9d6b", "#e0f4ec"], "ถูกยืม": ["#1488bd", "#e2f3fb"], "ชำรุด": ["#e04646", "#fbe4e4"], "ส่งซ่อม": ["#e0700f", "#fdeedd"], "สูญหาย": ["#64748b", "#eef2f5"] };
  const c = data ? (STC[data.status] || ["#64748b", "#eef2f5"]) : ["#64748b", "#eef2f5"];
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 20 }}>
      <div className="card card-pad" style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <img src={logo || "assets/logo.png"} style={{ width: 48, height: 48, borderRadius: 12, margin: "0 auto 10px" }} alt="" />
        <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 18 }}>NHP iPad Management · ตรวจสอบสถานะอุปกรณ์</div>
        {data === undefined ? (
          <div style={{ padding: "30px 0", color: "var(--text-3)" }}>กำลังโหลด…</div>
        ) : data === null ? (
          <div style={{ padding: "24px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--danger-soft)", color: "var(--danger)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}><Icon name="alert" size={28} /></div>
            <div style={{ fontWeight: 600 }}>ไม่พบอุปกรณ์</div>
            <div className="num" style={{ color: "var(--text-3)", fontSize: 13, marginTop: 4 }}>{tag}</div>
          </div>
        ) : (
          <div>
            <div style={{ width: 76, height: 76, borderRadius: 18, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Icon name="tablet" size={38} stroke={1.5} /></div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{data.model || data.type_name || "อุปกรณ์"}</div>
            <div className="num" style={{ color: "var(--text-2)", marginBottom: 14 }}>{data.asset_tag}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 999, background: c[1], color: c[0], fontWeight: 600, fontSize: 15 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: c[0] }}></span>{data.status}
            </div>
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 18, paddingTop: 14, textAlign: "left" }}>
              <div className="kv" style={{ padding: "8px 4px" }}><span className="k">ผู้ถือครอง</span><span className="v">{data.holder || "—"}</span></div>
              <div className="kv" style={{ padding: "8px 4px" }}><span className="k">ชั้น / ฝ่าย</span><span className="v">{data.holder_level || "—"}</span></div>
            </div>
          </div>
        )}
        <a href={window.location.pathname} style={{ display: "inline-block", marginTop: 20, color: "var(--primary)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>เข้าสู่ระบบจัดการ →</a>
      </div>
    </div>
  );
}

function App() {
  const LIVE = !!(window.NHP_CONFIG && window.NHP_CONFIG.live);
  // Live mode: ไม่เชื่อ localStorage — รอยืนยัน session กับ Supabase ก่อน
  const [authed, setAuthed] = uS(() => !LIVE && localStorage.getItem("nhp-authed") === "1");
  const [role, setRole] = uS(() => localStorage.getItem("nhp-role") || "Super Admin");
  const [userName, setUserName] = uS(() => localStorage.getItem("nhp-username-display") || "");
  const [booting, setBooting] = uS(LIVE);
  const [recovery, setRecovery] = uS(false);
  const [recovPw, setRecovPw] = uS("");
  const [recovErr, setRecovErr] = uS("");
  const [recovBusy, setRecovBusy] = uS(false);
  // ชื่อที่แสดงจริง: จากบัญชีที่ login (app_users) > ค่าเริ่มต้นตามบทบาท
  const displayName = userName || USER_NAMES[role] || (role === "Super Admin" ? "ผู้ดูแลระบบ" : role);
  const [page, setPage] = uS(() => localStorage.getItem("nhp-page") || "dashboard");
  const [theme, setTheme] = uS(() => localStorage.getItem("nhp-theme") || "light");
  const [primary, setPrimary] = uS(() => localStorage.getItem("nhp-primary") || "#1aa6e0");
  const [modules, setModules] = uS(() => {
    try { return JSON.parse(localStorage.getItem("nhp-modules")) || {}; } catch (e) { return {}; }
  });
  const [loginBg, setLoginBg] = uS(() => localStorage.getItem("nhp-loginbg") || "");
  const [customMenus, setCustomMenus] = uS(() => {
    try { return JSON.parse(localStorage.getItem("nhp-custommenus")) || []; } catch (e) { return []; }
  });
  const [collapsed, setCollapsed] = uS(false);
  const [mobileNav, setMobileNav] = uS(false);
  const [navPayload, setNavPayload] = uS(null);
  const [store] = useStore();
  const odc = store.borrows.filter(b => b.overdueDays > 0).length;

  const moduleOff = (navId) => {
    const key = navId === "reports" ? "report" : navId;
    return modules[key] === false;
  };

  uE(() => {
    const apply = () => {
      const resolved = theme === "auto" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
      document.documentElement.setAttribute("data-theme", resolved);
    };
    apply();
    localStorage.setItem("nhp-theme", theme);
    if (theme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);
  uE(() => { localStorage.setItem("nhp-modules", JSON.stringify(modules)); }, [modules]);
  uE(() => { localStorage.setItem("nhp-custommenus", JSON.stringify(customMenus)); }, [customMenus]);
  uE(() => { localStorage.setItem("nhp-page", page); }, [page]);
  uE(() => { localStorage.setItem("nhp-authed", authed ? "1" : "0"); localStorage.setItem("nhp-role", role); localStorage.setItem("nhp-username-display", userName || ""); }, [authed, role, userName]);
  // Live mode: คืนสภาพ session เมื่อรีเฟรช (ตรวจกับ Supabase + ดึงข้อมูลจริง)
  uE(() => {
    if (!LIVE) return;
    let alive = true;
    window.SB.auth.restore().then(res => {
      if (!alive) return;
      if (res && res.session) {
        window.SB.hydrate().then(() => { if (alive) { setRole(res.role); setUserName(res.name || ""); setAuthed(true); setBooting(false); } })
          .catch(() => { if (alive) setBooting(false); });
      } else { setBooting(false); }
    }).catch(() => { if (alive) setBooting(false); });
    return () => { alive = false; };
  }, []);
  // Live: ผู้ใช้คลิกลิงก์รีเซ็ตรหัสผ่านจากอีเมล → เข้าโหมดตั้งรหัสผ่านใหม่
  uE(() => {
    if (!LIVE) return;
    if (/type=recovery/.test(window.location.hash)) { setRecovery(true); setBooting(false); }
    const sub = window.sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") { setRecovery(true); setBooting(false); }
    });
    return () => { try { sub.data.subscription.unsubscribe(); } catch (e) {} };
  }, []);
  const submitRecovery = async () => {
    if (!recovPw || recovPw.length < 6) { setRecovErr("รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร"); return; }
    setRecovErr(""); setRecovBusy(true);
    const r = await window.sb.auth.updateUser({ password: recovPw });
    setRecovBusy(false);
    if (r.error) { setRecovErr(r.error.message || "ตั้งรหัสผ่านไม่สำเร็จ"); return; }
    try { history.replaceState(null, "", window.location.pathname); } catch (e) {}
    setRecovery(false); setRecovPw("");
    const prof = await window.SB.auth.restore();
    if (prof && prof.session) { setRole(prof.role); setUserName(prof.name || ""); await window.SB.hydrate(); setAuthed(true); }
  };
  uE(() => {
    document.documentElement.style.setProperty("--primary", primary);
    document.documentElement.style.setProperty("--brand-sky", primary);
    localStorage.setItem("nhp-primary", primary);
  }, [primary]);

  const go = (p, payload) => { setPage(p); setNavPayload(payload || null); setMobileNav(false); window.scrollTo(0, 0); };
  const doLogout = () => {
    window.logAction && window.logAction("ออกจากระบบ", displayName + " ออกจากระบบ", "b-muted", displayName);
    if (LIVE && window.SB) window.SB.auth.signOut();
    setAuthed(false);
  };

  const deviceQuery = new URLSearchParams(window.location.search).get("d");
  if (deviceQuery) return <PublicDeviceStatus tag={deviceQuery} logo={store.logo} />;

  if (recovery) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 20 }}>
      <div className="card card-pad" style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ width: 54, height: 54, borderRadius: 14, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", marginBottom: 14 }}><Icon name="lock" size={26} /></div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>ตั้งรหัสผ่านใหม่</h2>
        <p style={{ color: "var(--text-3)", margin: "0 0 20px", fontSize: 14 }}>กรอกรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
        <div className="field"><label>รหัสผ่านใหม่</label>
          <div className="filter-input" style={{ height: 44 }}><Icon name="lock" size={17} style={{ color: "var(--text-3)" }} /><input type="password" value={recovPw} onChange={e => setRecovPw(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" autoFocus onKeyDown={e => { if (e.key === "Enter") submitRecovery(); }} /></div>
        </div>
        {recovErr && <div style={{ display: "flex", gap: 8, padding: 11, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 10, fontSize: 13, marginBottom: 14 }}><Icon name="alert" size={16} style={{ flexShrink: 0 }} /><span>{recovErr}</span></div>}
        <button className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={recovBusy || !recovPw} onClick={submitRecovery}><Icon name="check" size={18} />{recovBusy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</button>
      </div>
    </div>
  );

  if (booting) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--text-2)" }}>
      <div style={{ textAlign: "center" }}>
        <img src={store.logo || "assets/logo.png"} style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 14 }} alt="" />
        <div style={{ fontSize: 15 }}>กำลังเชื่อมต่อระบบ…</div>
      </div>
    </div>
  );

  if (!authed) return <Login onLogin={(r, name) => { setRole(r); setUserName(name || ""); setAuthed(true); window.logAction && window.logAction("เข้าสู่ระบบ", (name || USER_NAMES[r] || r) + " (" + r + ") เข้าสู่ระบบ", "b-info", name || USER_NAMES[r] || r, "dashboard"); }} loginBg={loginBg} logo={store.logo} />;

  const pages = {
    dashboard: <Dashboard go={go} />, devices: <Devices go={go} intent={navPayload} />, borrow: <BorrowReturn go={go} user={displayName} intent={navPayload} />,
    overdue: <Overdue go={go} />, timeline: <Timeline go={go} />, qr: <QRStickers go={go} />,
    registry: <Registry go={go} />,
    quick: <QuickStation go={go} user={displayName} />,
    repair: <Repairs go={go} />, students: <Students go={go} intent={navPayload} />, teachers: <Teachers go={go} intent={navPayload} />, reports: <Reports go={go} />,
    audit: <AuditPage />, settings: <Settings go={go} theme={theme} setTheme={setTheme} primary={primary} setPrimary={setPrimary} modules={modules} setModules={setModules} loginBg={loginBg} setLoginBg={setLoginBg} customMenus={customMenus} setCustomMenus={setCustomMenus} />,
  };
  const customActive = customMenus.find(m => "custom-" + m.id === page);

  return (
    <div className="app">
      <div className={"scrim" + (mobileNav ? " show" : "")} onClick={() => setMobileNav(false)}></div>
      <aside className={"sidebar" + (collapsed ? " collapsed" : "") + (mobileNav ? " mobile-open" : "")}>
        <div className="side-head">
          <img src={store.logo} className="side-logo" alt="" />
          <div className="side-title"><b>NHP System</b><span>{(store.school && store.school.name || "หนองหงส์พิทยาคม").replace(/^โรงเรียน/, "")}</span></div>
        </div>
        <nav className="nav">
          {NAV.map((item, i) => item.sec ? (
            <div key={i} className="nav-sec">{item.sec}</div>
          ) : moduleOff(item.id) ? null : (
            <button key={item.id} className={"nav-item" + (page === item.id ? " active" : "")} onClick={() => go(item.id)} title={item.label}>
              <span className="nav-tile" style={{ "--tile": item.color }}><Icon name={item.icon} size={17} className="nav-ic" /></span>
              <span className="nav-label">{item.label}</span>
              {(item.id === "overdue" ? odc : item.badge) > 0 && <span className="nav-badge num">{item.id === "overdue" ? odc : item.badge}</span>}
            </button>
          ))}
          {customMenus.filter(m => m.on !== false).length > 0 && <div className="nav-sec">เมนูเพิ่มเติม</div>}
          {customMenus.filter(m => m.on !== false).map(m => (
            <button key={m.id} className={"nav-item" + (page === "custom-" + m.id ? " active" : "")} onClick={() => go("custom-" + m.id)} title={m.label}>
              <span className="nav-tile" style={{ "--tile": "#0d9488" }}><Icon name={m.icon || "box"} size={17} className="nav-ic" /></span>
              <span className="nav-label">{m.label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-user">
            <div className="avatar">{role === "นักเรียน" ? "นก" : role === "ครู" ? "คร" : "ผด"}</div>
            <div className="side-foot-txt" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }} className="clip">{displayName}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }} className="clip">{role}</div>
            </div>
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={doLogout} title="ออกจากระบบ"><Icon name="logout" size={16} /></button>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setMobileNav(true)} style={{ display: "none" }}><Icon name="menu" size={20} /></button>
          <button className="icon-btn desk-only" onClick={() => setCollapsed(c => !c)}><Icon name="menu" size={20} /></button>
          <div className="search">
            <Icon name="search" size={18} />
            <input placeholder="ค้นหาอุปกรณ์, นักเรียน, Asset Tag…" />
          </div>
          <div className="spacer" style={{ flex: 1 }}></div>
          <button className="icon-btn" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="สลับธีม">
            <Icon name={theme === "dark" ? "sun" : "moon"} size={19} />
          </button>
          {window.NotificationBell ? React.createElement(window.NotificationBell, { go }) : <button className="icon-btn" title="การแจ้งเตือน"><Icon name="bell" size={19} /><span className="dot-badge"></span></button>}
          <div style={{ display: "flex", alignItems: "center", gap: 9, paddingLeft: 6 }}>
            <div className="avatar" style={{ width: 38, height: 38 }}>{role === "นักเรียน" ? "นก" : role === "ครู" ? "คร" : "ผด"}</div>
          </div>
        </div>
        <div className="content">{pages[page] || (customActive ? <CustomPage menu={customActive} /> : pages.dashboard)}</div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ToastHost><App /></ToastHost>
);
