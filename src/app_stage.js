/* =====================================================================
   โรงงานแปลงสกิน v2 — ทำตาม "สูตรทำแอดออนสกิน ISK" (SKIN_ADDON_RECIPE.md)
   ภาพรวม:
   1) รับ .png (64–2048) และ/หรือ .bbmodel → ตรวจ → ได้ "รายการกระดูก (bones)" แบบ Bedrock
      - มี .bbmodel: แปลงตามข้อ 3 ของสูตร (แกน x กลับด้าน: origin.x = -to.x)
      - ไม่มี: ใช้โมเดลมาตรฐานข้อ 2.5 ใส่เฉพาะส่วนที่สกินมีพิกเซลจริง (หัว+ชั้นหมวกเสมอ)
   2) วาดตัวอย่าง 3 มิติจาก bones ชุดเดียวกับที่จะใส่ในแอดออน (ไม่ใช่โมเดลสำเร็จรูป)
   3) กดสร้าง → ไฟล์ตามข้อ 1–2 ของสูตร → ตรวจแบบ check_addon.py → zip → ดาวน์โหลด
   ===================================================================== */

// ---------- สถานะของหน้า ----------
const state = {
  skins: [],    // [{id, name, model:'auto'|'classic'|'slim', slimAuto, dataUrl, px(ขนาดรูป), bb(ข้อมูลโมเดลที่แปลงแล้ว|null), bbName}]
  selected: -1,
  project: null, // {code, bp, bpm, rp, rpm} — เก็บไว้ให้สร้างซ้ำแล้วทับของเดิมได้ (UUID ห้ามเปลี่ยน)
  ns: 'isk'      // ชื่อย่อหน้าไอดีไอเทม เช่น isk:abcde_1 — แอดมินตั้งเองได้ กันชนกับแอดออนอื่นในเซิร์ฟ
};
const $ = id => document.getElementById(id);
const STORE_KEY = 'skinfactory_isk_v2';
const MAX_PNG = 24 * 1024 * 1024, MAX_BB = 40 * 1024 * 1024;

