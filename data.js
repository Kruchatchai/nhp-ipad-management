/* ===== NHP Mock Data ===== */
(function () {
  const TH_FIRST_M = ["ธนกร","ภูริช","ศุภวิชญ์","กิตติพงศ์","ปวริศ","ธีรภัทร","อนุวัฒน์","ณัฐดนัย","พีรพัฒน์","วรเมธ","จิรายุ","ภาคิน","กฤตเมธ","ธนวัฒน์","ปัณณวิชญ์"];
  const TH_FIRST_F = ["ปุณยนุช","ธัญชนก","กัญญาณัฐ","พิมพ์ชนก","ศิรประภา","ณัฐธิดา","วรินทร","ชนัญชิดา","อภิสรา","กมลชนก","ธัญวรัตน์","ปริยากร","แพรวา","ญาดา","สุพิชฌาย์"];
  const TH_LAST = ["ศรีสุข","พิมพ์ทอง","แก้วมณี","ทองใบ","สุขสวัสดิ์","วงศ์ใหญ่","จันทร์เพ็ง","นาคสุข","ดอนเงิน","บุญมาก","คำดี","สมศรี","ปัญญาดี","อินทร์งาม","มีชัย"];
  const PREFIX_M = "เด็กชาย", PREFIX_F = "เด็กหญิง", PREFIX_MM = "นาย", PREFIX_FF = "นางสาว";
  const rooms = [1,2,3,4];
  const levels = ["ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"];

  function pad(n, w) { return String(n).padStart(w, "0"); }
  let sid = 0;
  const students = [];
  levels.forEach((lv, li) => {
    rooms.forEach((rm) => {
      const count = 6 + (rm % 3);
      for (let i = 1; i <= count; i++) {
        sid++;
        const isF = Math.random() > 0.5;
        const senior = li >= 3;
        const fn = isF ? TH_FIRST_F[Math.floor(Math.random()*TH_FIRST_F.length)] : TH_FIRST_M[Math.floor(Math.random()*TH_FIRST_M.length)];
        const ln = TH_LAST[Math.floor(Math.random()*TH_LAST.length)];
        students.push({
          id: sid,
          code: "6" + pad(7 - li, 1) + pad(sid, 4),
          citizen: "1 " + pad(Math.floor(Math.random()*9999),4) + " " + pad(Math.floor(Math.random()*99999),5) + " " + pad(Math.floor(Math.random()*99),2) + " " + Math.floor(Math.random()*9),
          prefix: isF ? (senior?PREFIX_FF:PREFIX_F) : (senior?PREFIX_MM:PREFIX_M),
          first: fn, last: ln, sex: isF ? "หญิง" : "ชาย",
          level: lv, room: rm, no: i,
          phone: "08" + Math.floor(10000000 + Math.random()*89999999),
          parent: (Math.random()>.5?"นาง":"นาย") + " " + TH_FIRST_F[Math.floor(Math.random()*TH_FIRST_F.length)] + " " + ln,
          parentPhone: "08" + Math.floor(10000000 + Math.random()*89999999),
          status: Math.random() > 0.04 ? "กำลังศึกษา" : "พักการเรียน",
        });
      }
    });
  });

  const subjects = ["คณิตศาสตร์","วิทยาศาสตร์","ภาษาไทย","ภาษาอังกฤษ","สังคมศึกษา","คอมพิวเตอร์","ศิลปะ","สุขศึกษา","การงานอาชีพ","ดนตรี"];
  const teachers = [];
  const tNames = [
    ["นางสาว","ศิริพร","ใจดี","หญิง"],["นาย","ประสิทธิ์","ตั้งมั่น","ชาย"],["นาง","วิไลวรรณ","ทองสุข","หญิง"],
    ["นาย","อดิศักดิ์","พูนผล","ชาย"],["นางสาว","กนกวรรณ","แสงทอง","หญิง"],["นาย","สมชาย","วัฒนา","ชาย"],
    ["นาง","พรทิพย์","มงคล","หญิง"],["นาย","ธีระ","คงเดช","ชาย"],["นางสาว","อรพรรณ","ศรีสุข","หญิง"],
    ["นาย","วีรพงษ์","แก้วมณี","ชาย"],["นาง","สุนิสา","บุญมาก","หญิง"],["นาย","เอกชัย","ปัญญาดี","ชาย"],
    ["นางสาว","มลฤดี","จันทร์เพ็ง","หญิง"],["นาย","ชาญณรงค์","นาคสุข","ชาย"],["นาง","รัตนา","คำดี","หญิง"],
    ["นาย","พิทักษ์","อินทร์งาม","ชาย"],["นางสาว","ปิยะดา","ดอนเงิน","หญิง"],["นาย","สุริยา","มีชัย","ชาย"],
  ];
  tNames.forEach((t, i) => {
    teachers.push({
      id: i+1, code: "T" + pad(i+1, 3), prefix: t[0], first: t[1], last: t[2], sex: t[3],
      subject: subjects[i % subjects.length],
      phone: "08"+Math.floor(10000000+Math.random()*89999999),
      email: t[1].toLowerCase().replace(/[^a-z]/g,"") || ("teacher"+(i+1)),
      role: i === 0 ? "หัวหน้ากลุ่มสาระ" : (i % 6 === 0 ? "หัวหน้ากลุ่มสาระ" : "ครูผู้สอน"),
      homeroom: i < 12 ? levels[i % 6] + "/" + (1 + (i % 4)) : null,
      status: Math.random() > 0.06 ? "ปฏิบัติงาน" : "ลาราชการ",
    });
  });
  teachers.forEach(t => { t.email = t.email + "@nhp.ac.th"; });

  const deviceTypes = [
    { id:"ipad", name:"iPad", icon:"tablet", count:0 },
    { id:"notebook", name:"Notebook", icon:"laptop", count:0 },
    { id:"chromebook", name:"Chromebook", icon:"laptop", count:0 },
    { id:"projector", name:"Projector", icon:"projector", count:0 },
    { id:"camera", name:"Camera", icon:"camera", count:0 },
  ];
  const brands = { ipad:["Apple"], notebook:["Acer","Asus","Lenovo","HP"], chromebook:["Acer","Samsung","Lenovo"], projector:["Epson","BenQ"], camera:["Canon","Sony"] };
  const models = { ipad:["iPad 9th Gen","iPad 10th Gen","iPad Air"], notebook:["Aspire 5","VivoBook 14","ThinkPad E14","ProBook 440"], chromebook:["Chromebook 311","Galaxy Chromebook","100e"], projector:["EB-X06","MW550"], camera:["EOS M50","Alpha ZV-E10"] };
  const colors = ["Space Gray","Silver","Starlight","Black"];
  const caps = ["64GB","128GB","256GB"];
  const defaultAcc = {
    ipad: [{ name:"สายชาร์จ", qty:1 }, { name:"อะแดปเตอร์", qty:1 }, { name:"เคสกันกระแทก", qty:1 }],
    notebook: [{ name:"อะแดปเตอร์ชาร์จ", qty:1 }, { name:"กระเป๋าใส่โน้ตบุ๊ก", qty:1 }, { name:"เมาส์", qty:1 }],
    chromebook: [{ name:"สายชาร์จ", qty:1 }, { name:"ซองใส่เครื่อง", qty:1 }],
    projector: [{ name:"สายไฟ", qty:1 }, { name:"สาย HDMI", qty:1 }, { name:"รีโมท", qty:1 }],
    camera: [{ name:"แบตเตอรี่", qty:2 }, { name:"แท่นชาร์จ", qty:1 }, { name:"สาย USB", qty:1 }, { name:"กระเป๋ากล้อง", qty:1 }],
  };
  const statuses = [
    { k:"พร้อมใช้งาน", cls:"b-ok" },
    { k:"ถูกยืม", cls:"b-info" },
    { k:"ส่งซ่อม", cls:"b-warn" },
    { k:"ชำรุด", cls:"b-danger" },
    { k:"สูญหาย", cls:"b-muted" },
  ];

  const devices = [];
  let did = 0;
  const distribution = { ipad:120, notebook:34, chromebook:40, projector:14, camera:8 };
  Object.entries(distribution).forEach(([type, n]) => {
    for (let i = 1; i <= n; i++) {
      did++;
      const r = Math.random();
      let st;
      if (r < 0.52) st = statuses[0];
      else if (r < 0.82) st = statuses[1];
      else if (r < 0.9) st = statuses[2];
      else if (r < 0.96) st = statuses[3];
      else st = statuses[4];
      const holder = st.k === "ถูกยืม" ? students[Math.floor(Math.random()*students.length)] : null;
      const prefix = type === "ipad" ? "IPD" : type.slice(0,3).toUpperCase();
      devices.push({
        id: did,
        assetTag: "NHP-" + prefix + "-" + pad(i, 3),
        code: "7440-001-00" + pad(did, 2),
        serial: (type.slice(0,2).toUpperCase()) + Math.random().toString(36).slice(2,10).toUpperCase(),
        type,
        typeName: deviceTypes.find(d=>d.id===type).name,
        brand: brands[type][Math.floor(Math.random()*brands[type].length)],
        model: models[type][Math.floor(Math.random()*models[type].length)],
        color: colors[Math.floor(Math.random()*colors.length)],
        cap: type==="ipad"||type==="chromebook" ? caps[Math.floor(Math.random()*caps.length)] : "-",
        budgetYear: 2564 + Math.floor(Math.random()*4),
        receivedDate: "25" + (64+Math.floor(Math.random()*4)) + "-" + pad(1+Math.floor(Math.random()*12),2) + "-" + pad(1+Math.floor(Math.random()*28),2),
        price: type==="ipad"? 11900 : type==="notebook"? 18500 : type==="chromebook"? 9900 : type==="projector"? 15000 : 21000,
        status: st.k, statusCls: st.cls,
        holder: holder ? holder.prefix + holder.first + " " + holder.last : null,
        holderLevel: holder ? holder.level + "/" + holder.room : null,
        accessories: (defaultAcc[type] || []).map(a => ({ ...a })),
        note: "",
      });
      deviceTypes.find(d=>d.id===type).count++;
    }
  });

  // Borrow records
  const borrowed = devices.filter(d => d.status === "ถูกยืม");
  const today = new Date(2026, 5, 4);

  // assign a few borrowed devices to teachers
  borrowed.slice(0, 6).forEach((d, i) => {
    const t = teachers[i * 2 % teachers.length];
    d.holder = t.prefix + t.first + " " + t.last;
    d.holderLevel = "ครู · " + t.subject;
    d.holderType = "teacher";
    d.holderRef = t.id;
  });
  borrowed.forEach(d => { if (!d.holderType) d.holderType = "student"; });
  const borrows = borrowed.map((d, i) => {
    const days = Math.floor(Math.random()*120);
    const bd = new Date(today); bd.setDate(bd.getDate() - days);
    const due = new Date(bd); due.setDate(due.getDate() + 90);
    const overdueDays = Math.floor((today - due) / 86400000);
    return {
      id: i+1, device: d.assetTag, deviceId: d.id, model: d.model, type: d.typeName,
      holder: d.holder, level: d.holderLevel,
      borrowDate: bd.toISOString().slice(0,10),
      dueDate: due.toISOString().slice(0,10),
      overdueDays,
      status: overdueDays > 0 ? "เกินกำหนด" : overdueDays > -10 ? "ใกล้ครบกำหนด" : "ปกติ",
      approver: "ครูประสิทธิ์ ตั้งมั่น",
    };
  });

  const repairTypes = ["หน้าจอแตก","แบตเตอรี่เสื่อม","ชาร์จไม่เข้า","เครื่องค้าง","กล้องเสีย","อื่น ๆ"];
  const repairStatus = [["รอดำเนินการ","b-warn"],["กำลังซ่อม","b-info"],["ซ่อมเสร็จ","b-ok"],["ยกเลิก","b-muted"]];
  const repairs = [];
  for (let i = 0; i < 14; i++) {
    const d = devices[Math.floor(Math.random()*devices.length)];
    const rs = repairStatus[Math.floor(Math.random()*repairStatus.length)];
    const dd = new Date(today); dd.setDate(dd.getDate() - Math.floor(Math.random()*60));
    repairs.push({
      id: i+1, ticket: "RP-" + pad(i+1, 4), device: d.assetTag, model: d.model,
      type: repairTypes[Math.floor(Math.random()*repairTypes.length)],
      reporter: Math.random()>.5 ? "ครูสมชาย วัฒนา" : (students[Math.floor(Math.random()*students.length)].prefix + "..."),
      date: dd.toISOString().slice(0,10),
      status: rs[0], statusCls: rs[1],
      detail: "ผู้ใช้แจ้งว่าอุปกรณ์มีปัญหาในการใช้งาน ตรวจสอบเบื้องต้นพบความผิดปกติ",
    });
  }

  // device history (timeline) for first iPad
  const histDevice = devices.find(d => d.type === "ipad");
  const history = [
    { year:"2566", term:"1", holder:"เด็กชายธนกร ศรีสุข", level:"ม.1/2", from:"2566-05-16", to:"2566-10-10", days:147, kind:"borrow" },
    { year:"2566", term:"2", holder:"ส่งซ่อม — หน้าจอมีรอย", level:"ศูนย์ ICT", from:"2566-11-02", to:"2566-11-20", days:18, kind:"repair" },
    { year:"2567", term:"1", holder:"เด็กหญิงปุณยนุช แก้วมณี", level:"ม.2/1", from:"2567-05-15", to:"2567-10-08", days:146, kind:"borrow" },
    { year:"2567", term:"2", holder:"เด็กหญิงปุณยนุช แก้วมณี", level:"ม.2/1", from:"2567-11-01", to:"2568-03-12", days:131, kind:"borrow" },
    { year:"2568", term:"1", holder:"เด็กชายภูริช ทองใบ", level:"ม.3/3", from:"2568-05-14", to:null, days:null, kind:"current" },
  ];

  const auditLog = [];
  const auditActions = [
    ["เข้าสู่ระบบ","login","b-info"],["ยืมอุปกรณ์","borrow","b-info"],["คืนอุปกรณ์","return","b-ok"],
    ["เพิ่มนักเรียน","add","b-ok"],["แก้ไขอุปกรณ์","edit","b-warn"],["ลบรายการ","delete","b-danger"],
    ["นำเข้า Excel","import","b-purple"],["ส่งออกรายงาน","export","b-purple"],["แจ้งซ่อม","repair","b-warn"],
    ["เลื่อนชั้น","promote","b-accent"],["เปลี่ยนการตั้งค่า","settings","b-muted"],
  ];
  const users = ["ผู้ดูแลระบบ","ครู ICT","admin","ครูสมชาย"];
  for (let i = 0; i < 22; i++) {
    const a = auditActions[Math.floor(Math.random()*auditActions.length)];
    const dt = new Date(today); dt.setMinutes(dt.getMinutes() - i*47 - Math.floor(Math.random()*30));
    auditLog.push({
      id: i+1, action: a[0], cls: a[2],
      user: users[Math.floor(Math.random()*users.length)],
      date: dt.toISOString().slice(0,10), time: dt.toTimeString().slice(0,8),
      ip: "192.168.1." + (10+Math.floor(Math.random()*200)),
      detail: a[0] + " — " + (devices[Math.floor(Math.random()*devices.length)].assetTag),
    });
  }

  // monthly chart data
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const monthlyBorrow = [12,18,9,5,42,55,38,34,29,40,22,15];
  const monthlyReturn = [10,15,11,8,20,35,30,40,33,38,28,18];

  const academicYears = [
    { year:"2569", label:"ปีการศึกษา 2569", current:true, students: students.length, devices: devices.length },
    { year:"2568", label:"ปีการศึกษา 2568", current:false, students: 198, devices: 201 },
    { year:"2567", label:"ปีการศึกษา 2567", current:false, students: 185, devices: 176 },
    { year:"2566", label:"ปีการศึกษา 2566", current:false, students: 172, devices: 150 },
  ];

  const levelCounts = levels.map(lv => ({ level: lv, count: students.filter(s => s.level === lv).length }));

  // system users (admins / assistants)
  const systemUsers = [
    { id:1, name:"ผู้ดูแลระบบ", username:"superadmin", role:"Super Admin", roleCls:"b-danger", email:"admin@nhp.ac.th", last:"2569-06-04 08:12", active:true, twofa:true },
    { id:2, name:"ครูประสิทธิ์ ตั้งมั่น", username:"prasit.t", role:"Admin / ICT", roleCls:"b-info", email:"prasit@nhp.ac.th", last:"2569-06-03 16:40", active:true, twofa:false },
    { id:3, name:"ครูกนกวรรณ แสงทอง", username:"kanokwan.s", role:"Admin / ICT", roleCls:"b-info", email:"kanokwan@nhp.ac.th", last:"2569-06-04 07:55", active:true, twofa:false },
    { id:4, name:"ครูสมชาย วัฒนา", username:"somchai.w", role:"ครู", roleCls:"b-purple", email:"somchai@nhp.ac.th", last:"2569-05-28 13:20", active:true, twofa:false },
    { id:5, name:"ครูพรทิพย์ มงคล", username:"pornthip.m", role:"ครู", roleCls:"b-purple", email:"pornthip@nhp.ac.th", last:"2569-05-19 09:05", active:false, twofa:false },
  ];

  // give a few students a held device + synthesize activity
  function studentDevices(student) {
    const full = student.first + " " + student.last;
    return devices.filter(d => d.holder && d.holder.includes(full) && d.holderType !== "teacher");
  }
  function teacherDevices(teacher) {
    const full = teacher.first + " " + teacher.last;
    return devices.filter(d => d.holder && d.holder.includes(full) && d.holderType === "teacher");
  }
  // deterministic ownership timeline for any device
  function genHistory(device) {
    let seed = device.id * 131 + 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const out = [];
    let y = 2566;
    const span = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < span; i++) {
      const s = students[Math.floor(rnd() * students.length)];
      const isRepair = rnd() > 0.78;
      const term = rnd() > 0.5 ? "1" : "2";
      const fromM = term === "1" ? "05" : "11";
      const days = 100 + Math.floor(rnd() * 60);
      const isLast = i === span - 1;
      out.push(isRepair ? {
        year: String(y), term, holder: "ส่งซ่อม — " + pick(repairTypes), level: "ศูนย์ ICT",
        from: y + "-" + fromM + "-" + pad(1 + Math.floor(rnd()*20), 2), to: y + "-" + fromM + "-" + pad(20 + Math.floor(rnd()*8), 2), days: 10 + Math.floor(rnd()*15), kind: "repair",
      } : {
        year: String(y), term, holder: s.prefix + s.first + " " + s.last, level: s.level + "/" + s.room,
        from: y + "-" + fromM + "-" + pad(10 + Math.floor(rnd()*8), 2),
        to: isLast && device.status === "ถูกยืม" ? null : (term === "1" ? y : y + 1) + "-" + (term === "1" ? "10" : "03") + "-" + pad(8 + Math.floor(rnd()*15), 2),
        days: isLast && device.status === "ถูกยืม" ? null : days, kind: isLast && device.status === "ถูกยืม" ? "current" : "borrow",
      });
      if (term === "2") y++;
    }
    return out;
  }
  function studentActivity(student) {
    const held = studentDevices(student);
    const acts = [];
    let seed = student.id * 97 + 13;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    held.forEach((d) => {
      const days = 20 + Math.floor(rnd() * 120);
      const bd = new Date(today); bd.setDate(bd.getDate() - days);
      acts.push({ kind: "borrow", label: "ยืมอุปกรณ์", cls: "b-info", date: bd.toISOString().slice(0,10), device: d.assetTag, model: d.model, serial: d.serial });
      if (rnd() > 0.6) {
        const rd = new Date(bd); rd.setDate(rd.getDate() + 15 + Math.floor(rnd()*30));
        acts.push({ kind: "repair", label: "แจ้งซ่อม", cls: "b-warn", date: rd.toISOString().slice(0,10), device: d.assetTag, model: d.model, serial: d.serial, note: repairTypes[Math.floor(rnd()*repairTypes.length)] });
      }
    });
    // a prior returned device
    if (rnd() > 0.4) {
      const pd = devices[Math.floor(rnd()*devices.length)];
      const r1 = new Date(today); r1.setDate(r1.getDate() - 200 - Math.floor(rnd()*100));
      const r2 = new Date(r1); r2.setDate(r2.getDate() + 120);
      acts.push({ kind: "borrow", label: "ยืมอุปกรณ์", cls: "b-info", date: r1.toISOString().slice(0,10), device: pd.assetTag, model: pd.model, serial: pd.serial });
      acts.push({ kind: "return", label: "คืนอุปกรณ์", cls: "b-ok", date: r2.toISOString().slice(0,10), device: pd.assetTag, model: pd.model, serial: pd.serial });
    }
    return acts.sort((a,b) => b.date.localeCompare(a.date));
  }

  window.NHP = {
    students, teachers, devices, deviceTypes, borrows, repairs, repairTypes, repairStatus,
    history, histDevice, auditLog, months, monthlyBorrow, monthlyReturn,
    academicYears, levels, levelCounts, statuses, subjects, systemUsers,
    studentDevices, teacherDevices, studentActivity, genHistory, rooms: [1,2,3,4],
    iPads: devices.filter(d => d.type === "ipad"),
    stats: {
      totalDevices: devices.length,
      available: devices.filter(d=>d.status==="พร้อมใช้งาน").length,
      borrowed: devices.filter(d=>d.status==="ถูกยืม").length,
      broken: devices.filter(d=>d.status==="ชำรุด").length,
      repair: devices.filter(d=>d.status==="ส่งซ่อม").length,
      lost: devices.filter(d=>d.status==="สูญหาย").length,
      students: students.length,
      teachers: teachers.length,
      overdue: borrows.filter(b=>b.overdueDays>0).length,
    },
  };
})();
