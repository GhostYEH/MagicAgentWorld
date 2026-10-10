import type Phaser from 'phaser';
import {WORLD} from './WorldMap';
import {VIEW,toView} from './WorldProjection';

type Ctx=CanvasRenderingContext2D;
type Point={x:number;y:number};
// One cached, reduced-resolution painting; never redraw it in the game loop.
export const ENVIRONMENT={x:-9000,y:-2900,width:VIEW.width+18000,height:VIEW.height+5800,scale:.25} as const;
const TILE=2048;
const TREE_COLORS=[['#568e89','#8eb99c','#c1d8aa'],['#b08c9e','#e1b2bf','#f5d4ce'],['#9b9d78','#bfca94','#e2dfa7']] as const;

function ellipse(c:Ctx,x:number,y:number,rx:number,ry:number,fill:string,edge?:string):void {
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();
  if(edge){c.strokeStyle=edge;c.lineWidth=2;c.stroke();}
}
function line(c:Ctx,points:readonly Point[],color:string,width:number):void {
  c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();
}
function outside(x:number,y:number,margin=70):boolean {
  return x<-margin||y<-margin||x>WORLD.width+margin||y>WORLD.height+margin;
}
function lawn(c:Ctx,x:number,y:number,rx:number,ry:number,color:string):void {
  c.beginPath();c.moveTo(x-rx,y);
  c.bezierCurveTo(x-rx*.8,y-ry*1.3,x+rx*.15,y-ry*.6,x+rx*.65,y-ry*.4);
  c.bezierCurveTo(x+rx*1.3,y+ry*.1,x+rx*.8,y+ry,x+rx*.1,y+ry*.8);
  c.bezierCurveTo(x-rx*.5,y+ry*1.2,x-rx*1.2,y+ry*.4,x-rx,y);c.fillStyle=color;c.fill();
}

/** Flat colour changes are drawn before the existing roads and courtyards. */
export function drawCampusLawnVariation(c:Ctx):void {
  lawn(c,790,210,570,300,'#c8d7ae88');
  lawn(c,1870,360,760,310,'#9dc9b477');
  lawn(c,490,1000,320,570,'#b8cbb277');
  lawn(c,1270,1620,410,290,'#d1d4ab66');
  lawn(c,2570,1210,430,580,'#aad4c277');
  lawn(c,2140,1840,420,210,'#bad0a588');
}

