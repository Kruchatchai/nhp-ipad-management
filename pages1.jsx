/* ===== Dashboard + Devices ===== */
const D = window.NHP;

function StatCard({ icon, value, label, color, soft, trend, onClick, sub }) {
  const n = useCountUp(typeof value === "number" ? value : 0);
  const display = typeof value === "number" ? n.toLocaleString() : value;
  return (
    <div className="stat" onClick={onClick} style={onClick ? { cursor: "pointer", "--sc": color } : { "--sc": color }}>
      <div className="stat-wm" style={{ color }}><Icon name={icon} size={86} /></div>
      <div className="stat-top">
        <div className="stat-ic" style={{ background: soft, color }}><Icon name={icon} size={22} /></div>
        {trend && <span className="stat-trend" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
          <Icon name="trendUp" size={13} />{trend}</span>}
      </div>
      <div className="stat-val num">{display}</div>
      <div className="stat-label">{label}</div>
      {sub != null && sub.value > 0 && (
        <div style={{ marginTop: 7, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "var(--warn)", background: "var(--warn-soft)", padding: "3px 9px", borderRadius: 999, position: "relative", zIndex: 1 }}>
          <Icon name="repair" size={12} />{sub.label} <span className="num">{sub.value}</span> เครื่อง
        </div>
      )}
    </div>
  );
}

