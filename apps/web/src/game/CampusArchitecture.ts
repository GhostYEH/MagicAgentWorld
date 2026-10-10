import type { CampusBuilding, CampusProp } from './WorldMap';
import { drawDepartmentBuilding, isDepartment } from './HarnessArchitecture';

type Ctx = CanvasRenderingContext2D;
type Point = {x: number; y: number};
const INK = '#4a647b';
const BLUE = ['#75abc5','#447997'] as const;
const CLAY = ['#dbab8d','#af7880'] as const;
const SAGE = ['#8ebbaa','#568a87'] as const;

// Texture-local version of the same ground projection; z stays vertical.
function projectBuilding(b: CampusBuilding,u: number,v: number,z=0): Point {
  return {x:b.x+b.v+u-v,y:b.y+(u+v)/2-z};
}

function poly(c: Ctx, points: Point[], fill: string, edge = INK): void {
  c.beginPath(); points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y)); c.closePath();
  c.fillStyle=fill; c.fill(); c.strokeStyle=edge; c.lineWidth=1.5; c.lineJoin='round'; c.stroke();
}
function line(c: Ctx, a: Point, b: Point, color: string, width = 1): void {
  c.beginPath(); c.moveTo(a.x,a.y); c.lineTo(b.x,b.y); c.strokeStyle=color; c.lineWidth=width; c.stroke();
}
function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, edge = INK): void {
  c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); c.fillStyle=fill; c.fill();
  c.strokeStyle=edge; c.lineWidth=1.5; c.stroke();
}
function slab(c: Ctx, b: CampusBuilding, u: number, v: number, w: number, d: number, z: number, color: string): void {
  poly(c,[[u,v],[u+w,v],[u+w,v+d],[u,v+d]].map(([a,t])=>projectBuilding(b,a!,t!,z)),color);
}
function box(c: Ctx, b: CampusBuilding, u: number, v: number, w: number, d: number, h: number, light: string, shade: string, cap: string, base = 0): void {
  const p = (a: number,t: number,z: number)=>projectBuilding(b,a,t,z+base);
  poly(c,[p(u,v+d,0),p(u+w,v+d,0),p(u+w,v+d,h),p(u,v+d,h)],light);
  poly(c,[p(u+w,v,0),p(u+w,v+d,0),p(u+w,v+d,h),p(u+w,v,h)],shade);
  poly(c,[p(u,v,h),p(u+w,v,h),p(u+w,v+d,h),p(u,v+d,h)],cap);
  line(c,p(u,v+d,5),p(u+w,v+d,5),'#719697',4);
  line(c,p(u+w,v,5),p(u+w,v+d,5),'#658a92',4);
}
function wall(c: Ctx, b: CampusBuilding, side: 'front'|'right', u: number, v: number, draw: ()=>void): void {
  const o=projectBuilding(b,u,v);
  c.save(); c.translate(o.x,o.y); c.transform(side==='front'?1:-1,.5,0,1,0,0); draw(); c.restore();
}
function window(c: Ctx, x: number, y: number, width = 21, height = 34, arch = true, warm = false): void {
  c.beginPath(); c.moveTo(x-width/2,y); c.lineTo(x-width/2,y-height+9);
  if(arch){c.quadraticCurveTo(x-width/2,y-height,x,y-height);c.quadraticCurveTo(x+width/2,y-height,x+width/2,y-height+9);}
  else c.lineTo(x+width/2,y-height+9);
  c.lineTo(x+width/2,y); c.closePath(); c.fillStyle=warm?'#d9b496':'#85b5cd'; c.fill();
  c.strokeStyle='#668596'; c.lineWidth=1.6; c.stroke();
  line(c,{x,y},{x,y:y-height+6},'#fff8e7',1.8);
  line(c,{x:x-width/2,y:y-height*.48},{x:x+width/2,y:y-height*.48},'#fff8e7',1.8);
  line(c,{x:x+5,y:y-height+11},{x:x+5,y:y-height+20},'#d7f1e8',2);
  line(c,{x:x-width/2-4,y:y+3},{x:x+width/2+4,y:y+3},'#d5bc8c',3);
}
function windows(c: Ctx, b: CampusBuilding, h: number, floors = 1, arch = true, warm = false): void {
  for(const side of ['front','right'] as const){
    const length=side==='front'?b.u:b.v;
    wall(c,b,side,side==='front'?0:b.u,side==='front'?b.v:0,()=>{
      const count=Math.floor(length/42),spacing=length/(count+1);
      for(let row=0;row<floors;row++)for(let col=1;col<=count;col++){
        if(side==='front'&&Math.abs(col*spacing-length/2)<23&&row===0)continue;
        window(c,col*spacing,-20-row*(h-25)/floors,22,Math.min(38,(h-24)/floors-10),arch,warm);
      }
      for(let row=1;row<floors;row++)line(c,{x:0,y:-row*h/floors},{x:length,y:-row*h/floors},'#f5ecd5',3);
    });
  }
}
function entrance(c: Ctx, b: CampusBuilding, title: string, width = 36): void {
  wall(c,b,'front',0,b.v,()=>{
    const x=b.u/2;
    c.fillStyle='#496c87'; c.fillRect(x-width/2,-48,width,48);
    c.strokeStyle='#e7dcc1'; c.lineWidth=3; c.strokeRect(x-width/2,-48,width,48);
    line(c,{x,y:-46},{x,y:0},'#ece1bc',2);
    c.fillStyle='#e3cca0'; c.fillRect(x+4,-24,3,4);
    c.fillStyle='#fff4d9'; c.fillRect(x-width/2-14,-70,width+28,17);
    c.strokeStyle='#bcad8e'; c.lineWidth=1; c.strokeRect(x-width/2-14,-70,width+28,17);
    c.font='bold 9px sans-serif'; c.textAlign='center'; c.fillStyle='#4d6a86'; c.fillText(title,x,-58);
  });
  for(let i=3;i>=0;i--)slab(c,b,b.u/2-width/2-6-i*3,b.v+i*4,width+12+i*6,5,2-i,'#eee5cf');
}
function gable(c: Ctx, b: CampusBuilding, u: number, v: number, w: number, d: number, h: number, rise: number, colors: readonly [string,string], tiles = true): void {
  const p=(a: number,t: number,z: number)=>projectBuilding(b,a,t,z);
  const a=p(u,v,h),bb=p(u+w,v,h),cc=p(u+w,v+d,h),dd=p(u,v+d,h);
  const r0=p(u,v+d/2,h+rise),r1=p(u+w,v+d/2,h+rise);
  poly(c,[bb,cc,r1],'#f1e8ce');
  poly(c,[a,bb,r1,r0],colors[1]); poly(c,[dd,cc,r1,r0],colors[0]);
  if(tiles){
    const lerp=(a: Point,b: Point,t: number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    for(let i=1;i<Math.ceil(w/24);i++){
      const t=i/Math.ceil(w/24); line(c,lerp(a,bb,t),lerp(r0,r1,t),'#dae8d66b'); line(c,lerp(dd,cc,t),lerp(r0,r1,t),'#335e7955');
    }
    for(let i=1;i<4;i++){const t=i/4;line(c,lerp(a,r0,t),lerp(bb,r1,t),'#335e7955');line(c,lerp(dd,r0,t),lerp(cc,r1,t),'#d9edda70');}
  }
  line(c,r0,r1,'#dcebdc',3); line(c,dd,cc,'#42637e',3);
  line(c,bb,r1,'#466582',2.5); line(c,r1,cc,'#466582',2.5);
}
function portico(c: Ctx, b: CampusBuilding, h: number, colors: readonly [string,string]): void {
  const width=Math.min(82,b.u*.45),u=(b.u-width)/2,v=b.v-26;
  for(const at of [u+4,u+width-4]){
    line(c,projectBuilding(b,at,b.v+4,0),projectBuilding(b,at,b.v+4,h-7),'#8c9c9b',7);
    line(c,projectBuilding(b,at-1,b.v+4,0),projectBuilding(b,at-1,b.v+4,h-7),'#fff5df',4);
  }
  gable(c,b,u,v,width,34,h,26,colors,false);
}
function academy(c: Ctx, b: CampusBuilding): void {
  box(c,b,0,0,b.u,b.v,b.elevation,'#fff1dc','#c5d8d3','#dce3cf');
  windows(c,b,b.elevation,1); gable(c,b,-3,-3,b.u+6,b.v+6,b.elevation,54,BLUE);
  // A central clerestory and colonnaded entrance distinguish the teaching building.
  const u=b.u/2-27,v=b.v/2-26;
  box(c,b,u,v,54,52,30,'#f6ecd7','#bcd1ce','#b2cfdb',b.elevation+32);
  gable(c,b,u-3,v-3,60,58,b.elevation+62,20,BLUE,false);
  const crest=projectBuilding(b,b.u/2,b.v/2,b.elevation+65);
  ellipse(c,crest.x,crest.y+13,8,9,'#edda9f');
  entrance(c,b,'AWAKENING LAB'); portico(c,b,63,BLUE);
}
function workshop(c: Ctx, b: CampusBuilding): void {
  box(c,b,0,0,b.u,b.v,b.elevation,'#e8c2a6','#caa6a0','#d7b9a0');
  windows(c,b,b.elevation,1,false,true);
  // Four structural roof bays, each with its own north-light glazing.
  const bay=b.u/4;
  for(let i=0;i<4;i++){
    const u=i*bay,p=(a: number,t: number,z: number)=>projectBuilding(b,a,t,z);
    poly(c,[p(u,0,b.elevation),p(u+bay,0,b.elevation),p(u+bay-15,0,b.elevation+35)],'#9bc2cc');
    poly(c,[p(u,0,b.elevation),p(u,b.v,b.elevation),p(u+bay-15,b.v,b.elevation+35),p(u+bay-15,0,b.elevation+35)],CLAY[0]);
    poly(c,[p(u+bay-15,0,b.elevation+35),p(u+bay-15,b.v,b.elevation+35),p(u+bay,b.v,b.elevation),p(u+bay,0,b.elevation)],'#7fb5c3');
    line(c,p(u+bay-15,0,b.elevation+35),p(u+bay-15,b.v,b.elevation+35),'#f6debc',3);
    for(let j=1;j<5;j++)line(c,p(u,j*b.v/5,b.elevation),p(u+bay-15,j*b.v/5,b.elevation+35),'#a3747655');
  }
  wall(c,b,'front',0,b.v,()=>{
    const x=b.u*.52; c.fillStyle='#4c7884'; c.fillRect(x-33,-61,66,61);
    for(let i=0;i<7;i++)line(c,{x:x-31,y:-4-i*8},{x:x+31,y:-4-i*8},'#9db8b4',1);
    c.fillStyle='#f2d295'; c.fillRect(x-40,-78,80,12);
    c.font='bold 9px sans-serif'; c.textAlign='center'; c.fillStyle='#716278'; c.fillText('TOOL WORKSHOP',x,-69);
    for(let i=0;i<4;i++){c.fillStyle=i%2?'#516c7a':'#e8c779';c.fillRect(x-41+i*23,-3,15,4);}
  });
}
function observatory(c: Ctx, b: CampusBuilding): void {
  box(c,b,0,0,b.u,b.v,35,'#e9ecda','#bccfd1','#dce6d3');
  const o=projectBuilding(b,b.u/2,b.v/2),rx=108,ry=52,top=o.y-66;
  c.beginPath();c.moveTo(o.x-rx,top);c.lineTo(o.x-rx,o.y-12);c.bezierCurveTo(o.x-rx,o.y+ry,o.x+rx,o.y+ry,o.x+rx,o.y-12);c.lineTo(o.x+rx,top);c.closePath();
  c.fillStyle='#e6eada';c.fill();c.strokeStyle=INK;c.lineWidth=1.5;c.stroke();
  ellipse(c,o.x,top,rx,ry,'#b8cdd2');
  for(let i=0;i<7;i++){
    const a=(i+.5)/7*Math.PI,px=o.x+Math.cos(a)*rx*.94,py=o.y-12+Math.sin(a)*ry*.65;
    window(c,px,py,17,26,true);
  }
  c.beginPath();c.moveTo(o.x-rx,top);c.bezierCurveTo(o.x-rx-3,top-125,o.x+rx+3,top-125,o.x+rx,top);c.bezierCurveTo(o.x+rx,top+ry,o.x-rx,top+ry,o.x-rx,top);c.closePath();
  const g=c.createLinearGradient(o.x-rx,top-90,o.x+rx,top+25);g.addColorStop(0,'#c6e7e3');g.addColorStop(.55,'#83b7cb');g.addColorStop(1,'#54819e');c.fillStyle=g;c.fill();c.strokeStyle=INK;c.stroke();
  for(const k of [-.72,-.4,0,.4,.72]){
    c.beginPath();c.moveTo(o.x+k*rx,top+Math.sqrt(1-k*k)*ry*.67);c.bezierCurveTo(o.x+k*rx,top-15,o.x+k*rx*.35,top-86,o.x,top-94);c.strokeStyle='#e8f2db';c.lineWidth=2;c.stroke();
  }
  c.beginPath();c.moveTo(o.x+9,top-94);c.quadraticCurveTo(o.x+53,top-68,o.x+45,top+25);c.lineTo(o.x+27,top+31);c.quadraticCurveTo(o.x+40,top-70,o.x-3,top-94);c.closePath();c.fillStyle='#345e7c';c.fill();
  line(c,{x:o.x,y:top-96},{x:o.x,y:top-118},'#c7b486',3);ellipse(c,o.x,top-120,4,4,'#f4db9d');
  entrance(c,b,'OBSERVATORY',30);
}
function clock(c: Ctx, x: number, y: number): void {
  ellipse(c,x,y,24,24,'#d4bd88');ellipse(c,x,y,20,20,'#fff5d7');
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;line(c,{x:x+Math.cos(a)*15,y:y+Math.sin(a)*15},{x:x+Math.cos(a)*18,y:y+Math.sin(a)*18},'#60758b',1.5);}
  line(c,{x,y},{x:x-8,y:y-10},'#476780',2);line(c,{x,y},{x:x+12,y:y-4},'#476780',2);
}
function clocktower(c: Ctx, b: CampusBuilding): void {
  const low=72,u=b.u/2-34,v=b.v/2-34;
  box(c,b,0,0,b.u,b.v,low,'#f5e9d2','#bfd4cf','#d8e0cf'); windows(c,b,low,1);
  gable(c,b,-2,-2,b.u+4,b.v+4,low,30,SAGE);
  box(c,b,u,v,68,68,b.elevation-low,'#f6ebcf','#bdcfc9','#d8ddc6',low);
  for(const side of ['front','right'] as const){
    wall(c,b,side,side==='front'?u:u+68,side==='front'?v+68:v,()=>{
      clock(c,34,-b.elevation+43);
      for(const z of [120,170]){window(c,18,-z,14,29);window(c,50,-z,14,29);}
      for(const z of [104,180,223])line(c,{x:0,y:-z},{x:68,y:-z},'#d3bc8e',4);
    });
  }
  const p=(a: number,t: number,z: number)=>projectBuilding(b,a,t,z);
  const peak=p(u+34,v+34,b.elevation+74);
  poly(c,[p(u-5,v-5,b.elevation),p(u+73,v-5,b.elevation),peak],SAGE[1]);
  poly(c,[p(u+73,v-5,b.elevation),p(u+73,v+73,b.elevation),peak],SAGE[1]);
  poly(c,[p(u-5,v+73,b.elevation),p(u+73,v+73,b.elevation),peak],SAGE[0]);
  line(c,peak,{x:peak.x,y:peak.y-22},'#c8ab77',3);ellipse(c,peak.x,peak.y-26,4,5,'#f0d699');
  entrance(c,b,'HARNESS CONTROL'); portico(c,b,57,SAGE);
}
function repair(c: Ctx, b: CampusBuilding): void {
  const lower=66;
  box(c,b,0,0,b.u,b.v,lower,'#dbdfcc','#a6c2bd','#a9c8b5');
  windows(c,b,lower,1,false);
  slab(c,b,4,4,b.u-8,b.v-8,lower+4,'#a3c7b5');
  // A raised service wing and a separate glass-roofed repair bay form an L.
  box(c,b,0,0,75,b.v,b.elevation,'#e8edda','#b5cfc6','#97baa9');
  gable(c,b,-2,-2,79,b.v+4,b.elevation,28,SAGE);
  for(let i=0;i<3;i++){
    const u=92+i*33;slab(c,b,u,14,26,62,lower+9,'#719bb0');
    for(let j=1;j<4;j++)line(c,projectBuilding(b,u,14+j*15,lower+10),projectBuilding(b,u+26,14+j*15,lower+10),'#c6dedb',1);
    line(c,projectBuilding(b,u+13,14,lower+10),projectBuilding(b,u+13,76,lower+10),'#c6dedb',1);
  }
  entrance(c,b,'REPAIR STATION',48);
  wall(c,b,'front',0,b.v,()=>{c.fillStyle='#edddae';c.fillRect(23,-90,26,23);c.fillStyle='#6d9d98';c.fillRect(33,-86,6,15);c.fillRect(28,-81,16,5);});
}
function arena(c: Ctx, b: CampusBuilding): void {
  const h=78,rise=75,p=(u: number,v: number)=>projectBuilding(b,u,v,h+Math.sin(v/b.v*Math.PI)*rise);
  box(c,b,0,0,b.u,b.v,h,'#f3e7cc','#c6d5ca','#d9dfc8');
  windows(c,b,h,1,false);
  for(let i=0;i<12;i++){
    const v=i/12*b.v,next=(i+1)/12*b.v;
    poly(c,[p(0,v),p(b.u,v),p(b.u,next),p(0,next)],['#719ca5','#84b3b7','#acd0c7','#cedecb','#c0d6b9','#a9c6b6'][Math.min(5,Math.floor(i/2))]!,'#91b8b5');
  }
  const front:Point[]=[];
  for(let j=0;j<=20;j++)front.push(p(b.u,j/20*b.v));
  poly(c,front,'#f4e6c9');
  for(let i=0;i<=7;i++){
    c.beginPath();for(let j=0;j<=24;j++){const pt=p(i/7*b.u,j/24*b.v);j?c.lineTo(pt.x,pt.y):c.moveTo(pt.x,pt.y);}
    c.strokeStyle='#e6edcf';c.lineWidth=3;c.stroke();
  }
  wall(c,b,'right',b.u,0,()=>{
    const x=b.v/2;window(c,x,-89,52,42,true);c.fillStyle='#dfc48c';c.fillRect(x-24,-37,48,28);
    line(c,{x:x-23,y:-36},{x:x+23,y:-9},'#f6eace',2);line(c,{x:x+23,y:-36},{x:x-23,y:-9},'#f6eace',2);
  });
  entrance(c,b,'AGENT ARENA',55);
  for(const u of [25,b.u-25]){
    const at=projectBuilding(b,u,b.v,55);line(c,at,{x:at.x,y:at.y-38},'#bfa67e',2);
    poly(c,[{x:at.x,y:at.y-36},{x:at.x+22,y:at.y-29},{x:at.x,y:at.y-18}],'#e5c88e');
  }
}
function smallBuilding(c: Ctx, b: CampusBuilding): void {
  const cafe=b.kind==='cafe',dorm=b.kind==='dormitory',gate=b.kind==='gatehouse';
  const colors=cafe||gate?CLAY:dorm?SAGE:BLUE;
  box(c,b,0,0,b.u,b.v,b.elevation,cafe?'#fae0c5':dorm?'#f0e2c4':'#f6edda',cafe?'#dac0b4':'#bfd0c9','#d8dfc9');
  windows(c,b,b.elevation,dorm?2:1,!cafe,cafe||dorm);
  gable(c,b,-3,-3,b.u+6,b.v+6,b.elevation,cafe?30:43,colors);
  entrance(c,b,cafe?'SAKURA CAFE':dorm?'STUDENT HOUSE':gate?'CAMPUS GATE':'LIBRARY');
  if(cafe){
    const p=(u: number,v: number,z: number)=>projectBuilding(b,u,v,z);
    for(let i=0;i<8;i++)poly(c,[p(12+i*14,b.v-3,56),p(26+i*14,b.v-3,56),p(26+i*14,b.v+18,43),p(12+i*14,b.v+18,43)],i%2?'#f9ebd1':'#81b7ac','#6f9998');
    box(c,b,12,10,18,17,35,'#ead9b9','#c2b9a9','#e6c99b',b.elevation+18);
  }else if(dorm){
    wall(c,b,'front',0,b.v,()=>{
      for(const x of [35,75,120,155]){
        c.fillStyle='#ceb893';c.fillRect(x-16,-50,32,5);line(c,{x:x-15,y:-51},{x:x-15,y:-63},'#648c8d',1.5);line(c,{x:x+15,y:-51},{x:x+15,y:-63},'#648c8d',1.5);line(c,{x:x-15,y:-63},{x:x+15,y:-63},'#648c8d',2);
        c.fillStyle='#a7c99b';c.fillRect(x-10,-53,20,4);
      }
    });
  }else if(!gate)portico(c,b,62,BLUE);
}
function greenhouse(c: Ctx, b: CampusBuilding): void {
  box(c,b,0,0,b.u,b.v,b.elevation,'#a7d6c9','#8fbcbf','#c7e3d5');
  for(const side of ['front','right'] as const){
    const length=side==='front'?b.u:b.v;
    wall(c,b,side,side==='front'?0:b.u,side==='front'?b.v:0,()=>{
      for(let x=0;x<=length;x+=23)line(c,{x,y:-b.elevation},{x,y:0},'#edf0d6',3);
      for(const y of [-25,-55])line(c,{x:0,y},{x:length,y},'#edf0d6',3);
      for(let x=15;x<length-10;x+=31){c.fillStyle='#709e8b';c.fillRect(x-6,-12,14,12);ellipse(c,x,-24,11,14,'#8ab68e','#7da592');}
    });
  }
  gable(c,b,0,0,b.u,b.v,b.elevation,38,['#b8e0d6','#7aafb9'],false);
  for(let u=0;u<=b.u;u+=24){
    line(c,projectBuilding(b,u,0,b.elevation),projectBuilding(b,u,b.v/2,b.elevation+38),'#e4efce',2);
    line(c,projectBuilding(b,u,b.v,b.elevation),projectBuilding(b,u,b.v/2,b.elevation+38),'#e4efce',2);
  }
  entrance(c,b,'BOTANICAL LAB',28);
}

