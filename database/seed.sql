-- =====================================================================
--  NHP iPad Management System — Seed ข้อมูลตั้งต้น (reference data)
--  รันหลังจาก schema.sql แล้ว เพื่อใส่ข้อมูลพื้นฐานที่จำเป็นต่อการเริ่มใช้งาน
--  (ยังไม่รวมนักเรียน/ครู/อุปกรณ์จริง — ส่วนนั้นนำเข้าผ่าน Excel ในแอป)
-- =====================================================================

-- ปีการศึกษา
insert into academic_years (year, is_current) values
  ('2566', false), ('2567', false), ('2568', false), ('2569', true)
on conflict do nothing;

-- การตั้งค่าระบบ
insert into settings (id, school_name, affiliation, current_year, current_term)
values (1, 'โรงเรียนหนองหงส์พิทยาคม', 'สพม.บุรีรัมย์', '2569', '1')
on conflict (id) do update set
  school_name = excluded.school_name,
  affiliation = excluded.affiliation;

-- ประเภทอุปกรณ์
insert into device_types (id, name, icon) values
  ('ipad','iPad','tablet'),
  ('notebook','Notebook','laptop'),
  ('chromebook','Chromebook','laptop'),
  ('projector','Projector','projector'),
  ('camera','Camera','camera')
on conflict (id) do nothing;

-- วิชา
insert into subjects (name) values
  ('คณิตศาสตร์'),('วิทยาศาสตร์'),('ภาษาไทย'),('ภาษาอังกฤษ'),('สังคมศึกษา'),
  ('คอมพิวเตอร์'),('ศิลปะ'),('สุขศึกษา'),('การงานอาชีพ'),('ดนตรี')
on conflict (name) do nothing;

-- อุปกรณ์เสริม (คลังรวม)
insert into accessories (name, qty) values
  ('สายชาร์จ USB-C', 95),
  ('อะแดปเตอร์ 20W', 49),
  ('เคสกันกระแทก', 120),
  ('ฟิล์มกันรอย', 120),
  ('Apple Pencil', 60)
on conflict do nothing;

-- ประเภทปัญหาการซ่อม — iPad
insert into repair_types (scope, name) values
  ('device','หน้าจอแตก/มีรอย'),
  ('device','แบตเตอรี่เสื่อม'),
  ('device','เปิดไม่ติด'),
  ('device','ลำโพง/ไมค์เสีย'),
  ('device','พอร์ตชาร์จเสีย'),
  ('device','ระบบค้าง/ซอฟต์แวร์'),
  ('device','อื่น ๆ');

-- ประเภทปัญหาการซ่อม — อุปกรณ์เสริม
insert into repair_types (scope, name) values
  ('accessory','สายชาร์จขาด/ชำรุด'),
  ('accessory','อะแดปเตอร์เสีย'),
  ('accessory','เคสแตก/ชำรุด'),
  ('accessory','ฟิล์มเสียหาย'),
  ('accessory','ปากกาใช้ไม่ได้'),
  ('accessory','อื่น ๆ');
