import {describe,expect,it} from 'vitest';
import {BUILDINGS,DEPARTMENTS} from '../apps/web/src/game/WorldMap';

describe('大模型与 Harness 部门布局',()=>{
  it('六个部门都有独立建筑与职责，中心大模型占地和高度均为主体',()=>{
    expect(DEPARTMENTS).toHaveLength(6);
    const models=DEPARTMENTS.map(d=>BUILDINGS.find(b=>b.id===d.id)!);
    expect(new Set(models.map(b=>b.kind)).size).toBe(6);
    expect(DEPARTMENTS.every(d=>d.role.length>0)).toBe(true);
    const core=models.find(b=>b.id==='model-core')!;
    for(const b of models.filter(b=>b!==core)){
      expect(core.u*core.v).toBeGreaterThan(b.u*b.v);
      expect(core.elevation).toBeGreaterThan(b.elevation);
    }
    const surround=models.filter(b=>b!==core);
    expect(surround.some(b=>b.x+b.u<core.x)).toBe(true);
    expect(surround.some(b=>b.x>core.x+core.u)).toBe(true);
    expect(surround.some(b=>b.y+b.v<core.y)).toBe(true);
    expect(surround.some(b=>b.y>core.y+core.v)).toBe(true);
  });
  it('建筑占地互不重叠，部门入口落在各自前立面外',()=>{
    for(let i=0;i<BUILDINGS.length;i++)for(let j=i+1;j<BUILDINGS.length;j++){
      const a=BUILDINGS[i]!,b=BUILDINGS[j]!;
      expect(a.x+a.u<=b.x||b.x+b.u<=a.x||a.y+a.v<=b.y||b.y+b.v<=a.y,`${a.id} / ${b.id}`).toBe(true);
    }
    for(const d of DEPARTMENTS){
      const b=BUILDINGS.find(b=>b.id===d.id)!;
      expect(d.x).toBeCloseTo(b.x+b.u/2);
      expect(d.y).toBeGreaterThan(b.y+b.v+30);
    }
  });
});
