import { test, expect } from '@playwright/test';
import { ready, state, collect, enterExperiment, experimentLayout, generate } from './game';

test('第一章实际游玩：拾取、NPC、上下文实验、独立核验与刷新存档', async ({page}) => {
  await ready(page);
  await page.screenshot({path:'screenshots/game-desktop.png'});
  await collect(page);
  await enterExperiment(page);
  expect((await state(page)).awakened).toBe(true);
  expect((await generate(page)).grounded).toBe(true);
  const {x,y,w} = experimentLayout(page);
  await page.mouse.click(x+27+(w-66)/6, y+213);
  const unknown = await generate(page);
  expect(unknown.grounded).toBe(false);
  expect(unknown.answer).toContain('无法确认');
  await page.mouse.click(x+27+(w-66)/6, y+213);
  await page.locator('#game-prompt').fill('你现在能调用工具吗？');
  const third = await generate(page);
  expect(third.grounded).toBe(true);
  expect(third.evidence[0].title).toBe('工具协议');
  expect(third.passed).toBe(true);
  await page.waitForTimeout(2700);
  await page.screenshot({path:'screenshots/game-experiment.png'});
  await page.keyboard.press('Escape');
  await expect.poll(async()=> (await state(page)).paused).toBe(false);
  // Wait for the serialized IndexedDB transaction to be externally visible.
  await expect.poll(()=>page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('agentcraft');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const saved=await new Promise<any>((resolve)=>{const req=db.transaction('saves').objectStore('saves').get('progress.v1');req.onsuccess=()=>resolve(req.result);});
    db.close(); return Boolean(saved?.progress.C1?.passed);
  })).toBe(true);
  await page.reload();
  await expect(page.locator('#game')).toHaveAttribute('data-ready','true');
  const restored=await state(page);
  expect(restored.collected).toBe(3);
  expect(restored.awakened).toBe(true);
  expect(restored.passed).toBe(true);
});
