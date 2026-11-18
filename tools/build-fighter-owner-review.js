// Build a self-contained owner-review file from the ACTUAL repository sprite assets.
// This is a visual-review tool, not a replacement for real server gameplay.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const sourceDir=path.join(root,'game','sprites');
const files=['pcl_fighter_m','pcl_fighter_f','pca_fighter_m','pca_fighter_f',
             'skfx_fighter','skfxud_fighter','tiger_walk'];
const assets={};
for(const name of files){
 const file=path.join(sourceDir,name+'.webp');
 if(!fs.existsSync(file))throw Error('Missing approved source sprite: '+file);
 const bytes=fs.readFileSync(file);
 if(bytes.length<32||bytes.toString('ascii',0,4)!=='RIFF'||
    bytes.toString('ascii',8,12)!=='WEBP')throw Error('Not a valid WebP: '+file);
 assets[name]='data:image/webp;base64,'+bytes.toString('base64');
}
const template=fs.readFileSync(path.join(__dirname,'fighter-owner-review.template.html'),'utf8');
const engine=fs.readFileSync(path.join(root,'game','fighter-vfx-real.js'),'utf8');
for(const marker of ['__ASSETS__','__ENGINE__']){
 if(template.split(marker).length!==2)throw Error('Unexpected template marker: '+marker);
}
if(/<\/script/i.test(engine))throw Error('Unexpected closing script tag in effect engine');
const html=template.replace('__ASSETS__',JSON.stringify(assets).replace(/</g,'\\u003c'))
  .replace('__ENGINE__',engine);
if(/<script\b[^>]*src\s*=/i.test(html))throw Error('External JavaScript dependency in offline reviewer');
const dir=path.join(root,'dist');fs.mkdirSync(dir,{recursive:true});
const output=path.join(dir,'Hmong_Legend_Fighter_9_Skills_Approved_Character_Review.html');
fs.writeFileSync(output,html,'utf8');
console.log('OFFLINE_REVIEW_BUILT',path.relative(root,output),'bytes',Buffer.byteLength(html),'assets',files.length);
