import Phaser from 'phaser';
import {FLOW_PREVIEW} from './HomeLearning';
import {button,label,panel} from './widgets';

const SEEN='agentcraft.home.preview.seen',DISABLED='agentcraft.home.preview.disabled';
function read(key:string):boolean {try{return localStorage.getItem(key)==='1';}catch{return false;}}
function write(key:string,value:boolean):void {try{localStorage.setItem(key,value?'1':'0');}catch{/* Preview preferences do not block the game. */}}
export class AgentFlowPreview {
  private root:Phaser.GameObjects.Container|null=null;
  private timer:number|null=null;
  private generation=0;
  active=false;
  constructor(private scene:Phaser.Scene){document.getElementById('game')!.dataset.intro='';}
  auto():void {
    if(read(SEEN)||read(DISABLED))return;
    this.timer=window.setTimeout(()=>this.start(),700);
  }
  start():void {
    this.stop(false);this.active=true;const generation=++this.generation;
    const width=Math.min(620,this.scene.scale.width-640),height=142,x=(this.scene.scale.width-width)/2+65,y=this.scene.scale.height-245;
    const root=this.scene.add.container(x,y).setDepth(70);this.root=root;
    root.add(panel(this.scene,0,0,width,height));
    root.add(label(this.scene,20,14,'AGENT FLOW  /  示意预览 · 不计入学习进度',9,'#7b9294'));
    const title=label(this.scene,20,36,'',18).setFontStyle('bold'),detail=label(this.scene,20,69,'',12,'#6f8792');
    const dots=this.scene.add.graphics({x:20,y:height-23});root.add([title,detail,dots]);
    root.add(button(this.scene,width-40,32,54,'跳过',()=>this.stop()));
    let disabled=read(DISABLED);
    const checkbox=this.scene.add.rectangle(width-156,height-24,12,12,disabled?0x83a999:0xfff8e8).setStrokeStyle(1,0x8fa69b);
    const checkLabel=label(this.scene,width-144,height-31,'以后不再自动播放',10,'#7e9293');
    const toggle=()=>{disabled=!disabled;write(DISABLED,disabled);checkbox.setFillStyle(disabled?0x83a999:0xfff8e8);};
    checkbox.setInteractive({useHandCursor:true}).on('pointerdown',(_p:unknown,_x:unknown,_y:unknown,e:Phaser.Types.Input.EventData)=>{e.stopPropagation();toggle();});
    checkLabel.setInteractive({useHandCursor:true}).on('pointerdown',(_p:unknown,_x:unknown,_y:unknown,e:Phaser.Types.Input.EventData)=>{e.stopPropagation();toggle();});
    root.add([checkbox,checkLabel]);
    this.scene.game.events.emit('world:flow-start');
    const show=(index:number)=>{
      if(!this.active||generation!==this.generation)return;
      const step=FLOW_PREVIEW[index]!;title.setText(step.title);detail.setText(step.detail);
      dots.clear();FLOW_PREVIEW.forEach((_s,i)=>dots.fillStyle(i===index?0xd1b274:i<index?0x8fb5a5:0xd9e3dd).fillCircle(i*19,0,i===index?4:3));
      this.scene.game.events.emit('world:flow-step',step.region);
      document.getElementById('game')!.dataset.intro=JSON.stringify({active:true,index,title:step.title,skip:{x:x+width-40,y:y+32},disable:{x:x+width-156,y:y+height-24}});
      this.timer=window.setTimeout(()=>index===FLOW_PREVIEW.length-1?this.stop():show(index+1),index===FLOW_PREVIEW.length-1?1400:1000);
    };
    show(0);
  }
  stop(notify=true):void {
    const wasActive=this.active;
    if(this.timer!==null)window.clearTimeout(this.timer);
    this.timer=null;this.generation++;this.root?.destroy(true);this.root=null;this.active=false;
    document.getElementById('game')!.dataset.intro='';
    if(wasActive){write(SEEN,true);if(notify)this.scene.game.events.emit('world:flow-stop');}
  }
  destroy():void {this.stop(false);}
}
