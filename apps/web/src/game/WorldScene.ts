import Phaser from 'phaser';
import { DESTINATIONS, FRAGMENTS, type GameState } from './GameState';
import { BUILDINGS, DEPARTMENTS, WORLD, ROBOT, departmentAt } from './WorldMap';
import { createExplorerTexture } from './Portrait';
import { label, COLOR } from './widgets';
import type { Point } from './WorldNavigation';
import { buildCampus } from './WorldTerrain';
import { fromView, groundDepth, groundDirection, toView } from './WorldProjection';
import { ACCESS_REGIONS, actionChapter, chapterSequence, lockedRegionAt, regionContains, type ChapterAccess, type ChapterId } from './ChapterAccess';
import { createRegionGate } from './RegionGate';
import {learningWorld,missionFor} from './HomeLearning';
import {homeMapFrame,coreMapFrame} from './HomeMapFrame';

export interface WorldSnapshot {
  x:number; y:number; collected:number; awakened:boolean; atlas:boolean;
  nearest:string|null; paused:boolean; passed:boolean; region:string;
  visited:number; toolsPassed:boolean; navigation:{name:string; distance:number}|null;
  chapters:ChapterAccess[];
  presentation:'explore'|'focus'|'preview';
}

export class WorldScene extends Phaser.Scene {
  private player!:Phaser.GameObjects.Container;
  private position:Point={x:0,y:0};
  private occluders:Phaser.GameObjects.Image[]=[];
  private opacityMasks=new Map<string,{width:number;height:number;alpha:Uint8Array}>();
  private zoom=1;
  private body!:Phaser.GameObjects.Image;
  private route:Point[]=[];
  private routeAction:string|undefined;
  private routeName='目的地';
  private fragments=new Map<string,Phaser.GameObjects.Container>();
  private npcLabel!:Phaser.GameObjects.Text;
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private atlas=false;
  private paused=false;
  private reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private joystick={x:0,y:0};
  private lastSync=0;
  private lastSave=0;
  private waypoint!:Phaser.GameObjects.Graphics;
  private destinationLabels:Phaser.GameObjects.Container[]=[];
  private actorDot!:Phaser.GameObjects.Arc;
  private gatePieces=new Map<string,Phaser.GameObjects.Graphics[]>();
  private accessKey='';
  private presentation:'explore'|'focus'|'preview'='explore';
  private restoreFocus:Phaser.Time.TimerEvent|null=null;
  private guidePath!:Phaser.GameObjects.Graphics;
  private activeLinks!:Phaser.GameObjects.Graphics;
  private targetHalo!:Phaser.GameObjects.Graphics;
  private onlineLights!:Phaser.GameObjects.Graphics;
  private guideAnchor:Point={x:0,y:0};
  private guideTarget='';

  constructor(private readonly state:GameState){super('World');}

  preload():void {
    const center=this.scale.width/2;
    const text=label(this,center,this.scale.height/2-45,'正在进入 Agent 架构城…',16).setOrigin(.5);
    const bar=this.add.graphics();
    this.load.on('progress',(progress:number)=>{bar.clear().fillStyle(COLOR.mint).fillRoundedRect(center-120,this.scale.height/2,240*progress,3,1);});
    this.load.once('complete',()=>{text.destroy();bar.destroy();});
  }

