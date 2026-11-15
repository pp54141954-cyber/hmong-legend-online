/* Hmong Legend — optional grand VFX bridge, no changes to game combat logic.
 * Reads existing emitted fx objects and projects them with the same world matrix
 * as #c (captured without changing the native canvas draw results).
 */
(function(){
'use strict';
if(!window.HLGrandVFX || window.HLGrandStage)return;
const base=document.getElementById('c');
if(!base)return;
const gameCtx=base.getContext('2d');
if(!gameCtx)return;
const overlay=document.createElement('canvas');
overlay.id='hl-grand-vfx-layer';
overlay.setAttribute('aria-hidden','true');
overlay.style.cssText='position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2;display:block;';
document.body.appendChild(overlay);
const ctx=overlay.getContext('2d',{alpha:true});
const motion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer=window.HLGrandVFX.create({quality:'auto',reducedMotion:motion});
const nativeSetTransform=gameCtx.setTransform;
let worldMatrix=null,seen=new WeakSet(),last=0,lastKey='',lastEvent=0;
let captureWorld=true,sawFrameReset=false;
gameCtx.setTransform=function(...args){
  if(captureWorld&&args.length>=6&&args.slice(0,6).every(v=>typeof v==='number'&&Number.isFinite(v))) {
    const [a,b,c,d,e,f]=args;
    // Game draw(): reset to identity, clear the screen, then apply the world
    // camera transform. Capture only that FIRST matrix per render frame.
    // Later HUD matrices (often device-pixel-ratio scale) must not replace it.
    if(a===1&&b===0&&c===0&&d===1&&e===0&&f===0)sawFrameReset=true;
    else if(sawFrameReset&&a>0&&d>0&&Math.abs(a-d)<.00001&&b===0&&c===0){
      worldMatrix=[a,b,c,d,e,f];
      captureWorld=false;
    }
  }
  return nativeSetTransform.apply(this,args);
};
const n=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
function detectKind(e,cls){
  const sk=e.sk||{},k=String(e.k||'');
  const col=String(e.col||sk.color||'').toLowerCase();
  if(k.includes('ice')||k.includes('frost')||/#[0-9a-f]{6}/.test(col)&&col.startsWith('#8f'))return'ice';
  if(k==='redarc'||k==='bigseal'||k==='seal'&&col.includes('ff5'))return'fire';
  if(k==='cheal')return'spirit';
  if(k==='ctrap'||k==='cboom')return'arcane';
  if(k==='streak'||k==='trail')return cls==='นักธนู'?'arrow':'sword';
  if(k==='sigil'&&cls==='ผู้พิทักษ์')return'shield';
  return window.HLGrandVFX.CLASSES[cls]||'default';
}
function track(){
  const H=window.HL;
  if(!H||!Array.isArray(H.fxList))return;
  const player=H.player,cls=typeof H.curCls==='function'?H.curCls():'';
  const arr=H.fxList;
  for(let i=0;i<arr.length;i++){
    const e=arr[i];
    if(!e||typeof e!=='object'||seen.has(e))continue;
    seen.add(e);
    if(!e.k || !n(e.t) || e.t<=0)continue;
    // All effects must originate from the game's real fx list, so locked
    // skills and unavailable actions do not fabricate visual explosions.
    const sk=e.sk||{};
    const x=n(e.x)?e.x:player&&player.x;
    const y=n(e.y)?e.y:player&&player.y-14;
    if(!n(x)||!n(y))continue;
    const kind=detectKind(e,cls);
    const range=Number(sk.radius)||Number(sk.range)||0;
    const tier=range>=180||Number(sk.mult)>=3.4?3:range>=100||Number(sk.mult)>=1.9?2:1;
    const radius=clamp((Number(e.r)||range*.45||72),45,tier===3?180:120);
    // Multi-hit skills create many tiny fx entries; group same-origin bursts.
    const key=kind+':'+Math.round(x/42)+':'+Math.round(y/42);
    const now=performance.now();
    if(key===lastKey&&now-lastEvent<95)continue;
    lastKey=key;lastEvent=now;
    renderer.emit({kind,cls,x,y,dir:e.dir||(player&&player.dir)||'S',radius,tier});
  }
}
function size(){
  const r=base.getBoundingClientRect();
  if(!r.width||!r.height)return false;
  if(overlay.width!==base.width)overlay.width=base.width;
  if(overlay.height!==base.height)overlay.height=base.height;
  overlay.style.left=r.left+'px';overlay.style.top=r.top+'px';
  overlay.style.width=r.width+'px';overlay.style.height=r.height+'px';
  overlay.style.visibility=getComputedStyle(base).visibility;
  return true;
}
function frame(time){
  requestAnimationFrame(frame);
  if(!size())return;
  const dt=last?clamp((time-last)/1000,0,.06):.016;last=time;
  track();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,overlay.width,overlay.height);
  // World coordinates already include 3/4 projection in the main canvas.
  if(worldMatrix)ctx.setTransform(...worldMatrix);
  renderer.draw(ctx,dt);
  captureWorld=true;sawFrameReset=false;
}
requestAnimationFrame(frame);
window.HLGrandStage={
  get enabled(){return true},
  get count(){return renderer.count},
  get quality(){return renderer.lowQuality?'mobile':'full'},
  emit: e=>renderer.emit(e),
  clear: ()=>renderer.clear(),
  get worldMatrix(){return worldMatrix&&worldMatrix.slice()},
  layer:overlay
};
})();
