import {describe,expect,it} from 'vitest';
import {ACCESS_REGIONS,chapterSequence,chapterAccess,lockedObstacles,lockedRegionAt} from '../apps/web/src/game/ChapterAccess';
import {GameState} from '../apps/web/src/game/GameState';
import {DEPARTMENTS,DESTINATIONS,ROADS,SPAWN} from '../apps/web/src/game/WorldMap';
import {getTask} from '@agentcraft/content';

describe('循序学习与区域门禁',()=>{
  it.each([0,1,2,3,4,5,6])('完成连续 %i 章后只开放已学章节与下一章',count=>{
    const progress=Object.fromEntries(DESTINATIONS.slice(0,count).map(c=>[c.id,{passed:true}]));
    const sequence=chapterSequence(progress);
    expect(sequence.filter(c=>c.unlocked).map(c=>c.id)).toEqual(DESTINATIONS.slice(0,Math.min(count+1,6)).map(c=>c.id));
    expect(sequence.filter(c=>c.completed)).toHaveLength(count);
  });
  it('不连续的历史记录不能跳过前置章节',()=>{
    const sequence=chapterSequence({C2:{passed:true},C4:{passed:true}});
    expect(sequence.filter(c=>c.unlocked).map(c=>c.id)).toEqual(['C1']);
    expect(chapterAccess({C1:{passed:true},C3:{passed:true}},'C4')).toMatchObject({unlocked:false,completed:false,blockedBy:'C2'});
  });
  it('所有锁定庭院阻挡进入，开放后的公共环路仍完整可走',()=>{
    const game=new GameState();
    for(const region of ACCESS_REGIONS.filter(r=>r.bounds)){
      expect(lockedRegionAt(game.save.progress,region)?.id).toBe(region.id);
      expect(game.navigation.walkable(region),region.id).toBe(false);
      expect(game.navigation.clear(region.gate,region),region.id).toBe(false);
      const route=game.navigation.route(SPAWN,region);
      if(route)for(const point of route)expect(lockedRegionAt(game.save.progress,point)).toBeUndefined();
    }
    for(const road of ROADS.filter(r=>r.kind==='avenue'))for(let i=0;i<road.points.length-(road.closed?0:1);i++)
      expect(game.navigation.clear(road.points[i]!,road.points[(i+1)%road.points.length]!),road.id).toBe(true);
    expect(game.visit('memory-archive')).toBe(false);
  });
  it('真实 C1/C2 核验即时开放下一章，重复实验不撤销已获得的通关进度',async()=>{
    const game=new GameState(),lockedNavigation=game.navigation;
    const ids=getTask('C1').initialWorld.campus.announcements.map(a=>a.id);
    game.generate('你是谁？',ids);
    game.generate('你是谁？',ids.filter(id=>id!=='memory.identity'));
    expect(game.isChapterUnlocked('C2')).toBe(false);
    game.generate('你现在能调用工具吗？',ids);
    expect(game.isChapterUnlocked('C2')).toBe(true);
    expect(game.navigation).not.toBe(lockedNavigation);
    expect(game.navigation.walkable(DEPARTMENTS.find(d=>d.chapter==='C2')!)).toBe(true);
    expect(game.isChapterUnlocked('C3')).toBe(false);
    for(const id of ['inspect','calculate','retrieve'] as const)game.installTool(id);
    await game.invokeTool('inspect','tokenBudget');await game.invokeTool('calculate','8192-2048-1024');await game.invokeTool('retrieve','工具调用');
    expect(game.isChapterUnlocked('C3')).toBe(false);
    expect(game.reflectTools(true)).toBe(true);
    expect(game.isChapterUnlocked('C3')).toBe(true);
    expect(game.navigation.walkable(DEPARTMENTS.find(d=>d.chapter==='C3')!)).toBe(true);
    expect(game.isChapterUnlocked('C4')).toBe(false);
    game.resetToolLesson();
    expect(game.isChapterUnlocked('C3')).toBe(true);
  });
  it('第四章同时开放记忆馆和控制塔，其他区域仍锁定',()=>{
    const game=new GameState();
    for(const c of DESTINATIONS.slice(0,3))game.save.progress[c.id]={chapterId:c.id,passed:true,updatedAt:1};
    for(const id of ['memory-archive','control-gate']){
      const region=ACCESS_REGIONS.find(r=>r.id===id)!;
      expect(game.navigation.walkable(region)).toBe(true);
      expect(game.visit(id)).toBe(true);
    }
    expect(lockedObstacles(game.save.progress)).toHaveLength(2);
    expect(game.isChapterUnlocked('C5')).toBe(false);
    expect(game.isChapterUnlocked('C6')).toBe(false);
  });
});
