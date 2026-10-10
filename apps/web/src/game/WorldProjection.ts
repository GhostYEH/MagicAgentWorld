import { WORLD } from './WorldMap';
import type { Point } from './WorldNavigation';

/** Logical ground coordinates remain stable; all scene objects use this 2:1 view. */
export const VIEW = {
  width: WORLD.width + WORLD.height + 256,
  height: (WORLD.width + WORLD.height) / 2 + 512,
  originX: WORLD.height + 128,
  originY: 384,
} as const;

export function toView(point: Point, elevation = 0): Point {
  return {x:VIEW.originX+point.x-point.y,y:VIEW.originY+(point.x+point.y)/2-elevation};
}

export function fromView(point: Point): Point {
  const x=point.x-VIEW.originX,y=(point.y-VIEW.originY)*2;
  return {x:(x+y)/2,y:(y-x)/2};
}

/** Screen arrow directions, converted to logical coordinates before collision checking. */
export function groundDirection(x: number,y: number): Point {
  return {x:x/2+y,y:y-x/2};
}

export function groundDepth(point: Point): number {
  return VIEW.originY+(point.x+point.y)/2;
}
