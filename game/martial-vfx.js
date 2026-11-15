/* Hmong Legend V2.0 — นักสู้ : nine approved active skills, separate skill VFX.
 * Visual-only Canvas renderer. No damage, collision, skill timings or character changes.
 * Source of truth: existing SKILL_TABLE and CFG.classSkills['นักสู้'].
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.HLMartialVFX=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const TAU=Math.PI*2,PI=Math.PI;
const SKILLS=Object.freeze([
  {slot:3,name:'หมัดเจาะเกราะ',path:'หมัดทะลวง',shape:'line',art:'fist',kind:'pierce',tier:1,location:'front',radius:64},
  {slot:4,name:'ชุดหมัดสะเทือน',path:'หมัดทะลวง',shape:'multi',art:'fists',kind:'combo',tier:2,location:'front',radius:76},
  {slot:5,name:'หมัดทลายปฐพี',path:'หมัดทะลวง',shape:'circle',fxk:'quake',kind:'quake',tier:3,location:'self',radius:136},
  {slot:6,name:'อาคมหนังเหล็ก',path:'กายาเหล็ก',shape:'guard',art:'stoneskin',kind:'iron',tier:1,location:'self',radius:75},
  {slot:7,name:'ตั้งกายรับแรง',path:'กายาเหล็ก',shape:'counter',art:'shock',kind:'counter',tier:2,location:'self',radius:94},
  {slot:8,name:'ทุ่มพสุธา',path:'กายาเหล็ก',shape:'trap',art:'throw',kind:'throw',tier:3,location:'target',radius:87},
  {slot:9,name:'แปลงร่างสัตว์ร้าย',path:'สัตว์ร้ายอาคม',shape:'buff',art:'tiger',kind:'beast',tier:1,location:'self',radius:92},
  {slot:10,name:'จู่โจมสัตว์ร้าย',path:'สัตว์ร้ายอาคม',shape:'dash',art:'pounce',kind:'pounce',tier:2,location:'dash',radius:98},
  {slot:11,name:'สัญชาตญาณดุร้าย',path:'สัตว์ร้ายอาคม',shape:'circle',art:'roar',kind:'roar',tier:3,location:'self',radius:145}
]);
const PALETTES={
  pierce:['#fff6d5','#ffdf70','#ff8a32','#c9472d'],
  combo:['#fff8dd','#ffc75b','#ff732c','#b83726'],
  quake:['#fffbd9','#ffc45b','#ff7d30','#b75f2b'],
  iron:['#f1ffff','#b5dfff','#6da2de','#657486'],
  counter:['#f8ffff','#96daff','#f3c27a','#f27842'],
  throw:['#f5ffff','#a6d0ec','#a6a29b','#705f54'],
  beast:['#fff2ef','#ff9bc9','#f24b8d','#ffb64a'],
  pounce:['#fff2ed','#ff8ab7','#f24d76','#ffbe58'],
  roar:['#fff8e0','#ffc661','#ed6681','#d3424a']
};
const DIR={E:0,S:PI/2,W:PI,N:-PI/2};
const u={E:[1,0],S:[0,1],W:[-1,0],N:[0,-1]};
const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const valid=n=>typeof n==='number'&&Number.isFinite(n);
function profileFor(H,slot){
  const row=SKILLS[Number(slot)-3];if(!row||!H||!H.CFG)return null;
  const names=H.CLS_ACTIVE&&H.CLS_ACTIVE['นักสู้'],skills=H.CFG.classSkills&&H.CFG.classSkills['นักสู้'];
  if(!names||!skills||names[slot-1]!==row.name)return null;
  const runtime=skills[slot-3];
  if(!runtime||runtime.shape!==row.shape||(row.art&&runtime.art!==row.art)||
      (row.fxk&&runtime.fxk!==row.fxk))return null;
  return row;
}
function create(options={}){
  const q=options.quality||'auto',reduced=!!options.reducedMotion;
  const mobile=options.mobile===true||(q==='auto'&&typeof navigator!=='undefined'&&
    /Android|iPhone|iPad/i.test(navigator.userAgent||''));
  const low=q==='low'||(mobile&&q!=='high');
  const max=low?10:24;
  let seq=0;
  const fx=[];
  function emit(event={}){
    const spec=SKILLS[Number(event.slot)-3];
    if(!spec||!valid(event.x)||!valid(event.y))return false;
    if(fx.length>=max)fx.shift();
    const particles=[];
    const count=reduced?5:low?14:28;
    for(let i=0;i<count;i++){
      const a=TAU*i/count+Math.sin(seq+i)*.24;
      particles.push({a,s:1+(i%4),d:.3+(i%7)/9,v:.6+(i%5)/6});
    }
    fx.push({slot:spec.slot,kind:spec.kind,name:spec.name,age:0,
      life:spec.tier===3?1.35:spec.tier===2?1.07:.86,
      x:event.x,y:event.y,dir:DIR[event.dir]??0,
      fromX:valid(event.fromX)?event.fromX:event.x,fromY:valid(event.fromY)?event.fromY:event.y,
      radius:spec.radius,particles});
    seq++;return true;
  }
  function ellipse(ctx,x,y,rx,ry,c,w=2){
    ctx.beginPath();ctx.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);
    ctx.strokeStyle=c;ctx.lineWidth=w;ctx.stroke();
  }
  function roundRing(ctx,r,p,col){
    const R=r*(.24+.76*smooth(p*2.4));
    ellipse(ctx,0,0,R,R*.42,col[1],5);
    ellipse(ctx,0,0,R*.84,R*.35,col[0],1.8);
  }
  function sigils(ctx,r,p,col){
    ctx.save();ctx.rotate(p*.8);
    for(let i=0;i<12;i++){
      const a=TAU*i/12,rad=r*(.35+.47*smooth(p*2));
      ctx.save();ctx.translate(Math.cos(a)*rad,Math.sin(a)*rad*.42);
      ctx.rotate(a);
      ctx.fillStyle=col[i%3===0?0:1];
      ctx.fillRect(-3,-5,7,2);ctx.fillRect(-1,-9,2,18);
      ctx.restore();
    }
    ctx.restore();
  }
  function impact(ctx,r,p,col){
    const k=smooth(clamp((p-.12)*2.8,0,1));
    for(let i=0;i<12;i++){
      const a=TAU*i/12,rad=r*(.12+.89*k);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*r*.09,Math.sin(a)*r*.04);
      ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad*.47);
      ctx.strokeStyle=col[i%3===0?0:2];ctx.lineWidth=i%4?2:5;ctx.stroke();
    }
  }
  function fist(ctx,r,p,col){
    ctx.save();ctx.rotate(-.26);
    const x=r*(.2+.26*smooth(p*2.4));
    ctx.fillStyle=col[1];ctx.fillRect(x-r*.17,-r*.13,r*.28,r*.26);
    ctx.fillStyle=col[0];
    for(let i=0;i<4;i++)ctx.fillRect(x+i*r*.07,-r*.13,r*.055,r*.11);
    ctx.restore();
  }
  function claws(ctx,r,p,col){
    const s=smooth(clamp(p*2.4,0,1));
    for(let i=-1;i<=1;i++){
      ctx.beginPath();
      ctx.moveTo(-r*.28,i*r*.16-r*.2*s);
      ctx.quadraticCurveTo(r*.22,i*r*.22-r*.25*s,r*(.25+.65*s),i*r*.24-r*.1);
      ctx.strokeStyle=i===0?col[0]:col[1];ctx.lineWidth=9-Math.abs(i)*3;ctx.stroke();
    }
  }
  function beastHead(ctx,r,p,col){
    const scale=.55+.24*smooth(p*2);
    ctx.save();ctx.translate(0,-r*.26);ctx.scale(scale,scale);
    // Original abstract spirit-beast crest; does not replace the approved player.
    ctx.beginPath();
    ctx.moveTo(-r*.72,0);ctx.lineTo(-r*.49,-r*.46);ctx.lineTo(-r*.18,-r*.26);
    ctx.quadraticCurveTo(0,-r*.32,r*.18,-r*.26);
    ctx.lineTo(r*.49,-r*.46);ctx.lineTo(r*.72,0);
    ctx.quadraticCurveTo(r*.6,r*.6,0,r*.66);
    ctx.quadraticCurveTo(-r*.6,r*.6,-r*.72,0);
    ctx.closePath();
    ctx.lineWidth=8;ctx.strokeStyle=col[2];ctx.stroke();
    ctx.lineWidth=2;ctx.strokeStyle=col[0];ctx.stroke();
    ctx.fillStyle=col[0];
    ctx.beginPath();ctx.moveTo(-r*.38,r*.05);ctx.lineTo(-r*.08,r*.13);ctx.lineTo(-r*.29,r*.2);ctx.fill();
    ctx.beginPath();ctx.moveTo(r*.38,r*.05);ctx.lineTo(r*.08,r*.13);ctx.lineTo(r*.29,r*.2);ctx.fill();
    for(const d of [-1,1]){
      ctx.beginPath();ctx.moveTo(d*r*.13,r*.35);ctx.lineTo(d*r*.35,r*.47);
      ctx.strokeStyle=col[1];ctx.lineWidth=4;ctx.stroke();
    }
    ctx.restore();
  }
  function renderSkill(ctx,e,p,col){
    const r=e.radius;
    if(e.kind==='pierce'){
      ctx.rotate(e.dir);roundRing(ctx,r*.57,p,col);impact(ctx,r*.52,p,col);fist(ctx,r,p,col);
      ctx.beginPath();ctx.moveTo(-r*.65,0);ctx.lineTo(r*.77,0);ctx.lineWidth=5;ctx.strokeStyle=col[0];ctx.stroke();
    }else if(e.kind==='combo'){
      ctx.rotate(e.dir);
      for(let i=0;i<4;i++){
        const t=(p-i*.16)*3.1;
        if(t<=0||t>=1)continue;
        const x=r*(.04+i*.20),y=(i%2?1:-1)*r*.20;
        ctx.save();ctx.translate(x,y);
        ellipse(ctx,0,0,r*(.20+.25*t),r*(.14+.2*t),col[1],5*(1-t)+1.5);
        fist(ctx,r*.44,t,col);ctx.restore();
      }
      impact(ctx,r*.83,p,col);
    }else if(e.kind==='quake'){
      roundRing(ctx,r,p,col);sigils(ctx,r,p,col);
      for(let i=0;i<13;i++){
        const a=TAU*i/13,rr=r*(.2+.7*smooth(p*1.6)),cx=Math.cos(a)*rr,cy=Math.sin(a)*rr*.43;
        ctx.beginPath();ctx.moveTo(cx*.3,cy*.3);
        ctx.lineTo(cx*.7+Math.sin(i)*9,cy*.67);
        ctx.lineTo(cx,cy);
        ctx.lineWidth=i%3?3:5;ctx.strokeStyle=col[i%2?1:2];ctx.stroke();
        const h=(1-p)*24+(i%3)*8;
        ctx.fillStyle=col[3];ctx.fillRect(cx-6,cy-h,12,9);
        ctx.strokeStyle=col[1];ctx.strokeRect(cx-6,cy-h,12,9);
      }
      impact(ctx,r,p,col);
    }else if(e.kind==='iron'){
      ellipse(ctx,0,-r*.18,r*.72,r*.7,col[1],6);ellipse(ctx,0,-r*.18,r*.55,r*.6,col[0],2);
      for(let i=0;i<8;i++){
        const a=TAU*i/8,rr=r*.52;
        ctx.save();ctx.translate(Math.cos(a)*rr,Math.sin(a)*rr*.62-r*.18);ctx.rotate(a);
        ctx.fillStyle=col[3];ctx.fillRect(-8,-14,16,28);
        ctx.strokeStyle=col[0];ctx.lineWidth=3;ctx.strokeRect(-8,-14,16,28);ctx.restore();
      }
    }else if(e.kind==='counter'){
      const t=smooth(p*2.1);ellipse(ctx,0,-r*.13,r*.69,r*.61,col[1],8-4*t);
      ctx.save();ctx.rotate(e.dir);
      if(p>.28){for(let side of [-1,1]){
        ctx.beginPath();ctx.arc(0,0,r*.85,-.72+side*.12,.72+side*.12);
        ctx.lineWidth=8;ctx.strokeStyle=col[side===1?2:0];ctx.stroke();
      }}
      ctx.restore();impact(ctx,r*.73,p,col);
    }else if(e.kind==='throw'){
      roundRing(ctx,r,p,col);sigils(ctx,r,p,col);
      for(let i=0;i<9;i++){
        const a=i*TAU/9,dist=r*(.26+.47*smooth(p*1.5)),h=18+Math.sin(i*7)*12+(1-p)*32;
        const x=Math.cos(a)*dist,y=Math.sin(a)*dist*.41;
        ctx.beginPath();ctx.moveTo(x-7,y-h);
        ctx.lineTo(x+8,y-h-14);ctx.lineTo(x+17,y-h);ctx.closePath();
        ctx.strokeStyle=col[1];ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=col[3];ctx.fill();
      }
      impact(ctx,r*.9,p,col);
    }else if(e.kind==='beast'){
      roundRing(ctx,r*.83,p,col);sigils(ctx,r,p,col);beastHead(ctx,r*.77,p,col);
      for(let i=0;i<3;i++){ctx.save();ctx.rotate(i*2.1+p*2);
        ellipse(ctx,0,0,r*(.31+i*.14),r*(.14+i*.08),col[i],2);ctx.restore();}
    }else if(e.kind==='pounce'){
      const dx=e.fromX-e.x,dy=e.fromY-e.y;
      if(Math.hypot(dx,dy)>12){
        ctx.beginPath();ctx.moveTo(dx,dy);ctx.quadraticCurveTo(dx*.4,dy*.4-r*.25,0,0);
        ctx.lineWidth=11;ctx.strokeStyle=col[2];ctx.stroke();
        ctx.lineWidth=3;ctx.strokeStyle=col[0];ctx.stroke();
      }
      ctx.save();ctx.rotate(e.dir);claws(ctx,r,p,col);ctx.restore();
      impact(ctx,r*.75,p,col);
    }else if(e.kind==='roar'){
      roundRing(ctx,r,p,col);sigils(ctx,r,p,col);
      beastHead(ctx,r*.81,p,col);
      for(let i=0;i<3;i++){
        const rad=r*(.25+i*.23)*smooth(p*2.2);
        ellipse(ctx,0,0,rad,rad*.44,col[(i+1)%3],6-i);
      }
      impact(ctx,r,p,col);
    }
  }
  function draw(ctx,dt){
    if(!ctx||typeof ctx.save!=='function')return;
    dt=clamp(valid(dt)?dt:0,0,.1);
    for(let i=fx.length-1;i>=0;i--){
      const e=fx[i];e.age+=dt;if(e.age>=e.life){fx.splice(i,1);continue;}
      const p=e.age/e.life,col=PALETTES[e.kind],alpha=Math.pow(1-p,1.24);
      ctx.save();ctx.translate(e.x,e.y);
      ctx.globalCompositeOperation='lighter';ctx.globalAlpha=alpha*.88;
      ctx.shadowColor=col[1];ctx.shadowBlur=low?5:14;
      renderSkill(ctx,e,p,col);
      for(let j=0;j<e.particles.length;j++){
        const m=e.particles[j],s=smooth(p*2.1)*e.radius*m.d;
        const x=Math.cos(m.a+p*.4*m.v)*s,y=Math.sin(m.a+p*.4*m.v)*s*.5-e.radius*.16*p;
        ctx.fillStyle=col[j%3];ctx.fillRect(x,y,m.s*2,m.s*2);
      }
      ctx.restore();
    }
  }
  return {emit,draw,clear(){fx.length=0;},get count(){return fx.length;},
    get max(){return max;},get instances(){return fx.map(e=>({slot:e.slot,name:e.name,kind:e.kind}));}};
}
return {SKILLS,PALETTES,profileFor,create};
});
