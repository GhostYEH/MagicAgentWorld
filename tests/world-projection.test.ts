import {describe,expect,it} from 'vitest';
import {BUILDINGS,projectBuilding,WORLD} from '../apps/web/src/game/WorldMap';
import {fromView,groundDepth,groundDirection,toView,VIEW} from '../apps/web/src/game/WorldProjection';

describe('等距世界坐标',()=>{
  it('屏幕点击可还原地面位置，四角与普通存档坐标都保持精度',()=>{
    for(const point of [{x:0,y:0},{x:WORLD.width,y:0},{x:0,y:WORLD.height},{x:WORLD.width,y:WORLD.height},{x:1090.125,y:1470.75}]){
      const view=toView(point),restored=fromView(view);
      expect(restored.x).toBeCloseTo(point.x,10);expect(restored.y).toBeCloseTo(point.y,10);
      expect(view.x).toBeGreaterThanOrEqual(0);expect(view.x).toBeLessThan(VIEW.width);
      expect(view.y).toBeGreaterThanOrEqual(0);expect(view.y).toBeLessThan(VIEW.height);
    }
  });
  it('地面两轴形成2:1菱形，竖向高度独立于地面投影',()=>{
    const origin=toView({x:0,y:0}),u=toView({x:100,y:0}),v=toView({x:0,y:100});
    expect([u.x-origin.x,u.y-origin.y]).toEqual([100,50]);
    expect([v.x-origin.x,v.y-origin.y]).toEqual([-100,50]);
    expect(toView({x:100,y:100},80)).toEqual({x:origin.x,y:origin.y+20});
    expect(groundDepth({x:100,y:100})).toBe(origin.y+100);
  });
  it('建筑碰撞的世界点与其局部等距绘图使用同一个落地位置',()=>{
    for(const b of BUILDINGS){
      const origin=toView(b),foot=toView(projectBuilding(b,b.u,b.v));
      expect(foot).toEqual({x:origin.x+b.u-b.v,y:origin.y+(b.u+b.v)/2});
    }
  });
  it('方向键转换后沿屏幕方向移动，右移保持等距深度',()=>{
    const start={x:100,y:100},p=toView(start);
    for(const [x,y]of [[1,0],[0,1],[-1,0],[0,-1]]){
      const d=groundDirection(x!,y!),view=toView({x:start.x+d.x,y:start.y+d.y});
      expect(view.x-p.x).toBe(x);expect(view.y-p.y).toBe(y);
    }
  });
});