/** Each district has a different massing, roof system and facade, on one projection. */
export function drawCampusBuilding(c: Ctx, b: CampusBuilding): void {
  if(isDepartment(b)){drawDepartmentBuilding(c,b);return;}
  c.save();
  const footprint=[[0,0],[b.u,0],[b.u,b.v],[0,b.v]].map(([u,v])=>projectBuilding(b,u!,v!));
  poly(c,footprint.map(p=>({x:p.x+13,y:p.y+12})),'#71839b40','#71839b00');
  // Low foundation walls make the raised building base readable against the ground.
  for(const [a,t]of [[footprint[3]!,footprint[2]!],[footprint[2]!,footprint[1]!]])
    poly(c,[a,t,{x:t.x,y:t.y+8},{x:a.x,y:a.y+8}],'#9fbaae');
  switch(b.kind){
    case 'academy':academy(c,b);break;
    case 'workshop':workshop(c,b);break;
    case 'observatory':observatory(c,b);break;
    case 'clocktower':clocktower(c,b);break;
    case 'repair':repair(c,b);break;
    case 'arena':arena(c,b);break;
    case 'greenhouse':greenhouse(c,b);break;
    default:smallBuilding(c,b);
  }
  c.restore();
}

export function drawCampusProp(c: Ctx, prop: CampusProp): void {
  const {x,y,kind}=prop;
  c.save();c.translate(x,y);
  ellipse(c,5,3,prop.width*.54,prop.height*.52,'#687b983b','#687b9800');
  const extent=prop.u+prop.v;
  const b:CampusBuilding={id:prop.id,kind:'cafe',x:-extent/2,y:-extent/4,u:prop.u,v:prop.v,width:extent,height:extent/2,elevation:0};
  const p=(u: number,v: number,z=0)=>projectBuilding(b,u,v,z);
  switch(kind){
    case 'planter':
      box(c,b,0,0,b.u,b.v,12,'#dfcba8','#bba99a','#d8dec0');
      slab(c,b,3,2,b.u-6,b.v-4,14,'#879b80');
      for(let i=0;i<9;i++){
        const at=p(4+i*(b.u-8)/8,b.v/2+(i%3-1)*3,15);
        line(c,at,{x:at.x,y:at.y-9-i%3*3},'#789c89',1.5);
        for(let k=0;k<5;k++){const a=k/5*Math.PI*2,color=i%2?'#efb5c5':'#f3d597';ellipse(c,at.x+Math.cos(a)*3,at.y-11+Math.sin(a)*2,3,2.3,color,color);}
        ellipse(c,at.x,at.y-11,1.2,1,'#fff5cd','#fff5cd');
      }break;
    case 'banner':
      ellipse(c,0,1,11,5,'#c8c8b1');line(c,{x:0,y:0},{x:0,y:-93},'#8f9c9d',3);
      ellipse(c,0,-94,3,3,'#ead7a5');
      poly(c,[{x:2,y:-87},{x:24,y:-80},{x:24,y:-43},{x:13,y:-47},{x:2,y:-53}],'#6b9eb7','#557e95');
      line(c,{x:5,y:-81},{x:21,y:-76},'#f4dfaa',2);
      poly(c,[{x:13,y:-73},{x:19,y:-63},{x:13,y:-57},{x:7,y:-67}],'#f4e4ba','#f4e4ba');break;
    case 'toolrack':
      box(c,b,0,0,b.u,b.v,10,'#d9c3a0','#a9b9b2','#e7dcc1');
      for(const u of [4,b.u-4])line(c,p(u,2,12),p(u,2,56),'#7c9499',3);
      slab(c,b,1,0,b.u-2,4,55,'#d4c29b');
      for(let i=0;i<4;i++){
        const at=p(8+i*(b.u-16)/3,2,50);
        line(c,at,{x:at.x,y:at.y+20},'#668e9b',4);
        line(c,{x:at.x-3,y:at.y+18},{x:at.x+4,y:at.y+13},'#e6d5ad',3);
        ellipse(c,at.x,at.y-3,3.5,3.5,'#bddfd0','#617e91');
      }break;
    case 'bench':
      for(const u of [7,b.u-7]){line(c,p(u,3),p(u,3,12),'#647e91',3);line(c,p(u,b.v),p(u,b.v,12),'#647e91',3);}
      slab(c,b,0,0,b.u,b.v,12,'#d8bd8c');
      for(let v=3;v<b.v;v+=5)line(c,p(0,v,13),p(b.u,v,13),'#aa927e',1);
      for(const u of [4,b.u-4])line(c,p(u,0,12),p(u,0,33),'#6c8592',3);
      slab(c,b,0,0,b.u,3,31,'#d8bd8c');break;
    case 'hedge':
      box(c,b,0,0,b.u,b.v,8,'#c6bc9d','#a5b6a1','#bccfa4');
      for(let u=10;u<b.u;u+=15){const at=p(u,b.v/2,16);ellipse(c,at.x,at.y,18,13,'#88b796','#689c8c');ellipse(c,at.x-5,at.y-4,9,6,'#b1cf9e','#b1cf9e');}break;
    case 'board':
      line(c,{x:-11,y:0},{x:-11,y:-49},'#9b957e',4);line(c,{x:11,y:0},{x:11,y:-49},'#9b957e',4);
      c.fillStyle='#efe2bd';c.fillRect(-24,-65,48,43);c.strokeStyle=INK;c.lineWidth=2;c.strokeRect(-24,-65,48,43);
      c.fillStyle='#88b9b2';c.fillRect(-20,-59,40,8);
      for(let i=0;i<3;i++){c.fillStyle=i%2?'#e4baaa':'#ffefd1';c.fillRect(-18+i*13,-45,11,17);line(c,{x:-16+i*13,y:-40},{x:-9+i*13,y:-40},'#a8a898',1);}
      poly(c,[{x:-29,y:-65},{x:0,y:-80},{x:29,y:-65}],'#759daf');break;
    case 'bicycle':
      for(let i=0;i<3;i++){
        const bx=-23+i*22,by=i%2*4;
        for(const wx of [bx-8,bx+13]){ellipse(c,wx,by-8,8,9,'#00000000','#5f7889');line(c,{x:wx-5,y:by-8},{x:wx+5,y:by-8},'#b8cfc8',1);}
        line(c,{x:bx-8,y:by-8},{x:bx+2,y:by-23},'#bca487',2);line(c,{x:bx+2,y:by-23},{x:bx+13,y:by-8},'#bca487',2);line(c,{x:bx-8,y:by-8},{x:bx+5,y:by-8},'#bca487',2);line(c,{x:bx+5,y:by-8},{x:bx+2,y:by-23},'#bca487',2);line(c,{x:bx+10,y:by-24},{x:bx+13,y:by-8},'#668d9d',2);line(c,{x:bx-1,y:by-25},{x:bx+7,y:by-25},'#587b91',3);
      }break;
    case 'crate':
      box(c,b,0,0,b.u*.48,b.v,25,'#dac199','#baa995','#e5cca0');
      box(c,b,b.u*.52,0,b.u*.48,b.v,39,'#d0b297','#b0998d','#e5c9a0');
      for(const at of [7,b.u*.64]){line(c,p(at,0,25),p(at,b.v,25),'#9e8b7c',2);line(c,p(at+7,0,25),p(at+7,b.v,25),'#f2ddad',2);}break;
    case 'crane':
      box(c,b,0,0,b.u,b.v,9,'#b5bdac','#8baba5','#d4c89a');
      for(const u of [4,b.u-4]){line(c,p(u,b.v/2,10),p(u,b.v/2,117),'#b69674',9);line(c,p(u-1,b.v/2,12),p(u-1,b.v/2,117),'#e7c78c',4);}
      line(c,p(-8,b.v/2,118),p(b.u+8,b.v/2,118),'#e5c588',12);
      const hoist=p(b.u*.6,b.v/2,118);line(c,hoist,{x:hoist.x,y:hoist.y+50},'#637c91',2);ellipse(c,hoist.x,hoist.y+57,5,7,'#aec9c5');
      for(let i=0;i<6;i++)line(c,p(i*b.u/6,b.v/2,120),p(i*b.u/6+6,b.v/2,115),'#80909a',2);break;
    case 'telescope':
      line(c,{x:0,y:-30},{x:-18,y:4},'#b29e82',3);line(c,{x:0,y:-30},{x:18,y:4},'#b29e82',3);line(c,{x:0,y:-30},{x:0,y:8},'#b29e82',3);
      line(c,{x:-17,y:-34},{x:19,y:-52},'#709bac',15);line(c,{x:-17,y:-37},{x:19,y:-55},'#badfd8',5);ellipse(c,21,-53,7,9,'#496d89');ellipse(c,-18,-34,5,6,'#d6e5d3');break;
    case 'console':
      box(c,b,0,0,b.u,b.v,24,'#d9ded0','#a4bebd','#d4e6d3');
      slab(c,b,4,3,b.u-8,b.v-6,26,'#6695a6');
      for(let i=0;i<3;i++){const at=p(9+i*8,b.v/2,27);ellipse(c,at.x,at.y,2.3,1.4,i%2?'#f4d99d':'#c4f0d8');}
      const at=p(b.u/2,0,30);line(c,at,{x:at.x,y:at.y-21},'#6d8396',3);c.fillStyle='#3e6a87';c.fillRect(at.x-14,at.y-39,28,19);c.strokeStyle='#c0d4ce';c.strokeRect(at.x-14,at.y-39,28,19);line(c,{x:at.x-9,y:at.y-30},{x:at.x+8,y:at.y-30},'#a8e1d5',2);break;
    case 'table':
    case 'parasol':
      line(c,{x:0,y:1},{x:0,y:-24},'#7e9291',4);ellipse(c,0,-24,23,12,'#e0c79c');
      for(const bx of [-31,31]){c.fillStyle='#cfb48d';c.fillRect(bx-6,-10,12,5);line(c,{x:bx-4,y:-5},{x:bx-4,y:3},'#7e9191',2);line(c,{x:bx+4,y:-5},{x:bx+4,y:3},'#7e9191',2);}
      ellipse(c,-7,-25,3,2,'#f6eee0');ellipse(c,8,-26,3,2,'#f6eee0');
      if(kind==='parasol'){
        line(c,{x:0,y:-25},{x:0,y:-82},'#baaa83',3);
        for(let i=0;i<6;i++){const a=i/6*Math.PI*2,aa=(i+1)/6*Math.PI*2;poly(c,[{x:0,y:-90},{x:Math.cos(a)*43,y:-65+Math.sin(a)*18},{x:Math.cos(aa)*43,y:-65+Math.sin(aa)*18}],i%2?'#f7e7c7':'#e0b2b7','#b19c95');}
      }break;
    case 'repairbot':
      box(c,b,0,0,b.u,b.v,9,'#cfbc96','#a7b8a8','#e5d3a8');
      ellipse(c,0,-22,16,17,'#dee9d8');c.fillStyle='#547d90';c.fillRect(-12,-28,24,12);
      for(const bx of [-6,6])ellipse(c,bx,-23,2,2,'#b2f0d8');line(c,{x:-15,y:-17},{x:-24,y:-9},'#7199a1',5);line(c,{x:15,y:-17},{x:23,y:-24},'#7199a1',5);line(c,{x:0,y:-39},{x:0,y:-47},'#baab81',2);ellipse(c,0,-48,3,3,'#f0d38c');break;
    case 'flag':
      ellipse(c,0,0,12,6,'#d6ceb5');line(c,{x:0,y:0},{x:0,y:-105},'#b7b594',3);
      poly(c,[{x:0,y:-100},{x:29,y:-90},{x:25,y:-59},{x:0,y:-68}],'#ddbd80');line(c,{x:8,y:-86},{x:18,y:-79},'#fff0c0',3);break;
    case 'pergola':
      for(const u of [0,b.u])for(const v of [0,b.v])line(c,p(u,v),p(u,v,67),'#9a9e82',6);
      slab(c,b,-6,-5,b.u+12,b.v+10,69,'#c5c8a0');
      for(let u=0;u<=b.u;u+=11)line(c,p(u,-7,72),p(u,b.v+7,72),'#749789',4);
      for(const u of [7,b.u*.35,b.u*.75]){const at=p(u,b.v,72);ellipse(c,at.x,at.y,19,10,'#9cbea0','#78a18d');ellipse(c,at.x+4,at.y+8,6,6,'#dbb3be','#c09caa');}break;
  }
  c.restore();
}
