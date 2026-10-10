import {describe,expect,it} from 'vitest';
import {learningWorld,FLOW_PREVIEW} from '../apps/web/src/game/HomeLearning';
import {homeMapFrame,coreMapFrame,CORE_VIEW_BOUNDS} from '../apps/web/src/game/HomeMapFrame';
import {VIEW} from '../apps/web/src/game/WorldProjection';

describe('首页学习导航',()=>{
  it('初始只有模型是当前目标，开放不等于模块已启动',()=>{
    const world=learningWorld({});
    expect(world.completed).toBe(0);expect(world.target.id).toBe('model-core');
    expect(world.modules.filter(m=>m.status==='locked')).toHaveLength(6);
    expect(world.stages.filter(s=>s.status==='completed')).toHaveLength(0);
  });
  it('第四章区分主目标与可进入的配套场馆，七建筑按六章计数',()=>{
    const world=learningWorld({C1:{passed:true},C2:{passed:true},C3:{passed:true}});
    expect(world.completed).toBe(3);expect(world.modules).toHaveLength(7);expect(world.stages).toHaveLength(6);
    expect(world.target.id).toBe('memory-archive');
    expect(world.modules.find(m=>m.id==='memory-archive')!.status).toBe('current');
    expect(world.modules.find(m=>m.id==='control-gate')!.status).toBe('available');
    expect(world.modules.find(m=>m.id==='tool-depot')!.status).toBe('completed');
    expect(world.modules.find(m=>m.id==='repair-lab')!.status).toBe('locked');
  });
  it('不连续的徽章不能提高系统启动进度',()=>{
    const world=learningWorld({C3:{passed:true},C6:{passed:true}});
    expect(world.completed).toBe(0);expect(world.allCompleted).toBe(false);expect(world.current).toBe('C1');
  });
  it('六章全部通关才可用完整运行入口，已启动场馆不再标作当前任务',()=>{
    const world=learningWorld(Object.fromEntries([1,2,3,4,5,6].map(i=>[`C${i}`,{passed:true}])));
    expect(world.allCompleted).toBe(true);expect(world.completed).toBe(6);
    expect(world.modules.every(m=>m.status==='completed')).toBe(true);
  });
  it('流程示意先组装上下文，再模型决策，工具前有权限检查',()=>{
    const ids=FLOW_PREVIEW.map(step=>step.region);
    expect(ids.indexOf('memory-archive')).toBeLessThan(ids.indexOf('control-gate'));
    expect(ids.indexOf('control-gate')).toBeLessThan(ids.indexOf('tool-depot'));
    expect(ids.indexOf('tool-depot')).toBeLessThan(ids.indexOf('loop-tower'));
  });
  it.each([[1280,720],[1366,768],[1920,1080],[2560,1440]])('%i×%i 总览为任务栏和快捷栏留出空间',(width,height)=>{
    const frame=homeMapFrame(width,height);
    const left=width/2-frame.x*frame.zoom,right=width/2+(VIEW.width-frame.x)*frame.zoom;
    const top=height/2-frame.y*frame.zoom,bottom=height/2+(VIEW.height-frame.y)*frame.zoom;
    expect(left).toBeGreaterThanOrEqual(315-1e-8);expect(right).toBeLessThanOrEqual(width-20+1e-8);
    expect(top).toBeGreaterThanOrEqual(92-1e-8);expect(bottom).toBeLessThanOrEqual(height-110+1e-8);
  });
  it.each([[1280,720],[1366,768],[1920,1080],[2560,1440]])('%i×%i 最大缩放和移动始终保留全部核心建筑',(width,height)=>{
    const max=coreMapFrame(width,height).maxZoom,b=CORE_VIEW_BOUNDS;
    for(const bottom of [130,300])for(const desired of [{x:0,y:0},{x:VIEW.width,y:VIEW.height}]){
      const frame=coreMapFrame(width,height,10,desired,bottom);
      expect(frame.zoom).toBeLessThanOrEqual(max);
      expect(width/2+(b.left-frame.x)*frame.zoom).toBeGreaterThanOrEqual(315-1e-8);
      expect(width/2+(b.right-frame.x)*frame.zoom).toBeLessThanOrEqual(width-24+1e-8);
      expect(height/2+(b.top-frame.y)*frame.zoom).toBeGreaterThanOrEqual(100-1e-8);
      expect(height/2+(b.bottom-frame.y)*frame.zoom).toBeLessThanOrEqual(height-bottom+1e-8);
    }
  });
});
