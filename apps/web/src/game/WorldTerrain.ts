import Phaser from 'phaser';
import { BUILDINGS, DEPARTMENTS, FOUNTAIN, FRAGMENTS, PROPS, ROBOT, ROADS, SPAWN, TREES, WORLD } from './WorldMap';
import { drawCampusBuilding, drawCampusProp } from './CampusArchitecture';
import { drawCampusLandscape } from './CampusLandscape';
import { drawCampusRoads } from './CampusRoads';
import { groundDepth, toView, VIEW } from './WorldProjection';
import {buildCampusEnvironment,drawCampusLawnVariation,ENVIRONMENT} from './CampusEnvironment';

type Ctx=CanvasRenderingContext2D;
const INK='#4a647b';
function oval(c:Ctx,x:number,y:number,rx:number,ry:number,fill:string|CanvasGradient,stroke?:string):void {
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}
}
function gradient(c:Ctx,x:number,y:number,w:number,h:number,a:string,b:string):CanvasGradient {
  const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,a);g.addColorStop(1,b);return g;
}

const TILE=2048;
const MAP_WIDTH=768;
const MAP_SCALE=MAP_WIDTH/VIEW.width;

/** Ground, structures and actors share one projection; only vertical height stays upright. */
export function buildCampus(scene: Phaser.Scene): void {
  const environment=buildCampusEnvironment(scene);
  if(!scene.textures.exists('campus')){
    const plane=document.createElement('canvas');plane.width=WORLD.width;plane.height=WORLD.height;
    const c=plane.getContext('2d')!;
    c.fillStyle=gradient(c,0,0,WORLD.width,WORLD.height,'#b5d5ad','#71ada0');c.fillRect(0,0,WORLD.width,WORLD.height);
    drawCampusLawnVariation(c);
    for(let i=0;i<15000;i++){
      const x=(i*193+37)%WORLD.width,y=(i*347+73)%WORLD.height;
      c.strokeStyle=i%3===0?'#e2ecc355':'#458e8c35';c.lineWidth=i%6===0?2:1;
      c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-1,y-5,x-4,y-9);
      if(i%4===0){c.moveTo(x+2,y);c.quadraticCurveTo(x+3,y-5,x+7,y-7);}c.stroke();
      if(i%29===0)oval(c,x,y-5,2,1.5,'#fff5ceaa');
    }
    drawCampusRoads(c);
    drawCampusLandscape(c);
    // Engraved circuit pads leave the walking paths unobstructed.
    for(const fragment of FRAGMENTS){
      c.save();c.translate(fragment.x,fragment.y);
      c.strokeStyle='#83b8b366';c.lineWidth=2;
      c.beginPath();c.arc(0,0,24,0,Math.PI*2);c.stroke();
      for(let i=0;i<4;i++){
        c.save();c.rotate(i*Math.PI/2);c.beginPath();c.moveTo(28,0);c.lineTo(37,0);c.lineTo(43,6);c.stroke();
        c.fillStyle='#83b8b3';c.fillRect(40,3,5,5);c.restore();
      }c.restore();
    }
    // The shared model court and five modules form the architectural centre.
    c.fillStyle='#eadfbe';c.strokeStyle='#a5b6a1';c.lineWidth=5;
    c.beginPath();c.roundRect(1255,790,510,305,42);c.fill();c.stroke();
    for(const x of [1295,1732])for(let y=815;y<1070;y+=52)flowerBed(c,x,y,y%3);
    for(const dept of DEPARTMENTS){
      c.strokeStyle='#b4c7b966';c.lineWidth=2;
      c.beginPath();c.arc(dept.x,dept.y,31,0,Math.PI*2);c.stroke();
      for(let k=0;k<3;k++){c.fillStyle=['#b2cfbc','#c8c0ab','#b4c9d3'][k]!;c.fillRect(dept.x-19+k*15,dept.y+23,8,5);}
    }
    oval(c,2845,1700,139,240,'#5d959b');oval(c,2840,1697,126,227,'#d0dcb1');
    oval(c,2835,1692,111,210,gradient(c,2710,1480,220,430,'#99d7df','#4d9db0'));
    for(let i=0;i<24;i++){
      const y=1505+i*16;c.strokeStyle=i%3?'#dff8f1aa':'#4f91b977';c.lineWidth=2;
      c.beginPath();c.moveTo(2780+(i%5)*9,y);c.quadraticCurveTo(2820,y+3,2864-(i%3)*8,y);c.stroke();
    }
    for(let i=0;i<9;i++){oval(c,2800+(i*31%82),1580+i*25,8,4,'#7bbaa0');oval(c,2800+(i*31%82),1577+i*25,3,2,'#ffe0db');}

    const map=scene.textures.createCanvas('campus',MAP_WIDTH,Math.ceil(VIEW.height*MAP_SCALE))!;
    if(environment)map.context.drawImage(environment,ENVIRONMENT.x*MAP_SCALE,ENVIRONMENT.y*MAP_SCALE,ENVIRONMENT.width*MAP_SCALE,ENVIRONMENT.height*MAP_SCALE);
    // Split ground into GPU-safe chunks instead of uploading a texture wider than 4096px.
    for(let y=0;y<VIEW.height;y+=TILE)for(let x=0;x<VIEW.width;x+=TILE){
      const width=Math.min(TILE,VIEW.width-x),height=Math.min(TILE,VIEW.height-y);
      const tex=scene.textures.createCanvas('ground-'+x+'-'+y,width+4,height+4)!;
      tex.context.setTransform(1,.5,-1,.5,VIEW.originX-x+2,VIEW.originY-y+2);
      tex.context.drawImage(plane,0,0);tex.context.resetTransform();tex.refresh();
      tex.add('tile',0,2,2,width,height);
      map.context.drawImage(tex.canvas,2,2,width,height,x*MAP_SCALE,y*MAP_SCALE,width*MAP_SCALE,height*MAP_SCALE);
    }
    map.context.save();map.context.scale(MAP_SCALE,MAP_SCALE);
    const f=toView(FOUNTAIN);
    const objects=[
      ...BUILDINGS.map(b=>{const p=toView(b);return {depth:groundDepth({x:b.x+b.u,y:b.y+b.v}),draw:()=>drawCampusBuilding(map.context,{...b,x:p.x-b.v,y:p.y})};}),
      ...PROPS.map(p=>({depth:groundDepth(p)+(p.u+p.v)/4,draw:()=>drawCampusProp(map.context,{...p,...toView(p)})})),
      ...TREES.map(t=>({depth:groundDepth(t)+10,draw:()=>{const p=toView(t);drawTree(map.context,p.x,p.y,t.scale,t.variant);}})),
      {depth:f.y+48,draw:()=>fountain(map.context,f.x,f.y,1)},
    ];
    objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
    map.context.restore();map.refresh();
    plane.width=1;plane.height=1;
    if(environment){environment.width=1;environment.height=1;}
  }
  for(let y=0;y<VIEW.height;y+=TILE)for(let x=0;x<VIEW.width;x+=TILE)
    scene.add.image(x,y,'ground-'+x+'-'+y,'tile').setOrigin(0).setDepth(0);
  for(const b of BUILDINGS){
    const key='campus-building-'+b.id,pad=160,p=toView(b);
    if(!scene.textures.exists(key)){
      const tex=scene.textures.createCanvas(key,b.width+160,b.height+b.elevation+pad+60)!;
      drawCampusBuilding(tex.context,{...b,x:80,y:b.elevation+pad});tex.refresh();
    }
    scene.add.image(p.x-b.v-80,p.y-b.elevation-pad,key).setOrigin(0)
      .setDepth(groundDepth({x:b.x+b.u,y:b.y+b.v})).setName('building:'+b.id);
  }
  for(const p of PROPS){
    const key='campus-prop-'+p.id,v=toView(p);
    if(!scene.textures.exists(key)){
      const tex=scene.textures.createCanvas(key,340,260)!;
      drawCampusProp(tex.context,{...p,x:170,y:180});tex.refresh();
    }
    scene.add.image(v.x-170,v.y-180,key).setOrigin(0).setDepth(v.y+(p.u+p.v)/4);
  }
  for(const t of TREES){
    const key='academy-tree-'+t.variant,p=toView(t);
    if(!scene.textures.exists(key)){
      const tex=scene.textures.createCanvas(key,172,212)!;drawTree(tex.context,86,190,1,t.variant);tex.refresh();
    }
    scene.add.image(p.x,p.y+22*t.scale,key).setOrigin(.5,1).setScale(t.scale).setDepth(p.y+10).setName('tree:'+t.x+':'+t.y);
  }
  const fp=toView(FOUNTAIN);
  if(!scene.textures.exists('fountain')){
    const tex=scene.textures.createCanvas('fountain',280,260)!;fountain(tex.context,140,170,1);tex.refresh();
  }
  scene.add.image(fp.x-140,fp.y-170,'fountain').setOrigin(0).setDepth(fp.y+48);
  ROADS.filter(r=>r.kind==='avenue').forEach((r,index)=>{
    for(let k=0;k<r.points.length-(r.closed?0:1);k++){
      const a=r.points[k]!,b=r.points[(k+1)%r.points.length]!,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
      for(let d=110;d<length-60;d+=220){
        const side=index%2?1:-1,anchor={x:a.x+dx*d/length-dy/length*52*side,y:a.y+dy*d/length+dx/length*52*side};
        if([...FRAGMENTS,...DEPARTMENTS,ROBOT,SPAWN].some(point=>Math.hypot(point.x-anchor.x,point.y-anchor.y)<65))continue;
        const p=toView(anchor);
        lamp(scene,p.x,p.y,index);
      }
    }
  });
}

