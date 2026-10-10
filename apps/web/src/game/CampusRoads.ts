import { ROADS, type CampusRoad } from './WorldMap';

type Ctx=CanvasRenderingContext2D;
type Point={x: number;y: number};
const lerp=(a: Point,b: Point,t: number): Point=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});

/** Constant-radius corners, rather than midpoint curves that change the whole road. */
function trace(c: Ctx,road: CampusRoad): void {
  const points=road.points,r=road.kind==='avenue'?34:14;
  const corner=(i: number)=>{
    const p=points[i]!,a=points[(i+points.length-1)%points.length]!,b=points[(i+1)%points.length]!;
    const la=Math.hypot(p.x-a.x,p.y-a.y),lb=Math.hypot(b.x-p.x,b.y-p.y),cut=Math.min(r,la/2,lb/2);
    return {before:lerp(a,p,1-cut/la),after:lerp(p,b,cut/lb)};
  };
  c.beginPath();
  if(road.closed){
    const start=corner(0).before;c.moveTo(start.x,start.y);
    for(let i=0;i<points.length;i++){const p=points[i]!,k=corner(i);c.lineTo(k.before.x,k.before.y);c.quadraticCurveTo(p.x,p.y,k.after.x,k.after.y);}
    c.lineTo(start.x,start.y);c.closePath();
  }else{
    c.moveTo(points[0]!.x,points[0]!.y);
    for(let i=1;i<points.length-1;i++){const p=points[i]!,k=corner(i);c.lineTo(k.before.x,k.before.y);c.quadraticCurveTo(p.x,p.y,k.after.x,k.after.y);}
    const end=points.at(-1)!;c.lineTo(end.x,end.y);
  }
}
function layers(c: Ctx,roads: readonly CampusRoad[],palette: readonly (readonly [number,string])[]): void {
  // Draw each layer across the complete network so intersections share one surface.
  for(const [width,color]of palette){
    c.lineWidth=width;c.strokeStyle=color;
    for(const road of roads){trace(c,road);c.stroke();}
  }
}
function seams(c: Ctx,roads: readonly CampusRoad[],width: number,spacing: number,color: string): void {
  c.strokeStyle=color;c.lineWidth=.8;
  for(const road of roads){
    const p=road.points;
    for(let i=0;i<p.length-(road.closed?0:1);i++){
      const a=p[i]!,b=p[(i+1)%p.length]!,length=Math.hypot(b.x-a.x,b.y-a.y),nx=(b.y-a.y)/length,ny=-(b.x-a.x)/length;
      for(let d=50;d<length-50;d+=spacing){
        const q=lerp(a,b,d/length);c.beginPath();c.moveTo(q.x+nx*width/2,q.y+ny*width/2);c.lineTo(q.x-nx*width/2,q.y-ny*width/2);c.stroke();
      }
    }
  }
}
function crossing(c: Ctx,x: number,y: number,horizontalStreet: boolean): void {
  c.save();c.translate(x,y);if(!horizontalStreet)c.rotate(Math.PI/2);
  c.fillStyle='#edf0dc';
  for(let i=0;i<6;i++)c.fillRect(-19+i*7,-21,4,42);
  c.restore();
}

export function drawCampusRoads(c: Ctx): void {
  c.save();c.lineCap='butt';c.lineJoin='round';
  const main=ROADS.filter(r=>r.kind==='avenue'),walks=ROADS.filter(r=>r.kind==='walkway');
  layers(c,walks,[[38,'#9daf9f'],[34,'#f3e9ce'],[28,'#e4d6b7']]);
  seams(c,walks,27,22,'#b7ab8a55');
  layers(c,main,[[74,'#8b9e9e'],[70,'#f5ecd9'],[48,'#bdcac7']]);
  seams(c,main,46,30,'#859c9c33');
  for(const x of [915,1515,2165])crossing(c,x,740,true);
  for(const x of [950,1515,2085])crossing(c,x,1460,true);
  crossing(c,870,1192,false);crossing(c,2240,1253,false);
  c.restore();
}
