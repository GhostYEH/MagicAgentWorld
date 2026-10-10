import { expect, type Page } from '@playwright/test';
import {toView} from '../../apps/web/src/game/WorldProjection';

export interface State {
  x: number; y: number; collected: number; paused: boolean; atlas: boolean; awakened: boolean; passed: boolean; toolsPassed: boolean;
  targets: {id: string; x: number; y: number}[];
  robot: {x: number; y: number};
  destinations: {id: string; x: number; y: number}[];
  departments: {id:string;name:string;role:string;x:number;y:number;label:{x:number;y:number}}[];
  chapters: {id:string;unlocked:boolean;completed:boolean}[];
  regions: {id:string;chapter:string;unlocked:boolean;gate:{x:number;y:number};bounds:{x:number;y:number;width:number;height:number}|null;label:{x:number;y:number}}[];
  region: string; visited: number;
  world: {width: number; height: number}; camera: {x: number; y: number};
  navigation: {name: string; distance: number} | null;
  render: {x:number;y:number;depth:number;projection:string;zoom:number;maxZoom:number;coreBuildings:{id:string;x:number;y:number;width:number;height:number}[];occluded:string[]};
}
export async function seedProgress(page:Page,passed:string[],exploration?:Record<string,unknown>):Promise<void> {
  await page.goto('/favicon.svg');
  await page.evaluate(async({passed,exploration})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{
      const req=indexedDB.open('agentcraft',1);req.onupgradeneeded=()=>req.result.createObjectStore('saves');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('saves','readwrite');
      tx.objectStore('saves').put({progress:Object.fromEntries(passed.map(chapterId=>[chapterId,{chapterId,passed:true,updatedAt:1}])),experiments:exploration?{'exploration.v3':exploration}:{},updatedAt:1},'progress.v1');
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
    });db.close();
  },{passed,exploration});
}
export async function state(page: Page): Promise<State> {
  return JSON.parse((await page.locator('#game').getAttribute('data-state'))!);
}
export async function ready(page: Page): Promise<void> {
  await page.addInitScript(()=>localStorage.setItem('agentcraft.home.preview.seen','1'));
  await page.goto('/');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.waitForTimeout(350);
}
export async function mapPoint(page:Page,point:{x:number;y:number}):Promise<{x:number;y:number}> {
  const s=await state(page),v=toView(point),viewport=page.viewportSize()!,zoom=s.render.zoom;
  return {x:Math.round((v.x-s.camera.x)*zoom+viewport.width/2*(1-zoom)),y:Math.round((v.y-s.camera.y)*zoom+viewport.height/2*(1-zoom))};
}
export async function collect(page: Page): Promise<void> {
  for (const id of ['schedule', 'card', 'dorm']) {
    let before = await state(page);
    let target = before.targets.find(t => t.id === id)!;
    const viewport = page.viewportSize()!;
    if (target.x > viewport.width - 40) {
      await page.keyboard.down('ArrowRight');
      await expect.poll(async () => (await state(page)).targets.find(t => t.id === id)!.x).toBeLessThan(viewport.width - 60);
      await page.keyboard.up('ArrowRight');
      before = await state(page); target = before.targets.find(t => t.id === id)!;
    }
    await page.mouse.click(target.x, target.y - 12*before.render.zoom);
    await expect.poll(async () => (await state(page)).collected).toBe(before.collected + 1);
    await page.waitForTimeout(200);
  }
}
export async function enterExperiment(page: Page): Promise<void> {
  const s=await state(page),robot=s.robot;
  // Click the visible robot body; its feet are the navigation target, not the hit box.
  await page.mouse.click(robot.x, robot.y - 35*s.render.zoom);
  await expect(page.locator('#game')).toHaveAttribute('data-modal', 'robot');
  const {width, height} = page.viewportSize()!;
  const h = Math.min(377, height - 32);
  await page.mouse.click(width / 2, (height - h) / 2 + h - 35);
  await expect(page.locator('#game')).toHaveAttribute('data-modal', 'experiment');
  await expect(page.locator('#game-prompt')).toBeVisible();
}
export function experimentLayout(page: Page) {
  const {width, height} = page.viewportSize()!;
  const w = Math.min(790, width - 32), h = Math.min(603, height - 32);
  return {x:(width-w)/2, y:(height-h)/2, w, h};
}
export async function generate(page: Page) {
  const {x,y,w} = experimentLayout(page);
  await page.mouse.click(x+w-103, y+263);
  return JSON.parse((await page.locator('#game').getAttribute('data-experiment'))!);
}