function watercourse(c:Ctx):void {
  const path=()=>{
    c.beginPath();c.moveTo(-3300,-720);
    c.bezierCurveTo(-1250,-1220,-800,-340,440,-450);
    c.bezierCurveTo(1270,-540,1470,-170,2290,-310);
    c.bezierCurveTo(3270,-610,3490,-850,3750,-10);
    c.bezierCurveTo(3890,550,3410,1030,3660,1670);
    c.bezierCurveTo(3890,2410,4960,2230,6030,2870);
  };
  for(const [color,width]of [['#86ae9d',264],['#d2d7b2',232],['#a9cbd1',196],['#91bfc7',159]] as const){path();c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
  // The north lake is visually distinct from the small campus lily pond.
  ellipse(c,2240,-375,455,265,'#d0d7b2','#86ad9e');
  ellipse(c,2240,-380,420,238,'#9bc7ce');
  ellipse(c,2390,-350,99,65,'#c3d0ac','#8caf99');
  for(let i=0;i<110;i++){
    const x=1855+(i*79%730),y=-580+(i*47%385);
    if(((x-2240)/395)**2+((y+380)/215)**2>1||Math.hypot((x-2390)/1.5,y+350)<85)continue;
    line(c,[{x,y},{x:x+30+i%35,y}],i%3?'#d6e6d980':'#75a7b780',2);
  }
  for(let i=0;i<18;i++){
    const x=2010+i*71%390,y=-470+i*59%170;
    if(Math.hypot((x-2390)/1.5,y+350)<95)continue;
    ellipse(c,x,y,12+i%4,8,'#a3c4a1');
    if(i%3===0)ellipse(c,x+2,y-3,5,4,'#eed2cb');
  }
  // A short timber footbridge connects the two banks, entirely outside the game grounds.
  c.save();c.translate(1320,-395);c.rotate(.18);
  c.fillStyle='#9cae9b';c.fillRect(-45,-144,104,290);c.fillStyle='#dccca9';c.fillRect(-48,-150,96,290);
  for(let y=-145;y<140;y+=16)line(c,[{x:-45,y},{x:44,y}],'#b4a88b',2);
  for(const x of [-43,43])line(c,[{x,y:-155},{x,y:145}],'#f2e5c4',6);
  c.restore();
}
function garden(c:Ctx,x:number,y:number,w:number,h:number):void {
  c.fillStyle='#d4d5ad';c.beginPath();c.roundRect(x,y,w,h,42);c.fill();
  for(let row=0;row<4;row++){
    const yy=y+22+row*43;
    c.fillStyle=row%2?'#abc69b':'#95b799';c.beginPath();c.roundRect(x+20,yy,w-40,30,15);c.fill();
    for(let i=0;i<24;i++){
      const xx=x+31+i*(w-62)/23;
      ellipse(c,xx,yy+13+(i%3-1)*4,5,4,row%2?'#e9cc91':'#edbdc5');
    }
  }
}
function drawSurroundingGround(c:Ctx):void {
  const base=c.createLinearGradient(0,0,WORLD.width,WORLD.height);
  base.addColorStop(0,'#b5d5ad');base.addColorStop(1,'#71ada0');c.fillStyle=base;c.fillRect(-20000,-20000,40000,40000);
  for(let i=0;i<110;i++){
    const x=-3300+(i*673%9600),y=-3800+(i*947%9000);
    if(!outside(x,y,240))continue;
    lawn(c,x,y,180+i%7*40,100+i%5*35,['#acc69b66','#cbd4ab77','#8eb59c55','#bad2b477'][i%4]!);
  }
  // Sparse grass and petals preserve detail without a repeating square grid.
  for(let i=0;i<6800;i++){
    const x=-3100+(i*193%9000),y=-3100+(i*347%8300);
    if(!outside(x,y))continue;
    line(c,[{x,y},{x:x+3,y:y-8}],i%3?'#78a68f50':'#dde5be80',2);
    if(i%7===0)ellipse(c,x+6,y-2,3,2,i%2?'#f0d6b3':'#e9c3c5');
  }
  lawn(c,-350,890,510,980,'#94b7a0');
  lawn(c,1080,2440,1460,450,'#c9d1a8');
  lawn(c,1800,-140,1060,180,'#c3d4ad');
  // A continuous campus perimeter promenade, not new chapter roads.
  const promenade=[{x:-140,y:-170},{x:WORLD.width+170,y:-170},{x:WORLD.width+170,y:WORLD.height+155},{x:-140,y:WORLD.height+155},{x:-140,y:-170}];
  line(c,promenade,'#93b29d',44);line(c,promenade,'#dce0bf',32);line(c,promenade,'#ece6ce',3);
  watercourse(c);
  for(const [x,y]of [[330,2270],[930,2320],[1600,2300],[-510,1680],[-510,1950]])garden(c,x!,y!,390,195);
  // North-west terraced meadow and a stone path through the peripheral grove.
  for(let i=0;i<5;i++){
    const x=-1060+i*75,y=260+i*85;c.fillStyle=i%2?'#bfcca6':'#afc2a0';c.beginPath();c.roundRect(x,y,580,66,28);c.fill();
    line(c,[{x:x+20,y:y+61},{x:x+545,y:y+61}],'#dadbb6',3);
  }
  line(c,[{x:-930,y:180},{x:-620,y:660},{x:-720,y:1360},{x:-270,y:2250},{x:650,y:2650},{x:2140,y:2470},{x:3240,y:2190}],'#dfd7b7',30);
  // Lily pads, reeds and shoreline stones will be painted upright in the next pass.
}

function tree(c:Ctx,p:Point,kind:number,size:number):void {
  const v=toView(p);c.save();c.translate(v.x,v.y);c.scale(size,size);
  ellipse(c,10,5,46,16,'#547f8040');line(c,[{x:0,y:0},{x:0,y:-66}],'#788275',8);
  if(kind===3){
    for(let i=0;i<3;i++){
      const y=-145+i*34,w=31+i*15;
      c.beginPath();c.moveTo(0,y-29);c.lineTo(w,y+38);c.quadraticCurveTo(0,y+50,-w,y+38);c.closePath();c.fillStyle=['#a9cab0','#83ac99','#6b968d'][i]!;c.fill();c.strokeStyle='#6b8e87';c.lineWidth=2;c.stroke();
      line(c,[{x:-w*.4,y:y+31},{x:6,y:y+30}],'#c4d8b3',3);
    }
  }else if(kind===4){
    for(let i=0;i<4;i++){
      const x=-24+i*16,h=95+i%3*23;line(c,[{x,y:0},{x:x+7,y:-h}],'#7ea889',5);
      for(let yy=-20;yy>-h;yy-=24){line(c,[{x:x-3,y:yy},{x:x+7,y:yy}],'#bfd2a7',2);ellipse(c,x+(i%2?20:-13),yy-16,22,7,'#87b699');}
    }
  }else{
    const colors=TREE_COLORS[kind%3]!;
    for(const [x,y,rx,ry,index]of [[0,-104,49,48,0],[-28,-95,34,35,1],[24,-102,34,36,1],[1,-131,33,30,2]])ellipse(c,x!,y!,rx!,ry!,colors[index!]!,'#789387');
    for(let i=0;i<22;i++)ellipse(c,-34+(i*19%70),-145+(i*31%70),3.8,2,colors[i%3]!);
  }
  c.restore();
}
function rock(c:Ctx,p:Point,size:number):void {
  const v=toView(p);c.save();c.translate(v.x,v.y);c.scale(size,size);
  ellipse(c,3,7,30,12,'#70958d44');
  c.beginPath();c.moveTo(-27,1);c.lineTo(-20,-19);c.lineTo(-2,-32);c.lineTo(22,-19);c.lineTo(29,2);c.lineTo(4,10);c.closePath();c.fillStyle='#a2b4ab';c.fill();c.strokeStyle='#77968e';c.lineWidth=2;c.stroke();
  c.beginPath();c.moveTo(-20,-19);c.lineTo(-2,-32);c.lineTo(22,-19);c.lineTo(1,-11);c.closePath();c.fillStyle='#d0d8bc';c.fill();
  ellipse(c,-9,-6,17,5,'#93b498');c.restore();
}
function pavilion(c:Ctx,p:Point):void {
  const v=toView(p);c.save();c.translate(v.x,v.y);
  ellipse(c,12,9,89,27,'#69938d44');
  ellipse(c,0,0,82,28,'#d7cfac','#93aa98');ellipse(c,0,-7,70,23,'#efe0be');
  for(const x of [-52,52])line(c,[{x,y:-7},{x,y:-96}],'#9a9981',8);
  for(const x of [-52,52])line(c,[{x:x-2,y:-12},{x:x-2,y:-96}],'#e7d6b3',4);
  line(c,[{x:-48,y:-29},{x:48,y:-29}],'#b9ae8d',7);
  c.beginPath();c.moveTo(-89,-98);c.quadraticCurveTo(-43,-116,0,-153);c.quadraticCurveTo(43,-116,89,-98);c.lineTo(0,-65);c.closePath();c.fillStyle='#7da9b2';c.fill();c.strokeStyle='#658c99';c.lineWidth=3;c.stroke();
  c.beginPath();c.moveTo(0,-153);c.lineTo(0,-65);c.lineTo(89,-98);c.quadraticCurveTo(43,-116,0,-153);c.fillStyle='#9bc3c5';c.fill();
  line(c,[{x:-89,y:-98},{x:0,y:-65},{x:89,y:-98}],'#e1d7b4',5);
  for(const x of [-47,-23,23,47])line(c,[{x:x*.42,y:-133},{x,y:-82-Math.abs(x)*.35}],'#bdd8d0',2);
  ellipse(c,0,-153,6,6,'#e5d4a8');c.restore();
}
function bench(c:Ctx,p:Point):void {
  const v=toView(p);c.save();c.translate(v.x,v.y);
  ellipse(c,10,6,48,13,'#678e8540');
  for(const x of [-29,27])line(c,[{x,y:0},{x,y:-38}],'#789184',5);
  c.beginPath();c.moveTo(-41,-31);c.lineTo(35,-31);c.lineTo(51,-19);c.lineTo(-25,-19);c.closePath();c.fillStyle='#deceaa';c.fill();
  line(c,[{x:-40,y:-51},{x:35,y:-51}],'#c2b28f',11);line(c,[{x:-40,y:-50},{x:35,y:-50}],'#ebdcb8',5);
  c.restore();
}
function drawPeripheralObjects(c:Ctx):void {
  const objects:{point:Point;draw:()=>void}[]=[];
  for(let row=0;row<36;row++)for(let col=0;col<44;col++){
    const seed=(row*719+col*379+113)%997;
    const p={x:-1800+col*165+seed*47%165,y:-1900+row*150+seed*83%150};
    if(!outside(p.x,p.y,230)||seed%4===0)continue;
    // Keep water, bridge, promenade and flower beds clear.
    if((p.y>-920&&p.y<-100)||(p.x>3300&&p.x<4050)||Math.abs(p.x+140)<100||Math.abs(p.x-WORLD.width-170)<100||Math.abs(p.y-WORLD.height-155)<100)continue;
    if(p.y>2200&&p.y<2540&&p.x>250&&p.x<2080)continue;
    const kind=p.x<0?seed%2?3:4:p.y>WORLD.height?seed%3:seed%5;
    if(seed%11===0)objects.push({point:p,draw:()=>rock(c,p,.7+seed%10/10)});
    else objects.push({point:p,draw:()=>tree(c,p,kind,.66+seed%53/100)});
  }
  const shelter={x:2390,y:-350};objects.push({point:shelter,draw:()=>pavilion(c,shelter)});
  for(const p of [{x:-325,y:1340},{x:1450,y:2600},{x:2350,y:2300}])objects.push({point:p,draw:()=>bench(c,p)});
  for(let i=0;i<21;i++){
    const p={x:2500+i*47%350,y:2300+i*67%270};
    objects.push({point:p,draw:()=>rock(c,p,.8+i%5*.2)});
  }
  // Reeds and stones punctuate the more open northern water bank.
  for(let i=0;i<22;i++){
    const p={x:1710+i*49,y:-65-(i%5)*16};
    objects.push({point:p,draw:()=>i%3?tree(c,p,4,.46):rock(c,p,.9)});
  }
  objects.sort((a,b)=>(a.point.x+a.point.y)-(b.point.x+b.point.y)).forEach(o=>o.draw());
}

/** Decorative outskirts share the same projection, but have no input or navigation. */
export function buildCampusEnvironment(scene:Phaser.Scene):HTMLCanvasElement|undefined {
  const key='campus-environment',e=ENVIRONMENT,width=Math.ceil(e.width*e.scale),height=Math.ceil(e.height*e.scale);
  let painting:HTMLCanvasElement|undefined;
  if(!scene.textures.exists(key+'-0-0')){
    painting=document.createElement('canvas');painting.width=width;painting.height=height;
    const c=painting.getContext('2d')!;c.save();c.scale(e.scale,e.scale);c.translate(-e.x,-e.y);
    c.save();c.transform(1,.5,-1,.5,VIEW.originX,VIEW.originY);drawSurroundingGround(c);c.restore();
    drawPeripheralObjects(c);c.restore();
    // Keep the painting sharp on wide desktop screens without uploading a >4096px texture.
    for(let y=0;y<height;y+=TILE)for(let x=0;x<width;x+=TILE){
      const w=Math.min(TILE,width-x),h=Math.min(TILE,height-y);
      const texture=scene.textures.createCanvas(`${key}-${x}-${y}`,w+4,h+4)!;
      texture.context.drawImage(painting,-x+2,-y+2);texture.refresh();texture.add('tile',0,2,2,w,h);
    }
  }
  for(let y=0;y<height;y+=TILE)for(let x=0;x<width;x+=TILE)
    scene.add.image(e.x+x/e.scale,e.y+y/e.scale,`${key}-${x}-${y}`,'tile').setOrigin(0).setScale(1/e.scale).setDepth(-20).setName('campus-environment');
  return painting;
}
