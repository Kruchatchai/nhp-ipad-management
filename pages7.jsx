/* ===== จุดบริการด่วน (Quick Station) v2 ===== */
const DQS = window.NHP;

/* ── Notification bell — real, live alerts from store ─────── */
function NotificationBell({ go }) {
  const [store] = useStore();
  const [open, setOpen] = useState(false);
  const items = useMemo(() => {
    const out = [];
    const overdue = store.borrows.filter(b => b.overdueDays > 0);
    if (overdue.length) out.push({ id: "ov", icon: "overdue", color: "var(--danger)", soft: "var(--danger-soft)", title: overdue.length + " เครื่องเกินกำหนดคืน", desc: overdue.slice(0, 2).map(b => b.holder).join(", ") + (overdue.length > 2 ? " และอื่น ๆ" : ""), nav: "overdue" });
    const grads = store.students.filter(s => s.graduated && (window.borrowsOf ? window.borrowsOf(s).length : 0) > 0);
    if (grads.length) out.push({ id: "gr", icon: "graduation", color: "var(--purple)", soft: "var(--purple-soft)", title: grads.length + " ศิษย์เก่ายังไม่คืนเครื่อง", desc: "ติดตามการคืนอุปกรณ์จากผู้จบการศึกษา", nav: "students" });
    const broken = store.ipads.filter(d => d.status === "ชำรุด");
    const activeTix = new Set(store.repairs.filter(r => r.status === "รอดำเนินการ" || r.status === "กำลังซ่อม").map(r => r.device));
    const brokenPending = broken.filter(d => !activeTix.has(d.assetTag));
    if (brokenPending.length) out.push({ id: "bk", icon: "alert", color: "var(--danger)", soft: "var(--danger-soft)", title: brokenPending.length + " เครื่องชำรุดรอแจ้งซ่อม", desc: "ยังไม่ได้เปิดงานซ่อม", nav: "repair" });
    const repairing = store.repairs.filter(r => r.status === "รอดำเนินการ" || r.status === "กำลังซ่อม");
    if (repairing.length) out.push({ id: "rp", icon: "repair", color: "var(--warn)", soft: "var(--warn-soft)", title: repairing.length + " งานซ่อม iPad กำลังดำเนินการ", desc: "รอดำเนินการ / กำลังซ่อม", nav: "repair" });
    const accRep = (store.accRepairs || []).filter(r => r.status === "รอดำเนินการ" || r.status === "กำลังซ่อม");
    if (accRep.length) out.push({ id: "ar", icon: "layers", color: "var(--accent)", soft: "var(--accent-soft)", title: accRep.length + " งานซ่อมอุปกรณ์เสริม", desc: "รอดำเนินการ / กำลังซ่อม", nav: "repair" });
    const lowAcc = store.accessories.filter(a => a.qty <= 5);
    if (lowAcc.length) out.push({ id: "lw", icon: "box", color: "var(--info)", soft: "var(--info-soft)", title: "อุปกรณ์เสริมใกล้หมด " + lowAcc.length + " รายการ", desc: lowAcc.map(a => a.name + " (" + a.qty + ")").slice(0, 2).join(", "), nav: "devices" });
    return out;
  }, [store.borrows, store.students, store.ipads, store.repairs, store.accRepairs, store.accessories]);

  return (
    <div style={{ position: "relative" }}>
      <button className="icon-btn" title="การแจ้งเตือน" onClick={() => setOpen(o => !o)}><Icon name="bell" size={19} />{items.length > 0 && <span className="dot-badge"></span>}</button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 60 }} onClick={() => setOpen(false)}></div>
          <div className="card" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 61, width: 340, maxWidth: "90vw", boxShadow: "var(--shadow-lg)", padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700 }}>การแจ้งเตือน</div>
              <span className="badge b-danger">{items.length}</span>
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {items.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-3)" }}><Icon name="check2" size={28} style={{ color: "var(--ok)" }} /><div style={{ marginTop: 8, fontSize: 13.5 }}>ไม่มีรายการที่ต้องดำเนินการ</div></div>
              ) : items.map(it => (
                <button key={it.id} className="row-click" onClick={() => { setOpen(false); go(it.nav); }} style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%", border: 0, borderBottom: "1px solid var(--border)", background: "transparent", padding: "12px 16px", textAlign: "left", cursor: "pointer" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: it.soft, color: it.color, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name={it.icon} size={18} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)" }}>{it.title}</div>
                    <div className="clip" style={{ fontSize: 12, color: "var(--text-3)" }}>{it.desc}</div>
                  </div>
                  <Icon name="chevR" size={15} style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 2 }} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
