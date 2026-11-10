// ไฟล์นี้สร้างอัตโนมัติจาก game/index.html โดย tools/extract-shared.js — ห้ามแก้ด้วยมือ
'use strict';
const T=32,COLS=48,ROWS=32,W=COLS*T,H=ROWS*T;
const hh=(x,y,s)=>{let n=(x*374761393+y*668265263+(s||0)*982451653)|0;n=Math.imul(n^(n>>>13),1274126177);return(((n^(n>>>16))>>>0)/4294967295)};
const inb=(x,y)=>x>=0&&y>=0&&x<COLS&&y<ROWS;
const GR=0,PA=1,WA=2,BR=3,ST=4,CR=5,BD=6,CV=7,CF=8,EX=9;
const ZONES={
 village:{name:'หมู่บ้านเริ่มต้น',safe:(tx,ty)=>tx<=20&&ty>=8&&ty<=24,treeEdge:.55,treeIn:.13,sakura:0,
  layout(A){
   A.h(0,0,COLS,32,1);A.h(0,0,COLS,6,2);A.h(23,0,25,10,2);A.h(23,17,25,15,0);A.h(0,25,23,7,0);A.h(21,17,2,15,0);
   const L=(p,w)=>A.line(p,w,PA);
   L([[5,3],[19,3]],2);L([[24,3],[42,3]],2);L([[36,4],[36,9]],2);L([[5,3],[5,9]],2);L([[5,9],[5,13]],2);L([[5,13],[19,13]],2);A.rect(7,13,7,4,PA);L([[9,16],[9,24]],2);
   L([[23,14],[44,14]],2);L([[30,15],[30,23]],2);L([[30,23],[34,23]],2);L([[33,23],[33,26]],2);L([[9,27],[9,29]],2);L([[9,29],[46,29]],2);L([[43,12],[43,14]],2);
   L([[10,9],[10,12]],1);L([[3,12],[3,13]],1);L([[16,13],[16,14]],1);L([[3,17],[3,18]],1);L([[16,18],[16,18]],1);L([[3,22],[3,23]],1);L([[3,23],[9,23]],1);L([[25,21],[25,23]],1);L([[25,23],[30,23]],1);
   A.rect(21,0,2,29,WA);A.rect(21,27,27,2,WA);A.rect(21,3,2,2,BR);A.rect(21,14,2,2,BR);A.rect(33,27,2,2,BR);
  },
  border(A){A.rect(21,0,2,1,WA);A.rect(46,27,2,2,WA);A.rect(47,29,1,2,EX);A.rect(46,29,1,2,PA)},
  stairs:[[5,6,2,2],[9,25,2,2],[30,17,2,2],[36,10,2,2]],cave:[44,10],
  exits:[{x:47,y:29,w:1,h:2,to:'field',tx:2,ty:15,label:'ทุ่งมอนสเตอร์'}],
  objects(A){
   [[2,10],[8,10],[14,11],[2,15],[15,16],[2,20]].forEach(([x,y],i)=>A.add('house',x,y,4,2,{v:i}));
   A.add('mill',24,19,4,2);A.add('wheel',22,19,1,2);A.add('stall',11,17,3,1);A.add('fire',9,14,1,1);
   A.add('pillar',8,23,1,1);A.add('pillar',11,23,1,1);A.deco('banner',8,24*T);
   A.add('tower',2,3,3,2);A.add('tent',27,2,3,2);A.add('flag',32,5,1,1);
   A.add('stone',35,1,1,1);A.add('stone',39,1,1,1);A.add('stone',37,1,1,1,{big:1});
   for(let x=13;x<=18;x++){A.add('fence',x,20,1,1,{d:'h'});if(x!==15&&x!==16)A.add('fence',x,24,1,1,{d:'h'})}
   for(let y=21;y<=23;y++){A.add('fence',13,y,1,1,{d:'v'});A.add('fence',18,y,1,1,{d:'v'})}
   A.rect(14,21,4,3,CR)},
  decor(o){o.strokeStyle='#8fd3ff';o.lineWidth=3;o.beginPath();o.ellipse(37.5*T,3*T,40,18,0,0,7);o.stroke();o.fillStyle='rgba(120,200,255,.25)';o.fill()},
  /* มอนสเตอร์อ่อนนอกเขตปลอดภัยของหมู่บ้าน (keepTrees: ไม่ตัดต้นไม้เดิม) */keepTrees:1,
  spawns:[{type:'กระต่ายมีเขา',tx:27,ty:12,count:3},{type:'หมูป่า',tx:40,ty:22,count:3},{type:'ไก่ฟ้า',tx:30,ty:6,count:2}],start:[11.5*T,15.6*T]},
 field:{name:'ทุ่งมอนสเตอร์',safe:()=>false,treeEdge:.6,treeIn:.16,sakura:.12,
  layout(A){
   A.h(0,0,COLS,32,0);A.h(0,0,18,10,2);A.h(0,10,18,11,1);A.h(18,0,30,8,2);A.h(18,8,30,11,1);
   A.h(18,0,2,8,2);A.h(18,8,2,11,1);A.h(18,19,2,13,0);
   const L=(p,w)=>A.line(p,w,PA);
   L([[1,14],[17,14]],2);L([[8,12],[8,14]],2);L([[8,3],[8,9]],2);L([[3,4],[17,4]],2);L([[6,16],[6,20]],2);L([[6,23],[6,27]],2);L([[6,27],[17,27]],2);
   L([[20,14],[33,14]],2);L([[30,10],[30,13]],2);L([[30,3],[30,7]],2);L([[20,4],[40,4]],2);L([[33,12],[43,12]],2);L([[44,10],[44,12]],1);
   L([[24,15],[24,18]],2);L([[24,21],[24,23]],2);L([[20,22],[27,22]],2);L([[40,13],[40,18]],2);L([[40,21],[40,27]],2);L([[30,23],[46,23]],2);L([[28,22],[30,22]],2);
   L([[20,28],[26,28]],2);
   A.rect(18,0,2,27,WA);A.rect(18,25,12,2,WA);A.rect(28,25,2,7,WA);
   A.rect(18,4,2,2,BR);A.rect(18,14,2,2,BR);A.rect(18,22,2,2,BR);A.rect(24,25,2,2,BR);
  },
  border(A){A.rect(18,0,2,1,WA);A.rect(28,31,2,1,WA);A.rect(0,14,1,2,EX);A.rect(1,14,1,2,PA)},
  stairs:[[8,10,2,2],[6,21,2,2],[30,8,2,2],[24,19,2,2],[40,19,2,2]],cave:[44,8],
  exits:[{x:0,y:14,w:1,h:2,to:'village',tx:45,ty:29.6,label:'หมู่บ้านเริ่มต้น'}],
  objects(A){
   A.add('portalGate',37,1,3,2);A.add('stone',35,2,1,1);A.add('stone',41,2,1,1);
   A.add('crystal',42,9,1,1);A.add('crystal',46,10,1,1);A.add('rock',12,7,1,1);A.add('rock',27,17,1,1)},
  decor(o){o.fillStyle='rgba(120,200,255,.25)';o.beginPath();o.ellipse(38.5*T,3.6*T,44,14,0,0,7);o.fill();o.strokeStyle='#8fd3ff';o.lineWidth=2;o.stroke()},
  spawns:[{type:'หมาป่า',tx:8,ty:6,count:3},{type:'หมูป่า',tx:5,ty:12,count:3},{type:'กระต่ายมีเขา',tx:12,ty:18,count:2},
   {type:'ก็อบลิน',tx:10,ty:25,count:2},{type:'เสือ',tx:27,ty:12,count:1},{type:'หมีเขา',tx:41,ty:14,count:1},
   {type:'โกเลมหิน',tx:32,ty:3,count:1},{type:'กระทิงผี',tx:23,ty:23,count:1},{type:'วิญญาณไม้',tx:40,ty:26,count:1}],
  start:[2.5*T,15*T]}
};

