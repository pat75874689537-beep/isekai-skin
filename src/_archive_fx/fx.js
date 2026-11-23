
/* =====================================================================
   ฟังชั่นเสริมของสกิน (สูตร ISK ข้อ 4) — ทำด้วย Molang + animation ล้วน ไม่มีสคริปต์
   - ตัดระยะ (4.1)  - กระพริบตาแบบขนตาเลื่อน (4.2)  - ตาขยับ (4.3)  - ตาเรืองแสง (4.4)  - ผมพริ้ว (4.6)
   ทุกชิ้นที่เลื่อน/ย่อ ระบบเติมพิกเซลที่จะโผล่ให้เอง (ข้อ 8.6) แล้วตรวจซ้ำก่อนสร้างไฟล์
   ===================================================================== */
// ค่าเริ่มต้น = สกินเปล่า ไม่มีฟังชั่นอะไรเลย (ผมติดหัวแข็งๆ ตามโมเดล)
// ฟังชั่นเสริมทุกอย่างเป็นโค้ดสำเร็จรูป ผู้ใช้ติ๊กเลือกเองทีละสกิน
const FX_DEFAULT = () => ({ ver: 3, blink: 'off', move: false, glow: false, flow: false, range: 10, eyes: null });
function fxOf(s){
  if(!s.fx || typeof s.fx !== 'object') s.fx = FX_DEFAULT();
  if(s.fx.ver !== 3) s.fx = { ...FX_DEFAULT(), eyes: s.fx.eyes || null };   // ค่าจากรุ่นก่อน → กลับเป็นสกินเปล่า (กรอบตาที่ลากไว้ยังอยู่)
  const f = s.fx;
  if(!['off','normal','slow'].includes(f.blink)) f.blink = 'normal';
  f.move = !!f.move; f.glow = !!f.glow; f.flow = !!f.flow;
  if(![5,10,15,25,40].includes(f.range)) f.range = 10;
  if(f.eyes && !(validBox(f.eyes.l) && validBox(f.eyes.r))) f.eyes = null;
  if(f.eyes) f.eyes.paint = cleanPaint(f.eyes.paint);
  return f;
}
// พิกเซลที่ผู้ใช้แตะแต่งเอง: { iris|open|core : { "x,y": 1 (ใส่) | 0 (เอาออก) } }  x,y = พิกเซลบนหน้าหัวในสกิน
// ค่ามาจาก localStorage จึงกรองให้เหลือแค่รูปแบบที่ถูกต้อง และจำกัดจำนวน กันข้อมูลแปลก ๆ
const PAINT_LAYERS = ['iris', 'open', 'core'];
function cleanPaint(pt){
  const out = {};
  if(!pt || typeof pt !== 'object') return out;
  for(const L of PAINT_LAYERS){
    const m = pt[L]; if(!m || typeof m !== 'object') continue;
    const o = {}; let n = 0;
    for(const [key, v] of Object.entries(m)){
      if(n >= 4096) break;
      if(/^\d{1,4},\d{1,4}$/.test(key) && (v === 0 || v === 1)){ o[key] = v; n++; }
    }
    if(n) out[L] = o;
  }
  return out;
}
function validBox(b){ return b && ['x0','x1','y0','y1'].every(k => Number.isFinite(b[k])) && b.x1 > b.x0 && b.y1 > b.y0 && b.x0 >= -4.5 && b.x1 <= 4.5 && b.y0 >= 23.5 && b.y1 <= 32.5; }
const anyEyeFx = f => f.blink !== 'off' || f.move || f.glow;

/* ---------- Molang → JavaScript (ใช้ให้พรีวิวในเว็บรันสูตรตัวเดียวกับในเกมเป๊ะ) ----------
   แปลงเฉพาะรูปแบบที่เว็บนี้สร้างเอง: "v.a = …;" และ "เงื่อนไข ? { คำสั่ง; คำสั่ง; };"           */
const M = {
  sin: a => Math.sin(a * Math.PI / 180), cos: a => Math.cos(a * Math.PI / 180),           // Molang ใช้องศา
  clamp: (x, a, b) => Math.min(b, Math.max(a, x)), min: Math.min, max: Math.max, abs: Math.abs, pow: Math.pow,
  mod: (a, b) => a % b, lerp: (a, b, t) => a + (b - a) * t,
  random: (a, b) => a + Math.random() * (b - a), random_integer: (a, b) => Math.floor(a + Math.random() * (b - a + 1))
};
function molangJs(src){
  let s = String(src).replace(/math\./g, 'M.').replace(/\bq\./g, 'Q.').replace(/\bv\./g, 'Vv.');
  const m = s.match(/^\s*(.*?)\s*\?\s*\{(.*)\}\s*;\s*$/);
  if(m) s = `if(${m[1]}){${m[2]}}`;
  return s;
}
function compileMolang(list){ return new Function('M', 'Q', 'Vv', list.map(molangJs).join('\n')); }
function compileExpr(e){ return typeof e === 'number' ? () => e : new Function('M', 'Q', 'Vv', 'return (' + molangJs(e) + ');'); }

