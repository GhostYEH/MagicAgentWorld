import { LANDSCAPES } from './WorldMap';

type Ctx = CanvasRenderingContext2D;
type Plot = typeof LANDSCAPES[number];

function rounded(c: Ctx,x: number,y: number,w: number,h: number,r: number,fill: string,edge?: string): void {
  c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();
  if(edge){c.strokeStyle=edge;c.lineWidth=2;c.stroke();}
}
function line(c: Ctx,x: number,y: number,xx: number,yy: number,color: string,width=1): void {
  c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function circle(c: Ctx,x: number,y: number,r: number,color: string,edge?: string): void {
  c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();if(edge){c.strokeStyle=edge;c.lineWidth=2;c.stroke();}
}
function pave(c: Ctx,p: Plot,color: string,pattern: 'stone'|'brick'|'wood'='stone'): void {
  rounded(c,p.x-6,p.y-6,p.width+12,p.height+12,26,'#86a69a');
  rounded(c,p.x,p.y,p.width,p.height,22,color,'#bbb89e');
  c.save();c.beginPath();c.roundRect(p.x+3,p.y+3,p.width-6,p.height-6,19);c.clip();
  const step=pattern==='brick'?22:pattern==='wood'?18:40;
  c.strokeStyle=pattern==='wood'?'#b09f7c66':'#b7b49b55';c.lineWidth=1;
  for(let y=p.y;y<p.y+p.height;y+=step){
    line(c,p.x,y,p.x+p.width,y,c.strokeStyle as string);
    if(pattern!=='wood')for(let x=p.x+(Math.floor((y-p.y)/step)%2)*step*.6;x<p.x+p.width;x+=step*1.6)line(c,x,y,x,y+step,c.strokeStyle as string);
  }
  c.restore();
}
function bed(c: Ctx,x: number,y: number,w: number,h: number,flowers=false): void {
  rounded(c,x+2,y+3,w,h,Math.min(12,h/2),'#718f9a55');
  rounded(c,x,y,w,h,Math.min(12,h/2),'#8ab594','#659c89');
  for(let i=0;i<Math.ceil(w*h/135);i++){
    const px=x+6+(i*31%Math.max(1,w-12)),py=y+5+(i*17%Math.max(1,h-10));
    if(flowers){circle(c,px,py,3,i%3?'#f0b4c4':'#f4d795');circle(c,px-1,py-1,1.2,'#fff0d1');}
    else{c.beginPath();c.ellipse(px,py,5,2,i*.4,0,Math.PI*2);c.fillStyle=i%3?'#b4ce9d':'#669b89';c.fill();}
  }
}
function sports(c: Ctx,p: Plot): void {
  rounded(c,p.x-9,p.y-9,p.width+18,p.height+18,74,'#c3c8a3');
  rounded(c,p.x,p.y,p.width,p.height,68,'#d9a994','#a17f86');
  for(let i=1;i<=4;i++){
    c.beginPath();c.roundRect(p.x+i*9,p.y+i*9,p.width-i*18,p.height-i*18,68-i*9);c.strokeStyle='#f5dfc7';c.lineWidth=1.3;c.stroke();
  }
  const x=p.x+72,y=p.y+49,w=p.width-144,h=p.height-98;
  rounded(c,x,y,w,h,7,'#96bb96');
  for(let i=0;i<8;i++){c.fillStyle=i%2?'#9fc29b':'#8eb393';c.fillRect(x+i*w/8,y,w/8,h);}
  c.strokeStyle='#edf0cf';c.lineWidth=2;c.strokeRect(x+6,y+6,w-12,h-12);
  line(c,x+w/2,y+6,x+w/2,y+h-6,'#edf0cf',2);
  c.beginPath();c.arc(x+w/2,y+h/2,37,0,Math.PI*2);c.stroke();
  for(const gx of [x+6,x+w-74]){c.strokeRect(gx,y+h/2-48,68,96);c.strokeRect(gx===x+6?gx:gx+37,y+h/2-25,31,50);}
  for(const gx of [x-6,x+w+6]){
    line(c,gx,y+h/2-20,gx,y+h/2+20,'#f5efda',5);
    line(c,gx,y+h/2-20,gx+(gx<x?-10:10),y+h/2-24,'#9aa996',2);
    line(c,gx,y+h/2+20,gx+(gx<x?-10:10),y+h/2+16,'#9aa996',2);
  }
  // Low painted seating terraces, outside the playing route.
  for(let i=0;i<3;i++)rounded(c,p.x+105,p.y-29-i*10,p.width-210,8,2,i%2?'#d6d0b4':'#a8c0b2','#8baba1');
}
function starGarden(c: Ctx,p: Plot): void {
  pave(c,p,'#b7cbd1');
  const x=p.x+p.width*.83,y=p.y+p.height*.76;
  circle(c,x,y,75,'#83a9b8','#e3e7cf');
  for(const r of [32,52,68]){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.strokeStyle='#d6e6d1';c.lineWidth=1.5;c.stroke();}
  const points=[[x-48,y-25],[x-25,y-11],[x+2,y-36],[x+27,y-8],[x+48,y+18],[x+5,y+34],[x-20,y+15]];
  for(let i=1;i<points.length;i++)line(c,points[i-1]![0]!,points[i-1]![1]!,points[i]![0]!,points[i]![1]!,'#e9e6bc',2);
  for(const [px,py]of points){circle(c,px!,py!,5,'#f2dfab');circle(c,px!,py!,2,'#fff5cc');}
  for(const sx of [p.x+18,p.x+p.width-42])bed(c,sx,p.y+25,24,p.height-50,false);
}
function botanical(c: Ctx,p: Plot): void {
  rounded(c,p.x,p.y,p.width,p.height,50,'#b5cda4','#81aa92');
  rounded(c,p.x+28,p.y+24,p.width-56,p.height-48,30,'#e8dfbe');
  for(let col=0;col<5;col++)for(let row=0;row<2;row++)bed(c,p.x+50+col*130,p.y+44+row*90,102,60,col%2===0);
  line(c,p.x+30,p.y+p.height/2,p.x+p.width-30,p.y+p.height/2,'#f6ebcf',13);
}
function yard(c: Ctx,p: Plot): void {
  pave(c,p,'#dccbb3');
  for(let i=0;i<Math.max(1,Math.floor(p.width/125));i++){
    const x=p.x+75+i*125,y=p.y+55;
    c.strokeStyle='#ac9a8a';c.lineWidth=2;c.strokeRect(x,y,92,82);
    for(let k=0;k<6;k++)line(c,x+k*15,y+82,x+8+k*15,y+73,k%2?'#8b8f8b':'#e4bd7d',4);
  }
  for(const y of [p.y+p.height-59,p.y+p.height-51])line(c,p.x+30,y,p.x+p.width-30,y,'#879a98',3);
  for(let x=p.x+35;x<p.x+p.width-30;x+=16)line(c,x,p.y+p.height-61,x,p.y+p.height-49,'#acb49f',2);
}
function controlCourt(c: Ctx,p: Plot): void {
  pave(c,p,'#e0e5d3');
  // Formal symmetric beds and a central entry aisle face the clock tower.
  for(const x of [p.x+24,p.x+p.width-118])for(const y of [p.y+17,p.y+p.height-69]){
    rounded(c,x-4,y-4,98,60,5,'#cacbb0');bed(c,x,y,90,52,false);
  }
  const cx=p.x+p.width/2;
  for(let i=0;i<Math.floor((p.height-30)/35);i++)rounded(c,cx-35,p.y+20+i*35,70,25,2,'#cad8cd','#a5bfb8');
}
function repairCourt(c: Ctx,p: Plot): void {
  pave(c,p,'#c8d9cf');
  const cx=p.x+190,cy=p.y+140;
  circle(c,cx,cy,76,'#a4c5b2','#dce7ce');
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;line(c,cx+Math.cos(a)*69,cy+Math.sin(a)*69,cx+Math.cos(a)*82,cy+Math.sin(a)*82,'#dfe7ce',8);}
  rounded(c,cx-17,cy-54,34,108,3,'#dce8c9');rounded(c,cx-54,cy-17,108,34,3,'#dce8c9');
  for(let i=0;i<3;i++){c.strokeStyle='#a3b29f';c.lineWidth=2;c.strokeRect(p.x+35+i*110,p.y+p.height-67,86,42);}
}
function festival(c: Ctx,p: Plot): void {
  pave(c,p,'#ead8b5','brick');
  const x=p.x+p.width/2,y=p.y+p.height/2,r=Math.min(74,p.height*.4);
  circle(c,x,y,r,'#d7cba0','#f2e5c1');circle(c,x,y,r*.74,'#c1d4b0');
  c.fillStyle='#ebd7a0';c.beginPath();
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2-Math.PI/2,r=i%2?19:46;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.fill();
  for(const sx of [p.x+22,p.x+p.width-52])bed(c,sx,p.y+38,30,p.height-76,true);
}
function awakening(c: Ctx,p: Plot): void {
  pave(c,p,'#f3ead1');
  for(const sx of [p.x+14,p.x+p.width-34])bed(c,sx,p.y+40,20,110,true);
  for(const sx of [p.x+30,p.x+p.width-115])bed(c,sx,p.y+p.height-31,85,17,true);
  rounded(c,p.x+p.width/2-60,p.y+29,120,8,2,'#d3d6b9');
}
function reading(c: Ctx,p: Plot): void {
  pave(c,p,'#e1c9b6','brick');
  for(const y of [p.y+16,p.y+p.height-34])bed(c,p.x+20,y,p.width-40,18,true);
  rounded(c,p.x+56,p.y+77,126,122,16,'#c2d2ad');
  for(let i=0;i<4;i++)line(c,p.x+72+i*26,p.y+86,p.x+72+i*26,p.y+189,'#e8dfba',3);
}
function residence(c: Ctx,p: Plot): void {
  rounded(c,p.x,p.y,p.width,p.height,30,'#b5cca7');
  rounded(c,p.x+20,p.y+55,p.width-40,p.height-95,15,'#e5dcc0','#c2b69e');
  for(const x of [p.x+30,p.x+p.width-139])bed(c,x,p.y+p.height-30,100,20,true);
  for(let i=0;i<7;i++)rounded(c,p.x+115+i*68,p.y+p.height-29,39,17,4,'#ede3c7');
}

