import type { CampusBuilding, DepartmentKind } from './WorldMap';

type Ctx = CanvasRenderingContext2D;
type P = {x:number;y:number};
const INK='#506b82', CREAM='#f6ecd5', GOLD='#d9bf88';
const kinds:readonly string[]=['model-core','tool-depot','loop-tower','memory-archive','control-gate','repair-lab'];
export const isDepartment = (b:CampusBuilding): boolean => kinds.includes(b.kind);

/** Same 2:1 ground basis as the world; height is always vertical. */
const p=(b:CampusBuilding,u:number,v:number,z=0):P=>({x:b.x+b.v+u-v,y:b.y+(u+v)/2-z});
function poly(c:Ctx,points:P[],fill:string,edge=INK):void {
  c.beginPath();points.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.closePath();
  c.fillStyle=fill;c.fill();c.strokeStyle=edge;c.lineWidth=1.6;c.lineJoin='round';c.stroke();
}
function line(c:Ctx,a:P,b:P,color=INK,width=2):void {
  c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();
}
function oval(c:Ctx,x:number,y:number,rx:number,ry:number,fill:string|CanvasGradient,edge=INK,width=1.6):void {
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();c.strokeStyle=edge;c.lineWidth=width;c.stroke();
}
function gradient(c:Ctx,x:number,y:number,w:number,h:number,a:string,b:string):CanvasGradient {
  const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,a);g.addColorStop(1,b);return g;
}
function slab(c:Ctx,b:CampusBuilding,u:number,v:number,w:number,d:number,z:number,fill:string):void {
  poly(c,[[u,v],[u+w,v],[u+w,v+d],[u,v+d]].map(([u,v])=>p(b,u!,v!,z)),fill);
}
function box(c:Ctx,b:CampusBuilding,u:number,v:number,w:number,d:number,h:number,light:string,shade:string,cap:string,base=0):void {
  const q=(x:number,y:number,z:number)=>p(b,x,y,z+base);
  poly(c,[q(u,v+d,0),q(u+w,v+d,0),q(u+w,v+d,h),q(u,v+d,h)],light);
  poly(c,[q(u+w,v,0),q(u+w,v+d,0),q(u+w,v+d,h),q(u+w,v,h)],shade);
  slab(c,b,u,v,w,d,h+base,cap);
}
function wall(c:Ctx,b:CampusBuilding,side:'front'|'right',u:number,v:number,draw:()=>void):void {
  const q=p(b,u,side==='front'?v:v+b.v);c.save();c.translate(q.x,q.y);c.transform(1,side==='front'?.5:-.5,0,1,0,0);draw();c.restore();
}
function pane(c:Ctx,x:number,y:number,w:number,h:number,color='#85b8c9'):void {
  c.fillStyle=color;c.fillRect(x,y,w,h);c.strokeStyle='#fff2da';c.lineWidth=3;c.strokeRect(x,y,w,h);
  line(c,{x:x+w*.52,y},{x:x+w*.52,y:y+h},'#d7e9dd',1.5);
  line(c,{x:x+5,y:y+5},{x:x+w*.35,y:y+h*.55},'#d7f4ea',2);
}
function sign(c:Ctx,x:number,y:number,text:string,w:number):void {
  c.fillStyle=CREAM;c.fillRect(x-w/2,y-14,w,21);c.strokeStyle=GOLD;c.lineWidth=1.2;c.strokeRect(x-w/2,y-14,w,21);
  c.font='bold 11px sans-serif';c.textAlign='center';c.fillStyle='#4a6981';c.fillText(text,x,y+1);
}
function portal(c:Ctx,b:CampusBuilding,text:string,width=46):void {
  wall(c,b,'front',0,b.v,()=>{
    const x=b.u/2;c.fillStyle='#355f79';c.fillRect(x-width/2,-66,width,66);
    c.strokeStyle='#e6d5ae';c.lineWidth=4;c.strokeRect(x-width/2,-66,width,66);
    line(c,{x,y:-64},{x,y:-2},'#a9d5d3',2);line(c,{x:x+5,y:-28},{x:x+9,y:-28},GOLD,3);
    sign(c,x,-82,text,Math.max(width+48,text.length*7.5));
  });
  for(let i=3;i>=0;i--)slab(c,b,b.u/2-width/2-8-i*3,b.v+i*6,width+16+i*6,6,5-i,'#eee4cb');
}
function cylinder(c:Ctx,b:CampusBuilding,u:number,v:number,r:number,h:number,base:number,light:string,shade:string,cap:string):void {
  const q=p(b,u,v,base),top=q.y-h,ry=r/2;
  c.beginPath();c.moveTo(q.x-r,top);c.lineTo(q.x-r,q.y);c.bezierCurveTo(q.x-r,q.y+ry*1.33,q.x+r,q.y+ry*1.33,q.x+r,q.y);c.lineTo(q.x+r,top);c.closePath();
  c.fillStyle=gradient(c,q.x-r,top,2*r,h,light,shade);c.fill();c.strokeStyle=INK;c.lineWidth=1.5;c.stroke();
  oval(c,q.x,top,r,ry,cap);
}
function foundation(c:Ctx,b:CampusBuilding):void {
  const points=[[0,0],[b.u,0],[b.u,b.v],[0,b.v]].map(([u,v])=>p(b,u!,v!));
  poly(c,points.map(q=>({x:q.x+16,y:q.y+14})),'#607b9140','#607b9100');
  box(c,b,0,0,b.u,b.v,14,'#d9dfce','#a9c1bd','#f6edd5');
  for(let u=12;u<b.u-12;u+=28)line(c,p(b,u,b.v,3),p(b,u+18,b.v,3),'#c1af8e',1);
}
function modelCore(c:Ctx,b:CampusBuilding):void {
  const u=b.u/2,v=b.v/2,q=p(b,u,v),r=175,top=q.y-b.elevation;
  cylinder(c,b,u,v,198,49,14,'#f8f0dd','#b6cdd0','#d8e4d8');
  for(let i=0;i<11;i++){
    const a=Math.PI*(i+.5)/11,px=q.x+Math.cos(a)*185,py=q.y-23+Math.sin(a)*83;
    line(c,{x:px,y:py},{x:px,y:py-30},'#86aaa9',4);
  }
  cylinder(c,b,u,v,r,b.elevation-65,65,'#c5e8e0','#6a9cac','#b9dce0');
  // The visible neural core, framed by glass and structural ribs.
  const core={x:q.x,y:q.y-145};
  oval(c,core.x,core.y,63,54,'#b4e8dc66','#d4f0df',1);
  const nodes=Array.from({length:9},(_,i)=>({x:core.x+Math.cos(i/9*Math.PI*2)*48,y:core.y+Math.sin(i/9*Math.PI*2)*34}));
  for(let i=0;i<nodes.length;i++)for(const offset of [3,4])line(c,nodes[i]!,nodes[(i+offset)%nodes.length]!,'#e1f5dca6',1.5);
  for(const node of nodes)oval(c,node.x,node.y,4,4,'#eef8d4','#8ebfbd');
  oval(c,core.x,core.y,19,19,'#e4f8d4','#f8e9bd',2);
  for(let i=0;i<9;i++){
    const a=Math.PI*i/8,x=q.x+Math.cos(a)*r,baseY=q.y-65+Math.sin(a)*r/2;
    line(c,{x,y:top+Math.sin(a)*r/2},{x,y:baseY},i===4?'#f8ebc9':'#d6e8d9',i===4?5:3);
  }
  // Blue glass dome with a white crown and meridian ribs.
  c.beginPath();c.moveTo(q.x-r,top);c.bezierCurveTo(q.x-r,top-118,q.x+r,top-118,q.x+r,top);c.bezierCurveTo(q.x+r,top+r*.66,q.x-r,top+r*.66,q.x-r,top);c.closePath();
  c.fillStyle=gradient(c,q.x-r,top-90,r*2,150,'#d4f0e6','#6098b3');c.fill();c.strokeStyle=INK;c.lineWidth=2;c.stroke();
  for(const k of [-.8,-.5,-.23,0,.23,.5,.8]){
    c.beginPath();c.moveTo(q.x+k*r,top+Math.sqrt(1-k*k)*r*.4);c.bezierCurveTo(q.x+k*r,top-10,q.x+k*r*.3,top-87,q.x,top-89);c.strokeStyle='#e8f2db';c.lineWidth=2.4;c.stroke();
  }
  oval(c,q.x,top+17,194,71,'#00000000',GOLD,4);
  for(const a of [.4,1.1,2.3,2.85])oval(c,q.x+Math.cos(a)*194,top+17+Math.sin(a)*71,6,4,'#eaf6d1',GOLD,1);
  line(c,{x:q.x,y:top-88},{x:q.x,y:top-121},'#b3a17e',3);oval(c,q.x,top-124,6,7,'#f4e0a1',INK);
  // The lower entry remains in the same ground footprint as the dome.
  box(c,b,b.u/2-37,b.v-37,74,37,83,'#fff3dc','#bed3cf','#bad7d3');
  portal(c,b,'LLM CORE',48);
}
function toolDepot(c:Ctx,b:CampusBuilding):void {
  box(c,b,0,0,b.u,b.v,90,'#f1d8b5','#c6b4a7','#e1cba7');
  const bay=b.u/3;
  for(let i=0;i<3;i++){
    const u=i*bay,q=(x:number,y:number,z:number)=>p(b,x,y,z);
    poly(c,[q(u,0,90),q(u,b.v,90),q(u+bay-15,b.v,128),q(u+bay-15,0,128)],'#c6cba6');
    poly(c,[q(u+bay-15,0,128),q(u+bay-15,b.v,128),q(u+bay,b.v,90),q(u+bay,0,90)],'#86b7c6');
    for(let v=15;v<b.v;v+=28)line(c,q(u+bay-15,v,128),q(u+bay,v,90),'#e3efdc',2);
    line(c,q(u+bay-15,0,128),q(u+bay-15,b.v,128),GOLD,3);
  }
  wall(c,b,'front',0,b.v,()=>{
    for(const x of [30,220]){pane(c,x-19,-63,38,40,'#8facb8');line(c,{x:x-21,y:-16},{x:x+21,y:-16},GOLD,4);}
  });
  wall(c,b,'right',b.u,0,()=>{
    for(let i=0;i<3;i++){
      const x=16+i*48;pane(c,x,-65,33,49,['#9ecdc2','#e3c992','#b5b5ce'][i]!);
      c.font='bold 15px sans-serif';c.textAlign='center';c.fillStyle='#4f7185';c.fillText(['Q','C','R'][i]!,x+16,-34);
    }
  });
  // A roof-mounted articulated arm makes tool execution legible in silhouette.
  const base=p(b,42,25,122),a={x:base.x-17,y:base.y-46},joint={x:a.x+48,y:a.y-36},end={x:joint.x+28,y:joint.y+27};
  oval(c,base.x,base.y,15,7,'#8aa6aa');
  for(const [from,to]of [[base,a],[a,joint],[joint,end]]){line(c,from!,to!,'#687f8c',12);line(c,{x:from!.x-2,y:from!.y-2},{x:to!.x-2,y:to!.y-2},'#e4c791',7);}
  for(const point of [a,joint])oval(c,point.x,point.y,8,8,'#c6dacf','#6e8792');
  line(c,end,{x:end.x-10,y:end.y+15},'#647f8d',4);line(c,end,{x:end.x+10,y:end.y+15},'#647f8d',4);
  portal(c,b,'TOOLS',43);
}
function loopTower(c:Ctx,b:CampusBuilding):void {
  const u=b.u/2,v=b.v/2,q=p(b,u,v);
  cylinder(c,b,u,v,126,55,15,'#e7ecd8','#b3cdc7','#d8e4d0');
  cylinder(c,b,u,v,69,98,70,'#b7d8c9','#72a7a4','#c3e5d8');
  for(let i=0;i<5;i++){
    const a=Math.PI*(i+.5)/5,x=q.x+Math.cos(a)*62,y=q.y-70+Math.sin(a)*28;
    c.fillStyle='#527f94';c.fillRect(x-7,y-62,14,43);line(c,{x:x-7,y:y-40},{x:x+7,y:y-40},'#dfedce',2);
  }
  for(const [height,r,ry]of [[114,166,63],[167,137,49]] as const){
    oval(c,q.x,q.y-height,r,ry,'#00000000','#507e8c',7);
    oval(c,q.x,q.y-height-2,r,ry,'#00000000','#dfd6ac',3);
    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2,cx=q.x+Math.cos(a)*r,cy=q.y-height+Math.sin(a)*ry;
      oval(c,cx,cy,6,4,i%2?'#b5e1c5':'#f0d392','#658b91',1);
      const next={x:q.x+Math.cos(a+.12)*r,y:q.y-height+Math.sin(a+.12)*ry};
      line(c,{x:cx,y:cy},next,'#e9f1c7',4);
    }
  }
  cylinder(c,b,u,v,34,32,168,'#e6e8d0','#94b8ac','#f6ead0');
  const tip=p(b,u,v,218);oval(c,tip.x,tip.y,22,22,'#badbcc','#688f96');
  c.beginPath();c.arc(tip.x,tip.y,13,-Math.PI*.2,Math.PI*1.3);c.strokeStyle='#f9efd1';c.lineWidth=3;c.stroke();
  const end={x:tip.x+Math.cos(Math.PI*1.3)*13,y:tip.y+Math.sin(Math.PI*1.3)*13};
  poly(c,[end,{x:end.x-8,y:end.y-1},{x:end.x-2,y:end.y+7}],'#f9efd1','#f9efd1');
  portal(c,b,'AGENT LOOP',42);
}
function memoryArchive(c:Ctx,b:CampusBuilding):void {
  box(c,b,0,0,b.u,b.v,84,'#e4ddee','#b3baca','#d1d8dd');
  for(const side of ['front','right'] as const)wall(c,b,side,side==='front'?0:b.u,side==='front'?b.v:0,()=>{
    const length=side==='front'?b.u:b.v;
    for(let x=17;x<length-23;x+=35){
      if(side==='front'&&Math.abs(x+12-b.u/2)<30)continue;
      pane(c,x,-64,25,41,'#94b6c5');
      for(let j=0;j<4;j++)line(c,{x:x+4,y:-28-j*7},{x:x+19,y:-28-j*7},['#ead6ac','#a8d1b9','#c4b6d4'][j%3]!,3);
    }
  });
  // Stacked archive volumes, then an open book roof with a low centre spine.
  for(let i=0;i<3;i++)box(c,b,12+i*3,10+i*2,b.u-26,b.v-23,8,'#e9e2ce','#b8b9c4',['#b6aad1','#9cbdc7','#c4d4bf'][i]!,86+i*11);
  const mid=b.u/2,back=15,front=b.v-10;
  poly(c,[p(b,17,back,155),p(b,mid,back,117),p(b,mid,front,117),p(b,17,front,155)],'#fff4dc');
  poly(c,[p(b,mid,back,117),p(b,b.u-17,back,155),p(b,b.u-17,front,155),p(b,mid,front,117)],'#e7e7d2');
  for(let v=32;v<front;v+=18){
    line(c,p(b,29,v,151),p(b,mid-8,v,120),'#b3b7bb',1);
    line(c,p(b,mid+8,v,120),p(b,b.u-30,v,151),'#adb7b9',1);
  }
  line(c,p(b,mid,back,119),p(b,mid,front,119),'#a290b0',4);
  const silo=p(b,b.u-25,25,82);
  cylinder(c,b,b.u-25,25,21,85,82,'#d8e8e1','#86b2be','#d4d8e9');
  for(let i=0;i<4;i++)oval(c,silo.x,silo.y-16-i*18,15,6,'#c8dfd6','#94b3bf');
  portal(c,b,'CONTEXT / MEMORY',49);
}
function controlGate(c:Ctx,b:CampusBuilding):void {
  const width=64,h=b.elevation;
  for(const u of [0,b.u-width]){
    box(c,b,u,0,width,b.v,h,'#edf0dd','#b1c5ca','#d5e1d6');
    slab(c,b,u-3,-3,width+6,b.v+6,h+4,'#a2b8c4');
    box(c,b,u+8,13,width-16,b.v-26,18,'#a7bfcc','#7f9fad','#bad4ce',h+5);
    for(let v=30;v<b.v-20;v+=34){const q=p(b,u+width/2,v,h+25);oval(c,q.x,q.y,4,3,'#ecedc1','#7d9d9e');}
  }
  box(c,b,width,25,b.u-width*2,65,28,'#eee6cb','#b3c7c7','#c9dbd0',h-33);
  wall(c,b,'front',0,b.v,()=>{
    // Permission shield on the left; finite budget indicator on the right.
    const x=32;
    poly(c,[{x:x-20,y:-116},{x:x+20,y:-116},{x:x+17,y:-90},{x,y:-78},{x:x-17,y:-90}],'#9ac9bd','#648c98');
    line(c,{x:x-9,y:-99},{x:x-2,y:-93},CREAM,3);line(c,{x:x-2,y:-93},{x:x+11,y:-108},CREAM,3);
    pane(c,15,-64,34,37,'#84aabe');
    const right=b.u-45;pane(c,right,-121,29,72,'#4c748e');
    for(let i=0;i<5;i++){c.fillStyle=i<3?'#c4e7c5':'#ccbea0';c.fillRect(right+5,-62-i*11,19,6);}
    c.fillStyle='#f1dcaf';c.fillRect(b.u/2-34,-74,68,13);
    c.font='bold 9px sans-serif';c.textAlign='center';c.fillStyle=INK;c.fillText('ALLOW / STOP',b.u/2,-64);
  });
  const clock=p(b,b.u/2,57,h-18);
  oval(c,clock.x,clock.y,24,24,'#f4e8c7',GOLD,3);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;line(c,{x:clock.x+Math.cos(a)*17,y:clock.y+Math.sin(a)*17},{x:clock.x+Math.cos(a)*20,y:clock.y+Math.sin(a)*20},INK,1.5);}
  line(c,clock,{x:clock.x-8,y:clock.y-11},INK,2);line(c,clock,{x:clock.x+13,y:clock.y},INK,2);
  portal(c,b,'HARNESS CONTROL',54);
}
function repairLab(c:Ctx,b:CampusBuilding):void {
  box(c,b,0,0,b.u,b.v,64,'#eadbd2','#adc5c4','#d1dfd2');
  box(c,b,0,0,75,b.v,b.elevation,'#f0e3d9','#b6c9c5','#d7d6c4');
  slab(c,b,-3,-3,81,b.v+6,b.elevation+7,'#adbdc1');
  box(c,b,97,16,b.u-118,b.v-50,33,'#c6ddda','#8bb8bb','#b5d8ce',64);
  for(let u=108;u<b.u-25;u+=27){line(c,p(b,u,16,99),p(b,u,b.v-34,99),'#e8eed5',3);}
  wall(c,b,'front',0,b.v,()=>{
    for(let i=0;i<3;i++){
      pane(c,18,-101+i*24,38,16,'#537f93');line(c,{x:23,y:-94+i*24},{x:48,y:-94+i*24},['#aadbc4','#e9cd98','#d4b5c1'][i]!,2);
    }
    pane(c,b.u-58,-48,34,28,'#b1d0ce');
  });
  const terminal=p(b,b.u-28,27,101);
  line(c,terminal,{x:terminal.x,y:terminal.y-39},'#899da1',4);
  oval(c,terminal.x,terminal.y-42,5,5,'#e6b5a4','#f6dfb3');
  for(const side of [-1,1]){c.beginPath();c.arc(terminal.x,terminal.y-43,18,side<0?Math.PI*.8:-Math.PI*.2,side<0?Math.PI*1.2:Math.PI*.2);c.strokeStyle='#9abeb7';c.lineWidth=2;c.stroke();}
  const wrench=p(b,36,b.v/2,b.elevation+20);
  line(c,{x:wrench.x-19,y:wrench.y+9},{x:wrench.x+15,y:wrench.y-13},'#658c98',8);
  oval(c,wrench.x-19,wrench.y+9,8,8,'#c3d7c5','#658c98',3);
  line(c,{x:wrench.x+12,y:wrench.y-11},{x:wrench.x+15,y:wrench.y-23},'#658c98',7);
  line(c,{x:wrench.x+12,y:wrench.y-11},{x:wrench.x+25,y:wrench.y-11},'#658c98',7);
  portal(c,b,'OBSERVE / RECOVER',49);
}

const renderers:Record<DepartmentKind,(c:Ctx,b:CampusBuilding)=>void>={
  'model-core':modelCore,'tool-depot':toolDepot,'loop-tower':loopTower,
  'memory-archive':memoryArchive,'control-gate':controlGate,'repair-lab':repairLab,
};
export function drawDepartmentBuilding(c:Ctx,b:CampusBuilding):void {
  c.save();foundation(c,b);renderers[b.kind as DepartmentKind](c,b);c.restore();
}