/* ---------- อ่านพิกเซลสกิน ---------- */
const PIX = new Map();
// ลบข้อมูลรูปของสกินที่ถูกลบออกจากรายการแล้ว (เรียกจาก render)
function pruneCaches(){
  const ids = new Set(state.skins.map(s => s.id));
  for(const k of [...PIX.keys()]) if(!ids.has(k)) PIX.delete(k);
  if(typeof FRONT !== 'undefined') for(const k of [...FRONT.keys()]) if(!ids.has(k)) FRONT.delete(k);
}
async function pixOf(s){
  if(PIX.has(s.id)) return PIX.get(s.id);
  const img = await loadImg(s.dataUrl);
  const c = canvasOf(img, true);
  const o = { img, S: img.width / 64, W: img.width, d: c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, img.width, img.height).data };
  PIX.set(s.id, o); return o;
}
const lumOf = (d, i) => (d[i] + d[i+1] + d[i+2]) / 765;
const satOf = (d, i) => (Math.max(d[i], d[i+1], d[i+2]) - Math.min(d[i], d[i+1], d[i+2])) / 255;
function median(a){ if(!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; }
function medianColor(list){ return [0,1,2].map(k => median(list.map(c => c[k]))); }
function newCanvas(w, h){ const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

/* ภาพหน้าตรง (มองจากด้านหน้า) = หน้าหัว (8 หน่วย) + ชั้นหมวก (9 หน่วย เพราะ inflate 0.5)
   พิกัด: x -4.5..4.5, y 32.5..23.5 ที่ P พิกเซลต่อหน่วย (P เป็นจำนวนเท่าของ S เสมอ → ตัดพิกเซลตรงเป๊ะ) */
function frontOf(p){
  const S = p.S, P = Math.max(16, 2 * S), C = 9 * P;
  const draw = (sx, size, off) => { const c = newCanvas(C, C), g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
    g.drawImage(p.img, sx * S, 8 * S, 8 * S, 8 * S, off, off, size, size); return c; };
  const face = draw(8, 8 * P, 0.5 * P), hat = draw(40, 9 * P, 0);
  const comp = newCanvas(C, C), g = comp.getContext('2d', { willReadFrequently: true }); g.drawImage(face, 0, 0); g.drawImage(hat, 0, 0);
  const get = c => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, C, C).data;
  return { S, P, C, faceC: face, hatC: hat, compC: comp, face: get(face), hat: get(hat), comp: get(comp) };
}
const snapU = (v, S) => Math.round(v * S) / S;

/* ---------- ช่วยหาตาอัตโนมัติ: ในครึ่งซ้าย/ขวาของหน้า หาก้อนเข้มขนาดเท่าตา (ไม่ใช่ผมทั้งแผง) แล้วขยายขึ้นไปรวมเส้นขนตา ---------- */
function autoEyes(p){
  const S = p.S, W = p.W, d = p.d, out = {};
  const fi = (x, y) => ((8 * S + y) * W + 8 * S + x) * 4;
  // สีผิว = มัธยฐานพิกเซลสว่างครึ่งล่างของหน้า
  const sk = []; for(let y = 4 * S; y < 8 * S; y++) for(let x = 0; x < 8 * S; x++){ const i = fi(x, y); if(d[i+3] > 128 && lumOf(d, i) > 0.7) sk.push([d[i], d[i+1], d[i+2]]); }
  const tone = sk.length ? medianColor(sk) : [255, 231, 220];
  const far = i => Math.max(Math.abs(d[i] - tone[0]), Math.abs(d[i+1] - tone[1]), Math.abs(d[i+2] - tone[2])) / 255 > 0.25;
  for(const [k, xa, xb] of [['l', 0, 4 * S], ['r', 4 * S, 8 * S]]){
    const ya = Math.floor(2.5 * S), yb = 8 * S, w = xb - xa, h = yb - ya;
    const m = new Uint8Array(w * h);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const i = fi(xa + x, ya + y); if(d[i+3] > 128 && lumOf(d, i) < 0.5) m[y * w + x] = 1; }
    // ตัดแนวเข้มยาวลงมา (ผมข้างแก้ม/ปอยผม) ออก ตาเป็นก้อนแนวนอน
    for(let x = 0; x < w; x++){ let y = 0; while(y < h){ if(!m[y * w + x]){ y++; continue; } let e = y; while(e < h && m[e * w + x]) e++;
      if(e - y > 1.2 * S) for(let q = y; q < e; q++) m[q * w + x] = 0; y = e; } }
    // ขนาดเท่าตา: กว้าง ≤3.6 สูง 0.4–2.2 หน่วย (คิ้วบางเกิน ผมทั้งแผงใหญ่เกิน) อยู่ครึ่งล่างของหน้า
    const cand = allBlobs(m, w, h).filter(b => (b.x1 - b.x0 + 1) <= 3.6 * S && (b.y1 - b.y0 + 1) <= 2.2 * S && (b.y1 - b.y0 + 1) >= Math.max(1, 0.4 * S) && (b.y0 + b.y1) / 2 + ya >= 3.5 * S);
    // ให้คะแนน: ตามีตาขาว/ไฮไลต์อยู่ติดๆ (ผมไม่มี) แล้วค่อยดูขนาด
    for(const b of cand){ b.white = 0;
      for(let y = Math.max(0, b.y0 - 1); y <= Math.min(h - 1, b.y1 + 1); y++) for(let x = Math.max(0, b.x0 - 1); x <= Math.min(w - 1, b.x1 + 1); x++){
        const i = fi(xa + x, ya + y); if(d[i+3] > 128 && lumOf(d, i) > 0.8 && satOf(d, i) < 0.25) b.white++; } }
    const blob = cand.sort((a, b) => b.n + b.white * 0.5 - (a.n + a.white * 0.5))[0];
    if(!blob){ out[k] = k === 'l' ? { x0: -3.5, x1: -0.5, y0: 25, y1: 27.5 } : { x0: 0.5, x1: 3.5, y0: 25, y1: 27.5 }; continue; }
    // ขยายขึ้นรวมเส้นขนตา (แถวที่มีพิกเซลสีต่างจากผิวชัด ≥ 20%) ไม่เกิน 1 หน่วย
    let top = blob.y0 + ya;
    for(let y = top - 1; y >= Math.max(0, blob.y0 + ya - Math.max(1, Math.round(0.4 * S))); y--){
      let n = 0, t = 0; for(let x = xa + blob.x0; x <= xa + blob.x1; x++){ t++; if(far(fi(x, y))) n++; }
      if(n >= t * 0.2) top = y; else break;
    }
    // ขยายซ้าย-ขวาให้ครอบหางตา (แถวขนตาบนยังมีเส้นต่อไป) ไม่เกิน 1 หน่วย
    let bx0 = xa + blob.x0, bx1 = xa + blob.x1;
    const lashRow = x => { for(let y = top; y <= Math.min(top + Math.max(1, S / 4), 8 * S - 1); y++) if(far(fi(x, y))) return true; return false; };
    while(bx0 > 0 && bx0 > xa + blob.x0 - S && lashRow(bx0 - 1)) bx0--;
    while(bx1 < 8 * S - 1 && bx1 < xa + blob.x1 + S && lashRow(bx1 + 1)) bx1++;
    const pad = 1 / S;
    const b = { x0: -4 + bx0 / S - pad, x1: -4 + (bx1 + 1) / S + pad, y1: 32 - top / S + pad, y0: 32 - (ya + blob.y1 + 1) / S - pad };
    for(const q of ['x0','x1','y0','y1']) b[q] = snapU(b[q], S);
    b.x0 = Math.max(-4.5, b.x0); b.x1 = Math.min(4.5, b.x1); b.y0 = Math.max(23.5, b.y0); b.y1 = Math.min(32.5, b.y1);
    out[k] = b;
  }
  return out;
}
// ทุกก้อน (เชื่อม 8 ทิศ) → [{x0,x1,y0,y1,n}]
function allBlobs(m, w, h){
  const lab = new Int32Array(w * h), out = []; let id = 0;
  for(let s0 = 0; s0 < w * h; s0++){
    if(!m[s0] || lab[s0]) continue;
    id++; const st = [s0]; lab[s0] = id; let n = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    while(st.length){ const c = st.pop(); n++; const cx = c % w, cy = (c / w) | 0;
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
      for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const nx = cx + dx, ny = cy + dy; if(nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx; if(m[q] && !lab[q]){ lab[q] = id; st.push(q); } } }
    out.push({ x0, x1, y0, y1, n });
  }
  return out;
}
// ก้อนใหญ่สุด (เชื่อม 8 ทิศ) → {x0,x1,y0,y1, mask}
function biggestBlob(m, w, h){
  const lab = new Int32Array(w * h); let best = null, id = 0;
  for(let s = 0; s < w * h; s++){
    if(!m[s] || lab[s]) continue;
    id++; const st = [s]; lab[s] = id; const px = [];
    while(st.length){ const c = st.pop(); px.push(c); const cx = c % w, cy = (c / w) | 0;
      for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){
        const nx = cx + dx, ny = cy + dy; if(nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx; if(m[n] && !lab[n]){ lab[n] = id; st.push(n); } } }
    if(!best || px.length > best.length) best = px;
  }
  if(!best) return null;
  const mask = new Uint8Array(w * h); let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for(const c of best){ mask[c] = 1; const x = c % w, y = (c / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, x1, y0, y1, mask };
}

/* =====================================================================
   วิเคราะห์ตา 1 ข้าง → ชิ้นส่วนทั้งหมด (ขนตา เปลือกตา ตาดำที่ขยับ หน้ากากรอบตา ส่วนเรืองแสง)
   ===================================================================== */
function analyseEye(p, fr, box, k, f, headD){
  const S = p.S, P = fr.P, W = p.W, d = p.d, R = P / S;
  const res = { k, box, warns: [], pieces: [] };
  // --- พื้นที่กรอบในภาพหน้าตรง (พิกเซล P)
  const cx0 = Math.round((box.x0 + 4.5) * P), cx1 = Math.round((box.x1 + 4.5) * P);
  const cy0 = Math.round((32.5 - box.y1) * P), cy1 = Math.round((32.5 - box.y0) * P);
  const bw = cx1 - cx0, bh = cy1 - cy0, C = fr.C;
  const ci = (x, y) => (y * C + x) * 4;
  // --- สีผิว: พิกเซลหน้าสว่างเหนือกรอบ (ไม่ใช่ผม)
  const tones = [];
  for(let y = Math.max(0, cy0 - Math.round(0.6 * P)); y < cy0; y++) for(let x = cx0; x < cx1; x++){
    const i = ci(x, y); if(fr.hat[i+3] < 128 && fr.face[i+3] > 128 && lumOf(fr.face, i) > 0.55) tones.push([fr.face[i], fr.face[i+1], fr.face[i+2]]);
  }
  if(tones.length < 2) for(let y = cy0; y < cy1; y++) for(let x = cx0; x < cx1; x++){
    const i = ci(x, y); if(fr.hat[i+3] < 128 && fr.face[i+3] > 128 && lumOf(fr.face, i) > 0.7) tones.push([fr.face[i], fr.face[i+1], fr.face[i+2]]);
  }
  const tone = tones.length ? medianColor(tones) : [255, 231, 220];
  res.tone = tone;

  // --- เส้นขนตาบน: แถวบนสุดในกรอบที่มี "พิกเซลเส้น" (เข้ม/สีต่างจากผิวชัด ไม่ใช่ตาขาว) ≥ 25% ของความกว้าง
  //     ไล่ลงจนสีเส้นเปลี่ยน (เช่น ขนตาสีฟ้า → ตาดำสีเทา) หรือเส้นหมด  ไม่เกิน 60% ของความสูงกรอบ
  const cdist = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) / 255;
  const pxC = i => [fr.comp[i], fr.comp[i+1], fr.comp[i+2]];
  const lineRaw = (x, y) => { const i = ci(x, y); return fr.comp[i+3] > 128 && lumOf(fr.comp, i) < 0.75 && cdist(pxC(i), tone) > 0.25; };
  // ขนตาเป็นเส้นแนวนอน หนาไม่เกิน ~0.9 หน่วย → ตัดพิกเซลที่เป็นแนวยาวลงมา (ปอยผมพาดหน้า) ออก
  const shortRun = new Uint8Array(bw * bh), longRun = new Uint8Array(bw * bh);
  for(let x = cx0; x < cx1; x++){
    let y = Math.max(0, cy0 - P);
    while(y < cy1){
      if(!lineRaw(x, y)){ y++; continue; }
      let e = y; while(e < Math.min(C, cy1 + P) && lineRaw(x, e)) e++;
      for(let q = Math.max(y, cy0); q < Math.min(e, cy1); q++) (e - y <= 0.9 * P ? shortRun : longRun)[(q - cy0) * bw + (x - cx0)] = 1;
      y = e;
    }
  }
  const lineC = (x, y) => x >= cx0 && x < cx1 && y >= cy0 && y < cy1 && shortRun[(y - cy0) * bw + (x - cx0)] === 1;
  const rowLine = y => { const cs = []; for(let x = cx0; x < cx1; x++) if(lineC(x, y)) cs.push(pxC(ci(x, y))); return cs; };
  let r0 = -1, r1 = -1, ref = null;
  for(let y = cy0; y < cy0 + Math.ceil(bh * 0.7); y++){
    const cs = rowLine(y), ok = cs.length >= Math.max(1, bw * 0.25);
    if(r0 < 0){ if(ok){ r0 = r1 = y; ref = medianColor(cs); } continue; }
    if(!ok || cdist(medianColor(cs), ref) > 0.22 || y - r0 + 1 > bh * 0.6) break;
    r1 = y;
  }
  res.lash = r0 >= 0 ? { r0, r1, top: 32.5 - r0 / P, bot: 32.5 - (r1 + 1) / P, ref } : null;
  const lashLike = (x, y) => res.lash && lineC(x, y) && cdist(pxC(ci(x, y)), res.lash.ref) < 0.25;
  const darkC = (x, y) => lashLike(x, y);

  // --- ชิ้นเปลือกตา + ขนตา (กระพริบตา)
  if(f.blink !== 'off'){
    if(!res.lash) res.warns.push(`ตา${k === 'l' ? 'ซ้าย' : 'ขวา'}: ไม่เจอเส้นขนตาด้านบนกรอบ จะใช้เปลือกตาอย่างเดียว (ลองขยับกรอบให้บนสุดอยู่ที่ขนตา)`);
    // เปลือกตา = ภาพในกรอบที่ลบตาออก: ผิวเป็นสีผิว, ผมบนชั้นหมวกคงสีผม (ส่วนมืดบนหมวกถมด้วยสีผมรอบข้าง), ทึบทั้งกรอบ
    const lid = newCanvas(bw, bh), lg = lid.getContext('2d'), L = lg.createImageData(bw, bh), ld = L.data;
    const hairState = new Int8Array(bw * bh); // 1 = ผมเก็บไว้, 2 = ต้องถม
    for(let y = 0; y < bh; y++) for(let x = 0; x < bw; x++){
      const i = ci(cx0 + x, cy0 + y), o = (y * bw + x) * 4;
      if(fr.hat[i+3] > 128){
        const nearBand = res.lash && cy0 + y >= res.lash.r0 - 1 && cy0 + y <= res.lash.r1 + 1;
        if(nearBand && lashLike(cx0 + x, cy0 + y)) hairState[y * bw + x] = 2;     // หางตา/ขนตาที่วาดบนหมวก → ถมด้วยผม
        else { ld[o] = fr.comp[i]; ld[o+1] = fr.comp[i+1]; ld[o+2] = fr.comp[i+2]; hairState[y * bw + x] = 1; }
      } else if(longRun[y * bw + x]){ ld[o] = fr.comp[i]; ld[o+1] = fr.comp[i+1]; ld[o+2] = fr.comp[i+2]; }   // ผมบนหน้า คงไว้
      else { ld[o] = tone[0]; ld[o+1] = tone[1]; ld[o+2] = tone[2]; }
      ld[o+3] = 255;
    }
    // ถมพิกเซลมืดบนหมวกด้วยค่าเฉลี่ยผมรอบข้าง วนจนเต็ม (inpaint อย่างง่าย)
    for(let it = 0; it < 64; it++){
      let left = 0;
      for(let y = 0; y < bh; y++) for(let x = 0; x < bw; x++){
        if(hairState[y * bw + x] !== 2) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){
          const nx = x + dx, ny = y + dy; if(nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
          if(hairState[ny * bw + nx] === 1){ const o = (ny * bw + nx) * 4; r += ld[o]; g += ld[o+1]; b += ld[o+2]; n++; }
        }
        if(n){ const o = (y * bw + x) * 4; ld[o] = r / n; ld[o+1] = g / n; ld[o+2] = b / n; hairState[y * bw + x] = 3; } else left++;
      }
      for(let q = 0; q < hairState.length; q++) if(hairState[q] === 3) hairState[q] = 1;
      if(!left) break;
    }
    for(let q = 0; q < hairState.length; q++) if(hairState[q] === 2){ const o = q * 4; ld[o] = tone[0]; ld[o+1] = tone[1]; ld[o+2] = tone[2]; }
    lg.putImageData(L, 0, 0);
    const H = box.y1 - box.y0, cxm = r4((box.x0 + box.x1) / 2);
    res.pieces.push({ name: 'lid_' + k, kind: 'fx', canvas: lid, x0: box.x0, x1: box.x1, y0: box.y0, y1: box.y1, z: -4.56, pivot: [cxm, box.y1, 0] });
    if(res.lash){
      const lh = res.lash.r1 - res.lash.r0 + 1, lc = newCanvas(bw, lh), lgg = lc.getContext('2d'), LD = lgg.createImageData(bw, lh);
      for(let y = 0; y < lh; y++) for(let x = 0; x < bw; x++){
        if(!darkC(cx0 + x, res.lash.r0 + y)) continue;
        const i = ci(cx0 + x, res.lash.r0 + y), o = (y * bw + x) * 4;
        LD.data[o] = fr.comp[i]; LD.data[o+1] = fr.comp[i+1]; LD.data[o+2] = fr.comp[i+2]; LD.data[o+3] = 255;
      }
      lgg.putImageData(LD, 0, 0);
      res.pieces.push({ name: 'lash_' + k, kind: 'fx', canvas: lc, x0: box.x0, x1: box.x1, y0: res.lash.bot, y1: res.lash.top, z: -4.57, pivot: [cxm, res.lash.top, 0] });
      res.D = r4(res.lash.bot - box.y0); res.A = r4((box.y1 - res.lash.bot) / H); res.B = r4(res.D / H);
    } else { res.D = 0; res.A = 0; res.B = 0; }
  }

  // --- ตาดำ (ตาขยับ / เรืองแสง) บนหน้าหัวจริง ที่ S พิกเซลต่อหน่วย
  if(!(f.move || f.glow)) return res;
  const fx0 = Math.max(box.x0, -4), fx1 = Math.min(box.x1, 4), fy0 = Math.max(box.y0, 24), fy1 = Math.min(box.y1, 32);
  if(fx1 <= fx0 || fy1 <= fy0){ res.warns.push(`ตา${k === 'l' ? 'ซ้าย' : 'ขวา'}: กรอบไม่อยู่บนหน้า`); return res; }
  const tx0 = Math.round((fx0 + 4) * S), tx1 = Math.round((fx1 + 4) * S), ty0 = Math.round((32 - fy1) * S), ty1 = Math.round((32 - fy0) * S);
  const w = tx1 - tx0, h = ty1 - ty0;
  const fi = (x, y) => ((8 * S + ty0 + y) * W + 8 * S + tx0 + x) * 4;      // พิกเซลในสกิน
  let rStart = res.lash ? Math.max(0, Math.min(h - 1, Math.ceil((32 - res.lash.bot) * S - ty0 - 1e-6))) : 0;
  const A = (x, y) => d[fi(x, y) + 3] > 128;
  const fpx = (x, y) => { const i = fi(x, y); return [d[i], d[i+1], d[i+2]]; };
  // เส้นขนตาบนหน้าหัวเอง (อาจอยู่คนละแถวกับขนตาบนชั้นหมวก เพราะหมวกขยาย 9/8) → ตาดำเริ่มใต้เส้นนี้
  if(res.lash){
    let a = -1, b = -1;
    for(let y = 0; y < Math.ceil(h * 0.6); y++){
      let n = 0; for(let x = 0; x < w; x++){ const i = fi(x, y); if(A(x, y) && lumOf(d, i) < 0.75 && cdist(fpx(x, y), tone) > 0.25 && cdist(fpx(x, y), res.lash.ref) < 0.25) n++; }
      if(n >= Math.max(1, w * 0.25)){ if(a < 0) a = y; b = y; } else if(a >= 0) break;
    }
    if(b >= 0) rStart = Math.max(rStart, Math.min(h - 1, b + 1));
  }
  // ตาดำ = เทาเข้ม หรือ สีที่ต่างจากผิวชัดและไม่สว่าง (ตาสีแดง/ฟ้า/ม่วง) ไม่นับสีเดียวกับขนตา
  const dark = new Uint8Array(w * h);
  for(let y = rStart; y < h; y++) for(let x = 0; x < w; x++){
    const i = fi(x, y); if(!A(x, y)) continue;
    const L = lumOf(d, i), c = fpx(x, y);
    const gray = L < 0.6 && satOf(d, i) < 0.22, colored = L < 0.7 && cdist(c, tone) > 0.3;
    const lashCol = res.lash && cdist(c, res.lash.ref) < 0.12 && !gray;
    if((gray || colored) && !lashCol) dark[y * w + x] = 1;
  }
  // ตัดผมบนหน้า (แนวเข้มยาวลงมาเกิน 1.2 หน่วย นับทั้งคอลัมน์ของหน้า) ออกจากตาดำ
  for(let x = 0; x < w; x++){
    const col = y => { const i = ((8 * S + y) * W + 8 * S + tx0 + x) * 4; return d[i+3] > 128 && lumOf(d, i) < 0.5; };
    let y = 0;
    while(y < 8 * S){ if(!col(y)){ y++; continue; } let e = y; while(e < 8 * S && col(e)) e++;
      if(e - y > 1.2 * S) for(let q = Math.max(y, ty0); q < Math.min(e, ty0 + h); q++) dark[(q - ty0) * w + x] = 0;
      y = e; }
  }
  // พิกเซลที่ผู้ใช้แตะแต่งเอง (ใช้ทับผลอัตโนมัติ) — นับเฉพาะที่อยู่ในกรอบนี้
  const PT = (f.eyes && f.eyes.paint) || {};
  const qOf = key => { const [x, y] = key.split(',').map(Number), lx = x - tx0, ly = y - ty0; return lx >= 0 && ly >= 0 && lx < w && ly < h ? ly * w + lx : -1; };
  const applyPaint = (arr, L) => { for(const [key, v] of Object.entries(PT[L] || {})){ const q = qOf(key); if(q >= 0) arr[q] = v; } };
  const paintAdds = L => Object.entries(PT[L] || {}).some(([key, v]) => v === 1 && qOf(key) >= 0);
  const blob = biggestBlob(dark, w, h);
  if(!blob && !paintAdds('iris') && !paintAdds('core')){ res.warns.push(`ตา${k === 'l' ? 'ซ้าย' : 'ขวา'}: หาตาดำ (สีเข้ม) ในกรอบไม่เจอ (แตะเลือกพิกเซลตาดำเองได้)`); res.rect = { tx0, ty0, w, h, iris: new Uint8Array(w * h), open: new Uint8Array(w * h), core: new Uint8Array(w * h), rStart, x0: -4 + tx0 / S, x1: -4 + tx1 / S, y1: 32 - ty0 / S, y0: 32 - ty1 / S, empty: true }; return res; }
  // เติมเต็มรายแถว (ไฮไลต์ขาวในตาดำนับเป็นตาดำ ไม่งั้นค้างที่เดิมตอนตาเลื่อน)
  const iris = new Uint8Array(w * h);
  if(blob) for(let y = 0; y < h; y++){ let a = -1, b = -1; for(let x = 0; x < w; x++) if(blob.mask[y * w + x]){ if(a < 0) a = x; b = x; } if(a >= 0) for(let x = a; x <= b; x++) iris[y * w + x] = 1; }
  // แกนเรืองแสง = ก้อนก่อนขยาย ลบพิกเซลสว่าง (lum>0.78) ที่ต่อถึงขอบ (ตาขาวไม่เรืองแสง)
  const core = iris.slice();
  { const st = []; const seen = new Uint8Array(w * h);
    const bright = q => core[q] && lumOf(d, fi(q % w, (q / w) | 0)) > 0.78;
    for(let q = 0; q < w * h; q++){ if(!bright(q)) continue; const x = q % w, y = (q / w) | 0;
      const edge = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => { const nx = x + dx, ny = y + dy; return nx < 0 || ny < 0 || nx >= w || ny >= h || !core[ny * w + nx]; });
      if(edge){ st.push(q); seen[q] = 1; } }
    while(st.length){ const q = st.pop(); core[q] = 0; const x = q % w, y = (q / w) | 0;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx = x + dx, ny = y + dy; if(nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx; if(!seen[n] && bright(n)){ seen[n] = 1; st.push(n); } } } }
  // ตาขาว/สีซีดไม่ให้เรืองแสง (ข้อ 8.5: ตัดออกอัตโนมัติแล้วแจ้ง)
  { let n = 0; for(let q = 0; q < w * h; q++){ if(!core[q]) continue; const i = fi(q % w, (q / w) | 0); if(lumOf(d, i) > 0.62 && satOf(d, i) < 0.12){ core[q] = 0; n++; } }
    if(n && f.glow) res.warns.push(`ตา${k === 'l' ? 'ซ้าย' : 'ขวา'}: ตัดพิกเซลสีซีด ${n} จุดออกจากส่วนเรืองแสงแล้ว (ตาขาวจะไม่เรืองแสง)`); }
  // ขยายตาดำเข้าขอบไล่สี: เทาเข้มที่ติดกัน (≤4px@16) → เทาอ่อนหัวตา (≤3px@16)  (ไม่งั้นเหลือจุดค้างตอนตาเลื่อน)
  const grow = (steps, cand) => { for(let s2 = 0; s2 < steps; s2++){ const add = [];
      for(let y = rStart; y < h; y++) for(let x = 0; x < w; x++){ const q = y * w + x; if(iris[q] || !cand(x, y)) continue;
        if((x > 0 && iris[q - 1]) || (x < w - 1 && iris[q + 1])) add.push(q); }
      if(!add.length) break; add.forEach(q => iris[q] = 1); } };
  const sc = S / 16;
  grow(Math.max(1, Math.round(4 * sc)), (x, y) => { const i = fi(x, y); return A(x, y) && lumOf(d, i) < 0.62 && satOf(d, i) < 0.22; });
  grow(Math.max(1, Math.round(3 * sc)), (x, y) => { const i = fi(x, y); return A(x, y) && lumOf(d, i) < 0.9 && satOf(d, i) < 0.12; });
  grow(Math.max(1, Math.round(2 * sc)), (x, y) => { const i = fi(x, y); return A(x, y) && lumOf(d, i) < 0.85 && cdist(fpx(x, y), tone) > 0.2 && !(res.lash && cdist(fpx(x, y), res.lash.ref) < 0.12); });
  applyPaint(iris, 'iris');                    // ตาดำที่ผู้ใช้แตะเพิ่ม/เอาออก
  // ช่องตา = ตาดำ + ขอบ 1px + ตาขาว/สว่างที่ต่อกัน (ภายในกรอบ ใต้ขนตา)
  const open = iris.slice();
  { const st = [];
    for(let q = 0; q < w * h; q++) if(iris[q]) st.push(q);
    const isWhite = q => { const x = q % w, y = (q / w) | 0, i = fi(x, y); return y >= rStart && A(x, y) && lumOf(d, i) > 0.72 && satOf(d, i) < 0.2; };
    const seen = new Uint8Array(w * h); st.forEach(q => seen[q] = 1);
    while(st.length){ const q = st.pop(); const x = q % w, y = (q / w) | 0;
      for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const nx = x + dx, ny = y + dy; if(nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx; if(seen[n]) continue; seen[n] = 1;
        if(iris[q] && ny >= rStart && A(nx, ny)){ open[n] = 1; if(isWhite(n)) st.push(n); }   // ขอบติดตาดำ 1px
        else if(isWhite(n)){ open[n] = 1; st.push(n); } } } }
  applyPaint(open, 'open');                    // ช่องตาที่ผู้ใช้แตะเพิ่ม/เอาออก
  for(let q = 0; q < w * h; q++) if(iris[q]) open[q] = 1;   // ตาดำต้องอยู่ในช่องตาเสมอ ไม่งั้นโดนแผ่นปิดหน้าบัง
  applyPaint(core, 'core');                    // ส่วนเรืองแสงที่ผู้ใช้แตะเพิ่ม/เอาออก
  if(!iris.some(v => v) && !core.some(v => v)){ res.warns.push(`ตา${k === 'l' ? 'ซ้าย' : 'ขวา'}: ไม่มีพิกเซลตาดำเหลือเลย`); res.rect = { tx0, ty0, w, h, iris, open, core, rStart, x0: -4 + tx0 / S, x1: -4 + tx1 / S, y1: 32 - ty0 / S, y0: 32 - ty1 / S, empty: true }; return res; }
  // ระยะเลื่อนได้ = (กว้างช่องตา − กว้างตาดำ)/2 (มัธยฐานของแถว) ไม่เกิน 0.35 หน่วย
  const gaps = [];
  for(let y = 0; y < h; y++){ let ia = w, ib = -1, oa = w, ob = -1;
    for(let x = 0; x < w; x++){ const q = y * w + x; if(iris[q]){ ia = Math.min(ia, x); ib = Math.max(ib, x); } if(open[q]){ oa = Math.min(oa, x); ob = Math.max(ob, x); } }
    if(ib >= 0) gaps.push(Math.min(ia - oa, ob - ib)); }
  res.maxShift = Math.min(0.35, median(gaps) / S);
  res.rect = { tx0, ty0, w, h, iris, open, core, rStart, x0: -4 + tx0 / S, x1: -4 + tx1 / S, y1: 32 - ty0 / S, y0: 32 - ty1 / S };
  if(f.move && res.maxShift < 0.5 / S) res.warns.push(`ตา${k === 'l' ? 'ซ้าย' : 'ขวา'}: ช่องตาแคบ ตาขยับได้น้อยมาก (ลองให้กรอบครอบตาขาวทั้งหมด)`);

  // เติมช่องใต้ตาดำบนหน้าหัว (เฉพาะตาขยับ): รายแถว ใช้สีเดียว = มัธยฐานครึ่งที่สว่างของตาขาวแถวนั้น แล้วเบลอ 3×3 เฉพาะในรู
  if(f.move){
    const rowTone = [];
    for(let y = 0; y < h; y++){ const ws = [];
      for(let x = 0; x < w; x++){ const q = y * w + x; if(open[q] && !iris[q] && A(x, y)){ const i = fi(x, y); ws.push([d[i], d[i+1], d[i+2], lumOf(d, i)]); } }
      if(ws.length){ const ml = median(ws.map(c => c[3])); rowTone[y] = medianColor(ws.filter(c => c[3] >= ml)); } }
    const any = rowTone.findIndex(t => t);
    for(let y = 0; y < h; y++){
      if(![...Array(w).keys()].some(x => iris[y * w + x])) continue;
      let t = rowTone[y];
      for(let dd = 1; !t && dd < h; dd++) t = rowTone[y - dd] || rowTone[y + dd];
      if(!t) t = any >= 0 ? rowTone[any] : [250, 250, 250];
      for(let x = 0; x < w; x++) if(iris[y * w + x]){ const i = fi(x, y); headD[i] = t[0]; headD[i+1] = t[1]; headD[i+2] = t[2]; headD[i+3] = 255; }
    }
    const tmp = [];
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ if(!iris[y * w + x]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const nx = x + dx, ny = y + dy; if(nx < 0 || ny < 0 || nx >= w || ny >= h || !open[ny * w + nx]) continue;
        const i = fi(nx, ny); r += headD[i]; g += headD[i+1]; b += headD[i+2]; n++; }
      tmp.push([fi(x, y), r / n, g / n, b / n]); }
    for(const [i, r, g, b] of tmp){ headD[i] = r; headD[i+1] = g; headD[i+2] = b; }
  }
  // ชิ้นบนหน้า: ขยาย S → P แบบพิกเซลตรง (R เท่า)
  const facePiece = (pick, alphaOf) => { const c = newCanvas(w * R, h * R), g = c.getContext('2d'); const id = g.createImageData(w, h);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const q = y * w + x, a = alphaOf(q, x, y); if(!a) continue; const i = fi(x, y), o = q * 4;
      id.data[o] = d[i]; id.data[o+1] = d[i+1]; id.data[o+2] = d[i+2]; id.data[o+3] = a; }
    const t = newCanvas(w, h); t.getContext('2d').putImageData(id, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(t, 0, 0, w * R, h * R); return c; };
  const r = res.rect, cpv = [r4((r.x0 + r.x1) / 2), r4((r.y0 + r.y1) / 2), 0];
  if(f.move){
    res.pieces.push({ name: 'mask_' + k, kind: 'fx', canvas: facePiece(null, (q, x, y) => open[q] ? 0 : d[fi(x, y) + 3]), x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1, z: -4.03, pivot: cpv });
    res.pieces.push({ name: 'move_' + k, kind: 'fx', canvas: facePiece(null, q => iris[q] ? 255 : 0), x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1, z: -4.018, pivot: cpv });
  }
  if(f.glow) res.pieces.push({ name: 'glow_' + k, kind: 'glow', canvas: facePiece(null, q => core[q] ? 48 : 0), x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1, z: -4.022, pivot: cpv });
  return res;
}

