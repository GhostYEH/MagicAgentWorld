import {test,expect} from '@playwright/test';
import {ready,state,seedProgress,mapPoint} from './game';
async function home(page:import('@playwright/test').Page){return JSON.parse((await page.locator('#game').getAttribute('data-home'))!);}

test('滚轮最大缩放、定位与预览始终能看到六座核心建筑',async({page})=>{
  await ready(page);
  const assertCore=async()=>{
    const s=await state(page),view=page.viewportSize()!;
    expect(s.render.zoom).toBeLessThanOrEqual(s.render.maxZoom+1e-6);
    expect(s.render.coreBuildings).toHaveLength(6);
    for(const b of s.render.coreBuildings){
      expect(b.x,`${b.id} left`).toBeGreaterThanOrEqual(315);
      expect(b.x+b.width,`${b.id} right`).toBeLessThanOrEqual(view.width-24);
      expect(b.y,`${b.id} top`).toBeGreaterThanOrEqual(100);
      expect(b.y+b.height,`${b.id} bottom`).toBeLessThanOrEqual(view.height-130);
    }
  };
  for(const [width,height]of [[1366,768],[1920,1080],[2560,1440],[1280,720]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(200);
    await page.mouse.move(800,350);await page.mouse.wheel(0,-20000);
    await expect.poll(async()=>{const s=await state(page);return Math.abs(s.render.zoom-s.render.maxZoom);}).toBeLessThan(.000001);
    await assertCore();
    await page.keyboard.down('d');await page.waitForTimeout(150);await page.keyboard.up('d');await assertCore();
  }
  const model=await home(page);await page.mouse.click(model.locate.x,model.locate.y);
  await page.waitForTimeout(750);await assertCore();
  await expect.poll(async()=>JSON.parse((await page.locator('#game').getAttribute('data-state'))!).presentation).toBe('explore');
  await page.mouse.click(model.preview.x,model.preview.y);
  await page.waitForTimeout(750);await assertCore();
  await page.keyboard.press('Escape');await assertCore();
});

test('首页定位只移动镜头，鼠标前往场馆可实际到达',async({page})=>{
  await ready(page);const start=await state(page),model=await home(page);
  expect(model.completed).toBe(0);expect(model.target.id).toBe('model-core');
  await page.mouse.click(model.locate.x,model.locate.y);
  await expect.poll(async()=>JSON.parse((await page.locator('#game').getAttribute('data-state'))!).presentation).toBe('focus');
  expect({x:(await state(page)).x,y:(await state(page)).y}).toEqual({x:start.x,y:start.y});
  await expect.poll(async()=>JSON.parse((await page.locator('#game').getAttribute('data-state'))!).presentation).toBe('explore');
  expect((await state(page)).camera.x).toBeCloseTo(start.camera.x,1);
  await page.mouse.click(model.go.x,model.go.y);
  await expect(page.locator('#game')).toHaveAttribute('data-modal','department');
  expect((await state(page)).region).toBe('大模型中枢');
  expect((await home(page)).completed).toBe(0);
});

test('悬浮卡显示前置条件，四种建筑状态使用真实存档',async({page})=>{
  await seedProgress(page,['C1','C2','C3']);await ready(page);await page.keyboard.press('m');
  const model=await home(page);expect(model.completed).toBe(3);
  expect(new Set(model.modules.map((m:{status:string})=>m.status))).toEqual(new Set(['current','available','completed','locked']));
  const repair=(await state(page)).regions.find(r=>r.id==='repair-lab')!;
  await page.mouse.move(repair.label.x,repair.label.y);
  await expect.poll(async()=>JSON.parse((await page.locator('#game').getAttribute('data-hover'))||'null')?.id).toBe('repair-lab');
  const card=JSON.parse((await page.locator('#game').getAttribute('data-hover'))!);
  expect(card.status).toBe('locked');
  await page.screenshot({path:'screenshots/home-four-states.png'});
  await page.mouse.move(card.x+40,card.y+60);await page.waitForTimeout(250);
  expect(await page.locator('#game').getAttribute('data-hover')).not.toBe('');
  await page.mouse.move(320,120);
  await expect(page.locator('#game')).toHaveAttribute('data-hover','');
});

test('悬浮卡文字区域允许点击地图，前往按钮仍可实际导航',async({page})=>{
  await ready(page);await page.keyboard.press('m');
  const tool=(await state(page)).regions.find(r=>r.id==='tool-depot')!;
  await page.mouse.move(tool.label.x,tool.label.y);
  await expect.poll(async()=>JSON.parse((await page.locator('#game').getAttribute('data-hover'))||'null')?.id).toBe('tool-depot');
  const card=JSON.parse((await page.locator('#game').getAttribute('data-hover'))!);
  const goal={x:820,y:740},road=await mapPoint(page,goal);
  expect(road.x).toBeGreaterThan(card.x);expect(road.x).toBeLessThan(card.x+card.width);
  expect(road.y).toBeGreaterThan(card.y);expect(road.y).toBeLessThan(card.y+card.height);
  await page.mouse.click(road.x,road.y);
  await expect.poll(async()=>(await state(page)).atlas).toBe(false);
  await expect(page.locator('#game')).toHaveAttribute('data-hover','');
  await expect.poll(async()=>{const s=await state(page);return Math.hypot(s.x-goal.x,s.y-goal.y);}).toBeLessThan(5);
  await page.keyboard.press('m');
  const core=(await state(page)).regions.find(r=>r.id==='model-core')!;
  await page.mouse.move(core.label.x,core.label.y);
  await expect.poll(async()=>JSON.parse((await page.locator('#game').getAttribute('data-hover'))||'null')?.id).toBe('model-core');
  const target=JSON.parse((await page.locator('#game').getAttribute('data-hover'))!);
  await page.mouse.click(target.x+target.width/2,target.y+target.height-29);
  await expect(page.locator('#game')).toHaveAttribute('data-modal','department');
  expect((await state(page)).region).toBe('大模型中枢');expect((await home(page)).completed).toBe(0);
});

test('首次流程预览可跳过，偏好被保存且不改变任何学习进度',async({page})=>{
  await page.goto('/');await expect(page.locator('#game')).toHaveAttribute('data-ready','true');
  await expect.poll(async()=>JSON.parse((await page.locator('#game').getAttribute('data-intro'))||'null')?.active).toBe(true);
  const start=await state(page),intro=JSON.parse((await page.locator('#game').getAttribute('data-intro'))!);
  expect((await home(page)).completed).toBe(0);
  await page.mouse.click(intro.disable.x,intro.disable.y);await page.mouse.click(intro.skip.x,intro.skip.y);
  await expect(page.locator('#game')).toHaveAttribute('data-intro','');
  expect({x:(await state(page)).x,y:(await state(page)).y}).toEqual({x:start.x,y:start.y});
  expect((await home(page)).completed).toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem('agentcraft.home.preview.disabled'))).toBe('1');
  await page.reload();await expect(page.locator('#game')).toHaveAttribute('data-ready','true');await page.waitForTimeout(1200);
  expect(await page.locator('#game').getAttribute('data-intro')).toBe('');
  const replay=await home(page);await page.mouse.click(replay.preview.x,replay.preview.y);
  await expect.poll(async()=>JSON.parse((await page.locator('#game').getAttribute('data-intro'))||'null')?.active).toBe(true);
  await page.keyboard.press('Escape');await expect(page.locator('#game')).toHaveAttribute('data-intro','');
});

test('完整流程预览自动结束，恢复镜头并保持区域锁定',async({page})=>{
  await page.goto('/');await expect(page.locator('#game')).toHaveAttribute('data-ready','true');
  await expect.poll(async()=>JSON.parse((await page.locator('#game').getAttribute('data-intro'))||'null')?.active).toBe(true);
  const start=await state(page);
  await expect(page.locator('#game')).toHaveAttribute('data-intro','',{timeout:15000});
  expect((await home(page)).completed).toBe(0);
  expect((await state(page)).chapters.filter(c=>c.unlocked).map(c=>c.id)).toEqual(['C1']);
  expect({x:(await state(page)).x,y:(await state(page)).y}).toEqual({x:start.x,y:start.y});
  expect(await page.evaluate(()=>localStorage.getItem('agentcraft.home.preview.seen'))).toBe('1');
});