/** Paving and outdoor activities form distinct neighbourhoods on the shared ground. */
export function drawCampusLandscape(c: Ctx): void {
  for(const p of LANDSCAPES){
    c.save();
    switch(p.id){
      case 'sports':sports(c,p);break;
      case 'botanical':botanical(c,p);break;
      case 'engineering':yard(c,p);break;
      case 'engineering-service':pave(c,p,'#dccbb3');break;
      case 'stargarden':starGarden(c,p);break;
      case 'control':controlCourt(c,p);break;
      case 'control-gate':controlCourt(c,p);break;
      case 'repair':repairCourt(c,p);break;
      case 'festival':festival(c,p);break;
      case 'awakening':awakening(c,p);break;
      case 'reading':reading(c,p);break;
      case 'residence':residence(c,p);break;
      case 'cafe':pave(c,p,'#dcc7a5','wood');bed(c,p.x+10,p.y+15,p.width-20,16,true);break;
    }
    c.restore();
  }
  // A waterside deck complements the existing lily pond without spanning its collision.
  rounded(c,2630,1760,70,145,5,'#dbc8a5','#aeaa8b');
  for(let y=1765;y<1900;y+=12)line(c,2632,y,2698,y,'#b5a58c',1.5);
  line(c,2696,1762,2696,1902,'#c0b693',4);
  for(let y=1768;y<1900;y+=28)line(c,2696,y,2696,y-19,'#f1e4c5',4);
}
