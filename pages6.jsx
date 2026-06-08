/* ===== ทะเบียนการยืม–คืนอุปกรณ์ (Borrow–Return Registry) ===== */
const DR = window.NHP;

function Registry({ go }) {
  const toast = React.useContext(ToastCtx);
  const [store] = useStore();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [kindF, setKindF] = useState("all");
  const [levelF, setLevelF] = useState("all");
  const [roomF, setRoomF] = useState("all");
  const [sort, setSort] = useState("recent");
  const [detail, setDetail] = useState(null);

  // a return counts as "เสียหาย" if the DEVICE is damaged OR any ACCESSORY came back ชำรุด
  const accDmgCount = (r) => {
    let n = 0;
    (r.items || []).forEach(it => (it.accDetails || []).forEach(d => { if (d.cond === "ชำรุด") n++; }));
    return n;
  };
  const devDmgCount = (r) => (r.damaged || []).filter(tag => {
    // a device counts as damaged only if its condition wasn't สมบูรณ์
    const it = (r.items || []).find(x => x.assetTag === tag);
    return !it || it.cond === "ชำรุด" || it.cond === "มีรอยเล็กน้อย";
  }).length;
  const hasDmg = (r) => r.kind === "ret" && (devDmgCount(r) > 0 || accDmgCount(r) > 0);
  // available levels / rooms for the filter
  const levelOpts = [...new Set(store.students.map(s => s.level))].sort();
  const roomOpts = [...new Set(store.students.map(s => s.room))].sort((a, b) => a - b);
  const matchLevelRoom = (r) => {
    if (levelF === "all" && roomF === "all") return true;
    const lv = (r.level || "").split("/");
    const lvPart = lv[0], roomPart = lv[1];
    if (levelF !== "all" && lvPart !== levelF) return false;
    if (roomF !== "all" && String(roomPart) !== String(roomF)) return false;
    return true;
  };

  // ----- outstanding loans grouped by person (still holding device(s)) -----
  const outstanding = useMemo(() => {
    const map = new Map();
    store.borrows.forEach(b => {
      const key = (b.borrowerKind || "?") + ":" + (b.borrowerId != null ? b.borrowerId : b.holder);
      if (!map.has(key)) map.set(key, { key, kind: "out", personName: b.holder, level: b.level, personKind: b.borrowerKind, personId: b.borrowerId, devices: [], overdue: false });
      const g = map.get(key);
      g.devices.push(b);
      if (b.overdueDays > 0) g.overdue = true;
    });
    return [...map.values()];
  }, [store.borrows]);

  // ----- completed return transactions (the ledger) -----
  const returned = useMemo(() => store.returnLog.map(r => ({
    key: "ret:" + r.id, kind: "ret", ...r,
  })), [store.returnLog]);

  // unified ledger rows
  const rows = useMemo(() => {
    let all = [...outstanding.map(o => ({
      ...o, statusKey: o.overdue ? "overdue" : "out",
      count: o.devices.length, damaged: [], date: null,
    })), ...returned.map(r => ({
      ...r,
      statusKey: !r.complete ? "incomplete" : (r.damaged.length ? "damaged" : "complete"),
      count: r.items.length,
    }))];
    if (tab !== "all") all = all.filter(r => {
      if (tab === "out") return r.kind === "out";
      if (tab === "returned") return r.kind === "ret";
      return true;
    });
    if (q.trim()) {
      const t = q.toLowerCase();
      all = all.filter(r => (r.personName + " " + r.level + " " + (r.devices || r.items || []).map(d => d.device || d.assetTag).join(" ")).toLowerCase().includes(t));
    }
    if (kindF !== "all") all = all.filter(r => r.personKind === kindF);
    all = all.filter(matchLevelRoom);
    // sort
    all.sort((a, b) => {
      if (sort === "name") return (a.personName || "").localeCompare(b.personName || "", "th");
      if (sort === "count") return b.count - a.count;
      // by date: outstanding (no date) treated as newest; then by date string
      const ad = a.date || "9999", bd = b.date || "9999";
      return sort === "oldest" ? ad.localeCompare(bd) : bd.localeCompare(ad);
    });
    return all;
  }, [outstanding, returned, tab, q, kindF, levelF, roomF, sort]);

  const counts = {
    all: outstanding.length + returned.length,
    out: outstanding.length,
    returned: returned.length,
    complete: returned.filter(r => r.complete && !hasDmg(r)).length,
    incomplete: returned.filter(r => !r.complete).length,
    damaged: returned.filter(r => hasDmg(r)).length,
  };

  const statusBadge = (r) => {
    if (r.kind === "out") return r.overdue
      ? <Badge cls="b-danger" dot>ยังไม่คืน · เกินกำหนด</Badge>
      : <Badge cls="b-info" dot>กำลังยืม</Badge>;
    // returned: คืนแล้ว + detailed sub-status (คืนครบ/คืนไม่ครบ + เสียหาย) shown inline
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        <Badge cls="b-ok" dot>คืนแล้ว</Badge>
        {r.complete ? <Badge cls="b-muted">ครบ</Badge> : <Badge cls="b-danger">ไม่ครบ</Badge>}
        {hasDmg(r) && <Badge cls="b-warn">เสียหาย</Badge>}
      </div>
    );
  };

  const goReturn = (r) => {
    const b = r.devices[0];
    const dev = store.ipads.find(d => d.assetTag === b.device || d.id === b.deviceId)
      || { id: b.deviceId, assetTag: b.device, model: b.model, holder: b.holder, holderLevel: b.level, status: "ถูกยืม", statusCls: "b-info" };
    go("borrow", { mode: "return", device: dev });
  };

  const doExport = () => {
    const head = ["ประเภทรายการ", "ผู้ยืม–คืน", "ชั้น/หน่วยงาน", "จำนวนอุปกรณ์", "สถานะ", "อุปกรณ์เสียหาย", "วันที่"];
    const lines = rows.map(r => [
      r.kind === "out" ? "ยังไม่คืน" : "คืนแล้ว",
      r.personName, r.level, r.count,
      r.kind === "out" ? (r.overdue ? "ยังไม่คืน(เกินกำหนด)" : "กำลังยืม") : (r.complete ? "คืนครบ" : "คืนไม่ครบ"),
      (r.damaged && r.damaged.length) ? r.damaged.join("/") : "-",
      r.date || "-",
    ]);
    const csv = "\uFEFF" + [head, ...lines].map(a => a.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "ทะเบียนยืมคืน_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    logAction("ส่งออกรายงาน", "ทะเบียนการยืม–คืนอุปกรณ์ (" + rows.length + " รายการ)", "b-purple", "ผู้ดูแลระบบ", "registry");
    toast("ส่งออกทะเบียนยืม–คืนแล้ว");
  };

  // ----- Excel export (.xlsx) — flatten to one row per device, two sheets -----
  const doExportExcel = () => {
    if (typeof XLSX === "undefined") { toast("ไลบรารี Excel ยังโหลดไม่เสร็จ ลองอีกครั้ง"); return; }
    const summary = [["ทะเบียนการยืม–คืนอุปกรณ์ · โรงเรียนหนองหงส์พิทยาคม"], ["ปีการศึกษา", store.year || "2569"], ["ส่งออกเมื่อ", new Date().toLocaleString("th-TH")], [], 
      ["ประเภทรายการ", "ผู้ยืม–คืน", "ประเภทผู้ใช้", "ชั้น/หน่วยงาน", "จำนวนอุปกรณ์", "สถานะการคืน", "อุปกรณ์เสียหาย", "วันที่", "ผู้รับคืน"]];
    rows.forEach(r => summary.push([
      r.kind === "out" ? "ยังไม่คืน" : "คืนแล้ว",
      r.personName, r.personKind === "t" ? "ครู/บุคลากร" : r.personKind === "s" ? "นักเรียน" : "-", r.level, r.count,
      r.kind === "out" ? (r.overdue ? "ยังไม่คืน (เกินกำหนด)" : "กำลังยืม") : (r.complete ? "คืนครบ" : "คืนไม่ครบ"),
      (r.damaged && r.damaged.length) ? r.damaged.length + " เครื่อง" : "-",
      r.date || "-", r.receiver || "-",
    ]));

    // detail sheet: one row per device
    const detailRows = [["ประเภท", "ผู้ยืม–คืน", "ชั้น/หน่วยงาน", "Asset Tag", "รุ่น", "สภาพเครื่อง", "หมายเหตุเครื่อง", "อุปกรณ์เสริม (สภาพ)", "อุปกรณ์ที่ขาด", "วันที่"]];
    rows.forEach(r => {
      const list = r.devices || r.items || [];
      list.forEach(it => {
        const tag = it.device || it.assetTag;
        const accStr = (it.accDetails && it.accDetails.length)
          ? it.accDetails.map(d => d.name + " (" + d.cond + ")").join(", ")
          : (it.accessories || []).map(a => a.name).join(", ");
        const missing = (it.missingAcc && it.missingAcc.length) ? it.missingAcc.join(", ") : "-";
        detailRows.push([
          r.kind === "out" ? "ยังไม่คืน" : "คืนแล้ว",
          r.personName, r.level, tag, it.model || "-",
          r.kind === "out" ? "—" : (it.cond || "-"),
          r.kind === "out" ? "—" : (it.notes || "-"),
          accStr || "-", missing, r.date || "-",
        ]);
      });
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(summary);
    ws1["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 13 }, { wch: 16 }, { wch: 11 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
    const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
    ws2["!cols"] = [{ wch: 11 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 13 }, { wch: 26 }, { wch: 34 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws1, "สรุปทะเบียน");
    XLSX.utils.book_append_sheet(wb, ws2, "รายละเอียดรายเครื่อง");
    XLSX.writeFile(wb, "ทะเบียนยืมคืน_" + new Date().toISOString().slice(0, 10) + ".xlsx");
    logAction("ส่งออกรายงาน", "ทะเบียนยืม–คืน (Excel · " + rows.length + " รายการ)", "b-purple", "ผู้ดูแลระบบ", "registry");
    toast("ส่งออกไฟล์ Excel แล้ว");
  };

  return (
    <div>
      <PageHead crumb={["ทะเบียนยืม–คืนอุปกรณ์"]} title="ทะเบียนการยืม–คืนอุปกรณ์" desc="บันทึกการยืม–คืน สถานะการส่งคืน และอุปกรณ์ที่เสียหาย"
        actions={<><button className="btn" onClick={doExport}><Icon name="download" size={17} />CSV</button><button className="btn btn-primary" onClick={doExportExcel}><Icon name="download" size={17} />ส่งออก Excel</button></>} />

      <div className="stat-grid" style={{ marginBottom: 20, gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        <div className="stat" style={{ borderLeft: "4px solid var(--info)" }}>
          <div className="stat-val num" style={{ color: "var(--info)" }}>{counts.out}</div><div className="stat-label">กำลังยืม (ยังไม่คืน)</div>
        </div>
        <div className="stat" style={{ borderLeft: "4px solid var(--ok)" }}>
          <div className="stat-val num" style={{ color: "var(--ok)" }}>{counts.complete}</div><div className="stat-label">คืนครบ</div>
        </div>
        <div className="stat" style={{ borderLeft: "4px solid var(--danger)" }}>
          <div className="stat-val num" style={{ color: "var(--danger)" }}>{counts.incomplete}</div><div className="stat-label">คืนไม่ครบ</div>
        </div>
        <div className="stat" style={{ borderLeft: "4px solid var(--warn)" }}>
          <div className="stat-val num" style={{ color: "var(--warn)" }}>{counts.damaged}</div><div className="stat-label">มีอุปกรณ์เสียหาย</div>
        </div>
      </div>

      <div className="tabs">
        {[["all", "ทั้งหมด"], ["out", "ยังไม่คืน"], ["returned", "คืนแล้ว"]].map(([k, l]) => (
          <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{l} <span className="num" style={{ opacity: .6 }}>({counts[k] != null ? counts[k] : 0})</span></button>
        ))}
      </div>

      <div className="toolbar">
        <div className="filter-input" style={{ flex: 1, minWidth: 200 }}>
          <Icon name="search" size={17} style={{ color: "var(--text-3)" }} />
          <input placeholder="ค้นหาชื่อผู้ยืม–คืน, ชั้น, Asset Tag…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="select" style={{ width: "auto", minWidth: 150 }} value={kindF} onChange={e => setKindF(e.target.value)}>
          <option value="all">ผู้ใช้ทุกประเภท</option>
          <option value="s">เฉพาะนักเรียน</option>
          <option value="t">เฉพาะครู/บุคลากร</option>
        </select>
        <select className="select" style={{ width: "auto", minWidth: 110 }} value={levelF} onChange={e => setLevelF(e.target.value)}>
          <option value="all">ทุกระดับชั้น</option>
          {levelOpts.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className="select" style={{ width: "auto", minWidth: 100 }} value={roomF} onChange={e => setRoomF(e.target.value)}>
          <option value="all">ทุกห้อง</option>
          {roomOpts.map(r => <option key={r} value={r}>ห้อง {r}</option>)}
        </select>
        <select className="select" style={{ width: "auto", minWidth: 150 }} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="recent">ล่าสุดก่อน</option>
          <option value="oldest">เก่าสุดก่อน</option>
          <option value="name">เรียงตามชื่อ</option>
          <option value="count">จำนวนเครื่องมากสุด</option>
        </select>
        {(q || kindF !== "all" || levelF !== "all" || roomF !== "all" || tab !== "all" || sort !== "recent") && (
          <button className="btn btn-sm" onClick={() => { setQ(""); setKindF("all"); setLevelF("all"); setRoomF("all"); setTab("all"); setSort("recent"); }}><Icon name="close" size={14} />ล้างตัวกรอง</button>
        )}
        <div className="spacer"></div>
        <span style={{ color: "var(--text-3)", fontSize: 13.5 }}>{rows.length} รายการ</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr>
              <th>ผู้ยืม–คืน</th><th>ชั้น/หน่วยงาน</th><th style={{ textAlign: "center" }}>อุปกรณ์</th>
              <th>สถานะการคืน</th><th>อุปกรณ์เสียหาย</th><th>วันที่</th><th style={{ textAlign: "right" }}>จัดการ</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} className="row-click" onClick={() => setDetail(r)}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div className="avatar" style={{ width: 36, height: 36 }}>{initials((r.personName || "").replace(/^(เด็กชาย|เด็กหญิง|นางสาว|นาง|นาย|ครู)/, ""))}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }} className="clip">{r.personName}</div>
                        <div style={{ fontSize: 12, color: "var(--text-3)" }}>{r.kind === "out" ? "กำลังถือครอง" : "คืนเมื่อ " + r.date}</div>
                      </div>
                    </div>
                  </td>
                  <td>{r.level}</td>
                  <td style={{ textAlign: "center" }}><span className="num" style={{ fontWeight: 700 }}>{r.count}</span> <span style={{ color: "var(--text-3)", fontSize: 12 }}>เครื่อง</span></td>
                  <td>{statusBadge(r)}</td>
                  <td>{(() => {
                    const devDmg = devDmgCount(r);
                    const accDmg = accDmgCount(r);
                    if (!devDmg && !accDmg) return <span style={{ color: "var(--text-3)" }}>—</span>;
                    return <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {devDmg > 0 && <Badge cls="b-warn" dot>เครื่อง {devDmg}</Badge>}
                      {accDmg > 0 && <Badge cls="b-danger" dot>เสริม {accDmg}</Badge>}
                    </div>;
                  })()}</td>
                  <td className="num" style={{ color: "var(--text-3)", fontSize: 13 }}>{r.date || "—"}</td>
                  <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                    {r.kind === "out"
                      ? <button className="btn btn-sm btn-primary" onClick={() => goReturn(r)}><Icon name="swap" size={14} />รับคืน</button>
                      : <button className="btn btn-sm" onClick={() => setDetail(r)}><Icon name="eye" size={14} />ดูรายละเอียด</button>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="7"><Empty title="ไม่พบรายการ" sub="ลองปรับตัวกรองหรือคำค้นหา" /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (() => {
        const live = rows.find(r => r.key === detail.key) || detail;
        return <RegistryDetail row={live} onClose={() => setDetail(null)} goReturn={goReturn} />;
      })()}
    </div>
  );
}

function RegistryDetail({ row, onClose, goReturn }) {
  const toast = React.useContext(ToastCtx);
  const [store] = useStore();
  const condCls = { "สมบูรณ์": "b-ok", "มีรอยเล็กน้อย": "b-warn", "ชำรุด": "b-danger" };
  const isOut = row.kind === "out";
  const list = isOut ? row.devices : row.items;
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [editAccFor, setEditAccFor] = useState(null);   // borrow.id being edited
  const [accDraft, setAccDraft] = useState({});          // { accId: true }
  const [confirmDel, setConfirmDel] = useState(null);    // borrow being removed from loan
  const [editRetAccFor, setEditRetAccFor] = useState(null);  // "returnId:assetTag" being edited
  const [retAccDraft, setRetAccDraft] = useState({});        // { accId: {id,name,cond,notes,returned} }

  const openRetAccEdit = (rowEntry, it, details) => {
    const d = {};
    details.forEach(x => { if (x.id != null) d[x.id] = { id: x.id, name: x.name, cond: x.cond, notes: x.notes || "", returned: x.returned !== false && x.cond !== "ไม่คืน" }; });
    setRetAccDraft(d); setEditRetAccFor(rowEntry.id + ":" + it.assetTag);
  };
  const saveRetAcc = (it) => {
    const details = Object.values(retAccDraft);
    window.updateReturnAccessories(row.id, it.assetTag, details);
    toast("อัปเดตอุปกรณ์เสริมของ " + it.assetTag + " แล้ว");
    setEditRetAccFor(null);
  };

  const openEditAcc = (b) => {
    const d = {}; (b.accessories || []).forEach(a => { d[a.id] = true; });
    setAccDraft(d); setEditAccFor(b.id);
  };
  const saveAcc = (b) => {
    const newAcc = store.accessories.filter(a => accDraft[a.id]).map(a => ({ id: a.id, name: a.name, qty: 1 }));
    window.updateBorrowAccessories(b.id, newAcc);
    toast("อัปเดตอุปกรณ์เสริมของ " + b.device + " แล้ว");
    setEditAccFor(null);
  };
  const doRevert = () => {
    window.revertReturn(row);
    toast(row.personName + " เปลี่ยนกลับเป็น “กำลังยืม” แล้ว — แก้ไขได้");
    setConfirmRevert(false);
    onClose();
  };
  const doRemoveDevice = () => {
    window.removeBorrowDevice(confirmDel.id);
    toast("นำ " + confirmDel.device + " ออกจากการยืมแล้ว");
    setConfirmDel(null);
    onClose();
  };

  return (
    <Modal title={(isOut ? "อุปกรณ์ที่กำลังยืม — " : "รายละเอียดการคืน — ") + row.personName} onClose={onClose} wide
      footer={isOut
        ? <><button className="btn" onClick={onClose}>ปิด</button><button className="btn btn-primary" onClick={() => { onClose(); goReturn(row); }}><Icon name="swap" size={16} />รับคืนอุปกรณ์</button></>
        : <><button className="btn" style={{ marginRight: "auto" }} onClick={() => setConfirmRevert(true)}><Icon name="undo" size={16} />เปลี่ยนกลับเป็นกำลังยืม</button><button className="btn btn-primary" onClick={onClose}>ปิด</button></>}>
      <div className="card" style={{ background: "var(--surface-2)", marginBottom: 14 }}>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">ผู้{isOut ? "ยืม" : "คืน"}</span><span className="v">{row.personName} ({row.level})</span></div>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">จำนวนอุปกรณ์</span><span className="v num">{list.length} เครื่อง</span></div>
        {!isOut && <div className="kv" style={{ padding: "11px 16px" }}><span className="k">สถานะการคืน</span><span className="v" style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{row.complete ? <Badge cls="b-ok" dot>คืนครบ</Badge> : <Badge cls="b-danger" dot>คืนไม่ครบ</Badge>}{hasDmgEntry(row) && <Badge cls="b-warn" dot>มีอุปกรณ์เสียหาย</Badge>}</span></div>}
        {!isOut && <div className="kv" style={{ padding: "11px 16px" }}><span className="k">วันที่คืน · ผู้รับคืน</span><span className="v">{row.date} · {row.receiver}</span></div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map((it, i) => {
          const tag = it.device || it.assetTag;
          const model = it.model;
          return (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--surface-3)", display: "grid", placeItems: "center", color: "var(--text-2)", flexShrink: 0 }}><Icon name="tablet" size={18} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="num" style={{ fontWeight: 700 }}>{tag}</div>
                  <div className="clip" style={{ fontSize: 12.5, color: "var(--text-3)" }}>{model}{isOut ? " · ยืม " + it.borrowDate : ""}</div>
                </div>
                {!isOut && <Badge cls={condCls[it.cond] || "b-muted"} dot>{it.cond}</Badge>}
                {isOut && (it.overdueDays > 0 ? <Badge cls="b-danger" dot>เกิน {it.overdueDays} วัน</Badge> : <Badge cls="b-info" dot>กำลังยืม</Badge>)}
              </div>
              {!isOut && it.notes && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-2)", background: "var(--surface-2)", padding: "8px 11px", borderRadius: 9 }}>
                  หมายเหตุเครื่อง: {it.notes}
                </div>
              )}
              {!isOut && (() => {
                const accCls = { "สมบูรณ์": "b-ok", "มีรอยเล็กน้อย": "b-warn", "ชำรุด": "b-danger", "ไม่คืน": "b-muted" };
                let details = it.accDetails;
                if (!details || !details.length) {
                  details = (it.accExpected || []).map(a => {
                    const returned = (it.accReturned || []).includes(a.id);
                    return { id: a.id, name: a.name, cond: returned ? "สมบูรณ์" : "ไม่คืน", notes: "", returned };
                  });
                }
                const editing = editRetAccFor === (row.id + ":" + it.assetTag);
                return (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
                      <Icon name="layers" size={13} style={{ color: "var(--accent)" }} />ผลตรวจอุปกรณ์เสริม
                      {!editing && <button className="btn btn-sm" style={{ marginLeft: "auto", height: 26, padding: "0 9px" }} onClick={() => openRetAccEdit(row, it, details)}><Icon name="edit" size={12} />แก้ไข</button>}
                    </div>
                    {editing ? (
                      <div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 11 }}>
                          {store.accessories.map(a => {
                            const d = retAccDraft[a.id];
                            const on = !!d;
                            return (
                              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 9, background: on ? "var(--surface-2)" : "transparent" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", minWidth: 130 }}>
                                  <input type="checkbox" checked={on} onChange={() => setRetAccDraft(s => { const n = { ...s }; if (n[a.id]) delete n[a.id]; else n[a.id] = { id: a.id, name: a.name, cond: "สมบูรณ์", notes: "", returned: true }; return n; })} style={{ width: 15, height: 15, accentColor: "var(--accent)" }} />
                                  <span style={{ fontWeight: 500, fontSize: 12.5 }}>{a.name}</span>
                                </label>
                                {on && (
                                  <div className="seg seg-acc" style={{ display: "flex", marginLeft: "auto" }}>
                                    {["สมบูรณ์", "มีรอยเล็กน้อย", "ชำรุด", "ไม่คืน"].map(c => (
                                      <button key={c} className={d.cond === c ? "on" : ""} style={{ fontSize: 11, padding: "4px 8px" }}
                                        onClick={() => setRetAccDraft(s => ({ ...s, [a.id]: { ...s[a.id], cond: c, returned: c !== "ไม่คืน" } }))}>{c}</button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-sm" onClick={() => setEditRetAccFor(null)}>ยกเลิก</button>
                          <button className="btn btn-sm btn-primary" onClick={() => saveRetAcc(it)}><Icon name="check" size={14} />บันทึก</button>
                        </div>
                      </div>
                    ) : details.length ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {details.map((d, di) => (
                          <div key={di} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 500, minWidth: 110 }}>{d.name}</span>
                            <Badge cls={accCls[d.cond] || "b-muted"} dot>{d.cond}</Badge>
                            {d.notes && <span style={{ color: "var(--text-3)" }}>· {d.notes}</span>}
                          </div>
                        ))}
                      </div>
                    ) : <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>— ไม่มีอุปกรณ์เสริม —</div>}
                  </div>
                );
              })()}
              {isOut && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  {editAccFor === it.id ? (
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}><Icon name="layers" size={13} style={{ color: "var(--accent)" }} />เลือกอุปกรณ์เสริมที่ถือครอง</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 11 }}>
                        {store.accessories.map(a => {
                          const on = !!accDraft[a.id];
                          const stockLeft = a.qty + ((it.accessories || []).some(x => x.id === a.id) ? 1 : 0);
                          const disabled = !on && stockLeft <= 0;
                          return (
                            <button key={a.id} disabled={disabled} onClick={() => setAccDraft(d => ({ ...d, [a.id]: !d[a.id] }))}
                              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 9, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, fontSize: 12.5, fontWeight: 500, border: "1.5px solid " + (on ? "var(--accent)" : "var(--border)"), background: on ? "var(--accent-soft)" : "var(--surface)" }}>
                              <Icon name={on ? "check2" : "plus"} size={13} style={{ color: on ? "var(--accent)" : "var(--text-3)" }} />{a.name}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-sm" onClick={() => setEditAccFor(null)}>ยกเลิก</button>
                        <button className="btn btn-sm btn-primary" onClick={() => saveAcc(it)}><Icon name="check" size={14} />บันทึก</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>อุปกรณ์เสริม:</span>
                      {(it.accessories || []).length > 0
                        ? it.accessories.map(a => <Badge key={a.id} cls="b-muted">{a.name}</Badge>)
                        : <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>— ไม่มี —</span>}
                      <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => openEditAcc(it)}><Icon name="edit" size={13} />แก้ไข</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setConfirmDel(it)}><Icon name="trash" size={13} />ลบรายการ</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirmDel && (
        <Modal title="ลบรายการยืม" onClose={() => setConfirmDel(null)}
          footer={<><button className="btn" onClick={() => setConfirmDel(null)}>ยกเลิก</button><button className="btn btn-danger" onClick={doRemoveDevice}><Icon name="trash" size={16} />ยืนยันลบ</button></>}>
          <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
            <div className="stat-ic" style={{ background: "var(--danger-soft)", color: "var(--danger)", width: 46, height: 46, flexShrink: 0 }}><Icon name="trash" size={22} /></div>
            <div>นำ <b className="num">{confirmDel ? confirmDel.device : ""}</b> ออกจากการยืมของ <b>{row.personName}</b> ใช่หรือไม่?<div style={{ color: "var(--text-3)", fontSize: 13, marginTop: 4 }}>อุปกรณ์จะกลับเป็นพร้อมใช้งาน คืนอุปกรณ์เสริมเข้าคลัง และตัดออกจากรายการยืม (ไม่บันทึกลงทะเบียนการคืน)</div></div>
          </div>
        </Modal>
      )}

      {confirmRevert && (
        <Modal title="เปลี่ยนกลับเป็นกำลังยืม" onClose={() => setConfirmRevert(false)}
          footer={<><button className="btn" onClick={() => setConfirmRevert(false)}>ยกเลิก</button><button className="btn btn-primary" onClick={doRevert}><Icon name="undo" size={16} />ยืนยันเปลี่ยนกลับ</button></>}>
          <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
            <div className="stat-ic" style={{ background: "var(--warn-soft)", color: "var(--warn)", width: 46, height: 46, flexShrink: 0 }}><Icon name="undo" size={22} /></div>
            <div>ยกเลิกการคืนของ <b>{row.personName}</b> ({row.items.length} เครื่อง) แล้วเปลี่ยนกลับเป็น “กำลังยืม” ใช่หรือไม่?<div style={{ color: "var(--text-3)", fontSize: 13, marginTop: 4 }}>อุปกรณ์จะกลับไปสถานะถูกยืม และตัดออกจากทะเบียนการคืน เพื่อให้แก้ไขสภาพ/อุปกรณ์เสริมใหม่ได้</div></div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

// helper for detail modal: does a returned entry have any damage?
function hasDmgEntry(r) {
  let n = 0;
  (r.items || []).forEach(it => {
    if (it.cond === "ชำรุด" || it.cond === "มีรอยเล็กน้อย") n++;
    (it.accDetails || []).forEach(d => { if (d.cond === "ชำรุด") n++; });
  });
  return n > 0;
}

window.Registry = Registry;