/* per-device-type breakdown table for the dashboard */
function TypeBreakdown({ ipads, accessories, borrows, accStatus, go }) {
  const cnt = (st) => ipads.filter(d => d.status === st).length;
  // accessories handed out via active borrows
  const accOut = {};
  borrows.forEach(b => (b.accessories || []).forEach(a => { accOut[a.id] = (accOut[a.id] || 0) + a.qty; }));
  const ipadRow = {
    label: "iPad", icon: "tablet", color: "var(--brand-sky)", isIpad: true,
    total: ipads.length, avail: cnt("พร้อมใช้งาน"), borrowed: borrows.length,
    broken: cnt("ชำรุด"), lost: cnt("สูญหาย"),
  };
  const accColors = ["var(--accent)", "var(--purple)", "var(--ok)", "var(--info)", "var(--brand-sky-700)", "var(--warn)"];
  const accRows = accessories.map((a, i) => {
    const dmg = (accStatus && accStatus[a.id]) ? accStatus[a.id].damaged : 0;
    const lost = (accStatus && accStatus[a.id]) ? accStatus[a.id].lost : 0;
    return {
      label: a.name, icon: "layers", color: accColors[i % accColors.length], isIpad: false,
      total: a.qty + (accOut[a.id] || 0) + dmg + lost, avail: a.qty, borrowed: accOut[a.id] || 0,
      broken: dmg, lost: lost,
    };
  });
  const rows = [ipadRow, ...accRows];
  const cell = (v, color) => v == null ? <span style={{ color: "var(--text-3)" }}>—</span> : <span className="num" style={{ fontWeight: v > 0 ? 700 : 400, color: v > 0 ? color : "var(--text-3)" }}>{v}</span>;
  const cols = [
    { k: "avail", label: "พร้อมใช้งาน", aLabel: "คงคลัง", color: "var(--ok)" },
    { k: "borrowed", label: "ถูกยืม", aLabel: "จ่ายออก", color: "var(--info)" },
    { k: "broken", label: "ชำรุด", color: "var(--danger)" },
    { k: "lost", label: "สูญหาย", color: "var(--muted)" },
  ];
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="tbl type-breakdown" style={{ width: "100%", minWidth: 640 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>ประเภทอุปกรณ์</th>
            <th style={{ textAlign: "right" }}>ทั้งหมด</th>
            {cols.map(c => <th key={c.k} style={{ textAlign: "right" }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.isIpad ? "row-click" : ""} onClick={r.isIpad ? () => go && go("devices") : undefined} style={{ cursor: r.isIpad ? "pointer" : "default" }}>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: r.color, opacity: r.isIpad ? 1 : 0.85, display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}><Icon name={r.icon} size={15} /></span>
                  <span style={{ fontWeight: r.isIpad ? 700 : 500 }}>{r.label}</span>
                </div>
              </td>
              <td style={{ textAlign: "right" }}><span className="num" style={{ fontWeight: 700 }}>{r.total}</span></td>
              {cols.map(c => <td key={c.k} style={{ textAlign: "right" }}>{cell(r[c.k], c.color)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
        <Icon name="alert" size={13} /><span>อุปกรณ์เสริม: คอลัมน์ “พร้อมใช้งาน” = คงคลัง · “ถูกยืม” = จ่ายออกพร้อมเครื่องที่ยืม</span>
      </div>
    </div>
  );
}
window.TypeBreakdown = TypeBreakdown;

function Dashboard({ go }) {
  const toast = React.useContext(ToastCtx);
  const [store] = useStore();
  const ipads = store.ipads;
  const borrowedIds = new Set(store.borrows.map(b => b.deviceId));
  const cnt = (st) => ipads.filter(d => d.status === st).length;
  // devices currently being repaired = active iPad repair tickets (รอดำเนินการ + กำลังซ่อม) — matches the repair board
  const inRepair = useMemo(() =>
    store.repairs.filter(r => r.status === "รอดำเนินการ" || r.status === "กำลังซ่อม").length,
  [store.repairs]);
  // ===== ยืม–คืนรายเดือน: คำนวณจากข้อมูลจริงในระบบ =====
  const MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const monthly = useMemo(() => {
    const borrow = Array(12).fill(0), ret = Array(12).fill(0);
    const mi = (iso) => { const d = window.parseISO(iso); return d ? d.getMonth() : -1; };
    store.borrows.forEach(b => { const m = mi(b.borrowDate); if (m >= 0) borrow[m]++; });
    (store.returnLog || []).forEach(r => { const m = mi(r.date); if (m >= 0) ret[m]++; });
    return { borrow, ret };
  }, [store.borrows, store.returnLog]);
  const s = {
    totalDevices: ipads.length,
    available: cnt("พร้อมใช้งาน"),
    borrowed: store.borrows.length,
    broken: cnt("ชำรุด"),
    lost: cnt("สูญหาย"),
    students: store.students.length,
    teachers: store.teachers.length,
    overdue: store.borrows.filter(b => b.overdueDays > 0).length,
    returned: store.returnLog.length,
  };
  const accUnits = store.accessories.reduce((sum, a) => sum + a.qty, 0);
  const accInRepair = (store.accRepairs || []).filter(r => r.status === "รอดำเนินการ" || r.status === "กำลังซ่อม").length;
  const statusData = [
    { label: "พร้อมใช้งาน", value: s.available, color: "#19d36b" },
    { label: "ถูกยืม", value: s.borrowed, color: "#2e8bff" },
    { label: "ชำรุด / ซ่อม", value: s.broken, color: "#ff3b5c" },
    { label: "สูญหาย", value: s.lost, color: "#ffb020" },
  ];
  // percentages that always sum to exactly 100% (largest-remainder method)
  (() => {
    const tot = statusData.reduce((a, d) => a + d.value, 0) || 1;
    const raw = statusData.map(d => d.value / tot * 100);
    const floor = raw.map(Math.floor);
    let rem = 100 - floor.reduce((a, b) => a + b, 0);
    const order = raw.map((v, i) => ({ i, frac: v - floor[i] })).sort((a, b) => b.frac - a.frac);
    statusData.forEach((d, i) => { d.pct = floor[i]; });
    for (let k = 0; k < rem; k++) statusData[order[k % order.length].i].pct += 1;
  })();
  const accColors = ["var(--accent)", "var(--purple)", "var(--ok)", "var(--info)", "var(--brand-sky-700)", "var(--warn)"];
  const typeData = [
    { label: "iPad", value: ipads.length, color: "var(--brand-sky)" },
    ...store.accessories.map((a, i) => ({ label: a.name, value: a.qty, color: accColors[i % accColors.length] })),
  ];
  const levelData = D.levels.map(lv => ({ level: lv, count: store.students.filter(st => st.level === lv).length }))
    .map(l => ({ label: l.level, value: l.count, color: "var(--brand-sky)" }));

  const exportSummary = () => {
    const rows = [
      ["iPad ทั้งหมด", s.totalDevices], ["พร้อมใช้งาน", s.available], ["ถูกยืม", s.borrowed],
      ["ชำรุด / ซ่อม", s.broken], ["สูญหาย", s.lost],
      ["อุปกรณ์เสริม (ชิ้น)", accUnits],
      ["นักเรียนทั้งหมด", s.students], ["ครู/บุคลากร", s.teachers], ["อุปกรณ์ค้างส่ง", s.overdue],
      ["", ""], ["อุปกรณ์เสริมคงคลัง", ""],
      ...store.accessories.map(a => [a.name, a.qty + " ชิ้น"]),
    ];
    exportExcel("สรุปภาพรวม_NHP_2569", ["รายการ", "ค่า"], rows);
    logAction("ส่งออกรายงาน", "สรุปภาพรวมระบบ", "b-purple");
    toast("ส่งออกสรุปภาพรวมเป็น Excel แล้ว");
  };

  return (
    <div>
      <PageHead crumb={["หน้าหลัก"]} title="ภาพรวมระบบ"
        desc={`ปีการศึกษา ${store.year} · ภาคเรียนที่ 1 · ข้อมูล ณ ${window.todayTH()}`}
        actions={<>
          <button className="btn" onClick={exportSummary}><Icon name="download" size={17} />ส่งออกสรุป</button>
          <button className="btn btn-primary" onClick={() => go("borrow")}><Icon name="plus" size={17} />ทำรายการยืม</button>
        </>} />

      {s.overdue > 0 && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", marginBottom: 18, display: "flex", alignItems: "center", gap: 16, padding: "15px 20px" }}>
          <div className="stat-ic" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}><Icon name="alert" size={22} /></div>
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 15 }}>มีอุปกรณ์ค้างส่งเกินกำหนด {s.overdue} เครื่อง</b>
            <div style={{ color: "var(--text-3)", fontSize: 13.5 }}>ควรติดตามผู้ยืมเพื่อนำอุปกรณ์กลับคืนโดยเร็ว</div>
          </div>
          <button className="btn btn-sm" onClick={() => go("overdue")}>ดูรายการ <Icon name="chevR" size={15} /></button>
        </div>
      )}

      <div className="dash-groups">
        {/* กลุ่ม 1 — iPad */}
        <div className="dash-group" style={{ "--gc": "var(--brand-sky)" }}>
          <div className="dash-group-head"><span className="dash-group-ic" style={{ background: "var(--primary-soft)", color: "var(--brand-sky)" }}><Icon name="box" size={16} /></span>เครื่อง iPad<span className="dash-group-tot num">{s.totalDevices} เครื่อง</span></div>
          <div className="dash-group-cards">
            <StatCard icon="check2" value={s.available} label="พร้อมใช้งาน" color="var(--ok)" soft="var(--ok-soft)" onClick={() => go("devices", { statusF: "พร้อมใช้งาน" })} />
            <StatCard icon="borrow" value={s.borrowed} label="ถูกยืม" color="var(--info)" soft="var(--info-soft)" onClick={() => go("overdue")} />
            <StatCard icon="alert" value={s.broken} label="ชำรุด" color="var(--danger)" soft="var(--danger-soft)" onClick={() => go("devices", { statusF: "ชำรุด" })} sub={{ label: "กำลังส่งซ่อม", value: inRepair }} />
            <StatCard icon="search" value={s.lost} label="สูญหาย" color="var(--muted)" soft="var(--surface-3)" onClick={() => go("devices", { statusF: "สูญหาย" })} />
          </div>
        </div>

        {/* กลุ่ม 2 — การยืม–คืน */}
        <div className="dash-group" style={{ "--gc": "var(--ok)" }}>
          <div className="dash-group-head"><span className="dash-group-ic" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}><Icon name="swap" size={16} /></span>การยืม–คืน</div>
          <div className="dash-group-cards">
            <StatCard icon="swap" value={s.returned} label="คืนแล้ว" color="var(--ok)" soft="var(--ok-soft)" onClick={() => go("registry")} />
            <StatCard icon="overdue" value={s.overdue} label="ค้างส่ง" color="var(--danger)" soft="var(--danger-soft)" onClick={() => go("overdue")} />
          </div>
        </div>

        {/* กลุ่ม 3 — อุปกรณ์เสริม */}
        <div className="dash-group" style={{ "--gc": "var(--accent)" }}>
          <div className="dash-group-head"><span className="dash-group-ic" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Icon name="layers" size={16} /></span>อุปกรณ์เสริม<span className="dash-group-tot num">{accUnits} ชิ้น{accInRepair ? " · ส่งซ่อม " + accInRepair : ""}</span></div>
          <div className="acc-list" onClick={() => go("devices")} style={{ cursor: "pointer" }}>
            {(() => {
              const out = {}; store.borrows.forEach(b => (b.accessories || []).forEach(a => { out[a.id] = (out[a.id] || 0) + a.qty; }));
              return store.accessories.map(a => {
                const o = out[a.id] || 0;
                const ss = (store.accStatus && store.accStatus[a.id]) || { damaged: 0, lost: 0 };
                const total = a.qty + o + ss.damaged + ss.lost;
                return (
                  <div key={a.id} className="acc-list-row">
                    <span className="acc-list-ic"><Icon name="layers" size={14} /></span>
                    <span className="acc-list-name">{a.name}</span>
                    <span className="acc-list-pills">
                      <span className="acc-pill" style={{ color: "var(--info)" }} title="ถูกยืม"><Icon name="borrow" size={11} />{o}</span>
                      {ss.damaged > 0 && <span className="acc-pill" style={{ color: "var(--danger)" }} title="ชำรุด"><Icon name="alert" size={11} />{ss.damaged}</span>}
                      {ss.lost > 0 && <span className="acc-pill" style={{ color: "var(--muted)" }} title="สูญหาย"><Icon name="search" size={11} />{ss.lost}</span>}
                    </span>
                    <span className="acc-list-stock"><b className="num">{a.qty}</b><span className="acc-list-stock-lbl">/ {total} คงเหลือ</span></span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* กลุ่ม 4 — บุคคล */}
        <div className="dash-group" style={{ "--gc": "var(--purple)" }}>
          <div className="dash-group-head"><span className="dash-group-ic" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}><Icon name="students" size={16} /></span>บุคคล</div>
          <div className="dash-group-cards">
            <StatCard icon="students" value={s.students} label="นักเรียน" color="var(--purple)" soft="var(--purple-soft)" onClick={() => go("students")} />
            <StatCard icon="teacher" value={s.teachers} label="ครู / บุคลากร" color="var(--info)" soft="var(--info-soft)" onClick={() => go("teachers")} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 18, marginBottom: 18 }} className="dash-row">
        <div className="card">
          <div className="card-head">
            <div><h3>การยืม–คืนรายเดือน</h3><div className="sub">ปีการศึกษา {store.year}</div></div>
            <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "var(--primary)" }}></span>ยืม</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "var(--accent)" }}></span>คืน</span>
            </div>
          </div>
          <div className="card-pad">
            <BarLineChart labels={MONTH_LABELS} series={[{ data: monthly.borrow }, { data: monthly.ret }]} />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>สถานะอุปกรณ์</h3><div className="sub">เลื่อนเมาส์เพื่อดูรายละเอียด</div></div>
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <Donut data={statusData} center={<div><div className="num" style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-.02em" }}>{s.totalDevices}</div><div style={{ fontSize: 12, color: "var(--text-3)" }}>เครื่องทั้งหมด</div></div>} />
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
              {statusData.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, padding: "5px 0" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }}></span>
                  <span style={{ flex: 1, color: "var(--text-2)" }}>{d.label}</span>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }} className="num">{d.pct}%</span>
                  <span className="num" style={{ fontWeight: 700, minWidth: 32, textAlign: "right" }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {window.StatusLookup && <div style={{ marginBottom: 18 }}>{React.createElement(window.StatusLookup, { go })}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><div><h3>ตามประเภทอุปกรณ์</h3><div className="sub">จำนวนพร้อมใช้งาน · ถูกยืม · ชำรุด · สูญหาย แยกตามประเภท</div></div><span className="badge b-info" style={{ alignSelf: "center" }}>iPad & อุปกรณ์เสริม</span></div>
        <div className="card-pad"><TypeBreakdown ipads={ipads} accessories={store.accessories} borrows={store.borrows} accStatus={store.accStatus} go={go} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 18 }} className="dash-row">
        <div className="card">
          <div className="card-head"><h3>นักเรียนแต่ละชั้น</h3></div>
          <div className="card-pad"><HBars data={levelData} color="var(--accent)" /></div>
        </div>
        <div className="card">
          <div className="card-head"><h3>กิจกรรมล่าสุด</h3><a className="sub" style={{ color: "var(--primary)", cursor: "pointer", fontWeight: 600 }} onClick={() => go("audit")}>ดูทั้งหมด</a></div>
          <div style={{ padding: "6px 0" }}>
            {store.audit.slice(0, 5).map(a => (
              <div key={a.id} onClick={() => a.nav && go(a.nav)} className={a.nav ? "row-click" : ""}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 22px", cursor: a.nav ? "pointer" : "default", borderRadius: 8 }}>
                <Badge cls={a.cls}>{a.action}</Badge>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="clip" style={{ fontSize: 13.5, fontWeight: 500 }}>{a.detail}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>{a.user} · {a.time}</div>
                </div>
                {a.nav && <Icon name="chevR" size={15} style={{ color: "var(--text-3)", flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
window.Dashboard = Dashboard;

/* ===== Devices ===== */
function findHolder(name) {
  if (!name) return null;
  const st = window.Store.snapshot();
  const all = [...st.students.map(p => ({ p, k: "s" })), ...st.teachers.map(p => ({ p, k: "t" }))];
  const hit = all.find(({ p }) => name.includes(p.first) && name.includes(p.last));
  if (!hit) return { photo: null, sex: name.includes("หญิง") ? "หญิง" : "ชาย", first: name };
  return { photo: st.photos[hit.k + ":" + hit.p.id] || null, sex: hit.p.sex, first: hit.p.first, person: hit.p };
}

function DeviceDetail({ device: deviceProp, onClose, go, onEdit, toast }) {
  const [store, setStore] = useStore();
  // always read the live record so status changes reflect instantly
  const device = store.ipads.find(d => d.id === deviceProp.id) || deviceProp;
  const holder = device.holder ? findHolder(device.holder) : null;
  // accessories actually handed over (live from the active borrow record) take priority
  const activeBorrow = store.borrows.find(b => b.deviceId === device.id || b.device === device.assetTag);
  const accList = (activeBorrow && activeBorrow.accessories && activeBorrow.accessories.length)
    ? activeBorrow.accessories : (device.accessories || []);
  // manual status change — available for any device NOT on loan; ส่งซ่อม is workflow-driven (via แจ้งซ่อม → ชำรุด)
  const manualStatuses = D.statuses.filter(s => s.k !== "ถูกยืม" && s.k !== "ส่งซ่อม");
  const changeStatus = (k) => {
    const st = D.statuses.find(s => s.k === k);
    setStore(state => {
      let repairs = state.repairs;
      if (k === "พร้อมใช้งาน" || k === "สูญหาย") {
        // device resolved/lost → close any active repair tickets for it
        repairs = state.repairs.map(r => (r.device === device.assetTag && (r.status === "รอดำเนินการ" || r.status === "กำลังซ่อม"))
          ? { ...r, status: "ซ่อมเสร็จ", statusCls: "b-ok" } : r);
      } else if (k === "ชำรุด" && !state.repairs.some(r => r.device === device.assetTag && (r.status === "รอดำเนินการ" || r.status === "กำลังซ่อม"))) {
        // flagged broken with no open ticket → open one so it appears on the repair board
        const n = (state.repairs || []).length + 1;
        repairs = [{ id: Date.now() + Math.random(), ticket: "RP-" + String(n).padStart(4, "0"), device: device.assetTag, model: device.model, type: "แจ้งชำรุดจากคลัง", reporter: "ผู้ดูแลระบบ", date: window.todayISO(), status: "รอดำเนินการ", statusCls: "b-warn", detail: "เปลี่ยนสถานะเป็นชำรุดจากหน้าจัดการอุปกรณ์", photos: [] }, ...state.repairs];
      }
      return {
        ipads: state.ipads.map(d => d.id === device.id ? { ...d, status: k, statusCls: st.cls } : d),
        repairs,
      };
    });
    logAction("เปลี่ยนสถานะอุปกรณ์", device.assetTag + " · " + device.status + " → " + k, "b-warn", "ผู้ดูแลระบบ", "devices");
    toast && toast(device.assetTag + " เปลี่ยนสถานะเป็น “" + k + "” — ซิงค์งานซ่อมทั้งระบบแล้ว", "swap");
  };
  return (
    <Drawer title="รายละเอียดอุปกรณ์" onClose={onClose}
      footer={<>
        <button className="btn" onClick={() => { onClose(); go("timeline"); }}><Icon name="history" size={16} />ดูประวัติ</button>
        <button className="btn btn-primary" onClick={() => { onClose(); onEdit && onEdit(device); }}><Icon name="edit" size={16} />แก้ไข</button>
      </>}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
        <div style={{ width: 88, height: 88, borderRadius: 16, background: "var(--primary-soft)", display: "grid", placeItems: "center", color: "var(--primary)", flexShrink: 0 }}>
          <Icon name={device.type === "ipad" ? "tablet" : device.type === "camera" ? "camera" : device.type === "projector" ? "projector" : "laptop"} size={40} stroke={1.5} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>{device.typeName} · {device.brand}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{device.model}</div>
          <div className="num" style={{ color: "var(--text-2)", marginTop: 2 }}>{device.assetTag}</div>
          <div style={{ marginTop: 8 }}><Badge cls={device.statusCls} dot>{device.status}</Badge></div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <div className="card card-pad" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <QR value={device.assetTag} size={96} />
          <div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>สแกนเพื่อดูข้อมูล</div>
            <div className="num" style={{ fontWeight: 700, fontSize: 15 }}>{device.assetTag}</div>
            <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => { printSticker(device); toast && toast("เปิดหน้าพิมพ์สติกเกอร์ " + device.assetTag); }}><Icon name="print" size={14} />พิมพ์สติกเกอร์</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">รหัสครุภัณฑ์</span><span className="v num">{device.code}</span></div>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">Serial Number</span><span className="v num">{device.serial}</span></div>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">สี / ความจุ</span><span className="v">{device.color} · {device.cap}</span></div>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">ปีงบประมาณ</span><span className="v num">{device.budgetYear}</span></div>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">วันที่รับเข้า</span><span className="v num">{device.receivedDate}</span></div>
        {device.holder && <div className="kv" style={{ padding: "11px 16px" }}><span className="k">ผู้ถือครองปัจจุบัน</span><span className="v">{device.holder} ({device.holderLevel})</span></div>}
      </div>

      {!device.holder && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 9, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="swap" size={16} style={{ color: "var(--info)" }} />เปลี่ยนสถานะอุปกรณ์
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {manualStatuses.map(s => {
              const on = device.status === s.k;
              return (
                <button key={s.k} onClick={() => !on && changeStatus(s.k)} disabled={on}
                  className={"badge " + s.cls} style={{ cursor: on ? "default" : "pointer", border: on ? "2px solid currentColor" : "1px solid transparent", fontWeight: 600, fontSize: 13, padding: "7px 13px", opacity: on ? 1 : 0.78 }}>
                  {on && <Icon name="check" size={13} style={{ marginRight: 4, verticalAlign: -2 }} />}{s.k}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>เปลี่ยนสถานะที่นี่จะอัปเดตคลังอุปกรณ์ · ภาพรวมระบบ · รายงาน ทั้งหมดทันที (สถานะ “ถูกยืม” เปลี่ยนผ่านหน้ายืม–คืน)</div>
        </div>
      )}

      {device.holder && (
        <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
          {holder && holder.photo
            ? <img src={holder.photo} alt="" style={{ width: 58, height: 58, borderRadius: 13, objectFit: "cover", flexShrink: 0 }} />
            : <div className={"avatar" + (holder && holder.sex === "หญิง" ? " orange" : "")} style={{ width: 58, height: 58, fontSize: 22, borderRadius: 13, flexShrink: 0 }}>{initials((device.holder || "").replace(/^(เด็กชาย|เด็กหญิง|นางสาว|นาย|นาง|ครู)/, ""))}</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>ผู้ใช้งานปัจจุบัน</div>
            <div style={{ fontWeight: 700 }}>{device.holder}</div>
            <div style={{ fontSize: 13, color: "var(--text-2)" }}>{device.holderLevel}</div>
          </div>
        </div>
      )}

      <div style={{ fontWeight: 700, fontSize: 15, margin: "20px 0 11px", display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="layers" size={17} style={{ color: "var(--accent)" }} />อุปกรณ์เสริม
        {activeBorrow && accList.length > 0 && <span className="badge b-info" style={{ fontWeight: 600 }}>ส่งมอบตอนยืม</span>}
        <span className="badge b-muted num" style={{ marginLeft: "auto" }}>{accList.reduce((s, a) => s + a.qty, 0)} ชิ้น</span>
      </div>
      {accList.length > 0 ? (
        <div className="card">
          {accList.map((a, i) => (
            <div key={i} className="kv" style={{ padding: "11px 16px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}><Icon name="check2" size={15} style={{ color: "var(--ok)" }} />{a.name}</span>
              <span className="v num">× {a.qty}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card card-pad" style={{ padding: 16, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>{activeBorrow ? "ไม่มีอุปกรณ์เสริมที่ส่งมอบ" : "ไม่มีอุปกรณ์เสริมที่ลงทะเบียนไว้"}</div>
      )}
    </Drawer>
  );
}

function Devices({ go, intent }) {
  const toast = React.useContext(ToastCtx);
  const [store, setStore] = useStore();
  const list = store.ipads;
  const setList = (v) => setStore(st => ({ ipads: typeof v === "function" ? v(st.ipads) : v }));
  const accStock = store.accessories;
  const accOutMap = (() => { const m = {}; store.borrows.forEach(b => (b.accessories || []).forEach(a => { m[a.id] = (m[a.id] || 0) + a.qty; })); return m; })();
  const setAccStock = (v) => setStore(st => ({ accessories: typeof v === "function" ? v(st.accessories) : v }));
  const [invTab, setInvTab] = useState("ipad");
  const [accModal, setAccModal] = useState(null);
  const accForm = useRef({});
  const [accTotalInput, setAccTotalInput] = useState(0);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  useEffect(() => { if (intent && intent.statusF) setStatus(intent.statusF); }, [intent]);
  const [sel, setSel] = useState(null);
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState(null);
  const editForm = useRef({});
  const [del, setDel] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [bulkDel, setBulkDel] = useState(false);
  const [page, setPage] = useState(1);
  const per = 12;

  const devHeaders = ["Asset Tag", "รหัสครุภัณฑ์", "Serial Number", "ประเภท", "ยี่ห้อ", "รุ่น", "สี", "ความจุ", "ปีงบประมาณ", "วันที่รับเข้า", "สถานะ", "ผู้ถือครอง"];
  const devSample = ["NHP-IPD-200", "7440-001-0200", "F9XABC123", "iPad", "Apple", "iPad A16", "Silver", "128GB", "2569", window.todayISO(), "พร้อมใช้งาน", "-"];
  const doExport = () => {
    exportExcel("คลังอุปกรณ์_NHP_2569", devHeaders, list.map(d => [d.assetTag, d.code, d.serial, d.typeName, d.brand, d.model, d.color, d.cap, d.budgetYear, d.receivedDate, d.status, d.holder || "-"]));
    toast("ส่งออก " + list.length + " รายการเป็น Excel");
  };

  const filtered = list.filter(d =>
    (type === "all" || d.type === type) &&
    (status === "all" || d.status === status) &&
    (q === "" || (d.assetTag + d.model + d.serial + (d.holder || "")).toLowerCase().includes(q.toLowerCase()))
  );
  const pages = Math.ceil(filtered.length / per);
  const shown = filtered.slice((page - 1) * per, page * per);
  useEffect(() => setPage(1), [q, type, status]);

  const toggleSel = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const allShownSelected = shown.length > 0 && shown.every(d => selected.includes(d.id));
  const toggleAllShown = () => setSelected(s => allShownSelected ? s.filter(id => !shown.some(d => d.id === id)) : [...new Set([...s, ...shown.map(d => d.id)])]);
  const doBulkDelete = () => {
    const ids = new Set(selected);
    const tags = new Set(list.filter(d => ids.has(d.id)).map(d => d.assetTag));
    setStore(st => ({
      ipads: st.ipads.filter(d => !ids.has(d.id)),
      borrows: st.borrows.filter(b => !tags.has(b.device) && !ids.has(b.deviceId)),
      repairs: st.repairs.filter(r => !tags.has(r.device)),
      returnLog: st.returnLog.map(r => ({ ...r, items: (r.items || []).filter(it => !tags.has(it.assetTag)) })).filter(r => (r.items || []).length > 0),
      deviceEvents: (() => { const e = { ...st.deviceEvents }; tags.forEach(t => delete e[t]); return e; })(),
    }));
    logAction("ลบรายการ", "ลบอุปกรณ์ " + selected.length + " รายการออกจากระบบทั้งหมด", "b-danger", "ผู้ดูแลระบบ", "devices");
    toast("ลบอุปกรณ์ " + selected.length + " รายการแล้ว — ซิงค์ออกจากทุกระบบ", "trash");
    setSelected([]); setBulkDel(false);
  };

  const committedOf = (a) => (accOutMap[a.id] || 0) + (((store.accStatus && store.accStatus[a.id]) || { damaged: 0, lost: 0 }).damaged) + (((store.accStatus && store.accStatus[a.id]) || { damaged: 0, lost: 0 }).lost);
  const openAccAdd = () => { accForm.current = { name: "", note: "" }; setAccTotalInput(1); setAccModal({ mode: "add" }); };
  const openAccEdit = (a) => { accForm.current = { ...a }; setAccTotalInput(a.qty + committedOf(a)); setAccModal({ mode: "edit", id: a.id, committed: committedOf(a) }); };
  const saveAcc = () => {
    const f = accForm.current;
    if (!f.name || !f.name.trim()) { toast("กรุณาระบุชื่ออุปกรณ์เสริม", "alert"); return; }
    const total = Math.max(0, +accTotalInput || 0);
    if (accModal.mode === "add") {
      setAccStock([{ id: Date.now(), name: f.name.trim(), qty: total, note: f.note || "" }, ...accStock]);
      logAction("เพิ่มอุปกรณ์เสริม", f.name.trim() + " · " + total + " ชิ้น", "b-ok", "ผู้ดูแลระบบ", "devices");
      toast("เพิ่มอุปกรณ์เสริมแล้ว");
    } else {
      const committed = accModal.committed || 0;
      const newQty = Math.max(0, total - committed);  // remaining = total - (borrowed+damaged+lost)
      setAccStock(accStock.map(a => a.id === accModal.id ? { ...a, name: f.name.trim(), qty: newQty, note: f.note || "" } : a));
      logAction("แก้ไขอุปกรณ์เสริม", f.name.trim() + " · รวม " + total + " · คงเหลือ " + newQty, "b-warn", "ผู้ดูแลระบบ", "devices");
      toast("บันทึกการแก้ไขแล้ว — คงเหลือ " + newQty + " ชิ้น");
    }
    setAccModal(null);
  };
  const delAcc = (id) => { setAccStock(accStock.filter(a => a.id !== id)); toast("ลบอุปกรณ์เสริมแล้ว", "trash"); };
  const accTotal = accStock.reduce((s, a) => s + a.qty, 0);

  const addForm = useRef({});
  const doAdd = () => {
    const f = addForm.current;
    const t = D.deviceTypes.find(x => x.id === (f.type || "ipad"));
    const n = list.filter(d => d.type === t.id).length + 1;
    const prefix = t.id === "ipad" ? "IPD" : t.id.slice(0, 3).toUpperCase();
    const nd = {
      id: Date.now(), assetTag: f.assetTag || ("NHP-" + prefix + "-" + String(n).padStart(3, "0")),
      code: f.code || "7440-001-" + String(n).padStart(4, "0"),
      serial: (f.serial || (t.id.slice(0, 2).toUpperCase() + Math.random().toString(36).slice(2, 10).toUpperCase())),
      type: t.id, typeName: t.name, brand: f.brand || "Apple", model: f.model || t.name,
      color: f.color || "Silver", cap: f.cap || "128GB", budgetYear: +f.budgetYear || 2569,
      receivedDate: f.receivedDate || window.todayISO(), price: f.price ? +f.price : null,
      status: "พร้อมใช้งาน", statusCls: "b-ok", holder: null, holderLevel: null,
      accessories: [],
      note: f.note || "",
    };
    setList([nd, ...list]);
    setAdd(false); addForm.current = {};
    toast("เพิ่มอุปกรณ์ " + nd.assetTag + " เรียบร้อย");
  };
  const openAdd = () => {
    addForm.current = { type: "ipad", brand: "Apple", model: "iPad A16", color: "Silver", cap: "128GB", budgetYear: "2569" };
    setAdd(true);
  };
  const doDelete = () => {
    const tag = del.assetTag, id = del.id;
    setStore(st => ({
      ipads: st.ipads.filter(d => d.id !== id),
      borrows: st.borrows.filter(b => b.device !== tag && b.deviceId !== id),
      repairs: st.repairs.filter(r => r.device !== tag),
      returnLog: st.returnLog.map(r => ({ ...r, items: (r.items || []).filter(it => it.assetTag !== tag) })).filter(r => (r.items || []).length > 0),
      deviceEvents: (() => { const e = { ...st.deviceEvents }; delete e[tag]; return e; })(),
    }));
    logAction("ลบรายการ", "ลบอุปกรณ์ " + tag + " ออกจากระบบทั้งหมด", "b-danger", "ผู้ดูแลระบบ", "devices");
    toast("ลบอุปกรณ์ " + tag + " แล้ว — ซิงค์ออกจากทุกระบบ", "trash");
    setDel(null);
  };
  const openEdit = (d) => { editForm.current = { ...d }; setEdit(d); };
  const doEdit = () => {
    const f = editForm.current;
    setList(list.map(d => d.id === edit.id ? {
      ...d,
      assetTag: f.assetTag || d.assetTag, code: f.code || d.code, serial: f.serial || d.serial,
      brand: f.brand || d.brand, model: f.model || d.model, color: f.color || d.color,
      cap: f.cap || d.cap, budgetYear: +f.budgetYear || d.budgetYear,
    } : d));
    logAction("แก้ไขข้อมูล", "อุปกรณ์ " + (f.assetTag || edit.assetTag), "b-warn", "ผู้ดูแลระบบ", "devices");
    toast("บันทึกการแก้ไข " + (f.assetTag || edit.assetTag) + " แล้ว");
    setEdit(null);
  };

  return (
    <div>
      <PageHead crumb={["จัดการอุปกรณ์"]} title="คลังอุปกรณ์" desc={`เครื่อง iPad ${list.length} เครื่อง · อุปกรณ์เสริม ${accTotal} ชิ้น`}
        actions={invTab === "ipad" ? <>
          <button className="btn" onClick={() => setImportOpen(true)}><Icon name="upload" size={17} />นำเข้า Excel</button>
          <button className="btn" onClick={doExport}><Icon name="download" size={17} />ส่งออก Excel</button>
          <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={17} />เพิ่ม iPad</button>
        </> : <button className="btn btn-primary" onClick={openAccAdd}><Icon name="plus" size={17} />เพิ่มอุปกรณ์เสริม</button>} />

      <div className="tabs">
        <button className={"tab" + (invTab === "ipad" ? " on" : "")} onClick={() => setInvTab("ipad")}><Icon name="tablet" size={15} style={{ verticalAlign: -2, marginRight: 6 }} />เครื่อง iPad <span className="num" style={{ opacity: .6 }}>({list.length})</span></button>
        <button className={"tab" + (invTab === "acc" ? " on" : "")} onClick={() => setInvTab("acc")}><Icon name="layers" size={15} style={{ verticalAlign: -2, marginRight: 6 }} />อุปกรณ์เสริม <span className="num" style={{ opacity: .6 }}>({accStock.length})</span></button>
      </div>

      {invTab === "ipad" && <>
      <div className="toolbar">
        <div className="filter-input" style={{ minWidth: 280 }}>
          <Icon name="search" size={17} style={{ color: "var(--text-3)" }} />
          <input placeholder="ค้นหา Asset Tag, Serial, รุ่น, ผู้ถือครอง…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="select" style={{ width: "auto", minWidth: 150 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">ทุกสถานะ</option>
          {D.statuses.filter(s => s.k !== "ส่งซ่อม").map(s => <option key={s.k} value={s.k}>{s.k}</option>)}
        </select>
        <div className="spacer"></div>
        <span style={{ color: "var(--text-3)", fontSize: 13.5 }}>{filtered.length} เครื่อง</span>
      </div>

      {selected.length > 0 && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", marginBottom: 14, borderColor: "var(--primary)", background: "var(--primary-soft)" }}>
          <Icon name="check2" size={18} style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: 600 }}>เลือกแล้ว {selected.length} รายการ</span>
          <button className="btn btn-sm" onClick={() => setSelected([])}>ยกเลิกการเลือก</button>
          <div className="spacer" style={{ flex: 1 }}></div>
          <button className="btn btn-sm btn-danger" onClick={() => setBulkDel(true)}><Icon name="trash" size={15} />ลบที่เลือก ({selected.length})</button>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr>
              <th style={{ width: 40 }}><input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} style={{ width: 17, height: 17, accentColor: "var(--primary)" }} /></th>
              <th>Asset Tag</th><th>ประเภท / รุ่น</th><th>Serial</th><th>สถานะ</th><th>ผู้ถือครอง</th><th></th>
            </tr></thead>
            <tbody>
              {shown.map(d => (
                <tr key={d.id} className="row-click" onClick={() => setSel(d)} style={selected.includes(d.id) ? { background: "var(--primary-soft)" } : {}}>
                  <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggleSel(d.id)} style={{ width: 17, height: 17, accentColor: "var(--primary)" }} /></td>
                  <td><span className="num" style={{ fontWeight: 700 }}>{d.assetTag}</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--surface-3)", display: "grid", placeItems: "center", color: "var(--text-2)" }}>
                        <Icon name={d.type === "ipad" ? "tablet" : d.type === "camera" ? "camera" : d.type === "projector" ? "projector" : "laptop"} size={19} />
                      </div>
                      <div><div style={{ fontWeight: 600 }}>{d.model}</div><div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{d.brand} · {d.color}</div></div>
                    </div>
                  </td>
                  <td><span className="num" style={{ color: "var(--text-2)", fontSize: 13 }}>{d.serial}</span></td>
                  <td><Badge cls={d.statusCls} dot>{d.status}</Badge></td>
                  <td>{d.holder ? <span>{d.holder}<span style={{ color: "var(--text-3)" }}> · {d.holderLevel}</span></span> : <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={e => { e.stopPropagation(); setSel(d); }} title="ดูรายละเอียด"><Icon name="eye" size={15} /></button>
                      <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={e => { e.stopPropagation(); setDel(d); }} title="ลบ"><Icon name="trash" size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <Empty title="ไม่พบอุปกรณ์" sub="ลองปรับตัวกรองหรือคำค้นหา" />}
        {pages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: 13.5, color: "var(--text-3)" }}>หน้า {page} จาก {pages}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}><Icon name="chevL" size={15} />ก่อนหน้า</button>
              <button className="btn btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>ถัดไป<Icon name="chevR" size={15} /></button>
            </div>
          </div>
        )}
      </div>
      </>}

      {invTab === "acc" && (
        <div className="card">
          <div className="card-head"><div><h3>คลังอุปกรณ์เสริม</h3><div className="sub">คงคลัง · ถูกยืม · ชำรุด · สูญหาย ซิงค์กับการยืม–คืนทั้งระบบ</div></div></div>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>รายการ</th><th style={{ textAlign: "right" }}>ทั้งหมด</th><th style={{ textAlign: "right" }}>ถูกยืม</th><th style={{ textAlign: "right" }}>ชำรุด</th><th style={{ textAlign: "right" }}>สูญหาย</th><th style={{ textAlign: "right" }}>คงเหลือ</th><th></th></tr></thead>
              <tbody>
                {accStock.map(a => {
                  const out = accOutMap[a.id] || 0;
                  const ss = (store.accStatus && store.accStatus[a.id]) || { damaged: 0, lost: 0 };
                  const total = a.qty + out + ss.damaged + ss.lost;
                  const numCell = (v, color) => <td style={{ textAlign: "right" }}><span className="num" style={{ fontWeight: v > 0 ? 700 : 400, color: v > 0 ? color : "var(--text-3)" }}>{v}</span></td>;
                  return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}><Icon name="layers" size={18} /></div>
                        <div><div style={{ fontWeight: 600 }}>{a.name}</div>{a.note && <div style={{ fontSize: 12, color: "var(--text-3)" }}>{a.note}</div>}</div>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}><span className="num" style={{ fontWeight: 700 }}>{total}</span></td>
                    {numCell(out, "var(--info)")}
                    {numCell(ss.damaged, "var(--danger)")}
                    {numCell(ss.lost, "var(--muted)")}
                    <td style={{ textAlign: "right" }}><span className="num" style={{ fontWeight: 700, fontSize: 15, color: "var(--ok)" }}>{a.qty}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => openAccEdit(a)} title="แก้ไข"><Icon name="edit" size={15} /></button>
                        <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => delAcc(a.id)} title="ลบ"><Icon name="trash" size={15} /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {accStock.length === 0 && <Empty icon="layers" title="ยังไม่มีอุปกรณ์เสริม" sub="กด เพิ่มอุปกรณ์เสริม เพื่อเริ่มต้น" />}
        </div>
      )}

      {accModal && (
        <Modal title={accModal.mode === "add" ? "เพิ่มอุปกรณ์เสริม" : "แก้ไขอุปกรณ์เสริม"} onClose={() => setAccModal(null)}
          footer={<><button className="btn" onClick={() => setAccModal(null)}>ยกเลิก</button><button className="btn btn-primary" onClick={saveAcc}><Icon name="check" size={16} />บันทึก</button></>}>
          <div className="field"><label>ชื่ออุปกรณ์เสริม</label><input className="input" defaultValue={accForm.current.name || ""} placeholder="เช่น สายชาร์จ USB-C" onChange={e => accForm.current.name = e.target.value} /></div>
          <div className="field"><label>จำนวนทั้งหมด (ชิ้น)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" className="btn" style={{ width: 44, padding: 0, fontSize: 20 }} onClick={() => setAccTotalInput(v => Math.max(accModal.committed || 0, (+v || 0) - 1))}>−</button>
              <input className="input num" type="number" style={{ textAlign: "center", flex: 1, fontWeight: 700, fontSize: 17 }} value={accTotalInput} onChange={e => setAccTotalInput(e.target.value)} />
              <button type="button" className="btn" style={{ width: 44, padding: 0, fontSize: 20 }} onClick={() => setAccTotalInput(v => (+v || 0) + 1)}>+</button>
            </div>
          </div>
          {accModal.mode === "edit" && (() => {
            const a = accStock.find(x => x.id === accModal.id) || {};
            const out = accOutMap[a.id] || 0;
            const ss = (store.accStatus && store.accStatus[a.id]) || { damaged: 0, lost: 0 };
            const remain = Math.max(0, (+accTotalInput || 0) - out - ss.damaged - ss.lost);
            return (
              <div className="card" style={{ background: "var(--surface-2)", marginBottom: 16, padding: "4px 0" }}>
                <div className="kv" style={{ padding: "9px 15px" }}><span className="k">ถูกยืมอยู่</span><span className="v num" style={{ color: "var(--info)", whiteSpace: "nowrap" }}>{out} ชิ้น</span></div>
                <div className="kv" style={{ padding: "9px 15px" }}><span className="k">ชำรุด · สูญหาย</span><span className="v num" style={{ color: "var(--danger)", whiteSpace: "nowrap" }}>{ss.damaged} · {ss.lost} ชิ้น</span></div>
                <div className="kv" style={{ padding: "9px 15px", borderTop: "1px solid var(--border)" }}><span className="k" style={{ fontWeight: 700, color: "var(--text)" }}>คงเหลือในคลัง</span><span className="v num" style={{ fontWeight: 800, fontSize: 16, color: "var(--ok)", whiteSpace: "nowrap" }}>{remain} ชิ้น</span></div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", padding: "2px 15px 9px", lineHeight: 1.5 }}>คงเหลือ = จำนวนทั้งหมด − (ถูกยืม + ชำรุด + สูญหาย)</div>
              </div>
            );
          })()}
          <div className="field" style={{ marginBottom: 0 }}><label>หมายเหตุ</label><input className="input" defaultValue={accForm.current.note || ""} placeholder="เช่น ติดตั้งพร้อมเครื่อง" onChange={e => accForm.current.note = e.target.value} /></div>
        </Modal>
      )}

      {sel && <DeviceDetail device={sel} onClose={() => setSel(null)} go={go} onEdit={openEdit} toast={toast} />}

      {edit && (
        <Modal title={"แก้ไขอุปกรณ์ " + edit.assetTag} onClose={() => setEdit(null)} wide
          footer={<><button className="btn" onClick={() => setEdit(null)}>ยกเลิก</button><button className="btn btn-primary" onClick={doEdit}><Icon name="check" size={16} />บันทึก</button></>}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="field"><label>Asset Tag</label><input className="input" defaultValue={edit.assetTag} onChange={e => editForm.current.assetTag = e.target.value} /></div>
            <div className="field"><label>รหัสครุภัณฑ์</label><input className="input" defaultValue={edit.code} onChange={e => editForm.current.code = e.target.value} /></div>
            <div className="field"><label>Serial Number</label><input className="input" defaultValue={edit.serial} onChange={e => editForm.current.serial = e.target.value} /></div>
            <div className="field"><label>ยี่ห้อ</label><input className="input" defaultValue={edit.brand} onChange={e => editForm.current.brand = e.target.value} /></div>
            <div className="field"><label>รุ่น</label><input className="input" defaultValue={edit.model} onChange={e => editForm.current.model = e.target.value} /></div>
            <div className="field"><label>สี</label><input className="input" defaultValue={edit.color} onChange={e => editForm.current.color = e.target.value} /></div>
            <div className="field"><label>ความจุ</label><input className="input" defaultValue={edit.cap} onChange={e => editForm.current.cap = e.target.value} /></div>
            <div className="field"><label>ปีงบประมาณ</label><input className="input num" defaultValue={edit.budgetYear} onChange={e => editForm.current.budgetYear = e.target.value} /></div>
          </div>
          {edit.holder && <div style={{ display: "flex", gap: 9, marginTop: 4, padding: 12, background: "var(--warn-soft)", borderRadius: 11, color: "var(--warn)", fontSize: 13 }}><Icon name="alert" size={17} style={{ flexShrink: 0 }} /><span>อุปกรณ์นี้ถูกยืมอยู่โดย {edit.holder} · สถานะการถือครองแก้ไขผ่านหน้ายืม–คืน</span></div>}
        </Modal>
      )}

      {add && (
        <Modal title="เพิ่มอุปกรณ์ใหม่" onClose={() => setAdd(false)} wide
          footer={<><button className="btn" onClick={() => setAdd(false)}>ยกเลิก</button><button className="btn btn-primary" onClick={doAdd}><Icon name="check" size={16} />บันทึก</button></>}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="field"><label>ประเภทอุปกรณ์</label>
              <select className="select" defaultValue="ipad" onChange={e => addForm.current.type = e.target.value}>
                {D.deviceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Asset Tag</label><input className="input" placeholder="เว้นว่างเพื่อสร้างอัตโนมัติ" onChange={e => addForm.current.assetTag = e.target.value} /></div>
            <div className="field"><label>รหัสครุภัณฑ์</label><input className="input" placeholder="7440-001-…" onChange={e => addForm.current.code = e.target.value} /></div>
            <div className="field"><label>Serial Number</label><input className="input" placeholder="เว้นว่างเพื่อสร้างอัตโนมัติ" onChange={e => addForm.current.serial = e.target.value} /></div>
            <div className="field"><label>ยี่ห้อ</label><input className="input" defaultValue="Apple" onChange={e => addForm.current.brand = e.target.value} /></div>
            <div className="field"><label>รุ่น</label><input className="input" defaultValue="iPad A16" onChange={e => addForm.current.model = e.target.value} /></div>
            <div className="field"><label>สี</label><input className="input" defaultValue="Silver" onChange={e => addForm.current.color = e.target.value} /></div>
            <div className="field"><label>ความจุ</label><input className="input" defaultValue="128GB" onChange={e => addForm.current.cap = e.target.value} /></div>
            <div className="field"><label>ปีงบประมาณ</label><input className="input num" defaultValue="2569" onChange={e => addForm.current.budgetYear = e.target.value} /></div>
          </div>
          <div style={{ display: "flex", gap: 9, marginTop: 4, padding: 12, background: "var(--info-soft)", borderRadius: 11, color: "var(--info)", fontSize: 13 }}>
            <Icon name="layers" size={17} style={{ flexShrink: 0 }} /><span>อุปกรณ์เสริม (สายชาร์จ เคส ฯลฯ) จัดการแยกที่แท็บ “อุปกรณ์เสริม” และส่งมอบตอนทำรายการยืม</span>
          </div>
        </Modal>
      )}

      {del && (
        <Modal title="ยืนยันการลบอุปกรณ์" onClose={() => setDel(null)}
          footer={<><button className="btn" onClick={() => setDel(null)}>ยกเลิก</button><button className="btn btn-danger" onClick={doDelete}><Icon name="trash" size={16} />ลบอุปกรณ์</button></>}>
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            <div className="stat-ic" style={{ background: "var(--danger-soft)", color: "var(--danger)", width: 48, height: 48, flexShrink: 0 }}><Icon name="alert" size={24} /></div>
            <div>ต้องการลบ <b className="num">{del.assetTag}</b> ({del.model}) ออกจากระบบใช่หรือไม่? <div style={{ color: "var(--text-3)", fontSize: 13.5, marginTop: 4 }}>การลบจะนำอุปกรณ์ออกจากทะเบียนครุภัณฑ์ (ในระบบจริงจะถูกบันทึกใน Audit Log)</div></div>
          </div>
        </Modal>
      )}

      {importOpen && (
        <ImportModal title="นำเข้าข้อมูลอุปกรณ์" headers={devHeaders} templateName="Template_อุปกรณ์" sampleRow={devSample}
          existingKeys={list.map(d => d.assetTag)}
          buildRecord={(row) => {
            const [assetTag, code, serial, typeName, brand, model, color, cap, budgetYear, receivedDate, status] = row.map(c => String(c).trim());
            if (!assetTag) return null;
            const typeMap = { "iPad": "ipad", "Notebook": "notebook", "Chromebook": "chromebook", "กล้อง": "camera" };
            return { id: Date.now() + Math.floor(Math.random() * 1e6), assetTag, code: code || "-", serial: serial || "-", type: typeMap[typeName] || "ipad", typeName: typeName || "iPad", brand: brand || "Apple", model: model || "iPad", color: color || "Silver", cap: cap || "-", budgetYear: parseInt(budgetYear) || 2569, receivedDate: receivedDate || window.todayISO(), price: null, status: status || "พร้อมใช้งาน", statusCls: status === "ชำรุด" ? "b-danger" : status === "ส่งซ่อม" ? "b-warn" : status === "สูญหาย" ? "b-muted" : "b-ok", holder: null, holderLevel: null, accessories: [], note: "" };
          }}
          keyOf={(d) => d.assetTag}
          onClose={() => setImportOpen(false)}
          onImport={(res) => {
            if (res.records.length) setStore(st => ({ ipads: [...res.records.filter(r => r.type === "ipad"), ...st.ipads] }));
            logAction("นำเข้า Excel", "นำเข้าอุปกรณ์ " + res.valid + " รายการ" + (res.dupes ? " (ข้ามซ้ำ " + res.dupes + ")" : ""), "b-purple", "ผู้ดูแลระบบ", "devices");
            toast("นำเข้าอุปกรณ์ " + res.valid + " รายการสำเร็จ" + (res.dupes ? " · ข้ามซ้ำ " + res.dupes : ""));
          }} />
      )}

      {bulkDel && (
        <Modal title="ยืนยันการลบหลายรายการ" onClose={() => setBulkDel(false)}
          footer={<><button className="btn" onClick={() => setBulkDel(false)}>ยกเลิก</button><button className="btn btn-danger" onClick={doBulkDelete}><Icon name="trash" size={16} />ลบ {selected.length} รายการ</button></>}>
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            <div className="stat-ic" style={{ background: "var(--danger-soft)", color: "var(--danger)", width: 48, height: 48, flexShrink: 0 }}><Icon name="alert" size={24} /></div>
            <div>ต้องการลบอุปกรณ์ที่เลือกทั้งหมด <b className="num">{selected.length}</b> รายการออกจากระบบใช่หรือไม่? <div style={{ color: "var(--text-3)", fontSize: 13.5, marginTop: 4 }}>การลบหลายรายการพร้อมกันจะถูกบันทึกใน Audit Log</div></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
window.Devices = Devices;
