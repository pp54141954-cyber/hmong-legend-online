/* Hmong Legend V2.0 — Grand Skill VFX (visual only, opt-in).
 * Original procedural 2D pixel-glow effects; inspired by large magic circles,
 * sword crescents and layered impacts, not copied sprite frames.
 * World-coordinate renderer. Never affects collision, network, damage or skills.
 * Usage: const fx = HLGrandVFX.create({ quality:'auto' });
 *        fx.emit({kind:'sword', x:300,y:400,dir:'E',tier:2});
 *        fx.draw(canvas2DContext,deltaSeconds);
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.HLGrandVFX=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const TAU=Math.PI*2, PI=Math.PI;
const PALETTES={
 sword:['#fffdf1','#ffe272','#ff9938','#b44a20'],
 ice:['#f7ffff','#9fecff','#448fff','#533bea'],
 arrow:['#f3ffe0','#9eff91','#50d9af','#286a7a'],
 arcane:['#fff2ff','#cb8fff','#8966ee','#3a5ba6'],
 shield:['#fffdf3','#ffe786','#f1b754','#a9793e'],
 spirit:['#e2fff7','#88ffe0','#53dcb4','#6f6ee4'],
 fire:['#fff6d0','#ffd268','#ff783e','#e84459'],
 assassin:['#fbf0ff','#d5a4ff','#a768e8','#613bc4'],
 default:['#ffffff','#a7ddff','#7096e9','#4766a9']
};
const CLASSES={
 'นักดาบ':'sword','นักธนู':'arrow','ผู้ใช้มนตรา':'arcane',
 'ผู้พิทักษ์':'shield','ผู้สืบวิญญาณ':'spirit','ผู้รักษา':'spirit',
 'นักฆ่า':'assassin','มือสังหาร':'assassin','นักรบ':'sword'
};
const DIR={E:0,S:PI/2,W:PI,N:-PI/2};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const frac=x=>x-Math.floor(x);
const rng=x=>frac(Math.sin(x*127.1+78.233)*43758.5453);
const valid=x=>typeof x==='number'&&Number.isFinite(x);
function create(options={}){
  const q=options.quality||'auto';
  const reduced=!!options.reducedMotion;
  const mobile=options.mobile===true||
    (q==='auto'&&typeof navigator!=='undefined'&&(
      /Android|iPhone|iPad/i.test(navigator.userAgent||'')||
      (navigator.deviceMemory&&navigator.deviceMemory<=4)));
  const low=q==='low'||(q==='auto'&&mobile);
  const max=low?14:q==='high'?54:30;
  const effects=[];let id=0;
  const specs={sword:74,ice:88,arrow:74,arcane:98,shield:88,spirit:88,fire:85,assassin:82,default:76};
  function emit(o={}){
    if(!valid(o.x)||!valid(o.y))return false;
    const kind=PALETTES[o.kind]?o.kind:CLASSES[o.cls]||'default';
    const tier=clamp(Math.floor(Number(o.tier)||1),1,3);
    const radius=clamp((Number(o.radius)||specs[kind])*(tier===3?1.43:tier===2?1.15:1),24,230);
    const duration=clamp(Number(o.duration)||(.68+(tier-1)*.18),.25,2.5);
    const count=reduced?7:low?11:tier===3?32:22;
    if(effects.length>=max)effects.shift();
    const e={id:++id,kind,x:o.x,y:o.y,dir:DIR[o.dir]??0,
      age:0,duration,radius,tier,particles:[]};
    for(let i=0;i<count;i++){
      const a=i*TAU/count+rng(id+i)*.37;
      const p= .24+rng(id*19+i*7)*.82;
      e.particles.push({a,r:p,size:1+rng(i*11+id)*2.8,life:.4+rng(i*3+id)*.6,
        spin:rng(i+id*13)>.5?1:-1});
    }
    effects.push(e);return true;
  }
  function ring(ctx,rx,ry,w,color,alpha=1){
    ctx.globalAlpha*=alpha;ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,TAU);
    ctx.lineWidth=w;ctx.strokeStyle=color;ctx.stroke();ctx.globalAlpha/=alpha;
  }
  function runes(ctx,e,p,colors){
    const r=e.radius*(.28+.48*smooth(p*1.9));
    ctx.save();ctx.rotate(p*1.7+(e.id%4)*.11);
    ring(ctx,r,r*.47,1.5,colors[2],.7);
    for(let i=0;i<12;i++){
      const a=i*TAU/12,x=Math.cos(a)*r,y=Math.sin(a)*r*.47;
      ctx.save();ctx.translate(x,y);ctx.rotate(a);
      ctx.fillStyle=colors[i%3===0?0:1];ctx.fillRect(-2,-2,i%3===0?10:5,3);
      ctx.fillRect(-1,-6,2,12);ctx.restore();
    }
    ctx.restore();
  }
  function burst(ctx,e,p,colors){
    const t=smooth(clamp((p-.15)/.54,0,1)),r=e.radius;
    ctx.save();ctx.rotate(e.dir);
    for(let i=0;i<16;i++){
      const a=i*TAU/16,dist=r*(.18+.8*t),b=Math.sin(a)*.58;
      ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.13,Math.sin(a)*r*.09);
      ctx.lineTo(Math.cos(a)*dist,Math.sin(a)*dist*.59);
      ctx.lineWidth=i%4===0?4:2;
      ctx.strokeStyle=colors[i%4===0?0:2];ctx.globalAlpha=(1-p)*.7;ctx.stroke();
      const x=Math.cos(a)*dist,y=Math.sin(a)*dist*.59;
      ctx.fillStyle=colors[i%2];ctx.fillRect(x-2,y-2,i%3===0?8:4,3);
    }
    ctx.restore();ctx.globalAlpha=1;
  }
  function sword(ctx,e,p,colors,icy){
    const u=smooth(clamp((p-.08)*3.2,0,1));
    ctx.save();ctx.rotate(e.dir);
    for(let i=0;i<2;i++){
      const shift=i*.13,phase=clamp((u-shift)/(1-shift),0,1);
      const rx=e.radius*(.65+i*.12),ry=e.radius*(.33+i*.08);
      ctx.save();ctx.translate(e.radius*.26,0);ctx.rotate(-.54+phase*1.04);
      ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,-1.65,1.37);
      ctx.lineWidth=icy?12-i*4:15-i*5;ctx.strokeStyle=colors[2-i];ctx.globalAlpha=.5;ctx.stroke();
      ctx.lineWidth=3+i;ctx.strokeStyle=colors[0];ctx.globalAlpha=.97;ctx.stroke();
      ctx.restore();
    }
    // Pixelated crystals or gold shards fly in the attack direction.
    for(let i=0;i<7;i++){
      const x=e.radius*(.2+u*.9)+i*6,y=Math.sin(i*4.3)*e.radius*.30;
      ctx.fillStyle=colors[i%3];ctx.fillRect(x-5,y-2,10+i%3*3,4);
    }
    ctx.restore();
  }
  function shield(ctx,e,p,colors){
    const r=e.radius,open=smooth(clamp(p*3.4,0,1));
    ctx.save();ctx.translate(0,-r*.21);
    ring(ctx,r*.58*open,r*.72*open,8,colors[1],.9);
    ring(ctx,r*.69*open,r*.82*open,2,colors[0],.9);
    // Two guardian wings: four feathers each, not copied from the reference art.
    for(const side of [-1,1]){
      ctx.save();ctx.scale(side,1);
      for(let i=0;i<4;i++){
        const x=r*(.1+i*.14),y=-r*(.24+i*.10)*open;
        ctx.beginPath();ctx.moveTo(0,r*.14);ctx.quadraticCurveTo(x*.45,y,x,y-r*.05);
        ctx.lineWidth=9-i*1.5;ctx.strokeStyle=colors[i%2?0:1];ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  function arcane(ctx,e,p,colors){
    const r=e.radius,s=smooth(p*2.6);
    for(let l=0;l<3;l++){
      ctx.save();ctx.rotate((l%2?-1:1)*p*(1.5+l*.6)+l*.3);
      ring(ctx,r*(.26+l*.19)*s,r*(.13+l*.10)*s,5-l,colors[l],.72);
      for(let j=0;j<6;j++){
        const a=j*TAU/6,dx=Math.cos(a)*r*(.26+l*.19)*s,dy=Math.sin(a)*r*(.13+l*.10)*s;
        ctx.fillStyle=colors[(j+l)%3];ctx.fillRect(dx-2,dy-2,5,5);
      }
      ctx.restore();
    }
    burst(ctx,e,p,colors);
  }
  function spirit(ctx,e,p,colors){
    const r=e.radius;
    for(let i=0;i<9;i++){
      const a=i*TAU/9+p*2,dist=r*(.16+.55*smooth(p*2))*(.6+rng(i+e.id)*.4);
      const x=Math.cos(a)*dist,y=Math.sin(a)*dist*.50-r*(.16+.15*p);
      ctx.beginPath();ctx.moveTo(x,y+12);ctx.quadraticCurveTo(x+Math.sin(p*9+i)*12,y-6,x,y-18-r*.08);
      ctx.lineWidth=4+i%3;ctx.strokeStyle=colors[i%3];ctx.stroke();
    }
    runes(ctx,e,p,colors);
  }
  function arrow(ctx,e,p,colors){
    const r=e.radius,s=smooth(clamp((p-.07)*2.9,0,1));
    ctx.save();ctx.rotate(e.dir);
    for(let i=-2;i<=2;i++){
      const y=i*9,x=-r*.36+s*r*(.8-Math.abs(i)*.09);
      ctx.beginPath();ctx.moveTo(x-r*.46,y*1.6);ctx.quadraticCurveTo(x-r*.12,y+Math.sin(p*10+i)*6,x+r*.23,y);
      ctx.lineWidth=i===0?7:3;ctx.strokeStyle=colors[Math.abs(i)%3];ctx.stroke();
      ctx.beginPath();ctx.moveTo(x+r*.23,y);ctx.lineTo(x+r*.08,y-6);
      ctx.moveTo(x+r*.23,y);ctx.lineTo(x+r*.08,y+6);
      ctx.lineWidth=3;ctx.strokeStyle=colors[0];ctx.stroke();
    }
    ctx.restore();
  }
  function particles(ctx,e,p,colors){
    for(let i=0;i<e.particles.length;i++){
      const a=e.particles[i],t=p/a.life;
      if(t>=1)continue;
      const d=e.radius*a.r*(.12+.86*smooth(t)),spin=a.a+a.spin*p*.72;
      const x=Math.cos(spin)*d,y=Math.sin(spin)*d*.52-e.radius*.12*t;
      ctx.globalAlpha=Math.max(0,.86*(1-t));
      ctx.fillStyle=colors[i%3];
      ctx.fillRect(Math.round(x),Math.round(y),Math.round(a.size)*2,Math.round(a.size)*2);
    }
    ctx.globalAlpha=1;
  }
  function draw(ctx,dt){
    if(!ctx||typeof ctx.save!=='function')return;
    dt=clamp(valid(dt)?dt:0,0,.1);
    for(let i=effects.length-1;i>=0;i--){
      const e=effects[i];e.age+=dt;
      if(e.age>=e.duration){effects.splice(i,1);continue;}
      const p=e.age/e.duration,alpha=Math.pow(1-p,1.16);
      const c=PALETTES[e.kind];
      ctx.save();ctx.translate(e.x,e.y);
      ctx.globalCompositeOperation='lighter';ctx.globalAlpha=alpha*.9;
      ctx.shadowBlur=low?4:13;ctx.shadowColor=c[1];
      const grow=.22+.73*smooth(clamp(p*2.5,0,1));
      // Floor circle: ellipse is intentional for 3/4 top-down game perspective.
      ring(ctx,e.radius*grow,e.radius*grow*.46,low?3:5,c[1],.7);
      ring(ctx,e.radius*grow*.88,e.radius*grow*.41,1.6,c[0],.9);
      if(e.kind==='sword'||e.kind==='assassin'||e.kind==='ice')sword(ctx,e,p,c,e.kind==='ice');
      else if(e.kind==='shield')shield(ctx,e,p,c);
      else if(e.kind==='arrow')arrow(ctx,e,p,c);
      else if(e.kind==='spirit')spirit(ctx,e,p,c);
      else arcane(ctx,e,p,c);
      if(e.tier>1&&e.kind!=='arcane'&&e.kind!=='spirit')runes(ctx,e,p,c);
      if(e.tier===3)burst(ctx,e,p,c);
      particles(ctx,e,p,c);
      ctx.restore();
    }
  }
  return {emit,draw,clear(){effects.length=0;},get count(){return effects.length;},
    get max(){return max;},get lowQuality(){return low;}};
}
return {create,PALETTES,CLASSES};
});
