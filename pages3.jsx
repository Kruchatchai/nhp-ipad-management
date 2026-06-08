/* ===== Overdue + Repairs + QR Stickers ===== */
const DC = window.NHP;

function Overdue({ go }) {
  const toast = React.useContext(ToastCtx);
  const [tab, setTab] = useState("all");
  const [level, setLevel] = useState("all");
  const [room, setRoom] = useState("all");
  const [store, setStore] = useStore();
  const rows = store.borrows;
  const setRows = (v) => setStore(st => ({ borrows: typeof v === "function" ? v(st.borrows) : v }));
  const [editDue, setEditDue] = useState(null);
  const dueRef = useRef("");

  const parseLevel = (lv) => {
    const m = (lv || "").match(/(ม\.\d)\/(\d)/);
    return m ? { level: m[1], room: m[2] } : { level: null, room: null };
  };
  const sorted = [...rows].sort((a, b) => b.overdueDays - a.overdueDays);
  const list = sorted.filter(b => {
    const p = parseLevel(b.level);
    return (tab === "all" ? true : tab === "over" ? b.overdueDays > 0 : tab === "near" ? (b.overdueDays <= 0 && b.overdueDays > -10) : b.overdueDays <= -10)
      && (level === "all" || p.level === level)
      && (room === "all" || p.room === room);
  });
  const counts = {
    all: sorted.length,
    over: sorted.filter(b => b.overdueDays > 0).length,
    near: sorted.filter(b => b.overdueDays <= 0 && b.overdueDays > -10).length,
    ok: sorted.filter(b => b.overdueDays <= -10).length,
  };
  const badge = (b) => b.overdueDays > 0 ? <Badge cls="b-danger" dot>เกิน {b.overdueDays} วัน</Badge>
    : b.overdueDays > -10 ? <Badge cls="b-warn" dot>ใกล้ครบกำหนด</Badge> : <Badge cls="b-ok" dot>ปกติ</Badge>;

  const saveDue = () => {
    const nd = dueRef.current || editDue.dueDate;
    const overdueDays = Math.floor((parseISO(window.todayISO()) - parseISO(nd)) / 86400000);
    setRows(rows.map(r => r.id === editDue.id ? { ...r, dueDate: nd, overdueDays, status: overdueDays > 0 ? "เกินกำหนด" : overdueDays > -10 ? "ใกล้ครบกำหนด" : "ปกติ" } : r));
    toast("ปรับกำหนดคืนเป็น " + beShort(nd) + " แล้ว");
    setEditDue(null);
  };

  const goReturn = (b) => {
    const dev = store.ipads.find(d => d.assetTag === b.device || d.id === b.deviceId)
      || { id: b.deviceId, assetTag: b.device, model: b.model, type: "ipad", holder: b.holder, holderLevel: b.level, status: "ถูกยืม", statusCls: "b-info" };
    go("borrow", { mode: "return", device: dev });
  };

  const doExport = () => {
    exportExcel("รายงานค้างส่ง_NHP_2569",
      ["ผู้ถือครอง", "ชั้น/ห้อง", "Asset Tag", "รุ่น", "วันที่ยืม", "ครบกำหนด", "เกินกำหนด (วัน)", "สถานะ"],
      list.map(b => [b.holder, b.level, b.device, b.model, b.borrowDate, b.dueDate, b.overdueDays > 0 ? b.overdueDays : "-", b.status]));
    toast("ส่งออกรายงานค้างส่ง " + list.length + " รายการ");
  };

  return (
    <div>
      <PageHead crumb={["ติดตามอุปกรณ์ค้างส่ง"]} title="ติดตามอุปกรณ์ค้างส่ง" desc="ตรวจสอบกำหนดคืนและติดตามผู้ยืม"
        actions={<button className="btn" onClick={doExport}><Icon name="download" size={17} />ส่งออกรายงาน</button>} />

      <div className="stat-grid" style={{ marginBottom: 20, gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}>
        <div className="stat" style={{ borderLeft: "4px solid var(--danger)" }}>
          <div className="stat-val num" style={{ color: "var(--danger)" }}>{counts.over}</div><div className="stat-label">เกินกำหนด</div>
        </div>
        <div className="stat" style={{ borderLeft: "4px solid var(--warn)" }}>
          <div className="stat-val num" style={{ color: "var(--warn)" }}>{counts.near}</div><div className="stat-label">ใกล้ครบกำหนด (≤ 10 วัน)</div>
        </div>
        <div className="stat" style={{ borderLeft: "4px solid var(--ok)" }}>
          <div className="stat-val num" style={{ color: "var(--ok)" }}>{counts.ok}</div><div className="stat-label">ปกติ</div>
        </div>
        <div className="stat" style={{ borderLeft: "4px solid var(--info)" }}>
          <div className="stat-val num">{counts.all}</div><div className="stat-label">ที่ถูกยืมทั้งหมด</div>
        </div>
      </div>

      <div className="tabs">
        {[["all", "ทั้งหมด"], ["over", "เกินกำหนด"], ["near", "ใกล้ครบกำหนด"], ["ok", "ปกติ"]].map(([k, l]) => (
          <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{l} <span className="num" style={{ opacity: .6 }}>({counts[k]})</span></button>
        ))}
      </div>

      <div className="toolbar">
        <Icon name="filter" size={16} style={{ color: "var(--text-3)" }} />
        <select className="select" style={{ width: "auto", minWidth: 120 }} value={level} onChange={e => setLevel(e.target.value)}>
          <option value="all">ทุกชั้น</option>{DC.levels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className="select" style={{ width: "auto", minWidth: 110 }} value={room} onChange={e => setRoom(e.target.value)}>
          <option value="all">ทุกห้อง</option>{[1, 2, 3, 4].map(r => <option key={r} value={r}>ห้อง {r}</option>)}
        </select>
        <div className="spacer"></div>
        <span style={{ color: "var(--text-3)", fontSize: 13.5 }}>{list.length} รายการ</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>ผู้ถือครอง</th><th>ชั้น/ห้อง</th><th>Asset Tag</th><th>วันที่ยืม</th><th>ครบกำหนด</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {list.map(b => (
                <tr key={b.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div className="avatar" style={{ width: 34, height: 34, fontSize: 14 }}>{initials((b.holder || "").replace(/^(เด็กชาย|เด็กหญิง|นางสาว|นาย|ครู)/, ""))}</div>
                      <span style={{ fontWeight: 600 }}>{b.holder}</span>
                    </div>
                  </td>
                  <td>{b.level}</td>
                  <td><span className="num" style={{ fontWeight: 600 }}>{b.device}</span><div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{b.model}</div>{(b.accessories || []).length > 0 && <div style={{ fontSize: 11.5, color: "var(--accent)", marginTop: 2 }}><Icon name="layers" size={11} style={{ verticalAlign: -1, marginRight: 3 }} />เสริม {b.accessories.length} รายการ</div>}</td>
                  <td className="num" style={{ color: "var(--text-2)" }}>{beShort(b.borrowDate)}</td>
                  <td className="num" style={{ color: b.overdueDays > 0 ? "var(--danger)" : "var(--text-2)", fontWeight: b.overdueDays > 0 ? 700 : 400 }}>{beShort(b.dueDate)}</td>
                  <td>{badge(b)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn-sm btn-primary" onClick={() => goReturn(b)}><Icon name="swap" size={14} />รับคืน</button>
                      <button className="btn btn-sm" onClick={() => { dueRef.current = b.dueDate; setEditDue(b); }}><Icon name="calendar" size={14} />เลื่อนกำหนด</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <Empty icon="check2" title="ไม่มีรายการในหมวดนี้" />}
      </div>

      {editDue && (
        <Modal title="ปรับกำหนดคืน" onClose={() => setEditDue(null)}
          footer={<><button className="btn" onClick={() => setEditDue(null)}>ยกเลิก</button><button className="btn btn-primary" onClick={saveDue}><Icon name="check" size={16} />บันทึก</button></>}>
          <div className="card" style={{ background: "var(--surface-2)", marginBottom: 16 }}>
            <div className="kv" style={{ padding: "11px 16px" }}><span className="k">อุปกรณ์</span><span className="v num">{editDue.device} · {editDue.model}</span></div>
            <div className="kv" style={{ padding: "11px 16px" }}><span className="k">ผู้ถือครอง</span><span className="v">{editDue.holder} ({editDue.level})</span></div>
            <div className="kv" style={{ padding: "11px 16px" }}><span className="k">กำหนดเดิม</span><span className="v">{beShort(editDue.dueDate)}</span></div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}><label>กำหนดคืนใหม่</label>
            <BEDatePicker value={dueRef.current || editDue.dueDate} onChange={(v) => { dueRef.current = v; setEditDue({ ...editDue }); }} />
          </div>
        </Modal>
      )}
    </div>
  );
}
window.Overdue = Overdue;

/* ===== Repairs ===== */
function Repairs({ go }) {
  const toast = React.useContext(ToastCtx);
  const [store, setStore] = useStore();
  const [tab, setTab] = useState("ipad");
  const [add, setAdd] = useState(false);
  const items = store.repairs;
  const setItems = (v) => setStore(st => ({ repairs: typeof v === "function" ? v(st.repairs) : v }));
  const [menu, setMenu] = useState(null);
  const [del, setDel] = useState(null);
  const [repDevice, setRepDevice] = useState(null);
  const [boardQ, setBoardQ] = useState("");
  const [repQ, setRepQ] = useState("");
  const [repOpen, setRepOpen] = useState(false);
  const [repType, setRepType] = useState((store.repairTypes && store.repairTypes[0]) || DC.repairTypes[0]);
  const [newType, setNewType] = useState("");
  const [repPhotos, setRepPhotos] = useState([]);
  const repDetail = useRef("");
  const repairTypes = store.repairTypes || DC.repairTypes;
  // live repair status per device (active ticket) — drives the picker badge
  const tixByTag = {};
  store.repairs.forEach(r => { if (r.status === "รอดำเนินการ" || r.status === "กำลังซ่อม") tixByTag[r.device] = r; });

  const openAdd = () => { setRepDevice(null); setRepQ(""); setRepType((store.repairTypes && store.repairTypes[0]) || DC.repairTypes[0]); repDetail.current = ""; setRepPhotos([]); setAdd(true); };
  // live device list — broken (ชำรุด, awaiting repair order) shown first, then others; all scrollable
  const activeTix = new Set(store.repairs.filter(r => r.status === "รอดำเนินการ" || r.status === "กำลังซ่อม").map(r => r.device));
  const deviceMatches = useMemo(() => {
    const ql = repQ.toLowerCase();
    const list = store.ipads.filter(d =>
      repQ === "" ? true : (d.model + " " + d.serial + " " + d.assetTag + " " + (d.holder || "")).toLowerCase().includes(ql)
    );
    const rank = (d) => (d.status === "ชำรุด" && !activeTix.has(d.assetTag)) ? 0 : d.status === "ชำรุด" ? 1 : 2;
    return [...list].sort((a, b) => rank(a) - rank(b) || a.assetTag.localeCompare(b.assetTag)).slice(0, 60);
  }, [repQ, store.ipads, store.repairs]);
  const brokenPending = store.ipads.filter(d => d.status === "ชำรุด" && !activeTix.has(d.assetTag)).length;
  const submitRepair = () => {
    if (!repDevice) { toast("กรุณาเลือกอุปกรณ์", "alert"); return; }
    const nd = {
      id: Date.now(), ticket: "RP-" + String(items.length + 1).padStart(4, "0"),
      device: repDevice.assetTag, model: repDevice.model, type: repType,
      reporter: "ครู ICT", date: window.todayISO(), status: "รอดำเนินการ", statusCls: "b-warn",
      detail: repDetail.current || "แจ้งโดยผู้ดูแลระบบ",
      photos: repPhotos.map(p => p.src || p),
    };
    setItems([nd, ...items]);
    setStore(st => ({ ipads: st.ipads.map(d => d.assetTag === repDevice.assetTag ? { ...d, status: "ชำรุด", statusCls: "b-danger", holder: null, holderLevel: null } : d), borrows: st.borrows.filter(b => b.device !== repDevice.assetTag) }));
    setAdd(false);
    logAction("แจ้งซ่อม", nd.ticket + " · " + nd.type + " — " + nd.device, "b-warn", "ครู ICT", "repair");
    toast("ส่งคำขอแจ้งซ่อม " + nd.ticket + " — อุปกรณ์เปลี่ยนสถานะเป็น ชำรุด");
  };
  const addType = () => {
    const t = newType.trim();
    if (!t || repairTypes.includes(t)) { setNewType(""); return; }
    setStore(st => ({ repairTypes: [...(st.repairTypes || []), t] }));
    setRepType(t); setNewType("");
    toast("เพิ่มประเภทปัญหา “" + t + "” แล้ว");
  };
  const addTypeVal = (t) => {
    if (!t || repairTypes.includes(t)) return;
    setStore(st => ({ repairTypes: [...(st.repairTypes || []), t] }));
    setRepType(t);
    toast("เพิ่มประเภทปัญหา “" + t + "” แล้ว");
  };
  const delTypeVal = (t) => {
    setStore(st => ({ repairTypes: (st.repairTypes || []).filter(x => x !== t) }));
    if (repType === t) setRepType((repairTypes.filter(x => x !== t)[0]) || "");
    toast("ลบประเภทปัญหา “" + t + "” แล้ว", "trash");
  };
  const changeStatus = (r, k) => {
    const cls = DC.repairStatus.find(s => s[0] === k)[1];
    setItems(items.map(x => x.id === r.id ? { ...x, status: k, statusCls: cls } : x));
    setMenu(null);
    setTimeout(() => window.syncDevicesFromRepairs(), 0);
    logAction("เปลี่ยนสถานะซ่อม", r.ticket + " → " + k, "b-info", "ครู ICT", "repair");
    const back = (k === "ซ่อมเสร็จ");
    toast(r.ticket + " → " + k + (back ? " · อุปกรณ์กลับมาพร้อมใช้งาน" : k === "รอดำเนินการ" || k === "กำลังซ่อม" ? " · อุปกรณ์สถานะชำรุด" : ""));
  };
  const doDelete = () => {
    setItems(items.filter(x => x.id !== del.id));
    setTimeout(() => window.syncDevicesFromRepairs(), 0);
    logAction("ลบรายการ", "งานซ่อม " + del.ticket + " — " + del.device, "b-danger", "ผู้ดูแลระบบ", "repair");
    toast("ลบรายการแจ้งซ่อม " + del.ticket + " แล้ว", "trash");
    setDel(null);
  };
  const matchBoard = (r) => boardQ === "" || (r.ticket + " " + r.device + " " + r.model + " " + r.type + " " + r.reporter).toLowerCase().includes(boardQ.toLowerCase());
  const cols = DC.repairStatus.map(([k, cls]) => ({ k, cls, items: items.filter(r => r.status === k && matchBoard(r)) }));
  const matchTotal = items.filter(matchBoard).length;

  return (
    <div>
      <PageHead crumb={["แจ้งซ่อม"]} title="งานแจ้งซ่อม" desc={tab === "ipad" ? `${matchTotal} จาก ${items.length} รายการ` : "งานซ่อมอุปกรณ์เสริม (แยกตามผู้ยืม)"}
        actions={tab === "ipad" ? <>
          <div className="filter-input" style={{ minWidth: 240 }}>
            <Icon name="search" size={17} style={{ color: "var(--text-3)" }} />
            <input placeholder="ค้นหา Ticket, Asset Tag, รุ่น, อาการ…" value={boardQ} onChange={e => setBoardQ(e.target.value)} />
            {boardQ && <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setBoardQ("")}><Icon name="close" size={14} /></button>}
          </div>
          <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={17} />แจ้งซ่อมใหม่</button>
        </> : null} />

      <div className="tabs" style={{ marginBottom: 18 }}>
        <button className={"tab" + (tab === "ipad" ? " on" : "")} onClick={() => setTab("ipad")}><Icon name="tablet" size={15} /> ซ่อม iPad <span className="num" style={{ opacity: .6 }}>({store.repairs.length})</span></button>
        <button className={"tab" + (tab === "acc" ? " on" : "")} onClick={() => setTab("acc")}><Icon name="layers" size={15} /> ซ่อมอุปกรณ์เสริม <span className="num" style={{ opacity: .6 }}>({(store.accRepairs || []).length})</span></button>
      </div>

      {tab === "acc" ? <AccRepairBoard go={go} /> : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }} className="kanban">
        {cols.map(col => (
          <div key={col.k}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "0 4px" }}>
              <Badge cls={col.cls} dot>{col.k}</Badge>
              <span className="num" style={{ color: "var(--text-3)", fontSize: 13, marginLeft: "auto" }}>{col.items.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {col.items.map(r => (
                <div key={r.id} className="card card-pad" style={{ padding: 15, position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                    <span className="num" style={{ fontWeight: 700, fontSize: 13, color: "var(--primary)" }}>{r.ticket}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="num" style={{ fontSize: 12, color: "var(--text-3)" }}>{r.date}</span>
                      <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setDel(r)} title="ลบรายการซ่อม"><Icon name="trash" size={14} /></button>
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.type}</div>
                  <div className="num" style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 9 }}>{r.device} · {r.model}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, paddingTop: 9, borderTop: "1px solid var(--border)", fontSize: 12.5, color: "var(--text-2)" }}>
                    <Icon name="user" size={13} style={{ color: "var(--text-3)" }} />{r.reporter}
                    <button className="btn btn-sm" style={{ marginLeft: "auto", height: 28, padding: "0 9px" }} onClick={() => setMenu(menu === r.id ? null : r.id)}>
                      เปลี่ยนสถานะ<Icon name="chevD" size={13} />
                    </button>
                  </div>
                  {menu === r.id && (
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenu(null)}></div>
                      <div className="card" style={{ position: "absolute", right: 12, bottom: 44, zIndex: 41, boxShadow: "var(--shadow-lg)", padding: 6, minWidth: 160 }}>
                        {DC.repairStatus.map(([k, cls]) => (
                          <button key={k} onClick={() => changeStatus(r, k)} style={{
                            display: "flex", alignItems: "center", gap: 9, width: "100%", border: 0, background: r.status === k ? "var(--surface-3)" : "transparent",
                            padding: "8px 10px", borderRadius: 9, textAlign: "left", fontSize: 13.5, fontWeight: 500, color: "var(--text)",
                          }}>
                            <Badge cls={cls} dot>{k}</Badge>{r.status === k && <Icon name="check" size={15} style={{ marginLeft: "auto", color: "var(--primary)" }} />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {col.items.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "var(--text-3)", fontSize: 13, border: "1.5px dashed var(--border)", borderRadius: 13 }}>ไม่มีรายการ</div>}
            </div>
          </div>
        ))}
      </div>
      )}

      {add && (
        <Modal title="แจ้งซ่อมอุปกรณ์" onClose={() => setAdd(false)}
          footer={<><button className="btn" onClick={() => setAdd(false)}>ยกเลิก</button><button className="btn btn-primary" onClick={submitRepair}><Icon name="check" size={16} />ส่งคำขอ</button></>}>
          <div className="field"><label>เลือกอุปกรณ์ (ชื่อเครื่อง / Serial / Asset Tag)</label>
            {repDevice ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 13px", border: "1px solid var(--primary)", background: "var(--primary-soft)", borderRadius: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface)", display: "grid", placeItems: "center", color: "var(--primary)", flexShrink: 0 }}>
                  <Icon name={repDevice.type === "ipad" ? "tablet" : repDevice.type === "camera" ? "camera" : "laptop"} size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{repDevice.model} <span className="num" style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 13 }}>· {repDevice.assetTag}</span></div>
                  <div className="num" style={{ fontSize: 12.5, color: "var(--text-3)" }}>S/N: {repDevice.serial}</div>
                </div>
                <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => { setRepDevice(null); setRepOpen(true); }} title="เปลี่ยน"><Icon name="close" size={15} /></button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <div className="filter-input" style={{ height: 44 }}>
                  <Icon name="search" size={17} style={{ color: "var(--text-3)" }} />
                  <input placeholder="พิมพ์ชื่อเครื่องหรือซีเรียลเพื่อค้นหา…" value={repQ}
                    onFocus={() => setRepOpen(true)} onChange={e => { setRepQ(e.target.value); setRepOpen(true); }} />
                </div>
                {repOpen && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 5 }} onClick={() => setRepOpen(false)}></div>
                    <div className="card" style={{ position: "absolute", top: 50, left: 0, right: 0, zIndex: 6, maxHeight: 260, overflowY: "auto", boxShadow: "var(--shadow-lg)", padding: 6 }}>
                      {repQ === "" && brokenPending > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 11px 9px", fontSize: 12, fontWeight: 700, color: "var(--danger)" }}>
                          <Icon name="alert" size={14} />เครื่องชำรุดรอแจ้งซ่อม {brokenPending} เครื่อง · เลื่อนดูเครื่องอื่นด้านล่าง
                        </div>
                      )}
                      {deviceMatches.map(d => {
                        const pending = d.status === "ชำรุด" && !activeTix.has(d.assetTag);
                        return (
                        <button key={d.id} onClick={() => { setRepDevice(d); setRepOpen(false); }} style={{
                          display: "flex", alignItems: "center", gap: 11, width: "100%", border: pending ? "1px solid var(--danger)" : "0", background: pending ? "var(--danger-soft)" : "transparent",
                          padding: "9px 11px", borderRadius: 9, textAlign: "left", marginBottom: 2,
                        }} onMouseEnter={e => e.currentTarget.style.background = pending ? "var(--danger-soft)" : "var(--surface-3)"} onMouseLeave={e => e.currentTarget.style.background = pending ? "var(--danger-soft)" : "transparent"}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface-3)", display: "grid", placeItems: "center", color: "var(--text-2)", flexShrink: 0 }}>
                            <Icon name={d.type === "ipad" ? "tablet" : d.type === "camera" ? "camera" : "laptop"} size={18} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{d.model} <span className="num" style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 12 }}>· {d.assetTag}</span></div>
                            <div className="num" style={{ fontSize: 12, color: "var(--text-3)" }}>S/N: {d.serial}</div>
                          </div>
                          <Badge cls={tixByTag[d.assetTag] ? tixByTag[d.assetTag].statusCls : d.statusCls} dot>{tixByTag[d.assetTag] ? tixByTag[d.assetTag].status : d.status}</Badge>
                        </button>
                        );
                      })}
                      {deviceMatches.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>ไม่พบอุปกรณ์</div>}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="field"><label>ประเภทปัญหา</label>
            <ManagedTypeSelect options={repairTypes} value={repType} onChange={setRepType} onAdd={addTypeVal} onDelete={delTypeVal} addPlaceholder="เพิ่มประเภทปัญหาใหม่…" />
          </div>
          <div className="field"><label>รายละเอียดอาการ</label><textarea className="input" rows="4" placeholder="อธิบายอาการที่พบ…" onChange={e => repDetail.current = e.target.value}></textarea></div>
          <div className="field"><label>รูปภาพประกอบ (แนบรูป หรือ ถ่ายภาพ)</label>
            <PhotoUpload value={repPhotos} onChange={setRepPhotos} hint="แนบรูปอาการเสีย หรือเปิดกล้องถ่ายภาพ (สลับกล้องหน้า/หลังได้)" />
          </div>
        </Modal>
      )}

      {del && (
        <Modal title="ยืนยันการลบรายการซ่อม" onClose={() => setDel(null)}
          footer={<><button className="btn" onClick={() => setDel(null)}>ยกเลิก</button><button className="btn btn-danger" onClick={doDelete}><Icon name="trash" size={16} />ลบรายการ</button></>}>
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            <div className="stat-ic" style={{ background: "var(--danger-soft)", color: "var(--danger)", width: 48, height: 48, flexShrink: 0 }}><Icon name="alert" size={24} /></div>
            <div>ต้องการลบงานซ่อม <b className="num">{del.ticket}</b> ({del.type} · {del.device}) ใช่หรือไม่?<div style={{ color: "var(--text-3)", fontSize: 13.5, marginTop: 4 }}>การลบจะถูกบันทึกใน Audit Log และนำการ์ดออกจากบอร์ดทันที</div></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
window.Repairs = Repairs;

/* ===== Accessory repair board (separate from iPad) ===== */
function AccRepairBoard({ go }) {
  const toast = React.useContext(ToastCtx);
  const [store, setStore] = useStore();
  const items = store.accRepairs || [];
  const setItems = (fn) => setStore(st => ({ accRepairs: fn(st.accRepairs || []) }));
  const [add, setAdd] = useState(false);
  const [menu, setMenu] = useState(null);
  const [del, setDel] = useState(null);
  const [q, setQ] = useState("");
  // add-form state
  const [pickBorrow, setPickBorrow] = useState(null);  // a borrow record
  const [pickAcc, setPickAcc] = useState(null);        // accessory {id,name}
  const [prob, setProb] = useState((store.accRepairTypes || ["อื่น ๆ"])[0]);
  const [accDetail, setAccDetail] = useState("");
  const [accPhotos, setAccPhotos] = useState([]);
  const [bq, setBq] = useState("");
  const accRepairTypes = store.accRepairTypes || ["อื่น ๆ"];
  // active accessory-repair tickets keyed by borrower+accessory (for "already reported" flag)
  const activeAccKey = new Set((store.accRepairs || [])
    .filter(r => r.status === "รอดำเนินการ" || r.status === "กำลังซ่อม")
    .map(r => r.borrowerKind + ":" + r.borrowerId + ":" + r.accId));

  // borrowers currently holding accessories (source for accessory repair)
  const accHolders = store.borrows.filter(b => (b.accessories || []).length > 0)
    .filter(b => bq === "" || (b.holder + " " + b.device + " " + b.level).toLowerCase().includes(bq.toLowerCase()));

  const addProbType = (t) => { if (!t || accRepairTypes.includes(t)) return; setStore(st => ({ accRepairTypes: [...(st.accRepairTypes || []), t] })); setProb(t); toast("เพิ่มประเภทปัญหา “" + t + "” แล้ว"); };
  const delProbType = (t) => { setStore(st => ({ accRepairTypes: (st.accRepairTypes || []).filter(x => x !== t) })); if (prob === t) setProb(accRepairTypes.filter(x => x !== t)[0] || ""); toast("ลบประเภท “" + t + "” แล้ว", "trash"); };
  const openAdd = () => { setPickBorrow(null); setPickAcc(null); setProb((store.accRepairTypes || ["อื่น ๆ"])[0]); setAccDetail(""); setAccPhotos([]); setBq(""); setAdd(true); };
  const submit = () => {
    if (!pickBorrow || !pickAcc) { toast("เลือกผู้ยืมและอุปกรณ์เสริม", "alert"); return; }
    window.addAccRepair(pickBorrow, pickAcc.id, pickAcc.name, prob, { user: "ผู้ดูแลระบบ", detail: accDetail, photos: accPhotos.map(p => p.src || p) });
    toast("แจ้งซ่อมอุปกรณ์เสริม " + pickAcc.name + " ของ " + pickBorrow.holder + " แล้ว");
    setAdd(false);
  };
  const changeStatus = (r, k) => {
    const cls = DC.repairStatus.find(s => s[0] === k)[1];
    setItems(list => list.map(x => x.id === r.id ? { ...x, status: k, statusCls: cls } : x));
    setMenu(null);
    logAction("เปลี่ยนสถานะซ่อมอุปกรณ์เสริม", r.ticket + " → " + k, "b-info", "ผู้ดูแลระบบ", "repair");
    toast(r.ticket + " → " + k);
  };
  const doDelete = () => {
    setItems(list => list.filter(x => x.id !== del.id));
    logAction("ลบรายการ", "งานซ่อมอุปกรณ์เสริม " + del.ticket, "b-danger", "ผู้ดูแลระบบ", "repair");
    toast("ลบรายการแล้ว", "trash"); setDel(null);
  };
  const match = (r) => q === "" || (r.ticket + " " + r.accName + " " + r.borrowerName + " " + r.problem).toLowerCase().includes(q.toLowerCase());
  const cols = DC.repairStatus.map(([k, cls]) => ({ k, cls, items: items.filter(r => r.status === k && match(r)) }));

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div className="filter-input" style={{ minWidth: 240 }}>
          <Icon name="search" size={17} style={{ color: "var(--text-3)" }} />
          <input placeholder="ค้นหา Ticket / อุปกรณ์เสริม / ผู้ยืม…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="spacer"></div>
        <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={17} />แจ้งซ่อมอุปกรณ์เสริม</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }} className="kanban">
        {cols.map(col => (
          <div key={col.k}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "0 4px" }}>
              <Badge cls={col.cls} dot>{col.k}</Badge>
              <span className="num" style={{ color: "var(--text-3)", fontSize: 13, marginLeft: "auto" }}>{col.items.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {col.items.map(r => (
                <div key={r.id} className="card card-pad" style={{ padding: 15, position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                    <span className="num" style={{ fontWeight: 700, fontSize: 13, color: "var(--purple)" }}>{r.ticket}</span>
                    <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setDel(r)} title="ลบ"><Icon name="trash" size={14} /></button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="layers" size={16} /></div>
                    <div style={{ fontWeight: 600 }}>{r.accName}</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 9 }}>{r.problem}{r.device ? " · " + r.device : ""}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, paddingTop: 9, borderTop: "1px solid var(--border)", fontSize: 12.5, color: "var(--text-2)" }}>
                    <Icon name="user" size={13} style={{ color: "var(--text-3)" }} /><span className="clip" style={{ maxWidth: 110 }}>{r.borrowerName}</span>
                    <button className="btn btn-sm" style={{ marginLeft: "auto", height: 28, padding: "0 9px" }} onClick={() => setMenu(menu === r.id ? null : r.id)}>เปลี่ยนสถานะ<Icon name="chevD" size={13} /></button>
                  </div>
                  {menu === r.id && (
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenu(null)}></div>
                      <div className="card" style={{ position: "absolute", right: 12, bottom: 44, zIndex: 41, boxShadow: "var(--shadow-lg)", padding: 6, minWidth: 160 }}>
                        {DC.repairStatus.map(([k, cls]) => (
                          <button key={k} onClick={() => changeStatus(r, k)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: 0, background: r.status === k ? "var(--surface-3)" : "transparent", padding: "8px 10px", borderRadius: 9, textAlign: "left", fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>
                            <Badge cls={cls} dot>{k}</Badge>{r.status === k && <Icon name="check" size={15} style={{ marginLeft: "auto", color: "var(--primary)" }} />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {col.items.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "var(--text-3)", fontSize: 13, border: "1.5px dashed var(--border)", borderRadius: 13 }}>ไม่มีรายการ</div>}
            </div>
          </div>
        ))}
      </div>

      {add && (
        <Modal title="แจ้งซ่อมอุปกรณ์เสริม" onClose={() => setAdd(false)} wide
          footer={<><button className="btn" onClick={() => setAdd(false)}>ยกเลิก</button><button className="btn btn-primary" onClick={submit}><Icon name="check" size={16} />ส่งคำขอ</button></>}>
          <div className="field"><label>เลือกผู้ยืม (ที่ถืออุปกรณ์เสริมอยู่)</label>
            <div className="filter-input" style={{ marginBottom: 9 }}><Icon name="search" size={16} style={{ color: "var(--text-3)" }} /><input placeholder="ค้นหาชื่อผู้ยืม / Asset Tag…" value={bq} onChange={e => setBq(e.target.value)} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 200, overflowY: "auto" }}>
              {accHolders.slice(0, 30).map(b => (
                <button key={b.id} onClick={() => { setPickBorrow(b); setPickAcc(null); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, textAlign: "left", cursor: "pointer", border: "1.5px solid " + (pickBorrow && pickBorrow.id === b.id ? "var(--primary)" : "var(--border)"), background: pickBorrow && pickBorrow.id === b.id ? "var(--primary-soft)" : "var(--surface)" }}>
                  <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials(b.holder.replace(/^(เด็กชาย|เด็กหญิง|นางสาว|นาง|นาย|ครู)/, ""))}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="clip" style={{ fontWeight: 600, fontSize: 13 }}>{b.holder}</div>
                    <div className="clip" style={{ fontSize: 12, color: "var(--text-3)" }}>{b.level} · {b.device} · อุปกรณ์เสริม {b.accessories.length} รายการ</div>
                  </div>
                </button>
              ))}
              {accHolders.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>ไม่พบผู้ยืมที่ถืออุปกรณ์เสริม</div>}
            </div>
          </div>
          {pickBorrow && (
            <div className="field"><label>อุปกรณ์เสริมที่ต้องซ่อม</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {pickBorrow.accessories.map(a => {
                  const reported = activeAccKey.has(pickBorrow.borrowerKind + ":" + pickBorrow.borrowerId + ":" + a.id);
                  const selected = pickAcc && pickAcc.id === a.id;
                  return (
                  <button key={a.id} disabled={reported} onClick={() => !reported && setPickAcc(a)} title={reported ? "แจ้งซ่อมรายการนี้ไปแล้ว" : ""} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 10, cursor: reported ? "not-allowed" : "pointer", opacity: reported ? 0.65 : 1, border: "1.5px solid " + (selected ? "var(--accent)" : reported ? "var(--warn)" : "var(--border)"), background: selected ? "var(--accent-soft)" : reported ? "var(--warn-soft)" : "var(--surface)", fontSize: 13, fontWeight: 500 }}>
                    <Icon name="layers" size={14} style={{ color: reported ? "var(--warn)" : "var(--accent)" }} />{a.name}
                    {reported && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "var(--warn)" }}><Icon name="check2" size={12} />แจ้งซ่อมแล้ว</span>}
                  </button>
                  );
                })}
              </div>
              {pickBorrow.accessories.every(a => activeAccKey.has(pickBorrow.borrowerKind + ":" + pickBorrow.borrowerId + ":" + a.id)) &&
                <div style={{ marginTop: 9, fontSize: 12.5, color: "var(--warn)", display: "flex", alignItems: "center", gap: 6 }}><Icon name="alert" size={14} />อุปกรณ์เสริมทุกชิ้นของผู้ยืมรายนี้ถูกแจ้งซ่อมแล้ว</div>}
            </div>
          )}
          <div className="field"><label>ประเภทปัญหา</label>
            <ManagedTypeSelect options={accRepairTypes} value={prob} onChange={setProb} onAdd={addProbType} onDelete={delProbType} addPlaceholder="เพิ่มประเภทปัญหาใหม่…" />
          </div>
          <div className="field"><label>รายละเอียดอาการ</label><textarea className="input" rows="3" placeholder="อธิบายอาการที่พบ…" value={accDetail} onChange={e => setAccDetail(e.target.value)}></textarea></div>
          <div className="field" style={{ marginBottom: 0 }}><label>รูปภาพประกอบ (แนบรูป หรือ ถ่ายภาพ)</label>
            <PhotoUpload value={accPhotos} onChange={setAccPhotos} hint="แนบรูปอุปกรณ์เสริมที่เสีย หรือเปิดกล้องถ่ายภาพ (สลับกล้องหน้า/หลังได้)" />
          </div>
        </Modal>
      )}

      {del && (
        <Modal title="ยืนยันการลบ" onClose={() => setDel(null)}
          footer={<><button className="btn" onClick={() => setDel(null)}>ยกเลิก</button><button className="btn btn-danger" onClick={doDelete}><Icon name="trash" size={16} />ลบรายการ</button></>}>
          <div>ต้องการลบงานซ่อมอุปกรณ์เสริม <b className="num">{del.ticket}</b> ({del.accName} · {del.borrowerName}) ใช่หรือไม่?</div>
        </Modal>
      )}
    </div>
  );
}
window.AccRepairBoard = AccRepairBoard;

