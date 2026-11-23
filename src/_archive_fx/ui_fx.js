
/* =====================================================================
   หน้าต่าง "ฟังชั่นของสกิน" + ตัวแก้กรอบตา (สูตรข้อ 8.5 แบบย่อ: ผู้ใช้ลากกรอบตา เว็บหาขนตา/ตาดำ/ช่องตาให้)
   ===================================================================== */
const EYE = { token: 0, R: null, p: null, sim: null, drag: null, mode: null,
  brush: null, zk: 'l', zoom: 1, stroke: null, pending: null, undo: [], undoFor: null };   // brush = ชั้นที่กำลังแตะแต่งทีละพิกเซล
async function renderFx(){
  const s = state.skins[state.selected], card = $('fxCard');
  $('fxEmpty').classList.toggle('hidden', !!s);
  if(!s){ card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  const f = fxOf(s);
  $('fxName').textContent = s.name;
  renderFxTabs();
  $('fxBlink').value = f.blink; $('fxRange').value = String(f.range);
  $('fxMove').checked = f.move; $('fxGlow').checked = f.glow; $('fxFlow').checked = f.flow && !!s.bb;
  $('fxFlow').disabled = !s.bb; $('fxFlow').parentElement.classList.toggle('off', !s.bb);
  // ตัวแก้กรอบตาโชว์เฉพาะตอนติ๊กฟังชั่นตา
  $('eyeBox').classList.toggle('hidden', !anyEyeFx(f));
  // ปุ่มแต่งทีละพิกเซล: ตาดำ/ช่องตา ใช้กับตาขยับ • เรืองแสง ใช้กับตาเรืองแสง
  const brushOK = { iris: f.move, open: f.move, core: f.glow };
  document.querySelectorAll('[data-brush]').forEach(b => b.classList.toggle('hidden', !brushOK[b.dataset.brush]));
  $('paintTools').classList.toggle('hidden', !(f.move || f.glow));
  if(EYE.undoFor !== s.id){ EYE.undo = []; EYE.undoFor = s.id; }     // ประวัติย้อนกลับแยกต่อสกิน
  if(EYE.brush && !brushOK[EYE.brush]) setBrush(null);
  const token = ++EYE.token;
  const p = await pixOf(s);
  if(!f.eyes && anyEyeFx(f)){ f.eyes = autoEyes(p); saveLocal(); }
  const R = await computeFx(s);
  if(token !== EYE.token) return;              // มีการเปลี่ยนระหว่างคำนวณ
  EYE.R = R; EYE.p = p; EYE.s = s; EYE.fr = R.front || frontCached(s, p);
  drawEye();
  // สรุปผล + คำเตือน
  const lines = [];
  const on = [];
  if(f.blink !== 'off' && R.fx && R.fx.bones.some(b => /^lid_/.test(b.name))) on.push('กระพริบตา' + (f.blink === 'slow' ? 'ช้า' : ''));
  if(R.moveOK) on.push(`ตาขยับ ±${R.M}`);
  if(R.glow) on.push('ตาเรืองแสง');
  if(R.flowCount) on.push(`ผมพริ้ว ${R.flowCount} ชิ้น`);
  lines.push(on.length ? `ฟังชั่นที่ใส่: <b>${esc(on.join(' • '))}</b> • ตัดระยะ ${f.range} บล็อก` : 'สกินเปล่า ไม่มีฟังชั่นเสริม');
  R.checks.forEach(c => lines.push(esc(c)));
  R.warns.forEach(w => lines.push('⚠ ' + esc(w)));
  show($('fxMsg'), R.warns.length ? 'warn' : 'ok', lines.join('<br>'));
}
const FRONT = new Map();
function frontCached(s, p){ if(!FRONT.has(s.id)) FRONT.set(s.id, frontOf(p)); return FRONT.get(s.id); }

// วาดภาพหน้าตรง + ชั้นสีบอกส่วนต่างๆ (หรือภาพจำลองตอนกดทดสอบ)
function drawEye(){
  const R = EYE.R, fr = EYE.fr, s = EYE.s; if(!fr || !s) return;
  if(EYE.brush) return drawPaint();
  const f = fxOf(s), cv = $('eyeCv'), P = fr.P, C = fr.C, S = fr.S, k = P / S;
  cv.width = C; cv.height = C;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, C, C);
  if(EYE.sim && R && R.eyes){ g.drawImage(simFront(R, EYE.p, EYE.sim), 0, 0); if(EYE.sim.dark){ /* พื้นมืด */ } return; }
  g.drawImage(fr.compC, 0, 0);
  const lw = Math.max(1, P / 16);
  // ส่วนที่ระบบหาได้
  if(R && R.eyes) for(const e of Object.values(R.eyes)){
    if(e.lash){ g.fillStyle = 'rgba(199,125,255,.35)'; g.fillRect(Math.round((e.box.x0 + 4.5) * P), e.lash.r0, Math.round((e.box.x1 - e.box.x0) * P), e.lash.r1 - e.lash.r0 + 1); }
    if(e.rect){
      const r = e.rect, ox = 0.5 * P + r.tx0 * k, oy = 0.5 * P + r.ty0 * k;
      for(let y = 0; y < r.h; y++) for(let x = 0; x < r.w; x++){
        const q = y * r.w + x;
        if(f.glow && r.core[q]){ g.fillStyle = 'rgba(255,77,109,.55)'; g.fillRect(ox + x * k, oy + y * k, k, k); }
        else if(f.move && r.iris[q]){ g.fillStyle = 'rgba(61,123,255,.5)'; g.fillRect(ox + x * k, oy + y * k, k, k); }
        else if(f.move && r.open[q]){ g.fillStyle = 'rgba(255,210,63,.4)'; g.fillRect(ox + x * k, oy + y * k, k, k); }
      }
    }
  }
  // กรอบตา
  for(const [key, col] of [['l', '#4ee6ff'], ['r', '#4dff9a']]){
    const b = EYE.drag && EYE.drag.k === key ? EYE.drag.box : f.eyes && f.eyes[key]; if(!b) continue;
    g.strokeStyle = col; g.lineWidth = lw * 1.5; g.setLineDash(EYE.drag && EYE.drag.k === key ? [lw * 3, lw * 2] : []);
    g.strokeRect((b.x0 + 4.5) * P, (32.5 - b.y1) * P, (b.x1 - b.x0) * P, (b.y1 - b.y0) * P);
  }
  g.setLineDash([]);
}
// แปลงตำแหน่งนิ้ว → หน่วยโมเดล
function eyeUnits(e){
  const cv = $('eyeCv'), r = cv.getBoundingClientRect(), fr = EYE.fr;
  const px = (e.clientX - r.left) / r.width * fr.C, py = (e.clientY - r.top) / r.height * fr.C;
  return { x: Math.max(-4.5, Math.min(4.5, px / fr.P - 4.5)), y: Math.max(23.5, Math.min(32.5, 32.5 - py / fr.P)) };
}
// แท็บชื่อสกินบนหัวส่วนฟังชั่น: แตะเพื่อสลับว่ากำลังตั้งฟังชั่นให้สกินไหน
// (สร้างด้วย textContent เท่านั้น — ชื่อสกินมาจากผู้ใช้ ห้ามใส่เป็น HTML)
function renderFxTabs(){
  const box = $('fxTabs'); box.textContent = '';
  box.classList.toggle('hidden', state.skins.length < 2);       // สกินเดียวไม่ต้องมีแท็บ
  $('fxAll').classList.toggle('hidden', state.skins.length < 2);
  state.skins.forEach((t, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fxTab' + (i === state.selected ? ' on' : '');
    b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', i === state.selected ? 'true' : 'false');
    b.textContent = t.name || ('สกิน ' + (i + 1));
    b.onclick = () => { if(state.selected !== i){ state.selected = i; render(); } };
    box.appendChild(b);
  });
}
// ---------- แต่งทีละพิกเซล ----------
const PAINT_COL = { iris: [61,123,255], open: [255,210,63], core: [255,77,109] };
// เข้า/ออกโหมดแต่ง (null = ออก กลับไปภาพหน้าเต็ม)
function setBrush(b){
  EYE.brush = b; EYE.stroke = null; EYE.pending = null;
  document.querySelectorAll('[data-brush]').forEach(x => x.classList.toggle('on', x.dataset.brush === b));
  $('paintSub').classList.toggle('hidden', !b); $('paintHint').classList.toggle('hidden', !b);
  if(!b){ EYE.zoom = 1; }
  $('eyEdit').classList.toggle('on', !b && !EYE.sim);   // ปุ่ม "ดูกรอบ" ไม่ติดไฟตอนอยู่ในโหมดแต่ง
  applyZoom(); markZoomEye(); drawEye();
}
function markZoomEye(){ $('pzL').classList.toggle('on', EYE.zk === 'l'); $('pzR').classList.toggle('on', EYE.zk === 'r'); }
// ขยายภาพ: ×1 = ลากนิ้วทาได้ • ×2 ขึ้นไป = ลากนิ้วเลื่อนดูภาพ แตะทีละช่องเพื่อแต่ง (สำหรับสกิน HD ที่พิกเซลเล็ก)
function applyZoom(){
  const cv = $('eyeCv'), z = EYE.brush ? EYE.zoom : 1;
  cv.style.width = z > 1 ? (z * 100) + '%' : ''; cv.style.maxWidth = z > 1 ? 'none' : '';
  cv.style.touchAction = z > 1 ? 'pan-x pan-y' : 'none';
  $('eyeWrap').classList.toggle('zoomed', z > 1);
  $('pzZoom').textContent = '×' + z;
}
function paintRect(){ const R = EYE.R, e = R && R.eyes && R.eyes[EYE.zk]; return e && e.rect; }
function drawPaint(){
  const cv = $('eyeCv'), g = cv.getContext('2d'), r = paintRect(), p = EYE.p, s = EYE.s;
  if(!r || !p){ cv.width = 320; cv.height = 60; g.fillStyle = '#9aa'; g.font = '16px sans-serif'; g.fillText('ยังไม่มีกรอบตาข้างนี้', 12, 36); return; }
  const S = p.S, W = p.W, d = p.d, L = EYE.brush;
  const cell = Math.max(6, Math.floor(480 / Math.max(r.w, r.h)));
  EYE.cell = cell;
  cv.width = r.w * cell; cv.height = r.h * cell;
  g.clearRect(0, 0, cv.width, cv.height);
  const mine = ((fxOf(s).eyes || {}).paint || {})[L] || {};
  for(let y = 0; y < r.h; y++) for(let x = 0; x < r.w; x++){
    const i = ((8 * S + r.ty0 + y) * W + 8 * S + r.tx0 + x) * 4, X = x * cell, Y = y * cell, q = y * r.w + x;
    g.fillStyle = `rgba(${d[i]},${d[i+1]},${d[i+2]},${d[i+3] / 255})`; g.fillRect(X, Y, cell, cell);
    // ชั้นที่เลือก = ระบายทึบครึ่ง • ชั้นอื่น = จุดเล็กมุมช่อง (ให้เห็นภาพรวม)
    if(r[L][q]){ const c = PAINT_COL[L]; g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},.55)`; g.fillRect(X, Y, cell, cell); }
    let dot = 0;
    for(const o of ['iris','open','core']) if(o !== L && r[o][q] && cell >= 12){ const c = PAINT_COL[o]; g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.fillRect(X + 2 + dot * 6, Y + 2, 4, 4); dot++; }
    // ช่องที่แต่งเอง: ขอบขาว (ใส่) / กากบาท (เอาออก)
    const v = mine[(r.tx0 + x) + ',' + (r.ty0 + y)];
    if(v === 1){ g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, cell / 10); g.strokeRect(X + 1.5, Y + 1.5, cell - 3, cell - 3); }
    else if(v === 0){ g.strokeStyle = '#fff'; g.lineWidth = Math.max(1.5, cell / 14); g.beginPath(); g.moveTo(X + cell * .25, Y + cell * .25); g.lineTo(X + cell * .75, Y + cell * .75); g.moveTo(X + cell * .75, Y + cell * .25); g.lineTo(X + cell * .25, Y + cell * .75); g.stroke(); }
  }
  // เส้นตาราง
  g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.beginPath();
  for(let x = 0; x <= r.w; x++){ g.moveTo(x * cell + .5, 0); g.lineTo(x * cell + .5, cv.height); }
  for(let y = 0; y <= r.h; y++){ g.moveTo(0, y * cell + .5); g.lineTo(cv.width, y * cell + .5); }
  g.stroke();
}
// ตำแหน่งนิ้ว → ช่องพิกเซลในกรอบ (−1 = นอกภาพ)
function paintCell(e){
  const r = paintRect(); if(!r) return -1;
  const b = $('eyeCv').getBoundingClientRect();
  const x = Math.floor((e.clientX - b.left) / b.width * r.w), y = Math.floor((e.clientY - b.top) / b.height * r.h);
  return x < 0 || y < 0 || x >= r.w || y >= r.h ? -1 : y * r.w + x;
}
// ใส่/เอาออก 1 ช่อง (แสดงผลทันที คำนวณใหม่ทั้งหมดตอนยกนิ้ว)
function paintAt(q, v){
  const r = paintRect(), f = fxOf(EYE.s); if(!r || q < 0) return;
  const key = (r.tx0 + q % r.w) + ',' + (r.ty0 + ((q / r.w) | 0));
  f.eyes.paint = f.eyes.paint || {};
  const m = f.eyes.paint[EYE.brush] = f.eyes.paint[EYE.brush] || {};
  m[key] = v; r[EYE.brush][q] = v;
}
function pushUndo(){
  const f = fxOf(EYE.s); EYE.undo.push(JSON.stringify((f.eyes && f.eyes.paint) || {}));
  if(EYE.undo.length > 50) EYE.undo.shift();
}
function commitPaint(){ saveLocal(); updateViewer(); }
function setupEyeEditor(){
  const cv = $('eyeCv');
  // แตะ/ลากในโหมดแต่งทีละพิกเซล
  cv.addEventListener('pointerdown', e => {
    if(!EYE.brush || !EYE.s) return;
    const q = paintCell(e), r = paintRect(); if(q < 0 || !r) return;
    const v = r[EYE.brush][q] ? 0 : 1;                       // แตะช่องที่มีอยู่แล้ว = เอาออก
    if(EYE.zoom > 1){ EYE.pending = { q, v, id: e.pointerId }; return; }   // ขยายอยู่: รอยกนิ้ว (ถ้าลากคือเลื่อนภาพ)
    pushUndo(); EYE.stroke = { v }; paintAt(q, v); cv.setPointerCapture(e.pointerId); drawPaint();
  });
  cv.addEventListener('pointermove', e => {
    if(!EYE.brush) return;
    if(EYE.pending && (Math.abs(e.movementX) + Math.abs(e.movementY) > 6)) EYE.pending = null;
    if(!EYE.stroke) return;
    const q = paintCell(e); if(q < 0) return;
    const r = paintRect(); if(r[EYE.brush][q] !== EYE.stroke.v){ paintAt(q, EYE.stroke.v); drawPaint(); }
  });
  const paintEnd = ok => {
    if(!EYE.brush) return false;
    if(EYE.pending){ const pd = EYE.pending; EYE.pending = null; if(ok){ pushUndo(); paintAt(pd.q, pd.v); drawPaint(); commitPaint(); } return true; }
    if(EYE.stroke){ EYE.stroke = null; commitPaint(); return true; }
    return true;
  };
  cv.addEventListener('pointerup', () => paintEnd(true));
  cv.addEventListener('pointercancel', () => paintEnd(false));
  document.querySelectorAll('[data-brush]').forEach(b => b.onclick = () => {
    if(!EYE.R || !EYE.R.eyes){ show($('fxMsg'), 'warn', 'รอระบบหาตาเสร็จก่อน แล้วค่อยแตะแต่ง'); return; }
    EYE.sim = null; markSim(null); EYE.mode = null; markMode();
    setBrush(EYE.brush === b.dataset.brush ? null : b.dataset.brush);
  });
  $('pzL').onclick = () => { EYE.zk = 'l'; markZoomEye(); drawEye(); };
  $('pzR').onclick = () => { EYE.zk = 'r'; markZoomEye(); drawEye(); };
  $('pzZoom').onclick = () => { EYE.zoom = EYE.zoom >= 8 ? 1 : EYE.zoom * 2; applyZoom(); };   // ×1 → ×2 → ×4 → ×8
  $('paintUndo').onclick = () => {
    if(!EYE.undo.length){ show($('fxMsg'), 'warn', 'ไม่มีอะไรให้ย้อนแล้ว'); return; }
    const f = fxOf(EYE.s); if(!f.eyes) return;
    f.eyes.paint = cleanPaint(JSON.parse(EYE.undo.pop())); commitPaint();
  };
  $('paintClear').onclick = () => {
    const f = fxOf(EYE.s); if(!f.eyes) return;
    pushUndo(); f.eyes.paint = {}; commitPaint();
  };
  $('paintDone').onclick = () => setBrush(null);
  cv.addEventListener('pointerdown', e => {
    if(EYE.brush) return;                                    // อยู่ในโหมดแต่ง: ไม่ลากกรอบ
    if(!EYE.fr || !EYE.s) return;
    EYE.sim = null; markSim(null);
    const u = eyeUnits(e), k = EYE.mode || (u.x < 0 ? 'l' : 'r');
    EYE.drag = { k, a: u, box: { x0: u.x, x1: u.x, y0: u.y, y1: u.y } };
    cv.setPointerCapture(e.pointerId); drawEye();
  });
  cv.addEventListener('pointermove', e => {
    if(!EYE.drag) return;
    const u = eyeUnits(e), a = EYE.drag.a;
    EYE.drag.box = { x0: Math.min(a.x, u.x), x1: Math.max(a.x, u.x), y0: Math.min(a.y, u.y), y1: Math.max(a.y, u.y) };
    drawEye();
  });
  const end = () => {
    if(!EYE.drag) return;
    const d = EYE.drag; EYE.drag = null;
    const S = EYE.fr.S, b = {};
    for(const q of ['x0','y0']) b[q] = Math.floor(d.box[q] * S + 1e-6) / S;    // ขยายออกให้ครอบพิกเซลเต็มช่อง
    for(const q of ['x1','y1']) b[q] = Math.ceil(d.box[q] * S - 1e-6) / S;
    if(b.x1 - b.x0 < 1 / S || b.y1 - b.y0 < 1 / S){ drawEye(); return; }     // แตะเฉยๆ ไม่เปลี่ยน
    b.x0 = Math.max(-4.5, b.x0); b.x1 = Math.min(4.5, b.x1); b.y0 = Math.max(23.5, b.y0); b.y1 = Math.min(32.5, b.y1);
    const f = fxOf(EYE.s); f.eyes = { ...(f.eyes || {}), [d.k]: b };
    EYE.mode = null; markMode();
    saveLocal(); updateViewer();
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  $('eyAuto').onclick = async () => { const s = EYE.s; if(!s) return; const old = fxOf(s).eyes; fxOf(s).eyes = { ...autoEyes(await pixOf(s)), paint: (old && old.paint) || {} }; setBrush(null); EYE.sim = null; markSim(null); saveLocal(); updateViewer(); };
  $('eyL').onclick = () => { setBrush(null); EYE.mode = EYE.mode === 'l' ? null : 'l'; markMode(); };
  $('eyR').onclick = () => { setBrush(null); EYE.mode = EYE.mode === 'r' ? null : 'r'; markMode(); };
  $('eyEdit').onclick = () => { EYE.sim = null; markSim(null); setBrush(null); };
  document.querySelectorAll('[data-sim]').forEach(b => b.onclick = () => {
    const R = EYE.R; if(!R || !R.eyes){ show($('fxMsg'), 'warn', 'เปิดฟังชั่นตาอย่างน้อย 1 อย่างก่อน แล้วค่อยทดสอบ'); return; }
    const m = R.moveOK ? R.M : 0;
    EYE.sim = { open: {}, half: { blink: 0.5 }, shut: { blink: 1 }, left: { ex: -m }, right: { ex: m }, dark: { dark: true } }[b.dataset.sim];
    markSim(b.dataset.sim); if(EYE.brush) setBrush(null); else drawEye();
  });
  // ตัวเลือกฟังชั่น
  const upd = fn => () => { const s = state.skins[state.selected]; if(!s) return; fn(fxOf(s)); saveLocal(); updateViewer(); };
  $('fxBlink').onchange = upd(f => f.blink = $('fxBlink').value);
  $('fxRange').onchange = upd(f => f.range = +$('fxRange').value);
  $('fxMove').onchange = upd(f => f.move = $('fxMove').checked);
  $('fxGlow').onchange = upd(f => f.glow = $('fxGlow').checked);
  $('fxFlow').onchange = upd(f => f.flow = $('fxFlow').checked);
  // คัดลอกฟังชั่นของสกินที่เลือกไปให้ทุกสกิน (ไม่คัดลอกกรอบตา เพราะตาแต่ละสกินอยู่คนละที่ ระบบหาตาให้เองตอนสร้าง)
  $('fxAll').onclick = () => {
    const s = state.skins[state.selected]; if(!s) return;
    const f = fxOf(s); let n = 0, noFlow = 0;
    state.skins.forEach(t => {
      if(t === s) return;
      const g = fxOf(t);
      g.blink = f.blink; g.range = f.range; g.move = f.move; g.glow = f.glow;
      g.flow = f.flow && !!t.bb; if(f.flow && !t.bb) noFlow++;
      n++;
    });
    saveLocal();
    show($('fxMsg'), 'ok', `ใช้ฟังชั่นชุดนี้กับอีก ${n} สกินแล้ว` + (noFlow ? ` • ${noFlow} สกินไม่มี .bbmodel เลยใส่ผมพริ้วไม่ได้` : '') + ' • กรอบตาของแต่ละสกินระบบหาให้เอง แตะแท็บเพื่อตรวจทีละตัวได้');
  };
}
function markMode(){ $('eyL').classList.toggle('on', EYE.mode === 'l'); $('eyR').classList.toggle('on', EYE.mode === 'r'); }
function markSim(k){ document.querySelectorAll('[data-sim]').forEach(b => b.classList.toggle('on', b.dataset.sim === k)); $('eyEdit').classList.toggle('on', !k); }
