import Phaser from 'phaser';
import type { AccessRegion } from './ChapterAccess';
import { toView } from './WorldProjection';

/** The visible fence follows the same bounds used by locked-area collision. */
export function createRegionGate(scene: Phaser.Scene,region: AccessRegion): Phaser.GameObjects.Graphics[] {
  const b=region.bounds;if(!b)return [];
  const corners=[{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}];
  const floor=scene.add.graphics().setDepth(3);
  floor.fillStyle(0x8399aa,.12).fillPoints(corners.map(p=>toView(p)),true);
  const pieces=[floor];
  for(let side=0;side<4;side++){
    const a=corners[side]!,end=corners[(side+1)%4]!;
    const length=Math.hypot(end.x-a.x,end.y-a.y),count=Math.ceil(length/48);
    for(let i=0;i<count;i++){
      const first=toView({x:a.x+(end.x-a.x)*i/count,y:a.y+(end.y-a.y)*i/count});
      const last=toView({x:a.x+(end.x-a.x)*(i+1)/count,y:a.y+(end.y-a.y)*(i+1)/count});
      const rail=scene.add.graphics().setDepth(Math.max(first.y,last.y)+2);
      rail.lineStyle(4,0x8299a3).lineBetween(first.x,first.y-18,last.x,last.y-18);
      rail.lineStyle(2,0xead9ac).lineBetween(first.x,first.y-19,last.x,last.y-19);
      rail.lineStyle(5,0x657f91).lineBetween(first.x,first.y,first.x,first.y-27);
      rail.fillStyle(0xf4e6c5).fillCircle(first.x,first.y-28,4);
      pieces.push(rail);
    }
  }
  const p=toView({x:region.gate.x,y:b.y+b.height});
  const seal=scene.add.graphics().setDepth(p.y+5);
  seal.fillStyle(0x476982).fillRoundedRect(p.x-20,p.y-43,40,34,5);
  seal.lineStyle(2,0xe6cd92).strokeRoundedRect(p.x-20,p.y-43,40,34,5);
  seal.lineStyle(3,0xf7ebce).strokeRoundedRect(p.x-6,p.y-35,12,13,5);
  seal.fillStyle(0xf7ebce).fillRoundedRect(p.x-10,p.y-28,20,14,2);
  seal.fillStyle(0x66859a).fillCircle(p.x,p.y-22,2);
  pieces.push(seal);
  return pieces;
}