  create():void {
    this.atlas=false;this.paused=false;this.route=[];this.routeAction=undefined;
    this.accessKey='';this.gatePieces.clear();
    this.presentation='explore';this.restoreFocus=null;this.guideTarget='';
    this.joystick={x:0,y:0};this.lastSync=0;this.lastSave=0;
    this.cameras.main.setBackgroundColor(0x9cc6c3);
    buildCampus(this);
    this.position={x:this.state.progress.x,y:this.state.progress.y};
    this.zoom=coreMapFrame(this.scale.width,this.scale.height).maxZoom*.92;
    this.occluders=this.children.list.filter(o=>o instanceof Phaser.GameObjects.Image&&(o.name.startsWith('building:')||o.name.startsWith('tree:'))) as Phaser.GameObjects.Image[];
    this.opacityMasks.clear();
    for(const object of this.occluders){
      if(this.opacityMasks.has(object.texture.key))continue;
      const canvas=object.texture.getSourceImage() as HTMLCanvasElement;
      const pixels=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
      const alpha=new Uint8Array(canvas.width*canvas.height);
      for(let i=0;i<alpha.length;i++)alpha[i]=pixels[i*4+3]!;
      this.opacityMasks.set(object.texture.key,{width:canvas.width,height:canvas.height,alpha});
    }
    createExplorerTexture(this);
    for(const region of ACCESS_REGIONS)this.gatePieces.set(region.id,createRegionGate(this,region));
    this.destinationLabels=ACCESS_REGIONS.map((department)=>{
      const title=label(this,0,0,department.name,14,'#3b5473').setOrigin(.5).setPadding(10,6).setBackgroundColor('#fff4dc');
      const subtitle=label(this,0,29,department.role,10,'#fff7e5').setOrigin(.5).setPadding(7,4).setBackgroundColor('#6a839f');
      const p=toView(department),core=department.id==='model-core';
      const badge=this.add.graphics();
      const marker=this.add.container(p.x+(core?135:0),p.y+(core?-8:55),[title,subtitle,badge]).setDepth(10000);
      const inspect=(_pointer:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{
        if(this.paused)return;event.stopPropagation();
        this.moveTo(department,'department:'+department.id,department.name);
      };
      for(const object of [title,subtitle])object.setInteractive({useHandCursor:true}).on('pointerdown',inspect);
      const hover=(pointer:Phaser.Input.Pointer)=>{
        if(!this.paused&&this.presentation!=='preview')this.game.events.emit('home:hover',{id:department.id,x:pointer.x,y:pointer.y});
      };
      const leave=()=>this.game.events.emit('home:hover-end');
      for(const object of [title,subtitle])object.on('pointerover',hover).on('pointerout',leave);
      const building=this.children.list.find(o=>o.name==='building:'+department.id) as Phaser.GameObjects.Image;
      building?.setInteractive({useHandCursor:true,pixelPerfect:true,alphaTolerance:180}).on('pointerdown',(pointer:Phaser.Input.Pointer,x:number,y:number,event:Phaser.Types.Input.EventData)=>{
        // In the atlas, labels target departments and the map surface targets ground.
        // Roofs can project over public roads. Atlas clicks always resolve the
        // ground coordinate; moveTo still rejects locked courtyard boundaries.
        if(!this.atlas)inspect(pointer,x,y,event);
      });
      building?.on('pointerover',(pointer:Phaser.Input.Pointer)=>{
        if(!this.paused&&this.presentation!=='preview'){
          if(this.state.isChapterUnlocked(department.chapter))building.setTint(0xfff2db);
          hover(pointer);
        }
      }).on('pointerout',()=>{building.setTint(this.state.isChapterUnlocked(department.chapter)?0xffffff:0xb7c6ce);leave();});
      return marker;
    });
    this.createAmbient();
    this.createToolStation();
    this.waypoint=this.add.graphics().setDepth(4);
    this.guidePath=this.add.graphics().setDepth(4);
    this.activeLinks=this.add.graphics().setDepth(3);
    this.targetHalo=this.add.graphics().setDepth(5);
    this.onlineLights=this.add.graphics().setDepth(5);
    if(!this.reducedMotion)this.tweens.add({targets:this.targetHalo,alpha:.55,duration:1800,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    for(const fragment of FRAGMENTS)if(!this.state.progress.collected.includes(fragment.id))this.createFragment(fragment);

    const robot=toView(ROBOT);
    this.add.ellipse(robot.x,robot.y,36,13,0x163525,.6).setDepth(robot.y);
    const robotSprite=this.add.image(robot.x,robot.y-35,'companion').setDisplaySize(52,67).setDepth(robot.y+1);
    const npcMarker=this.add.circle(robot.x,robot.y-84,12,0x597fa2,.9).setStrokeStyle(1,COLOR.gold,.9).setDepth(10001);
    const question=label(this,robot.x,robot.y-85,'!',17,'#f6d892').setOrigin(.5).setDepth(10002);
    this.npcLabel=label(this,robot.x,robot.y+18,this.state.progress.awakened?'AC–01 · 已连接':'AC–01 · 等待唤醒',10,'#fff7e5').setOrigin(.5).setPadding(6,3).setBackgroundColor('#5c7594').setDepth(10003);
    for(const object of [robotSprite,npcMarker,question,this.npcLabel]){
      object.setInteractive({useHandCursor:true}).on('pointerdown',(_pointer:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{
        if(this.paused||this.atlas)return;
        event.stopPropagation();this.moveTo(ROBOT,'robot','机器人 AC–01');
      });
    }
    if(!this.reducedMotion)this.tweens.add({targets:[npcMarker,question],y:'-=3',duration:1200,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});

    const shadow=this.add.ellipse(0,0,32,12,0x61769b,.3);
    const halo=this.add.ellipse(0,1,34,13).setStrokeStyle(1,0xa1cedd,.7);
    this.body=this.add.image(0,-33,'explorer').setDisplaySize(55,74);
    const name=label(this,0,20,'探索者 · YOU',9,'#fff8e5').setOrigin(.5).setPadding(4,2).setBackgroundColor('#617d9b');
    const spawn=toView(this.position);
    this.player=this.add.container(spawn.x,spawn.y,[shadow,halo,this.body,name]).setDepth(spawn.y+12);
    this.actorDot=this.add.circle(this.player.x,this.player.y,10,COLOR.mint).setStrokeStyle(3,0xffffff).setDepth(11000).setVisible(false);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,E,SHIFT') as Record<string,Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-E',()=>{if(!this.paused&&!this.atlas)this.interact();});
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{
      if(this.paused||this.presentation==='preview'||!(pointer.leftButtonDown()||pointer.wasTouch))return;
      const point=fromView(pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2);
      if(this.atlas) {
        this.moveTo(point);
        return;
      }
      const fragment=FRAGMENTS.find(f=>!this.state.progress.collected.includes(f.id)&&Math.hypot(point.x-f.x,point.y-f.y)<40);
      const destination=DESTINATIONS.find(d=>d.id!=='C1'&&Math.hypot(point.x-d.x,point.y-d.y)<48);
      if(fragment)this.moveTo(fragment,fragment.id,fragment.title);
      else if(Math.hypot(point.x-ROBOT.x,point.y-ROBOT.y)<48)this.moveTo(ROBOT,'robot','机器人 AC–01');
      else if(destination)this.moveTo(destination,destination.id,destination.location);
      else this.moveTo(point);
    });
    this.input.on('wheel',(_pointer:Phaser.Input.Pointer,_over:Phaser.GameObjects.GameObject[],_dx:number,dy:number)=>{
      if(this.paused||this.atlas||this.presentation==='preview')return;
      this.cancelFocus();
      const minZoom=homeMapFrame(this.scale.width,this.scale.height).zoom;
      const maxZoom=coreMapFrame(this.scale.width,this.scale.height).maxZoom;
      this.zoom=Phaser.Math.Clamp(this.zoom-dy*.0003,Math.min(minZoom,maxZoom),maxZoom);this.focusPlayer();
    });

    for(const [event,handler]of this.handlers())this.game.events.on(event,handler,this);
    this.scale.on('resize',this.resize,this);
    this.events.once('shutdown',this.dispose,this);
    this.focusPlayer();this.scene.launch('Hud');this.publish();
    document.getElementById('game')?.setAttribute('data-ready','true');
  }

  private createAmbient():void {
    if(this.reducedMotion)return;
    for(let i=0;i<32;i++) {
      const p=toView({x:150+(i*293)%(WORLD.width-300),y:150+(i*179)%(WORLD.height-300)});
      const glow=this.add.ellipse(p.x,p.y,5,2.5,i%3?0xffd3dd:0xfff1cd,.65).setRotation(i*.5).setDepth(8000);
      this.tweens.add({targets:glow,alpha:.1,x:glow.x+32,y:glow.y+65,rotation:glow.rotation+2,duration:4800+i*83,yoyo:true,repeat:-1,delay:i*36});
    }
  }

  private createFragment(fragment:typeof FRAGMENTS[number]):void {
    const shadow=this.add.ellipse(0,1,42,17,0x6b8d99,.2);
    const base=this.add.graphics();
    base.fillStyle(0x9dbdbb).fillPoints([{x:-17,y:-3},{x:0,y:-11},{x:17,y:-3},{x:17,y:4},{x:0,y:12},{x:-17,y:4}],true);
    base.fillStyle(0xf6ecd2).fillPoints([{x:-17,y:-3},{x:0,y:-11},{x:17,y:-3},{x:0,y:5}],true);
    base.lineStyle(1,0x7c9ba2).strokePoints([{x:-17,y:-3},{x:0,y:-11},{x:17,y:-3},{x:17,y:4},{x:0,y:12},{x:-17,y:4}],true);
    const crystal=this.add.graphics();
    const corners=[{x:0,y:-28},{x:10,y:-13},{x:0,y:3},{x:-10,y:-13}];
    crystal.fillStyle(0x6de2b9).fillPoints(corners,true);
    crystal.fillStyle(0xd4ffe6).fillPoints([corners[0]!,corners[2]!,corners[3]!],true);
    crystal.lineStyle(1,0xffffff,.8).strokePoints(corners,true);
    const title=label(this,0,-43,fragment.title,10,'#fff8e5').setOrigin(.5).setPadding(6,3).setBackgroundColor('#6385a2');
    const p=toView(fragment);
    const object=this.add.container(p.x,p.y,[shadow,base,crystal,title]).setDepth(p.y+8);
    const pick=(_pointer:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{
      if(this.paused||this.atlas)return;
      event.stopPropagation();this.moveTo(fragment,fragment.id,fragment.title);
    };
    title.setInteractive({useHandCursor:true}).on('pointerdown',pick);
    crystal.setInteractive(new Phaser.Geom.Polygon(corners),Phaser.Geom.Polygon.Contains).on('pointerdown',pick);
    this.fragments.set(fragment.id,object);
    if(!this.reducedMotion)this.tweens.add({targets:crystal,y:-4,duration:1300,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
  }

  private createToolStation():void {
    const destination=DESTINATIONS.find(d=>d.id==='C2')!,p=toView(destination);
    const g=this.add.graphics({x:p.x,y:p.y}).setDepth(p.y+5);
    g.fillStyle(0x88a5a9,.25).fillEllipse(0,8,62,23);
    g.fillStyle(0xa2bdbe).fillPoints([{x:-29,y:-8},{x:0,y:-22},{x:29,y:-8},{x:29,y:1},{x:0,y:15},{x:-29,y:1}],true);
    g.fillStyle(0xf7e8c8).fillPoints([{x:-29,y:-8},{x:0,y:-22},{x:29,y:-8},{x:0,y:7}],true);
    g.lineStyle(2,0x77969e).lineBetween(-25,-11,-25,-61).lineBetween(25,-11,25,-61);
    g.fillStyle(0x537c93).fillRoundedRect(-34,-73,68,30,4);
    for(let i=0;i<3;i++){
      g.fillStyle([0xa5dbcd,0xf1d69a,0xd4c5de][i]!).fillRoundedRect(-26+i*19,-65,14,15,2);
      g.lineStyle(1,0xfff3d6,.8).lineBetween(-22+i*19,-58,-16+i*19,-58);
    }
    const name=label(this,p.x,p.y+24,'AC–01 · 工具工坊',10,'#fff8e6').setOrigin(.5).setPadding(6,3).setBackgroundColor('#5c7f98').setDepth(10002);
    for(const object of [g,name]){
      if(object===g)g.setInteractive(new Phaser.Geom.Rectangle(-34,-73,68,88),Phaser.Geom.Rectangle.Contains);
      else object.setInteractive({useHandCursor:true});
      object.on('pointerdown',(_pointer:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{
        if(this.paused||this.atlas)return;
        event.stopPropagation();this.moveTo(destination,'C2','工具工坊');
      });
    }
  }

  private moveTo(point:Point,action?:string,name='目的地'):void {
    if(this.paused||this.presentation==='preview')return;
    this.game.events.emit('home:cancel-preview');
    const region=lockedRegionAt(this.state.save.progress,point),chapter=actionChapter(action)??region?.chapter;
    if(chapter&&this.denyLocked(chapter,region?.name??name))return;
    this.cancelFocus();
    if(this.atlas)this.toggleAtlas();
    const route=this.state.navigation.route(this.position,point);
    if(!route){this.game.events.emit('toast','这里暂时无法到达，请选择附近道路。');return;}
    this.route=route;this.routeAction=action;this.routeName=name;
    const start=toView(this.position);
    this.waypoint.clear().lineStyle(2,0xbbad82,.75).beginPath().moveTo(start.x,start.y);
    route.forEach(p=>{const v=toView(p);this.waypoint.lineTo(v.x,v.y);});this.waypoint.strokePath();
    const end=toView(route[route.length-1]!);
    this.waypoint.lineStyle(2,COLOR.gold,.8).strokeEllipse(end.x,end.y,28,13);
    this.publish();
  }

  private cancelRoute():void {this.route=[];this.routeAction=undefined;this.waypoint.clear();}
  private denyLocked(chapter:ChapterId,location:string):boolean {
    if(this.state.isChapterUnlocked(chapter))return false;
    this.cancelRoute();
    this.game.events.emit('region:locked',{chapter,location});
    return true;
  }
  private focusPlayer():void {
    const camera=this.cameras.main;
    const frame=coreMapFrame(this.scale.width,this.scale.height,this.zoom,this.player);
    this.zoom=frame.zoom;camera.roundPixels=false;
    camera.stopFollow().removeBounds().setZoom(frame.zoom).centerOn(frame.x,frame.y);
    this.updateLabels();
  }

  private nearest():string|null {
    const fragment=FRAGMENTS.find(f=>!this.state.progress.collected.includes(f.id)&&Math.hypot(this.position.x-f.x,this.position.y-f.y)<38);
    if(fragment)return fragment.id;
    if(Math.hypot(this.position.x-ROBOT.x,this.position.y-ROBOT.y)<45)return 'robot';
    const gate=ACCESS_REGIONS.find(r=>!this.state.isChapterUnlocked(r.chapter)&&Math.hypot(this.position.x-r.gate.x,this.position.y-r.gate.y)<55);
    if(gate)return 'gate:'+gate.id;
    const department=DEPARTMENTS.find(d=>Math.hypot(this.position.x-d.x,this.position.y-d.y)<45);
    if(department)return 'department:'+department.id;
    return DESTINATIONS.find(d=>d.id!=='C1'&&Math.hypot(this.position.x-d.x,this.position.y-d.y)<65)?.id??null;
  }

  interact():void {
    if(this.paused||this.atlas||this.presentation==='preview')return;
    this.game.events.emit('home:cancel-preview');
    const nearby=this.nearest(),fragment=FRAGMENTS.find(f=>f.id===nearby);
    if(nearby?.startsWith('gate:')) {
      const region=ACCESS_REGIONS.find(r=>'gate:'+r.id===nearby)!;this.denyLocked(region.chapter,region.name);
    }else if(fragment) {
      this.state.collect(fragment.id);
      const object=this.fragments.get(fragment.id);this.fragments.delete(fragment.id);
      if(object){this.tweens.killTweensOf(object.list);object.destroy();}
      this.game.events.emit('fragment:collected',fragment);this.sparkles(fragment.x,fragment.y);this.publish();
    }else if(nearby==='robot')this.game.events.emit('robot:interact');
    else if(nearby?.startsWith('department:')) {
      const department=DEPARTMENTS.find(d=>'department:'+d.id===nearby)!;
      if(this.denyLocked(department.chapter,department.name))return;
      if(department.chapter==='C2')this.game.events.emit('destination:preview',DESTINATIONS.find(d=>d.id==='C2')!);
      else this.game.events.emit('department:inspect',department);
    }else {
      const destination=DESTINATIONS.find(d=>d.id===nearby);
      if(destination){
        if(this.denyLocked(destination.id,destination.location))return;
        this.game.events.emit('destination:preview',destination);
      }else this.game.events.emit('toast','靠近信息、伙伴或区域路牌，再按 E 交互。');
    }
  }

  private sparkles(x:number,y:number):void {
    if(this.reducedMotion)return;
    const point=toView({x,y});x=point.x;y=point.y;
    for(let i=0;i<10;i++) {
      const spark=this.add.circle(x,y-10,2,0xd0fbd5).setDepth(10005);
      this.tweens.add({targets:spark,x:x+Math.cos(i*.63)*32,y:y-15+Math.sin(i*.63)*28,alpha:0,duration:500,onComplete:()=>spark.destroy()});
    }
  }

  toggleAtlas():void {
    if(this.paused)return;
    this.game.events.emit('home:cancel-preview');
    this.cancelFocus();
    this.atlas=!this.atlas;this.cancelRoute();
    this.actorDot.setVisible(this.atlas);
    if(this.atlas)this.frameAtlas();
    else this.focusPlayer();
    this.updateOcclusion();this.updateLabels();this.publish();
  }

  private updateLabels():void {
    const modules=learningWorld(this.state.save.progress).modules;
    this.destinationLabels.forEach((marker,index)=>{
      const d=ACCESS_REGIONS[index]!,open=this.state.isChapterUnlocked(d.chapter);
      const p=toView(open?d:d.gate),core=d.id==='model-core';
      marker.setPosition(p.x+(core?135:0),p.y+(core?-8:55));
      const camera=this.cameras.main;
      {
        const building=this.occluders.find(o=>o.name==='building:'+d.id);
        if(building){const roof=building.getTopCenter();marker.setPosition(roof.x,roof.y+(this.atlas?0:100)+12/camera.zoom);}
      }
      const screenY=(marker.y-camera.scrollY)*camera.zoom+camera.height*camera.originY*(1-camera.zoom);
      marker.setVisible(this.atlas||screenY>100);
      const title=marker.list[0] as Phaser.GameObjects.Text;
      const subtitle=marker.list[1] as Phaser.GameObjects.Text;
      const status=modules[index]!.status,current=status==='current';
      title.setText(`${status==='completed'?'✓ ':''}${d.name}`).setPadding(status==='locked'?24:10,6,10,6)
        .setBackgroundColor(current?'#fff0ca':open?'#fff6e3':'#dce3dc');
      subtitle.setText(`当前目标 · ${d.role}`).setBackgroundColor('#748f91').setVisible(current);
      const badge=marker.list[2] as Phaser.GameObjects.Graphics;badge.clear();
      if(status==='locked'){
        const x=-title.width/2+12;
        badge.lineStyle(1.4,0x7e9193).strokeRoundedRect(x-3,-8,6,7,3).fillStyle(0x7e9193).fillRoundedRect(x-5,-3,10,8,2);
      }
      marker.setScale(1/this.cameras.main.zoom);
    });
    this.actorDot?.setPosition(this.player.x,this.player.y).setScale(this.atlas?1/this.cameras.main.zoom:1);
  }

  private setPaused(value:boolean):void {
    this.paused=value;
    if(value){this.game.events.emit('home:cancel-preview');this.cancelFocus();}
    this.cancelRoute();this.joystick={x:0,y:0};if(value)this.state.persist();this.publish();
  }
  private direction(x:number,y:number):void {this.joystick={x,y};}
  private navigate(id:string):void {
    const destination=DESTINATIONS.find(d=>d.id===id);
    if(!destination||this.paused)return;
    this.moveTo(destination,id,destination.location);
  }
  private awaken():void {if(this.state.progress.collected.length!==FRAGMENTS.length)return;this.state.progress.awakened=true;this.npcLabel.setText('AC–01 · 已连接');this.state.persist();this.sparkles(ROBOT.x,ROBOT.y);this.publish();}
  private setMotion(value:boolean):void {this.reducedMotion=value;if(value)this.tweens.pauseAll();else this.tweens.resumeAll();this.resize();}
  private async reset():Promise<void> {await this.state.reset();this.scene.stop('Hud');this.scene.restart();}
  private resize():void {
    this.cancelFocus();
    if(this.atlas)this.frameAtlas();
    else this.focusPlayer();
    this.updateLabels();this.publish();
  }

  snapshot():WorldSnapshot {
    const distance=this.route.reduce((sum,p,index)=>sum+Math.hypot(p.x-(index?this.route[index-1]!.x:this.position.x),p.y-(index?this.route[index-1]!.y:this.position.y)),0);
    const department=departmentAt(this.position.x,this.position.y),chapters=chapterSequence(this.state.save.progress);
    const accessible=department&&this.state.isChapterUnlocked(department.chapter)?department:undefined;
    const courtyard=ACCESS_REGIONS.find(r=>this.state.isChapterUnlocked(r.chapter)&&regionContains(r,this.position));
    return {x:this.position.x,y:this.position.y,collected:this.state.progress.collected.length,awakened:this.state.progress.awakened,atlas:this.atlas,nearest:this.nearest(),paused:this.paused,passed:chapters[0]!.completed,toolsPassed:chapters[1]!.completed,chapters,presentation:this.presentation,region:courtyard?.name??accessible?.name??'架构花园',visited:this.state.progress.visited.length,navigation:this.route.length?{name:this.routeName,distance:Math.ceil(distance/8)}:null};
  }

  private screenPoint(x:number,y:number):Point {
    const c=this.cameras.main;
    const point=toView({x,y});
    return {x:c.x+(point.x-c.scrollX)*c.zoom+c.width*c.originX*(1-c.zoom),y:c.y+(point.y-c.scrollY)*c.zoom+c.height*c.originY*(1-c.zoom)};
  }

  private publish():void {
    this.syncAccess();
    this.updateGuide();
    this.updateLabels();
    const snapshot=this.snapshot();this.game.events.emit('world:update',snapshot);
    const element=document.getElementById('game');
    if(element)element.dataset.state=JSON.stringify({...snapshot,world:{width:WORLD.width,height:WORLD.height},render:{x:this.player.x,y:this.player.y,depth:this.player.depth,projection:'isometric',zoom:this.cameras.main.zoom,maxZoom:coreMapFrame(this.scale.width,this.scale.height).maxZoom,coreBuildings:this.occluders.filter(o=>DEPARTMENTS.some(d=>'building:'+d.id===o.name)).map(o=>{const bounds=o.getBounds(),c=this.cameras.main,point=this.screenPoint(fromView(bounds).x,fromView(bounds).y);return {id:o.name,...point,width:bounds.width*c.zoom,height:bounds.height*c.zoom};}),occluded:this.occluders.filter(o=>o.alpha<1).map(o=>o.name)},camera:{x:this.cameras.main.scrollX,y:this.cameras.main.scrollY},targets:FRAGMENTS.filter(f=>!this.state.progress.collected.includes(f.id)).map(f=>({id:f.id,...this.screenPoint(f.x,f.y)})),robot:this.screenPoint(ROBOT.x,ROBOT.y),destinations:this.atlas?DESTINATIONS.map(d=>({id:d.id,...this.screenPoint(d.x,d.y)})):[],regions:ACCESS_REGIONS.map((r,i)=>({id:r.id,chapter:r.chapter,unlocked:this.state.isChapterUnlocked(r.chapter),bounds:r.bounds,gate:r.gate,label:this.screenPoint(fromView(this.destinationLabels[i]!).x,fromView(this.destinationLabels[i]!).y)})),departments:DEPARTMENTS.map((d,i)=>{const marker=this.destinationLabels[i]!;const b=BUILDINGS.find(b=>b.id===d.id)!;return {id:d.id,name:d.name,role:d.role,chapter:d.chapter,unlocked:this.state.isChapterUnlocked(d.chapter),...this.screenPoint(d.x,d.y),label:this.screenPoint(fromView(marker).x,fromView(marker).y),footprint:{x:b.x,y:b.y,u:b.u,v:b.v}};})});
  }

  update(time:number,delta:number):void {
    if(!this.player)return;
    if(this.paused||this.atlas||this.presentation==='preview'){
      if(time-this.lastSync>100){this.lastSync=time;this.publish();}return;
    }
    let dx=(this.keys.D!.isDown||this.keys.RIGHT!.isDown?1:0)-(this.keys.A!.isDown||this.keys.LEFT!.isDown?1:0)+this.joystick.x;
    let dy=(this.keys.S!.isDown||this.keys.DOWN!.isDown?1:0)-(this.keys.W!.isDown||this.keys.UP!.isDown?1:0)+this.joystick.y;
    const manual=Boolean(dx||dy);
    if(manual)this.game.events.emit('home:cancel-preview');
    if(manual)this.cancelFocus();
    if(manual){const direction=groundDirection(dx,dy);dx=direction.x;dy=direction.y;}
    let amount=Math.min(delta,40)/1000*(this.keys.SHIFT!.isDown?335:205);
    if(manual)this.cancelRoute();
    else if(this.route.length) {
      const point=this.route[0]!, distance=Math.hypot(point.x-this.position.x,point.y-this.position.y);
      if(distance<3) {
        this.position={...point};this.state.progress.x=point.x;this.state.progress.y=point.y;
        this.route.shift();
        if(!this.route.length) {
          const action=this.routeAction;this.cancelRoute();
          if(action==='C1')this.game.events.emit('toast','已到达大模型中枢，装入记忆片段并与 AC–01 实验。');
          else if(action)this.interact();
        }
      }else {dx=point.x-this.position.x;dy=point.y-this.position.y;amount=Math.min(amount,distance);}
    }
    const length=Math.hypot(dx,dy);
    if(length) {
      if(manual)amount*=length/Math.hypot(dx-dy,(dx+dy)/2);
      const next={x:this.position.x+dx/length*amount,y:this.position.y+dy/length*amount};
      if(this.state.navigation.clear(this.position,next))this.position=next;
      else if(manual) {
        if(this.state.navigation.clear(this.position,{x:next.x,y:this.position.y}))this.position.x=next.x;
        if(this.state.navigation.clear(this.position,{x:this.position.x,y:next.y}))this.position.y=next.y;
      }else this.cancelRoute();
      this.body.setRotation((dx-dy)/length*.04);
      this.body.setFlipX(dx-dy<0);
      this.state.progress.x=this.position.x;this.state.progress.y=this.position.y;
    }else this.body.setRotation(0);
    this.body.y=this.reducedMotion?-33:-33+Math.sin(time/(length?115:370))*(length?1.7:.6);
    const view=toView(this.position);
    this.player.setPosition(view.x,view.y).setDepth(groundDepth(this.position)+12);
    if(this.presentation==='explore'){
      const frame=coreMapFrame(this.scale.width,this.scale.height,this.zoom,this.player);
      this.cameras.main.centerOn(frame.x,frame.y);
    }
    this.updateOcclusion();
    const department=departmentAt(this.position.x,this.position.y);
    if(department&&this.state.visit(department.id))this.game.events.emit('toast',`发现新部门 · ${department.name}`);
    if(time-this.lastSync>100){this.lastSync=time;this.publish();}
    if(time-this.lastSave>1800&&length){this.lastSave=time;this.state.persist();}
  }

  private updateOcclusion():void {
    if(!this.player)return;
    for(const object of this.occluders){
      const mask=this.opacityMasks.get(object.texture.key)!;
      const x=Math.floor((this.player.x-object.x)/object.scaleX+object.displayOriginX);
      const overlap=!this.atlas&&this.presentation!=='preview'&&object.depth>this.player.depth&&[20,40,58].some(offset=>{
        const y=Math.floor((this.player.y-offset-object.y)/object.scaleY+object.displayOriginY);
        return x>=0&&y>=0&&x<mask.width&&y<mask.height&&mask.alpha[y*mask.width+x]!>160;
      });
      object.setAlpha(overlap?(object.name.startsWith('building:')?.48:.65):1);
    }
  }

  private syncAccess():void {
    const chapters=chapterSequence(this.state.save.progress),key=chapters.map(c=>Number(c.unlocked)).join('')+chapters.map(c=>Number(c.completed)).join('');
    if(key===this.accessKey)return;
    const previous=this.accessKey;this.accessKey=key;
    for(const region of ACCESS_REGIONS){
      const locked=!this.state.isChapterUnlocked(region.chapter);
      for(const piece of this.gatePieces.get(region.id)??[])piece.setVisible(locked);
      const building=this.occluders.find(o=>o.name==='building:'+region.id);
      if(building)building.setTint(locked?0xb7c6ce:0xffffff);
    }
    this.drawActivation();
    if(previous){
      for(const [i,chapter]of chapters.entries())if(chapter.completed&&previous[i+6]==='0'){
        const mission=missionFor(chapter.id),module=ACCESS_REGIONS.find(r=>r.id===mission.target)!;
        this.game.events.emit('home:module-online',{id:module.id,name:module.name,capability:mission.capability});
      }
    }
  }

  private updateGuide():void {
    const world=learningWorld(this.state.save.progress);
    this.guidePath.setVisible(this.presentation!=='preview'&&!world.allCompleted);
    this.targetHalo.clear().setVisible(!world.allCompleted&&this.presentation!=='preview');
    const p=toView(world.target);
    this.targetHalo.fillStyle(0xf6de9e,.16).fillEllipse(p.x,p.y,104,48).lineStyle(2,0xd1b679,.55).strokeEllipse(p.x,p.y,104,48);
    this.targetHalo.lineStyle(2,0xab9970,.7).lineBetween(p.x+35,p.y-6,p.x+35,p.y-34);
    this.targetHalo.fillStyle(0xe0bf7d).fillTriangle(p.x+35,p.y-34,p.x+55,p.y-27,p.x+35,p.y-20);
    if(this.guideTarget===world.target.id&&Math.hypot(this.position.x-this.guideAnchor.x,this.position.y-this.guideAnchor.y)<72)return;
    this.guideTarget=world.target.id;this.guideAnchor={...this.position};this.guidePath.clear();
    if(world.allCompleted)return;
    const route=this.state.navigation.route(this.position,world.target);if(!route)return;
    let from=toView(this.position);
    for(const point of route){
      const end=toView(point),length=Math.hypot(end.x-from.x,end.y-from.y);
      for(let d=0;d<length;d+=18)this.guidePath.fillStyle(0xc5a96e,.55).fillCircle(from.x+(end.x-from.x)*d/length,from.y+(end.y-from.y)*d/length,1.7);
      from=end;
    }
  }
  private drawActivation():void {
    this.onlineLights.clear();this.activeLinks.clear();
    const world=learningWorld(this.state.save.progress),core=ACCESS_REGIONS[0]!;
    for(const module of world.modules.filter(m=>m.status==='completed')){
      const p=toView(module);
      this.onlineLights.fillStyle(0xaed6b7,.25).fillEllipse(p.x,p.y,78,35).fillStyle(0xc3dba7,.8).fillRoundedRect(p.x-11,p.y-25,22,5,2);
      if(module.id===core.id)continue;
      const route=this.state.navigation.route(module,core);if(!route)continue;
      const start=toView(module);this.activeLinks.lineStyle(1.5,0xb4c6a6,.55).beginPath().moveTo(start.x,start.y);
      for(const point of route){const end=toView(point);this.activeLinks.lineTo(end.x,end.y);}this.activeLinks.strokePath();
    }
    this.guideTarget='';
  }
  private pulseRegion(id:string):void {
    const region=ACCESS_REGIONS.find(r=>r.id===id);if(!region)return;
    const p=toView(region),pulse=this.add.graphics({x:p.x,y:p.y}).setDepth(p.y+6);
    pulse.lineStyle(3,0xe5c889,.9).strokeEllipse(0,0,110,50).fillStyle(0xffebba,.12).fillEllipse(0,0,110,50);
    if(this.reducedMotion)this.time.delayedCall(1000,()=>pulse.destroy());
    else this.tweens.add({targets:pulse,scaleX:1.5,scaleY:1.5,alpha:0,duration:1200,ease:'Sine.easeOut',onComplete:()=>pulse.destroy()});
  }
  private moduleNavigate(id:string):void {
    if(this.paused)return;
    if(this.presentation==='preview')this.game.events.emit('home:cancel-preview');
    const region=ACCESS_REGIONS.find(r=>r.id===id);
    if(region)this.moveTo(region,'department:'+id,region.name);
  }
  private restoreView():void {
    const camera=this.cameras.main;camera.panEffect.reset();camera.zoomEffect.reset();
    if(this.atlas)this.frameAtlas();
    else this.focusPlayer();
  }
  private frameAtlas():void {
    const frame=homeMapFrame(this.scale.width,this.scale.height);
    this.cameras.main.roundPixels=false;
    this.cameras.main.stopFollow().removeBounds().setZoom(frame.zoom).centerOn(frame.x,frame.y);
  }
  private cancelFocus():void {
    if(this.presentation!=='focus')return;
    this.restoreFocus?.remove(false);this.restoreFocus=null;this.presentation='explore';this.restoreView();
  }
  private locate(id:string):void {
    if(this.paused)return;
    if(this.presentation==='preview')this.game.events.emit('home:cancel-preview');
    const region=ACCESS_REGIONS.find(r=>r.id===id);if(!region)return;
    this.cancelFocus();this.cancelRoute();this.presentation='focus';
    const b=BUILDINGS.find(b=>b.id===id),point=toView(b?{x:b.x+b.u/2,y:b.y+b.v/2}:region);
    const frame=coreMapFrame(this.scale.width,this.scale.height,this.zoom,point);
    const camera=this.cameras.main.stopFollow().removeBounds();
    if(this.reducedMotion)camera.setZoom(frame.zoom).centerOn(frame.x,frame.y);
    else {camera.zoomTo(frame.zoom,600,'Sine.easeInOut',true);camera.pan(frame.x,frame.y,650,'Sine.easeInOut',true);}
    this.pulseRegion(id);this.restoreFocus=this.time.delayedCall(2700,()=>{this.cancelFocus();this.publish();});this.publish();
  }
  private beginFlow():void {
    if(this.paused)return;
    this.cancelFocus();this.cancelRoute();this.presentation='preview';
    this.updateOcclusion();
    const frame=coreMapFrame(this.scale.width,this.scale.height,this.zoom,undefined,300);
    const camera=this.cameras.main.stopFollow().removeBounds();
    if(this.reducedMotion)camera.setZoom(frame.zoom).centerOn(frame.x,frame.y);
    else {camera.zoomTo(frame.zoom,600,'Sine.easeInOut',true);camera.pan(frame.x,frame.y,600,'Sine.easeInOut',true);}
  }
  private flowStep(id:string):void {
    if(this.presentation!=='preview')return;
    const region=ACCESS_REGIONS.find(r=>r.id===id);if(!region)return;
    this.pulseRegion(id);this.publish();
  }
  private endFlow():void {
    if(this.presentation!=='preview')return;
    this.presentation='explore';this.restoreView();this.updateOcclusion();this.publish();
  }

  private handlers() {return [['world:interact',this.interact],['world:atlas',this.toggleAtlas],['world:pause',this.setPaused],['world:awaken',this.awaken],['world:direction',this.direction],['world:navigate',this.navigate],['world:reset',this.reset],['world:motion',this.setMotion],['world:refresh',this.publish],['world:locate',this.locate],['world:module-navigate',this.moduleNavigate],['world:flow-start',this.beginFlow],['world:flow-step',this.flowStep],['world:flow-stop',this.endFlow],['world:feedback-pulse',this.pulseRegion]] as const;}
  private dispose():void {
    this.restoreFocus?.remove(false);this.restoreFocus=null;
    this.state.persist();
    for(const [event,handler]of this.handlers())this.game.events.off(event,handler,this);
    this.scale.off('resize',this.resize,this);this.fragments.clear();
  }
}
