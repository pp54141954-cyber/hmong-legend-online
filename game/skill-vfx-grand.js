/* Hmong Legend V2 — optional grand skill VFX layer (visual only).
 * Standalone UMD renderer. Does not alter hitboxes, cooldowns, or damage.
 * Coordinate space: game-world pixels; caller applies its camera transform.
 * Integration: load this script, create HLGrandVFX.create({quality:'auto'}),
 * call fx.emit({kind:'sword',x,y,dir:'E'}) on an existing skill-release visual event,
 * then fx.draw(ctx, deltaSeconds) inside the world-space render pass.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.HLGrandVFX=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const TAU=Math.PI*2;
const COLORS={
 sword:['#fff7cb','#ffcb59','#ff653d'],
 arrow:['#f0ffbd','#9afc67','#2e9e7d'],
 arcane:['#f3d8ff','#9c80ff','#3d6ef2'],
 shield:['#e9ffff','#78dcff','#338bda'],
 spirit:['#d4fff0','#65edb6','#7c66e9'],
 fire:['#fff4ad','#ff9e45','#ee3455'],
 default:['#ffffff','#a7c7ff','#5576db']
};
const ALIASES={
 'นักดาบ':'sword','นักธนู':'arrow','ผู้ใช้มนตรา':'arcane',
 'ผู้พิทักษ์':'shield','ผู้สืบวิญญาณ':'spirit','ผู้รักษา':'spirit',
 'นักฆ่า':'sword','นักรบ':'sword'
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ease=t=>1-Math.pow(1-clamp(t,0,1),3);
const vector={E:0,S:Math.PI/2,W:Math.PI,N:-Math.PI/2};
function create(options={}){
  const effects=[];
  const quality=options.quality||'auto';
  const reduced=!!options.reducedMotion;
  const max=quality==='low'?18:quality==='high'?72:36;
  let seq=0;
  function emit(o={}){
    if(!Number.isFinite(o.x)||!Number.isFinite(o.y))return false;
    const kind=COLORS[o.kind]?o.kind:(ALIASES[o.cls]||'default');
    const duration=clamp(Number(o.duration)||.66,.12,2);
    const radius=clamp(Number(o.radius)||72,16,220);
    if(effects.length>=max)effects.shift();
    effects.push({id:++seq,kind,x:o.x,y:o.y,dir:vector[o.dir]??0,
      age:0,duration,radius,seed:seq*2.399963229728653,scale:clamp(Number(o.scale)||1,.4,2)});
    return true;
  }
  function draw(ctx,dt){
    if(!ctx||typeof ctx.save!=='function')return;
    dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
    for(let i=effects.length-1;i>=0;i--){
      const e=effects[i];e.age+=dt;
      if(e.age>=e.duration){effects.splice(i,1);continue;}
      const t=e.age/e.duration, a=Math.pow(1-t,1.3),r=e.radius*e.scale;
      const c=COLORS[e.kind],growth=ease(Math.min(1,t*2.2));
      ctx.save();ctx.translate(e.x,e.y);ctx.globalAlpha=a;
      ctx.lineCap='round';ctx.lineJoin='round';
      // Two expanding magic rings + radial spokes, kept under the character silhouette.
      for(let layer=0;layer<2;layer++){
        const rr=r*(.22+.65*growth+layer*.17);
        ctx.beginPath();ctx.arc(0,0,rr,0,TAU);
        ctx.lineWidth=(layer?2.5:5)*e.scale;ctx.strokeStyle=c[layer];ctx.stroke();
        if(!reduced)for(let j=0;j<8;j++){
          const q=e.seed+j*TAU/8+t*(layer?-1:1)*1.8;
          ctx.beginPath();ctx.moveTo(Math.cos(q)*rr*.87,Math.sin(q)*rr*.87);
          ctx.lineTo(Math.cos(q)*rr*1.12,Math.sin(q)*rr*1.12);
          ctx.lineWidth=2;ctx.strokeStyle=c[0];ctx.stroke();
        }
      }
      if(e.kind==='sword'){
        ctx.rotate(e.dir);
        ctx.beginPath();ctx.ellipse(r*.42,0,r*.72,r*.33,0,-1.15,1.15);
        ctx.lineWidth=clamp(r*.15,6,20);ctx.strokeStyle=c[1];ctx.stroke();
        ctx.beginPath();ctx.ellipse(r*.42,0,r*.72,r*.33,0,-1.15,1.15);
        ctx.lineWidth=3;ctx.strokeStyle=c[0];ctx.stroke();
      }else if(e.kind==='shield'){
        ctx.beginPath();ctx.arc(0,-r*.18,r*(.3+.42*growth),Math.PI,TAU);
        ctx.lineWidth=10*e.scale;ctx.strokeStyle=c[1];ctx.stroke();
        ctx.beginPath();ctx.arc(0,-r*.18,r*(.3+.42*growth),Math.PI,TAU);
        ctx.lineWidth=3;ctx.strokeStyle=c[0];ctx.stroke();
      }else if(e.kind==='arrow'){
        ctx.rotate(e.dir);
        for(let j=-1;j<=1;j++){
          ctx.beginPath();ctx.moveTo(-r*.2,j*r*.17);
          ctx.quadraticCurveTo(r*.2,j*r*.26,r*.92,j*r*.07);
          ctx.lineWidth=j===0?7:3;ctx.strokeStyle=c[j===0?0:1];ctx.stroke();
        }
      }else{
        const n=reduced?6:16;
        for(let j=0;j<n;j++){
          const angle=e.seed+j*TAU/n+t*(e.kind==='spirit'?-2:2);
          const d=r*(.14+.7*growth)*(j%3===0?.65:1);
          const px=Math.cos(angle)*d,py=Math.sin(angle)*d;
          ctx.beginPath();ctx.arc(px,py,(j%4+1)*e.scale,0,TAU);
          ctx.fillStyle=c[j%3];ctx.fill();
        }
      }
      ctx.restore();
    }
  }
  return {emit,draw,clear(){effects.length=0;},get count(){return effects.length;},
    get max(){return max;}};
}
return {create,COLORS,ALIASES};
});