function flowerBed(c:Ctx,x:number,y:number,variant:number):void{
  oval(c,x+3,y+4,27,13,'#759ca166');oval(c,x,y,26,12,'#7baa90','#6a9685');
  for(let i=0;i<24;i++){
    const px=x+(i*17%43)-22,py=y+(i*11%18)-9;
    oval(c,px,py,3.4,2.5,variant%2?'#f2b7bf':'#ffdc98');oval(c,px+.8,py-.8,1.1,1,'#fff6d6');
  }
}
function fountain(c:Ctx,x:number,y:number,s:number):void{
  c.save();c.translate(x,y);c.scale(s,s);
  oval(c,4,16,101,55,'#6b85a177');oval(c,0,7,96,53,'#afb9bf',INK);oval(c,0,0,95,48,'#fff4dc',INK);
  oval(c,0,-3,81,39,gradient(c,-70,-35,140,60,'#a8e3e6','#5994bc'),'#6d9cac');
  oval(c,0,-7,35,17,'#f3ead4',INK);oval(c,0,-12,30,14,'#c7decc');
  c.fillStyle='#f6eee1';c.fillRect(-8,-45,16,32);oval(c,0,-45,27,13,'#fff8e4',INK);oval(c,0,-49,23,9,'#95c9d9');
  c.strokeStyle='#e5ffff';c.lineWidth=2;for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,0,45+i*12,19+i*6,0,0,Math.PI*2);c.stroke();}
  c.strokeStyle='#bcf5ef';c.lineWidth=3;c.beginPath();c.moveTo(0,-52);c.quadraticCurveTo(5,-90,13,-56);c.moveTo(0,-52);c.quadraticCurveTo(-10,-89,-15,-53);c.stroke();
  c.restore();
}
function drawTree(c:Ctx,x:number,y:number,s:number,variant:number):void {
  c.save();c.translate(x,y);c.scale(s,s);
  oval(c,11,4,50,16,'#6676a145');
  c.lineCap='round';c.strokeStyle='#63747b';c.lineWidth=10;c.beginPath();c.moveTo(0,1);c.lineTo(0,-60);c.moveTo(0,-23);c.lineTo(-22,-59);c.moveTo(0,-37);c.lineTo(22,-69);c.stroke();
  c.strokeStyle='#c4bea4';c.lineWidth=3;c.beginPath();c.moveTo(-3,0);c.lineTo(-3,-51);c.moveTo(-3,-22);c.lineTo(-23,-54);c.stroke();
  const pink=variant===1;
  const dark=pink?'#b481a9':variant===2?'#9aab83':'#529f98',mid=pink?'#f2b3c9':variant===2?'#c4d09c':'#8bc9ad',light=pink?'#ffe2dc':variant===2?'#e8ecc0':'#cee7b8';
  c.beginPath();c.moveTo(-49,-49);
  c.bezierCurveTo(-76,-56,-78,-97,-54,-106);c.bezierCurveTo(-60,-132,-33,-155,-14,-143);
  c.bezierCurveTo(-1,-170,36,-162,45,-136);c.bezierCurveTo(73,-133,80,-97,61,-80);
  c.bezierCurveTo(83,-51,46,-26,26,-37);c.bezierCurveTo(5,-22,-28,-28,-32,-43);c.closePath();
  c.fillStyle=gradient(c,-45,-152,95,120,light,dark);c.fill();c.strokeStyle=pink?'#9c819e':'#507f86';c.lineWidth=1.8;c.stroke();
  // Layered paint masses and fine leaf / petal marks retain an organic silhouette.
  oval(c,-23,-104,33,26,mid);oval(c,19,-119,31,29,light);oval(c,40,-86,25,22,mid);oval(c,-27,-70,31,23,mid);
  for(let i=0;i<125;i++){
    const px=(i*37%112)-56,py=-149+(i*53%101);
    if((px/57)**2+((py+99)/55)**2>1)continue;
    c.save();c.translate(px,py);c.rotate((i%7)*.4);
    c.fillStyle=i%5===0?light:i%3===0?dark:mid;c.globalAlpha=i%5===0?.9:.65;
    c.beginPath();c.ellipse(0,0,pink?3.8:4.5,pink?2.3:1.7,0,0,Math.PI*2);c.fill();c.restore();
  }
  if(pink)for(let i=0;i<8;i++)oval(c,-35+i*10,12+(i%3)*5,2.2,1.2,'#f5c7cc');
  c.restore();
}

function lamp(scene:Phaser.Scene,x:number,y:number,index:number):void {
  const g=scene.add.graphics({x,y}).setDepth(y+4);
  g.fillStyle(0x627fa7,.18).fillEllipse(9,2,33,10);
  g.lineStyle(3,0x65819b).lineBetween(0,0,0,-49);
  g.lineStyle(2,0xd5bc87).lineBetween(0,-49,14,-53);
  g.fillStyle(0xf7edd0).fillRoundedRect(8,-60,12,13,3);
  g.lineStyle(1,0x8ba0af).strokeRoundedRect(8,-60,12,13,3);
  g.fillStyle(0xd8ba84).fillTriangle(7,-59,14,-66,22,-59);
  if(index%2===0){
    g.fillStyle(0xc9b590).fillRoundedRect(-39,1,28,8,2);
    g.lineStyle(2,0x789098).lineBetween(-36,4,-36,12).lineBetween(-14,4,-14,12);
  }else{
    g.fillStyle(0xdfb8c5,.9).fillTriangle(3,-40,25,-34,3,-26);
    g.lineStyle(1,0xf6e1c2).lineBetween(4,-38,19,-34);
  }
}
