import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const base=process.env.AGENTCRAFT_TEST_BASE_URL??'http://localhost:8791';
const output=resolve(import.meta.dirname,'../screenshots');mkdirSync(output,{recursive:true});
const browser=await chromium.launch();
const report={base,checkedAt:new Date().toISOString(),desktop:[],edgePositions:[],preview:null,fixtures:[],errors:[],externalRequests:[]};
const errors=report.errors;
function observe(page){
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('requestfailed',r=>errors.push(`${r.url()}: ${r.failure()?.errorText}`));
  page.on('request',r=>{if(!r.url().startsWith(base)&&/^https?:/.test(r.url()))report.externalRequests.push(r.url());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()}: ${r.url()}`);});
}
async function json(page,key){return JSON.parse((await page.locator('#game').getAttribute(`data-${key}`))||'null');}
async function sceneryScreenshot(page,name){
  const png=await page.screenshot({path:resolve(output,name)});
  // Inspect the actual rendered pixels for the old, unpainted camera background.
  const edge=await page.evaluate(async encoded=>{
    const image=new Image();image.src=`data:image/png;base64,${encoded}`;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const c=canvas.getContext('2d');c.drawImage(image,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;
    let maxBlankRun=0,blankSamples=0,samples=0;
    for(const horizontal of [true,false])for(const fixed of [8,(horizontal?canvas.height:canvas.width)-9]){
      let run=0;
      for(let moving=0;moving<(horizontal?canvas.width:canvas.height);moving+=2){
        const x=horizontal?moving:fixed,y=horizontal?fixed:moving,index=(y*canvas.width+x)*4;
        const blank=pixels[index]===156&&pixels[index+1]===198&&pixels[index+2]===195;
        run=blank?run+2:0;maxBlankRun=Math.max(maxBlankRun,run);blankSamples+=Number(blank);samples++;
      }
    }
    return {maxBlankRun,blankSamples,samples};
  },png.toString('base64'));
  assert.ok(edge.maxBlankRun<72,`${name}: unpainted background along screen edge (${edge.maxBlankRun}px)`);
  return edge;
}
async function coreVisible(page,width,height){
  const state=await json(page,'state');assert.equal(state.render.coreBuildings.length,6);
  assert.ok(state.render.zoom<=state.render.maxZoom+1e-6);
  for(const b of state.render.coreBuildings){assert.ok(b.x>=315&&b.x+b.width<=width-24,`${width}: ${b.id} horizontal`);assert.ok(b.y>=100&&b.y+b.height<=height-130,`${width}: ${b.id} vertical`);}
  return {zoom:state.render.zoom,maxZoom:state.render.maxZoom,allSixVisible:true};
}
async function ready(page){await page.goto(base);await page.waitForFunction(()=>document.querySelector('#game')?.dataset.ready==='true');await page.waitForTimeout(400);}
async function atlas(page){await page.keyboard.press('m');await page.waitForFunction(()=>JSON.parse(document.querySelector('#game').dataset.state).atlas);await page.waitForTimeout(180);}
async function context(width=1366,height=768,seen=true){
  const ctx=await browser.newContext({viewport:{width,height}});
  if(seen)await ctx.addInitScript(()=>localStorage.setItem('agentcraft.home.preview.seen','1'));
  const page=await ctx.newPage();observe(page);return {ctx,page};
}
async function seed(page,passed,position){
  await page.goto(`${base}/favicon.svg`);
  await page.evaluate(async ({passed,position})=>{
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('agentcraft',1);req.onupgradeneeded=()=>req.result.createObjectStore('saves');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const experiments=position?{'exploration.v3':{...position,collected:[],awakened:false,trials:0,visited:[]}}:{};
    await new Promise((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put({progress:Object.fromEntries(passed.map(chapterId=>[chapterId,{chapterId,passed:true,updatedAt:1}])),experiments,updatedAt:1},'progress.v1');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  },{passed,position});
}
try{
  for(const [width,height]of [[1280,720],[1366,768],[1920,1080],[2560,1440],[3440,1440],[3840,1080],[5120,1440]]){
    const {ctx,page}=await context(width,height);await ready(page);
    const home=await json(page,'home');assert.equal(home.completed,0);assert.equal(home.simulationReady,false);
    const initialFrame=await coreVisible(page,width,height);
    const initialScenery=await sceneryScreenshot(page,`home-initial-${width}.png`);
    await page.mouse.move(800,350);await page.mouse.wheel(0,-20000);await page.waitForTimeout(200);
    const maxFrame=await coreVisible(page,width,height);assert.ok(Math.abs(maxFrame.zoom-maxFrame.maxZoom)<1e-6);
    await page.mouse.move(320,120);await page.waitForFunction(()=>!document.querySelector('#game').dataset.hover);
    const maxScenery=await sceneryScreenshot(page,`home-core-limit-${width}.png`);
    await atlas(page);await page.mouse.move(320,120);
    const state=await json(page,'state');
    for(const r of state.regions){assert.ok(r.label.x>=315&&r.label.x<width-16,`${width}: ${r.id} label x`);assert.ok(r.label.y>92&&r.label.y<height-95,`${width}: ${r.id} label y`);}
    const atlasScenery=await sceneryScreenshot(page,`home-atlas-${width}.png`);
    const repair=state.regions.find(r=>r.id==='repair-lab');await page.mouse.move(repair.label.x,repair.label.y);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#game').dataset.hover||'null')?.id==='repair-lab');
    const hover=await json(page,'hover');assert.equal(hover.status,'locked');assert.ok(hover.x+hover.width<=width-16);assert.ok(hover.y+hover.height<=height-82);
    await page.screenshot({path:resolve(output,`home-tooltip-${width}.png`)});
    const overflow=await page.evaluate(()=>({x:document.documentElement.scrollWidth>innerWidth,y:document.documentElement.scrollHeight>innerHeight}));
    assert.deepEqual(overflow,{x:false,y:false});report.desktop.push({width,height,completed:home.completed,unlocked:state.regions.filter(r=>r.unlocked).map(r=>r.id),initialFrame,maxFrame,atlasZoom:state.render.zoom,surroundings:{initial:initialScenery,maximum:maxScenery,atlas:atlasScenery},labelBounds:true,tooltipBounds:true,overflow});await ctx.close();
  }
  for(const [width,height]of [[3840,1080],[5120,1440]])for(const position of [{x:48,y:2000},{x:3024,y:48}]){
    const {ctx,page}=await context(width,height);await seed(page,[],position);await ready(page);
    const before=await json(page,'state');assert.ok(Math.hypot(before.x-position.x,before.y-position.y)<96,'edge fixture must restore near the intended map edge');
    await page.mouse.move(800,350);await page.mouse.wheel(0,20000);await page.waitForTimeout(220);
    await coreVisible(page,width,height);await page.mouse.move(320,120);
    const pixels=await sceneryScreenshot(page,`home-edge-${width}-${position.x}-${position.y}.png`);
    const after=await json(page,'state');assert.equal((await json(page,'home')).completed,0);
    report.edgePositions.push({width,height,requested:position,actual:{x:after.x,y:after.y},zoom:after.render.zoom,surroundings:pixels,source:'seeded walkable exploration position; no chapter progress'});await ctx.close();
  }
  const {ctx,page}=await context(1366,768,false);await ready(page);
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#game').dataset.intro||'null')?.active);
  const start=await json(page,'state'),started=Date.now();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#game').dataset.intro||'null')?.index===1);
  await page.waitForTimeout(700);
  await coreVisible(page,1366,768);
  const previewScenery=await sceneryScreenshot(page,'home-first-preview.png');
  await page.waitForFunction(()=>document.querySelector('#game').dataset.intro==='',null,{timeout:15000});
  const finish=await json(page,'state'),home=await json(page,'home');
  assert.equal(home.completed,0);assert.deepEqual([finish.x,finish.y],[start.x,start.y]);assert.equal(finish.presentation,'explore');assert.deepEqual(finish.chapters.filter(c=>c.unlocked).map(c=>c.id),['C1']);
  const elapsedSeconds=(Date.now()-started)/1000;assert.ok(elapsedSeconds>=8&&elapsedSeconds<=12);
  report.preview={elapsedSeconds,positionPreserved:true,completed:0,unlocked:['C1'],presentation:finish.presentation,surroundings:previewScenery};await ctx.close();
  for(const passed of [['C1','C2','C3'],['C1','C2','C3','C4','C5','C6']]){
    const {ctx,page}=await context();await seed(page,passed);await ready(page);await atlas(page);await page.mouse.move(320,120);
    const home=await json(page,'home');assert.equal(home.completed,passed.length);assert.equal(home.simulationReady,passed.length===6);
    const statuses=[...new Set(home.modules.map(m=>m.status))];
    assert.deepEqual(new Set(statuses),new Set(passed.length===6?['completed']:['current','available','completed','locked']));
    await page.screenshot({path:resolve(output,passed.length===6?'home-complete-fixture.png':'home-four-states.png')});
    report.fixtures.push({savedChapters:passed,completed:home.completed,statuses,simulationReady:home.simulationReady,source:'seeded saved progress, not new teaching implementation'});await ctx.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(report.externalRequests,[]);
}finally{writeFileSync(resolve(output,'home-desktop-checks.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify(report,null,2));