function buildGrid(id){
 const D=ZONES[id];
 const hgt=Array.from({length:ROWS},()=>Array(COLS).fill(0)),g=Array.from({length:ROWS},()=>Array(COLS).fill(GR));
 const objs=[],blocked=new Set();
 const set=(x,y,v)=>{if(inb(x,y))g[y][x]=v};
 const A={
  h:(x,y,w,h2,v)=>{for(let j=y;j<y+h2;j++)for(let i=x;i<x+w;i++)if(inb(i,j))hgt[j][i]=v},
  rect:(x,y,w,h2,v)=>{for(let j=y;j<y+h2;j++)for(let i=x;i<x+w;i++)set(i,j,v)},
  line:(pts,w,v)=>{for(let k=0;k<pts.length-1;k++){const[a,b]=pts[k],[c,d]=pts[k+1];for(let x=Math.min(a,c);x<=Math.max(a,c);x++)for(let y=Math.min(b,d);y<=Math.max(b,d);y++)A.rect(x,y,w,w,v)}},
  add:(type,x,y,fw,fh,extra)=>{for(let j=y;j<y+fh;j++)for(let i=x;i<x+fw;i++)blocked.add(i+','+j);objs.push(Object.assign({type,x,y,fw,fh,base:(y+fh)*T},extra||{}))},
  deco:(type,x,base)=>objs.push({type,x,y:0,base,fw:0,fh:0})
 };
 D.layout(A);
 for(let x=0;x<COLS;x++){set(x,0,BD);set(x,ROWS-1,BD)}for(let y=0;y<ROWS;y++){set(0,y,BD);set(COLS-1,y,BD)}
 D.border(A);
 const face=(x,y)=>inb(x,y-1)&&(hgt[y-1][x]>hgt[y][x]||(inb(x,y-2)&&hgt[y-2][x]>hgt[y][x]&&hgt[y-1][x]===hgt[y][x]&&face(x,y-1)));
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const t=g[y][x];if(t===WA||t===BD||t===EX)continue;
  const hi=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>inb(x+dx,y+dy)&&hgt[y+dy][x+dx]>hgt[y][x]);if(face(x,y)||hi)set(x,y,CF)}
 D.stairs.forEach(([x,y,w,h2])=>A.rect(x,y,w,h2,ST));
 if(D.cave)A.rect(D.cave[0],D.cave[1],2,2,CV);
 D.objects(A);
 const near=(x,y,r)=>{for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){if(!inb(x+i,y+j))continue;if(g[y+j][x+i]!==GR||blocked.has((x+i)+','+(y+j)))return true}return false};
 const spawnTiles=new Set();(D.keepTrees?[]:(D.spawns||[])).forEach(s=>{for(let j=-3;j<=3;j++)for(let i=-4;i<=4;i++)spawnTiles.add((s.tx+i)+','+(s.ty+j))});
 for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++){if(g[y][x]!==GR||blocked.has(x+','+y)||spawnTiles.has(x+','+y))continue;
  const e=Math.min(x-1,COLS-2-x,y-1,ROWS-2-y),r=hh(x,y,1);
  if(r<(e<2?D.treeEdge:D.treeIn)&&!near(x,y,1))A.add('tree',x,y,1,1,{v:hh(x,y,2),sak:hh(x,y,8)<D.sakura});
  else if(hh(x,y,3)<.02&&!near(x,y,1))A.add('rock',x,y,1,1)}
 for(let x=0;x<COLS;x++)for(const y of[0,ROWS-1])if(g[y][x]===BD&&hh(x,y,4)<.7)objs.push({type:'tree',x,y,base:(y+1)*T,v:hh(x,y,5),fw:0,fh:0});
 for(let y=1;y<ROWS-1;y++)for(const x of[0,COLS-1])if(g[y][x]===BD&&hh(x,y,6)<.8)objs.push({type:'tree',x,y,base:(y+1)*T,v:hh(x,y,7),fw:0,fh:0});
 const isFace=(x,y)=>inb(x,y)&&g[y][x]===CF&&face(x,y);
 return {id,D,g,hgt,blocked};
}
const BLOCKT=new Set([WA,CF,BD,CR]);
const CFG={
 player:{baseHP:100,hpPerLv:12,baseAtk:12,atkPerLv:3,maxLv:100,maxJob:50,skillUnlockJob:30,respawnSec:3,regenSafe:8,speed:110},
 expCurve:lv=>Math.floor(40*Math.pow(lv,1.5)),jobCurve:lv=>Math.floor(25*Math.pow(lv,1.4)),
 basic:{name:'ท่าพื้นฐาน',shape:'arc',mult:1,range:44,arc:1.6,cd:.45,pose:[0,1],poseT:.22,src:'CSV'},
 /* นักดาบจากตาราง CSV: ชื่อ สาย ขั้น เลเวลปลดล็อก (ถือเป็น Job Lv) และระดับสูงสุด มาจากไฟล์
    รูปแบบท่า ตัวคูณ ระยะ และคูลดาวน์ ตาราง CSV ไม่มี จึงเป็นค่าชั่วคราว
    สกิล 3/4/5 ตามบอร์ด = ลำดับที่ 3/4/5 ของท่ากดทั้ง 9 ในตาราง */
 skills:[
  {name:'ท่าเคลื่อนที่',path:'เริ่มต้น',tier:0,job:1,max:10,shape:'move',dist:80,cd:3,pose:[0],poseT:.2},
  {name:'ท่าป้องกัน',path:'เริ่มต้น',tier:0,job:1,max:10,shape:'guard',red:.5,dur:2,cd:8,pose:[0],poseT:.2},
  {name:'ลงอาคมคมดาบ',path:'ดาบอาคม',tier:0,job:3,max:10,shape:'buff',bonus:.2,dur:8,cd:15,pose:[0],poseT:.3},
  {name:'ฟันประทับตรา',path:'ดาบอาคม',tier:1,job:10,max:5,shape:'mark',mult:2,range:56,arc:1.8,markDur:5,markBonus:.15,cd:6,pose:[0,1],poseT:.3},
  {name:'ปลุกคมอาคม',path:'ดาบอาคม',tier:2,job:25,max:3,shape:'wave',mult:3.2,range:300,width:72,speed:360,cd:10,pose:[0,1,3],poseT:.4,color:'#b06bff',board:'วิดีโอ SKILL 3 V6'},
  {name:'ฟันแยกศิลา',path:'ดาบทลายขุนเขา',tier:0,job:3,max:10,shape:'spikes',mult:1.2,n:5,step:36,radius:30,cd:6,pose:[0,3],poseT:.45,color:'#ff9a2e',board:'บอร์ด 4-01–4-08'},
  {name:'คลื่นดาบผาขาด',path:'ดาบทลายขุนเขา',tier:1,job:10,max:5,shape:'pillar',mult:3,dist:110,radius:46,cd:8,pose:[0,3,3],poseT:.5,color:'#5fc8ff',board:'SKILL 5 แบบ A: ปักดาบลงพื้น เสาพลังโผล่'},
  {name:'ดาบทลายขุนเขา',path:'ดาบทลายขุนเขา',tier:2,job:25,max:3,shape:'circle',fxk:'quake',board:'บอร์ด 6-01–6-08',mult:4.5,range:150,cd:16,pose:[0,3],poseT:.45},
  {name:'ก้าวตัดเงา',path:'ดาบก้าวพริบตา',tier:0,job:3,max:10,shape:'dash',mult:1.8,range:120,width:30,cd:6,pose:[0,2],poseT:.3},
  {name:'ก้าวหลบสวนคม',path:'ดาบก้าวพริบตา',tier:1,job:10,max:5,shape:'counter',back:50,mult:2.2,range:100,arc:2.2,cd:9,pose:[0,1],poseT:.35},
  {name:'พริบตาสามคม',path:'ดาบก้าวพริบตา',tier:2,job:25,max:3,shape:'tri',mult:1.6,cd:12,pose:[1,3,2,3],poseT:.55,board:'บอร์ด 9-01–9-08'}],
 /* ค่าสถานะมอนสเตอร์: ชั่วคราว ไล่ระดับตามลำดับในภาพแบบออกแบบ */
 monsters:{
  'หมูป่า':{hp:60,atk:8,exp:14,job:6,speed:70,aggro:120,leash:230,atkRange:26,atkCd:1.2,size:14,respawn:8,color:'#6e4a2c',color2:'#8a6040',tusk:1},
  'กระต่ายมีเขา':{hp:35,atk:5,exp:9,job:4,speed:85,aggro:100,leash:200,atkRange:22,atkCd:1,size:10,respawn:6,color:'#d8d4cc',color2:'#eeeae2',horn:1},
  'หมาป่า':{hp:80,atk:11,exp:20,job:8,speed:95,aggro:140,leash:240,atkRange:24,atkCd:1,size:13,respawn:9,color:'#6f7378',color2:'#8a8f95'},
  'ไก่ฟ้า':{hp:25,atk:3,exp:6,job:3,speed:90,aggro:0,leash:180,atkRange:20,atkCd:1,size:9,respawn:6,color:'#b8322a',color2:'#2f7a4a'},
  'ก็อบลิน':{hp:95,atk:13,exp:26,job:10,speed:80,aggro:130,leash:230,atkRange:24,atkCd:1.1,size:11,respawn:10,color:'#5d8a3a',color2:'#7aa64f'},
  'เสือ':{hp:180,atk:20,exp:55,job:20,speed:100,aggro:150,leash:260,atkRange:28,atkCd:1.2,size:17,respawn:15,color:'#d48a2a',color2:'#e9a64a'},
  'หมีเขา':{hp:220,atk:22,exp:65,job:24,speed:70,aggro:120,leash:220,atkRange:30,atkCd:1.5,size:19,respawn:18,color:'#6b4a2e',color2:'#83603e'},
  'โกเลมหิน':{hp:320,atk:26,exp:90,job:32,speed:50,aggro:110,leash:200,atkRange:32,atkCd:1.8,size:20,respawn:22,color:'#7d7a72',color2:'#9a978e'},
  'กระทิงผี':{hp:260,atk:24,exp:80,job:28,speed:85,aggro:130,leash:230,atkRange:30,atkCd:1.4,size:18,respawn:20,color:'#4a2a5e',color2:'#7a4aa0'},
  'ลิงป่า':{hp:110,atk:14,exp:30,job:12,speed:90,aggro:130,leash:230,atkRange:24,atkCd:1,size:12,respawn:10},
  'กวางภูเขา':{hp:120,atk:12,exp:32,job:12,speed:100,aggro:0,leash:230,atkRange:26,atkCd:1.2,size:14,respawn:10},
  'นักรบเผ่าป่า':{hp:200,atk:21,exp:60,job:22,speed:80,aggro:140,leash:240,atkRange:30,atkCd:1.3,size:13,respawn:15},
  'ปีศาจ':{hp:300,atk:27,exp:95,job:34,speed:85,aggro:150,leash:250,atkRange:30,atkCd:1.4,size:15,respawn:22},
  'วิญญาณไม้':{hp:280,atk:23,exp:85,job:30,speed:55,aggro:120,leash:210,atkRange:34,atkCd:1.6,size:19,respawn:20,color:'#6b5a32',color2:'#3fa04a'}},
 /* ===== ไอเทม (V2-R4) — ชื่อ ค่า และอัตราดรอปทั้งหมดเป็นค่าชั่วคราว รอข้อกำหนด/อนุมัติ ===== */
 bag:{slots:30,stack:99,potionCd:1},
 items:{
  potion_s:{name:'ยาสมุนไพรเล็ก',type:'use',heal:40},
  potion_m:{name:'ยาสมุนไพรกลาง',type:'use',heal:100},
  hide:{name:'หนังสัตว์',type:'mat'},
  horn:{name:'เขาสัตว์',type:'mat'},
  tusk:{name:'เขี้ยวหมูป่า',type:'mat'},
  feather:{name:'ขนไก่ฟ้า',type:'mat'},
  fang:{name:'เขี้ยวสัตว์ป่า',type:'mat'},
  ore:{name:'เศษหินแร่',type:'mat'},
  spirit:{name:'เศษวิญญาณ',type:'mat'},
  sword_wood:{name:'ดาบไม้ฝึกหัด',type:'eq',slot:'weapon',atk:4},
  sword_iron:{name:'ดาบเหล็กตีมือ',type:'eq',slot:'weapon',atk:10},
  coat_cloth:{name:'เสื้อผ้าฝ้ายปัก',type:'eq',slot:'armor',def:2,hp:20},
  coat_leather:{name:'เสื้อหนังสัตว์',type:'eq',slot:'armor',def:5,hp:45},
  charm_silver:{name:'กำไลเงิน',type:'eq',slot:'acc',hp:30,atk:2}},
 /* ตารางดรอป: [ไอเทม, โอกาส 0–1, จำนวน] ทอยแยกทีละแถว */
 drops:{
  'ไก่ฟ้า':[['feather',.6,1],['potion_s',.15,1]],
  'กระต่ายมีเขา':[['horn',.5,1],['hide',.4,1],['potion_s',.15,1],['sword_wood',.04,1]],
  'หมูป่า':[['tusk',.5,1],['hide',.5,1],['potion_s',.2,1],['coat_cloth',.05,1]],
  'หมาป่า':[['fang',.5,1],['hide',.5,1],['potion_s',.2,1],['sword_wood',.06,1]],
  'ก็อบลิน':[['ore',.4,1],['potion_s',.3,1],['coat_cloth',.06,1],['charm_silver',.03,1]],
  'เสือ':[['fang',.7,2],['hide',.6,2],['potion_m',.25,1],['coat_leather',.06,1]],
  'หมีเขา':[['hide',.7,2],['horn',.5,1],['potion_m',.3,1],['coat_leather',.07,1]],
  'โกเลมหิน':[['ore',.8,3],['potion_m',.3,1],['sword_iron',.07,1]],
  'กระทิงผี':[['horn',.6,2],['spirit',.4,1],['potion_m',.3,1],['sword_iron',.06,1]],
  'วิญญาณไม้':[['spirit',.6,2],['potion_m',.3,1],['charm_silver',.06,1]],
  'ลิงป่า':[['hide',.5,1],['potion_s',.2,1]],
  'กวางภูเขา':[['horn',.6,1],['hide',.5,1]],
  'นักรบเผ่าป่า':[['ore',.4,1],['potion_m',.25,1],['sword_iron',.05,1]],
  'ปีศาจ':[['spirit',.7,2],['potion_m',.3,1],['charm_silver',.06,1]]}
};
const Combat={
 damage(atk,mult,rnd,critRoll){const crit=critRoll<.1;return{dmg:Math.max(1,Math.round(atk*mult*(.9+.2*rnd)*(crit?1.5:1))),crit}},
 inShape(sk,range,ox,oy,dir,tx,ty){const fx={E:1,W:-1,N:0,S:0}[dir],fy={E:0,W:0,N:-1,S:1}[dir],dx=tx-ox,dy=ty-oy,d=Math.hypot(dx,dy);
  if(sk.shape==='circle')return d<=range;
  if(sk.shape==='line'||sk.shape==='spear'){const t=dx*fx+dy*fy,p=Math.abs(dx*fy-dy*fx);return t>=-8&&t<=range&&p<=sk.width/2+8}
  if(d>range)return false;if(d<6)return true;return Math.acos(Math.max(-1,Math.min(1,(dx*fx+dy*fy)/d)))<=sk.arc/2}
};
module.exports={T,COLS,ROWS,W,H,inb,TYPES:{GR,PA,WA,BR,ST,CR,BD,CV,CF,EX},BLOCKT,ZONES,buildGrid,CFG,Combat};
