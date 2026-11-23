
// ---------- จัดผังมือถือ: ย้ายกรอบพรีวิวไปไว้ใต้ขั้นที่ 1 ----------
// จอแคบ: ช่องเลือกสกินต้องมาก่อน (เป็นสิ่งแรกที่ต้องกด) พรีวิวตามมาหลังใส่สกิน
// จอกว้าง: กลับไปอยู่คอลัมน์ซ้ายแบบเดิม (ย้ายแค่ตำแหน่งในหน้า ตัวพรีวิว 3 มิติยังเป็นอันเดิม)
(function setupLayout(){
  const stage = $('stageCol'), skinWin = $('winSkin'), layout = document.querySelector('.layout');
  if(!stage || !skinWin || !layout) return;
  const mq = matchMedia('(max-width: 899px)');
  function place(){
    if(mq.matches){ if(stage.previousElementSibling !== skinWin) skinWin.after(stage); }
    else if(layout.firstElementChild !== stage) layout.prepend(stage);
    resize();
  }
  if(mq.addEventListener) mq.addEventListener('change', place); else mq.addListener(place);
  place();
})();
