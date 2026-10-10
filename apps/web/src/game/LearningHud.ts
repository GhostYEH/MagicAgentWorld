import Phaser from 'phaser';
import {button,label,panel} from './widgets';
import {toView,VIEW} from './WorldProjection';
import {STATUS_NAME,type HomeWorld,type HomeModule} from './HomeLearning';
import type {WorldSnapshot} from './WorldScene';

interface Actions {locate:()=>void;go:()=>void;preview:()=>void;interact:()=>void;inventory:()=>void;guide:()=>void;atlas:()=>void;pause:()=>void;simulation:()=>void}
export class LearningHud {
  readonly root:Phaser.GameObjects.Container;
  private identity:Phaser.GameObjects.Text;
  private chapter:Phaser.GameObjects.Text;
  private tag:Phaser.GameObjects.Text;
  private missionTitle:Phaser.GameObjects.Text;
  private target:Phaser.GameObjects.Text;
  private description:Phaser.GameObjects.Text;
  private taskState:Phaser.GameObjects.Text;
  private total:Phaser.GameObjects.Text;
  private system:Phaser.GameObjects.Graphics;
  private simulation:Phaser.GameObjects.Text;
  private status:Phaser.GameObjects.Text;
  private player:Phaser.GameObjects.Arc;
  private mapMarkers:Phaser.GameObjects.Graphics;
  private mapOrigin:{x:number;y:number;width:number;height:number};
  private tooltip:Phaser.GameObjects.Container|null=null;
  private hideTimer:Phaser.Time.TimerEvent|null=null;
  private hovered:string|null=null;
  private tooltipHeight=0;
  private simulationReady=false;
  readonly locatePoint:{x:number;y:number};
  readonly goPoint:{x:number;y:number};
  readonly previewPoint:{x:number;y:number};