/* ---------- รวมชิ้นเป็นแผ่นเท็กซ์เจอร์ (atlas) → geometry ระนาบหน้า north ---------- */
function packPieces(pieces, P, gid){
  if(!pieces.length) return null;
  const gap = 2; let W = gap, H = 0;
  for(const pc of pieces){ pc.u = W; W += pc.canvas.width + gap; H = Math.max(H, pc.canvas.height); }
  H += gap;
  const atlas = newCanvas(W, H), g = atlas.getContext('2d');
  for(const pc of pieces) g.drawImage(pc.canvas, pc.u, 0);
  const bones = [{ name: 'head', pivot: [0,24,0] }];
  for(const pc of pieces){
    bones.push({ name: pc.name, parent: 'head', pivot: pc.pivot, cubes: [{
      origin: [r4(pc.x0), r4(pc.y0), pc.z], size: [r4(pc.x1 - pc.x0), r4(pc.y1 - pc.y0), 0],
      uv: { north: { uv: [r4(pc.u / P), 0], uv_size: [r4(pc.canvas.width / P), r4(pc.canvas.height / P)] } } }] });
  }
  return { id: gid, canvas: atlas, texW: r4(W / P), texH: r4(H / P), bones };
}

/* =====================================================================
   ผมพริ้ว (สูตร 4.6) — แยกระนาบผม (หนา 0) ในกระดูก head ของ .bbmodel ออกเป็นกระดูกของตัวเอง
   หลัง (z ≥ 2) = ตัด 3 ท่อนต่อกัน, ข้างหน้า (|x| ≥ 3.5, -2<z<2) = ปอยข้าง, หน้าอก (z<-2 ปลายต่ำกว่าคาง) = เส้นห้อย
   ===================================================================== */
