import { expect, test } from '@playwright/test';
import { ready, state } from './game';
import { SPAWN } from '../../apps/web/src/game/WorldMap';

for(const version of ['exploration.v1','exploration.v2'])test(`${version} 迁入架构城，位置校正并保留收集与徽章`, async({page})=>{
  // Seed on the same origin before a game instance can write an autosave.
  await page.goto('/favicon.svg');
  await page.evaluate(async(version)=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('agentcraft',1);req.onupgradeneeded=()=>req.result.createObjectStore('saves');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('saves','readwrite');
      tx.objectStore('saves').put({progress:{C1:{chapterId:'C1',passed:true,badge:'模型观察者',updatedAt:1}},experiments:{[version]:{collected:['schedule','dorm'],awakened:false,x:169,y:741,trials:2}},updatedAt:1},'progress.v1');
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
    });
    db.close();
  },version);
  await ready(page);
  await expect(page.locator('#game')).toHaveAttribute('data-ready','true');
  const migrated=await state(page);
  expect(migrated.collected).toBe(2);
  expect(migrated.passed).toBe(true);
  expect(migrated.region).toBe('大模型中枢');
  expect(migrated.world).toEqual({width:3072,height:2048});
  expect({x:migrated.x,y:migrated.y}).toEqual(SPAWN);
  await page.reload();
  await expect(page.locator('#game')).toHaveAttribute('data-ready','true');
  expect((await state(page)).collected).toBe(2);
});
