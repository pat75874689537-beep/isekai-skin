"""ประกอบหน้าเว็บจากไฟล์ใน src/ (แก้ที่ src แล้วรันสคริปต์นี้ใหม่: python3 tools/build_page.py)
ได้ 2 ไฟล์:
  index.html          = เว็บจริง (Netlify ดึงไฟล์นี้ไปขึ้น isekai-skin.netlify.app อัตโนมัติเมื่อ push)
  claude_artifact.html = ฉบับสำหรับหน้า artifact ใน claude.ai (ไม่มี CSP เพราะ Claude ฉีดโค้ดของตัวเองเข้าไป)"""
import re, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
src = R / 'src'
head = (src / 'head.html').read_text()
body = (src / 'body.html').read_text()
css = (src / 'extra.css').read_text() + (src / 'logo.css').read_text() + (src / 'theme.css').read_text()
app = (src / 'app_stage.js').read_text()
INIT = "loadLocal();\nif(state.skins.length) state.selected = 0;\nrender();\n"
assert app.rstrip().endswith('render();')
app = app[:app.rindex('loadLocal();')]
# v22: ตัดระบบฟังชั่นสกินออก (เก็บไว้ใน src/_archive_fx/) เหลือแค่สกินเปล่า
js = app + (src / 'logo.js').read_text() + (src / 'layout.js').read_text() + "\n// ---------- เริ่มทำงาน ----------\n" + INIT
page = head + css + '</style>\n' + body + '<script>\n' + js + '</script>\n</body>\n</html>\n'
(R / 'claude_artifact.html').write_text(page)
print('ok', len(page))

# ---------- เวอร์ชันเว็บจริง (site/) ----------
# ไฟล์เดียวกัน + ป้องกันเพิ่มที่ใส่ได้เฉพาะเว็บจริง (ในหน้า Claude ใส่ไม่ได้ เพราะ Claude ฉีดโค้ดของมันเองเข้ามา):
#  • CSP = รายชื่อแหล่งที่หน้านี้ยอมโหลด/ส่งข้อมูล อย่างอื่นบล็อกหมด (สกินไม่มีทางถูกส่งออกไปไหน)
#    (v27: เอา 'unsafe-eval' ออกแล้ว — ระบบ Molang ถูกตัดไปตั้งแต่ v22 ไม่มีโค้ดไหนใช้ eval แล้ว)
#  • ไอคอนแท็บ + คำอธิบายตอนแชร์ลิงก์
SITE_HEAD = '''<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src data: blob:; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="referrer" content="no-referrer">
<meta name="description" content="ISEKAI — แปลงสกิน Minecraft Bedrock เป็นแอดออนชุดเกราะ ได้ไฟล์ .mcaddon ทำในเครื่องคุณเอง ไม่อัปโหลดสกินไปไหน">
<meta property="og:title" content="ISEKAI — สตูดิโอแปลงสกินเป็นแอดออน">
<meta property="og:description" content="ใส่สกิน .png / .bbmodel แล้วได้ไฟล์ .mcaddon นำเข้าเกมได้ทันที">
<meta name="theme-color" content="#0A0B14">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%230A0B14'/%3E%3Cpath d='M7 6h18l-3 20H4z' fill='%23F3E600'/%3E%3Cpath d='M12 10h9l-.6 3h-2.7l-1.4 7h2.7l-.6 3h-9l.6-3h2.7l1.4-7h-2.7z' fill='%230A0B14'/%3E%3C/svg%3E">
'''
assert '<meta name="viewport"' in page
(R / 'index.html').write_text(page.replace('<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta name="viewport" content="width=device-width, initial-scale=1">\n' + SITE_HEAD, 1))
print('site ok')