function flowBones(bones){
  const out = JSON.parse(JSON.stringify(bones)), anim = {};
  const head = out.find(b => b.name === 'head');
  if(!head || !head.cubes) return { bones: out, anim, count: 0 };
  const flow = '(1 - v.down)', swing = 'math.clamp(q.cape_flap_amount, 0, 0.5)';
  const names = new Set(out.map(b => b.name.toLowerCase())), uniq = n => { let b = n, i = 2; while(names.has(b.toLowerCase())) b = n + '_' + (i++); names.add(b.toLowerCase()); return b; };   // ไม่สนตัวพิมพ์ (เกมมองว่าเป็นชื่อเดียวกัน)
  const keep = []; let nb = 0, nl = 0, ns = 0;
  const faceUV = c => {   // uv หน้า north/south ของระนาบ (box uv หรือ per-face)
    if(Array.isArray(c.uv)) return { n: [c.uv[0], c.uv[1], c.size[0], c.size[1]], s: [c.uv[0] + c.size[0], c.uv[1], c.size[0], c.size[1]] };
    const n = c.uv.north, s = c.uv.south; return { n: n ? [...n.uv, ...n.uv_size] : null, s: s ? [...s.uv, ...s.uv_size] : null };
  };
  const plane = (x0, x1, yb, yt, z, nuv, suv) => { const uv = {}; if(nuv) uv.north = { uv: [r4(nuv[0]), r4(nuv[1])], uv_size: [r4(nuv[2]), r4(nuv[3])] };
    if(suv) uv.south = { uv: [r4(suv[0]), r4(suv[1])], uv_size: [r4(suv[2]), r4(suv[3])] };
    return { origin: [r4(x0), r4(yb), r4(z)], size: [r4(x1 - x0), r4(yt - yb), 0], uv }; };
  for(const c of head.cubes){
    const isPlane = c.size[2] === 0 && c.size[0] > 0 && c.size[1] > 0 && !c.rotation && !c.inflate;
    if(!isPlane){ keep.push(c); continue; }
    const x0 = c.origin[0], x1 = x0 + c.size[0], yb = c.origin[1], yt = yb + c.size[1], z = c.origin[2], cx = (x0 + x1) / 2;
    const uv = faceUV(c);
    if(z >= 2 && c.size[1] >= 3){
      // ผมยาวด้านหลัง: head > back_root (เงยแล้วผมไม่พับเข้าหัว) > back0 > back1 > back2
      const root = uniq(nb ? `back${nb}_root` : 'back_root'); out.push({ name: root, parent: 'head', pivot: [0,24,0] });
      const cuts = [yt, yt - c.size[1] / 3, yt - 2 * c.size[1] / 3, yb].map(r4);
      let par = root;
      const ph = [[50, -40], [90, -80]];
      anim[root] = { rotation: ['-math.min(q.target_x_rotation, 0)', 0, 0] };
      for(let i = 0; i < 3; i++){
        const t = cuts[i], b = cuts[i + 1], kh = c.size[1];
        const seg = (u) => u ? [u[0], u[1] + (yt - t) * (u[3] / kh), u[2], (t - b) * (u[3] / kh)] : null;
        const nm = uniq(nb ? `back${nb}_${i}` : `back${i}`);
        out.push({ name: nm, parent: par, pivot: [r4(cx), r4(Math.min(t, 24)), r4(z)], cubes: [plane(x0, x1, b, t, z, seg(uv.n), seg(uv.s))] });
        anim[nm] = { rotation: [i === 0
          ? `math.clamp(55 * q.cape_flap_amount + 18 * q.modified_move_speed, 0, 55) * ${flow} + 1.5 * math.sin(v.t * 70)`
          : `(${i === 1 ? 12 : 10} * q.cape_flap_amount + ${swing} * math.cos(${ph[i-1][0]} - q.modified_distance_moved * 18) * ${i === 1 ? 22 : 20}) * ${flow} + ${i === 1 ? 2.5 : 3} * math.sin(v.t * 70 - ${-ph[i-1][1]})`, 0, 0] };
        par = nm;
      }
      nb++;
    } else if(z > -2 && z < 2 && Math.abs(cx) >= 3.5){
      // ปอยผมข้างหน้า: เอียงตามลม + แกว่งตามก้าว + หมุนสวนตอนเงย
      const left = cx < 0, nm = uniq('lock_' + (left ? 'l' : 'r') + (nl ? nl : ''));
      out.push({ name: nm, parent: 'head', pivot: [r4(cx), r4(yt), r4(z)], cubes: [plane(x0, x1, yb, yt, z, uv.n, uv.s)] });
      anim[nm] = { rotation: [`-math.min(q.target_x_rotation, 0) + (math.clamp(30 * q.cape_flap_amount + 10 * q.modified_move_speed, 0, 40) + ${swing} * math.cos(${left ? 30 : 70} - q.modified_distance_moved * 18) * 14) * ${flow} + 2 * math.sin(v.t * 70 - ${left ? 20 : 60})`, 0, 0] };
      nl++;
    } else if(z <= -2 && z > -4.2 && yb < 23){
      // เส้นผมห้อยหน้าอก: หมุนสวนหัว 90% → ห้อยตรงเสมอ ไม่ทะลุอก
      const left = cx < 0, nm = uniq('strand_' + (left ? 'l' : 'r') + (ns ? ns : ''));
      out.push({ name: nm, parent: 'head', pivot: [r4(cx), r4(yt), r4(z)], cubes: [plane(x0, x1, yb, yt, z, uv.n, uv.s)] });
      anim[nm] = { rotation: [`-q.target_x_rotation * 0.9 + ${swing} * math.cos(${left ? 40 : 80} - q.modified_distance_moved * 18) * 9 + 1.5 * math.sin(v.t * 70 - ${left ? 30 : 70})`, 0, 0] };
      ns++;
    } else keep.push(c);
  }
  head.cubes = keep;
  return { bones: out, anim, count: nb + nl + ns };
}

