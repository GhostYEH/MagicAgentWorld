import {expect,test} from '@playwright/test';
import {ready,state,seedProgress,mapPoint} from './game';
import {SPAWN} from '../../apps/web/src/game/WorldMap';

test('新游戏保留所有建筑，锁定标牌和庭院地面点击均无法越章',async({page})=>{
  await ready(page);
  const start=await state(page);
  expect(start.regions.filter(r=>r.unlocked).map(r=>r.id)).toEqual(['model-core']);
  await page.keyboard.press('m');
  await expect.poll(async()=>(await state(page)).atlas).toBe(true);
  await page.screenshot({path:'screenshots/progression-locked-atlas.png'});
  for(const id of ['tool-depot','loop-tower','memory-archive','control-gate','repair-lab','assembly']){
    const region=(await state(page)).regions.find(r=>r.id===id)!;
    await page.mouse.click(region.label.x,region.label.y);
    await expect(page.locator('#game')).toHaveAttribute('data-modal','locked');
    const locked=JSON.parse((await page.locator('#game').getAttribute('data-locked'))!);
    expect(locked.chapter).toBe(region.chapter);expect(locked.blockedBy).toBe('C1');
    expect((await state(page)).navigation).toBeNull();
    expect({x:(await state(page)).x,y:(await state(page)).y}).toEqual({x:start.x,y:start.y});
    await page.keyboard.press('Escape');
  }
  const p=await mapPoint(page,{x:2280,y:560});
  await page.mouse.click(p.x,p.y);
  await expect(page.locator('#game')).toHaveAttribute('data-modal','locked');
  expect((await state(page)).navigation).toBeNull();
  await page.screenshot({path:'screenshots/progression-lock-condition.png'});
  await page.keyboard.press('Escape');
  for(const goal of [{x:820,y:740},{x:870,y:740}]){
    if(!(await state(page)).atlas)await page.keyboard.press('m');
    const v=await mapPoint(page,goal);
    await page.mouse.click(v.x,v.y);
    await expect.poll(async()=>(await state(page)).atlas).toBe(false);
    await expect.poll(async()=>{const s=await state(page);return Math.hypot(s.x-goal.x,s.y-goal.y);}).toBeLessThan(5);
    await expect(page.locator('#game')).toHaveAttribute('data-modal','');
    expect((await state(page)).chapters.filter(c=>c.unlocked).map(c=>c.id)).toEqual(['C1']);
  }
});

test('键盘和门前 E 交互不能穿过未开放庭院的围栏',async({page})=>{
  await seedProgress(page,[],{x:605,y:1354,collected:[],awakened:false,trials:0,visited:['model-core']});
  await ready(page);
  const tool=(await state(page)).regions.find(r=>r.id==='tool-depot')!,bounds=tool.bounds!;
  await page.keyboard.down('w');await page.keyboard.down('d');
  await page.waitForTimeout(300);
  await page.keyboard.up('w');await page.keyboard.up('d');
  const stopped=await state(page);
  expect(stopped.x).toBeGreaterThan(bounds.x+12);expect(stopped.x).toBeLessThan(bounds.x+bounds.width-12);
  expect(stopped.y).toBeGreaterThanOrEqual(bounds.y+bounds.height+12);
  expect(stopped.visited).toBe(1);expect(stopped.passed).toBe(false);
  await page.keyboard.press('e');
  await expect(page.locator('#game')).toHaveAttribute('data-modal','locked');
  expect(JSON.parse((await page.locator('#game').getAttribute('data-locked'))!).chapter).toBe('C2');
  await page.screenshot({path:'screenshots/progression-gate-collision.png'});
});

test('旧 v3 位于锁定区域时移回中枢，孤立的后续徽章不能绕过学习顺序',async({page})=>{
  await seedProgress(page,['C2'],{x:2165,y:476,collected:['schedule','dorm'],awakened:false,trials:0,visited:['model-core','memory-archive']});
  await ready(page);
  const restored=await state(page);
  expect({x:restored.x,y:restored.y}).toEqual(SPAWN);
  expect(restored.collected).toBe(2);expect(restored.toolsPassed).toBe(false);expect(restored.visited).toBe(1);
  expect(restored.chapters.filter(c=>c.unlocked).map(c=>c.id)).toEqual(['C1']);
});
