import { expect, test } from '@playwright/test';
import { ready, state, collect, enterExperiment, generate } from './game';

test('手机游戏：本地字体与美术、触屏移动、指南，阻断外网', async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const external:string[]=[];
  const failed:string[]=[];
  page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(['localhost','127.0.0.1','::1'].includes(url.hostname)||['data:','blob:'].includes(url.protocol)) return route.continue();
    external.push(url.href); return route.abort();
  });
  await ready(page);
  await page.screenshot({path:'screenshots/game-mobile.png'});
  const before=await state(page);
  await page.mouse.move(117,780);
  await page.mouse.down();
  await expect.poll(async()=>(await state(page)).x).toBeGreaterThan(before.x+10);
  await page.mouse.up();
  await page.keyboard.press('h');
  await expect(page.locator('#game')).toHaveAttribute('data-modal','guide');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  expect(await page.evaluate(()=>document.fonts.check('400 14px "AgentCraft Sans"','找回失联的信号'))).toBe(true);
  expect(external).toEqual([]);
  expect(failed).toEqual([]);
});

test('手机可走完整收集流程并使用中文实验输入', async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await ready(page);
  await collect(page);
  await enterExperiment(page);
  await page.locator('#game-prompt').fill('校园卡怎么领取？');
  const output=await generate(page);
  expect(output.evidence[0].title).toBe('校园卡领取');
  await page.waitForTimeout(2700);
  await page.screenshot({path:'screenshots/game-mobile-experiment.png'});
});
