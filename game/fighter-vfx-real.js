/* Hmong Legend V2.0 — Fighter production-style visual sequence.
 * 9 approved active skills, world-coordinate visuals over the ACTUAL player sprite.
 * Never changes character files, movement, collision, skill cooldown, damage,
 * server state, WebSocket messages or equipment. Visual module only.
 * Sprite references: existing game/sprites/tiger_walk.webp and fighter player
 * already drawn by game/index.html's classBody('นักสู้', look) / drawClassCast().
 */
(function(root,factory){
 const exports=factory();
 if(typeof module==='object'&&module.exports)module.exports=exports;
 if(root)root.HLFighterRealVFX=exports;
})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const PI=Math.PI,TAU=2*PI;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const DIRECTIONS={S:[0,1],N:[0,-1],W:[-1,0],E:[1,0]};
const ANGLE={E:0,S:PI/2,W:PI,N:-PI/2};
const SKILLS=[
 {slot:3,name:'หมัดเจาะเกราะ',kind:'pierce',path:'หมัดทะลวง',hue:'orange',size:95},
 {slot:4,name:'ชุดหมัดสะเทือน',kind:'combo',path:'หมัดทะลวง',hue:'orange',size:108},
 {slot:5,name:'หมัดทลายปฐพี',kind:'ground',path:'หมัดทะลวง',hue:'orange',size:175},
 {slot:6,name:'อาคมหนังเหล็ก',kind:'armor',path:'กายาเหล็ก',hue:'blue',size:125},
 {slot:7,name:'ตั้งกายรับแรง',kind:'guard',path:'กายาเหล็ก',hue:'blue',size:140},
 {slot:8,name:'ทุ่มพสุธา',kind:'throw',path:'กายาเหล็ก',hue:'blue',size:150},
 {slot:9,name:'แปลงร่างสัตว์ร้าย',kind:'transform',path:'สัตว์ร้ายอาคม',hue:'pink',size:172},
 {slot:10,name:'จู่โจมสัตว์ร้าย',kind:'pounce',path:'สัตว์ร้ายอาคม',hue:'pink',size:190},
 {slot:11,name:'สัญชาตญาณดุร้าย',kind:'roar',path:'สัตว์ร้ายอาคม',hue:'pink',size:230}
];
const COLOR={
 orange:['#fff7ce','#ffd36b','#ff872c','#af4625'],
 blue:['#f2ffff','#a8d8ff','#5688dd','#42558d'],
 pink:['#fff0fd','#ff9ccb','#eb4a99','#8b3578']
};
function create(options={}){
 const mobile=options.mobile===true||(/Android|iPhone|iPad/.test((typeof navigator!=='undefined'&&navigator.userAgent)||''));
 const reduced=!!options.reducedMotion;
 const quality=options.quality||'auto';
 const low=quality==='low'||(quality==='auto'&&mobile);
 const max=low?8:16;
 const items=[], active=new WeakSet();let timer=0;
 let tiger=null,tigerReady=false,tigerPink=null;
 // Approved FIGHTER source atlas: 9 rows x 5 poses, transparent EFFECTS ONLY.
 // Keep existing player sprites pca/pcl_fighter unmodified.
 let approvedSide=null,approvedDownUp=null,sideReady=false,downUpReady=false;
 // Cache only the few 300x300 recolored frames visible in the current fight.
 // Prior approach copied the entire 1500x5400 atlas (~31 MiB RGBA) permanently.
 // The approved source image itself remains entirely unchanged.
 const tintCache=new Map(),tintCacheLimit=low?6:12;
 let tintReady=false,tintedFrameCount=0;
 function tintedDirectionalFrame(im,row,frame,hue){
  if(hue==='orange'||!tintReady)return null;
  const key=hue+':'+row+':'+frame;
  if(tintCache.has(key)){
    const cached=tintCache.get(key);tintCache.delete(key);tintCache.set(key,cached);
    return cached;
  }
  const canvas=document.createElement('canvas');canvas.width=300;canvas.height=300;
  const c=canvas.getContext('2d',{alpha:true});if(!c)return null;
  c.clearRect(0,0,300,300);
  c.drawImage(im,frame*300,row*300,300,300,0,0,300,300);
  c.globalCompositeOperation='source-atop';
  c.fillStyle=hue==='pink'?'rgba(246,67,164,.92)':'rgba(86,172,255,.86)';
  c.fillRect(0,0,300,300);
  c.globalCompositeOperation='source-over';
  if(tintCache.size>=tintCacheLimit)tintCache.delete(tintCache.keys().next().value);
  tintCache.set(key,canvas);
  tintedFrameCount++;
  return canvas;
 }
 let lastFrame=null,drawsFromAtlas=0;
 function prepareAtlas(sideUrl,downUpUrl){
  if(typeof Image==='undefined')return;
  if(sideUrl&&!approvedSide){
   approvedSide=new Image();approvedSide.decoding='async';
   approvedSide.onload=()=>{sideReady=approvedSide.naturalWidth===1600&&approvedSide.naturalHeight===1800};
   approvedSide.onerror=()=>{sideReady=false};
   approvedSide.src=sideUrl;
  }
  if(downUpUrl&&!approvedDownUp){
   approvedDownUp=new Image();approvedDownUp.decoding='async';
   approvedDownUp.onload=()=>{
    downUpReady=approvedDownUp.naturalWidth===1500&&approvedDownUp.naturalHeight===5400;
    tintReady=downUpReady&&typeof document!=='undefined'&&
      !!document.createElement('canvas').getContext('2d');
    tintCache.clear();
   };
   approvedDownUp.onerror=()=>{downUpReady=false};
   approvedDownUp.src=downUpUrl;
  }
 }
 function follow(cast,x,y){
  if(!cast||!finite(x)||!finite(y))return;
  const e=items.find(v=>v.cast===cast);
  if(e){e.x=x;e.y=y}
 }
 function drawApproved(ctx,e,frame,age){
  const vertical=e.dir==='N'||e.dir==='S';
  const im=vertical?(downUpReady?approvedDownUp:null):(sideReady?approvedSide:null);
  if(!im)return false;
  const row=e.spec.slot-3+(vertical&&e.dir==='N'?9:0);
  const cw=vertical?300:320,ch=vertical?300:200;
  const anchorX=vertical?150:70,anchorY=vertical?200:172;
  // Match the exact FIGHTER storyboard pose row, not invented circles.
  // Side-view FIGHTER chart is reused without cropping source files.
  const scale=vertical?.78:.98;
  ctx.save();
  ctx.translate(e.x,e.y+16);
  ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha*=frame===4?Math.max(.12,1-age*.55):frame===0?.68:1;
  ctx.imageSmoothingEnabled=true;
  ctx.scale(e.dir==='W'?-scale:scale,scale);
  // Recolor only this approved directional cell, never a full-sized atlas.
  const tinted=vertical?tintedDirectionalFrame(im,row,frame,e.spec.hue):null;
  if(tinted)ctx.drawImage(tinted,0,0,cw,ch,-anchorX,-anchorY,cw,ch);
  else ctx.drawImage(im,frame*cw,row*ch,cw,ch,-anchorX,-anchorY,cw,ch);
  ctx.restore();
  // The reference FIGHTER board has a side-view pink tiger. For N/S gameplay
  // use the game's approved 4-direction tiger walk silhouette instead of
  // showing an unrelated gold ring without the beast.
  if(vertical&&e.spec.hue==='pink'&&tigerReady){
    ctx.save();ctx.translate(e.x,e.y+3);ctx.globalAlpha=.92;
    ctx.globalCompositeOperation='lighter';
    tigerSprite(ctx,e,Math.min(1,age/.8),COLOR.pink);
    ctx.restore();
  }
  drawsFromAtlas++;
  lastFrame={slot:e.spec.slot,frame,dir:e.dir,source:vertical?'approved-updown':'approved-side'};
  return true;
 }
 function prepare(absoluteUrl){
  if(typeof Image==='undefined'||!absoluteUrl||tiger)return;
  tiger=new Image();tiger.decoding='async';
  tiger.onload=()=>{
    tigerReady=tiger.naturalWidth>0;
    if(tigerReady&&typeof document!=='undefined'){
      // Make a NON-DESTRUCTIVE pink spiritual projection of the actual approved
      // tiger monster sprite. Keep the original WebP unchanged on disk.
      const tinted=document.createElement('canvas');
      tinted.width=tiger.naturalWidth;tinted.height=tiger.naturalHeight;
      const t=tinted.getContext('2d',{alpha:true});
      if(t){
        t.imageSmoothingEnabled=false;t.drawImage(tiger,0,0);
        t.globalCompositeOperation='source-atop';
        t.fillStyle='rgba(255,65,168,.53)';
        t.fillRect(0,0,tinted.width,tinted.height);
        tigerPink=tinted;
      }
    }
  };
  tiger.onerror=()=>{tigerReady=false};
  tiger.src=absoluteUrl;
 }
 function start(data){
  const spec=SKILLS[Number(data?.slot)-3];
  if(!spec||!finite(data.x)||!finite(data.y)||!data.cast||typeof data.cast!=='object')return false;
  if(active.has(data.cast))return false;
  active.add(data.cast);
  if(items.length>=max)items.shift();
  items.push({spec,cast:data.cast,dir:DIRECTIONS[data.dir]?data.dir:'S',
   x:data.x,y:data.y,baseX:data.x,baseY:data.y,
   targetX:finite(data.targetX)?data.targetX:data.x,targetY:finite(data.targetY)?data.targetY:data.y,
   poseT:Math.max(.1,Number(data.poseT)||.45),releaseAt:-1,age:0,tier:spec.slot%3===2?3:spec.slot%3===1?2:1});
  return true;
 }
 function circle(ctx,x,y,r,ry,c,w=3){
  ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,r),Math.max(.1,ry),0,0,TAU);
  ctx.strokeStyle=c;ctx.lineWidth=w;ctx.stroke();
 }
 function arc(ctx,x,y,r,start,end,col,w){
  ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),start,end);
  ctx.strokeStyle=col;ctx.lineWidth=w;ctx.stroke();
 }
 function star(ctx,x,y,s,col){
  ctx.fillStyle=col;ctx.fillRect(x-s*.5,y-s*.5,s,s);
  ctx.fillRect(x-s*1.6,y-s*.18,s*3.2,s*.36);
  ctx.fillRect(x-s*.18,y-s*1.7,s*.36,s*3.4);
 }
 function ground(ctx,r,p,c){
  let a=.35+.68*smooth(p);
  circle(ctx,0,0,r*a,r*a*.34,c[2],6);
  circle(ctx,0,0,r*a*.8,r*a*.25,c[0],2);
  for(let i=0;i<16;i++){
   const ang=i*TAU/16,dis=r*a*(.6+(i%3)*.13);
   ctx.beginPath();
   ctx.moveTo(Math.cos(ang)*dis*.44,Math.sin(ang)*dis*.18);
   ctx.lineTo(Math.cos(ang)*dis*.71+Math.sin(i*3)*7,Math.sin(ang)*dis*.25);
   ctx.lineTo(Math.cos(ang)*dis,Math.sin(ang)*dis*.36);
   ctx.lineWidth=i%4===0?5:2.5;ctx.strokeStyle=c[i%3===0?0:2];ctx.stroke();
  }
 }
 function shock(ctx,r,p,c){
  for(let l=0;l<3;l++){
   const progress=clamp((p-l*.12)/(.85-l*.12),0,1);
   circle(ctx,0,0,r*(.18+.85*smooth(progress)),r*(.1+.3*smooth(progress)),c[l],5-l);
  }
 }
 function fist(ctx,r,p,c,count){
  const repeat=count||1;
  for(let i=0;i<repeat;i++){
   const q=clamp((p-i*.15)*3.4,0,1);
   if(q<=0)continue;
   const x=(.08+.85*smooth(q))*r,y=(i%2?1:-1)*r*.12;
   ctx.save();ctx.translate(x,y);
   circle(ctx,0,0,11+24*q,7+15*q,c[i%3],3+4*(1-q));
   for(let j=0;j<4;j++){
    ctx.beginPath();ctx.moveTo(-10,-12+j*7);ctx.lineTo(12+4*q,-12+j*7);
    ctx.lineWidth=3;ctx.strokeStyle=c[0];ctx.stroke();
   }
   ctx.restore();
  }
 }
 function shield(ctx,r,p,c){
  let s=.7+.26*smooth(p*2);
  ctx.save();ctx.scale(s,s);
  ctx.beginPath();ctx.ellipse(0,-r*.36,r*.49,r*.7,0,PI*1.06,TAU*1.94);
  ctx.strokeStyle=c[1];ctx.lineWidth=12;ctx.stroke();
  ctx.strokeStyle=c[0];ctx.lineWidth=2.5;ctx.stroke();
  for(let k=-3;k<=3;k++){
   const x=k*r*.13,y=-r*.76+Math.abs(k)*r*.09;
   ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+k*3,-r*.35);
   ctx.strokeStyle=c[2];ctx.lineWidth=3;ctx.stroke();
  }
  ctx.restore();
 }
 function armor(ctx,r,p,c){
  circle(ctx,0,-r*.41,r*.53,r*.68,c[1],6);
  circle(ctx,0,-r*.41,r*.6,r*.76,c[0],2);
  for(let i=0;i<9;i++){
   const a=i*TAU/9,rr=r*.53;
   const x=Math.cos(a)*rr,y=-r*.4+Math.sin(a)*rr*.8;
   star(ctx,x,y,4+(i%3)*2,c[i%3]);
  }
  for(let i=0;i<5;i++){
   const h=(i*13+5)%43,x=(i-2)*r*.23;
   ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-9,-h-r*.35);ctx.lineTo(x+1,-h-r*.58);
   ctx.strokeStyle=c[0];ctx.lineWidth=i%2?2.5:4;ctx.stroke();
  }
 }
 function rocks(ctx,r,p,c){
  const release=smooth(p);
  for(let i=0;i<13;i++){
   const a=i*TAU/13,dist=r*(.16+.8*release),x=Math.cos(a)*dist,y=Math.sin(a)*dist*.3;
   const h=8+20*(1-release)+(i%3)*7;
   ctx.save();ctx.translate(x,y-h);
   ctx.beginPath();ctx.moveTo(-7,5);ctx.lineTo(-12,-4);ctx.lineTo(-2,-13);
   ctx.lineTo(11,-7);ctx.lineTo(13,5);ctx.closePath();
   ctx.fillStyle=c[3];ctx.fill();ctx.strokeStyle=c[1];ctx.lineWidth=2;ctx.stroke();ctx.restore();
  }
 }
 function tigerShape(ctx,r,p,c){
  ctx.save();
  ctx.translate(0,-r*.48);
  ctx.lineWidth=9;ctx.strokeStyle=c[2];
  // Spirit-beast mane crest accompanying the approved player, not a new player model.
  ctx.beginPath();ctx.moveTo(-r*.6,-r*.08);ctx.lineTo(-r*.43,-r*.58);
  ctx.lineTo(-r*.14,-r*.4);ctx.quadraticCurveTo(0,-r*.51,r*.14,-r*.4);
  ctx.lineTo(r*.43,-r*.58);ctx.lineTo(r*.6,-r*.08);
  ctx.quadraticCurveTo(r*.53,r*.46,0,r*.54);ctx.quadraticCurveTo(-r*.53,r*.46,-r*.6,-r*.08);
  ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle=c[0];ctx.stroke();
  ctx.beginPath();ctx.moveTo(-r*.35,-r*.02);ctx.lineTo(-r*.1,r*.04);
  ctx.moveTo(r*.35,-r*.02);ctx.lineTo(r*.1,r*.04);
  ctx.strokeStyle=c[0];ctx.lineWidth=6;ctx.stroke();
  ctx.restore();
 }
 function tigerSprite(ctx,e,p,c){
  if(!tigerReady)return tigerShape(ctx,e.spec.size,p,c);
  const row={S:0,N:1,W:2,E:3}[e.dir]||0;
  const w=tiger.naturalWidth/4,h=tiger.naturalHeight/4;
  const fr=clamp(Math.floor((e.age*7)%4),0,3);
  let scale=e.spec.kind==='roar'?1.24:e.spec.kind==='pounce'?1.08:1;
  const dw=150*scale,dh=150*scale;
  ctx.save();ctx.globalAlpha*=.64;
  ctx.shadowBlur=12;ctx.shadowColor=c[2];
  ctx.drawImage(tigerPink||tiger,fr*w,row*h,w,h,-dw/2,-dh+22,dw,dh);
  // Pink spirit aura emphasizes transformation without altering source sprites.
  ctx.globalCompositeOperation='lighter';circle(ctx,0,-dh*.48,dw*.44,dh*.34,c[2],6);
  ctx.restore();
 }
 function render(ctx,e,phase,t){
  const c=COLOR[e.spec.hue],r=e.spec.size;
  ctx.save();ctx.translate(e.x,e.y);
  ctx.globalCompositeOperation='lighter';ctx.globalAlpha*=Math.max(0,1-t*.86);
  ctx.shadowBlur=low?7:15;ctx.shadowColor=c[2];ctx.lineCap='round';ctx.lineJoin='round';
  if(e.spec.kind==='pierce'||e.spec.kind==='combo'){
   ctx.save();ctx.rotate(ANGLE[e.dir]);const mult=e.spec.kind==='combo'?4:1;
   fist(ctx,r,t,c,mult);shock(ctx,r*.69,t,c);ctx.restore();
  }else if(e.spec.kind==='ground'){
   ground(ctx,r,t,c);rocks(ctx,r,t,c);shock(ctx,r,t,c);
  }else if(e.spec.kind==='armor'){
   armor(ctx,r,t,c);
  }else if(e.spec.kind==='guard'){
   shield(ctx,r,t,c);shock(ctx,r*.83,t,c);
  }else if(e.spec.kind==='throw'){
   ground(ctx,r*.8,t,c);rocks(ctx,r*.9,t,c);shield(ctx,r*.56,t,c);
  }else if(e.spec.kind==='transform'){
   tigerSprite(ctx,e,t,c);circle(ctx,0,0,r*(.3+.42*smooth(t)),r*(.12+.19*smooth(t)),c[2],5);
   for(let k=0;k<12;k++){let a=k*TAU/12+t*3;star(ctx,Math.cos(a)*r*.65,Math.sin(a)*r*.32-r*.25,4,c[k%3]);}
  }else if(e.spec.kind==='pounce'){
   const d=DIRECTIONS[e.dir];
   ctx.save();ctx.rotate(ANGLE[e.dir]);
   for(let k=-1;k<=1;k++){
    const y=k*r*.14;ctx.beginPath();ctx.moveTo(-r*.9,y-r*.1);
    ctx.quadraticCurveTo(0,y-r*.2,r*.8,y+Math.sin(t*7)*8);
    ctx.strokeStyle=c[k===0?0:2];ctx.lineWidth=k===0?7:4;ctx.stroke();
   }
   ctx.restore();tigerSprite(ctx,e,t,c);shock(ctx,r*.8,t,c);
  }else if(e.spec.kind==='roar'){
   tigerSprite(ctx,e,t,c);shock(ctx,r,t,c);
   tigerShape(ctx,r*.54,t,c);
  }
  if(phase==='windup'){
   circle(ctx,0,0,r*.38,r*.16,c[1],3);
   for(let k=0;k<6;k++){const a=TAU*k/6-t;
    star(ctx,Math.cos(a)*r*.3,Math.sin(a)*r*.12-r*.22,4,c[k%3]);}
  }
  ctx.restore();
 }
 function draw(ctx,dt){
  if(!ctx)return;
  dt=clamp(finite(dt)?dt:0,0,.07);timer+=dt;
  for(let k=items.length-1;k>=0;k--){
   const e=items[k];e.age+=dt;
   if(e.cast&&e.cast.done&&e.releaseAt<0)e.releaseAt=e.age;
   const p=e.cast?clamp(e.cast.t/e.poseT,0,1):1;
   const phase=e.releaseAt<0?(p<.25?'ready':p<.6?'windup':'action'):
     e.age-e.releaseAt<.66?'release':'recover';
   const life=e.releaseAt<0?0:e.age-e.releaseAt;
   if(life>1.05){items.splice(k,1);continue;}
   const t=e.releaseAt<0?Math.max(0,p*.45):clamp(life/.9,0,1);
   // 00 READY 01 WIND-UP 02 ACTION 03 RELEASE 04 RECOVER
   // Show the approved source image frame only once and avoid invented
   // giant rings that previously obscured the character and HUD.
   const frame=e.releaseAt<0?(p<.18?0:p<.39?1:2):(life<.49?3:4);
   ctx.save();ctx.globalAlpha=e.releaseAt<0?.82:1;
   drawApproved(ctx,e,frame,life); // Native chart handles loading fallback.
   ctx.restore();
  }
 }
 return {start,prepare,prepareAtlas,follow,draw,clear(){items.length=0;},get count(){return items.length},
   get max(){return max;},get specs(){return SKILLS.slice();},get tigerReady(){return tigerReady},
   get approvedSideReady(){return sideReady},get approvedDownUpReady(){return downUpReady},get directionalColorReady(){return tintReady},
   get directionalTintCacheCount(){return tintCache.size},get directionalTintCacheLimit(){return tintCacheLimit},
   get directionalTintFramePixels(){return 300*300},get tintedFrameCount(){return tintedFrameCount},
   get drawsFromAtlas(){return drawsFromAtlas},get lastFrame(){return lastFrame&&{...lastFrame}}};
}
return {create,SKILLS,COLOR};
});
