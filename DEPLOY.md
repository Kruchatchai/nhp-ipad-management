# คู่มือ: ทำให้ NHP iPad Management ใช้งานจริง (ฐานข้อมูล + Deploy ฟรี)

เอกสารนี้วิเคราะห์ตัวเลือก **ฟรี** สำหรับฐานข้อมูลและโฮสติ้ง พร้อมขั้นตอนนำระบบขึ้นใช้งานจริง

> สถานะปัจจุบัน: ระบบเป็น **เว็บฝั่งหน้าเดียว (client-side)** — React + Babel โหลดจาก CDN, ข้อมูลเป็น mock อยู่ในหน่วยความจำ (`data.js` / `store.jsx`) รีเฟรชแล้วข้อมูลหาย ยังไม่มีฐานข้อมูลและยังไม่มีระบบล็อกอินจริง

---

## 1) สรุปสถาปัตยกรรมที่แนะนำ (ฟรีทั้งหมด)

```
ผู้ใช้ (เบราว์เซอร์)
        │
        ▼
[ Cloudflare Pages ]  ← โฮสต์ไฟล์เว็บ (static)   ── ฟรี, bandwidth ไม่จำกัด
        │  เรียก API ตรง
        ▼
[ Supabase ]  ← ฐานข้อมูล Postgres + ระบบล็อกอิน (Auth) + REST API อัตโนมัติ + เก็บรูป (Storage)
```

**จุดเด่น:** ไม่ต้องเขียน/โฮสต์ backend แยก — Supabase สร้าง REST API จากตารางให้อัตโนมัติ หน้าเว็บเรียกใช้ผ่าน `@supabase/supabase-js` ได้เลย เหมาะกับงานโรงเรียนขนาดเดียว

---

## 2) วิเคราะห์ตัวเลือกฐานข้อมูลฟรี

| บริการ | ฟรีได้อะไร | ข้อควรรู้ | เหมาะกับเรา? |
|---|---|---|---|
| **Supabase** ⭐ | Postgres 500MB, Auth 50,000 ผู้ใช้/เดือน, Storage 1GB, API อัตโนมัติ, 2 โปรเจกต์ | โปรเจกต์ฟรีจะ **พักอัตโนมัติเมื่อไม่มีการใช้งาน 7 วัน** (ปลุกเองได้ใน dashboard) | ✅ ดีที่สุด — ได้ทั้ง DB+Auth+API ในที่เดียว ไม่ต้องเขียน backend |
| **Firebase (Firestore)** | NoSQL, Auth, Hosting ฟรี (Spark) | เป็น NoSQL ต้องออกแบบข้อมูลใหม่หมด ไม่เข้ากับ schema เชิงสัมพันธ์ของเรา | ⚠️ ใช้ได้แต่ต้องรื้อโครงสร้าง |
| **Neon / Turso** | Postgres / SQLite serverless ฟรี | เป็น "ฐานข้อมูลเปล่า" ต้องเขียน+โฮสต์ backend เอง และไม่มี Auth สำเร็จรูป | ⚠️ งานเพิ่มเยอะ |
| **PocketBase** (self-host) | ฟรี 100% (ไบนารีเดียว, SQLite, มี Auth) | ต้องมีเซิร์ฟเวอร์/VPS ของตัวเองไว้รัน | ⚠️ ต้องดูแลเซิร์ฟเวอร์เอง |

**ขนาดข้อมูลของเรา:** iPad ~120 เครื่อง, นักเรียน/ครูหลักร้อย, ประวัติยืม-คืนหลายปี → รวมแล้วไม่กี่ MB เท่านั้น **500MB ของ Supabase เหลือเฟือหลายปี**

> ⚠️ เรื่องการพัก 7 วัน: แก้ได้ง่ายด้วยการตั้ง "ปลุก" อัตโนมัติ — ให้ Cron (เช่น cron-job.org ฟรี) ยิงคำขออ่านเบา ๆ วันละครั้ง หรือแค่มีคนเข้าใช้ระบบทุกสัปดาห์ก็พอ

**สรุป: เลือก Supabase**

---

## 3) วิเคราะห์ตัวเลือกโฮสต์เว็บฟรี