/* =====================================================================
   รวมทุกอย่างของสกิน 1 ตัว → geometry หลัก / fx / glow, เท็กซ์เจอร์, สคริปต์ Molang, แอนิเมชัน, ผลตรวจ
   ===================================================================== */
const FXC = new Map();
async function computeFx(s){
  const f = fxOf(s), base = geometryOf(s);
  const key = s.id + '|' + JSON.stringify(f) + '|' + modelOf(s) + '|' + (s.bbName || '') + '|' + JSON.stringify(s.parts || {});
  if(FXC.has(key)){ const hit = FXC.get(key); FXC.delete(key); FXC.set(key, hit); return hit; }   // ใช้ล่าสุด = ย้ายไปท้าย
  const p = await pixOf(s), S = p.S;
  const R = { warns: [], checks: [], anim: {}, main: base, headUrl: null, fx: null, glow: null, eyes: null, flowCount: 0, f };
  // ผมพริ้ว
  if(f.flow && s.bb){
    const fb = flowBones(base.bones);
    if(fb.count){ R.main = { ...base, bones: fb.bones }; Object.assign(R.anim, fb.anim); R.flowCount = fb.count; }
    else R.warns.push('ผมพริ้ว: ไม่เจอระนาบผม (ชิ้นหนา 0) ในกลุ่ม Head ของ .bbmodel');
  }
  // ตา
  let moveOK = false, M = 0.35;
  if(anyEyeFx(f)){
    if(!f.eyes) f.eyes = autoEyes(p);
    const fr = frontOf(p);
    const headD = new Uint8ClampedArray(p.d);
    const eyes = { l: analyseEye(p, fr, f.eyes.l, 'l', f, headD), r: analyseEye(p, fr, f.eyes.r, 'r', f, headD) };
    R.eyes = eyes; R.front = fr;
    for(const e of Object.values(eyes)) R.warns.push(...e.warns);
    const pieces = [...eyes.l.pieces, ...eyes.r.pieces];
    moveOK = !!(f.move && eyes.l.rect && !eyes.l.rect.empty && eyes.r.rect && !eyes.r.rect.empty);
    R.moveOK = moveOK;                         // ต้องตั้งก่อนจำลองภาพ/ตรวจ
    if(moveOK){
      M = r4(Math.max(0.5 / S, Math.min(eyes.l.maxShift, eyes.r.maxShift))); R.M = M;
      const hc = newCanvas(p.W, p.W); hc.getContext('2d').putImageData(new ImageData(headD, p.W, p.W), 0, 0);
      R.headCanvas = hc; R.headUrl = hc.toDataURL('image/png');
    } else if(f.move) R.warns.push('ตาขยับ: ปิดไว้ก่อน เพราะหาตาดำไม่ครบสองข้าง');
    const fxP = pieces.filter(pc => pc.kind === 'fx' && (moveOK || !/^(mask|move)_/.test(pc.name)));
    const glP = pieces.filter(pc => pc.kind === 'glow');
    R.fx = packPieces(fxP, fr.P, 'fx'); R.glow = packPieces(glP, fr.P, 'glow');
    // แอนิเมชันของชิ้นตา
    const blinkScale = f.blink !== 'off' ? '1 - 0.95 * v.blink' : 1;
    for(const e of Object.values(eyes)){
      if(f.blink !== 'off'){
        R.anim['lid_' + e.k] = { scale: [1, e.A || e.B ? `v.blink > 0.02 ? math.max(v.blink, ${e.A} + ${e.B} * v.blink) : math.max(0.001, v.blink)` : 'math.max(0.001, v.blink)', 1] };
        if(e.lash) R.anim['lash_' + e.k] = { position: [0, `-v.blink * ${e.D}`, 0] };
      }
      if(moveOK) R.anim['move_' + e.k] = { position: ['v.ex', 0, 0], scale: [1, blinkScale, 1] };
      if(f.glow && R.glow && R.glow.bones.some(b => b.name === 'glow_' + e.k))
        R.anim['glow_' + e.k] = { position: [moveOK ? 'v.ex' : 0, 0, 0], scale: [1, blinkScale, 1] };
    }
    if(f.glow && !R.glow) R.warns.push('ตาเรืองแสง: หาตาดำไม่เจอ');
    // ตรวจซ้ำอัตโนมัติ (ข้อ 8.6 ง)
    R.sim = sim => simFront(R, p, sim);
    const diff = compareFront(R, p);
    R.checks.push(diff === 0 ? '✔ ตามองตรง = เหมือนต้นฉบับทุกพิกเซล' : `✖ ตามองตรงต่างจากต้นฉบับ ${diff} พิกเซล`);
    if(diff) R.warns.push(`ตามองตรงต่างจากต้นฉบับ ${diff} พิกเซล`);
    if(f.blink !== 'off') R.checks.push('✔ เปลือกตาทึบทั้งกรอบ (หลับตาไม่มีรู)');
    if(moveOK) R.checks.push(`✔ ตาเลื่อนได้ ±${M} หน่วย ช่องใต้ตาดำถมสีตาขาวแล้ว`);
  }
  R.M = M; R.moveOK = moveOK;
  // สคริปต์ Molang (ตามสูตร 4.1–4.6 ตัวแปรทุกตัวตั้งใน initialize)
  const hasAnim = Object.keys(R.anim).length > 0;
  if(hasAnim){
    const RNG = f.range, init = ['v.near = 1;', 'v.cam = 0;', 'v.dt = 0;', 'v.t = math.random(0, 10);'];
    const pre = ['v.cam = q.distance_from_camera;', `v.near = v.near ? v.cam < ${RNG + 1} : v.cam < ${RNG};`,
                 'v.near ? { v.dt = math.clamp(q.delta_time, 0, 0.1); v.t = math.mod(v.t + v.dt, 36); };'];
    if(f.blink !== 'off' && R.fx){
      const slow = f.blink === 'slow';
      init.push('v.bt = 0;', 'v.bnext = math.random(1.5, 4.0);', 'v.blink = 0;');
      pre.push('v.near ? { v.bt = v.bt + v.dt; };',
               `v.near && v.bt > v.bnext ? { v.bt = 0; v.bnext = math.random(${slow ? '3.0, 6.5' : '2.5, 6.0'}); };`,
               `v.near ? { v.blink = v.bt < ${slow ? 0.6 : 0.34} ? math.max(0, math.sin(v.bt * ${slow ? 300 : 530})) : 0; };`);   // max 0: ท้ายจังหวะ sin ติดลบนิดเดียว กันเปลือกตากลับด้าน
    }
    if(moveOK){
      const G = r4(Math.min(0.3, M * 0.85));
      init.push('v.ex = 0;', 'v.et = 0;', 'v.gt = 0;', 'v.gnext = 2;', 'v.gx = 0;');
      pre.push('v.near ? { v.gt = v.gt + v.dt; };',
               `v.near && v.gt > v.gnext ? { v.gt = 0; v.gnext = math.random(1.5, 4.5); v.gx = math.random_integer(0, 2) == 0 ? 0 : math.random(-${G}, ${G}); };`,
               `v.near ? { v.et = math.clamp(-q.target_y_rotation * 0.008 + v.gx, -${M}, ${M}); v.ex = v.ex + (v.et - v.ex) * math.min(1, v.dt * (math.abs(v.et) > math.abs(v.ex) ? 12 : 2.5)); };`,
               '!v.near ? { v.ex = 0; };');
    }
    if(R.flowCount){ init.push('v.down = 0;'); pre.push('v.near ? { v.down = math.clamp(q.target_x_rotation / 30, 0, 1); };'); }
    // ถ้าไม่มีกระพริบ แต่ใช้ v.blink ใน scale ของตา → ต้องตั้งค่า
    R.scripts = { initialize: init, pre_animation: pre, animate: [{ move: 'v.near' }] };
  }
  FXC.set(key, R);
  // จำผลไว้แค่ 16 ชุดล่าสุด (แต่ละชุดมีรูปหัวขนาดเต็ม ลากกรอบตาบ่อย ๆ จะกินแรมไม่หยุดถ้าไม่ลบ)
  while(FXC.size > 16) FXC.delete(FXC.keys().next().value);
  return R;
}

