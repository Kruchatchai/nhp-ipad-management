/* ===== Teachers management ===== */
const DT2 = window.NHP;

function TeacherDetail({ teacher, onClose, onEdit, onDelete, go }) {
  const [store] = useStore();
  const recs = borrowsOf(teacher);
  const photo = getPhoto(teacher);
  return (
    <Drawer title="ข้อมูลครู / บุคลากร" onClose={onClose}
      footer={<><button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={() => { onClose(); onDelete(teacher); }}><Icon name="trash" size={16} />ลบ</button><button className="btn" onClick={onClose}>ปิด</button><button className="btn btn-primary" onClick={() => { onClose(); onEdit(teacher); }}><Icon name="edit" size={16} />แก้ไขข้อมูล</button></>}>
      <div style={{ display: "flex", gap: 17, alignItems: "center", marginBottom: 20 }}>
        {photo
          ? <img src={photo} alt="" style={{ width: 96, height: 96, borderRadius: 20, objectFit: "cover", flexShrink: 0, boxShadow: "var(--shadow)" }} />
          : <div className={"avatar" + (teacher.sex === "หญิง" ? " orange" : "")} style={{ width: 96, height: 96, fontSize: 38, borderRadius: 20, flexShrink: 0 }}>{initials(teacher.first)}</div>}
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{teacher.prefix}{teacher.first} {teacher.last}</div>
          <div className="num" style={{ color: "var(--text-2)" }}>{teacher.code} · {teacher.role}</div>
          <div style={{ marginTop: 8, display: "flex", gap: 7 }}><Badge cls="b-info">{teacher.subject}</Badge><Badge cls={teacher.status === "ปฏิบัติงาน" ? "b-ok" : "b-warn"} dot>{teacher.status}</Badge></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">กลุ่มสาระ</span><span className="v">{teacher.subject}</span></div>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">ครูประจำชั้น</span><span className="v num">{teacher.homeroom || "—"}</span></div>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">เบอร์โทร</span><span className="v num">{teacher.phone}</span></div>
        <div className="kv" style={{ padding: "11px 16px" }}><span className="k">อีเมล</span><span className="v">{teacher.email}</span></div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 11, display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="box" size={17} style={{ color: "var(--primary)" }} />อุปกรณ์ที่ถือครอง
      </div>
      {recs.length > 0 ? recs.map((rec, idx) => {
        const dev = store.ipads.find(d => d.id === rec.deviceId || d.assetTag === rec.device);
        return (
        <div key={idx} className="card card-pad" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
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
      );}) : (
        <div className="card card-pad" style={{ padding: 18, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>ยังไม่มีอุปกรณ์ที่ถือครองอยู่</div>
      )}

      <div style={{ fontWeight: 700, fontSize: 15, margin: "20px 0 11px", display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="history" size={17} style={{ color: "var(--accent)" }} />ประวัติการใช้งาน
      </div>
      <div style={{ position: "relative", paddingLeft: 26 }}>
        <div style={{ position: "absolute", left: 6, top: 6, bottom: 10, width: 2, background: "var(--border)" }}></div>
        {(() => {
          const acts = window.personActivity(teacher);
          return acts.length > 0 ? acts.map((a, i) => (
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
          )) : <div style={{ color: "var(--text-3)", fontSize: 13.5 }}>ยังไม่มีประวัติการใช้งาน</div>;
        })()}
      </div>
    </Drawer>
  );
}

function Teachers({ go, intent }) {
  const toast = React.useContext(ToastCtx);
  const [store, setStore] = useStore();
  const teachers = store.teachers;
  const setTeachers = (v) => setStore(st => ({ teachers: typeof v === "function" ? v(st.teachers) : v }));
  const subjects = store.subjects;
  const setSubjects = (v) => setStore(st => ({ subjects: typeof v === "function" ? v(st.subjects) : v }));
  // ตัวเลือกตำแหน่ง: รวมจากที่มีอยู่จริง + ค่ามาตรฐาน (พิมพ์เพิ่มใหม่ได้)
  const roleOptions = [...new Set([...store.teachers.map(t => t.role).filter(Boolean), "ครูผู้สอน", "หัวหน้ากลุ่มสาระ", "รองผู้อำนวยการโรงเรียน", "ผู้อำนวยการโรงเรียน", "พนักงานราชการ", "ครูอัตราจ้าง", "ครูพี่เลี้ยงเด็กพิการ", "ธุรการ"])];
  const [q, setQ] = useState("");
  const [subj, setSubj] = useState("all");
  const [statusF, setStatusF] = useState("all");
  React.useEffect(() => { if (intent && intent.statusF) setStatusF(intent.statusF); }, [intent]);
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [sel, setSel] = useState(null);
  const [subjMgr, setSubjMgr] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [bulkDel, setBulkDel] = useState(false);
  const form = useRef({});
  const [formPhoto, setFormPhoto] = useState(null);

  const tHeaders = ["รหัสครู", "คำนำหน้า", "ชื่อ", "นามสกุล", "กลุ่มสาระ", "ตำแหน่ง", "ครูประจำชั้น", "เบอร์โทร", "อีเมล", "สถานะ"];
  const tSample = ["T019", "นาย", "สมคิด", "ตั้งใจ", "คณิตศาสตร์", "ครูผู้สอน", "ม.1/1", "0812345678", "somkid@nhp.ac.th", "ปฏิบัติงาน"];
  const doExport = () => {
    exportExcel("ครูบุคลากร_NHP_2569", tHeaders, teachers.map(t => [t.code, t.prefix, t.first, t.last, t.subject, t.role, t.homeroom || "-", t.phone, t.email, t.status]));
    toast("ส่งออก " + teachers.length + " รายการเป็น Excel");
  };

  const filtered = teachers.filter(t =>
    (subj === "all" || t.subject === subj) &&
    (statusF === "all" || personDeviceStatus(t) === statusF) &&
    (q === "" || (t.first + t.last + t.code + t.email).toLowerCase().includes(q.toLowerCase()))
  );

  const openAdd = () => { form.current = { prefix: "นาย", sex: "ชาย", subject: subjects[0], role: "ครูผู้สอน" }; setFormPhoto(null); setAdd(true); };
  const openEdit = (t) => { form.current = { ...t }; setFormPhoto(getPhoto(t)); setEdit(t); };
  const saveAdd = () => {
    const f = form.current;
    const id = Date.now();
    const nd = { ...f, id, code: f.code || ("T" + String(teachers.length + 1).padStart(3, "0")), status: "ปฏิบัติงาน", sex: f.prefix === "นาย" ? "ชาย" : "หญิง", phone: f.phone || "08x-xxx-xxxx", email: f.email || "teacher@nhp.ac.th", homeroom: f.homeroom || null };
    setStore(st => ({ teachers: [nd, ...st.teachers], photos: formPhoto ? { ...st.photos, ["t:" + id]: formPhoto } : st.photos }));
    setAdd(false); logAction("เพิ่มข้อมูล", "ครู " + nd.first + " " + nd.last, "b-ok"); toast("เพิ่มข้อมูลครูเรียบร้อย");
  };
  const saveEdit = () => {
    setStore(st => ({
      teachers: st.teachers.map(t => t.id === edit.id ? { ...t, ...form.current } : t),
      photos: { ...st.photos, ["t:" + edit.id]: formPhoto || undefined },
    }));
    setEdit(null); logAction("แก้ไขข้อมูล", "ครู " + form.current.first + " " + form.current.last, "b-warn"); toast("บันทึกการแก้ไขแล้ว");
  };
  const doDelete = () => { setTeachers(teachers.filter(t => t.id !== del.id)); logAction("ลบรายการ", "ครู " + del.first + " " + del.last, "b-danger"); toast("ลบข้อมูลครูแล้ว", "trash"); setDel(null); };
  const toggleSel = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const allShownSelected = filtered.length > 0 && filtered.every(t => selected.includes(t.id));
  const toggleAllShown = () => setSelected(s => allShownSelected ? s.filter(id => !filtered.some(t => t.id === id)) : [...new Set([...s, ...filtered.map(t => t.id)])]);
  const doBulkDelete = () => { setTeachers(teachers.filter(t => !selected.includes(t.id))); toast("ลบครู " + selected.length + " คนแล้ว", "trash"); setSelected([]); setBulkDel(false); };

  const TForm = () => (
    <div>
      <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid var(--border)" }}>
        <PersonPhotoField value={formPhoto} onChange={setFormPhoto} sex={form.current.prefix === "นาย" ? "ชาย" : "หญิง"} label="รูปครู / บุคลากร" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div className="field"><label>รหัสครู</label><input className="input num" defaultValue={form.current.code || ""} placeholder="เช่น T019" onChange={e => form.current.code = e.target.value} /></div>
      <div className="field"><label>คำนำหน้า</label><select className="select" defaultValue={form.current.prefix} onChange={e => form.current.prefix = e.target.value}><option>นาย</option><option>นาง</option><option>นางสาว</option></select></div>
      <div className="field"><label>ชื่อ</label><input className="input" defaultValue={form.current.first || ""} onChange={e => form.current.first = e.target.value} /></div>
      <div className="field"><label>นามสกุล</label><input className="input" defaultValue={form.current.last || ""} onChange={e => form.current.last = e.target.value} /></div>
      <div className="field"><label>กลุ่มสาระ</label><select className="select" defaultValue={form.current.subject} onChange={e => form.current.subject = e.target.value}>{subjects.map(s => <option key={s}>{s}</option>)}</select></div>
      <div className="field"><label>ตำแหน่ง</label>
        <input className="input" list="nhp-role-options" defaultValue={form.current.role} placeholder="เลือกหรือพิมพ์ตำแหน่งใหม่" onChange={e => form.current.role = e.target.value} />
        <datalist id="nhp-role-options">{roleOptions.map(r => <option key={r} value={r} />)}</datalist>
      </div>
      <div className="field"><label>เบอร์โทร</label><input className="input num" defaultValue={form.current.phone || ""} onChange={e => form.current.phone = e.target.value} /></div>
      <div className="field"><label>อีเมล</label><input className="input" defaultValue={form.current.email || ""} placeholder="name@nhp.ac.th" onChange={e => form.current.email = e.target.value} /></div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHead crumb={["จัดการบุคลากรครู"]} title="ครู / บุคลากร" desc={`ทั้งหมด ${teachers.length} คน · ปีการศึกษา ${store.year}`}
        actions={<>
          <button className="btn" onClick={() => setSubjMgr(true)}><Icon name="layers" size={17} />จัดการกลุ่มสาระ</button>
          <button className="btn" onClick={() => setImportOpen(true)}><Icon name="upload" size={17} />นำเข้า Excel</button>
          <button className="btn" onClick={doExport}><Icon name="download" size={17} />ส่งออก Excel</button>
          <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={17} />เพิ่มครู</button>
        </>} />

      <div className="toolbar">
        <div className="filter-input" style={{ minWidth: 260 }}>
          <Icon name="search" size={17} style={{ color: "var(--text-3)" }} />
          <input placeholder="ค้นหาชื่อ, รหัส หรืออีเมล…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="select" style={{ width: "auto", minWidth: 170 }} value={subj} onChange={e => setSubj(e.target.value)}>
          <option value="all">ทุกกลุ่มสาระ</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
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
              <th>รหัส</th><th>ชื่อ–สกุล</th><th>กลุ่มสาระ</th><th>อุปกรณ์ที่ถือครอง</th><th>ติดต่อ</th><th>สถานะ</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map(t => {
                return (
                <tr key={t.id} className="row-click" onClick={() => setSel(t)} style={selected.includes(t.id) ? { background: "var(--primary-soft)" } : {}}>
                  <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggleSel(t.id)} style={{ width: 17, height: 17, accentColor: "var(--primary)" }} /></td>
                  <td className="num" style={{ fontWeight: 600 }}>{t.code}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div className={"avatar" + (t.sex === "หญิง" ? " orange" : "")} style={{ width: 34, height: 34, fontSize: 14 }}>{initials(t.first)}</div>
                      <div><div style={{ fontWeight: 600 }}>{t.prefix}{t.first} {t.last}</div><div style={{ fontSize: 12, color: "var(--text-3)" }}>{t.role}</div></div>
                    </div>
                  </td>
                  <td><Badge cls="b-info">{t.subject}</Badge></td>
                  <td><HeldDeviceCell person={t} go={go} /></td>
                  <td><div className="num" style={{ fontSize: 13 }}>{t.phone}</div><div style={{ fontSize: 12, color: "var(--text-3)" }}>{t.email}</div></td>
                  <td><PersonStatusCell person={t} go={go} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={e => { e.stopPropagation(); openEdit(t); }} title="แก้ไข"><Icon name="edit" size={15} /></button>
                      <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={e => { e.stopPropagation(); setDel(t); }} title="ลบ"><Icon name="trash" size={15} /></button>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <Empty title="ไม่พบรายชื่อครู" sub="ลองปรับตัวกรองหรือคำค้นหา" />}
      </div>

      {sel && <TeacherDetail teacher={sel} onClose={() => setSel(null)} onEdit={openEdit} onDelete={setDel} go={go} />}

      {add && (
        <Modal title="เพิ่มครู / บุคลากร" onClose={() => setAdd(false)} wide
          footer={<><button className="btn" onClick={() => setAdd(false)}>ยกเลิก</button><button className="btn btn-primary" onClick={saveAdd}><Icon name="check" size={16} />บันทึก</button></>}>
          <TForm />
        </Modal>
      )}

      {edit && (
        <Modal title="แก้ไขข้อมูลครู" onClose={() => setEdit(null)} wide
          footer={<><button className="btn" onClick={() => setEdit(null)}>ยกเลิก</button><button className="btn btn-primary" onClick={saveEdit}><Icon name="check" size={16} />บันทึก</button></>}>
          <TForm />
        </Modal>
      )}

      {del && (
        <Modal title="ยืนยันการลบ" onClose={() => setDel(null)}
          footer={<><button className="btn" onClick={() => setDel(null)}>ยกเลิก</button><button className="btn btn-danger" onClick={doDelete}><Icon name="trash" size={16} />ลบข้อมูลครู</button></>}>
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            <div className="stat-ic" style={{ background: "var(--danger-soft)", color: "var(--danger)", width: 48, height: 48, flexShrink: 0 }}><Icon name="alert" size={24} /></div>
            <div>ต้องการลบ <b>{del.prefix}{del.first} {del.last}</b> ใช่หรือไม่?</div>
          </div>
        </Modal>
      )}

      {subjMgr && <SubjectManager subjects={subjects} setSubjects={setSubjects} onClose={() => setSubjMgr(false)} toast={toast} />}

      {bulkDel && (
        <Modal title="ยืนยันการลบหลายรายการ" onClose={() => setBulkDel(false)}
          footer={<><button className="btn" onClick={() => setBulkDel(false)}>ยกเลิก</button><button className="btn btn-danger" onClick={doBulkDelete}><Icon name="trash" size={16} />ลบ {selected.length} คน</button></>}>
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            <div className="stat-ic" style={{ background: "var(--danger-soft)", color: "var(--danger)", width: 48, height: 48, flexShrink: 0 }}><Icon name="alert" size={24} /></div>
            <div>ต้องการลบครูที่เลือกทั้งหมด <b className="num">{selected.length}</b> คนใช่หรือไม่?</div>
          </div>
        </Modal>
      )}

      {importOpen && (
        <ImportModal title="นำเข้าข้อมูลครู / บุคลากร" headers={tHeaders} templateName="Template_ครูบุคลากร" sampleRow={tSample}
          existing={teachers}
          buildRecord={(row, match) => {
            const [code, prefix, first, last, subject, role, homeroom, phone, email, status] = row.map(c => String(c).trim());
            if (match) {
              const m = { ...match };
              if (code) m.code = code; if (prefix) m.prefix = prefix; if (first) m.first = first; if (last) m.last = last;
              if (subject) m.subject = subject; if (role) m.role = role;
              if (homeroom && homeroom !== "-") m.homeroom = homeroom;
              if (phone) m.phone = phone; if (email) m.email = email; if (status) m.status = status;
              return m;
            }
            if (!first && !last && !code) return null;
            return { id: window.uid(), code: code || ("T" + String(Date.now()).slice(-3)), prefix: prefix || "นาย", first: first || "-", last: last || "-", subject: subject || (subjects[0] || "-"), role: role || "ครูผู้สอน", homeroom: homeroom && homeroom !== "-" ? homeroom : null, phone: phone || "-", email: email || "-", status: status || "ปฏิบัติงาน", sex: prefix === "นาง" || prefix === "นางสาว" ? "หญิง" : "ชาย" };
          }}
          keyOf={(t) => String(t.code || "").trim() ? ("c:" + String(t.code).trim()) : ("n:" + (t.first || "") + (t.last || ""))}
          onClose={() => setImportOpen(false)}
          onImport={(res) => {
            setStore(st => { const u = {}; (res.updates || []).forEach(x => u[x.id] = x); return { teachers: [...(res.records || []), ...st.teachers.map(t => u[t.id] || t)] }; });
            logAction("นำเข้า Excel", "ครู/บุคลากร: เพิ่ม " + res.inserted + " · อัปเดต " + res.updated, "b-purple", "ผู้ดูแลระบบ", "teachers");
            toast("นำเข้าครูสำเร็จ · เพิ่ม " + res.inserted + (res.updated ? " · อัปเดต " + res.updated : ""));
          }} />
      )}
    </div>
  );
}
window.Teachers = Teachers;

/* ===== Subject (กลุ่มสาระ) manager ===== */
function SubjectManager({ subjects, setSubjects, onClose, toast }) {
  const [list, setList] = useState(subjects);
  const [val, setVal] = useState("");
  const [editIdx, setEditIdx] = useState(-1);
  const [editVal, setEditVal] = useState("");
  const add = () => {
    const v = val.trim();
    if (!v || list.includes(v)) { toast("ชื่อกลุ่มสาระว่างหรือซ้ำ", "alert"); return; }
    setList([...list, v]); setVal("");
  };
  const saveEdit = (i) => {
    const v = editVal.trim();
    if (!v) return;
    setList(list.map((x, idx) => idx === i ? v : x)); setEditIdx(-1);
  };
  const save = () => { setSubjects(list); onClose(); toast("บันทึกกลุ่มสาระแล้ว"); };
  return (
    <Modal title="จัดการกลุ่มสาระ" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>ยกเลิก</button><button className="btn btn-primary" onClick={save}><Icon name="check" size={16} />บันทึก</button></>}>
      <p style={{ marginTop: 0, color: "var(--text-2)", fontSize: 14 }}>เพิ่ม แก้ไข หรือลบชื่อกลุ่มสาระการเรียนรู้</p>
      <div style={{ display: "flex", gap: 9, marginBottom: 16 }}>
        <input className="input" placeholder="ชื่อกลุ่มสาระใหม่…" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
        <button className="btn btn-primary" onClick={add}><Icon name="plus" size={16} />เพิ่ม</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 320, overflowY: "auto" }}>
        {list.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px 8px 14px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 11 }}>
            {editIdx === i ? (
              <>
                <input className="input" style={{ height: 36 }} value={editVal} autoFocus onChange={e => setEditVal(e.target.value)} onKeyDown={e => e.key === "Enter" && saveEdit(i)} />
                <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => saveEdit(i)}><Icon name="check" size={15} /></button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontWeight: 500 }}>{s}</span>
                <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => { setEditIdx(i); setEditVal(s); }} title="แก้ไข"><Icon name="edit" size={14} /></button>
                <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setList(list.filter((_, idx) => idx !== i))} title="ลบ"><Icon name="close" size={14} /></button>
              </>
            )}
          </div>
        ))}
        {list.length === 0 && <span style={{ color: "var(--text-3)", fontSize: 13.5 }}>ยังไม่มีกลุ่มสาระ</span>}
      </div>
    </Modal>
  );
}