| บริการ | Bandwidth ฟรี | Build | จุดเด่น |
|---|---|---|---|
| **Cloudflare Pages** ⭐ | **ไม่จำกัด** | 500 builds/เดือน | เครือข่ายทั่วโลกเร็ว, ไม่มีค่า egress, เหมาะกับ static มากที่สุด |
| Vercel (Hobby) | 100GB/เดือน | 6,000 นาที/เดือน | ใช้ง่าย แต่แผนฟรีห้ามใช้เชิงพาณิชย์ |
| Netlify | 100GB/เดือน | 300 นาที/เดือน | ฟีเจอร์ฟอร์ม/ฟังก์ชันดี |
| GitHub Pages | 100GB/เดือน (soft) | — | ง่ายสุดถ้าโค้ดอยู่บน GitHub อยู่แล้ว |

เว็บเราเป็น static ล้วน (ไฟล์ HTML/CSS/JS) → ทุกเจ้าใช้ได้ แต่ **Cloudflare Pages คุ้มสุด** เพราะ bandwidth ไม่จำกัดและฟรีใช้งานองค์กรได้

**สรุป: เลือก Cloudflare Pages** (ถ้าอยากง่ายสุดและโค้ดขึ้น GitHub อยู่แล้ว GitHub Pages ก็เพียงพอ)

---

## 4) ขั้นตอนสร้างฐานข้อมูล (Supabase)

1. สมัคร/ล็อกอินที่ https://supabase.com (ฟรี ใช้บัญชี GitHub/Google ได้)
2. กด **New project** → ตั้งชื่อ `nhp-ipad` → เลือก region **Southeast Asia (Singapore)** → ตั้งรหัสผ่านฐานข้อมูล → Create
3. ไปเมนู **SQL Editor** → New query → วางเนื้อหาไฟล์ [`database/schema.sql`](database/schema.sql) ทั้งหมด → **Run**
4. New query อีกครั้ง → วาง [`database/seed.sql`](database/seed.sql) → **Run** (ใส่ข้อมูลตั้งต้น เช่น ปีการศึกษา, ประเภทอุปกรณ์, อุปกรณ์เสริม)
5. ไปเมนู **Project Settings → API** จดค่า 2 อย่าง:
   - **Project URL** (เช่น `https://xxxx.supabase.co`)
   - **anon public key** (คีย์ฝั่ง client — เปิดเผยได้ ปลอดภัยเพราะมี RLS คุม)
6. สร้างผู้ดูแลคนแรก: เมนู **Authentication → Users → Add user** (ใส่อีเมล+รหัสผ่าน) จากนั้นไป **SQL Editor** รัน:
   ```sql
   update app_users set role = 'Super Admin'
   where email = 'อีเมลผู้ดูแล@nhp.ac.th';
   ```

> ความปลอดภัย: schema เปิด **Row Level Security (RLS)** ทุกตาราง — ผู้ที่ล็อกอินแล้วเท่านั้นจึงอ่านได้ และเฉพาะ Super Admin / Admin·ICT เท่านั้นที่แก้ไขข้อมูลได้

---

## 5) ขั้นตอน Deploy เว็บ (Cloudflare Pages)

**วิธี A — ผ่าน GitHub (แนะนำ, อัปเดตอัตโนมัติ)**
1. นำโฟลเดอร์โปรเจกต์ขึ้น GitHub repository
2. ที่ https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**
3. เลือก repo → Framework preset: **None** → Build command: *(เว้นว่าง)* → Output dir: `/` → Deploy
4. ได้ URL `https://nhp-ipad.pages.dev` ใช้งานได้ทันที (ผูกโดเมนโรงเรียนภายหลังได้ฟรี)

**วิธี B — ลากวาง (เร็วสุด ไม่ต้องใช้ Git)**
1. ที่ Cloudflare Pages → **Upload assets** → ลากไฟล์ทั้งโฟลเดอร์ขึ้นไป → Deploy

> ก่อน deploy ต้องนำค่า Supabase (URL + anon key) ไปใส่ในโค้ดส่วนเชื่อมต่อก่อน (ดูข้อ 6)

---

## 6) การเชื่อมฐานข้อมูล — ทำเสร็จแล้ว ✅ (เหลือแค่ใส่คีย์)