/* ---------- จำลองภาพหน้าตรงแบบพิกเซล (ใช้ทั้งปุ่มทดสอบ และตรวจอัตโนมัติ) ---------- */
function simFront(R, p, { blink = 0, ex = 0, dark = false } = {}){
  const fr = R.front, P = fr.P, C = fr.C, S = p.S;
  const out = newCanvas(C, C), g = out.getContext('2d'); g.imageSmoothingEnabled = false;
  const dim = dark ? 0.2 : 1;
  const layer = (src, sx, sy, sw, sh, dx, dy, dw, dh) => g.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
  // 1) หน้าหัว (ถ้าตาขยับ = เท็กซ์เจอร์ที่ถมตาดำแล้ว)
  g.drawImage(R.headCanvas || p.img, 8 * S, 8 * S, 8 * S, 8 * S, 0.5 * P, 0.5 * P, 8 * P, 8 * P);
  const U = (x, y) => [(x + 4.5) * P, (32.5 - y) * P];
  const drawPiece = (atlas, b, dx = 0, sy = 1, top = false) => {
    const c = b.cubes[0], uv = c.uv.north, [X0, Y1] = U(c.origin[0], c.origin[1] + c.size[1]);
    const w = c.size[0] * P, h = c.size[1] * P;
    const hh = Math.max(0, h * sy), yy = top ? Y1 : Y1 + (h - hh) / 2;
    layer(atlas.canvas, uv.uv[0] * P, uv.uv[1] * P, uv.uv_size[0] * P, uv.uv_size[1] * P, X0 + dx * P, yy, w, hh);
  };
  const fxb = n => R.fx && R.fx.bones.find(b => b.name === n), glb = n => R.glow && R.glow.bones.find(b => b.name === n);
  const isc = R.f.blink !== 'off' ? 1 - 0.95 * blink : 1;
  for(const k of ['l','r']){
    if(R.moveOK && fxb('move_' + k)) drawPiece(R.fx, fxb('move_' + k), ex, isc);
    if(R.moveOK && fxb('mask_' + k)) drawPiece(R.fx, fxb('mask_' + k));
  }
  // 2) ชั้นหมวก
  g.drawImage(fr.hatC, 0, 0);
  if(dark){ g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(0,0,0,${1 - dim})`; g.fillRect(0, 0, C, C); g.globalCompositeOperation = 'source-over'; }
  // 3) เปลือกตา + ขนตา (อยู่หน้าชั้นหมวก)
  for(const k of ['l','r']){
    const e = R.eyes[k];
    if(blink > 0.001 && fxb('lid_' + k)){
      const sc = e.A || e.B ? (blink > 0.02 ? Math.max(blink, e.A + e.B * blink) : Math.max(0.001, blink)) : Math.max(0.001, blink);
      if(dark) g.filter = 'brightness(0.2)'; drawPiece(R.fx, fxb('lid_' + k), 0, sc, true); g.filter = 'none';
    }
    if(fxb('lash_' + k)){
      const b = fxb('lash_' + k), c = b.cubes[0], uv = c.uv.north, [X0, Y1] = U(c.origin[0], c.origin[1] + c.size[1]);
      if(dark) g.filter = 'brightness(0.2)';
      layer(R.fx.canvas, uv.uv[0] * P, uv.uv[1] * P, uv.uv_size[0] * P, uv.uv_size[1] * P, X0, Y1 + blink * e.D * P, c.size[0] * P, c.size[1] * P);
      g.filter = 'none';
    }
  }
  // 4) ส่วนเรืองแสง (ในที่มืดยังสว่าง)
  if(dark && R.glow) for(const k of ['l','r']){ const b = glb('glow_' + k); if(!b) continue;
    const c = b.cubes[0], uv = c.uv.north, [X0, Y1] = U(c.origin[0], c.origin[1] + c.size[1]);
    const t = newCanvas(uv.uv_size[0] * P, uv.uv_size[1] * P), tg = t.getContext('2d');
    tg.drawImage(R.glow.canvas, uv.uv[0] * P, uv.uv[1] * P, t.width, t.height, 0, 0, t.width, t.height);
    const id = tg.getImageData(0, 0, t.width, t.height); for(let i = 3; i < id.data.length; i += 4) if(id.data[i]) id.data[i] = 255; tg.putImageData(id, 0, 0);
    const h = c.size[1] * P, hh = h * isc;
    g.drawImage(t, X0 + (R.moveOK ? ex : 0) * P, Y1 + (h - hh) / 2, c.size[0] * P, hh); }
  return out;
}
// ภาพมองตรง (ตาไม่เลื่อน ไม่กระพริบ) ต้องเหมือนต้นฉบับทุกพิกเซล
function compareFront(R, p){
  const a = simFront(R, p, {}).getContext('2d').getImageData(0, 0, R.front.C, R.front.C).data;
  const b = R.front.comp, k = (R.front.P / R.front.S) ** 2;
  let n = 0;
  for(let i = 0; i < a.length; i += 4){
    if(b[i+3] < 128 && a[i+3] < 128) continue;
    if((a[i+3] > 128) !== (b[i+3] > 128) || Math.abs(a[i] - b[i]) > 2 || Math.abs(a[i+1] - b[i+1]) > 2 || Math.abs(a[i+2] - b[i+2]) > 2) n++;
  }
  return Math.round(n / k);   // นับเป็นพิกเซลของสกินจริง
}