// ---------- ตัวช่วยทั่วไป ----------
function uuid(){
  if(crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2,'0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function randCode(){ // รหัสโปรเจกต์ 5 ตัว ใช้ต่อท้ายชื่อไอเทม กันชนกับแอดออน ISK ตัวอื่น
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(5))].map(x => a[x % a.length]).join('');
}
// ชื่อเริ่มต้นจากชื่อไฟล์ — ถ้าไม่มีตัวอักษรเลย (มือถือมักตั้งเป็นตัวเลข เช่น 1000083989) ให้ว่างไว้ ผู้ใช้พิมพ์เอง
function autoName(file){ const n = cleanName(String(file).replace(/\.png$/i,'').replace(/[_\-]+/g,' ')); return /\p{L}/u.test(n) ? n : ''; }
// ชื่อย่อ namespace: a-z ตัวแรก ตามด้วย a-z 0-9 _ ยาว 2–16 ห้ามเป็น minecraft
function validNs(n){ return typeof n === 'string' && /^[a-z][a-z0-9_]{1,15}$/.test(n) && n !== 'minecraft' && n !== 'minecon'; }
// เลขไอเทมถัดไปสำหรับสกินใหม่ (มากสุด + 1)
function nextK(){ return state.skins.reduce((m, s) => Math.max(m, s.k || 0), 0) + 1; }
// ไอดีไอเทมของสกิน (ตรงกับในไฟล์ที่สร้าง)
function itemId(s){ return `${state.ns}:${state.project ? state.project.code : '?????'}_${s.k}`; }
function cleanName(s){ return String(s || '').replace(/[\u0000-\u001f\u007f§]/g,'').trim().slice(0,40); }
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function show(el, kind, html){ el.className = 'msg ' + kind; el.innerHTML = html; }
// ชื่อไฟล์ที่ Minecraft บนมือถืออ่านได้แน่: เหลือแค่ A-Z a-z 0-9 _ - (ตัวอื่น/ภาษาไทย/เว้นวรรค → _ แล้วรวบให้สั้น)
function fileSafe(name){ return String(name).normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 40); }
// เปิดอยู่ในหน้า Claude (มีระบบดาวน์โหลดของ Claude) หรือเป็นเว็บจริงที่เปิดเองในเบราว์เซอร์
const IN_CLAUDE = !!(window.claude && typeof window.claude.use === 'function');
// ดาวน์โหลดไฟล์บนเว็บจริง: สร้างลิงก์ชั่วคราวแล้วกด (ลบลิงก์ทิ้งหลังใช้ กันแรมค้าง)
function saveBlob(blob, name){
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const r4 = v => Math.round(v * 10000) / 10000;
const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
function loadImg(src){ return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('อ่านรูปไม่ได้')); i.src = src; }); }
function readAs(f, kind){ return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); kind === 'text' ? r.readAsText(f) : r.readAsDataURL(f); }); }
function canvasOf(img, wrf){ const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d', wrf ? { willReadFrequently: true } : undefined).drawImage(img, 0, 0); return c; }
function dataUrlBytes(u){ const b = atob(u.split(',')[1]); const a = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
const baseName = n => n.replace(/\.(png|bbmodel)$/i, '').toLowerCase();

// ---------- บันทึก/โหลดโปรเจกต์ในเครื่อง ----------
function saveLocal(){
  const base = { project: state.project, ns: state.ns, packName: $('packName').value, packVer: $('packVer').value, slot: $('slot').value };
  try{ localStorage.setItem(STORE_KEY, JSON.stringify({ ...base, skins: state.skins })); return true; }
  catch(e){
    // สกิน HD ใหญ่เกินพื้นที่ในเครื่อง → จำแค่การตั้งค่า + UUID (สำคัญที่สุด จะได้ทับของเดิมได้)
    try{ localStorage.setItem(STORE_KEY, JSON.stringify({ ...base, skins: [] })); }catch(e2){}
    return false;
  }
}
// ค่าติดชิ้นที่จำไว้ในเครื่อง: เก็บเฉพาะชื่อชิ้นที่มีจริงและปลายทางที่รู้จัก (กันข้อมูลเพี้ยน/ถูกแก้)
function cleanAttach(s){
  const out = {}, a = s.attach;
  if(!s.bb || !a || typeof a !== 'object' || Array.isArray(a)) return out;
  const names = new Set(attachable(s.bb.bones).map(b => b.name));
  for(const k of Object.keys(a)) if(names.has(k) && Object.prototype.hasOwnProperty.call(ATTACH, a[k])) out[k] = a[k];
  return out;
}
function loadLocal(){
  try{
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if(!d) return;
    if(Array.isArray(d.skins)) state.skins = d.skins.filter(s => s && typeof s.dataUrl === 'string' && s.dataUrl.startsWith('data:image/png') && s.px > 0);
    state.skins.forEach(s => { if(s.bb && s.bb.bones) sanitizeBones(s.bb.bones); delete s.fx; if(!/\p{L}/u.test(s.name || '')) s.name = ''; s.attach = cleanAttach(s);
      if(s.special && s.parts && s.parts.body === false && s.parts.arms === false && s.parts.legs === false && !s.partsByUser) s.parts = undefined;   // v29: ส่วนที่ระบบเคยปิดเอง เปิดคืน
      s.jacketHead = s.jacketHead === true; s.adj = cleanAdj(s); });   // ชื่อ bone ของสกินที่จำไว้จากรุ่นก่อน • ล้างค่าฟังชั่นเก่า (ตัดระบบออกแล้ว)
    const p = d.project;
    const isU = u => typeof u === 'string' && /^[0-9a-f-]{36}$/i.test(u);
    if(p && /^[a-z0-9]{5}$/.test(p.code) && isU(p.bp) && isU(p.bpm) && isU(p.rp) && isU(p.rpm)) state.project = p;
    if(d.packName) $('packName').value = cleanName(d.packName);
    if(d.packVer) $('packVer').value = String(d.packVer).slice(0,12);
    if(['legs','head','chest','feet'].includes(d.slot)) $('slot').value = d.slot;
    if(validNs(d.ns)) state.ns = d.ns;
    $('nsIn').value = state.ns;
    // เลขไอเทมประจำสกิน (ไม่เปลี่ยนตามลำดับ ลบสกินอื่นแล้วไอดีไม่เลื่อน) — สกินที่จำไว้จากรุ่นก่อนใช้ลำดับเดิม = ไอดีเดิม
    state.skins.forEach((s, i) => { if(!(Number.isInteger(s.k) && s.k > 0 && s.k < 10000)) s.k = i + 1; });
  }catch(e){}
}

/* =====================================================================
   ส่วนอ่านรูปสกิน
   ===================================================================== */
// สกินเก่า 64x32 → 64x64: คัดลอกขา/แขนขวาไปเป็นข้างซ้าย (กลับด้านแต่ละหน้า แบบที่เกมทำ)
function upgradeLegacy(img){
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0);
  const limb = (su, sv, du, dv) => {
    for(const [sx,sy,w,h,dx,dy] of [[su+4,sv,4,4,du+4,dv],[su+8,sv,4,4,du+8,dv],[su,sv+4,4,12,du+8,dv+4],
                                    [su+4,sv+4,4,12,du+4,dv+4],[su+8,sv+4,4,12,du,dv+4],[su+12,sv+4,4,12,du+12,dv+4]]){
      g.save(); g.translate(dx + w, dy); g.scale(-1, 1); g.drawImage(img, sx, sy, w, h, 0, 0, w, h); g.restore();
    }
  };
  limb(0,16,16,48); limb(40,16,32,48);
  return c.toDataURL('image/png');
}
// พื้นที่ (หน่วย uv 64) มีพิกเซลทึบไหม — ใช้เลือกว่าจะใส่ชิ้นไหนในโมเดล
function regionHas(g, s, u, v, w, h){
  const d = g.getImageData(Math.floor(u*s), Math.floor(v*s), Math.max(1,Math.floor(w*s)), Math.max(1,Math.floor(h*s))).data;
  for(let i = 3; i < d.length; i += 4) if(d[i] > 8) return true;
  return false;
}
// สแกนว่าสกินมีส่วนไหนบ้าง + แขนเล็กไหม
function analyse(img){
  const s = img.width / 64, g = canvasOf(img, true).getContext('2d', { willReadFrequently: true });
  const has = {};
  for(const [k, r] of Object.entries(REG)) has[k] = regionHas(g, s, ...r);
  const slim = !regionHas(g, s, 54, 20, 2, 12) && has.rArm; // แขนเล็ก = แถบ 54-55 โปร่งใส
  return { has, slim, extra: extraPixels(g, s, slim), special: specialPieces(g, s, slim) };
}
// หารูโปร่งใสบนชั้นใน (หัว/ตัว/แขน/ขา) ของโมเดลมาตรฐาน — ในเกมผู้เล่นใช้สกินล่องหน รูพวกนี้จะมองทะลุตัว
// คืน [{part, pct}] เฉพาะส่วนที่มีรู (ว่างทั้งชิ้น = ตั้งใจไม่ใส่ ไม่เตือน • รูเยอะเกิน 10% ระบบมองว่าเป็นสกินชิ้นพิเศษอยู่แล้ว)
function holesOf(g, s, slim){
  const aw = slim ? 3 : 4, out = [];
  const P = { 'หัว':[[0,0,8,8,8]], 'ตัว':[[16,16,8,12,4]], 'แขน':[[40,16,aw,12,4],[32,48,aw,12,4]], 'ขา':[[0,16,4,12,4],[16,48,4,12,4]] };
  for(const [part, list] of Object.entries(P)){
    const cov = list.map(r => coverage(g, s, ...r)), c = Math.min(...cov);
    if(c > 0.02 && c < 0.998) out.push({ part, pct: Math.max(1, Math.round((1 - c) * 100)) });   // รูเล็กแค่ไม่กี่พิกเซลก็เตือน (มองทะลุได้จริง)
  }
  return out;
}
// สัดส่วนพิกเซลทึบบนหน้ากล่องของชิ้นหนึ่ง (0–1)
function coverage(g, s, u, v, w, h, d){
  let on = 0, tot = 0;
  for(const [fu, fv, fw, fh] of [[u+d,v,w,d],[u+d+w,v,w,d],[u,v+d,d,h],[u+d,v+d,w,h],[u+d+w,v+d,d,h],[u+2*d+w,v+d,w,h]]){
    const dd = g.getImageData(Math.floor(fu*s), Math.floor(fv*s), Math.max(1,Math.floor(fw*s)), Math.max(1,Math.floor(fh*s))).data;
    for(let i = 3; i < dd.length; i += 4){ tot++; if(dd[i] > 8) on++; }
  }
  return tot ? on / tot : 0;
}
/* สกินนี้มีชิ้นพิเศษ (ผม/ระนาบที่วางตาม .bbmodel) ไหม — ถ้ามี ต้องใช้ .bbmodel ไม่งั้นผมไปอยู่ผิดที่
   สัญญาณ: 1) มีพิกเซลในพื้นที่ที่สกินปกติไม่ใช้  2) ลายตัว/แขน/ขาชั้นในมีแค่บางส่วน (สกินปกติทึบเต็ม)
           3) ชั้นนอกมีลาย แต่ชั้นในของส่วนเดียวกันว่าง (ชิ้นลอยๆ ไม่ใช่เสื้อ)                            */
function specialPieces(g, s, slim){
  if(extraPixels(g, s, slim) >= 6) return 'unused';
  const aw = slim ? 3 : 4;
  const base = { body:[16,16,8,12,4], rArm:[40,16,aw,12,4], lArm:[32,48,aw,12,4], rLeg:[0,16,4,12,4], lLeg:[16,48,4,12,4] };
  const over = { body:[16,32,8,12,4], rArm:[40,32,aw,12,4], lArm:[48,48,aw,12,4], rLeg:[0,32,4,12,4], lLeg:[0,48,4,12,4] };
  for(const k of Object.keys(base)){
    const cb = coverage(g, s, ...base[k]), co = coverage(g, s, ...over[k]);
    if(cb > 0.02 && cb < 0.9) return 'partial';
    if(cb <= 0.02 && co > 0.02) return 'floating';
  }
  return '';
}
// พื้นที่ที่สกินมาตรฐานไม่ได้ใช้ (u, v, กว้าง, สูง) — ถ้ามีพิกเซลตรงนี้ = สกินมีชิ้นพิเศษ (ผม/ระนาบ) ที่วางตามไฟล์ .bbmodel
const UNUSED = [[0,0,8,8],[24,0,16,8],[56,0,8,8],
  [0,16,4,4],[12,16,8,4],[36,16,8,4],[52,16,12,4],[56,20,8,12],
  [0,32,4,4],[12,32,8,4],[36,32,8,4],[52,32,12,4],[56,36,8,12],
  [0,48,4,4],[12,48,8,4],[28,48,8,4],[44,48,8,4],[60,48,4,4]];
function extraPixels(g, s, slim){
  let n = 0;
  const areas = slim ? [...UNUSED, [54,20,2,12],[54,36,2,12],[46,52,2,12],[62,52,2,12]] : UNUSED;   // แขนเล็กเหลือแถบว่างเพิ่ม
  for(const [u, v, w, h] of areas){
    const d = g.getImageData(Math.floor(u*s), Math.floor(v*s), Math.max(1,Math.floor(w*s)), Math.max(1,Math.floor(h*s))).data;
    for(let i = 3; i < d.length; i += 4) if(d[i] > 8) n++;
  }
  return Math.round(n / (s * s));   // นับเป็นพิกเซลขนาด 64
}
// สกินนี้ต้องใช้ .bbmodel ไหม (มีชิ้นพิเศษ ≥ 6 พิกเซล64 และยังไม่ได้ใส่ .bbmodel และผู้ใช้ยังไม่ยืนยันใช้โมเดลมาตรฐาน)
const needsBB = s => false;   // v29: ไม่บล็อกแล้ว ไฟล์ .png อย่างเดียวก็สร้างได้ (แสดงแบบ Blockbench)
// พื้นที่ของแต่ละชิ้นในสกินมาตรฐาน (u, v, กว้าง, สูง)
const REG = {
  head:[0,0,32,16], hat:[32,0,32,16], body:[16,16,24,16], jacket:[16,32,24,16],
  rArm:[40,16,16,16], rSleeve:[40,32,16,16], lArm:[32,48,16,16], lSleeve:[48,48,16,16],
  rLeg:[0,16,16,16], rPants:[0,32,16,16], lLeg:[16,48,16,16], lPants:[0,48,16,16]
};

/* =====================================================================
   โมเดลมาตรฐาน (สูตรข้อ 2.5) — ใส่เฉพาะชิ้นที่สกินมีพิกเซล
   bones รูปแบบเดียวกับไฟล์ .geo.json ของ Bedrock
   ===================================================================== */
function standardBones(has, slim, jacketHead){
  const aw = slim ? 3 : 4, rx = slim ? -7 : -8;
  const C = (o, sz, uv, inf) => inf ? { origin:o, size:sz, uv, inflate:inf } : { origin:o, size:sz, uv };
  const part = (name, pivot, list) => {
    const cubes = list.filter(x => x[0]).map(x => x[1]);
    return cubes.length ? { name, pivot, cubes } : null;
  };
  return [
    // หัว + ชั้นหมวกใส่เสมอ (หัวคือหัวใจของสกิน ISK)
    { name:'head', pivot:[0,24,0], cubes:[ C([-4,24,-4],[8,8,8],[0,0]), C([-4,24,-4],[8,8,8],[32,0],0.5) ] },
    part('body', [0,24,0], [[has.body, C([-4,12,-2],[8,12,4],[16,16])], [has.jacket && !jacketHead && jacketHead !== 'body', C([-4,12,-2],[8,12,4],[16,32],0.25)]]),
    // ชั้นนอกตัวที่ผู้ใช้เลือกให้ตามหัว: แยกเป็น bone ลูกของหัว หมุนรอบคอ (ผมยาวที่วาดบนหลังเสื้อหันตามหัว)
    jacketHead === true && has.jacket ? { name:'jacket_head', parent:'head', pivot:[0,24,0], cubes:[ C([-4,12,-2],[8,12,4],[16,32],0.25) ] } : null,
    jacketHead === 'body' && has.jacket ? { name:'jacket_piece', parent:'body', pivot:[0,24,0], cubes:[ C([-4,12,-2],[8,12,4],[16,32],0.25) ] } : null,
    part('rightArm', [-5,22,0], [[has.rArm, C([rx,12,-2],[aw,12,4],[40,16])], [has.rSleeve, C([rx,12,-2],[aw,12,4],[40,32],0.25)]]),
    part('leftArm', [5,22,0], [[has.lArm, C([4,12,-2],[aw,12,4],[32,48])], [has.lSleeve, C([4,12,-2],[aw,12,4],[48,48],0.25)]]),
    part('rightLeg', [-1.9,12,0], [[has.rLeg, C([-3.9,0,-2],[4,12,4],[0,16])], [has.rPants, C([-3.9,0,-2],[4,12,4],[0,32],0.25)]]),
    part('leftLeg', [1.9,12,0], [[has.lLeg, C([-0.1,0,-2],[4,12,4],[16,48])], [has.lPants, C([-0.1,0,-2],[4,12,4],[0,48],0.25)]])
  ].filter(Boolean);
}

/* =====================================================================
   แปลง .bbmodel → bones ของ Bedrock (สูตรข้อ 3)
   - Blockbench เก็บแกน x กลับด้าน: origin = [-to.x, from.y, from.z], pivot = [-x, y, z]
   - การหมุน: x และ y กลับเครื่องหมาย (แบบที่ Blockbench export ให้)
   - กลุ่ม Head/Body/RightArm… → bone ชื่อเดียวกับผู้เล่น (ผูกตามตัวเอง)
   - ชิ้นที่อยู่นอกกลุ่มและไม่ใช่ชิ้นมาตรฐาน → bone ของตัวเอง ไม่มี parent (ตามตัวผู้เล่น)
   ไฟล์มาจากผู้ใช้ → ตรวจทุกค่าเป็นตัวเลขจริง จำกัดจำนวน
   ===================================================================== */
const STD = { waist:'waist', head:'head', body:'body', rightarm:'rightArm', leftarm:'leftArm', rightleg:'rightLeg', leftleg:'leftLeg' };
// ชื่อชิ้นมาตรฐานของ Blockbench (กรณีไม่มีกลุ่ม) → bone
const STD_EL = { 'head':'head','hat layer':'head','hat':'head','body':'body','body layer':'body','jacket':'body',
  'right arm':'rightArm','right arm layer':'rightArm','right sleeve':'rightArm','left arm':'leftArm','left arm layer':'leftArm','left sleeve':'leftArm',
  'right leg':'rightLeg','right leg layer':'rightLeg','right pants':'rightLeg','left leg':'leftLeg','left leg layer':'leftLeg','left pants':'leftLeg' };
function parseBBModel(text){
  let bb;
  try{ bb = JSON.parse(text); }catch(e){ throw new Error('ไฟล์ .bbmodel อ่านไม่ได้ (ไม่ใช่ JSON)'); }
  if(!bb || !Array.isArray(bb.elements)) throw new Error('ไฟล์ .bbmodel ไม่มีชิ้นส่วน (elements)');
  if(bb.elements.length > 3000) throw new Error('ชิ้นส่วนเยอะเกิน 3000');
  const v3 = a => Array.isArray(a) && a.length === 3 ? a.map(num) : [0,0,0];
  const resW = num(bb.resolution && bb.resolution.width) || 64, resH = num(bb.resolution && bb.resolution.height) || 64;
  const projBox = !(bb.meta && bb.meta.box_uv === false);
  const warns = [];
  const byUuid = {};
  for(const e of bb.elements) if(e && typeof e.uuid === 'string') byUuid[e.uuid] = e;
  const groupsBy = {};
  if(Array.isArray(bb.groups)) for(const g of bb.groups) if(g && typeof g.uuid === 'string') groupsBy[g.uuid] = g;

  const bones = []; const used = new Set();
  const uniq = n => { let b = n, i = 2; while(used.has(b)) b = n + '_' + (i++); used.add(b); return b; };
  const safe = n => String(n || 'bone').replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g,'').slice(0, 40) || 'bone';
  const boneFor = {}; // ชื่อ bone มาตรฐาน → object
  const stdBone = new Map(); // กลุ่มมาตรฐาน (Head/Body/…) → ชิ้นเพิ่มเติมที่แยกออกมาแล้ว {ชื่อ: bone}

  // แปลงชิ้นเดียว
  const toCube = e => {
    if(e.type && e.type !== 'cube'){ warns.push(`ข้ามชิ้น "${safe(e.name)}" (เป็น mesh ใช้ใน Bedrock ไม่ได้)`); return null; }
    if(e.visibility === false || e.export === false) return null;
    const f = v3(e.from), t = v3(e.to);
    const c = { origin: [r4(-t[0]), r4(f[1]), r4(f[2])], size: [r4(t[0]-f[0]), r4(t[1]-f[1]), r4(t[2]-f[2])] };
    const isBox = e.box_uv !== undefined ? !!e.box_uv : projBox;
    if(isBox){
      c.uv = Array.isArray(e.uv_offset) ? [num(e.uv_offset[0]), num(e.uv_offset[1])] : [0,0];
      if(e.mirror_uv) c.mirror = true;
    } else {
      c.uv = {};
      for(const side of ['north','south','east','west','up','down']){
        const fc = e.faces && e.faces[side];
        if(!fc || fc.texture === null || !Array.isArray(fc.uv)) continue;
        const [a,b,cx,d] = fc.uv.map(num);
        c.uv[side] = { uv:[r4(a), r4(b)], uv_size:[r4(cx-a), r4(d-b)] };
      }
      if(!Object.keys(c.uv).length) return null;
    }
    if(num(e.inflate)) c.inflate = num(e.inflate);
    const rot = v3(e.rotation);
    if(rot.some(x => x)){
      const o = v3(e.origin);
      c.pivot = [r4(-o[0]), r4(o[1]), r4(o[2])];
      c.rotation = [r4(-rot[0]), r4(-rot[1]), r4(rot[2])];
    }
    return c;
  };
  // กลุ่ม (outliner) → bone
  const walk = (node, parentBone) => {
    if(typeof node === 'string'){ // ชิ้นในกลุ่ม
      const e = byUuid[node]; if(!e) return;
      const c = toCube(e); if(!c) return;
      if(parentBone && stdBone.has(parentBone) && !STD_EL[String(e.name || '').toLowerCase().trim()]){
        // ชิ้นเพิ่มเติมที่วางตรงๆ ในกลุ่มมาตรฐาน (เช่น ผมที่วางในกลุ่ม Body) → แยกเป็น bone ลูกของส่วนนั้น
        //   รวมตามชื่อชิ้น (ชิ้นชื่อ cube เฉยๆ รวมเป็น <ส่วน>_extra) เพื่อให้ผู้ใช้ย้ายไปติดส่วนอื่นได้ในเว็บ
        //   การขยับในเกมเหมือนเดิมทุกอย่าง เพราะยังเป็นลูกของส่วนเดิม
        const kids = stdBone.get(parentBone);
        const k = safe(e.name).toLowerCase() === 'cube' ? parentBone.name + '_extra' : safe(e.name);
        let kb = kids[k.toLowerCase()];
        if(!kb){ kb = { name: uniq(k), parent: parentBone.name, pivot: parentBone.pivot.slice(), cubes: [] }; kids[k.toLowerCase()] = kb; bones.push(kb); }
        kb.cubes.push(c);
      }
      else if(parentBone){ parentBone.cubes = parentBone.cubes || []; parentBone.cubes.push(c); }
      else placeLoose(e, c);
      return;
    }
    if(!node || typeof node !== 'object') return;
    // Blockbench 4.x เก็บชื่อกลุ่มใน outliner, 5.x เก็บแยกใน bb.groups (อ้างด้วย uuid)
    if(node.uuid && groupsBy[node.uuid]) node = { ...groupsBy[node.uuid], ...node, name: node.name || groupsBy[node.uuid].name, origin: node.origin || groupsBy[node.uuid].origin, rotation: node.rotation || groupsBy[node.uuid].rotation };
    if(node.export === false) return;
    const key = safe(node.name).toLowerCase().replace(/_/g,'');
    const std = STD[key];
    let bone;
    if(std && !boneFor[std]){
      bone = { name: uniq(std), pivot: stdPivot(std) }; boneFor[std] = bone; stdBone.set(bone, {});
    } else {
      const o = v3(node.origin);
      bone = { name: uniq(safe(node.name)), pivot: [r4(-o[0]), r4(o[1]), r4(o[2])] };
      if(parentBone) bone.parent = parentBone.name;
    }
    const rot = v3(node.rotation);
    if(rot.some(x => x)) bone.rotation = [r4(-rot[0]), r4(-rot[1]), r4(rot[2])];
    bones.push(bone);
    for(const ch of (Array.isArray(node.children) ? node.children : [])) walk(ch, bone);
  };
  // ชิ้นนอกกลุ่ม: ชื่อมาตรฐาน → bone มาตรฐาน, ที่เหลือ → bone ของตัวเองไม่มี parent (สูตรข้อ 3)
  const placeLoose = (e, c) => {
    const std = STD_EL[String(e.name || '').toLowerCase().trim()];
    if(std){
      if(!boneFor[std]){ boneFor[std] = { name: uniq(std), pivot: stdPivot(std), cubes: [] }; bones.push(boneFor[std]); }
      boneFor[std].cubes = boneFor[std].cubes || []; boneFor[std].cubes.push(c);
    } else {
      const o = v3(e.origin);
      bones.push({ name: uniq(safe(e.name) === 'cube' ? 'part' : safe(e.name)), pivot: [r4(-o[0]), r4(o[1]), r4(o[2])], cubes: [c] });
    }
  };
  if(Array.isArray(bb.outliner) && bb.outliner.length) for(const n of bb.outliner) walk(n, null);
  else for(const e of bb.elements){ const c = toCube(e); if(c) placeLoose(e, c); }
  // ชิ้นที่ไม่อยู่ใน outliner เลย (ไฟล์บางแบบ)
  const inTree = new Set(); const mark = n => { if(typeof n === 'string') inTree.add(n); else if(n && Array.isArray(n.children)) n.children.forEach(mark); };
  (bb.outliner || []).forEach(mark);
  if(Array.isArray(bb.outliner) && bb.outliner.length) for(const e of bb.elements) if(e && !inTree.has(e.uuid)){ const c = toCube(e); if(c) placeLoose(e, c); }

  // ผมติดกับหัวแบบแข็ง: กระดูกที่ไม่ใช่ส่วนมาตรฐาน ไม่มี parent และมีชิ้นสูงเกินคอ (y > 24) → ผูกกับหัว
  //   (หันหัว/ก้มเงย ผมไปด้วย) ชิ้นที่อยู่ต่ำกว่าคอทั้งหมด (เช่น หาง) ยังตามตัวเหมือนเดิม
  const stdNames = new Set(Object.values(STD));
  for(const b of bones){
    if(b.parent || stdNames.has(b.name)) continue;
    const top = Math.max(-Infinity, ...(b.cubes || []).map(c => c.origin[1] + c.size[1] + (c.inflate || 0)));
    if(top > 24) b.parent = 'head';
  }
  // ตัด bone ว่าง (ไม่มีชิ้น ไม่มีลูก) ทิ้ง ยกเว้น head
  for(let again = true; again;){
    again = false;
    for(let i = bones.length - 1; i >= 0; i--){
      const b = bones[i];
      if(b.name !== 'head' && !(b.cubes && b.cubes.length) && !bones.some(x => x.parent === b.name)){ bones.splice(i, 1); again = true; }
    }
  }
  if(!bones.some(b => b.cubes && b.cubes.length)) throw new Error('ไม่พบชิ้นส่วนที่ใช้ได้ในไฟล์ .bbmodel');
  if(!boneFor.head) { bones.unshift({ name: uniq('head'), pivot: [0,24,0] }); } // ต้องมี bone head เสมอ (geometry none ก็ใช้)
  // เท็กซ์เจอร์ที่ฝังในไฟล์ (ใช้เมื่อผู้ใช้ไม่ได้ใส่ .png คู่กัน)
  let tex = null;
  const t0 = Array.isArray(bb.textures) && bb.textures[0];
  if(t0 && typeof t0.source === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(t0.source)) tex = t0.source;
  return { bones, texW: resW, texH: resH, tex, warns };
}
function stdPivot(n){ return ({ waist:[0,12,0], head:[0,24,0], body:[0,24,0], rightArm:[-5,22,0], leftArm:[5,22,0], rightLeg:[-1.9,12,0], leftLeg:[1.9,12,0] })[n]; }

