-- =====================================================================
--  NHP iPad Management System — Database Schema (PostgreSQL / Supabase)
--  โรงเรียนหนองหงส์พิทยาคม สังกัด สพม.บุรีรัมย์
--
--  วิธีใช้:  เปิด Supabase Dashboard -> SQL Editor -> วางไฟล์นี้ทั้งหมด -> Run
--  ใช้ได้กับ Postgres ทั่วไป (Supabase / Neon / VPS) — RLS เป็นส่วนเฉพาะ Supabase
-- =====================================================================

-- ---------- ปีการศึกษา ----------
create table academic_years (
  id          serial primary key,
  year        text not null,                 -- พ.ศ. เช่น "2569"
  is_current  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- การตั้งค่าระบบ (singleton แถวเดียว) ----------
create table settings (
  id            int primary key default 1,
  school_name   text not null default 'โรงเรียนหนองหงส์พิทยาคม',
  affiliation   text default 'สพม.บุรีรัมย์',
  address       text,
  logo_url      text,
  current_year  text default '2569',
  current_term  text default '1',
  backup_freq   text default 'ทุกวัน เวลา 02:00 น.',
  updated_at    timestamptz not null default now(),
  constraint settings_single_row check (id = 1)
);

-- ---------- วิชา ----------
create table subjects (
  id    serial primary key,
  name  text not null unique
);

-- ---------- บุคลากรครู ----------
create table teachers (
  id          serial primary key,
  code        text unique,                   -- เช่น T001
  prefix      text,                          -- นาย/นาง/นางสาว
  first_name  text not null,
  last_name   text not null,
  sex         text,                          -- ชาย/หญิง
  subject_id  int references subjects(id) on delete set null,
  homeroom    text,                          -- ครูประจำชั้น เช่น "ม.1/2" (null = ไม่มี)
  email       text,
  phone       text,
  photo_url   text,
  status      text not null default 'ปฏิบัติงาน',   -- ปฏิบัติงาน / ลาราชการ
  created_at  timestamptz not null default now()
);

-- ---------- นักเรียน ----------
create table students (
  id          serial primary key,
  student_code text unique,                  -- รหัสนักเรียน
  prefix      text,                          -- เด็กชาย/เด็กหญิง/นาย/นางสาว
  first_name  text not null,
  last_name   text not null,
  sex         text,                          -- ชาย/หญิง
  level       text not null,                 -- ม.1 .. ม.6
  room        int not null,                  -- ห้อง
  no          int,                           -- เลขที่
  photo_url   text,
  status      text not null default 'กำลังศึกษา',   -- กำลังศึกษา / พักการเรียน / จบการศึกษา
  academic_year text,                        -- ปีการศึกษาที่เข้าเรียน
  created_at  timestamptz not null default now()
);
create index idx_students_level_room on students(level, room);

-- ---------- ประเภทอุปกรณ์ ----------
create table device_types (
  id    text primary key,                    -- ipad / notebook / chromebook / projector / camera
  name  text not null,
  icon  text
);

-- ---------- อุปกรณ์ (ครุภัณฑ์) ----------
create table devices (
  id          serial primary key,
  asset_tag   text not null unique,          -- NHP-IP-001
  type        text not null references device_types(id),
  serial      text,
  model       text,
  purchased_at date,
  warranty_to  date,
  status      text not null default 'พร้อมใช้งาน',  -- พร้อมใช้งาน/ถูกยืม/ชำรุด/ส่งซ่อม/สูญหาย
  note        text,
  created_at  timestamptz not null default now()
);
create index idx_devices_status on devices(status);
create index idx_devices_type on devices(type);

-- ---------- อุปกรณ์เสริม (คลังรวม) ----------
create table accessories (
  id        serial primary key,
  name      text not null,                   -- สายชาร์จ USB-C / อะแดปเตอร์ 20W / เคส / ฟิล์ม / ปากกา
  total     int not null default 0,          -- จำนวนทั้งหมด
  damaged   int not null default 0,          -- ชำรุดสะสม
  lost      int not null default 0           -- สูญหายสะสม
);

-- ---------- รายการยืม ----------
-- borrower_kind: 's' = นักเรียน, 't' = ครู
create table borrows (
  id            serial primary key,
  device_id     int not null references devices(id),
  borrower_kind text not null check (borrower_kind in ('s','t')),
  borrower_id   int not null,                -- อ้างถึง students.id หรือ teachers.id ตาม kind
  holder_name   text,                        -- ชื่อผู้ถือ ณ เวลายืม (snapshot)
  level         text,                        -- ชั้น/ฝ่าย ณ เวลายืม
  academic_year text,
  term          text,
  borrow_date   date not null default current_date,
  due_date      date,
  status        text not null default 'ปกติ',     -- ปกติ/ใกล้ครบกำหนด/เกินกำหนด
  note          text,
  created_at    timestamptz not null default now()
);
create index idx_borrows_device on borrows(device_id);
create index idx_borrows_person on borrows(borrower_kind, borrower_id);

-- อุปกรณ์เสริมที่ยืมไปพร้อมเครื่อง
create table borrow_accessories (
  id           serial primary key,
  borrow_id    int not null references borrows(id) on delete cascade,
  accessory_id int not null references accessories(id),
  qty          int not null default 1
);

-- ---------- ทะเบียนยืม–คืน (ledger ที่คืนแล้ว/เหตุการณ์) ----------
-- kind: borrow / return / repair / current
create table return_log (
  id            serial primary key,
  borrow_id     int references borrows(id) on delete set null,
  device_id     int references devices(id) on delete set null,
  person_kind   text check (person_kind in ('s','t')),
  person_id     int,
  holder_name   text,
  level         text,
  academic_year text,
  term          text,
  from_date     date,
  to_date       date,
  days          int,
  kind          text not null default 'return',
  condition     text,                        -- สภาพตอนคืน (ปกติ/ชำรุด ฯลฯ)
  note          text,
  created_at    timestamptz not null default now()
);
create index idx_return_log_person on return_log(person_kind, person_id);

-- ---------- ประเภทปัญหาการซ่อม (แก้ไขได้) ----------
create table repair_types (
  id     serial primary key,
  scope  text not null default 'device',     -- device (iPad) / accessory
  name   text not null
);

-- ---------- ใบแจ้งซ่อม iPad ----------
create table repairs (
  id           serial primary key,
  ticket       text unique,                  -- RP-0001
  device_id    int not null references devices(id),
  type         text,                         -- ประเภทปัญหา
  status       text not null default 'รอดำเนินการ',  -- รอดำเนินการ/กำลังซ่อม/ซ่อมเสร็จ/ส่งคืน
  reported_by  text,
  reported_at  date not null default current_date,
  fixed_at     date,
  cost         numeric(10,2),
  note         text,
  created_at   timestamptz not null default now()
);

-- ---------- ใบแจ้งซ่อมอุปกรณ์เสริม ----------
create table acc_repairs (
  id            serial primary key,
  ticket        text unique,                 -- AR-0001
  accessory_id  int references accessories(id),
  borrower_kind text check (borrower_kind in ('s','t')),
  borrower_id   int,
  borrower_name text,
  level         text,
  type          text,
  status        text not null default 'รอดำเนินการ',
  reported_at   date not null default current_date,
  note          text,
  created_at    timestamptz not null default now()
);

-- ---------- สถานะการแจ้งความประสงค์ยืมของบุคคล ----------
-- status: กำลังใช้งาน / คืนแล้ว / ไม่ประสงค์ยืม / ยังไม่แจ้ง
create table person_status (
  person_kind text not null check (person_kind in ('s','t')),
  person_id   int not null,
  status      text not null default 'ยังไม่แจ้ง',
  updated_at  timestamptz not null default now(),
  primary key (person_kind, person_id)
);

-- ---------- ผู้ใช้ระบบ / RBAC ----------
-- ผูกกับ auth.users ของ Supabase (id = auth uid). role ใช้ทำ RBAC
create table app_users (
  id        uuid primary key references auth.users(id) on delete cascade,
  name      text,
  username  text unique,
  email     text,
  role      text not null default 'ครู',      -- Super Admin / Admin / ICT / ครู / นักเรียน
  active    boolean not null default true,
  twofa     boolean not null default false,
  last_login timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Audit Log ----------
create table audit_log (
  id        bigserial primary key,
  action    text not null,
  detail    text,
  cls       text default 'b-info',
  actor     text,                            -- ชื่อผู้กระทำ (denormalized)
  actor_id  uuid references app_users(id) on delete set null,
  nav       text,                            -- หน้าเป้าหมาย (deep-link)
  ip        text,
  at        timestamptz not null default now()
);
create index idx_audit_at on audit_log(at desc);

-- =====================================================================
--  Helper: current user's role (ใช้ใน RLS policy)
-- =====================================================================
create or replace function current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select role from app_users where id = auth.uid()
$$;

create or replace function is_staff()  -- Super Admin หรือ Admin/ICT
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(current_role_name() in ('Super Admin','Admin / ICT'), false)
$$;

-- =====================================================================
--  Row Level Security (Supabase) — เปิด RLS ทุกตาราง
--  หลักการ:  ผู้ login แล้วทุกคน "อ่าน" ได้, แต่ "แก้ไข" เฉพาะ staff
--  (ปรับ policy ละเอียดต่อบทบาทได้ภายหลัง)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'academic_years','settings','subjects','teachers','students','device_types',
    'devices','accessories','borrows','borrow_accessories','return_log',
    'repair_types','repairs','acc_repairs','person_status','app_users','audit_log'
  ] loop
    execute format('alter table %I enable row level security;', t);
    -- อ่าน: ผู้ใช้ที่ login แล้ว
    execute format($f$create policy "read_authenticated" on %I for select to authenticated using (true);$f$, t);
    -- เขียน: เฉพาะ staff
    execute format($f$create policy "write_staff_ins" on %I for insert to authenticated with check (is_staff());$f$, t);
    execute format($f$create policy "write_staff_upd" on %I for update to authenticated using (is_staff());$f$, t);
    execute format($f$create policy "write_staff_del" on %I for delete to authenticated using (is_staff());$f$, t);
  end loop;
end $$;

-- app_users: ให้ผู้ใช้เห็น/แก้โปรไฟล์ตัวเองได้ (เพิ่มเติมจาก staff)
create policy "self_read"  on app_users for select to authenticated using (id = auth.uid());
create policy "self_update" on app_users for update to authenticated using (id = auth.uid());

-- =====================================================================
--  Trigger: สร้าง app_users อัตโนมัติเมื่อมีผู้สมัครใหม่ใน auth.users
-- =====================================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into app_users (id, email, name, username)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email), split_part(new.email,'@',1))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
