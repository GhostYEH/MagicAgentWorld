import Phaser from 'phaser';

function shape(c:CanvasRenderingContext2D,points:number[][],fill:string,stroke='#344965'):void {
  c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0]!,p[1]!):c.moveTo(p[0]!,p[1]!));c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=2;c.lineJoin='round';c.stroke();
}
function oval(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,fill:string,stroke?:string):void {
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}
}

/** Original chibi explorer and cel-shaded robot, drawn in one coherent anime palette. */
export function createExplorerTexture(scene:Phaser.Scene):void {
  if(scene.textures.exists('explorer'))return;
  const t=scene.textures.createCanvas('explorer',192,256)!,c=t.context;
  // Satchel, boots and academy jacket.
  shape(c,[[128,121],[146,132],[146,187],[127,192],[120,141]],'#a27856');
  shape(c,[[75,177],[91,178],[88,226],[71,226]],'#344762');
  shape(c,[[100,178],[117,176],[122,224],[104,228]],'#40536e');
  shape(c,[[71,217],[89,217],[89,232],[66,232],[65,226]],'#596d85');
  shape(c,[[105,217],[122,217],[132,225],[130,232],[105,232]],'#596d85');
  c.fillStyle='#e7d4b2';c.fillRect(67,231,23,4);c.fillRect(105,231,26,4);
  shape(c,[[65,117],[78,108],[110,107],[128,119],[124,183],[73,185]],'#6598b6');
  shape(c,[[66,120],[50,136],[53,172],[66,175],[75,128]],'#eaf2f4');
  shape(c,[[124,119],[141,131],[144,166],[132,173],[118,135]],'#eaf2f4');
  oval(c,59,178,7,8,'#ffe4cf','#7e6c77');oval(c,138,173,7,8,'#ffe4cf','#7e6c77');
  shape(c,[[79,106],[95,121],[112,108],[108,131],[94,141],[79,129]],'#fff9ed');
  shape(c,[[94,126],[103,140],[97,166],[89,141]],'#e5c789');
  c.strokeStyle='#cfe5ed';c.lineWidth=3;c.beginPath();c.moveTo(82,149);c.lineTo(80,171);c.moveTo(113,144);c.lineTo(115,170);c.stroke();
  c.fillStyle='#f7e8b5';c.beginPath();c.arc(119,130,4,0,Math.PI*2);c.fill();
  shape(c,[[69,179],[125,177],[124,188],[72,190]],'#e9f1ec');
  // A youthful adult student rendered with anime eyes, bangs and soft cheek colour.
  oval(c,96,78,42,43,'#ffe8d4','#765e68');
  oval(c,54,78,7,11,'#ffdfcd','#765e68');oval(c,138,78,7,11,'#ffdfcd','#765e68');
  c.fillStyle='#2f4565';c.strokeStyle='#273a56';c.lineWidth=2.5;c.beginPath();
  c.moveTo(54,83);c.bezierCurveTo(43,38,67,15,96,19);c.bezierCurveTo(126,8,151,39,138,83);
  c.lineTo(132,59);c.lineTo(114,42);c.lineTo(119,65);c.lineTo(103,52);c.lineTo(105,72);
  c.lineTo(89,51);c.lineTo(80,70);c.lineTo(78,52);c.lineTo(62,73);c.closePath();c.fill();c.stroke();
  c.strokeStyle='#708fad';c.lineWidth=2;c.beginPath();c.moveTo(68,44);c.quadraticCurveTo(78,26,97,28);c.moveTo(107,28);c.quadraticCurveTo(126,28,134,45);c.stroke();
  for(const x of [79,112]){
    oval(c,x,83,10,12,'#fffdf4');
    oval(c,x+1,85,6.5,9.5,'#4e91a7');oval(c,x+1,86,3.5,7,'#244a67');
    oval(c,x-1,80,2.6,3.2,'#fffef6');oval(c,x+4,89,1.3,1.5,'#b7f6df');
    c.strokeStyle='#34435c';c.lineWidth=3;c.beginPath();c.moveTo(x-10,76);c.quadraticCurveTo(x,70,x+10,78);c.stroke();
  }
  oval(c,68,99,9,3.5,'#ecacac66');oval(c,124,99,9,3.5,'#ecacac66');
  c.strokeStyle='#b78881';c.lineWidth=1.5;c.beginPath();c.moveTo(95,95);c.lineTo(98,96);c.stroke();
  c.strokeStyle='#9e6e78';c.lineWidth=2;c.beginPath();c.moveTo(88,104);c.quadraticCurveTo(96,111,105,104);c.stroke();
  // Hair clip and small floating scarf ends.
  c.strokeStyle='#eccb83';c.lineWidth=3;c.beginPath();c.moveTo(124,51);c.lineTo(137,57);c.moveTo(122,56);c.lineTo(134,62);c.stroke();
  t.refresh();
  const portrait=scene.textures.createCanvas('explorer-portrait',144,144)!;
  portrait.context.drawImage(t.canvas,36,5,122,125,5,1,136,139);portrait.refresh();
  const bot=scene.textures.createCanvas('companion',160,204)!,b=bot.context;
  const rr=(x:number,y:number,w:number,h:number,r:number,fill:string,stroke='#546786')=>{
    b.beginPath();b.roundRect(x,y,w,h,r);b.fillStyle=fill;b.fill();b.strokeStyle=stroke;b.lineWidth=2.5;b.stroke();
  };
  rr(53,121,52,45,16,'#f7f5e9');rr(56,162,18,18,6,'#d3e6ee');rr(88,162,18,18,6,'#d3e6ee');
  rr(33,132,15,28,7,'#a9d1df');rr(113,132,15,28,7,'#a9d1df');
  b.strokeStyle='#738ab0';b.lineWidth=3;b.beginPath();b.moveTo(80,50);b.lineTo(80,31);b.stroke();
  oval(b,80,28,6,6,'#eccb86','#596e8c');
  rr(25,48,110,77,28,'#fffaf0');rr(32,60,96,47,19,'#334a72');
  rr(48,72,13,17,6,'#b3edf0','#b3edf0');rr(97,72,13,17,6,'#b3edf0','#b3edf0');
  b.strokeStyle='#ceeaf6';b.lineWidth=2;b.beginPath();b.moveTo(70,96);b.quadraticCurveTo(81,103,92,96);b.stroke();
  shape(b,[[74,136],[86,136],[89,146],[80,152],[71,146]],'#e4c78f','#ac9165');
  bot.refresh();
}
