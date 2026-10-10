import { describe, expect, it } from 'vitest';
import { WorldNavigation } from '../apps/web/src/game/WorldNavigation';
import { BUILDINGS, buildingFootprint, DEPARTMENTS, DESTINATIONS, FRAGMENTS, OBSTACLES, PROPS, projectBuilding, propFootprint, ROBOT, ROADS, SPAWN, WORLD } from '../apps/web/src/game/WorldMap';

describe('连续世界导航', () => {
  it('点击建筑另一侧时绕开建筑，整条路线保持可通行', () => {
    const nav=new WorldNavigation(640,480,[{x:260,y:100,width:100,height:280}],32,32,12);
    const start={x:160,y:240},goal={x:460,y:240};
    const route=nav.route(start,goal)!;
    expect(route.length).toBeGreaterThan(1);
    let previous=start;
    for(const point of route){expect(nav.clear(previous,point)).toBe(true);previous=point;}
    expect(previous).toEqual(goal);
  });
  it('键盘与路线不能穿过建筑或走出世界边界',()=>{
    const nav=new WorldNavigation(640,480,[{x:250,y:150,width:100,height:100}]);
    expect(nav.clear({x:230,y:200},{x:270,y:200})).toBe(false);
    expect(nav.walkable({x:0,y:200})).toBe(false);
    expect(nav.walkable({x:NaN,y:200})).toBe(false);
    expect(nav.walkable(nav.nearest({x:300,y:200}))).toBe(true);
    expect(nav.walkable(nav.nearest({x:-100,y:5000}))).toBe(true);
  });
  it('六个区域、伙伴与全部信息都从同一个出生点可到达',()=>{
    const nav=new WorldNavigation(WORLD.width,WORLD.height,OBSTACLES);
    for(const goal of [...DESTINATIONS,...DEPARTMENTS,...FRAGMENTS,ROBOT]){
      const route=nav.route(SPAWN,goal);
      expect(route,`目标 ${JSON.stringify(goal)}`).not.toBeNull();
      expect(route![route!.length-1]).toEqual({x:goal.x,y:goal.y});
      let previous=SPAWN;
      for(const point of route!){expect(nav.clear(previous,point)).toBe(true);previous=point;}
    }
  });
  it('完全封闭的区域不返回穿墙路线',()=>{
    const nav=new WorldNavigation(640,480,[{x:300,y:0,width:40,height:480}]);
    expect(nav.route({x:150,y:240},{x:450,y:240})).toBeNull();
  });
  it('斜视建筑按实际地面轮廓避障，矩形包围盒的空角仍可通行',()=>{
    const nav=new WorldNavigation(640,480,[{x:250,y:150,width:200,height:100,polygon:[{x:350,y:150},{x:450,y:200},{x:350,y:250},{x:250,y:200}]}]);
    expect(nav.walkable({x:265,y:165})).toBe(true);
    expect(nav.walkable({x:350,y:200})).toBe(false);
    expect(nav.walkable({x:350,y:140})).toBe(false);
    expect(nav.walkable({x:350,y:130})).toBe(true);
    expect(nav.clear({x:260,y:160},{x:440,y:240})).toBe(false);
    const route=nav.route({x:260,y:160},{x:440,y:240})!;
    expect(route).not.toBeNull();
    let previous={x:260,y:160};
    for(const point of route){expect(nav.clear(previous,point)).toBe(true);previous=point;}
  });
  it('新增建筑地面轮廓均阻挡内部，门前有可到达的入口位置',()=>{
    const nav=new WorldNavigation(WORLD.width,WORLD.height,OBSTACLES);
    for(const b of BUILDINGS){
      expect(nav.walkable(projectBuilding(b,b.u/2,b.v/2)),b.id).toBe(false);
      const entry=projectBuilding(b,b.u/2,b.v+48);
      expect(nav.walkable(entry),b.id).toBe(true);
      const route=nav.route(SPAWN,entry);
      expect(route,b.id).not.toBeNull();
      expect(route!.at(-1)).toEqual(entry);
      const footprint=buildingFootprint(b);
      expect(footprint.every(p=>p.x>=WORLD.margin&&p.y>=WORLD.margin&&p.x<=WORLD.width-WORLD.margin&&p.y<=WORLD.height-WORLD.margin),b.id).toBe(true);
    }
  });
  it('精确线段判断不遗漏箱子边角，实际路线通过独立密集位置检查',()=>{
    const nav=new WorldNavigation(WORLD.width,WORLD.height,OBSTACLES);
    // Preserve the reported short corner independently of subsequent map layouts.
    const regression=new WorldNavigation(WORLD.width,WORLD.height,[{x:759,y:907,width:62,height:34}]);
    expect(regression.clear({x:848,y:1072},{x:560,y:720})).toBe(false);
    const route=nav.route(SPAWN,{x:385,y:595})!;
    expect(route).not.toBeNull();
    let previous=SPAWN;
    for(const point of route){
      const count=Math.ceil(Math.hypot(point.x-previous.x,point.y-previous.y));
      for(let i=0;i<=count;i++)expect(nav.walkable({x:previous.x+(point.x-previous.x)*i/count,y:previous.y+(point.y-previous.y)*i/count})).toBe(true);
      previous=point;
    }
  });
  it('主路与入口支路的中心线不穿建筑或设施，闭合路网没有断头',()=>{
    const nav=new WorldNavigation(WORLD.width,WORLD.height,OBSTACLES);
    expect(ROADS.some(r=>r.kind==='avenue'&&r.closed)).toBe(true);
    for(const road of ROADS){
      for(let i=0;i<road.points.length-(road.closed?0:1);i++){
        const a=road.points[i]!,b=road.points[(i+1)%road.points.length]!;
        expect(nav.clear(a,b),road.id+' '+i).toBe(true);
        if(road.kind==='avenue'){
          const length=Math.hypot(b.x-a.x,b.y-a.y),nx=(b.y-a.y)/length,ny=-(b.x-a.x)/length;
          for(const offset of [-22,22])expect(nav.clear({x:a.x+nx*offset,y:a.y+ny*offset},{x:b.x+nx*offset,y:b.y+ny*offset}),road.id+' 路面边缘').toBe(true);
        }
      }
    }
    expect(nav.walkable({x:885,y:1658})).toBe(true);
  });
  it('道具显示尺寸与逻辑占地分开，箱子边缘没有额外隐形碰撞',()=>{
    const crate=PROPS.find(p=>p.id==='yard-crates')!;
    const footprint=propFootprint(crate),nav=new WorldNavigation(WORLD.width,WORLD.height,OBSTACLES);
    expect(footprint.width).toBeCloseTo(crate.width*.65);
    expect(footprint.height).toBeCloseTo(crate.width*.35);
    expect(nav.walkable({x:754,y:942})).toBe(true);
    expect(nav.walkable(crate)).toBe(false);
  });
});