/* ===== QR Stickers ===== */
function QRStickers({ go }) {
  const toast = React.useContext(ToastCtx);
  const [store] = useStore();
  const devices = store.ipads;
  const [perPage, setPerPage] = useState(30);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState("3x3");
  const [content, setContent] = useState({ logo: true, qr: true, asset: true, code: true });
  const layout = { 20: [4, 5], 30: [5, 6], 40: [5, 8], 50: [5, 10] };
  const [cols] = layout[perPage] || [5];
  const totalPages = Math.max(1, Math.ceil(devices.length / perPage));
  const curPage = Math.min(page, totalPages - 1);
  const sample = devices.slice(curPage * perPage, (curPage + 1) * perPage);  // หน้าตัวอย่างปัจจุบัน
  useEffect(() => { setPage(0); }, [perPage]);
  const sizePx = { "2x2": 58, "3x3": 76, "4x4": 96 }[size] || 76;
  const toggle = (k) => setContent(c => ({ ...c, [k]: !c[k] }));
  // QR เก็บ URL หน้าสถานะ → สแกนด้วยมือถือเปิดดูสถานะอุปกรณ์ได้เลย
  const qrURL = (tag) => location.origin + location.pathname + "?d=" + encodeURIComponent(tag);

  const stickerHTML = (d, px) => `
    <div style="border:1px solid #e3e3e3;border-radius:6px;padding:6px;display:flex;flex-direction:column;align-items:center;gap:3px;background:#fff">
      ${content.logo ? `<div style="display:flex;align-items:center;gap:3px;justify-content:center"><span style="font-size:8px;font-weight:700;color:#1488bd">โรงเรียนหนองหงส์พิทยาคม</span></div>` : ""}
      ${content.qr ? qrSVGString(qrURL(d.assetTag), px) : ""}
      ${content.asset ? `<div style="font-size:9px;font-weight:700;color:#16242e">${d.assetTag}</div>` : ""}
      ${content.code ? `<div style="font-size:7px;color:#7e8f9c">${d.code}</div>` : ""}
    </div>`;

  const doPrint = () => {
    if (!devices.length) { toast("ยังไม่มีอุปกรณ์ในระบบ", "alert"); return; }
    const cells = devices.map(d => stickerHTML(d, sizePx)).join("");  // พิมพ์ครบทุกเครื่อง
    const html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>สติกเกอร์ครุภัณฑ์ NHP</title>
      <style>@page{size:A4;margin:10mm} body{margin:0;font-family:sans-serif}
      .grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px}
      .btnbar{position:fixed;top:12px;right:12px} .btnbar button{background:#1aa6e0;color:#fff;border:0;padding:10px 18px;border-radius:9px;font-weight:600;cursor:pointer;font-family:sans-serif}
      @media print{.btnbar{display:none}}</style></head>
      <body><div class="btnbar"><button onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button></div>
      <div class="grid">${cells}</div>
      <script>setTimeout(function(){window.print();},500);<\/script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); logAction("พิมพ์สติกเกอร์", "พิมพ์สติกเกอร์ครุภัณฑ์ " + devices.length + " ดวง", "b-info", "ผู้ดูแลระบบ", "qr"); toast("เปิดหน้าพิมพ์สติกเกอร์ " + devices.length + " ดวง"); }
    else {
      const blob = new Blob([html], { type: "text/html" }); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "สติกเกอร์ครุภัณฑ์.html"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500); toast("ดาวน์โหลดไฟล์สติกเกอร์");
    }
  };

  const doPNG = async () => {
    const cell = { "2x2": 96, "3x3": 120, "4x4": 150 }[size] || 120;
    const pad = 14, gap = 10;
    const rows = Math.ceil(sample.length / cols);
    const cw = cell, ch = cell + (content.logo ? 16 : 0) + (content.asset ? 16 : 0) + (content.code ? 12 : 0) + 14;
    const W = pad * 2 + cols * cw + (cols - 1) * gap;
    const H = pad * 2 + rows * ch + (rows - 1) * gap;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    sample.forEach((d, i) => {
      const cx = pad + (i % cols) * (cw + gap);
      const cy = pad + Math.floor(i / cols) * (ch + gap);
      ctx.strokeStyle = "#e3e3e3"; ctx.lineWidth = 1;
      ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);
      let y = cy + 8;
      if (content.logo) { ctx.fillStyle = "#1488bd"; ctx.font = "700 8px sans-serif"; ctx.textAlign = "center"; ctx.fillText("โรงเรียนหนองหงส์พิทยาคม", cx + cw / 2, y + 6); y += 16; }
      if (content.qr) { const q = cell - 16; drawQR(ctx, qrURL(d.assetTag), cx + (cw - q) / 2, y, q); y += q + 4; }
      if (content.asset) { ctx.fillStyle = "#16242e"; ctx.font = "700 11px sans-serif"; ctx.textAlign = "center"; ctx.fillText(d.assetTag, cx + cw / 2, y + 8); y += 15; }
      if (content.code) { ctx.fillStyle = "#7e8f9c"; ctx.font = "8px sans-serif"; ctx.textAlign = "center"; ctx.fillText(d.code, cx + cw / 2, y + 6); }
    });
    cv.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "สติกเกอร์ครุภัณฑ์_NHP.png"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast("บันทึกสติกเกอร์เป็น PNG แล้ว");
    }, "image/png");
  };

  return (
    <div>
      <PageHead crumb={["QR Code & สติกเกอร์"]} title="พิมพ์สติกเกอร์ครุภัณฑ์" desc="สร้าง QR Code และสติกเกอร์สำหรับติดอุปกรณ์"
        actions={<>
          <button className="btn" onClick={doPNG}><Icon name="download" size={17} />PNG</button>
          <button className="btn btn-primary" onClick={doPrint}><Icon name="print" size={17} />พิมพ์ / PDF</button>
        </>} />

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }} className="qr-row">
        <div className="card" style={{ alignSelf: "start", position: "sticky", top: 84 }}>
          <div className="card-head"><h3>ตั้งค่าการพิมพ์</h3></div>
          <div className="card-pad">
            <div className="field"><label>จำนวนต่อหน้า</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[20, 30, 40, 50].map(n => (
                  <button key={n} className={"btn btn-sm" + (perPage === n ? " btn-primary" : "")} onClick={() => setPerPage(n)}>{n} ดวง</button>
                ))}
              </div>
            </div>
            <div className="field"><label>ขนาดสติกเกอร์</label>
              <div className="seg" style={{ display: "flex" }}>
                {["2x2", "3x3", "4x4"].map(s => <button key={s} className={size === s ? "on" : ""} style={{ flex: 1 }} onClick={() => setSize(s)}>{s} ซม.</button>)}
              </div>
            </div>
            <div className="field"><label>เนื้อหาบนสติกเกอร์</label>
              {[["logo", "โลโก้โรงเรียน"], ["qr", "QR Code"], ["asset", "Asset Tag"], ["code", "รหัสครุภัณฑ์"]].map(([k, l]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 400, marginBottom: 8, fontSize: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={content[k]} onChange={() => toggle(k)} style={{ width: 17, height: 17, accentColor: "var(--primary)" }} />{l}
                </label>
              ))}
            </div>
            <hr className="hr" />
            <div style={{ fontSize: 13, color: "var(--text-3)" }}>อุปกรณ์ทั้งหมด <b className="num" style={{ color: "var(--text)" }}>{devices.length}</b> เครื่อง · ขนาด {size} ซม.</div>
            <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 4 }}>กด “พิมพ์ / PDF” เพื่อพิมพ์สติกเกอร์ครบทุกเครื่อง</div>
          </div>
        </div>

        <div className="card card-pad" style={{ background: "var(--surface-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: "var(--text-3)", fontSize: 13, flexWrap: "wrap" }}>
            <Icon name="eye" size={16} />ตัวอย่างก่อนพิมพ์ — กระดาษ A4 · {sample.length} ดวง
            <div className="spacer" style={{ flex: 1 }}></div>
            <button className="btn btn-sm" disabled={curPage <= 0} onClick={() => setPage(p => Math.max(0, p - 1))}><Icon name="chevL" size={15} /></button>
            <span className="num" style={{ minWidth: 90, textAlign: "center" }}>หน้า {curPage + 1} / {totalPages}</span>
            <button className="btn btn-sm" disabled={curPage >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}><Icon name="chevR" size={15} /></button>
          </div>
          <div style={{ background: "#fff", borderRadius: 8, padding: 18, boxShadow: "var(--shadow)", margin: "0 auto", maxWidth: 640 }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 8 }}>
              {sample.map(d => (
                <div key={d.id} style={{ border: "1px solid #e3e3e3", borderRadius: 6, padding: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "#fff" }}>
                  {content.logo && <div style={{ display: "flex", alignItems: "center", gap: 3, width: "100%", justifyContent: "center" }}>
                    <img src="assets/logo.png" style={{ width: 13, height: 13 }} alt="" />
                    <span style={{ fontSize: 7, fontWeight: 700, color: "#1488bd" }}>นหพ.</span>
                  </div>}
                  {content.qr && <QR value={qrURL(d.assetTag)} size={sizePx} />}
                  {content.asset && <div style={{ fontSize: 8, fontWeight: 700, color: "#16242e", fontFamily: "Sora, sans-serif" }}>{d.assetTag}</div>}
                  {content.code && <div style={{ fontSize: 6.5, color: "#7e8f9c", fontFamily: "Sora, sans-serif" }}>{d.code}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.QRStickers = QRStickers;
