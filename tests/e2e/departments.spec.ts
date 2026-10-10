import {test,expect} from '@playwright/test';
import {ready,state,seedProgress} from './game';

test('前三章存档通关后，第四章记忆馆入口实际可达',async({page})=>{
  await seedProgress(page,['C1','C2','C3']);
  await ready(page);
  const initial=await state(page);
  expect(initial.departments).toHaveLength(6);
  expect(new Set(initial.departments.map(d=>d.name)).size).toBe(6);
  expect(initial.departments.every(d=>d.role.length>0)).toBe(true);
  expect(initial.region).toBe('大模型中枢');
  await page.keyboard.press('m');
  await expect.poll(async()=>(await state(page)).atlas).toBe(true);
  const memory=(await state(page)).departments.find(d=>d.id==='memory-archive')!;
  await page.mouse.click(memory.label.x,memory.label.y);
  await expect.poll(async()=>(await state(page)).navigation?.name).toBe('上下文与记忆馆');
  await expect(page.locator('#game')).toHaveAttribute('data-modal','department');
  expect((await state(page)).region).toBe('上下文与记忆馆');
  await page.screenshot({path:'screenshots/department-memory-arrival.png'});
  await page.keyboard.press('Escape');
  await expect.poll(async()=>(await state(page)).paused).toBe(false);
});