  constructor(private scene:Phaser.Scene,actions:Actions){
    const width=scene.scale.width,height=scene.scale.height,compact=height<830;
    this.root=scene.add.container(0,0);
    const add=(...objects:Phaser.GameObjects.GameObject[])=>this.root.add(objects);
    const x=20,w=278;
    add(panel(scene,x,20,w,94),scene.add.image(x+37,55,'explorer-portrait').setDisplaySize(48,48));
    add(label(scene,x+72,33,'探索者',16));
    this.identity=label(scene,x+72,58,'Agent Trainee · Lv.01',10,'#668297');
    this.chapter=label(scene,x+18,88,'',10,'#718399');add(this.identity,this.chapter);
    add(label(scene,width/2,23,'Agent 架构城 · 部门地图',18).setOrigin(.5,0).setFontStyle('bold').setPadding(12,6).setBackgroundColor('#fff7e6'));
    add(label(scene,width/2,58,'大模型 + Harness  ·  逐步启动你的 AC–01',10,'#54798b').setOrigin(.5,0).setPadding(7,3).setBackgroundColor('#fff7e6'));
    add(button(scene,width-234,44,98,'M  地图总览',actions.atlas),button(scene,width-125,44,96,'I  系统碎片',actions.inventory),button(scene,width-44,44,48,'Ⅱ',actions.pause));

    const y=134,missionH=compact?252:266;
    add(panel(scene,x,y,w,missionH));
    add(label(scene,x+18,y+18,'当前任务',11,'#587f95'));
    this.tag=label(scene,x+w-18,y+20,'',8,'#8a998e').setOrigin(1,0);
    this.missionTitle=label(scene,x+18,y+46,'',19).setFontStyle('bold').setWordWrapWidth(w-36,true);
    this.target=label(scene,x+18,y+90,'',14,'#4c8098').setWordWrapWidth(w-36,true);
    this.description=label(scene,x+18,y+126,'',12,'#687e91').setWordWrapWidth(w-36,true);
    this.taskState=label(scene,x+18,y+missionH-76,'',10,'#7a8d91').setWordWrapWidth(w-36,true);
    this.locatePoint={x:x+84,y:y+missionH-33};this.goPoint={x:x+212,y:y+missionH-33};
    add(this.tag,this.missionTitle,this.target,this.description,this.taskState,
      button(scene,this.locatePoint.x,this.locatePoint.y,116,'定位目标',actions.locate,true),button(scene,this.goPoint.x,this.goPoint.y,108,'前往场馆 →',actions.go));

    const sy=y+missionH+14,sh=compact?194:208;
    add(panel(scene,x,sy,w,sh));
    add(label(scene,x+18,sy+17,'AGENT SYSTEM',9,'#7f958f'),label(scene,x+18,sy+39,'系统启动进度',15));
    this.total=label(scene,x+w-18,sy+39,'0 / 6',15,'#5d8794').setOrigin(1,0);
    this.system=scene.add.graphics({x:x+20,y:sy+81});
    add(this.total,this.system);
    const names=['模型','工具','循环','Harness','修复','总装'];
    names.forEach((name,i)=>add(label(scene,x+29+i*44,sy+100,name,8,'#758b92').setOrigin(.5,0)));
    add(label(scene,x+18,sy+125,'最终目标 · 让 AC–01 完成多阶段任务',10,'#758893'));
    const bg=scene.add.rectangle(x+w/2,sy+sh-31,w-36,34,0xe5ece6).setStrokeStyle(1,0xb8c9c3);
    this.simulation=label(scene,x+w/2,sy+sh-31,'完整运行模式 · 完成六章后解锁',10,'#82939b').setOrigin(.5);
    bg.setInteractive({useHandCursor:true}).on('pointerdown',(_p:unknown,_x:unknown,_y:unknown,event:Phaser.Types.Input.EventData)=>{
      event.stopPropagation();actions.simulation();
    });add(bg,this.simulation);

    this.previewPoint={x:width-101,y:104};
    add(button(scene,this.previewPoint.x,this.previewPoint.y,156,'▷  Agent 流程预览',actions.preview));
    const hotY=height-43;
    add(panel(scene,width/2-248,hotY-30,496,61));
    add(button(scene,width/2-181,hotY,114,'E / 点击  交互',actions.interact,true),button(scene,width/2-59,hotY,114,'I  系统碎片',actions.inventory),button(scene,width/2+63,hotY,114,'H  操作指南',actions.guide),button(scene,width/2+185,hotY,114,'M  总览 / 返回',actions.atlas));
    this.status=label(scene,width/2,height-91,'',10,'#4f6d83').setOrigin(.5).setPadding(10,5).setBackgroundColor('#fff8e6');add(this.status);
    add(label(scene,24,height-45,'WASD 自由探索 · Shift 快跑',9,'#526f82'),label(scene,24,height-25,'鼠标也能完成导航与交互',9,'#7a9298'));
    const mw=height<800?156:178,mh=mw*VIEW.height/VIEW.width;
    this.mapOrigin={x:width-mw-25,y:height-mh-103,width:mw,height:mh};
    const m=this.mapOrigin;
    add(panel(scene,m.x-7,m.y-22,mw+14,mh+31));add(label(scene,m.x+3,m.y-14,'方向地图',8,'#738c91'));
    const image=scene.add.image(m.x,m.y,'campus').setOrigin(0).setDisplaySize(mw,mh).setAlpha(.66).setInteractive({useHandCursor:true});
    image.on('pointerdown',(_p:unknown,_x:unknown,_y:unknown,event:Phaser.Types.Input.EventData)=>{event.stopPropagation();actions.atlas();});
    this.mapMarkers=scene.add.graphics();this.player=scene.add.circle(0,0,3,0x5685a5).setStrokeStyle(1,0xfff6e1);
    add(image,this.mapMarkers,this.player);
    scene.input.on('pointermove',this.trackTooltip,this);
  }

  update(snapshot:WorldSnapshot,world:HomeWorld,toolCount:number):void {
    const stage=world.stages.find(s=>s.id===world.current)!;
    this.identity.setText(`Agent Trainee · Lv.${String(Math.min(world.completed+1,6)).padStart(2,'0')}`);
    this.chapter.setText(`当前 ${world.current.replace('C','0')} · ${stage.name}    已完成 ${world.completed} / 6`);
    this.tag.setText(world.mission.tag);
    const title=world.allCompleted?'整座 Agent 城已启动':world.mission.title;
    this.missionTitle.setFontSize(title.length>14?16:19).setText(title);
    this.target.setText(`目标场馆 · ${world.target.name}`);
    this.description.setText(world.allCompleted?'六章学习已完成，各项能力已接入 AC–01。':world.mission.description);
    this.taskState.setText(world.current==='C1'?`系统碎片 ${snapshot.collected}/3 · ${snapshot.awakened?'伙伴已连接':'伙伴等待连接'}`:world.current==='C2'?`能力插槽 ${toolCount}/3 · 核对回执后完成学习`:world.allCompleted?'全部核心能力已启动':'区域已开放 · 教学玩法仍在建设中');
    this.total.setText(`${world.completed} / 6`);
    this.system.clear();
    world.stages.forEach((s,i)=>{
      const color=s.status==='completed'?0x88b5a6:s.status==='current'?0xd6b879:0xd5ded8;
      if(i<5)this.system.lineStyle(2,0xcad7d0).lineBetween(i*44+9,0,(i+1)*44+9,0);
      this.system.fillStyle(color).fillRoundedRect(i*44, -9,18,18,4).lineStyle(1,0x93aca8).strokeRoundedRect(i*44,-9,18,18,4);
      if(s.status==='completed')this.system.lineStyle(2,0xfff9e7).lineBetween(i*44+4,0,i*44+8,4).lineBetween(i*44+8,4,i*44+14,-4);
    });
    this.simulationReady=world.allCompleted;
    this.simulation.setText(world.allCompleted?'启动 Agent  ·  完整运行模式':'完整运行模式 · 完成六章后解锁').setColor(world.allCompleted?'#4c8098':'#82939b');
    const map=this.mapOrigin,p=toView(snapshot);
    this.player.setPosition(map.x+p.x/VIEW.width*map.width,map.y+p.y/VIEW.height*map.height);
    this.mapMarkers.clear();
    for(const module of world.modules){
      const v=toView(module),x=map.x+v.x/VIEW.width*map.width,y=map.y+v.y/VIEW.height*map.height;
      const color=module.status==='current'?0xd3ac62:module.status==='completed'?0x82b5a4:module.status==='available'?0x79a6b5:0xafbfbc;
      this.mapMarkers.fillStyle(color).fillCircle(x,y,module.status==='current'?4:2);
      if(module.status==='current')this.mapMarkers.lineStyle(1,0xfdf4da).strokeCircle(x,y,6);
    }
    this.status.setText(snapshot.navigation?`前往 ${snapshot.navigation.name} · 约 ${snapshot.navigation.distance} 米 · 移动键取消寻路`:snapshot.atlas?'当前目标以金色标记 · 悬停查看建筑 · 灰色区域尚未开放':`${snapshot.region} · 点击目标或按 E 交互`);
    document.getElementById('game')!.dataset.home=JSON.stringify({...world,locate:this.locatePoint,go:this.goPoint,preview:this.previewPoint,simulationReady:this.simulationReady});
  }

