
// ---------- โลโก้ ISEKAI: กลิตช์แบบป้ายบั๊ก + สลับฟอนต์ทุกครั้งที่กลิตช์ ----------
// ปกติโลโก้นิ่ง (มีแค่สีเหลื่อมกับแถบสแกน ซึ่งเป็น CSS) ทุก 2.6–4 วินาทีจะ "บั๊ก" 1 ครั้ง:
// ไฟวูบ → ตัวหนังสือฉีกเป็นแถบ + ขีดสีโผล่ → กลางจังหวะสลับเป็นฟอนต์ถัดไป → กลับมานิ่ง
(function setupLogo(){
  const box = document.getElementById('lgBox');
  const tag = document.getElementById('lgTag');
  if(!box || !tag) return;
  const FONTS = ['f4','f1','f2','f3'];           // ลำดับการสลับ (f4 = ฟอนต์หลักตอนเปิดหน้า)
  let fi = 0;
  const slices = box.querySelectorAll('.wt');
  const mg = box.querySelector('.mg');
  const nz = box.querySelector('.lgNz');
  const NZC = ['#5FF6FF','#FF2BD6','#F3E600'];
  for(let k=0;k<5;k++){ const i=document.createElement('i'); i.style.background=NZC[k%3]; nz.appendChild(i); }
  const bars = nz.querySelectorAll('i');
  const R = Math.random;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce) return;                               // ผู้ใช้ปิดการเคลื่อนไหว: โลโก้นิ่ง ไม่กลิตช์

  function frame(){                                 // สุ่ม 1 เฟรมของอาการบั๊ก
    slices.forEach((s,k)=>{
      const top=R()*80, h=3+R()*8;
      s.style.opacity=1;
      s.style.clipPath=`inset(${top}% 0 ${Math.max(0,100-top-h)}% 0)`;
      s.style.transform=`translateX(${(R()-.5)*44}px)`;
      s.style.color=['#EFFFFF','#F3E600','#5FF6FF'][k];
    });
    bars.forEach(b=>{ b.style.display='block'; b.style.left=(R()*92)+'%'; b.style.top=(R()*95)+'%'; b.style.width=(3+R()*12)+'%'; });
    mg.style.translate=`${(R()-.5)*16}px ${(R()-.5)*6}px`;
    tag.style.transform=R()<.5?`translateX(${(R()-.5)*14}px)`:'';
  }
  function clear(){
    slices.forEach(s=>{ s.style.opacity=0; });
    bars.forEach(b=>{ b.style.display='none'; });
    mg.style.translate=''; tag.style.transform=''; box.style.opacity='';
  }
  function swap(){
    box.classList.remove(FONTS[fi]);
    fi=(fi+1)%FONTS.length;
    box.classList.add(FONTS[fi]);
  }
  function burst(){
    if(document.hidden){ return schedule(); }       // แท็บไม่ได้เปิดอยู่: ไม่ต้องเล่น
    // ไฟวูบ 2 ครั้งก่อนบั๊ก
    const seq=[[0,()=>box.style.opacity=.35],[60,()=>box.style.opacity=''],[110,()=>box.style.opacity=.4],[150,()=>box.style.opacity='']];
    const t0=190, steps=6;
    for(let k=0;k<steps;k++) seq.push([t0+k*40, ()=>{ frame(); if(k===3) swap(); }]);
    seq.push([t0+steps*40, clear]);
    seq.forEach(([ms,fn])=>setTimeout(fn,ms));
    setTimeout(schedule, t0+steps*40);
  }
  function schedule(){ setTimeout(burst, 2600+R()*1400); }
  setTimeout(burst, 1400);                          // บั๊กครั้งแรกหลังเปิดหน้าไม่นาน
})();