โค้ดเชื่อม Supabase ถูกเขียนไว้แล้ว ระบบมี **2 โหมดอัตโนมัติ**:
- **Demo mode** (ยังไม่ใส่คีย์): ใช้ข้อมูลจำลองเหมือนเดิม — เลือกบทบาทแล้วเข้าได้เลย
- **Live mode** (ใส่คีย์แล้ว): ล็อกอินจริงด้วยอีเมล/รหัสผ่าน (Supabase Auth) + ดึง/บันทึกข้อมูลจากฐานข้อมูลจริง

**ไฟล์ที่เกี่ยวข้อง:**
| ไฟล์ | หน้าที่ |
|---|---|
| [`config.js`](config.js) | ใส่ `SUPABASE_URL` + `SUPABASE_ANON_KEY` ที่นี่ (หรือผ่าน localStorage) |
| [`supabase.js`](supabase.js) | สร้าง client, ระบบ Auth, โหลดข้อมูล (`hydrate`), CRUD (`SB.db.*`), บันทึก Audit |
| `store.jsx` | รองรับ `Store.hydrate()` เพื่อรับข้อมูลจริงหลังล็อกอิน |
| `app.jsx` | Login ใช้ Supabase Auth, คืนสภาพ session เมื่อรีเฟรช, role มาจากตาราง `app_users` |

**วิธีเปิด Live mode:** เปิด [`config.js`](config.js) แล้วกรอก 2 ค่าจากข้อ 4.5 (Project URL + anon key) → บันทึก → รีเฟรช เท่านี้ระบบจะต่อฐานข้อมูลจริงทันที

### สิ่งที่ทำงานแล้วใน Live mode
- ✅ ล็อกอิน/ออกจากระบบจริง + จำ session ตอนรีเฟรช
- ✅ สิทธิ์ตามบทบาท (RBAC) อ่านจากตาราง `app_users`
- ✅ โหลดข้อมูลจริง (นักเรียน/ครู/อุปกรณ์/อุปกรณ์เสริม/ยืม-คืน/แจ้งซ่อม) เข้าทุกหน้า
- ✅ บันทึก Audit Log ลงฐานข้อมูลอัตโนมัติ

### งานต่อยอด (ถ้าต้องการให้ทุกปุ่มเขียนกลับ DB)
หน้าที่ "เพิ่ม/แก้ไข/ลบ" (นักเรียน, อุปกรณ์, สร้างรายการยืม, คืน, แจ้งซ่อม) ตอนนี้ยังบันทึกในหน่วยความจำของ session — หากต้องการให้บันทึกถาวร ให้ผูกปุ่มเหล่านั้นกับ `window.SB.db.insert/update/remove(...)` ที่เตรียมไว้แล้ว (เป็นงานเพิ่มทีละหน้า) · (ออปชัน) เก็บรูปบน **Supabase Storage** แทน dataURL

---

## 7) ค่าใช้จ่าย: ฟรีจริงไหม?

| รายการ | แผนฟรี | พอสำหรับ 1 โรงเรียน? |
|---|---|---|
| Supabase (DB+Auth+API+Storage) | 0 บาท | ✅ เหลือเฟือหลายปี |
| Cloudflare Pages (โฮสต์เว็บ) | 0 บาท | ✅ bandwidth ไม่จำกัด |
| โดเมน `.pages.dev` | 0 บาท | ✅ (อยากใช้ชื่อโรงเรียนเองค่อยซื้อโดเมนภายหลัง) |

**รวม: 0 บาท** เริ่มใช้งานจริงได้ทันที โดยมีข้อแลกคือต้องกันไม่ให้ Supabase พัก (มีคนใช้ทุกสัปดาห์ หรือตั้ง cron ปลุก)

---

## แหล่งอ้างอิง (free tier ปี 2026)
- Supabase Pricing — https://supabase.com/pricing
- Supabase free tier limits 2026 — https://aiagencyplus.com/supabase-free-tier-limits/
- Cloudflare/Vercel/Netlify เปรียบเทียบ 2026 — https://danubedata.ro/blog/cloudflare-pages-vs-netlify-vs-vercel-static-hosting-2026
