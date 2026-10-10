import { test, expect, type Page } from '@playwright/test';
import { ready, state, collect, enterExperiment, experimentLayout, generate } from './game';

async function tools(page: Page) { return JSON.parse((await page.locator('#game').getAttribute('data-tools'))!); }
function lab(page: Page) {
  const {width, height} = page.viewportSize()!, w = 930, h = 620;
  return {x:(width-w)/2, y:(height-h)/2, w, h};
}
async function invoke(page: Page, index: number, input: string) {
  const {x,y,w} = lab(page);
  await page.mouse.click(x+134, y+162+index*101);
  await page.mouse.click(x+351, y+248);
  const field = page.locator('#game-tool-input');
  if (index === 0) {
    await field.fill('');
    await field.pressSequentially(input);
    await expect(field).toHaveValue(input);
    await field.press('ArrowLeft');
    expect(await field.evaluate((el:HTMLInputElement)=>el.selectionStart)).toBe(input.length-1);
    await field.press('ArrowRight');
  } else await field.fill(input);
  const before = (await tools(page)).calls.length;
  await page.mouse.click(x+w-117, y+248);
  await expect.poll(async()=> (await tools(page)).calls.length).toBe(before+1);
  return (await tools(page)).calls.at(-1);
}

test('教学旅程：装入记忆、完成对比、步行到工坊、执行工具与独立核验', async ({page}) => {
  await ready(page);
  expect((await state(page)).chapters.filter(c=>c.unlocked).map(c=>c.id)).toEqual(['C1']);
  await page.screenshot({path:'screenshots/agent-learning-world.png'});
  await collect(page);
  await enterExperiment(page);
  await generate(page);
  const exp = experimentLayout(page);
  await page.mouse.click(exp.x+27+(exp.w-66)/6, exp.y+213);
  await generate(page);
  expect((await state(page)).passed).toBe(false);
  await page.mouse.click(exp.x+27+(exp.w-66)/6, exp.y+213);
  await generate(page);
  expect((await state(page)).passed).toBe(false);
  await page.locator('#game-prompt').fill('你现在能调用工具吗？');
  await generate(page);
  expect((await state(page)).passed).toBe(true);
  expect((await state(page)).chapters.filter(c=>c.unlocked).map(c=>c.id)).toEqual(['C1','C2']);
  await page.mouse.click(exp.x+exp.w-273, exp.y+exp.h-29);
  await expect(page.locator('#game')).toHaveAttribute('data-modal','tools');
  expect((await state(page)).region).toBe('工具工坊');
  expect((await state(page)).paused).toBe(true);
  expect((await tools(page)).installed).toEqual([]);
  const l = lab(page);
  await page.mouse.click(l.x+l.w-117, l.y+248);
  expect((await tools(page)).calls).toHaveLength(0);
  expect((await invoke(page,0,'missing')).record.ok).toBe(false);
  expect((await invoke(page,0,'tokenBudget')).record.result.value.contextLimit).toBe(8192);
  expect((await invoke(page,1,'8192-2048')).record.result.value.value).toBe(6144);
  expect((await tools(page)).checks[1].passed).toBe(false);
  expect((await invoke(page,1,'8192-2048-1024')).record.result.value.value).toBe(5120);
  expect((await invoke(page,2,'不存在的资料')).record.result.value.count).toBe(0);
  expect((await state(page)).toolsPassed).toBe(false);
  await invoke(page,2,'工具调用');
  expect((await tools(page)).checks.every((c:any)=>c.passed)).toBe(true);
  expect((await state(page)).toolsPassed).toBe(false);
  expect((await state(page)).chapters.find(c=>c.id==='C3')!.unlocked).toBe(false);
  const bw=(l.w-314)/2;
  await page.mouse.click(l.x+270+bw/2,l.y+556);
  expect((await state(page)).toolsPassed).toBe(false);
  await page.mouse.click(l.x+282+bw*1.5,l.y+556);
  await expect.poll(async()=> (await state(page)).toolsPassed).toBe(true);
  expect((await state(page)).chapters.filter(c=>c.unlocked).map(c=>c.id)).toEqual(['C1','C2','C3']);
  await page.screenshot({path:'screenshots/agent-tool-workshop.png'});
  await page.keyboard.press('Escape');
  await expect.poll(async()=> (await state(page)).paused).toBe(false);
  await page.waitForTimeout(350);
  await page.reload();
  await expect(page.locator('#game')).toHaveAttribute('data-ready','true');
  expect((await state(page)).toolsPassed).toBe(true);
  expect((await state(page)).chapters.filter(c=>c.unlocked).map(c=>c.id)).toEqual(['C1','C2','C3']);
  await page.keyboard.press('e');
  await expect(page.locator('#game')).toHaveAttribute('data-modal','tools');
  expect((await tools(page)).installed).toHaveLength(3);
  expect((await tools(page)).calls).toHaveLength(6);
  expect((await tools(page)).checks.every((c:any)=>c.passed)).toBe(true);
  await page.keyboard.press('Escape');
  await page.keyboard.press('m');
  await expect.poll(async()=>(await state(page)).atlas).toBe(true);
  await page.screenshot({path:'screenshots/progression-after-c2-atlas.png'});
  const loop=(await state(page)).regions.find(r=>r.id==='loop-tower')!;
  expect(loop.unlocked).toBe(true);
  await page.mouse.click(loop.label.x,loop.label.y);
  await expect(page.locator('#game')).toHaveAttribute('data-modal','department');
  expect((await state(page)).region).toBe('执行循环塔');
  expect((await state(page)).chapters.find(c=>c.id==='C3')!.completed).toBe(false);
  await page.screenshot({path:'screenshots/progression-third-chapter-arrival.png'});
});