/* =====================================================================
   รับไฟล์
   ===================================================================== */
async function makeSkinFromImage(name, url){
  let img = await loadImg(url);
  const okSize = (img.width === img.height && [64,128,256,512,1024,2048].includes(img.width)) || (img.width === 64 && img.height === 32);
  if(!okSize) throw new Error(`ขนาด ${img.width}×${img.height} ไม่ใช่สกิน (ต้องจัตุรัส 64–2048 หรือ 64×32)`);
  if(img.height === 32 && img.width === 64){ url = upgradeLegacy(img); img = await loadImg(url); }
  else url = canvasOf(img).toDataURL('image/png'); // วาดใหม่ให้เป็น png สะอาด
  const a = analyse(img);
  // v29: แสดงทุกชั้นที่มีลายเหมือน Blockbench (เดิมปิดตัว/แขน/ขาให้เองเมื่อเจอชิ้นพิเศษ → ผมที่วาดบนหลังหาย)
  const parts = undefined;
  return { id: Date.now() + '_' + Math.random().toString(36).slice(2,7), k: nextK(),   // k = เลขไอเทมประจำสกิน (สกินถูก push ทันทีหลังสร้าง เลขจึงไม่ซ้ำ)
           name: cleanName(name),   // ว่างได้ = ให้ผู้ใช้พิมพ์ชื่อเอง (ช่องขึ้นว่า "ใส่ชื่อสกิน")
           model: 'auto', slimAuto: a.slim, has: a.has, extra: a.extra, special: a.special, parts, dataUrl: url, px: img.width, bb: null, bbName: '' };
}
async function addFiles(files){
  const msgs = [], warns = [];
  const pngs = files.filter(f => /\.png$/i.test(f.name));
  const bbs = files.filter(f => /\.bbmodel$/i.test(f.name));
  const other = files.filter(f => !pngs.includes(f) && !bbs.includes(f));
  other.forEach(f => msgs.push(`${esc(f.name)}: รับเฉพาะ .png / .bbmodel`));
  let added = 0;
  // อ่าน .bbmodel ทั้งหมดก่อน เพื่อจับคู่กับ png ชื่อเดียวกัน
  const bbMap = {};
  for(const f of bbs){
    try{
      if(f.size > MAX_BB) throw new Error('ไฟล์ใหญ่เกิน 40MB');
      const p = parseBBModel(await readAs(f, 'text'));
      p.file = f.name; bbMap[baseName(f.name)] = p;
      p.warns.forEach(w => warns.push(`${esc(f.name)}: ${esc(w)}`));
    }catch(e){ msgs.push(`${esc(f.name)}: ${esc(e.message)}`); }
  }
  for(const f of pngs){
    try{
      if(f.size > MAX_PNG) throw new Error('ไฟล์ใหญ่เกิน 24MB');
      const s = await makeSkinFromImage(autoName(f.name), await readAs(f));
      const bb = bbMap[baseName(f.name)];
      if(bb){ attachBB(s, bb); delete bbMap[baseName(f.name)]; }
      state.skins.push(s); added++;
    }catch(e){ msgs.push(`${esc(f.name)}: ${esc(e.message)}`); }
  }
  // .bbmodel ที่ไม่มี png คู่ → ใช้รูปที่ฝังในไฟล์
  for(const [k, bb] of Object.entries(bbMap)){
    try{
      if(!bb.tex) throw new Error('ไม่มีรูปสกินในไฟล์ ใส่ .png ชื่อเดียวกันมาด้วย');
      const s = await makeSkinFromImage(autoName(bb.file.replace(/\.bbmodel$/i,'')), bb.tex);
      attachBB(s, bb); state.skins.push(s); added++;
    }catch(e){ msgs.push(`${esc(bb.file)}: ${esc(e.message)}`); }
  }
  if(added) state.selected = state.skins.length - 1;
  await render();
  const stored = saveLocal();
  const out = [];
  if(added) out.push(`เพิ่มแล้ว ${added} สกิน`);
  if(!stored && state.skins.length) out.push('<span class="note">สกิน HD ใหญ่เกินพื้นที่จำในเครื่อง — ถ้ารีเฟรชหน้าต้องใส่ไฟล์ใหม่ (แต่แพ็กยังทับของเดิมได้)</span>');
  const all = [...msgs, ...warns];
  if(all.length) show($('addMsg'), msgs.length ? 'err' : 'warn', [...out, ...all].join('<br>'));
  else if(out.length) show($('addMsg'), 'ok', out.join('<br>'));
}
// ทำให้ชื่อ bone ไม่ซ้ำกันแบบไม่สนตัวพิมพ์เล็ก/ใหญ่ (เกมมองว่า Hair กับ hair คือชื่อเดียวกัน)
// แก้ parent ที่อ้างชื่อเก่าให้ตามด้วย • ใช้ทั้งตอนใส่ .bbmodel และตอนโหลดสกินที่จำไว้ในเครื่อง
function sanitizeBones(bones){
  if(!Array.isArray(bones)) return [];
  const seen = new Set(), rename = new Map();
  for(const b of bones){
    let n = String(b.name || 'bone'), base = n, i = 2;
    while(seen.has(n.toLowerCase())) n = base + '_' + (i++);
    seen.add(n.toLowerCase());
    if(n !== b.name){ rename.set(b.name, n); b.name = n; }
  }
  for(const b of bones) if(b.parent && rename.has(b.parent)) b.parent = rename.get(b.parent);
  return bones;
}
function attachBB(s, bb){ s.bb = { bones: sanitizeBones(bb.bones), texW: bb.texW, texH: bb.texH }; s.bbName = bb.file; s.attach = {}; s.adj = {}; }   // ไฟล์ใหม่ = ล้างการเลือกติดเดิม

/* =====================================================================
   ไอคอน (สูตรข้อ 2.6): หน้าหัว (uv 8,8) + หน้าชั้นหมวก (uv 40,8) ซ้อนแบบ alpha → ย่อเนียน
   ===================================================================== */
async function faceCanvas(s, size, bg){
  const img = await loadImg(s.dataUrl);
  const k = img.width / 64;
  const src = document.createElement('canvas'); src.width = src.height = Math.round(8*k);
  const g = src.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(img, 8*k, 8*k, 8*k, 8*k, 0, 0, 8*k, 8*k);   // หน้า
  g.drawImage(img, 40*k, 8*k, 8*k, 8*k, 0, 0, 8*k, 8*k);  // ชั้นหมวกทับ (alpha over)
  const c = document.createElement('canvas'); c.width = c.height = size;
  const o = c.getContext('2d');
  if(bg){ o.fillStyle = bg; o.fillRect(0, 0, size, size); }
  // ย่อ = เนียน (ใกล้ LANCZOS), ขยายจากรูปเล็ก = คมแบบพิกเซล
  o.imageSmoothingEnabled = src.width > size; o.imageSmoothingQuality = 'high';
  o.drawImage(src, 0, 0, size, size);
  return c;
}

/* =====================================================================
   ตัวโชว์ 3 มิติ — วาดจาก bones จริง ตามกฎพิกัดหน้าเท็กซ์เจอร์ข้อ 3 ของสูตร
   (ตรงกับตัววาดพรีวิวใน build_*.py ที่ตรวจกับเกมแล้ว)
   ===================================================================== */
const V = { list:[], renderer:null, scene:null, cam:null, root:null, bones:{}, tex:null, walking:true, spin:true,
            body:true, night:false, yaw:0.5, pitch:0.12, t:0, last:0, dragging:false, key:'' };