window.NotificationBell = NotificationBell;

/* ── QR Camera Scanner ──────────────────────────────────── */
function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const [facing, setFacing] = useState("environment");
  const [ready, setReady] = useState(false);
  const [camErr, setCamErr] = useState(null);

  const startCam = async (fm) => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (animRef.current) cancelAnimationFrame(animRef.current);
      setReady(false); setCamErr(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: fm, width: { ideal: 640 }, height: { ideal: 480 } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setReady(true); }
    } catch (e) { setCamErr("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตสิทธิ์กล้อง"); }
  };

  useEffect(() => { startCam(facing); return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); if (animRef.current) cancelAnimationFrame(animRef.current); }; }, [facing]);

  useEffect(() => {
    if (!ready) return;
    let hit = false;
    const tick = () => {
      if (hit) return;
      const v = videoRef.current, c = canvasRef.current; if (!v || !c) return;
      if (v.readyState < v.HAVE_ENOUGH_DATA) { animRef.current = requestAnimationFrame(tick); return; }
      c.width = v.videoWidth; c.height = v.videoHeight;
      const ctx = c.getContext("2d"); ctx.drawImage(v, 0, 0);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      if (typeof jsQR !== "undefined") {
        const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (qr && qr.data) { hit = true; onScan(qr.data.trim()); return; }
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [ready]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: Math.min(360, window.innerWidth - 32), borderRadius: 20, overflow: "hidden", boxShadow: "0 0 0 3px var(--primary)" }}>
        {camErr ? (
          <div style={{ padding: 40, color: "#fff", textAlign: "center" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(255,80,80,.25)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}><Icon name="alert" size={30} /></div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{camErr}</div>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted style={{ width: "100%", display: "block" }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
              <div style={{ width: 200, height: 200, border: "3px solid var(--primary)", borderRadius: 18, boxShadow: "0 0 0 1000px rgba(0,0,0,.45)" }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: 28, height: 28, borderTop: "4px solid var(--primary)", borderLeft: "4px solid var(--primary)", borderRadius: "4px 0 0 0", margin: -2 }}></div>
                <div style={{ position: "absolute", top: 0, right: 0, width: 28, height: 28, borderTop: "4px solid var(--primary)", borderRight: "4px solid var(--primary)", borderRadius: "0 4px 0 0", margin: -2 }}></div>
                <div style={{ position: "absolute", bottom: 0, left: 0, width: 28, height: 28, borderBottom: "4px solid var(--primary)", borderLeft: "4px solid var(--primary)", borderRadius: "0 0 0 4px", margin: -2 }}></div>
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderBottom: "4px solid var(--primary)", borderRight: "4px solid var(--primary)", borderRadius: "0 0 4px 0", margin: -2 }}></div>
              </div>
            </div>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button onClick={() => setFacing(f => f === "environment" ? "user" : "environment")}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 11, background: "rgba(255,255,255,.12)", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
          <Icon name="camera" size={16} />สลับกล้อง
        </button>
        <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 11, background: "rgba(255,255,255,.1)", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
          ยกเลิก
        </button>
      </div>
      <div style={{ color: "rgba(255,255,255,.55)", fontSize: 13, marginTop: 14, textAlign: "center" }}>จ่อ QR Code บน iPad เข้าหากรอบ · ระบบตรวจจับอัตโนมัติ</div>
    </div>
  );
}

/* ── Main Quick Station ─────────────────────────────────── */
function QuickStation({ go, user }) {
  const toast = React.useContext(ToastCtx);
  const [store] = useStore();
  const inputRef = useRef(null);
  const [tag, setTag] = useState("");
  const [showCam, setShowCam] = useState(false);
  const [device, setDevice] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [borrower, setBorrower] = useState(null);
  const [bq, setBq] = useState("");
  const [bType, setBType] = useState("student");
  const [chosenAcc, setChosenAcc] = useState({});  // {accId: qty}
  const [damage, setDamage] = useState(false);
  const [retCond, setRetCond] = useState(0);
  const [retNote, setRetNote] = useState("");
  const [retAccInsp, setRetAccInsp] = useState({});  // {accId: {cond:0,notes:""}}
  const [session, setSession] = useState([]);
  const nowTime = () => { const d = new Date(); const p = n => String(n).padStart(2, "0"); return p(d.getHours()) + ":" + p(d.getMinutes()); };

  const refocus = () => setTimeout(() => inputRef.current && inputRef.current.focus(), 80);
  useEffect(() => { refocus(); }, []);

  const reset = () => {
    setTag(""); setDevice(null); setNotFound(false); setShowSuggestions(false);
    setBorrower(null); setBq(""); setChosenAcc({}); setDamage(false);
    setRetCond(0); setRetNote(""); setRetAccInsp({}); refocus();
  };

  /* แยก asset tag จากค่าที่สแกน (รองรับ QR ที่เป็น URL ...?d=<tag> หรือ tag ดิบ) */
  const parseScanned = (raw) => {
    const s = String(raw || "").trim();
    const m = s.match(/[?&]d=([^&]+)/);
    if (m) { try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } }
    return s;
  };
  /* device search — by tag suffix, full tag, OR by holder name in borrows */
  const findDevice = (raw) => {
    const q = (raw !== undefined ? raw : tag).trim().toLowerCase();
    if (!q) return;
    setShowSuggestions(false);
    // match by device tag
    let d = store.ipads.find(x => x.assetTag.toLowerCase() === q)
      || store.ipads.find(x => x.assetTag.toLowerCase().endsWith("-" + q) || x.assetTag.toLowerCase().includes(q));
    if (!d) {
      // match by holder name (for return mode — person brings device back by name)
      const b = store.borrows.find(b => b.holder.toLowerCase().includes(q));
      if (b) d = store.ipads.find(x => x.assetTag === b.device || x.id === b.deviceId);
    }
    if (!d) { setDevice(null); setNotFound(true); return; }
    setDevice(d); setNotFound(false); setBorrower(null); setBq(""); setChosenAcc({});
    setDamage(false); setRetCond(0); setRetNote("");
    // seed per-accessory inspection state
    const rec = store.borrows.find(b => b.device === d.assetTag || b.deviceId === d.id);
    if (rec) { const init = {}; (rec.accessories || []).forEach(a => { init[a.id] = { cond: 0, notes: "" }; }); setRetAccInsp(init); }
  };

  /* live suggestions as user types */
  const suggestions = useMemo(() => {
    const q = tag.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    return store.ipads
      .filter(d => d.assetTag.toLowerCase().includes(q) || d.model.toLowerCase().includes(q))
      .concat(store.borrows.filter(b => b.holder.toLowerCase().includes(q)).map(b => store.ipads.find(d => d.assetTag === b.device)).filter(Boolean))
      .filter((d, i, a) => d && a.findIndex(x => x && x.id === d.id) === i)
      .slice(0, 7);
  }, [tag, store.ipads, store.borrows]);

  const rec = device && store.borrows.find(b => b.device === device.assetTag || b.deviceId === device.id);
  const isAvailable = device && device.status === "พร้อมใช้งาน";
  const isBorrowed = device && device.status === "ถูกยืม";
  const blocked = device && !isAvailable && !isBorrowed;

  const people = (bType === "student" ? store.students : store.teachers)
    .filter(p => !p.graduated)
    .filter(p => { const t = bq.trim().toLowerCase(); return t === "" || (p.first + p.last + (p.code || "") + (p.level || "") + (p.subject || "")).toLowerCase().includes(t); })
    .slice(0, 18);

  const accLabels = ["สมบูรณ์", "มีรอยเล็กน้อย", "ชำรุด", "ไม่คืน"];
  const accCls = ["b-ok", "b-warn", "b-danger", "b-muted"];

  const doBorrow = () => {
    if (!device || !borrower) return;
    const sel = store.accessories.filter(a => (chosenAcc[a.id] || 0) > 0).map(a => ({ id: a.id, name: a.name, qty: chosenAcc[a.id] }));
    window.quickBorrow(device, borrower, { user: user || "จุดบริการด่วน", accessories: sel });
    setSession(s => [{ id: Date.now(), kind: "borrow", tag: device.assetTag, person: borrower.prefix + borrower.first + " " + borrower.last, time: nowTime(), acc: sel.length }, ...s]);
    toast("ยืม " + device.assetTag + " → " + borrower.first + (sel.length ? " · อุปกรณ์เสริม " + sel.length + " รายการ" : "") + " สำเร็จ");
    reset();
  };

  const doReturn = () => {
    if (!device || !rec) return;
    const condLabels = ["สมบูรณ์", "มีรอยเล็กน้อย", "ชำรุด"];
    const accDetails = (rec.accessories || []).map(a => {
      const ins = damage ? (retAccInsp[a.id] || { cond: 0, notes: "" }) : { cond: 0, notes: "" };
      return { id: a.id, name: a.name, cond: accLabels[ins.cond], notes: ins.notes || "", returned: ins.cond !== 3 };
    });
    window.recordReturn({
      personName: rec.holder, personKind: rec.borrowerKind, personId: rec.borrowerId, level: rec.level,
      receiver: user || "จุดบริการด่วน",
      items: [{
        borrow: rec, assetTag: rec.device, model: rec.model, deviceId: rec.deviceId,
        cond: damage ? condLabels[retCond] : "สมบูรณ์", notes: damage ? retNote : "",
        accExpected: rec.accessories || [],
        accReturnedIds: accDetails.filter(d => d.returned).map(d => d.id),
        accDetails,
      }],
    });
    const hasDmg = damage && (retCond > 0 || accDetails.some(d => d.cond !== "สมบูรณ์" && d.cond !== "ไม่คืน"));
    setSession(s => [{ id: Date.now(), kind: "return", tag: device.assetTag, person: rec.holder, time: nowTime(), dmg: hasDmg }, ...s]);
    toast("คืน " + device.assetTag + " สำเร็จ" + (hasDmg ? " · บันทึกความเสียหาย" : ""));
    reset();
  };

  const borrowCount = session.filter(s => s.kind === "borrow").length;
  const returnCount = session.filter(s => s.kind === "return").length;

  return (
    <div>
      {showCam && <QRScanner onClose={() => setShowCam(false)} onScan={raw => { setShowCam(false); const t = parseScanned(raw); setTag(t); findDevice(t); }} />}

      <PageHead crumb={["จุดบริการด่วน"]} title="จุดบริการด่วน (Quick Station)"
        desc="สแกน QR / พิมพ์ Asset Tag หรือชื่อผู้ยืม — ระบบตรวจสถานะและทำรายการได้ในหน้าจอเดียว"
        actions={<button className="btn btn-primary" onClick={() => setShowCam(true)}><Icon name="camera" size={17} />เปิดกล้องสแกน QR</button>} />

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }} className="qs-grid">
        {/* ── LEFT ── */}
        <div>
          {/* scan input */}
          <div className="card" style={{ padding: 18, marginBottom: 16, background: "linear-gradient(135deg, var(--primary-soft), transparent)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setShowCam(true)} style={{ width: 52, height: 52, borderRadius: 14, background: "var(--primary)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0, border: 0, cursor: "pointer" }}>
                <Icon name="qrcode" size={26} />
              </button>
              <div style={{ flex: 1, position: "relative" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>สแกน QR / พิมพ์ Asset Tag หรือชื่อผู้ยืม แล้วกด Enter</div>
                <form onSubmit={e => { e.preventDefault(); findDevice(); }} style={{ display: "flex", gap: 10 }}>
                  <div className="filter-input" style={{ flex: 1, height: 48, borderColor: "var(--primary)", borderWidth: 2 }}>
                    <Icon name="search" size={19} style={{ color: "var(--primary)" }} />
                    <input ref={inputRef} value={tag} onChange={e => { setTag(e.target.value); setNotFound(false); setShowSuggestions(e.target.value.length > 0); }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      placeholder={"เช่น " + ((store.ipads[0] && store.ipads[0].assetTag) || "NHP-IPD-001") + ", 01 หรือ ชื่อผู้ยืม"} autoFocus
                      style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-num)" }} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ height: 48, padding: "0 18px" }}><Icon name="search" size={17} />ค้นหา</button>
                </form>
                {/* suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="card" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 60, zIndex: 50, boxShadow: "var(--shadow-lg)", padding: 4, maxHeight: 230, overflowY: "auto" }}>
                    {suggestions.map(d => (
                      <button key={d.id} onClick={() => { setTag(d.assetTag); findDevice(d.assetTag); setShowSuggestions(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", border: 0, background: "transparent", padding: "8px 10px", borderRadius: 9, textAlign: "left", cursor: "pointer" }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface-3)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="tablet" size={15} /></div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="num" style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{d.assetTag}</div>
                          <div className="clip" style={{ fontSize: 12, color: "var(--text-3)" }}>{d.model}{d.holder ? " · " + d.holder : ""}</div>
                        </div>
                        <Badge cls={d.statusCls}>{d.status}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* empty / not found */}
          {!device && (
            <div className="card" style={{ padding: 50, textAlign: "center", color: "var(--text-3)" }}>
              {notFound ? (
                <><div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--danger-soft)", color: "var(--danger)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}><Icon name="alert" size={30} /></div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text)" }}>ไม่พบอุปกรณ์ "{tag}"</div>
                  <div style={{ fontSize: 13.5, marginTop: 5, color: "var(--text-3)" }}>ลองค้นหาด้วยชื่อผู้ยืม หรือสแกน QR บนตัวเครื่อง</div></>
              ) : (
                <><div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--surface-3)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}><Icon name="tablet" size={30} /></div>
                  <div style={{ fontWeight: 600, fontSize: 16, color: "var(--text-2)" }}>พร้อมรับการสแกน</div>
                  <div style={{ fontSize: 13.5, marginTop: 5, color: "var(--text-3)" }}>สแกน QR หรือพิมพ์ Asset Tag / ชื่อผู้ยืม</div></>
              )}
            </div>
          )}

          {/* device found */}
          {device && (
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, background: isAvailable ? "var(--ok-soft)" : isBorrowed ? "var(--info-soft)" : "var(--danger-soft)" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--surface)", display: "grid", placeItems: "center", color: "var(--text-2)", flexShrink: 0 }}><Icon name="tablet" size={25} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="num" style={{ fontWeight: 800, fontSize: 19, color: "var(--text)" }}>{device.assetTag}</div>
                  <div className="clip" style={{ fontSize: 13, color: "var(--text-2)" }}>{device.model} · {device.color} · {device.cap}</div>
                </div>
                <Badge cls={device.statusCls} dot>{device.status}</Badge>
              </div>

              <div style={{ padding: 16 }}>
                {/* BORROW */}
                {isAvailable && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 7, fontSize: 14 }}><Icon name="borrow" size={16} style={{ color: "var(--ok)" }} />เลือกผู้ยืม</div>
                      <div className="seg" style={{ transform: "scale(.9)" }}>
                        <button className={bType === "student" ? "on" : ""} onClick={() => { setBType("student"); setBorrower(null); }}>นักเรียน</button>
                        <button className={bType === "teacher" ? "on" : ""} onClick={() => { setBType("teacher"); setBorrower(null); }}>ครู</button>
                      </div>
                    </div>
                    <div className="filter-input" style={{ marginBottom: 10 }}>
                      <Icon name="search" size={16} style={{ color: "var(--text-3)" }} />
                      <input value={bq} onChange={e => setBq(e.target.value)} placeholder="ค้นหาชื่อ / รหัส / ชั้น / กลุ่มสาระ…" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))", gap: 7, maxHeight: 210, overflowY: "auto", marginBottom: 12 }}>
                      {people.map(p => (
                        <button key={p.id} onClick={() => setBorrower(p)} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 10, textAlign: "left", cursor: "pointer",
                          border: "1.5px solid " + (borrower?.id === p.id ? "var(--primary)" : "var(--border)"),
                          background: borrower?.id === p.id ? "var(--primary-soft)" : "var(--surface)",
                        }}>
                          <div className="avatar" style={{ width: 30, height: 30, fontSize: 11, flexShrink: 0 }}>{initials(p.first + " " + p.last)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div className="clip" style={{ fontWeight: 600, fontSize: 12.5, color: "var(--text)" }}>{p.first} {p.last}</div>
                            <div className="clip" style={{ fontSize: 11.5, color: "var(--text-3)" }}>{p.level ? p.level + "/" + p.room : (p.subject || "ครู")}</div>
                          </div>
                        </button>
                      ))}
                      {people.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-3)", padding: 14, fontSize: 13 }}>ไม่พบรายชื่อ</div>}
                    </div>

                    {/* accessory selection */}
                    {store.accessories.filter(a => a.qty > 0).length > 0 && (
                      <div style={{ marginBottom: 14, padding: "12px 13px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface-2)" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 9, display: "flex", alignItems: "center", gap: 6 }}>
                          <Icon name="layers" size={15} style={{ color: "var(--accent)" }} />เลือกอุปกรณ์เสริม (ถ้ามี)
                          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)", fontWeight: 400 }}>
                            {Object.values(chosenAcc).filter(v => v > 0).length} รายการ
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                          {store.accessories.filter(a => a.qty > 0).map(a => {
                            const picked = chosenAcc[a.id] || 0;
                            return (
                              <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 9, background: picked > 0 ? "var(--ok-soft)" : "var(--surface)", cursor: "pointer", fontSize: 13 }}>
                                <input type="checkbox" checked={picked > 0} onChange={() => setChosenAcc(c => ({ ...c, [a.id]: picked > 0 ? 0 : 1 }))} style={{ width: 15, height: 15, accentColor: "var(--ok)" }} />
                                <span style={{ flex: 1, fontWeight: 500, color: "var(--text)" }}>{a.name}</span>
                                <span className="num" style={{ fontSize: 11.5, color: "var(--text-3)" }}>คงเหลือ {a.qty}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 9 }}>
                      <button className="btn" style={{ flex: 1 }} onClick={reset}>ยกเลิก</button>
                      <button className="btn btn-primary" style={{ flex: 2 }} disabled={!borrower} onClick={doBorrow}>
                        <Icon name="check" size={17} />ยืมเลย{borrower ? " — " + borrower.first : ""}
                      </button>
                    </div>
                  </div>
                )}

                {/* RETURN */}
                {isBorrowed && rec && (
                  <div>
                    <div className="card" style={{ background: "var(--surface-2)", marginBottom: 12 }}>
                      <div className="kv" style={{ padding: "10px 14px" }}><span className="k">ผู้ถือครอง</span><span className="v" style={{ color: "var(--text)" }}>{rec.holder} ({rec.level})</span></div>
                      <div className="kv" style={{ padding: "10px 14px" }}><span className="k">ยืมเมื่อ · ครบกำหนด</span><span className="v num">{rec.borrowDate} → {rec.dueDate}</span></div>
                      {rec.overdueDays > 0 && <div className="kv" style={{ padding: "10px 14px" }}><span className="k">สถานะ</span><span className="v"><Badge cls="b-danger" dot>เกินกำหนด {rec.overdueDays} วัน</Badge></span></div>}
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", border: "1px solid " + (damage ? "var(--warn)" : "var(--border)"), borderRadius: 11, cursor: "pointer", marginBottom: 12, background: damage ? "var(--warn-soft)" : "transparent" }}>
                      <input type="checkbox" checked={damage} onChange={() => setDamage(d => !d)} style={{ width: 17, height: 17, accentColor: "var(--warn)" }} />
                      <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)" }}>พบความเสียหาย / ต้องตรวจสภาพ</span>
                    </label>

                    {damage && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 13, marginBottom: 14, padding: "13px 13px", border: "1px solid var(--warn)", borderRadius: 13, background: "var(--surface-2)" }}>
                        {/* device condition */}
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}><Icon name="tablet" size={13} />สภาพเครื่อง</div>
                          <div className="seg seg-cond" style={{ display: "flex", marginBottom: 8 }}>
                            {["สมบูรณ์", "มีรอยเล็กน้อย", "ชำรุด"].map((c, i) => <button key={i} className={retCond === i ? "on" : ""} style={{ flex: 1, fontSize: 12.5 }} onClick={() => setRetCond(i)}>{c}</button>)}
                          </div>
                          <textarea className="input" rows="2" value={retNote} onChange={e => setRetNote(e.target.value)} placeholder="หมายเหตุการตรวจสอบเครื่อง…" style={{ fontSize: 13, resize: "vertical" }}></textarea>
                        </div>

                        {/* per-accessory inspection */}
                        {(rec.accessories || []).length > 0 && (
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
                              <Icon name="layers" size={13} style={{ color: "var(--accent)" }} />ตรวจสภาพอุปกรณ์เสริม ({rec.accessories.length} รายการ)
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                              {rec.accessories.map(a => {
                                const ins = retAccInsp[a.id] || { cond: 0, notes: "" };
                                const missing = ins.cond === 3;
                                return (
                                  <div key={a.id} style={{ border: "1px solid " + (missing ? "var(--danger)" : "var(--border)"), borderRadius: 11, padding: "9px 11px", background: missing ? "var(--danger-soft)" : "var(--surface)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 7 }}>
                                      <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 80, color: "var(--text)" }}>{a.name}</span>
                                      <div className="seg seg-acc" style={{ display: "flex" }}>
                                        {accLabels.map((c, i) => <button key={i} className={ins.cond === i ? "on" : ""} style={{ fontSize: 11.5, padding: "5px 8px", whiteSpace: "nowrap" }} onClick={() => setRetAccInsp(prev => ({ ...prev, [a.id]: { ...ins, cond: i } }))}>{c}</button>)}
                                      </div>
                                    </div>
                                    <input className="input" value={ins.notes} onChange={e => setRetAccInsp(prev => ({ ...prev, [a.id]: { ...ins, notes: e.target.value } }))}
                                      placeholder={missing ? "สาเหตุที่ไม่คืน…" : ins.cond === 0 ? "หมายเหตุ (ถ้ามี)…" : "ระบุความเสียหาย…"}
                                      style={{ fontSize: 12.5, padding: "7px 10px" }} />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 9 }}>
                      <button className="btn" style={{ flex: 1 }} onClick={reset}>ยกเลิก</button>
                      <button className="btn btn-primary" style={{ flex: 2 }} onClick={doReturn}><Icon name="swap" size={17} />คืนเลย</button>
                    </div>
                  </div>
                )}

                {blocked && (
                  <div style={{ textAlign: "center", padding: "10px 0" }}>
                    <div style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 14 }}>อุปกรณ์นี้อยู่ในสถานะ <b style={{ color: "var(--danger)" }}>{device.status}</b> — ไม่สามารถยืม–คืนได้</div>
                    <div style={{ display: "flex", gap: 9, justifyContent: "center" }}>
                      <button className="btn" onClick={reset}>สแกนใหม่</button>
                      <button className="btn btn-primary" onClick={() => go("devices")}><Icon name="devices" size={15} />ไปจัดการอุปกรณ์</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: session ── */}
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head"><h3>สรุปรอบนี้</h3></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: 14 }}>
              <div style={{ textAlign: "center", padding: "13px 8px", background: "var(--info-soft)", borderRadius: 12 }}>
                <div className="num" style={{ fontSize: 30, fontWeight: 800, color: "var(--info)" }}>{borrowCount}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 600 }}>ยืมออก</div>
              </div>
              <div style={{ textAlign: "center", padding: "13px 8px", background: "var(--ok-soft)", borderRadius: 12 }}>
                <div className="num" style={{ fontSize: 30, fontWeight: 800, color: "var(--ok)" }}>{returnCount}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 600 }}>รับคืน</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>รายการล่าสุด</h3>{session.length > 0 && <button className="sub" style={{ color: "var(--text-3)", cursor: "pointer", fontSize: 12.5 }} onClick={() => setSession([])}>ล้าง</button>}</div>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {session.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>ยังไม่มีรายการในรอบนี้</div>
              ) : session.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: s.kind === "borrow" ? "var(--info-soft)" : "var(--ok-soft)", color: s.kind === "borrow" ? "var(--info)" : "var(--ok)" }}>
                    <Icon name={s.kind === "borrow" ? "borrow" : "swap"} size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="clip" style={{ fontWeight: 600, fontSize: 12.5, color: "var(--text)" }}>
                      <span className="num">{s.tag}</span> {s.kind === "borrow" ? "→" : "←"} {s.person}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                      {s.kind === "borrow" ? "ยืมออก" : "รับคืน"}
                      {s.acc ? " · อุปกรณ์เสริม " + s.acc : ""}
                      {s.dmg ? " · พบความเสียหาย" : ""} · {s.time} น.
                    </div>
                  </div>
                  {s.dmg && <Icon name="alert" size={14} style={{ color: "var(--warn)", flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.QuickStation = QuickStation;
