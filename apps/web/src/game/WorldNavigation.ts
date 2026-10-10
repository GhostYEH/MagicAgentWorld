export interface Point { x: number; y: number }
export interface Obstacle extends Point { width: number; height: number; polygon?: readonly Point[] }

function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}

function segmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
  if(Math.abs(den)>1e-10){
    const cx=c.x-a.x,cy=c.y-a.y,t=(cx*sy-cy*sx)/den,u=(cx*ry-cy*rx)/den;
    if(t>=0&&t<=1&&u>=0&&u<=1)return 0;
  }
  return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}

function segmentEntersBox(a: Point, b: Point, o: Obstacle, radius: number): boolean {
  let enter=0,leave=1;
  for(const axis of ['x','y'] as const){
    const size=axis==='x'?o.width:o.height,min=o[axis]-radius,max=o[axis]+size+radius,delta=b[axis]-a[axis];
    if(Math.max(a[axis],b[axis])<=min||Math.min(a[axis],b[axis])>=max)return false;
    if(Math.abs(delta)<1e-10)continue;
    const t1=(min-a[axis])/delta,t2=(max-a[axis])/delta;
    enter=Math.max(enter,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));
    if(enter>=leave)return false;
  }
  return enter<leave;
}

function touchesObstacle(point: Point, obstacle: Obstacle, radius: number): boolean {
  if (point.x <= obstacle.x-radius || point.x >= obstacle.x+obstacle.width+radius || point.y <= obstacle.y-radius || point.y >= obstacle.y+obstacle.height+radius) return false;
  if (!obstacle.polygon) return true;
  let inside = false;
  const polygon = obstacle.polygon;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[j]!,b=polygon[i]!;
    if ((a.y>point.y)!==(b.y>point.y) && point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
    if(pointSegmentDistance(point,a,b)<=radius)return true;
  }
  return inside;
}

/** A small world grid for click navigation. Keyboard movement uses the same collision data. */
export class WorldNavigation {
  private readonly columns: number;
  private readonly rows: number;
  private readonly blocked: Uint8Array;
  constructor(readonly width: number, readonly height: number, readonly obstacles: readonly Obstacle[], readonly cell = 32, readonly margin = 48, readonly radius = 12) {
    this.columns = Math.ceil(width / cell); this.rows = Math.ceil(height / cell);
    this.blocked = new Uint8Array(this.columns * this.rows);
    for (let id = 0; id < this.blocked.length; id++) this.blocked[id] = this.walkable(this.center(id)) ? 0 : 1;
  }

  walkable(point: Point): boolean {
    const {x,y} = point;
    return Number.isFinite(x) && Number.isFinite(y) && x >= this.margin && y >= this.margin && x <= this.width - this.margin && y <= this.height - this.margin
      && !this.obstacles.some(o => touchesObstacle(point,o,this.radius));
  }

  clear(from: Point, to: Point): boolean {
    if(!this.walkable(from)||!this.walkable(to))return false;
    for(const obstacle of this.obstacles){
      if(!segmentEntersBox(from,to,obstacle,this.radius))continue;
      if(!obstacle.polygon)return false;
      const p=obstacle.polygon;
      for(let i=0;i<p.length;i++)if(segmentDistance(from,to,p[i]!,p[(i+1)%p.length]!)<=this.radius)return false;
    }
    return true;
  }

  nearest(point: Point): Point {
    const bounded = {x:Math.max(this.margin,Math.min(this.width-this.margin, Number.isFinite(point.x) ? point.x : this.width/2)), y:Math.max(this.margin,Math.min(this.height-this.margin, Number.isFinite(point.y) ? point.y : this.height/2))};
    if (this.walkable(bounded)) return bounded;
    let best = {x:this.width/2,y:this.height/2}, distance = Infinity;
    for (let id = 0; id < this.blocked.length; id++) {
      if (this.blocked[id]) continue;
      const candidate = this.center(id), d = Math.hypot(candidate.x-bounded.x,candidate.y-bounded.y);
      if (d < distance) { best = candidate; distance = d; }
    }
    return best;
  }

  route(from: Point, requested: Point): Point[] | null {
    if (!this.walkable(from)) return null;
    const goal = this.nearest(requested);
    if (this.clear(from,goal)) return [goal];
    const start = this.visibleCell(from), end = this.visibleCell(goal);
    if (start < 0 || end < 0) return null;
    const scores = new Float64Array(this.blocked.length).fill(Infinity);
    const parents = new Int32Array(this.blocked.length).fill(-1);
    const closed = new Uint8Array(this.blocked.length);
    const open = new Set<number>([start]);
    scores[start] = 0;
    const heuristic = (id:number) => { const p=this.center(id); return Math.hypot(p.x-goal.x,p.y-goal.y)/this.cell; };
    while (open.size) {
      let current=-1, best=Infinity;
      for (const id of open) { const f=scores[id]!+heuristic(id); if(f<best){best=f;current=id;} }
      if (current === end) {
        const reverse:Point[]=[goal];
        for (let id=end;id>=0;id=parents[id]!) reverse.push(this.center(id));
        const raw = [from,...reverse.reverse()];
        const simplified:Point[]=[];
        let index=0;
        while(index<raw.length-1) {
          let next=raw.length-1;
          while(next>index+1&&!this.clear(raw[index]!,raw[next]!)) next--;
          simplified.push(raw[next]!); index=next;
        }
        return simplified;
      }
      open.delete(current); closed[current]=1;
      const cx=current%this.columns, cy=Math.floor(current/this.columns);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
        if(!dx&&!dy)continue;
        const nx=cx+dx,ny=cy+dy;
        if(nx<0||ny<0||nx>=this.columns||ny>=this.rows)continue;
        const next=ny*this.columns+nx;
        if(this.blocked[next]||closed[next])continue;
        if(dx&&dy&&(this.blocked[cy*this.columns+nx]||this.blocked[ny*this.columns+cx]))continue;
        if(!this.clear(this.center(current),this.center(next)))continue;
        const cost=scores[current]!+Math.hypot(dx,dy);
        if(cost<scores[next]!) {scores[next]=cost;parents[next]=current;open.add(next);}
      }
    }
    return null;
  }

  private center(id:number):Point { return {x:(id%this.columns+.5)*this.cell,y:(Math.floor(id/this.columns)+.5)*this.cell}; }
  private visibleCell(point:Point):number {
    let best=-1,distance=Infinity;
    const x=Math.floor(point.x/this.cell),y=Math.floor(point.y/this.cell);
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++) {
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=this.columns||ny>=this.rows)continue;
      const id=ny*this.columns+nx;
      if(this.blocked[id])continue;
      const candidate=this.center(id), d=Math.hypot(candidate.x-point.x,candidate.y-point.y);
      if(d<distance&&this.clear(point,candidate)){best=id;distance=d;}
    }
    return best;
  }
}