// หน้าทั้ง 6 ของกล่อง box-uv: (สี่เหลี่ยมในรูป, มุม ซ้ายบน/ขวาบน/ซ้ายล่าง ในโลก)
function boxFaces(c){
  const inf = c.inflate || 0, [w,h,d] = c.size, o = c.origin;
  const x0=o[0]-inf, y0=o[1]-inf, z0=o[2]-inf, x1=o[0]+w+inf, y1=o[1]+h+inf, z1=o[2]+d+inf;
  // หน้าล่าง (ใต้คาง) ของสกินแบบกล่อง: ขอบบนของลายอยู่ด้านหลัง ขอบล่างอยู่ด้านหน้า แบบเดียวกับในเกม/Blockbench
  //   (v30 และก่อนหน้า วางกลับหัว → ใต้คางในตัวอย่างกลับหน้า-หลัง: ผมไปอยู่ใต้คาง สีผิวไปอยู่หลังคอ)
  const P = { north:[[x0,y1,z0],[x1,y1,z0],[x0,y0,z0]], south:[[x1,y1,z1],[x0,y1,z1],[x1,y0,z1]],
              west:[[x0,y1,z1],[x0,y1,z0],[x0,y0,z1]],  east:[[x1,y1,z0],[x1,y1,z1],[x1,y0,z0]],
              up:[[x0,y1,z1],[x1,y1,z1],[x0,y1,z0]],    down:[[x0,y0,z1],[x1,y0,z1],[x0,y0,z0]] };
  const out = [];
  if(Array.isArray(c.uv)){
    let [u,v] = c.uv;
    const R = { north:[u+d,v+d,w,h], south:[u+2*d+w,v+d,w,h], west:[u,v+d,d,h], east:[u+d+w,v+d,d,h], up:[u+d,v,w,d], down:[u+d+w,v,w,d] };
    for(const k in P) out.push([k, R[k], P[k]]);
  } else {
    P.down = [[x0,y0,z0],[x1,y0,z0],[x0,y0,z1]];   // ลาย UV รายหน้า (จาก .bbmodel) ใช้ทิศเดิม — แก้เฉพาะสกินแบบกล่อง (box UV) ที่ยืนยันแล้ว
    for(const k in P) if(c.uv[k]) out.push([k, [...c.uv[k].uv, ...c.uv[k].uv_size], P[k]]);
  }
  return out;
}
const SHADE = { north:0.95, south:0.8, west:0.82, east:0.82, up:1, down:0.65 };
function cubeMesh(c, texW, texH, pivot, mat, gray){
  const pos = [], uvs = [], col = [], idx = [];
  for(const [side, r, [TL,TR,BL]] of boxFaces(c)){
    const BR = [TR[0]+BL[0]-TL[0], TR[1]+BL[1]-TL[1], TR[2]+BL[2]-TL[2]];
    const area = Math.hypot(TR[0]-TL[0],TR[1]-TL[1],TR[2]-TL[2]) * Math.hypot(BL[0]-TL[0],BL[1]-TL[1],BL[2]-TL[2]);
    if(area < 1e-6 || (!gray && (r[2] === 0 || r[3] === 0))) continue;
    const b = pos.length / 3;
    for(const p of [TL,TR,BL,BR]) pos.push(p[0]-pivot[0], p[1]-pivot[1], p[2]-pivot[2]);
    const [u,v,w,h] = r;
    uvs.push(u/texW, 1-v/texH, (u+w)/texW, 1-v/texH, u/texW, 1-(v+h)/texH, (u+w)/texW, 1-(v+h)/texH);
    const s = SHADE[side]; for(let i = 0; i < 4; i++) col.push(s, s, s);
    idx.push(b, b+2, b+1, b+1, b+2, b+3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return new THREE.Mesh(g, mat);
}
const deg = Math.PI / 180;
function setRot(obj, r){ obj.rotation.set(-(r[0]||0)*deg, -(r[1]||0)*deg, (r[2]||0)*deg, 'ZYX'); } // +x ของ Bedrock = ก้ม
function initViewer(){
  if(V.renderer || !window.THREE) return !!V.renderer;
  const cv = $('vCanvas');
  V.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  V.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  V.scene = new THREE.Scene();
  V.cam = new THREE.PerspectiveCamera(28, 1, 1, 1000);
  // ลากหมุน
  const box = $('viewer'); let px = 0, py = 0;
  box.addEventListener('pointerdown', e => { if(e.target.closest('button')) return; V.dragging = true; px = e.clientX; py = e.clientY; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', e => { if(!V.dragging) return; V.yaw += (e.clientX-px)*0.01; V.pitch = Math.max(-0.6, Math.min(0.8, V.pitch + (e.clientY-py)*0.01)); px = e.clientX; py = e.clientY; });
  box.addEventListener('pointerup', () => V.dragging = false);
  box.addEventListener('pointercancel', () => V.dragging = false);
  requestAnimationFrame(loop);
  return true;
}
// สร้างกลุ่มกระดูกจาก geometry หนึ่งชุด แล้วลงทะเบียนชื่อไว้ให้ท่าเดิน/แอนิเมชันหาเจอ
function addGeo(geo, mat){
  const objs = {};
  for(const b of geo.bones){ const g = new THREE.Group(); g.userData = b; objs[b.name] = g; }
  for(const b of geo.bones){
    const g = objs[b.name], hasPar = b.parent && objs[b.parent], par = hasPar ? objs[b.parent] : V.root;
    const pp = hasPar ? objs[b.parent].userData.pivot : [0,0,0];
    g.position.set(b.pivot[0]-pp[0], b.pivot[1]-pp[1], b.pivot[2]-pp[2]);
    if(b.rotation) setRot(g, b.rotation);
    par.add(g);
    for(const c of (b.cubes || [])){
      if(c.rotation){ // ชิ้นที่หมุนเอง: กลุ่มย่อยที่จุดหมุนของชิ้น
        const sub = new THREE.Group(); const cp = c.pivot || [0,0,0];
        sub.position.set(cp[0]-b.pivot[0], cp[1]-b.pivot[1], cp[2]-b.pivot[2]); setRot(sub, c.rotation);
        sub.add(cubeMesh(c, geo.texW, geo.texH, cp, mat)); g.add(sub);
      } else g.add(cubeMesh(c, geo.texW, geo.texH, b.pivot, mat));
    }
    V.list.push({ name: b.name, g, pos: g.position.clone(), rot: b.rotation || [0,0,0] });
  }
  return objs;
}
// เท็กซ์เจอร์สกินที่ใช้อยู่ เก็บไว้ใช้ซ้ำ — ตอนลากแถบปรับชิ้นพิเศษ ตัวอย่างสร้างใหม่ถี่ๆ ไม่ต้องโหลดรูปใหม่ (ไม่กระพริบ)
function skinTex(url){
  if(V.tc && V.tc.url === url) return V.tc.tex;
  if(V.tc) V.tc.tex.dispose();
  V.tc = { url, tex: texOf(url) }; return V.tc.tex;
}
function texOf(src){
  const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.TextureLoader().load(src);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
}
async function buildPreview(s){
  if(!initViewer()) return;
  const geo = geometryOf(s);                              // สกินเปล่า: โมเดลหลักอย่างเดียว
  if(V.outer){ V.scene.remove(V.outer); V.outer.traverse(o => { if(o.geometry) o.geometry.dispose(); if(o.material){ if(o.material.map && !(V.tc && o.material.map === V.tc.tex)) o.material.map.dispose(); o.material.dispose(); } }); }
  V.list = [];
  const mat = new THREE.MeshBasicMaterial({ map: skinTex(s.dataUrl), alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true });
  const gmat = new THREE.MeshBasicMaterial({ color: 0x8c93a8, side: THREE.DoubleSide, vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  // root: แปลงพิกัด Bedrock → three (z กลับ ให้หน้า (-z) หันหากล้อง และ +x อยู่ขวาจอเหมือนพรีวิวของสูตร)
  V.root = new THREE.Group(); V.root.scale.set(1, 1, -1);
  const outer = new THREE.Group(); outer.add(V.root); outer.position.y = -13; V.scene.add(outer); V.outer = outer;
  addGeo(geo, mat);
  // ร่างเทา (ร่างผู้เล่นใต้สกิน) — หดเล็กน้อยให้เห็นส่วนโปร่งใสของสกิน แบบพรีวิวในสูตร
  V.gray = new THREE.Group(); V.root.add(V.gray);
  const aw = modelOf(s) === 'slim' ? 3 : 4;
  const GB = { head:[[-4,24,-4],[8,8,8],[0,24,0]], body:[[-4,12,-2],[8,12,4],[0,24,0]], rightArm:[[-4-aw,12,-2],[aw,12,4],[-5,22,0]],
               leftArm:[[4,12,-2],[aw,12,4],[5,22,0]], rightLeg:[[-3.9,0,-2],[4,12,4],[-1.9,12,0]], leftLeg:[[-0.1,0,-2],[4,12,4],[1.9,12,0]] };
  for(const [n, [o, sz, pv]] of Object.entries(GB)){
    const g = new THREE.Group(); g.position.set(...pv); V.gray.add(g);
    g.add(cubeMesh({ origin:o, size:sz, uv:[0,0], inflate:-0.08 }, 64, 64, pv, gmat, true));
    V.list.push({ name: n, g, pos: g.position.clone(), rot: [0,0,0] });
  }
  V.gray.visible = V.body;
  setNight(V.night);
  resize();
}
function resize(){
  if(!V.renderer) return;
  const box = $('viewer'), w = box.clientWidth, h = box.clientHeight;
  if(!w || !h) return;                       // กรอบถูกซ่อนอยู่ (มือถือก่อนใส่สกิน) ไม่ต้องปรับขนาด
  V.renderer.setSize(w, h, false); V.cam.aspect = w / h; V.cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
function loop(now){
  requestAnimationFrame(loop);
  if(!V.root) return;
  const dt = Math.min(0.1, (now - (V.last || now)) / 1000); V.last = now;
  V.clock = (V.clock || 0) + dt;
  if(V.walking) V.t += dt;
  if(V.spin && !V.dragging) V.yaw += dt * 0.5;
  const sw = V.walking ? Math.sin(V.t * 6) * 32 : 0;
  // หัวหันซ้าย-ขวา/ก้มเงยช้าๆ (ใช้เป็น q.target_y/x_rotation ด้วย ตาจะมองตาม)
  const hy = Math.sin(V.clock * 0.9) * 30, hx = Math.sin(V.clock * 0.55) * 12;
  const pose = { rightArm:[sw,0,0], leftArm:[-sw,0,0], rightLeg:[-sw*0.9,0,0], leftLeg:[sw*0.9,0,0], head:[hx,hy,0] };
  for(const it of V.list || []){
    const r = pose[it.name] || [0,0,0];
    setRot(it.g, [it.rot[0] + r[0], it.rot[1] + r[1], it.rot[2] + r[2]]);
  }
  V.outer.rotation.y = V.yaw;
  const dist = 92;
  V.cam.position.set(0, Math.sin(V.pitch) * dist, Math.cos(V.pitch) * dist); V.cam.lookAt(0, 0, 0);
  V.renderer.render(V.scene, V.cam);
}
function setNight(on){
  V.night = on;
  $('viewer').style.background = on ? 'radial-gradient(ellipse 55% 14% at 50% 78%,rgba(255,43,214,.10),transparent 70%),linear-gradient(180deg,#05071A,#02030A)' : '';
  if(V.root) V.root.traverse(o => { if(o.material && o.material.map && !o.material.userData.glow) o.material.color.setScalar(on ? 0.3 : 1); });
  if(V.gray) V.gray.traverse(o => { if(o.material) o.material.color.setHex(on ? 0x2a2d36 : 0x8c93a8); });
}

/* =====================================================================
   geometry ของสกินหนึ่งตัว (ใช้ทั้งพรีวิวและไฟล์จริง)
   ===================================================================== */
function modelOf(s){ return s.model === 'auto' ? (s.slimAuto ? 'slim' : 'classic') : s.model; }
// ส่วนที่ชิ้นพิเศษเลือกไปติดได้ (ค่า → ชื่อที่ผู้ใช้เห็น) • none = ไม่ติดส่วนไหน ตามตัวผู้เล่นเฉยๆ
const ATTACH = { head:'หัว', body:'ตัว', rightArm:'แขนขวา', leftArm:'แขนซ้าย', rightLeg:'ขาขวา', leftLeg:'ขาซ้าย', none:'ไม่ติด (ตามตัวผู้เล่น ไม่หันตามหัว)' };
const STD_NAMES = new Set(Object.values(STD));
// ชิ้นที่ผู้ใช้เลือก "ติดกับ" ได้: ทุก bone ที่ไม่ใช่ส่วนมาตรฐานของผู้เล่น
function attachable(bones){ return (bones || []).filter(b => !STD_NAMES.has(b.name) && ((b.cubes && b.cubes.length) || bones.some(x => x.parent === b.name))); }
// ใส่ค่าที่ผู้ใช้เลือกลงโครง (ไม่แก้ของเดิม คัดลอกใหม่) — ส่วนปลายทางที่ยังไม่มีในโมเดลจะเพิ่ม bone เปล่าให้
function applyAttach(bones, attach){
  const at = attach || {};
  if(!Object.keys(at).length) return bones;
  const out = bones.map(b => {
    const t = at[b.name];
    if(!t || STD_NAMES.has(b.name) || !Object.prototype.hasOwnProperty.call(ATTACH, t)) return b;
    const nb = { ...b };
    if(t === 'none') delete nb.parent; else nb.parent = t;
    return nb;
  });
  for(const t of new Set(Object.values(at))){
    if(t === 'none' || !Object.prototype.hasOwnProperty.call(ATTACH, t) || out.some(b => b.name === t)) continue;
    out.push({ name: t, pivot: stdPivot(t) });
  }
  return out;
}
/* ---------- ชิ้นพิเศษที่ปรับได้ (หมวด "ชิ้นพิเศษ" ใต้ตัวอย่าง 3 มิติ) ----------
   s.adj = { คีย์ชิ้น: { p:[x,y,z] เลื่อน (หน่วยพิกเซลสกิน 64), r:[x,y,z] หมุน (องศา) } }
   คีย์ชิ้น: .bbmodel = ชื่อ bone • .png = '@jacket' (ลายชั้นนอกของตัว เช่น ผมที่วาดบนหลัง) */
const ADJ_P = 16, ADJ_R = 180;                       // เลื่อนได้ ±16 พิกเซล (1 บล็อก) หมุนได้ ±180°
const adjOn = a => !!a && (a.p.some(v => v) || a.r.some(v => v));
function piecesOf(s){
  if(s.bb) return attachable(s.bb.bones).map(b => ({ key: b.name, label: b.name }));
  const h = s.has || {};
  if(h.jacket && (s.parts || {}).body !== false) return [{ key: '@jacket', label: 'ลายชั้นนอกของตัว (ผมที่วาดบนหลัง)' }];
  return [];
}
// เลื่อน/หมุนชิ้นหนึ่ง: เลื่อน = ย้ายจุดหมุนและทุกกล่องของชิ้นนั้นกับชิ้นลูกทั้งหมด • หมุน = บวกเพิ่มที่ bone (ลูกหมุนตาม)
function applyAdj(bones, name, a){
  if(!adjOn(a)) return bones;
  const kids = new Set([name]);
  for(let grew = true; grew;){ grew = false; for(const b of bones) if(b.parent && kids.has(b.parent) && !kids.has(b.name)){ kids.add(b.name); grew = true; } }
  const [dx, dy, dz] = a.p, mv = v => [r4(v[0] + dx), r4(v[1] + dy), r4(v[2] + dz)];
  return bones.map(b => {
    if(!kids.has(b.name)) return b;
    const nb = { ...b, pivot: mv(b.pivot) };
    if(b.cubes) nb.cubes = b.cubes.map(c => { const nc = { ...c, origin: mv(c.origin) }; if(c.pivot) nc.pivot = mv(c.pivot); return nc; });
    if(b.name === name && a.r.some(v => v)){ const r0 = b.rotation || [0,0,0]; nb.rotation = [0,1,2].map(i => r4(r0[i] + a.r[i])); }
    return nb;
  });
}
// ค่าปรับที่จำไว้ในเครื่อง: เก็บเฉพาะชิ้นที่มีจริง ตัวเลขจริง และอยู่ในช่วงที่อนุญาต
function cleanAdj(s){
  const out = {}, a = s.adj;
  if(!a || typeof a !== 'object' || Array.isArray(a)) return out;
  const keys = new Set(piecesOf(s).map(p => p.key));
  const v3 = (v, lim) => Array.isArray(v) && v.length === 3 ? v.map(x => Math.max(-lim, Math.min(lim, Number.isFinite(+x) ? +x : 0))) : [0,0,0];
  for(const k of Object.keys(a)) if(keys.has(k) && a[k] && typeof a[k] === 'object'){ const e = { p: v3(a[k].p, ADJ_P), r: v3(a[k].r, ADJ_R) }; if(adjOn(e)) out[k] = e; }
  return out;
}
function geometryOf(s){
  if(s.bb){
    let bones = applyAttach(s.bb.bones, s.attach);
    for(const [k, a] of Object.entries(s.adj || {})) if(bones.some(b => b.name === k)) bones = applyAdj(bones, k, a);
    return { bones, texW: s.bb.texW, texH: s.bb.texH };
  }
  // ผู้ใช้ปิดบางส่วนได้ (สกิน HD มักเก็บชิ้นผมไว้ในพื้นที่ขา/แขน ไม่ใช่ลายตัวจริง)
  const has = { ...(s.has || {}) }, pt = s.parts || {};
  if(pt.body === false) has.body = has.jacket = false;
  if(pt.arms === false) has.rArm = has.rSleeve = has.lArm = has.lSleeve = false;
  if(pt.legs === false) has.rLeg = has.rPants = has.lLeg = has.lPants = false;
    // ลายชั้นนอกตัว: ติดหัว หรือมีค่าปรับ → แยกเป็นชิ้นของตัวเอง (ไม่ปรับอะไร = รวมกับตัวแบบเดิม)
  const ja = (s.adj || {})['@jacket'];
  const jmode = s.jacketHead ? true : (adjOn(ja) ? 'body' : false);
  let bones = standardBones(has, modelOf(s) === 'slim', jmode);
  if(jmode && has.jacket){
    if(jmode === 'body' && !bones.some(b => b.name === 'body')) bones.splice(1, 0, { name: 'body', pivot: [0,24,0] });   // ตัวไม่มีลาย แต่ชิ้นต้องมีที่ติด
    bones = applyAdj(bones, jmode === true ? 'jacket_head' : 'jacket_piece', ja);
  }
  return { bones, texW: 64, texH: 64 };
}
// กล่องมองเห็น ต้องครอบทุกชิ้น (ผมยาว) ไม่งั้นผมหายบางมุมกล้อง — ขั้นต่ำตามสูตร 3×3 กลาง 1.5
function visibleBounds(bones){
  let maxR = 24, maxY = 48, minY = 0;
  for(const b of bones) for(const c of (b.cubes || [])){
    const inf = c.inflate || 0, pad = c.rotation ? Math.hypot(...c.size) : 0;
    for(const x of [c.origin[0]-inf-pad, c.origin[0]+c.size[0]+inf+pad]) for(const z of [c.origin[2]-inf-pad, c.origin[2]+c.size[2]+inf+pad]) maxR = Math.max(maxR, Math.abs(x), Math.abs(z));
    maxY = Math.max(maxY, c.origin[1] + c.size[1] + inf + pad); minY = Math.min(minY, c.origin[1] - inf - pad);
  }
  const w = Math.ceil((maxR * 2 / 16 + 0.5) * 2) / 2, top = Math.ceil((maxY / 16 + 0.25) * 2) / 2, bot = Math.floor(minY / 16 * 2) / 2;
  const h = Math.max(3, top - bot);
  return { width: Math.max(3, w), height: h, offset: [0, r4(bot + h / 2), 0] };
}

/* =====================================================================
   วาดรายการสกิน
   ===================================================================== */
async function render(){
  const list = $('list'); list.innerHTML = '';
  for(let i = 0; i < state.skins.length; i++){
    const s = state.skins[i];
    if(s.special === undefined){ // สกินที่จำไว้จากเวอร์ชันก่อน: ตรวจชิ้นพิเศษเพิ่ม
      try{ const im = await loadImg(s.dataUrl); s.special = specialPieces(canvasOf(im, true).getContext('2d', { willReadFrequently: true }), im.width / 64, modelOf(s) === 'slim'); }catch(e){ s.special = ''; }
    }
    const hk = modelOf(s);                       // ตรวจรูโปร่งใสใหม่เมื่อเปลี่ยนแขนเล็ก/ปกติ
    if(s.holesFor !== hk){
      try{ const im = await loadImg(s.dataUrl); s.holes = holesOf(canvasOf(im, true).getContext('2d', { willReadFrequently: true }), im.width / 64, hk === 'slim'); }catch(e){ s.holes = []; }
      s.holesFor = hk;
    }
    const row = document.createElement('div'); row.className = 'skin' + (i === state.selected ? ' sel' : '');
    const head = await faceCanvas(s, 112, '#18204A');
    const mid = document.createElement('div');
    const name = document.createElement('input'); name.type = 'text'; name.value = s.name; name.maxLength = 40;
    name.placeholder = 'ใส่ชื่อสกิน'; name.setAttribute('aria-label', 'ชื่อสกิน (ชื่อไอเทมในเกม)');
    name.classList.toggle('need', !s.name);
    name.oninput = () => { s.name = cleanName(name.value); name.classList.toggle('need', !s.name); saveLocal(); renderItems(); if(i === state.selected) $('vTag').textContent = s.name || 'ยังไม่ตั้งชื่อ'; };
    name.onclick = e => e.stopPropagation();
    mid.append(name);
    if(!s.bb){ // แขนเล็ก/ปกติ มีผลเฉพาะโมเดลมาตรฐาน
      const sel = document.createElement('select');
      sel.innerHTML = `<option value="auto">แขน: อัตโนมัติ (${s.slimAuto ? 'เล็ก' : 'ปกติ'})</option><option value="classic">แขนปกติ (Steve)</option><option value="slim">แขนเล็ก (Alex)</option>`;
      sel.value = s.model; sel.onclick = e => e.stopPropagation();
      sel.onchange = () => { s.model = sel.value; saveLocal(); if(i === state.selected) updateViewer(); };
      mid.append(sel);
      // เลือกส่วนที่จะใส่ (หัว+ชั้นหมวกใส่เสมอ)
      const pw = document.createElement('div'); pw.className = 'parts';
      const h0 = s.has || {};
      for(const [key, label, auto] of [['body','ตัว', h0.body || h0.jacket], ['arms','แขน', h0.rArm || h0.lArm || h0.rSleeve || h0.lSleeve], ['legs','ขา', h0.rLeg || h0.lLeg || h0.rPants || h0.lPants]]){
        const lb = document.createElement('label'); lb.className = 'chk small';
        const cb = document.createElement('input'); cb.type = 'checkbox';
        cb.checked = !!auto && (s.parts || {})[key] !== false; cb.disabled = !auto;
        cb.onclick = e => e.stopPropagation();
        cb.onchange = () => { s.parts = { ...(s.parts || {}), [key]: cb.checked }; s.partsByUser = true; saveLocal(); render(); };
        lb.onclick = e => e.stopPropagation();
        lb.append(cb, document.createTextNode(label + (auto ? '' : ' (ไม่มีลาย)'))); pw.append(lb);
      }
      mid.append(pw);
    }
    const meta = document.createElement('div'); meta.className = 'meta';
    const geo = geometryOf(s);
    const parts = geo.bones.filter(b => b.cubes && b.cubes.length).map(b => b.name);
    meta.innerHTML = `รูป ${s.px}×${s.px} • ${s.bb ? 'โมเดล: <b>' + esc(s.bbName) + '</b>' : 'โมเดลมาตรฐาน'}<br>ชิ้น: ${esc(parts.join(', '))}`;
    // เตือน: สกินมีชิ้นผม/ระนาบพิเศษ แต่ยังไม่มี .bbmodel → ผมจะไปอยู่ผิดที่
    if(!s.bb && s.special){   // แค่แนะนำ: สกินนี้น่าจะทำมาคู่กับ .bbmodel (ใส่หรือไม่ใส่ก็สร้างได้)
      const w = document.createElement('div'); w.className = 'needbb soft';
      w.innerHTML = 'ℹ สกินนี้มีชิ้นพิเศษ ตอนนี้แสดงแบบ Blockbench แล้ว • ถ้ามี <b>.bbmodel</b> ของสกินนี้ ใส่เพิ่มได้ ชิ้นพิเศษจะอยู่ตรงตำแหน่งที่ออกแบบไว้';
      meta.append(w);
    }
    // เตือนรูโปร่งใส (เฉพาะโมเดลมาตรฐาน ส่วนที่เลือกใส่)
    if(!s.bb && !s.special && s.holes && s.holes.length){
      const on = { 'หัว': true, 'ตัว': (s.parts || {}).body !== false, 'แขน': (s.parts || {}).arms !== false, 'ขา': (s.parts || {}).legs !== false };
      const hs = s.holes.filter(h => on[h.part]);
      if(hs.length){ const w = document.createElement('div'); w.className = 'holeWarn';
        w.textContent = '⚠ มีรูโปร่งใสบน ' + hs.map(h => `${h.part} ${h.pct}%`).join(', ') + ' — ในเกมจะมองทะลุตัวตรงนั้น (ถ้าตั้งใจก็ไม่เป็นไร)';
        meta.append(w); }
    }
    // มีชิ้นพิเศษ → บอกทางไปหมวดปรับ (อยู่ใต้ตัวอย่าง 3 มิติ)
    const pcs = piecesOf(s);
    if(pcs.length){ const t = document.createElement('div'); t.className = 'pcTip';
      t.textContent = `ชิ้นพิเศษ ${pcs.length} ชิ้น • ปรับติด/เลื่อน/หมุนได้ที่หมวด "ชิ้นพิเศษ" ใต้ตัวอย่าง 3 มิติ`; mid.append(t); }
    // ปุ่มใส่ .bbmodel เป็น <label for="bbIn"> (มือถือเปิดตัวเลือกไฟล์ได้แน่นอน), ปุ่มลบเป็นปุ่มธรรมดา
    let bbBtn;
    if(s.bb){
      bbBtn = document.createElement('button'); bbBtn.textContent = 'ลบ .bbmodel (ใช้โมเดลมาตรฐาน)';
      bbBtn.onclick = e => { e.stopPropagation(); s.bb = null; s.bbName = ''; s.attach = {}; s.adj = {}; saveLocal(); render(); };
    } else {
      bbBtn = document.createElement('label'); bbBtn.htmlFor = 'bbIn'; bbBtn.textContent = '+ ใส่ .bbmodel ของสกินนี้';
      bbBtn.onclick = e => { e.stopPropagation(); pendingBB = s; };
    }
    bbBtn.className = 'btn ghost small'; bbBtn.style.marginTop = '6px';
    mid.append(meta, bbBtn);
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.title = 'ลบ';
    x.onclick = e => { e.stopPropagation(); state.skins.splice(i,1); if(state.selected >= state.skins.length) state.selected = state.skins.length - 1; render(); saveLocal(); };
    row.append(head, mid, x);
    row.onclick = () => { if(state.selected !== i){ state.selected = i; render(); } };
    list.append(row);
  }
  $('listNote').style.display = state.skins.length ? 'block' : 'none';
  $('btnBuild').disabled = state.skins.length === 0;
  // ราวขั้นตอน: ขั้นที่ทำแล้วเป็นสีส้ม (มีสกิน → ขั้นเลือกสกิน/ตั้งค่า/ฟังชั่น เสร็จ, สร้างไฟล์แล้ว → ขั้นสร้างเสร็จ)
  const has = state.skins.length > 0;
  $('winSkin').classList.toggle('done', has); $('winSet').classList.toggle('done', has);
  if(!has) state.built = false;
  $('stageCol').classList.toggle('empty', !has); resize();   // มือถือ: ซ่อนกรอบพรีวิวจนกว่าจะมีสกิน
  $('winSet').classList.toggle('locked', !has); $('winBuild').classList.toggle('locked', !has);   // ยังไม่มีสกิน = ติดป้ายรอสกิน
  $('winBuild').classList.toggle('done', !!state.built);
  renderItems();
  updateViewer();
  renderPieces();
}
// ---------- รายการไอเทมที่จะได้ในเกม: ไอคอน (หน้าหัว = ไอคอนในกระเป๋าจริง) + ชื่อ + ปุ่มก๊อปคำสั่ง /give ----------
async function renderItems(){
  const box = $('itemList'), has = state.skins.length > 0;
  $('itemsBox').classList.toggle('hidden', !has);
  updateSticky();
  if(!has){ box.textContent = ''; return; }
  // สร้างรหัสโปรเจกต์ไว้เลย ไอดีไอเทมจะได้คงที่ตั้งแต่ก่อนกดสร้าง (คำสั่ง /give ที่ก๊อปไปใช้ได้จริง)
  if(!state.project){ state.project = { code: randCode(), bp: uuid(), bpm: uuid(), rp: uuid(), rpm: uuid() }; saveLocal(); }
  const rows = [];
  for(const s of state.skins){
    const r = document.createElement('div'); r.className = 'itemRow';
    const slot = document.createElement('div'); slot.className = 'invSlot';
    const ic = await faceCanvas(s, 64, null); ic.className = 'invIcon'; slot.append(ic);
    const txt = document.createElement('div'); txt.className = 'itemTxt';
    const nm = document.createElement('b'); nm.textContent = s.name || '(ยังไม่ตั้งชื่อ)';
    const cmd = `/give @s ${itemId(s)}`;
    const code = document.createElement('code'); code.textContent = cmd;
    txt.append(nm, code);
    const cp = document.createElement('button'); cp.type = 'button'; cp.className = 'btn ghost small'; cp.textContent = 'ก๊อป';
    cp.onclick = async () => { const ok = await copyText(cmd); cp.textContent = ok ? 'ก๊อปแล้ว ✓' : 'กดค้างที่คำสั่งเพื่อก๊อป'; setTimeout(() => cp.textContent = 'ก๊อป', 1800); };
    r.append(slot, txt, cp); rows.push(r);
  }
  box.textContent = ''; box.append(...rows);
}
// ก๊อปข้อความ: ใช้ clipboard ของเบราว์เซอร์ ถ้าถูกบล็อก (เช่น อยู่ในกรอบของ Claude) ใช้วิธีเลือกข้อความแล้ว copy แบบเก่า
async function copyText(t){
  try{ if(navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(t); return true; } }catch(e){}
  try{ const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-100px;opacity:0';
    document.body.append(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; }catch(e){ return false; }
}
// ---------- ปุ่มสร้างลอยล่างจอ (มือถือ): โผล่เมื่อมีสกิน และแผงสร้างแอดออนยังไม่อยู่ในจอ ----------
let buildInView = false;
function updateSticky(){
  const n = state.skins.length, bar = $('stickyBuild');
  $('stickyCount').textContent = n ? `${n} สกิน` : '';
  const show = n > 0 && !buildInView;
  bar.classList.toggle('on', show); document.body.classList.toggle('hasSticky', show);
}
if('IntersectionObserver' in window){
  new IntersectionObserver(es => { buildInView = es[0].isIntersecting; updateSticky(); }, { threshold: 0.25 }).observe($('winBuild'));
}
$('stickyBtn').onclick = () => {
  $('winBuild').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => { if(!$('btnBuild').disabled) $('btnBuild').click(); }, 450);   // เลื่อนไปให้เห็นข้อความผลก่อน แล้วค่อยสร้าง
};
let pendingBB = null;
/* =====================================================================
   หมวด "ชิ้นพิเศษ" (ใต้ตัวอย่าง 3 มิติ): เลือกชิ้น → ติดกับส่วนไหน + เลื่อน/หมุน ดูผลทันที
   ===================================================================== */
const ADJ_ROWS = [ ['p',0,'เลื่อนข้าง (ซ้าย-ขวา)'], ['p',1,'เลื่อนขึ้น-ลง'], ['p',2,'เลื่อนหน้า-หลัง'],
                   ['r',0,'หมุนก้ม-เงย'], ['r',1,'หมุนส่าย (หันซ้าย-ขวา)'], ['r',2,'หมุนเอียง'] ];
let pcSaveT = 0;
function renderPieces(){
  const box = $('pieceBox'); if(!box) return;
  const s = state.skins[state.selected];
  const pcs = s ? piecesOf(s) : [];
  box.hidden = !s;
  const body = $('pcBody'); body.textContent = '';
  if(!s) return;
  if(!pcs.length){
    const p = document.createElement('p'); p.className = 'note';
    p.textContent = s.bb ? 'โมเดลนี้ไม่มีชิ้นพิเศษนอกจากหัว/ตัว/แขน/ขา' : 'สกินนี้ไม่มีชิ้นพิเศษ • ถ้ามีผม/หาง/ปีกแบบ 3 มิติ ใส่ไฟล์ .bbmodel ของสกินเพิ่ม';
    body.append(p); return;
  }
  if(!pcs.some(p => p.key === s.pcSel)) s.pcSel = pcs[0].key;
  const pc = pcs.find(p => p.key === s.pcSel);
  const field = (label, el) => { const l = document.createElement('label'); l.className = 'pcField'; const t = document.createElement('span'); t.textContent = label; l.append(t, el); body.append(l); return l; };
  // เลือกชิ้น (ถ้ามีหลายชิ้น)
  if(pcs.length > 1){
    const pick = document.createElement('select'); pick.setAttribute('aria-label', 'เลือกชิ้นพิเศษ');
    for(const p of pcs){ const o = document.createElement('option'); o.value = p.key; o.textContent = p.label + (adjOn((s.adj || {})[p.key]) || (s.attach || {})[p.key] ? '  ✎' : ''); pick.append(o); }
    pick.value = s.pcSel; pick.onchange = () => { s.pcSel = pick.value; renderPieces(); };
    field(`ชิ้น (${pcs.length} ชิ้น)`, pick);
  } else { const t = document.createElement('div'); t.className = 'pcName'; t.textContent = pc.label; body.append(t); }
  // ติดกับส่วนไหน
  const to = document.createElement('select'); to.setAttribute('aria-label', 'ติดกับส่วนไหน');
  if(s.bb){
    const b = s.bb.bones.find(x => x.name === pc.key);
    const nice = { head:'หัว', body:'ตัว', rightArm:'แขนขวา', leftArm:'แขนซ้าย', rightLeg:'ขาขวา', leftLeg:'ขาซ้าย' };
    const o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'ตามไฟล์ (' + (b && b.parent ? (nice[b.parent] || 'ชิ้น ' + b.parent) : 'ไม่ติด') + ')'; to.append(o0);
    for(const [v, t] of Object.entries(ATTACH)){ const o = document.createElement('option'); o.value = v; o.textContent = t; to.append(o); }
    to.value = (s.attach || {})[pc.key] || '';
    to.onchange = () => { s.attach = { ...(s.attach || {}) }; if(to.value) s.attach[pc.key] = to.value; else delete s.attach[pc.key]; saveLocal(); updateViewer(); renderItems(); };
  } else {
    for(const [v, t] of [['body','ตัว (ขยับตามตัว)'], ['head','หัว (หันตามหัว)']]){ const o = document.createElement('option'); o.value = v; o.textContent = t; to.append(o); }
    to.value = s.jacketHead ? 'head' : 'body';
    to.onchange = () => { s.jacketHead = to.value === 'head'; saveLocal(); updateViewer(); };
  }
  field('ติดกับ', to);
  // แถบเลื่อน/หมุน
  const cur = () => { const a = (s.adj || {})[pc.key]; return a ? { p: a.p.slice(), r: a.r.slice() } : { p:[0,0,0], r:[0,0,0] }; };
  for(const [g, i, label] of ADJ_ROWS){
    const lim = g === 'p' ? ADJ_P : ADJ_R;
    const wrap = document.createElement('div'); wrap.className = 'pcRow';
    const t = document.createElement('span'); t.className = 'pcLbl'; t.textContent = label;
    const v = document.createElement('output'); v.className = 'pcVal';
    const r = document.createElement('input'); r.type = 'range'; r.min = -lim; r.max = lim; r.step = g === 'p' ? 0.5 : 1;
    r.setAttribute('aria-label', label); r.value = cur()[g][i];
    const fmt = x => (x > 0 ? '+' : '') + x + (g === 'p' ? ' px' : '°');
    v.textContent = fmt(+r.value);
    r.oninput = () => {
      const a = cur(); a[g][i] = Math.max(-lim, Math.min(lim, +r.value || 0)); v.textContent = fmt(a[g][i]);
      s.adj = { ...(s.adj || {}) }; if(adjOn(a)) s.adj[pc.key] = a; else delete s.adj[pc.key];
      updateViewer();                                   // ตัวอย่างสร้างใหม่ทันที (ใช้เท็กซ์เจอร์เดิม ไม่กระพริบ)
      clearTimeout(pcSaveT); pcSaveT = setTimeout(saveLocal, 400);   // จำลงเครื่องตอนหยุดลาก
    };
    const top = document.createElement('div'); top.className = 'pcTop'; top.append(t, v);
    wrap.append(top, r); body.append(wrap);
  }
  // ท่าสำเร็จรูปของลายชั้นนอกตัว (.png)
  //   ผมห้อยหลังหัว: ติดหัว + ดันไปข้างหลัง 2.1 ให้แผ่นหลัง (z 2.25) ไปอยู่เสมอหลังหัว (z ~4.35 เลยชั้นหมวก 4.5 ไม่ได้ จะซ้อนกัน) ห้อยลงตรงๆ ไม่หมุน
  //   ติดเสื้อแบบเดิม: ขยับตามตัว อยู่ตำแหน่งเดิมของลายบนหลังเสื้อ
  if(pc.key === '@jacket'){
    const pr = document.createElement('div'); pr.className = 'pcPresets';
    for(const [label, head, a] of [['ผมห้อยหลังหัว (แนะนำ)', true, { p:[0,0,2.1], r:[0,0,0] }], ['ติดเสื้อแบบเดิม', false, null]]){
      const b = document.createElement('button'); b.className = 'btn ghost small'; b.textContent = label;
      b.onclick = () => { s.jacketHead = head; s.adj = { ...(s.adj || {}) }; if(a) s.adj[pc.key] = a; else delete s.adj[pc.key]; saveLocal(); updateViewer(); renderPieces(); };
      pr.append(b);
    }
    body.insertBefore(pr, body.children[1] || null);
  }
  const rs = document.createElement('button'); rs.className = 'btn ghost small'; rs.textContent = 'รีเซ็ตเลื่อน/หมุนของชิ้นนี้';
  rs.onclick = () => { if(s.adj) delete s.adj[pc.key]; saveLocal(); updateViewer(); renderPieces(); };
  body.append(rs);
}
function updateViewer(){
  const s = state.skins[state.selected];
  $('vEmpty').style.display = s ? 'none' : 'block';
  $('vCanvas').style.visibility = s ? 'visible' : 'hidden';
  if(!s) return;
  $('vTag').textContent = s.name || 'ยังไม่ตั้งชื่อ';
  // ข้อมูลเล็กมุมขวาบนของเวที: ขนาดรูป + จำนวนชิ้นในโมเดล
  $('hudInfo').textContent = `${s.px}px • ${geometryOf(s).bones.reduce((n, b) => n + (b.cubes ? b.cubes.length : 0), 0)} ชิ้น`;
  if(!window.THREE){ $('vTag').textContent += ' (โหลดตัวโชว์ 3D ไม่ได้ ต้องต่อเน็ต)'; return; }
  const key = s.id + '|' + modelOf(s) + '|' + (s.bbName || '') + '|' + JSON.stringify(s.parts || {}) + '|' + JSON.stringify(s.attach || {}) + '|' + !!s.jacketHead + '|' + JSON.stringify(s.adj || {});
  if(V.key !== key){ V.key = key; buildPreview(s); }
}

/* =====================================================================
   สร้างไฟล์แอดออน (สูตรข้อ 1–2) — ฟังก์ชันล้วน ทดสอบนอกเบราว์เซอร์ได้
   ===================================================================== */
const SLOT = {
  head:  { slot:'slot.armor.head',  group:'minecraft:itemGroup.name.helmet',     th:'หมวก' },
  chest: { slot:'slot.armor.chest', group:'minecraft:itemGroup.name.chestplate', th:'เสื้อ' },
  legs:  { slot:'slot.armor.legs',  group:'minecraft:itemGroup.name.leggings',   th:'กางเกง' },
  feet:  { slot:'slot.armor.feet',  group:'minecraft:itemGroup.name.boots',      th:'รองเท้า' }
};
// แสดงเมื่อสวมในช่องเกราะ, ไม่วาดตอนถือในมือ และมุมมองบุคคลที่ 1 (ไม่บังจอ) — ห้ามเช็คชื่อช่องตรงๆ
const SHOW = "c.item_slot != 'main_hand' && c.item_slot != 'off_hand' && !c.is_first_person";
function buildFiles(opt){
  // opt: {packName, ver, slotKey, project, skins:[{name, key, geo:{bones,texW,texH}, png, icon}], packIcon}
  const P = opt.project, sl = SLOT[opt.slotKey];
  const BP = `ISK_${P.code}_BP/`, RP = `ISK_${P.code}_RP/`;
  const files = [];
  const J = (p, o) => files.push({ path: p, data: JSON.stringify(o, null, 2) });
  const ME = [1,21,60], meta = { authors: ['ISK'] };
  const desc = `${opt.packName} - สกินใส่ช่อง${sl.th} v${opt.ver.join('.')}`;
  J(BP + 'manifest.json', { format_version: 2,
    header: { name: opt.packName + ' BP', description: desc, uuid: P.bp, version: opt.ver, min_engine_version: ME },
    modules: [{ type: 'data', uuid: P.bpm, version: opt.ver }],
    dependencies: [{ uuid: P.rp, version: opt.ver }], metadata: meta });
  J(RP + 'manifest.json', { format_version: 2,
    header: { name: opt.packName + ' RP', description: desc, uuid: P.rp, version: opt.ver, min_engine_version: ME },
    modules: [{ type: 'resources', uuid: P.rpm, version: opt.ver }], metadata: meta });

  const texData = {}, readme = [];
  for(const s of opt.skins){
    const N = s.key, id = `${opt.ns || 'isk'}:${N}`;
    // ไอเทม (BP) — 1.21.60 ขึ้นไป ไม่งั้นชื่อกลุ่มแบบ minecraft: ไม่ทำงาน
    J(`${BP}items/${N}.json`, { format_version: '1.21.60', 'minecraft:item': {
      description: { identifier: id, menu_category: { category: 'equipment', group: sl.group } },
      components: { 'minecraft:icon': `isk_${N}`, 'minecraft:display_name': { value: s.name },
                    'minecraft:max_stack_size': 1, 'minecraft:wearable': { slot: sl.slot, protection: 0 } } } });
    // ภาพตอนสวม (RP): สกินเปล่า = geometry หลัก + geometry ว่าง (ใช้ตอนถือในมือ/มุมมองบุคคลที่ 1)
    const desc = { identifier: id, materials: { default: 'entity_alphatest' },
      textures: { default: `textures/isk/${N}/skin` },
      geometry: { default: `geometry.${N}`, none: `geometry.${N}.none` },
      render_controllers: [`controller.render.${N}`] };
    const rcs = { [`controller.render.${N}`]: { geometry: `${SHOW} ? Geometry.default : Geometry.none`,
        materials: [{ '*': 'Material.default' }], textures: ['Texture.default'] } };
    J(`${RP}attachables/${N}.json`, { format_version: '1.10.0', 'minecraft:attachable': { description: desc } });
    J(`${RP}render_controllers/${N}.render_controllers.json`, { format_version: '1.8.0', render_controllers: rcs });
    const vb = visibleBounds(s.geo.bones);
    const D = (ident, bones, tw = s.geo.texW, th = s.geo.texH) => ({ description: { identifier: ident, texture_width: tw, texture_height: th,
      visible_bounds_width: vb.width, visible_bounds_height: vb.height, visible_bounds_offset: vb.offset }, bones });
    const geos = [D(`geometry.${N}`, s.geo.bones), D(`geometry.${N}.none`, [{ name: 'head', pivot: [0,24,0] }])];
    J(`${RP}models/entity/${N}.geo.json`, { format_version: '1.16.0', 'minecraft:geometry': geos });
    files.push({ path: `${RP}textures/isk/${N}/skin.png`, data: s.png });
    files.push({ path: `${RP}textures/items/${N}.png`, data: s.icon });
    texData[`isk_${N}`] = { textures: `textures/items/${N}` };
    readme.push(`  - ${s.name}  →  /give @s ${id}`);
  }
  J(`${RP}textures/item_texture.json`, { resource_pack_name: `isk_${P.code}`, texture_name: 'atlas.items', texture_data: texData });
  if(opt.packIcon) for(const p of [BP, RP]) files.push({ path: p + 'pack_icon.png', data: opt.packIcon });
  const txt = [
    `${opt.packName} v${opt.ver.join('.')} — แอดออนสกิน ISEKAI (สร้างจากเว็บ ISEKAI สตูดิโอแปลงสกิน)`,
    ``, `วิธีใช้: ใช้สกินล่องหนเป็นสกินหลัก → เปิด BP ในโลก → สวมไอเทมในช่อง${sl.th}`,
    `ถือในมือ / มุมมองบุคคลที่ 1 จะไม่วาด (ไม่บังจอ)`, ``, `ไอเทม:`, ...readme, ``,
    `สำหรับคนแก้ต่อ: โครงไฟล์ตาม SKIN_ADDON_RECIPE.md (ISK) ข้อ 1-2 • สกินเปล่า ไม่มีฟังชั่นเสริม`,
    `  รหัสโปรเจกต์ ${P.code} • UUID ต้องคงเดิม เปลี่ยนแค่ version ทุกครั้งที่อัปเดต`
  ].join('\n');
  for(const p of [BP, RP]) files.push({ path: p + 'README.txt', data: txt });
  return files;
}

// ตรวจไฟล์ก่อนส่ง (แบบเดียวกับ scripts/check_addon.py + ข้อ 6 ของสูตร)
function checkFiles(files){
  const errs = [], J = {}, have = new Set(files.map(f => f.path));
  for(const f of files) if(f.path.endsWith('.json')){ try{ J[f.path] = JSON.parse(f.data); }catch(e){ errs.push('JSON พัง: ' + f.path); } }
  const bp = Object.keys(J).find(p => /_BP\/manifest\.json$/.test(p)), rp = Object.keys(J).find(p => /_RP\/manifest\.json$/.test(p));
  const BP = bp.replace('manifest.json',''), RP = rp.replace('manifest.json','');
  const mb = J[bp], mr = J[rp];
  const uu = [mb.header.uuid, mr.header.uuid, ...mb.modules.map(m => m.uuid), ...mr.modules.map(m => m.uuid)];
  if(new Set(uu).size !== uu.length) errs.push('UUID ซ้ำกัน');
  if(!mb.dependencies.some(d => d.uuid === mr.header.uuid)) errs.push('BP ไม่ได้ผูก RP');
  const geos = {}, rcs = {}, atts = {}, items = {}, anims = {};
  for(const [p, d] of Object.entries(J)){
    if(p.startsWith(RP + 'models/')) for(const g of d['minecraft:geometry']){
      const id = g.description.identifier; if(geos[id]) errs.push('geometry ซ้ำ ' + id); geos[id] = g;
      const names = g.bones.map(b => b.name);
      if(new Set(names).size !== names.length) errs.push(id + ': ชื่อ bone ซ้ำ');
      for(const b of g.bones){
        if(b.parent && !names.includes(b.parent)) errs.push(`${id}: parent ${b.parent} ไม่มีจริง`);
        for(const c of (b.cubes || [])){
          const bad = [...c.origin, ...c.size].some(v => !Number.isFinite(v));
          if(bad) errs.push(`${id}: ตัวเลขผิดใน ${b.name}`);
          if(Array.isArray(c.uv)){ // uv อยู่ในขอบรูป
            const [u,v] = c.uv, [w,h,dd] = c.size;
            if(u < 0 || v < 0 || u + 2*dd + 2*w > g.description.texture_width + 0.01 || v + dd + h > g.description.texture_height + 0.01) errs.push(`${id}: uv ของ ${b.name} เกินขอบรูป`);
          }
        }
      }
    }
    if(p.startsWith(RP + 'render_controllers/')) Object.assign(rcs, d.render_controllers);
    if(p.startsWith(RP + 'animations/')) Object.assign(anims, d.animations);
    if(p.startsWith(RP + 'attachables/')){ const a = d['minecraft:attachable'].description; atts[a.identifier] = a; }
    if(p.startsWith(BP + 'items/')){ const it = d['minecraft:item']; it._fv = d.format_version; items[it.description.identifier] = it; }
  }
  const itex = (J[RP + 'textures/item_texture.json'] || {}).texture_data || {};
  for(const [id, it] of Object.entries(items)){
    const ic = it.components['minecraft:icon'];
    if(!itex[ic]) errs.push(`${id}: ไอคอน ${ic} ไม่อยู่ใน item_texture.json`);
    else if(!have.has(RP + itex[ic].textures + '.png')) errs.push(`ไม่มีไฟล์ไอคอน ${itex[ic].textures}.png`);
    if(!atts[id]) errs.push(`${id}: ไม่มี attachable`);
    if(!(String(it._fv) >= '1.21.60')) errs.push(`${id}: format_version ต่ำกว่า 1.21.60`);
  }
  for(const [id, a] of Object.entries(atts)){
    if(!items[id]) errs.push(`attachable ${id} ไม่มีไอเทม`);
    for(const t of Object.values(a.textures)) if(!have.has(RP + t + '.png')) errs.push(`${id}: ไม่มีรูป ${t}.png`);
    for(const g of Object.values(a.geometry)) if(!geos[g]) errs.push(`${id}: ไม่มี ${g}`);
    for(const r of a.render_controllers) if(!rcs[r]) errs.push(`${id}: ไม่มี render controller ${r}`);
    // แอนิเมชัน: bone ที่อ้างต้องมีจริง
    const allBones = new Set(Object.values(a.geometry).filter(g => geos[g]).flatMap(g => geos[g].bones.map(b => b.name)));
    for(const an of Object.values(a.animations || {})){
      if(!anims[an]){ errs.push(`${id}: ไม่มีแอนิเมชัน ${an}`); continue; }
      for(const bn of Object.keys(anims[an].bones || {})) if(!allBones.has(bn)) errs.push(`${an}: ไม่มี bone ${bn}`);
    }
    // ตัวแปร v.xxx ทุกตัวที่อ่าน ต้องถูกตั้งค่า และตั้งใน initialize (กฎเหล็กสูตร 4)
    const sc = a.scripts || {};
    const setIn = arr => new Set([...(arr || []).join(' ').matchAll(/\bv\.(\w+)\s*=(?!=)/g)].map(m => m[1]));
    const init = setIn(sc.initialize), assigned = new Set([...init, ...setIn(sc.pre_animation)]);
    const usedTxt = JSON.stringify(sc) + JSON.stringify(Object.values(a.animations || {}).map(an => anims[an])) + JSON.stringify(a.render_controllers.map(r => rcs[r]));
    for(const v of new Set([...usedTxt.matchAll(/\bv\.(\w+)/g)].map(m => m[1]))){
      if(!assigned.has(v)) errs.push(`${id}: ตัวแปร v.${v} ถูกอ่านแต่ไม่เคยตั้งค่า`);
      else if(!init.has(v)) errs.push(`${id}: ตัวแปร v.${v} ไม่ได้ตั้งใน initialize`);
    }
    // วงเล็บ Molang ครบ
    for(const t of [...(sc.initialize || []), ...(sc.pre_animation || [])]){
      let n = 0, b = 0; for(const ch of t){ if(ch === '(') n++; if(ch === ')') n--; if(ch === '{') b++; if(ch === '}') b--; if(n < 0 || b < 0) break; }
      if(n || b) errs.push(`${id}: วงเล็บไม่ครบใน "${t.slice(0, 40)}…"`);
    }
  }
  return errs;
}

function parseVer(v){
  const p = String(v).trim().split('.').map(x => parseInt(x, 10));
  if(!p.length || p.length > 3 || p.some(x => !Number.isFinite(x) || x < 0 || x > 9999)) return null;
  while(p.length < 3) p.push(0);
  return p;
}
async function build(){
  const msg = $('buildMsg'), btn = $('btnBuild');
  btn.disabled = true; btn.classList.add('busy'); btn.textContent = 'กำลังสร้าง…';
  try{
    if(!state.skins.length) return show(msg, 'err', 'ยังไม่มีสกิน');
    const packName = cleanName($('packName').value) || 'ISEKAI สกิน';
    const ver = parseVer($('packVer').value);
    if(!ver) return show(msg, 'err', 'เวอร์ชันต้องเป็นตัวเลข เช่น 1 หรือ 1.2.0');
    if(!window.JSZip) return show(msg, 'err', 'โหลดตัวทำไฟล์ zip ไม่ได้ ลองรีเฟรชหน้า (ต้องต่อเน็ต)');
    if(!state.project) state.project = { code: randCode(), bp: uuid(), bpm: uuid(), rp: uuid(), rpm: uuid() };
    show(msg, 'warn', 'กำลังสร้าง…');
    // สกินที่ต้องมี .bbmodel แต่ยังไม่มี → ไม่สร้างไฟล์ (กันผมไปอยู่ผิดที่)
    const miss = state.skins.filter(needsBB);
    if(miss.length) return show(msg, 'err', 'ยังสร้างไม่ได้: สกินเหล่านี้ต้องใส่ .bbmodel ก่อน (ไม่งั้นผมจะไปอยู่ผิดที่)<br>• ' +
      miss.map(s => esc(s.name || '(ยังไม่ตั้งชื่อ)')).join('<br>• ') + '<br><span class="note">กด "+ ใส่ .bbmodel ของสกินนี้" ที่รายการ หรือติ๊ก "ใช้โมเดลมาตรฐานไปก่อน"</span>');
    // ทุกสกินต้องมีชื่อ (ชื่อนี้คือชื่อไอเทมในเกม)
    const noName = state.skins.map((s, i) => !cleanName(s.name) ? i + 1 : 0).filter(Boolean);
    if(noName.length){ document.querySelectorAll('#list .skin input.need')[0]?.focus();
      return show(msg, 'err', `ยังสร้างไม่ได้: ใส่ชื่อสกินก่อน (สกินลำดับที่ ${noName.join(', ')}) • ชื่อนี้จะเป็นชื่อไอเทมในเกม`); }
    const seen = {}, skins = [];
    for(let i = 0; i < state.skins.length; i++){
      const s = state.skins[i];
      let nm = cleanName(s.name) || 'สกิน';
      seen[nm] = (seen[nm] || 0) + 1; if(seen[nm] > 1) nm += ' ' + seen[nm];
      const icon = await faceCanvas(s, 64, null);
      skins.push({ name: nm, key: `${state.project.code}_${s.k}`, geo: geometryOf(s),
                   png: dataUrlBytes(s.dataUrl), icon: dataUrlBytes(icon.toDataURL('image/png')) });
    }
    const pk = await faceCanvas(state.skins[0], 256, '#0C0F1E');
    const files = buildFiles({ packName, ver, ns: state.ns, slotKey: $('slot').value, project: state.project, skins,
                               packIcon: dataUrlBytes(pk.toDataURL('image/png')) });
    const errs = checkFiles(files);
    if(errs.length) return show(msg, 'err', 'ตรวจไม่ผ่าน ยังไม่สร้างไฟล์:<br>' + errs.map(esc).join('<br>'));
    const zip = new JSZip();
    for(const f of files) zip.file(f.path, f.data);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const shortVer = ver[1] === 0 && ver[2] === 0 ? String(ver[0]) : ver.join('.');
    // สองโหมด: ในหน้า Claude ต้องส่งผ่านระบบดาวน์โหลดของ Claude (ได้แค่ .zip)
    //          บนเว็บจริงดาวน์โหลดเองได้ → ตั้งชื่อ .mcaddon ตรง ๆ แตะเปิดเข้าเกมได้เลย
    // ชื่อไฟล์ต้องเป็นอังกฤษ/ตัวเลขล้วน ไม่มีเว้นวรรค — ทดสอบจริงบน Android (24 พ.ย. 2026): ไฟล์ชื่อมีภาษาไทย+เว้นวรรค
    // แตะเปิดแล้วเกมเด้งขึ้นมาแต่ไม่นำเข้าเลย เปลี่ยนเป็นชื่ออังกฤษแล้วนำเข้าได้ (ชื่อแพ็กในเกมยังเป็นไทยได้ตามเดิม)
    const fileBase = fileSafe(packName) || 'ISEKAI_skin';
    const fname = `${fileBase}_v${shortVer}.${IN_CLAUDE ? 'zip' : 'mcaddon'}`;
    if(IN_CLAUDE){
      const dl = await claude.use('downloads').catch(() => null);
      if(!dl) return show(msg, 'err', 'หน้านี้ส่งไฟล์ดาวน์โหลดไม่ได้ในมุมมองนี้ ลองเปิดหน้านี้ในแอป/เว็บ Claude โดยตรง');
      try{ await dl.save({ filename: fname, data: blob }); }
      catch(e){
        if(e && e.code === 'declined') return show(msg, 'err', 'ยกเลิกการบันทึกแล้ว กดสร้างใหม่ได้');
        if(e && e.code === 'rate_limited') return show(msg, 'err', 'มีหน้าต่างบันทึกค้างอยู่ รอสักครู่แล้วกดใหม่');
        throw e;
      }
    } else saveBlob(new Blob([blob], { type: 'application/octet-stream' }), fname);
    $('packVer').value = ver[1] === 0 && ver[2] === 0 ? String(ver[0] + 1) : [ver[0], ver[1], ver[2] + 1].join('.');
    // ช่วงเวลาเดียวที่มีแอนิเมชันเด่น: แท่นโฮโลแกรมสว่างวาบตอนสร้างสำเร็จ
    state.built = true; $('winBuild').classList.add('done');
    $('viewer').classList.remove('summon'); void $('viewer').offsetWidth; $('viewer').classList.add('summon');   // แสงวาบตอนสร้างเสร็จ
    saveLocal();
    show(msg, 'ok', `สร้างเสร็จ ตรวจผ่านทุกข้อ ได้ไฟล์ <b>${esc(fname)}</b> (${skins.length} สกิน, เวอร์ชัน ${ver.join('.')})<br>
      ${IN_CLAUDE ? 'ต่อไป: เปลี่ยน <code>.zip</code> เป็น <code>.mcaddon</code> ตามวิธีด้านล่าง' : 'แตะเปิดไฟล์จากที่ดาวน์โหลด แล้วเลือก Minecraft ได้เลย'}<br>
      <span class="note">สร้างครั้งหน้า = แพ็กเดิมเวอร์ชันใหม่ นำเข้าทับได้เลย • ถ้าแตะไฟล์แล้วเกมเงียบ ไม่มีข้อความนำเข้า (ของในเกมไม่เปลี่ยน) → กด <b>ขอไอดีแพ็กใหม่</b> ในขั้นตั้งค่า แล้วสร้างใหม่</span>`);
  }catch(e){
    show(msg, 'err', 'สร้างไม่สำเร็จ: ' + esc(e && (e.message || e.code) || e));
  }finally{ btn.disabled = state.skins.length === 0; btn.classList.remove('busy'); btn.textContent = 'สร้างแอดออน'; }
}

// ---------- สกินล่องหน ----------
// 64×64 โปร่งใสทั้งรูป ยกเว้น 1 พิกเซลทึบที่มุมซ้ายบน (0,0) ซึ่งเป็นพื้นที่ที่โมเดลผู้เล่นไม่ได้ใช้
// (กันเกมบางรุ่นมองว่าไฟล์ว่างเปล่าแล้วไม่ยอมนำเข้า) • ชื่อไฟล์อังกฤษล้วน (บทเรียนจากเรื่องชื่อไฟล์ไทย)
async function downloadInvisible(){
  const msg = $('invisMsg');
  try{
    const c = newCanvasFixed(64, 64), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 1, 1);
    const png = await new Promise(r => c.toBlob(r, 'image/png'));
    if(IN_CLAUDE){
      // หน้า Claude ส่งได้แค่ .zip → ห่อ png ไว้ใน zip
      if(!window.JSZip) return show(msg, 'err', 'โหลดตัวทำไฟล์ zip ไม่ได้ ลองรีเฟรชหน้า');
      const zip = new JSZip(); zip.file('ISEKAI_invisible_skin.png', png);
      const dl = await claude.use('downloads').catch(() => null);
      if(!dl) return show(msg, 'err', 'หน้านี้ส่งไฟล์ดาวน์โหลดไม่ได้ในมุมมองนี้');
      await dl.save({ filename: 'ISEKAI_invisible_skin.zip', data: await zip.generateAsync({ type: 'blob' }) });
      show(msg, 'ok', 'ได้ไฟล์ zip แล้ว แตกไฟล์ออกมาจะได้ <code>ISEKAI_invisible_skin.png</code>');
    } else {
      saveBlob(png, 'ISEKAI_invisible_skin.png');
      show(msg, 'ok', 'โหลดแล้ว: <code>ISEKAI_invisible_skin.png</code> อยู่ในโฟลเดอร์ Download');
    }
  }catch(e){
    if(e && e.code === 'declined') return show(msg, 'err', 'ยกเลิกการบันทึกแล้ว');
    show(msg, 'err', 'โหลดไม่สำเร็จ: ' + esc(e && (e.message || e.code) || e));
  }
}
function newCanvasFixed(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
$('btnInvis').onclick = downloadInvisible;

// ---------- ผูกปุ่ม ----------
// เลือกไฟล์: กรอบใหญ่เป็น label ของ fileIn อยู่แล้ว
// ลิงก์หน้านี้บน claude.ai (หน้าเว็บรันในโดเมนแยก จึงอ่านลิงก์จริงจาก location ไม่ได้)
$('fileIn').onchange = e => { const fs = [...e.target.files]; e.target.value = ''; if(fs.length) addFiles(fs); };
$('bbIn').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  const s = pendingBB; pendingBB = null;
  if(!f || !s) return;
  try{
    if(f.size > MAX_BB) throw new Error('ไฟล์ใหญ่เกิน 40MB');
    const p = parseBBModel(await readAs(f, 'text')); p.file = f.name;
    attachBB(s, p); saveLocal(); await render();
    show($('addMsg'), p.warns.length ? 'warn' : 'ok', `ใส่โมเดล ${esc(f.name)} ให้ ${esc(s.name)} แล้ว` + (p.warns.length ? '<br>' + p.warns.map(esc).join('<br>') : ''));
  }catch(err){ show($('addMsg'), 'err', `${esc(f.name)}: ${esc(err.message)}`); }
};
['dragover','dragenter'].forEach(t => $('drop').addEventListener(t, e => { e.preventDefault(); $('drop').classList.add('over'); }));
['dragleave','drop'].forEach(t => $('drop').addEventListener(t, e => { e.preventDefault(); $('drop').classList.remove('over'); }));
$('drop').addEventListener('drop', e => addFiles([...e.dataTransfer.files]));
$('btnBuild').onclick = build;
$('btnWalk').onclick = () => { V.walking = !V.walking; $('btnWalk').textContent = V.walking ? 'หยุดเดิน' : 'เดิน'; };
$('btnSpin').onclick = () => { V.spin = !V.spin; };
$('btnBody').onclick = () => { V.body = !V.body; if(V.gray) V.gray.visible = V.body; $('btnBody').textContent = 'ร่างเทา: ' + (V.body ? 'เปิด' : 'ปิด'); };
$('btnNight').onclick = () => { setNight(!V.night); $('btnNight').textContent = V.night ? 'กลางวัน' : 'กลางคืน'; };
$('btnNew').onclick = () => {
  const b = $('btnNew'); // กดสองครั้งเพื่อยืนยัน (หน้านี้ใช้ confirm() ไม่ได้)
  if(b.dataset.arm !== '1'){ b.dataset.arm = '1'; b.textContent = 'กดอีกครั้งเพื่อยืนยัน'; setTimeout(() => { b.dataset.arm = ''; b.textContent = 'เริ่มแพ็กใหม่แยกต่างหาก'; }, 3000); return; }
  state.skins = []; state.selected = -1; state.project = null; V.key = '';   // namespace เก็บไว้เหมือนเดิม
  $('packName').value = 'ISEKAI สกิน'; $('packVer').value = '1';
  b.dataset.arm = ''; b.textContent = 'เริ่มแพ็กใหม่แยกต่างหาก';
  $('addMsg').className = 'msg'; $('buildMsg').className = 'msg';
  render(); saveLocal();
};
// ขอไอดีแพ็กใหม่ แต่เก็บสกินและการตั้งค่าไว้ครบ — แก้อาการ "แตะไฟล์แล้วเกมเงียบ" ที่เกิดจากไอดีชนกับแพ็กที่อยู่ในเกม
//   (ทดสอบจริงบน Android: ไฟล์เดิมเงียบ แต่ไฟล์เดียวกันที่ไอดีใหม่นำเข้าได้) • เลขไอเทมเปลี่ยนด้วย เพราะรหัสโปรเจกต์ใหม่
$('btnNewId').onclick = () => {
  const b = $('btnNewId');
  if(b.dataset.arm !== '1'){ b.dataset.arm = '1'; b.textContent = 'กดอีกครั้งเพื่อยืนยัน'; setTimeout(() => { b.dataset.arm = ''; b.textContent = 'ขอไอดีแพ็กใหม่ (สกินอยู่ครบ)'; }, 3000); return; }
  b.dataset.arm = ''; b.textContent = 'ขอไอดีแพ็กใหม่ (สกินอยู่ครบ)';
  state.project = { code: randCode(), bp: uuid(), bpm: uuid(), rp: uuid(), rpm: uuid() };
  $('packVer').value = '1'; state.built = false;
  $('buildMsg').className = 'msg';
  saveLocal(); render();
  show($('newIdMsg'), 'ok', 'ได้ไอดีแพ็กใหม่แล้ว (เวอร์ชันเริ่มที่ 1) • กดสร้างแอดออนใหม่ แล้วนำเข้าเกม');
};
['packName','packVer','slot'].forEach(id => $(id).addEventListener('change', saveLocal));
// namespace: พิมพ์แล้วตรวจทันที ใช้ได้ = บันทึก + อัปเดตคำสั่ง /give, ใช้ไม่ได้ = ขอบแดง + บอกเหตุผล
$('nsIn').addEventListener('input', () => {
  const v = $('nsIn').value.trim().toLowerCase(), ok = validNs(v);
  $('nsIn').classList.toggle('bad', !ok);
  $('nsMsg').textContent = ok ? (v === state.ns ? '' : 'เปลี่ยนแล้ว: ไอเทมจากแพ็กเวอร์ชันก่อนที่อยู่ในโลกจะหายไป ต้องแจกใหม่') :
    'ใช้ได้เฉพาะ a-z ตัวเล็ก ตัวเลข และ _ ยาว 2–16 ตัว ขึ้นต้นด้วยตัวอักษร (ห้ามใช้ minecraft)';
  if(ok && v !== state.ns){ state.ns = v; saveLocal(); renderItems(); }
});

$('renameBox').classList.toggle('hidden', !IN_CLAUDE); $('openBox').classList.toggle('hidden', IN_CLAUDE);   // กล่องวิธีเปิดไฟล์ตามโหมด
loadLocal();
if(state.skins.length) state.selected = 0;
render();