  showTooltip(module:HomeModule,x:number,y:number):void {
    if(this.containsTooltip(x,y))return;
    this.hideTimer?.remove(false);this.hideTimer=null;
    if(this.hovered===module.id&&this.tooltip)return;
    this.tooltip?.destroy(true);this.hovered=module.id;
    const w=262,h=module.status==='locked'?168:184;
    const px=Phaser.Math.Clamp(x+18,310,this.scene.scale.width-w-16),py=Phaser.Math.Clamp(y+20,144,this.scene.scale.height-h-82);
    const root=this.scene.add.container(px,py).setDepth(60);
    const bg=panel(this.scene,0,0,w,h).removeInteractive();root.add(bg);
    root.add(label(this.scene,16,17,module.name,16).setFontStyle('bold'));
    root.add(label(this.scene,16,44,`核心模块 · Chapter ${module.chapter.slice(1)} · ${STATUS_NAME[module.status]}`,10,'#6c8a94'));
    root.add(label(this.scene,16,70,module.description,11,'#778b95').setWordWrapWidth(w-32,true));
    if(module.status==='locked')root.add(label(this.scene,16,h-40,module.unlockCondition,10,'#8c938c').setWordWrapWidth(w-32,true));
    else {
      const go=button(this.scene,w/2,h-29,w-32,'前往场馆 →',()=>{this.hideTooltip(true);this.scene.game.events.emit('world:module-navigate',module.id);},true);
      (go.list[0] as Phaser.GameObjects.Rectangle).on('pointerover',()=>{this.hideTimer?.remove(false);this.hideTimer=null;}).on('pointerout',()=>this.hideTooltip());
      root.add(go);
    }
    this.tooltip=root;this.tooltipHeight=h;document.getElementById('game')!.dataset.hover=JSON.stringify({id:module.id,status:module.status,x:px,y:py,width:w,height:h});
  }
  private containsTooltip(x:number,y:number):boolean {
    const root=this.tooltip;
    return !!root&&x>=root.x&&x<=root.x+262&&y>=root.y&&y<=root.y+this.tooltipHeight;
  }
  private trackTooltip(pointer:Phaser.Input.Pointer):void {
    if(!this.tooltip)return;
    if(this.containsTooltip(pointer.x,pointer.y)){this.hideTimer?.remove(false);this.hideTimer=null;}
    else if(!this.hideTimer)this.hideTooltip();
  }
  hideTooltip(immediate=false):void {
    this.hideTimer?.remove(false);
    const hide=()=>{
      this.hideTimer=null;
      const p=this.scene.input.activePointer;
      if(!immediate&&this.containsTooltip(p.x,p.y))return;
      this.tooltip?.destroy(true);this.tooltip=null;this.hovered=null;document.getElementById('game')!.dataset.hover='';
    };
    if(immediate)hide();else this.hideTimer=this.scene.time.delayedCall(170,hide);
  }
  destroy():void {this.scene.input.off('pointermove',this.trackTooltip,this);this.hideTooltip(true);this.root.destroy(true);}
}
