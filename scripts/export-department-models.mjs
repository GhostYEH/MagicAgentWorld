/** Export the exact code-native 2.5D models used by the game. Start dev:web first. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root=resolve(import.meta.dirname,'..'), out=join(root,'screenshots','部门建模');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(process.env.AGENTCRAFT_ART_URL??'http://localhost:5173');
  await page.waitForFunction(()=>document.getElementById('game')?.dataset.ready==='true');
  const exported=await page.evaluate(async()=>{
    const {drawDepartmentBuilding}=await import('/src/game/HarnessArchitecture.ts');
    const {BUILDINGS,DEPARTMENTS}=await import('/src/game/WorldMap.ts');
    const sheet=document.createElement('canvas');sheet.width=1800;sheet.height=1300;
    const c=sheet.getContext('2d');c.fillStyle='#e4eee4';c.fillRect(0,0,1800,1300);
    const models=[];
    for(const [i,d]of DEPARTMENTS.entries()){
      const b=BUILDINGS.find(b=>b.id===d.id),texture=document.createElement('canvas');
      texture.width=b.width+160;texture.height=b.height+b.elevation+220;
      const tc=texture.getContext('2d');drawDepartmentBuilding(tc,{...b,x:80,y:b.elevation+160});
      const pixels=tc.getImageData(0,0,texture.width,texture.height).data;
      let edgeAlpha=0;
      for(let x=0;x<texture.width;x++)edgeAlpha+=pixels[x*4+3]+pixels[((texture.height-1)*texture.width+x)*4+3];
      for(let y=0;y<texture.height;y++)edgeAlpha+=pixels[y*texture.width*4+3]+pixels[(y*texture.width+texture.width-1)*4+3];
      const cx=i%3*600,cy=Math.floor(i/3)*640,scale=.7;
      c.fillStyle='#faf5e6';c.beginPath();c.roundRect(cx+18,cy+18,564,600,18);c.fill();
      c.drawImage(texture,cx+(600-texture.width*scale)/2,cy+500-texture.height*scale,texture.width*scale,texture.height*scale);
      c.textAlign='center';c.fillStyle='#365e77';c.font='bold 24px "AgentCraft Sans",sans-serif';c.fillText(d.name,cx+300,cy+530);
      c.fillStyle='#73929f';c.font='15px "AgentCraft Sans",sans-serif';c.fillText(d.code+' / '+d.role,cx+300,cy+567);
      models.push({id:d.id,name:d.name,image:texture.toDataURL('image/png'),edgeAlpha,footprint:{u:b.u,v:b.v},size:{width:texture.width,height:texture.height}});
    }
    return {sheet:sheet.toDataURL('image/png'),models};
  });
  for(const m of exported.models){
    if(m.edgeAlpha!==0)throw new Error(`Model clipped at canvas edge: ${m.id}`);
    writeFileSync(join(out,m.id+'.png'),Buffer.from(m.image.split(',')[1],'base64'));
  }
  writeFileSync(join(out,'六部门模型总览.png'),Buffer.from(exported.sheet.split(',')[1],'base64'));
  writeFileSync(join(out,'manifest.json'),JSON.stringify(exported.models.map(({image,...m})=>m),null,2));
  console.log(`Exported ${exported.models.length} models with transparent margins: ${out}`);
} finally {await browser.close();}
