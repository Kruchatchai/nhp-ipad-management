/* ===== Borrow / Return flow + Students ===== */
const DB = window.NHP;

function Stepper({ steps, current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 26 }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center",
              fontWeight: 700, fontSize: 14, flexShrink: 0,
              background: i < current ? "var(--ok)" : i === current ? "var(--primary)" : "var(--surface-3)",
              color: i <= current ? "#fff" : "var(--text-3)",
            }} className="num">
              {i < current ? <Icon name="check" size={17} /> : i + 1}
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: i <= current ? "var(--text)" : "var(--text-3)" }}>{s}</span>
          </div>
          {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i < current ? "var(--ok)" : "var(--border)", margin: "0 14px", borderRadius: 2 }}></div>}
        </React.Fragment>
      ))}
    </div>
  );
}

function BorrowReturn({ go, user, intent }) {
  const toast = React.useContext(ToastCtx);
  const [store, setStore] = useStore();
  const TODAY = "2026-06-04";
  const [mode, setMode] = useState("borrow");
  const [step, setStep] = useState(0);
  const [device, setDevice] = useState(null);
  const [borrower, setBorrower] = useState(null);
  const [dq, setDq] = useState("");
  const [bq, setBq] = useState("");
  const [bLevel, setBLevel] = useState("all");
  const [bRoom, setBRoom] = useState("all");
  const [bType, setBType] = useState("student");
  const [due, setDue] = useState("2027-03-01");
  const [borrowDate, setBorrowDate] = useState(TODAY);
  const [retDate, setRetDate] = useState(TODAY);
  const [cond, setCond] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [borrowerPhoto, setBorrowerPhoto] = useState(null);
  const [acc, setAcc] = useState({});       // { accId: qty } chosen (borrow)
  const [retItems, setRetItems] = useState({});  // return: { assetTag: { include, cond, notes, acc:{id:qty} } }
  const [done, setDone] = useState(false);

  const approver = user || "ผู้ดูแลระบบ";

  // all devices currently held by the same person as the selected device (for return)
  const returnGroup = React.useMemo(() => {
    if (mode !== "return" || !device) return [];
    const rec = store.borrows.find(b => b.device === device.assetTag || b.deviceId === device.id);
    if (!rec) return [];
    if (rec.borrowerId != null) return store.borrows.filter(b => b.borrowerKind === rec.borrowerKind && b.borrowerId === rec.borrowerId);
    return store.borrows.filter(b => b.holder === rec.holder);
  }, [mode, device, store.borrows]);

  // seed per-device return inspection rows when the group changes
  const seedRetItems = (group) => {
    const next = {};
    group.forEach(b => {
      const a = {}; const ins = {};
      (b.accessories || []).forEach(x => { a[x.id] = x.qty; ins[x.id] = { cond: 0, notes: "" }; });
      next[b.device] = { include: true, cond: 0, notes: "", acc: a, accInsp: ins };
    });
    setRetItems(next);
  };
  const setRet = (tag, patch) => setRetItems(s => ({ ...s, [tag]: { ...s[tag], ...patch } }));
  // per-accessory inspection: cond 0=สมบูรณ์ 1=มีรอยเล็กน้อย 2=ชำรุด 3=ไม่คืน(ขาด)
  const setRetAccInsp = (tag, id, patch) => setRetItems(s => ({
    ...s, [tag]: { ...s[tag], accInsp: { ...(s[tag].accInsp || {}), [id]: { ...((s[tag].accInsp || {})[id] || { cond: 0, notes: "" }), ...patch } } },
  }));

  // arriving from "ติดตามค้างส่ง → รับคืน": jump straight into the return-inspection flow
  useEffect(() => {
    if (intent && intent.mode === "return" && intent.device) {
      setMode("return");
      setDevice(intent.device);
      // seed the per-device inspection rows so the ถัดไป/ยืนยัน button is enabled
      const rec = store.borrows.find(b => b.device === intent.device.assetTag || b.deviceId === intent.device.id);
      let group = [];
      if (rec) group = rec.borrowerId != null
        ? store.borrows.filter(b => b.borrowerKind === rec.borrowerKind && b.borrowerId === rec.borrowerId)
        : store.borrows.filter(b => b.holder === rec.holder);
      seedRetItems(group);
      setStep(1);
    }
  }, [intent]);

  const pickDevice = (d) => { setDevice(d); };
  // advance from the current step
  const next = () => {
    if (mode === "return" && step === 0 && device) {
      // seed inspection rows for ALL devices held by this person
      const rec = store.borrows.find(b => b.device === device.assetTag || b.deviceId === device.id);
      let group = [];
      if (rec) group = rec.borrowerId != null
        ? store.borrows.filter(b => b.borrowerKind === rec.borrowerKind && b.borrowerId === rec.borrowerId)
        : store.borrows.filter(b => b.holder === rec.holder);
      seedRetItems(group);
    }
    setStep(s => s + 1);
  };
  // borrow: default the 3 standard hand-over accessories to qty 1
  useEffect(() => {
    if (mode === "borrow" && step === 2 && Object.keys(acc).length === 0) {
      const a = {}; store.accessories.slice(0, 3).forEach(x => { a[x.id] = 1; }); setAcc(a);
    }
  }, [step]);
  const setAccQty = (id, qty) => setAcc(a => { const n = { ...a }; if (qty <= 0) delete n[id]; else n[id] = qty; return n; });
  const accList = store.accessories;
  const chosenAcc = accList.filter(x => acc[x.id] > 0).map(x => ({ id: x.id, name: x.name, qty: acc[x.id] }));
  const accCount = chosenAcc.length;

  // default due date = 1 March of the year the student finishes ม.6 (Gregorian)
  const gradDue = (person) => {
    if (!person || !person.level) return "2027-03-01";
    const n = parseInt((person.level.match(/\d/) || [6])[0], 10);
    const gradYear = 2026 + (6 - n) + 1;
    return gradYear + "-03-01";
  };
  useEffect(() => { if (borrower) setDue(gradDue(borrower)); }, [borrower]);

  const avail = store.ipads.filter(d => d.status === "พร้อมใช้งาน" && (dq === "" || (d.assetTag + d.model).toLowerCase().includes(dq.toLowerCase())));
  const borrowed = store.ipads.filter(d => d.status === "ถูกยืม" && (dq === "" || (d.assetTag + d.model + (d.holder || "")).toLowerCase().includes(dq.toLowerCase())));
  const people = (bType === "student" ? store.students : store.teachers).filter(s =>
    (bType === "teacher" || bLevel === "all" || s.level === bLevel) &&
    (bType === "teacher" || bRoom === "all" || s.room === +bRoom) &&
    !hasBorrowed(s) &&
    (bq === "" || (s.first + s.last + s.code).toLowerCase().includes(bq.toLowerCase()))
  );

  const reset = () => { setStep(0); setDevice(null); setBorrower(null); setDone(false); setDq(""); setBq(""); setBLevel("all"); setBRoom("all"); setBType("student"); setCond(0); setPhotos([]); setBorrowerPhoto(null); setAcc({}); setRetItems({}); setBorrowDate(TODAY); setRetDate(TODAY); };

  const confirm = () => {
    if (mode === "borrow") {
      const holderLabel = borrower.level ? borrower.level + "/" + borrower.room : "ครู";
      const overdueDays = Math.floor((parseISO(window.todayISO()) - parseISO(due)) / 86400000);
      setStore(st => ({
        ipads: st.ipads.map(d => d.id === device.id ? { ...d, status: "ถูกยืม", statusCls: "b-info", holder: borrower.prefix + borrower.first + " " + borrower.last, holderLevel: holderLabel } : d),
        accessories: st.accessories.map(x => acc[x.id] > 0 ? { ...x, qty: Math.max(0, x.qty - acc[x.id]) } : x),
        borrows: [{ id: Date.now(), device: device.assetTag, deviceId: device.id, model: device.model, type: "iPad", holder: borrower.prefix + borrower.first + " " + borrower.last, level: holderLabel, borrowDate: borrowDate, dueDate: due, overdueDays, status: overdueDays > 0 ? "เกินกำหนด" : overdueDays > -10 ? "ใกล้ครบกำหนด" : "ปกติ", approver, accessories: chosenAcc, borrowerKind: borrower.level ? "s" : "t", borrowerId: borrower.id, usageStatus: "กำลังใช้งาน" }, ...st.borrows],
        photos: borrowerPhoto ? { ...st.photos, [photoKey(borrower)]: borrowerPhoto } : st.photos,
        personStatus: { ...st.personStatus, [photoKey(borrower)]: "กำลังใช้งาน" },
        deviceEvents: { ...st.deviceEvents, [device.assetTag]: [...(st.deviceEvents[device.assetTag] || []), { holder: borrower.prefix + borrower.first + " " + borrower.last, level: holderLabel, from: borrowDate, to: null, days: null, kind: "current", year: st.year, term: "1" }] },
      }));
      logAction("ยืมอุปกรณ์", device.assetTag + " → " + borrower.prefix + borrower.first + " " + borrower.last, "b-info", approver, "overdue");
      toast("บันทึกการยืมเรียบร้อย");
    } else {
      // multi-device return: build a transaction from the inspection rows
      const rec0 = store.borrows.find(b => b.device === device.assetTag || b.deviceId === device.id);
      const condLabels = ["สมบูรณ์", "มีรอยเล็กน้อย", "ชำรุด"];
      const items = returnGroup
        .filter(b => retItems[b.device] && retItems[b.device].include)
        .map(b => {
          const r = retItems[b.device];
          const expAcc = b.accessories || [];
          const accLabels = ["สมบูรณ์", "มีรอยเล็กน้อย", "ชำรุด", "ไม่คืน"];
          const accDetails = expAcc.map(a => {
            const ins = (r.accInsp || {})[a.id] || { cond: 0, notes: "" };
            return { id: a.id, name: a.name, cond: accLabels[ins.cond], notes: ins.notes || "", returned: ins.cond !== 3 };
          });
          return {
            borrow: b, assetTag: b.device, model: b.model, deviceId: b.deviceId,
            cond: condLabels[r.cond], notes: r.notes || "",
            accExpected: expAcc,
            accReturnedIds: accDetails.filter(d => d.returned).map(d => d.id),
            accDetails,
          };
        });
      window.recordReturn({
        personName: rec0 ? rec0.holder : (device.holder || ""),
        personKind: rec0 ? rec0.borrowerKind : null,
        personId: rec0 ? rec0.borrowerId : null,
        level: rec0 ? rec0.level : (device.holderLevel || ""),
        receiver: approver,
        date: retDate.replace(/^(\d{4})/, y => String(+y + 543)),
        items,
      });
      const dmg = items.some(i => i.cond !== "สมบูรณ์");
      toast("บันทึกการคืน " + items.length + " เครื่องเรียบร้อย" + (dmg ? " · มีอุปกรณ์เสียหาย" : ""));
    }
    setDone(true);
  };

  if (done) {
    return (
      <div>
        <PageHead crumb={["ยืม–คืนอุปกรณ์"]} title="ยืม–คืนอุปกรณ์" />
        <div className="card card-pad" style={{ maxWidth: 540, margin: "40px auto", textAlign: "center", padding: 44 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--ok-soft)", color: "var(--ok)", display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
            <Icon name="check" size={38} stroke={2.5} />
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>{mode === "borrow" ? "ยืมสำเร็จ" : "คืนสำเร็จ"}</h2>
          <p style={{ color: "var(--text-3)", margin: "0 0 8px" }}>
            {mode === "borrow" ? (device?.assetTag + " · " + device?.model) : ("คืนอุปกรณ์ " + (returnGroup.filter(b => retItems[b.device] && retItems[b.device].include).length || 1) + " เครื่อง")}
          </p>
          <p style={{ color: "var(--text-2)", margin: "0 0 24px" }}>
            {mode === "borrow"
              ? <>อุปกรณ์เปลี่ยนสถานะเป็น <b style={{ color: "var(--info)" }}>ถูกยืม</b> แล้ว</>
              : <>บันทึกลง<b style={{ color: "var(--primary)" }}>ทะเบียนยืม–คืน</b> และซิงค์สถานะทั้งระบบแล้ว</>}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn" onClick={reset}><Icon name="refresh" size={16} />ทำรายการใหม่</button>
            {mode === "return"
              ? <button className="btn btn-primary" onClick={() => { reset(); go("registry"); }}><Icon name="history" size={16} />ดูทะเบียนยืม–คืน</button>
              : <button className="btn btn-primary" onClick={() => { reset(); go("dashboard"); }}><Icon name="dashboard" size={16} />ไปหน้าแดชบอร์ด</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHead crumb={["ยืม–คืนอุปกรณ์"]} title="ยืม–คืนอุปกรณ์" desc="บันทึกการยืมและคืนครุภัณฑ์ดิจิทัล" />

      <div className="seg" style={{ marginBottom: 22 }}>
        <button className={mode === "borrow" ? "on" : ""} onClick={() => { setMode("borrow"); reset(); }}><Icon name="borrow" size={15} style={{ marginRight: 6, verticalAlign: -3 }} />ยืมอุปกรณ์</button>
        <button className={mode === "return" ? "on" : ""} onClick={() => { setMode("return"); reset(); }}><Icon name="swap" size={15} style={{ marginRight: 6, verticalAlign: -3 }} />คืนอุปกรณ์</button>
      </div>

      <div className="card card-pad" style={{ maxWidth: 860, margin: "0 auto" }}>
        {mode === "borrow" ? (
          <Stepper steps={["เลือกอุปกรณ์", "เลือกผู้ยืม", "รายละเอียด", "ยืนยัน"]} current={step} />
        ) : (
          <Stepper steps={["เลือกอุปกรณ์", "ตรวจสภาพ", "ยืนยัน"]} current={step} />
        )}

        {/* STEP 0: choose device */}
        {step === 0 && (
          <div>
            <div className="filter-input" style={{ marginBottom: 16 }}>
              <Icon name="search" size={17} style={{ color: "var(--text-3)" }} />
              <input placeholder={mode === "borrow" ? "ค้นหาอุปกรณ์ที่พร้อมใช้งาน…" : "ค้นหาอุปกรณ์ที่ถูกยืม…"} value={dq} onChange={e => setDq(e.target.value)} autoFocus />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "2px 2px 10px" }}>
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>{mode === "borrow" ? "พร้อมให้ยืม" : "กำลังถูกยืม"} <b className="num" style={{ color: "var(--text)" }}>{(mode === "borrow" ? avail : borrowed).length}</b> เครื่อง</span>
              {device && <span style={{ fontSize: 12.5, color: "var(--primary)", fontWeight: 600 }}>✓ เลือก {device.assetTag}</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12, maxHeight: 420, overflowY: "auto", padding: 2 }}>
              {(mode === "borrow" ? avail : borrowed).length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 30, color: "var(--text-3)" }}>ไม่พบอุปกรณ์</div>}
              {(mode === "borrow" ? avail : borrowed).map(d => (
                <button key={d.id} onClick={() => pickDevice(d)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: 13, borderRadius: 13,
                  border: "1px solid " + (device?.id === d.id ? "var(--primary)" : "var(--border)"),
                  background: device?.id === d.id ? "var(--primary-soft)" : "var(--surface)", textAlign: "left",
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface-3)", display: "grid", placeItems: "center", color: "var(--text-2)", flexShrink: 0 }}>
                    <Icon name={d.type === "ipad" ? "tablet" : d.type === "camera" ? "camera" : "laptop"} size={20} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="num" style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>{d.assetTag}</div>
                    <div className="clip" style={{ fontSize: 12.5, color: "var(--text-3)" }}>{d.model}{d.holder ? " · " + d.holder : ""}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BORROW STEP 1: choose borrower */}
        {mode === "borrow" && step === 1 && (
          <div>
            <div className="seg" style={{ marginBottom: 14 }}>
              <button className={bType === "student" ? "on" : ""} onClick={() => setBType("student")}><Icon name="students" size={15} style={{ marginRight: 6, verticalAlign: -3 }} />นักเรียน</button>
              <button className={bType === "teacher" ? "on" : ""} onClick={() => setBType("teacher")}><Icon name="teacher" size={15} style={{ marginRight: 6, verticalAlign: -3 }} />ครู / บุคลากร</button>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <div className="filter-input" style={{ flex: 1, minWidth: 200 }}>
                <Icon name="search" size={17} style={{ color: "var(--text-3)" }} />
                <input placeholder={bType === "student" ? "ค้นหานักเรียน (ชื่อ / รหัส)…" : "ค้นหาครู (ชื่อ / รหัส)…"} value={bq} onChange={e => setBq(e.target.value)} autoFocus />
              </div>
              {bType === "student" && <>
                <select className="select" style={{ width: "auto", minWidth: 120 }} value={bLevel} onChange={e => setBLevel(e.target.value)}>
                  <option value="all">ทุกชั้น</option>{DB.levels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select className="select" style={{ width: "auto", minWidth: 110 }} value={bRoom} onChange={e => setBRoom(e.target.value)}>
                  <option value="all">ทุกห้อง</option>{[1, 2, 3, 4].map(r => <option key={r} value={r}>ห้อง {r}</option>)}
                </select>
              </>}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-3)", margin: "0 2px 8px" }}>{bType === "student" ? "นักเรียน" : "ครู / บุคลากร"}ที่ยืมได้ <b className="num" style={{ color: "var(--text)" }}>{people.length}</b> คน</div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {people.map(p => (
                <button key={p.id} onClick={() => setBorrower(p)} style={{
                  display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 12, width: "100%",
                  border: "1px solid " + (borrower?.id === p.id ? "var(--primary)" : "transparent"),
                  background: borrower?.id === p.id ? "var(--primary-soft)" : "transparent", textAlign: "left", marginBottom: 4,
                }}>
                  <div className={"avatar" + (p.sex === "หญิง" ? " orange" : "")} style={{ width: 38, height: 38 }}>{initials(p.first)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>{p.prefix}{p.first} {p.last}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-3)" }} className="num">{p.code} · {bType === "student" ? p.level + "/" + p.room + " เลขที่ " + p.no : p.subject}</div>
                  </div>
                  <Icon name="chevR" size={17} style={{ color: "var(--text-3)" }} />
                </button>
              ))}
              {people.length === 0 && <Empty title="ไม่พบรายชื่อ" sub="ลองปรับตัวกรอง" />}
            </div>
          </div>
        )}

        {/* BORROW STEP 2: details */}
        {mode === "borrow" && step === 2 && (
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="field"><label>วันที่ยืม</label>
                <BEDatePicker value={borrowDate} onChange={setBorrowDate} />
              </div>
              <div className="field"><label>วันครบกำหนดคืน</label>
                <BEDatePicker value={due} onChange={setDue} min={TODAY} />
                {bType === "student" && borrower && (
                  <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                    <Icon name="graduation" size={13} style={{ color: "var(--accent)" }} />ค่าเริ่มต้น = 1 มี.ค. ปีที่จบ ม.6 ({borrower.level})
                  </div>
                )}
              </div>
            </div>
            <div className="field"><label>ผู้อนุมัติ</label>
              <div className="filter-input" style={{ height: 44, background: "var(--surface-2)" }}>
                <Icon name="shield" size={17} style={{ color: "var(--primary)" }} />
                <input value={approver} readOnly style={{ fontWeight: 600 }} />
                <span className="badge b-info" style={{ marginLeft: "auto" }}>ผู้ทำรายการ</span>
              </div>
            </div>
            <div className="field">
              <PersonPhotoField value={borrowerPhoto} onChange={setBorrowerPhoto} sex={borrower ? borrower.sex : "ชาย"} label={"รูปถ่ายผู้ยืม" + (borrower ? " — " + borrower.prefix + borrower.first + " " + borrower.last : "")} />
            </div>
            <div className="field">
              <label style={{ display: "flex", justifyContent: "space-between" }}>
                <span>อุปกรณ์เสริมที่ส่งมอบ</span>
                <span style={{ color: "var(--text-3)", fontWeight: 400 }}>เลือก {accCount} รายการ</span>
              </label>
              <AccessoryStockChecklist accessories={accList} chosen={acc} onSet={setAccQty} accent="var(--primary)" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}><label>หมายเหตุ</label><textarea className="input" rows="2" placeholder="ระบุเงื่อนไขการยืม เช่น ใช้สำหรับการเรียนวิชา…"></textarea></div>
          </div>
        )}

        {/* BORROW STEP 3: confirm */}
        {mode === "borrow" && step === 3 && (
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div className="card" style={{ background: "var(--surface-2)" }}>
              <div className="kv" style={{ padding: "13px 18px" }}><span className="k">อุปกรณ์</span><span className="v num">{device?.assetTag} · {device?.model}</span></div>
              <div className="kv" style={{ padding: "13px 18px" }}><span className="k">ผู้ยืม</span><span className="v">{borrower?.prefix}{borrower?.first} {borrower?.last}{borrower?.level ? ` (${borrower.level}/${borrower.room})` : ` (ครู · ${borrower?.subject || ""})`}</span></div>
              <div className="kv" style={{ padding: "13px 18px" }}><span className="k">วันที่</span><span className="v">{beLong(borrowDate)}</span></div>
              <div className="kv" style={{ padding: "13px 18px" }}><span className="k">ครบกำหนดคืน</span><span className="v">{beLong(due)}</span></div>
              <div className="kv" style={{ padding: "13px 18px", alignItems: "flex-start" }}>
                <span className="k">อุปกรณ์เสริมที่ส่งมอบ</span>
                <span className="v" style={{ maxWidth: "62%" }}>
                  {accCount === 0 ? "—" : <Badge cls="b-ok" dot>{accCount} รายการ · {chosenAcc.reduce((s, a) => s + a.qty, 0)} ชิ้น</Badge>}
                  {accCount > 0 && <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 5 }}>{chosenAcc.map(a => a.name + " ×" + a.qty).join(", ")}</div>}
                </span>
              </div>
              {borrowerPhoto && <div className="kv" style={{ padding: "13px 18px" }}><span className="k">รูปผู้ยืม</span><img src={borrowerPhoto} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} /></div>}
              <div className="kv" style={{ padding: "13px 18px" }}><span className="k">ผู้อนุมัติ</span><span className="v">{approver}</span></div>
            </div>
          </div>
        )}

        {/* RETURN STEP 2: confirm (multi-device) */}
        {mode === "return" && step === 2 && (() => {
          const rec0 = store.borrows.find(b => b.device === device?.assetTag || b.deviceId === device?.id);
          const condLabels = ["สมบูรณ์", "มีรอยเล็กน้อย", "ชำรุด"];
          const condCls = ["b-ok", "b-warn", "b-danger"];
          const included = returnGroup.filter(b => retItems[b.device] && retItems[b.device].include);
          const damaged = included.filter(b => retItems[b.device].cond > 0).length;
          const anyMissing = included.some(b => {
            const r = retItems[b.device];
            return (b.accessories || []).some(a => ((r.accInsp || {})[a.id] || {}).cond === 3);
          });
          const accDmg = included.some(b => {
            const r = retItems[b.device];
            return (b.accessories || []).some(a => { const c = ((r.accInsp || {})[a.id] || {}).cond; return c === 1 || c === 2; });
          });
          return (
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
              <div className="card" style={{ background: "var(--surface-2)", marginBottom: 14 }}>
                <div className="kv" style={{ padding: "13px 18px" }}><span className="k">ผู้คืน</span><span className="v">{rec0 ? rec0.holder : device?.holder} ({rec0 ? rec0.level : device?.holderLevel})</span></div>
                <div className="kv" style={{ padding: "13px 18px" }}><span className="k">วันที่คืน</span><span className="v">{beLong(retDate)}</span></div>
                <div className="kv" style={{ padding: "13px 18px" }}><span className="k">จำนวนที่คืน</span><span className="v num">{included.length} เครื่อง</span></div>
                <div className="kv" style={{ padding: "13px 18px" }}><span className="k">สถานะการคืน</span><span className="v">{anyMissing ? <Badge cls="b-danger" dot>คืนไม่ครบ</Badge> : <Badge cls="b-ok" dot>คืนครบ</Badge>}{damaged > 0 && <Badge cls="b-warn" dot style={{ marginLeft: 6 }}>เครื่องเสียหาย {damaged}</Badge>}{accDmg && <Badge cls="b-warn" dot style={{ marginLeft: 6 }}>อุปกรณ์เสริมเสียหาย</Badge>}</span></div>
                <div className="kv" style={{ padding: "13px 18px" }}><span className="k">ผู้รับคืน</span><span className="v">{approver}</span></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {included.map(b => {
                  const r = retItems[b.device];
                  const missing = (b.accessories || []).filter(a => ((r.accInsp || {})[a.id] || {}).cond === 3).map(a => a.name);
                  const accBad = (b.accessories || []).filter(a => { const c = ((r.accInsp || {})[a.id] || {}).cond; return c === 1 || c === 2; }).map(a => a.name);
                  return (
                    <div key={b.device} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", border: "1px solid var(--border)", borderRadius: 11 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--surface-3)", display: "grid", placeItems: "center", color: "var(--text-2)", flexShrink: 0 }}><Icon name="tablet" size={17} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="num" style={{ fontWeight: 600, fontSize: 13.5 }}>{b.device}</div>
                        {missing.length > 0 && <div style={{ fontSize: 12, color: "var(--danger)" }}>อุปกรณ์เสริมที่ขาด: {missing.join(", ")}</div>}
                        {accBad.length > 0 && <div style={{ fontSize: 12, color: "var(--warn)" }}>อุปกรณ์เสริมเสียหาย: {accBad.join(", ")}</div>}
                        {r.notes && <div className="clip" style={{ fontSize: 12, color: "var(--text-3)" }}>หมายเหตุ: {r.notes}</div>}
                      </div>
                      <Badge cls={condCls[r.cond]} dot>{condLabels[r.cond]}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* RETURN STEP 1: per-device inspection table */}
        {mode === "return" && step === 1 && (
          <div>
            {(() => {
              const rec0 = store.borrows.find(b => b.device === device?.assetTag || b.deviceId === device?.id);
              const holderName = rec0 ? rec0.holder : (device?.holder || "");
              const holderLevel = rec0 ? rec0.level : (device?.holderLevel || "");
              const condLabels = ["สมบูรณ์", "มีรอยเล็กน้อย", "ชำรุด"];
              const condCls = ["b-ok", "b-warn", "b-danger"];
              const included = returnGroup.filter(b => retItems[b.device] && retItems[b.device].include);
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 16px", background: "var(--surface-2)", borderRadius: 13, marginBottom: 16 }}>
                    <div className="avatar" style={{ width: 42, height: 42 }}>{initials((holderName || "").replace(/^(เด็กชาย|เด็กหญิง|นางสาว|นาง|นาย|ครู)/, ""))}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{holderName}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{holderLevel} · ถือครอง {returnGroup.length} เครื่อง</div>
                    </div>
                    <Badge cls="b-info" dot>เลือกคืน {included.length}/{returnGroup.length}</Badge>
                  </div>

                  <div style={{ fontSize: 13.5, fontWeight: 600, margin: "0 2px 10px", display: "flex", alignItems: "center", gap: 7 }}>
                    <Icon name="check2" size={16} style={{ color: "var(--primary)" }} />ตรวจสภาพอุปกรณ์เป็นรายเครื่อง
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {returnGroup.map(b => {
                      const r = retItems[b.device] || { include: true, cond: 0, notes: "", acc: {} };
                      const expAcc = b.accessories || [];
                      return (
                        <div key={b.device} style={{ border: "1px solid " + (r.include ? "var(--border-strong)" : "var(--border)"), borderRadius: 14, overflow: "hidden", opacity: r.include ? 1 : 0.55, transition: "opacity .15s" }}>
                          {/* row header: device + include toggle */}
                          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", background: "var(--surface-2)", borderBottom: r.include ? "1px solid var(--border)" : "none" }}>
                            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                              <input type="checkbox" checked={r.include} onChange={() => setRet(b.device, { include: !r.include })} style={{ width: 18, height: 18, accentColor: "var(--primary)" }} />
                            </label>
                            <div style={{ width: 38, height: 38, borderRadius: 9, background: "var(--surface-3)", display: "grid", placeItems: "center", color: "var(--text-2)", flexShrink: 0 }}><Icon name="tablet" size={19} /></div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="num" style={{ fontWeight: 700, fontSize: 14 }}>{b.device}</div>
                              <div className="clip" style={{ fontSize: 12.5, color: "var(--text-3)" }}>{b.model} · ยืม {b.borrowDate}</div>
                            </div>
                            {r.include && <Badge cls={condCls[r.cond]} dot>{condLabels[r.cond]}</Badge>}
                          </div>

                          {r.include && (
                            <div style={{ padding: "14px 15px", display: "flex", flexDirection: "column", gap: 16 }}>
                              {/* device condition + note */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="ret-row-grid">
                                <div>
                                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>สภาพเครื่อง</div>
                                  <div className="seg seg-cond" style={{ display: "flex" }}>
                                    {condLabels.map((c, i) => <button key={i} className={r.cond === i ? "on" : ""} style={{ flex: 1, fontSize: 12.5, padding: "7px 4px" }} onClick={() => setRet(b.device, { cond: i })}>{c}</button>)}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>หมายเหตุการตรวจสอบเครื่อง</div>
                                  <textarea className="input" rows="2" value={r.notes} onChange={e => setRet(b.device, { notes: e.target.value })} placeholder={r.cond === 0 ? "ไม่มีความเสียหาย…" : "ระบุความเสียหาย / สิ่งที่พบ…"} style={{ fontSize: 13, resize: "vertical" }}></textarea>
                                </div>
                              </div>

                              {/* per-accessory inspection — same depth as the device */}
                              <div>
                                {(() => {
                                  const accLabels = ["สมบูรณ์", "มีรอยเล็กน้อย", "ชำรุด", "ไม่คืน"];
                                  const accCls = ["b-ok", "b-warn", "b-danger", "b-muted"];
                                  const ins = (id) => (r.accInsp || {})[id] || { cond: 0, notes: "" };
                                  const okCount = expAcc.filter(a => ins(a.id).cond !== 3).length;
                                  return (
                                    <>
                                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="layers" size={14} style={{ color: "var(--primary)" }} />ตรวจสภาพอุปกรณ์เสริม</span>
                                        <span style={{ color: "var(--text-3)", fontWeight: 400 }}>รับคืน {okCount}/{expAcc.length}</span>
                                      </div>
                                      {expAcc.length === 0 ? (
                                        <div style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--text-3)", border: "1px dashed var(--border-strong)", borderRadius: 10 }}>ไม่มีอุปกรณ์เสริม</div>
                                      ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                          {expAcc.map(a => {
                                            const it = ins(a.id);
                                            const missing = it.cond === 3;
                                            return (
                                              <div key={a.id} style={{ border: "1px solid " + (missing ? "var(--danger)" : "var(--border)"), borderRadius: 11, padding: "10px 12px", background: missing ? "var(--danger-soft)" : "var(--surface)" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                                  <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--surface-3)", display: "grid", placeItems: "center", color: "var(--text-2)", flexShrink: 0 }}><Icon name="layers" size={13} /></span>
                                                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 100 }}>{a.name}</span>
                                                  <div className="seg seg-acc" style={{ display: "flex" }}>
                                                    {accLabels.map((c, i) => <button key={i} className={it.cond === i ? "on" : ""} style={{ fontSize: 11.5, padding: "5px 9px", whiteSpace: "nowrap" }} onClick={() => setRetAccInsp(b.device, a.id, { cond: i })}>{c}</button>)}
                                                  </div>
                                                </div>
                                                <input className="input" value={it.notes} onChange={e => setRetAccInsp(b.device, a.id, { notes: e.target.value })}
                                                  placeholder={missing ? "ระบุสาเหตุที่ไม่คืน / สูญหาย…" : it.cond === 0 ? "หมายเหตุ (ถ้ามี)…" : "ระบุความเสียหายของอุปกรณ์เสริม…"}
                                                  style={{ fontSize: 12.5, marginTop: 9, padding: "7px 10px" }} />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {returnGroup.length === 0 && <Empty title="ไม่พบรายการยืม" sub="อุปกรณ์นี้ไม่มีบันทึกการยืมที่ค้างอยู่" />}
                  </div>

                  <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 7 }}>วันที่คืน</div>
                      <BEDatePicker value={retDate} onChange={setRetDate} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 7 }}>รูปถ่ายประกอบการคืน (ทั้งชุด)</div>
                      <PhotoUpload value={photos} onChange={setPhotos} hint="ถ่ายหรือแนบรูปสภาพเครื่องที่คืน" multiple={true} />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* nav buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
          <button className="btn" disabled={step === 0} onClick={() => setStep(s => s - 1)}><Icon name="chevL" size={16} />ย้อนกลับ</button>
          {((mode === "borrow" && step < 3) || (mode === "return" && step < 2)) ? (
            <button className="btn btn-primary" disabled={(step === 0 && !device) || (mode === "borrow" && step === 1 && !borrower) || (mode === "return" && step === 1 && returnGroup.filter(b => (retItems[b.device] || { include: true }).include).length === 0)} onClick={next}>ถัดไป<Icon name="chevR" size={16} /></button>
          ) : (
            <button className="btn btn-primary" onClick={confirm}><Icon name="check" size={17} />ยืนยันการ{mode === "borrow" ? "ยืม" : "คืน"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
window.BorrowReturn = BorrowReturn;

/* ===== Students ===== */
function StudentDetail({ student, onClose, go, onEdit, onDelete }) {
  const [store] = useStore();
  const recs = borrowsOf(student);
  const held = recs.map(b => ({ rec: b, dev: store.ipads.find(d => d.id === b.deviceId || d.assetTag === b.device) }));
  const photo = getPhoto(student);
  const acts = window.personActivity(student);
  return (
    <Drawer title="ข้อมูลนักเรียน" onClose={onClose}
      footer={<><button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={() => { onClose(); onDelete(student); }}><Icon name="trash" size={16} />ลบ</button><button className="btn" onClick={onClose}>ปิด</button><button className="btn btn-primary" onClick={() => { onClose(); onEdit(student); }}><Icon name="edit" size={16} />แก้ไขข้อมูล</button></>}>
      <div style={{ display: "flex", gap: 17, alignItems: "center", marginBottom: 20 }}>
        {photo
          ? <img src={photo} alt="" style={{ width: 96, height: 96, borderRadius: 20, objectFit: "cover", flexShrink: 0, boxShadow: "var(--shadow)" }} />
          : <div className={"avatar" + (student.sex === "หญิง" ? " orange" : "")} style={{ width: 96, height: 96, fontSize: 38, borderRadius: 20, flexShrink: 0 }}>{initials(student.first)}</div>}
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{student.prefix}{student.first} {student.last}</div>
          <div className="num" style={{ color: "var(--text-2)" }}>{student.code} · {student.level}/{student.room} เลขที่ {student.no}</div>
          <div style={{ marginTop: 8 }}><Badge cls={student.status === "กำลังศึกษา" ? "b-ok" : "b-warn"} dot>{student.status}</Badge></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">เลขประจำตัวประชาชน</span><span className="v num">{student.citizen}</span></div>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">เบอร์โทร</span><span className="v num">{student.phone}</span></div>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">ผู้ปกครอง</span><span className="v">{student.parent}</span></div>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">เบอร์ผู้ปกครอง</span><span className="v num">{student.parentPhone}</span></div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 11, display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="box" size={17} style={{ color: "var(--primary)" }} />อุปกรณ์ที่ถือครอง
      </div>
      {held.length > 0 ? held.map(({ rec, dev }, idx) => (
        <div key={idx} className="card card-pad" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, cursor: "pointer" }} onClick={() => { onClose(); go("devices"); }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--primary-soft)", display: "grid", placeItems: "center", color: "var(--primary)", flexShrink: 0 }}>
              <Icon name="tablet" size={21} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{rec.model} <span className="num" style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 13 }}>· {rec.device}</span></div>
              <div className="num" style={{ fontSize: 12.5, color: "var(--text-3)" }}>S/N: {dev ? dev.serial : "—"} · ยืม {beShort(rec.borrowDate)}</div>
            </div>
            <Badge cls="b-info" dot>ถูกยืม</Badge>
          </div>
          {(rec.accessories || []).length > 0 && (
            <div style={{ marginTop: 11, paddingTop: 11, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}><Icon name="layers" size={13} style={{ color: "var(--accent)" }} />อุปกรณ์เสริมที่ได้รับ</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {rec.accessories.map((a, i) => <span key={i} className="badge b-accent">{a.name} ×{a.qty}</span>)}
              </div>
            </div>
          )}
        </div>
      )) : (
        <div className="card card-pad" style={{ padding: 18, textAlign: "center", color: "var(--text-3)", fontSize: 13.5, marginBottom: 10 }}>ยังไม่มีอุปกรณ์ที่ถือครองอยู่</div>
      )}

      <div style={{ fontWeight: 700, fontSize: 15, margin: "20px 0 11px", display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="history" size={17} style={{ color: "var(--accent)" }} />ประวัติการใช้งาน
      </div>
      <div style={{ position: "relative", paddingLeft: 26 }}>
        <div style={{ position: "absolute", left: 6, top: 6, bottom: 10, width: 2, background: "var(--border)" }}></div>
        {acts.length > 0 ? acts.map((a, i) => (
          <div key={i} style={{ position: "relative", paddingBottom: 16 }}>
            <div style={{ position: "absolute", left: -26, top: 3, width: 14, height: 14, borderRadius: "50%", background: "var(--surface)", border: "3px solid " + (a.kind === "return" ? "var(--ok)" : a.kind === "repair" ? "var(--warn)" : a.kind === "audit" ? "var(--text-3)" : "var(--info)") }}></div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <Badge cls={a.cls} dot>{a.label}</Badge>
              <span className="num" style={{ fontSize: 12.5, color: "var(--text-3)" }}>{beShort(a.date)}</span>
            </div>
            {a.device ? <>
              <div style={{ fontSize: 13.5, marginTop: 4 }}>{a.model} <span className="num" style={{ color: "var(--text-3)" }}>· {a.device}</span></div>
              <div className="num" style={{ fontSize: 12, color: "var(--text-3)" }}>S/N: {a.serial}{a.note ? " · " + a.note : ""}</div>
            </> : (a.note && <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 3 }}>{a.note}</div>)}
          </div>
        )) : <div style={{ color: "var(--text-3)", fontSize: 13.5 }}>ยังไม่มีประวัติการใช้งาน</div>}
      </div>
    </Drawer>
  );
}

function Students({ go, intent }) {
  const toast = React.useContext(ToastCtx);
  const [store, setStore] = useStore();
  const students = store.students;
  const setStudents = (v) => setStore(st => ({ students: typeof v === "function" ? v(st.students) : v }));
  const rooms = (store.rooms && store.rooms.length ? store.rooms : (DB.rooms || [1, 2, 3, 4]));
  const setRooms = (v) => {
    const list = typeof v === "function" ? v(rooms) : v;
    setStore({ rooms: list });
    if (window.SB && window.SB.live) window.SB.saveSettings({ rooms: list });
  };
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("all");
  const [room, setRoom] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [promote, setPromote] = useState(false);
  const [promoBackup, setPromoBackup] = useState(null);
  const [roomMgr, setRoomMgr] = useState(false);
  const [sel, setSel] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [bulkDel, setBulkDel] = useState(false);
  const [page, setPage] = useState(1);
  const per = 14;
  const form = useRef({});
  const [formPhoto, setFormPhoto] = useState(null);

  const stuHeaders = ["รหัสนักเรียน", "เลขประจำตัวประชาชน", "คำนำหน้า", "ชื่อ", "นามสกุล", "เพศ", "ชั้น", "ห้อง", "เลขที่", "เบอร์โทร", "ผู้ปกครอง", "เบอร์ผู้ปกครอง", "สถานะ"];
  const stuSample = ["69001", "1 2345 67890 12 3", "เด็กชาย", "สมชาย", "ใจดี", "ชาย", "ม.1", "1", "1", "0812345678", "นางสมหญิง ใจดี", "0898765432", "กำลังศึกษา"];
  const doExport = () => {
    exportExcel("นักเรียน_NHP_2569", stuHeaders, students.map(s => [s.code, s.citizen, s.prefix, s.first, s.last, s.sex, s.level, s.room, s.no, s.phone, s.parent, s.parentPhone, s.status]));
    toast("ส่งออก " + students.length + " รายการเป็น Excel");
  };

  const heldBy = (s) => DB.studentDevices(s);
  const filtered = students.filter(s =>
    (level === "all" || (level === "grad" ? s.graduated : (!s.graduated && s.level === level))) &&
    (room === "all" || s.room === +room) &&
    (statusF === "all" || personDeviceStatus(s) === statusF) &&
    (q === "" || (s.first + s.last + s.code).toLowerCase().includes(q.toLowerCase()))
  );
  const pages = Math.ceil(filtered.length / per);
  const shown = filtered.slice((page - 1) * per, page * per);
  useEffect(() => setPage(1), [q, level, room, statusF]);
  // arriving from Settings status-lookup → preset the status filter
  useEffect(() => { if (intent && intent.statusF) setStatusF(intent.statusF); }, [intent]);

  const openAdd = () => { form.current = { prefix: "เด็กชาย", sex: "ชาย", level: "ม.1", room: rooms[0] }; setFormPhoto(null); setAdd(true); };
  const openEdit = (s) => { form.current = { ...s }; setFormPhoto(getPhoto(s)); setEdit(s); };
  const saveAdd = () => {
    const f = form.current;
    const id = Date.now();
    const nd = { ...f, id, room: +f.room, no: filtered.length + 1, code: f.code || ("69" + String(Date.now()).slice(-4)), status: "กำลังศึกษา", phone: f.phone || "08x-xxx-xxxx", parent: f.parent || "-", parentPhone: f.parentPhone || "-", citizen: f.citizen || "-" };
    setStore(st => ({ students: [nd, ...st.students], photos: formPhoto ? { ...st.photos, ["s:" + id]: formPhoto } : st.photos }));
    setAdd(false); logAction("เพิ่มนักเรียน", nd.prefix + nd.first + " " + nd.last, "b-ok"); toast("เพิ่มนักเรียนเรียบร้อย");
  };
  const saveEdit = () => {
    const f = form.current;
    setStore(st => ({
      students: st.students.map(s => s.id === edit.id ? { ...s, ...f, room: +f.room } : s),
      photos: { ...st.photos, ["s:" + edit.id]: formPhoto || undefined },
    }));
    setEdit(null); logAction("แก้ไขข้อมูล", "นักเรียน " + f.first + " " + f.last, "b-warn"); toast("บันทึกการแก้ไขแล้ว");
  };
  const doDelete = () => { setStudents(students.filter(s => s.id !== del.id)); logAction("ลบรายการ", "นักเรียน " + del.first + " " + del.last, "b-danger"); toast("ลบนักเรียนแล้ว", "trash"); setDel(null); };

  const toggleSel = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const allShownSelected = shown.length > 0 && shown.every(s => selected.includes(s.id));
  const toggleAllShown = () => setSelected(s => allShownSelected ? s.filter(id => !shown.some(d => d.id === id)) : [...new Set([...s, ...shown.map(d => d.id)])]);
  const doBulkDelete = () => { setStudents(students.filter(s => !selected.includes(s.id))); toast("ลบนักเรียน " + selected.length + " คนแล้ว", "trash"); setSelected([]); setBulkDel(false); };

  const doPromote = () => {
    const map = { "ม.1": "ม.2", "ม.2": "ม.3", "ม.4": "ม.5", "ม.5": "ม.6" };
    let grad = 0, moved = 0, kept = 0;
    const next = [];
    students.forEach(s => {
      if (s.level === "ม.3" || s.level === "ม.6") {
        grad++;
        const gradLabel = s.level === "ม.3" ? "จบ ม.ต้น" : "จบ ม.ปลาย";
        // graduate still holding an iPad → KEEP in system for follow-up; others leave
        if (borrowsOf(s).length > 0) {
          kept++;
          next.push({ ...s, graduated: true, gradLevel: gradLabel, prevLevel: s.level + "/" + s.room, status: "จบการศึกษา" });
        }
        return;
      }
      moved++;
      next.push({ ...s, level: map[s.level] || s.level });
    });
    const prevYear = store.year || "2569";
    setPromoBackup({ students: students.map(x => ({ ...x })), year: prevYear });  // snapshot for undo
    setStudents(next);
    const nextYear = String(parseInt(prevYear) + 1);
    window.setAcademicYear(nextYear);
    setPromote(false);
    logAction("เลื่อนชั้นประจำปี", `เลื่อน ${moved} คน · จบการศึกษา ${grad} คน · คงไว้ติดตามคืน ${kept} คน · ปีการศึกษา ${nextYear}`, "b-purple", "ผู้ดูแลระบบ", "students");
    toast(`เลื่อนชั้น ${moved} คน · จบ ${grad} คน` + (kept ? ` · คงไว้ติดตามคืน ${kept} คน` : "") + ` · ปีการศึกษา ${nextYear}`);
  };
  const undoPromote = () => {
    if (!promoBackup) return;
    setStudents(promoBackup.students);
    window.setAcademicYear(promoBackup.year);
    logAction("ย้อนกลับการเลื่อนชั้น", `คืนค่าปีการศึกษา ${promoBackup.year}`, "b-warn", "ผู้ดูแลระบบ", "students");
    toast(`ย้อนกลับการเลื่อนชั้นแล้ว · ปีการศึกษา ${promoBackup.year}`, "swap");
    setPromoBackup(null);
  };

  const StudentForm = ({ isEdit }) => (
    <div>
      <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid var(--border)" }}>
        <PersonPhotoField value={formPhoto} onChange={setFormPhoto} sex={form.current.sex} label="รูปนักเรียน" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div className="field"><label>รหัสนักเรียน</label><input className="input num" defaultValue={form.current.code || ""} placeholder="เช่น 69001" onChange={e => form.current.code = e.target.value} /></div>
      <div className="field"><label>เลขประจำตัวประชาชน</label><input className="input num" defaultValue={form.current.citizen || ""} placeholder="1 2345 67890 12 3" onChange={e => form.current.citizen = e.target.value} /></div>
      <div className="field"><label>คำนำหน้า</label><select className="select" defaultValue={form.current.prefix} onChange={e => form.current.prefix = e.target.value}><option>เด็กชาย</option><option>เด็กหญิง</option><option>นาย</option><option>นางสาว</option></select></div>
      <div className="field"><label>เพศ</label><select className="select" defaultValue={form.current.sex} onChange={e => form.current.sex = e.target.value}><option>ชาย</option><option>หญิง</option></select></div>
      <div className="field"><label>ชื่อ</label><input className="input" defaultValue={form.current.first || ""} onChange={e => form.current.first = e.target.value} /></div>
      <div className="field"><label>นามสกุล</label><input className="input" defaultValue={form.current.last || ""} onChange={e => form.current.last = e.target.value} /></div>
      <div className="field"><label>ชั้น</label><select className="select" defaultValue={form.current.level} onChange={e => form.current.level = e.target.value}>{DB.levels.map(l => <option key={l}>{l}</option>)}</select></div>
      <div className="field"><label>ห้อง</label><select className="select" defaultValue={form.current.room} onChange={e => form.current.room = e.target.value}>{rooms.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
      <div className="field"><label>เบอร์โทร</label><input className="input num" defaultValue={form.current.phone || ""} onChange={e => form.current.phone = e.target.value} /></div>
      <div className="field"><label>ชื่อผู้ปกครอง</label><input className="input" defaultValue={form.current.parent || ""} onChange={e => form.current.parent = e.target.value} /></div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHead crumb={["จัดการนักเรียน"]} title="นักเรียน" desc={`ทั้งหมด ${students.length} คน · ปีการศึกษา ${store.year}`}
        actions={<>
          <button className="btn" onClick={() => setRoomMgr(true)}><Icon name="grid" size={17} />จัดการห้อง</button>
          <button className="btn" onClick={() => setPromote(true)}><Icon name="graduation" size={17} />เลื่อนชั้นประจำปี</button>
          <button className="btn" onClick={() => setImportOpen(true)}><Icon name="upload" size={17} />นำเข้า Excel</button>
          <button className="btn" onClick={doExport}><Icon name="download" size={17} />ส่งออก Excel</button>
          <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={17} />เพิ่มนักเรียน</button>
        </>} />

      <div className="toolbar">
        <div className="filter-input" style={{ minWidth: 260 }}>
          <Icon name="search" size={17} style={{ color: "var(--text-3)" }} />
          <input placeholder="ค้นหาชื่อ หรือรหัสนักเรียน…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="select" style={{ width: "auto", minWidth: 120 }} value={level} onChange={e => setLevel(e.target.value)}>
          <option value="all">ทุกชั้น</option>
          {DB.levels.map(l => <option key={l} value={l}>{l}</option>)}
          <option value="grad">ศิษย์เก่า (ยังไม่คืนเครื่อง)</option>
        </select>
        <select className="select" style={{ width: "auto", minWidth: 110 }} value={room} onChange={e => setRoom(e.target.value)}>
          <option value="all">ทุกห้อง</option>
          {rooms.map(r => <option key={r} value={r}>ห้อง {r}</option>)}
        </select>
        <select className="select" style={{ width: "auto", minWidth: 140 }} value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="all">ทุกสถานะ</option>
          <option value="กำลังใช้งาน">กำลังใช้งาน</option>
          <option value="คืนแล้ว">คืนแล้ว</option>
          <option value="ไม่ประสงค์ยืม">ไม่ประสงค์ยืม</option>
          <option value="ยังไม่แจ้ง">ยังไม่แจ้ง</option>
        </select>
        <div className="spacer"></div>
        <span style={{ color: "var(--text-3)", fontSize: 13.5 }}>{filtered.length} คน</span>
      </div>

      {promoBackup && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 18px", marginBottom: 14, borderColor: "var(--purple)", background: "var(--purple-soft)" }}>
          <Icon name="graduation" size={18} style={{ color: "var(--purple)" }} />
          <span style={{ fontWeight: 600 }}>เลื่อนชั้นประจำปีเรียบร้อย — ปีการศึกษา {store.year}</span>
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>หากต้องการคืนค่ากลับเป็นปีการศึกษา {promoBackup.year}</span>
          <div className="spacer" style={{ flex: 1 }}></div>
          <button className="btn btn-sm" onClick={undoPromote}><Icon name="swap" size={15} />ย้อนกลับการเลื่อนชั้น</button>
        </div>
      )}

      {selected.length > 0 && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", marginBottom: 14, borderColor: "var(--primary)", background: "var(--primary-soft)" }}>
          <Icon name="check2" size={18} style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: 600 }}>เลือกแล้ว {selected.length} คน</span>
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
              <th>รหัส</th><th>ชื่อ–สกุล</th><th>ชั้น/ห้อง</th><th>อุปกรณ์ที่ถือครอง</th><th>เบอร์โทร</th><th>สถานะ</th><th></th>
            </tr></thead>
            <tbody>
              {shown.map(s => {
                return (
                <tr key={s.id} className="row-click" onClick={() => setSel(s)} style={selected.includes(s.id) ? { background: "var(--primary-soft)" } : {}}>
                  <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSel(s.id)} style={{ width: 17, height: 17, accentColor: "var(--primary)" }} /></td>
                  <td className="num" style={{ fontWeight: 600 }}>{s.code}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div className={"avatar" + (s.sex === "หญิง" ? " orange" : "")} style={{ width: 34, height: 34, fontSize: 14 }}>{initials(s.first)}</div>
                      <div><div style={{ fontWeight: 600 }}>{s.prefix}{s.first} {s.last}</div>{s.graduated && <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--warn)", fontWeight: 600, marginTop: 1 }}><Icon name="graduation" size={11} />จบการศึกษา · ติดตามคืนเครื่อง</div>}</div>
                    </div>
                  </td>
                  <td>{s.graduated ? <span style={{ color: "var(--warn)", fontWeight: 600 }}>{s.gradLevel}</span> : (s.level + "/" + s.room)}</td>
                  <td><HeldDeviceCell person={s} go={go} /></td>
                  <td className="num" style={{ color: "var(--text-2)" }}>{s.phone}</td>
                  <td><PersonStatusCell person={s} go={go} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={e => { e.stopPropagation(); openEdit(s); }} title="แก้ไข"><Icon name="edit" size={15} /></button>
                      <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={e => { e.stopPropagation(); setDel(s); }} title="ลบ"><Icon name="trash" size={15} /></button>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <Empty title="ไม่พบนักเรียน" sub="ลองปรับตัวกรองหรือคำค้นหา" />}
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

      {sel && <StudentDetail student={sel} onClose={() => setSel(null)} go={go} onEdit={openEdit} onDelete={setDel} />}

      {add && (
        <Modal title="เพิ่มนักเรียน" onClose={() => setAdd(false)} wide
          footer={<><button className="btn" onClick={() => setAdd(false)}>ยกเลิก</button><button className="btn btn-primary" onClick={saveAdd}><Icon name="check" size={16} />บันทึก</button></>}>
          <StudentForm />
        </Modal>
      )}

      {edit && (
        <Modal title="แก้ไขข้อมูลนักเรียน" onClose={() => setEdit(null)} wide
          footer={<><button className="btn" onClick={() => setEdit(null)}>ยกเลิก</button><button className="btn btn-primary" onClick={saveEdit}><Icon name="check" size={16} />บันทึก</button></>}>
          <StudentForm isEdit />
        </Modal>
      )}

      {del && (
        <Modal title="ยืนยันการลบ" onClose={() => setDel(null)}
          footer={<><button className="btn" onClick={() => setDel(null)}>ยกเลิก</button><button className="btn btn-danger" onClick={doDelete}><Icon name="trash" size={16} />ลบนักเรียน</button></>}>
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            <div className="stat-ic" style={{ background: "var(--danger-soft)", color: "var(--danger)", width: 48, height: 48, flexShrink: 0 }}><Icon name="alert" size={24} /></div>
            <div>ต้องการลบ <b>{del.prefix}{del.first} {del.last}</b> ({del.level}/{del.room}) ใช่หรือไม่?</div>
          </div>
        </Modal>
      )}

      {roomMgr && (
        <RoomManager rooms={rooms} setRooms={setRooms} onClose={() => setRoomMgr(false)} toast={toast} />
      )}

      {importOpen && (
        <ImportModal title="นำเข้าข้อมูลนักเรียน" headers={stuHeaders} templateName="Template_นักเรียน" sampleRow={stuSample}
          existingKeys={students.map(s => (s.first + s.last))}
          buildRecord={(row) => {
            const [code, citizen, prefix, first, last, sex, level, room, no, phone, parent, parentPhone, status] = row.map(c => String(c).trim());
            if (!first || !last) return null;
            return { id: Date.now() + Math.floor(Math.random() * 1e6), code: code || ("69" + String(Date.now()).slice(-4)), citizen: citizen || "-", prefix: prefix || "เด็กชาย", first, last, sex: sex || "ชาย", level: level || "ม.1", room: parseInt(room) || 1, no: parseInt(no) || 0, phone: phone || "-", parent: parent || "-", parentPhone: parentPhone || "-", status: status || "กำลังศึกษา" };
          }}
          keyOf={(s) => s.first + s.last}
          onClose={() => setImportOpen(false)}
          onImport={(res) => {
            if (res.records.length) setStore(st => ({ students: [...res.records, ...st.students] }));
            logAction("นำเข้า Excel", "นำเข้านักเรียน " + res.valid + " รายการ" + (res.dupes ? " (ข้ามซ้ำ " + res.dupes + ")" : ""), "b-purple", "ผู้ดูแลระบบ", "students");
            toast("นำเข้านักเรียน " + res.valid + " รายการสำเร็จ" + (res.dupes ? " · ข้ามซ้ำ " + res.dupes : ""));
          }} />
      )}

      {bulkDel && (
        <Modal title="ยืนยันการลบหลายรายการ" onClose={() => setBulkDel(false)}
          footer={<><button className="btn" onClick={() => setBulkDel(false)}>ยกเลิก</button><button className="btn btn-danger" onClick={doBulkDelete}><Icon name="trash" size={16} />ลบ {selected.length} คน</button></>}>
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            <div className="stat-ic" style={{ background: "var(--danger-soft)", color: "var(--danger)", width: 48, height: 48, flexShrink: 0 }}><Icon name="alert" size={24} /></div>
            <div>ต้องการลบนักเรียนที่เลือกทั้งหมด <b className="num">{selected.length}</b> คนใช่หรือไม่?</div>
          </div>
        </Modal>
      )}

      {promote && (
        <Modal title="เลื่อนชั้นประจำปี" onClose={() => setPromote(false)}
          footer={<><button className="btn" onClick={() => setPromote(false)}>ยกเลิก</button><button className="btn btn-accent" onClick={doPromote}><Icon name="graduation" size={16} />ยืนยันเลื่อนชั้น</button></>}>
          <p style={{ marginTop: 0, color: "var(--text-2)" }}>ระบบจะเลื่อนชั้นนักเรียนทุกคนขึ้นหนึ่งระดับ และเก็บข้อมูลปีการศึกษาเดิมไว้ทั้งหมด</p>
          <div className="card" style={{ background: "var(--surface-2)" }}>
            {[["ม.1", "ม.2", false], ["ม.2", "ม.3", false], ["ม.3", "จบ ม.ต้น", true], ["ม.4", "ม.5", false], ["ม.5", "ม.6", false], ["ม.6", "จบ ม.ปลาย", true]].map((p, i) => (
              <div key={i} className="kv" style={{ padding: "11px 18px" }}>
                <span className="v">{p[0]}</span>
                <Icon name={p[2] ? "graduation" : "borrow"} size={16} style={{ color: p[2] ? "var(--ok)" : "var(--text-3)" }} />
                <span className="v" style={{ color: p[2] ? "var(--ok)" : "var(--primary)" }}>{p[1]}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, padding: 13, background: "var(--warn-soft)", borderRadius: 12, color: "var(--warn)", fontSize: 13.5 }}>
            <Icon name="alert" size={18} style={{ flexShrink: 0 }} /><span>นักเรียน ม.3 จะจบการศึกษาระดับมัธยมต้น และ ม.6 จะจบระดับมัธยมปลาย — ระบบจะสร้างปีการศึกษาใหม่และเก็บข้อมูลเดิมไว้ ตรวจสอบให้แน่ใจว่าอุปกรณ์ที่ค้างยืมถูกบันทึกครบถ้วนแล้ว</span>
          </div>
        </Modal>
      )}
    </div>
  );
}
window.Students = Students;

/* ===== Room manager ===== */
function RoomManager({ rooms, setRooms, onClose, toast }) {
  const [list, setList] = useState(rooms);
  const [val, setVal] = useState("");
  const add = () => {
    const n = parseInt(val, 10);
    if (!n || list.includes(n)) { toast("เลขห้องไม่ถูกต้องหรือมีอยู่แล้ว", "alert"); return; }
    setList([...list, n].sort((a, b) => a - b)); setVal("");
  };
  const save = () => { setRooms(list); onClose(); toast("บันทึกการตั้งค่าห้องแล้ว"); };
  return (
    <Modal title="จัดการห้องเรียน" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>ยกเลิก</button><button className="btn btn-primary" onClick={save}><Icon name="check" size={16} />บันทึก</button></>}>
      <p style={{ marginTop: 0, color: "var(--text-2)", fontSize: 14 }}>เพิ่ม แก้ไข หรือลบเลขห้องที่ใช้ในแต่ละระดับชั้น</p>
      <div style={{ display: "flex", gap: 9, marginBottom: 16 }}>
        <input className="input num" placeholder="เลขห้อง เช่น 5" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
        <button className="btn btn-primary" onClick={add}><Icon name="plus" size={16} />เพิ่มห้อง</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {list.map(r => (
          <div key={r} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 8px 14px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 11 }}>
            <span style={{ fontWeight: 600 }}>ห้อง {r}</span>
            <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setList(list.filter(x => x !== r))} title="ลบ"><Icon name="close" size={14} /></button>
          </div>
        ))}
        {list.length === 0 && <span style={{ color: "var(--text-3)", fontSize: 13.5 }}>ยังไม่มีห้อง</span>}
      </div>
    </Modal>
  );
}
