import { DEPARTMENTS, DESTINATIONS } from './WorldMap';
import type { Point, Obstacle } from './WorldNavigation';

export type ChapterId = typeof DESTINATIONS[number]['id'];
export type LearningProgress = Readonly<Record<string, { passed: boolean } | undefined>>;
export interface ChapterAccess {
  id: ChapterId;
  name: string;
  index: number;
  unlocked: boolean;
  completed: boolean;
  previous: ChapterId | null;
  blockedBy: ChapterId | null;
}
export function chapterAccess(progress: LearningProgress, id: ChapterId): ChapterAccess {
  const index=DESTINATIONS.findIndex(chapter=>chapter.id===id);
  const blocked=DESTINATIONS.slice(0,index).find(chapter=>progress[chapter.id]?.passed!==true);
  return {id,name:DESTINATIONS[index]!.name,index:index+1,unlocked:!blocked,
    completed:!blocked&&progress[id]?.passed===true,
    previous:index?DESTINATIONS[index-1]!.id:null,blockedBy:blocked?.id??null};
}
export function chapterSequence(progress: LearningProgress): ChapterAccess[] {
  return DESTINATIONS.map(chapter=>chapterAccess(progress,chapter.id));
}
export function currentChapter(progress: LearningProgress): ChapterId {
  return DESTINATIONS.find(chapter=>progress[chapter.id]?.passed!==true)?.id??'C6';
}
export function unlockRequirement(id: ChapterId): string {
  const index=DESTINATIONS.findIndex(chapter=>chapter.id===id);
  return index?`完成第${['一','二','三','四','五'][index-1]}章「${DESTINATIONS[index-1]!.name}」后开放`:'第一章 · 已开放';
}

export interface AccessRegion {
  id: string; name: string; role: string; chapter: ChapterId;
  x: number; y: number; bounds: Obstacle | null; gate: Point;
}
const grounds: Record<string,Obstacle> = {
  'tool-depot':{x:450,y:940,width:365,height:390},
  'loop-tower':{x:760,y:350,width:380,height:355},
  'memory-archive':{x:2015,y:250,width:330,height:380},
  'control-gate':{x:2330,y:1015,width:330,height:380},
  'repair-lab':{x:1770,y:1560,width:330,height:370},
  'assembly':{x:1375,y:1530,width:290,height:170},
};
export const ACCESS_REGIONS: readonly AccessRegion[] = [
  ...DEPARTMENTS.map(d=>{
    const bounds=grounds[d.id]??null;
    return {...d,bounds,gate:bounds?{x:d.x,y:bounds.y+bounds.height+24}:{x:d.x,y:d.y}};
  }),
  {id:'assembly',name:'Agent 总装台',role:'综合任务 · 效率与可靠性',chapter:'C6',x:1515,y:1615,
    bounds:grounds.assembly!,gate:{x:1515,y:1724}},
];
export function regionContains(region: AccessRegion, point: Point): boolean {
  const b=region.bounds;
  return !!b&&point.x>=b.x&&point.x<=b.x+b.width&&point.y>=b.y&&point.y<=b.y+b.height;
}
export function lockedRegionAt(progress: LearningProgress,point: Point): AccessRegion | undefined {
  return ACCESS_REGIONS.find(r=>!chapterAccess(progress,r.chapter).unlocked&&regionContains(r,point));
}
export function lockedObstacles(progress: LearningProgress): Obstacle[] {
  return ACCESS_REGIONS.filter(r=>r.bounds&&!chapterAccess(progress,r.chapter).unlocked).map(r=>r.bounds!);
}
export function actionChapter(action?: string): ChapterId | undefined {
  if(!action)return undefined;
  if(DESTINATIONS.some(d=>d.id===action))return action as ChapterId;
  return ACCESS_REGIONS.find(r=>`department:${r.id}`===action||`gate:${r.id}`===action)?.chapter;
}
