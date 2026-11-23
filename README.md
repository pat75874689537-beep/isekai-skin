# ISEKAI — สตูดิโอแปลงสกินเป็นแอดออน

เว็บแปลงสกิน Minecraft Bedrock (.png / .bbmodel) เป็นแอดออนสกินใส่ช่องเกราะ (.mcaddon) ทำงานในเบราว์เซอร์ทั้งหมด ไม่อัปโหลดสกินไปไหน

- เว็บจริง: https://isekai-skin.netlify.app (Netlify ดึง `index.html` จาก repo นี้ไปขึ้นอัตโนมัติ)
- ตามสูตร ISK (SKIN_ADDON_RECIPE ข้อ 1–2): สกินเปล่า ผมติดหัวแบบแข็งตามโมเดล

## โครงไฟล์
- `index.html` — เว็บที่ขึ้นจริง (สร้างจาก src อย่าแก้ตรง ๆ)
- `claude_artifact.html` — ฉบับสำหรับหน้า artifact ใน claude.ai
- `src/` — ต้นฉบับ: `head.html` (ฟอนต์/สี/CSS หลัก), `body.html` (โครงหน้า), `theme.css` `logo.css` `extra.css`, `app_stage.js` (อ่านสกิน, พรีวิว 3 มิติ, สร้างไฟล์แอดออน), `logo.js` (โลโก้กลิตช์), `layout.js` (ผังมือถือ)
- `src/_archive_fx/` — ระบบฟังชั่นเก่า (กระพริบตา/ตาขยับ/เรืองแสง/ผมพริ้ว) ที่ตัดออกใน v22 เก็บไว้เผื่อเอากลับมา
- `tools/build_page.py` — ประกอบ src → `index.html` + `claude_artifact.html`

## แก้แล้วอัปเดตยังไง
แก้ไฟล์ใน `src/` → `python3 tools/build_page.py` → commit + push → Netlify อัปเว็บเองใน 1–2 นาที

## บทเรียนที่ต้องจำ
- ชื่อไฟล์ .mcaddon ต้องเป็นอังกฤษล้วน ไม่มีเว้นวรรค (ชื่อไทย/เว้นวรรค → บน Android เกมเปิดแต่ไม่นำเข้า)
- UUID ของแพ็กห้ามเปลี่ยน (เก็บใน localStorage) เพื่อให้นำเข้าทับเวอร์ชันเก่าได้
- เลขไอเทมของแต่ละสกิน (`s.k`) คงที่ ไม่เลื่อนตามลำดับ
