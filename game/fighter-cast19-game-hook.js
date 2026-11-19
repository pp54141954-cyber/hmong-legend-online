/* Hmong Legend V2 — approved nineteen-frame male Fighter casting poses.
 * VISUAL ONLY, opt-in via ?fightercast19=1. Never alters combat or movement.
 * Owner's explicit order: S 17,18,19,20,21; N 13,14,15,16;
 * W 6,7,8,9,10,11; E 1,2,3,4. Original points 5 and 12 excluded.
 * Asset: sprites/fighter_cast19_user.webp, 1752x1280, 6 columns x 4 rows.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.HLFighter19Cast=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const CW=292,CH=320,R=Object.freeze({S:0,N:1,W:2,E:3});
 const LENGTH=Object.freeze({S:5,N:4,W:6,E:4});
 const POINTS=Object.freeze({
   S:[17,18,19,20,21],N:[13,14,15,16],
   W:[6,7,8,9,10,11],E:[1,2,3,4]
 });
 const CENTER=Object.freeze({
   S:[124,129.5,166.5,142,179.5],
   N:[178.5,136,171,178.5],
   W:[119.5,135,164,138,178.5,178.5],
   E:[170,127.5,153.5,170]
 });
 const FOOT=Object.freeze({
   S:[290,288,289,289,289],
   N:[283,282,282,283],
   W:[269,269,271,271,271,271],
   E:[242,241,241,242]
 });
 const TIMES=Object.freeze({
   4:[0,.24,.50,.77],
   5:[0,.17,.36,.57,.79],
   6:[0,.12,.27,.43,.61,.80]
 });
 const im=typeof Image==='function'?new Image():null;
 let ready=false,failed=false,installed=false,draws=0,attempts=0;
 let originalDraw=null,last=null;
 if(im){
   im.decoding='async';
   im.onload=()=>{ready=im.naturalWidth===CW*6&&im.naturalHeight===CH*4;failed=!ready};
   im.onerror=()=>{ready=false;failed=true};
 }
 function setSource(url){
   if(!im)return false;
   ready=false;failed=false;im.src=url||'sprites/fighter_cast19_user.webp';return true;
 }
 function selectFrame(dir,progress){
   const d=Object.prototype.hasOwnProperty.call(LENGTH,dir)?dir:'S';
   const p=Math.min(1,Math.max(0,Number.isFinite(progress)?progress:0));
   let i=0;
   for(let j=1;j<TIMES[LENGTH[d]].length;j++)if(p>=TIMES[LENGTH[d]][j])i=j;
   return i;
 }
 function drawFrame(ctx,dir,i,x,y,scale){
   if(!ready||!ctx||!Number.isFinite(x)||!Number.isFinite(y))return false;
   const d=Object.prototype.hasOwnProperty.call(LENGTH,dir)?dir:'S';
   const index=Math.max(0,Math.min(LENGTH[d]-1,Math.floor(Number(i)||0)));
   const sc=Math.max(.1,Math.min(4,Number(scale)||1));
   ctx.save();
   ctx.imageSmoothingEnabled=false;
   ctx.drawImage(im,index*CW,R[d]*CH,CW,CH,
     x-CENTER[d][index]*sc,y-FOOT[d][index]*sc,CW*sc,CH*sc);
   ctx.restore();
   draws++;last={slot:last?.slot??null,dir:d,frame:index,originalPoint:POINTS[d][index]};
   return true;
 }
 function intercept(image,args,ctx){
   attempts++;
   try{
     if(!ready||args.length!==9||!root?.HL)return false;
     const H=root.HL,PS=H.PS,player=H.player,cast=PS?.cast;
     if(!player||!cast||!Number.isInteger(cast.key)||
       cast.key<3||cast.key>11||PS.look?.g==='f'||
       typeof H.curCls!=='function'||H.curCls()!=='นักสู้')return false;
     const atk=typeof H.classAtk==='function'?H.classAtk('นักสู้',PS.look):null;
     if(!atk||atk.img!==image)return false;
     // Native drawAtk4() renders a translucent afterimage before the main actor.
     // Keep that afterimage native, replacing the single opaque actor only.
     if(ctx.globalCompositeOperation&&ctx.globalCompositeOperation!=='source-over')return false;
     if(typeof ctx.globalAlpha==='number'&&ctx.globalAlpha<.99)return false;
     const [x,y,w,h]=args.slice(5);
     if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)return false;
     const actorX=x+w/2,actorFeet=y+h-4*h/124;
     if(Math.abs(actorX-player.x)>Math.max(8,h*.15)||
       Math.abs(actorFeet-player.y)>Math.max(9,h*.2))return false;
     const p=cast.sk?.poseT>0?cast.t/cast.sk.poseT:0;
     const dir=Object.prototype.hasOwnProperty.call(LENGTH,player.dir)?player.dir:'S';
     const frame=selectFrame(dir,p);
     last={slot:cast.key,dir,frame,originalPoint:POINTS[dir][frame]};
     return drawFrame(ctx,dir,frame,actorX,actorFeet,h/236);
   }catch(e){return false} // fail closed, let game draw original actor
 }
 function installGameHook(){
   if(installed)return true;
   const canvas=typeof document==='object'&&document.getElementById('c');
   const ctx=canvas?.getContext('2d');
   if(!ctx||typeof ctx.drawImage!=='function')return false;
   originalDraw=ctx.drawImage;
   ctx.drawImage=function(...args){
     if(intercept(args[0],args,this))return;
     return originalDraw.apply(this,args);
   };
   installed=true;return true;
 }
 function autoInstall(){
   if(typeof document==='undefined'||root?.HLFighter19CastManual)return;
   setSource(root?.HLFighter19CastAtlasURL||'sprites/fighter_cast19_user.webp');
   if(installGameHook())return;
   let tries=0;(function tick(){
     if(installGameHook()||tries++>180)return;
     if(typeof requestAnimationFrame==='function')requestAnimationFrame(tick);
   })();
 }
 autoInstall();
 return Object.freeze({
   LENGTH,POINTS,selectFrame,drawFrame,setSource,installGameHook,
   get ready(){return ready},get failed(){return failed},
   get installed(){return installed},get draws(){return draws},
   get last(){return last&&{...last}},get interceptAttempts(){return attempts}
 });
});
