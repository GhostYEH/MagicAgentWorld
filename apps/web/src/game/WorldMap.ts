/** One continuous world; all game anchors share this coordinate system. */
export const WORLD = { width: 3072, height: 2048, margin: 48, version: 3 } as const;
export const SPAWN = { x: 1515, y: 1270 };
export const ROBOT = { x: 1465, y: 1150 };
export const FOUNTAIN = {x:1160,y:1810,radius:68};

export const FRAGMENTS = [
  { id: 'schedule', x: 1390, y: 1210, title: '身份记忆', announcement: 'memory.identity', detail: '装入上下文，AC–01 才能知道自己是谁。' },
  { id: 'dorm', x: 1590, y: 1240, title: '回答边界', announcement: 'memory.boundary', detail: '信息不足时说明未知，识别没有依据的回答。' },
  { id: 'card', x: 1430, y: 1340, title: '工具协议', announcement: 'memory.tools', detail: '理解回答能力与实际执行工具的区别。' },
] as const;

export const DESTINATIONS = [
  { id: 'C1', name: '模型觉醒', location: '大模型中枢', x: 1515, y: 1180 },
  { id: 'C2', name: '工具解锁', location: '工具工坊', x: 605, y: 1192 },
  { id: 'C3', name: 'Agent 诞生', location: '执行循环塔', x: 915, y: 610 },
  { id: 'C4', name: 'Harness 工坊', location: '运行控制塔', x: 2502, y: 1253 },
  { id: 'C5', name: '失控与修复', location: '观察与修复站', x: 1920, y: 1820 },
  { id: 'C6', name: '智能体挑战赛', location: 'Agent 总装台', x: 1515, y: 1615 },
] as const;

export type DepartmentKind = 'model-core'|'tool-depot'|'loop-tower'|'memory-archive'|'control-gate'|'repair-lab';
export type BuildingKind = DepartmentKind | 'academy' | 'workshop' | 'observatory' | 'clocktower' | 'repair' | 'arena' | 'library' | 'cafe' | 'dormitory' | 'greenhouse' | 'gatehouse';
export interface CampusBuilding {
  id: string; kind: BuildingKind; x: number; y: number;
  u: number; v: number; elevation: number; width: number; height: number;
}
function building(id: string, kind: BuildingKind, x: number, y: number, u: number, v: number, elevation: number): CampusBuilding {
  return { id, kind, x, y, u, v, elevation, width: u + v, height: (u + v) / 2 };
}

/** Building ground points in the logical plane; the view projects these only once. */
export function projectBuilding(b: CampusBuilding, u: number, v: number): {x: number; y: number} {
  return { x: b.x + u, y: b.y + v };
}
export function buildingFootprint(b: CampusBuilding): {x: number; y: number}[] {
  return [[0,0],[b.u,0],[b.u,b.v],[0,b.v]].map(([u,v]) => projectBuilding(b,u!,v!));
}

export const BUILDINGS: readonly CampusBuilding[] = [
  building('model-core','model-core',1360,830,310,240,240),
  building('tool-depot','tool-depot',480,970,250,170,112),
  building('loop-tower','loop-tower',800,380,230,180,154),
  building('memory-archive','memory-archive',2030,260,270,180,128),
  building('control-gate','control-gate',2390,1040,225,165,146),
  building('repair-lab','repair-lab',1790,1580,260,180,116),
  building('campus-library','library',195,865,190,115,112),
  building('garden-cafe','cafe',1165,1310,135,85,76),
  building('west-residence','dormitory',310,1715,175,100,105),
  building('east-residence','dormitory',675,1765,175,100,105),
  building('botanical-house','greenhouse',2635,430,130,150,85),
  building('south-gate','gatehouse',1250,1825,115,80,90),
];

export const DEPARTMENTS = [
  {id:'model-core',name:'大模型中枢',code:'LLM',role:'读取上下文 · 生成与决策',x:1515,y:1106,chapter:'C1',color:0x75b8ce},
  {id:'tool-depot',name:'工具工坊',code:'TOOLS',role:'参数 → 执行 → 回执',x:605,y:1176,chapter:'C2',color:0xd5ae76},
  {id:'loop-tower',name:'执行循环塔',code:'LOOP',role:'决策 → 行动 → 观察',x:915,y:596,chapter:'C3',color:0x81b9b0},
  {id:'memory-archive',name:'上下文与记忆馆',code:'MEMORY',role:'当前上下文 · 持久记忆',x:2165,y:476,chapter:'C4',color:0xb3a3cc},
  {id:'control-gate',name:'运行控制塔',code:'CONTROL',role:'权限 · 预算 · 停止条件',x:2502.5,y:1241,chapter:'C4',color:0x849cbd},
  {id:'repair-lab',name:'观察与修复站',code:'RECOVERY',role:'记录 → 定位 → 恢复',x:1920,y:1796,chapter:'C5',color:0xdba7a1},
] as const;

/** Reserved grounds keep vegetation out of the planned courtyards and amenities. */
export const LANDSCAPES = [
  {id:'botanical',x:125,y:110,width:810,height:260},
  {id:'engineering',x:450,y:1165,width:355,height:165},
  {id:'engineering-service',x:750,y:980,width:90,height:155},
  {id:'stargarden',x:760,y:580,width:380,height:125},
  {id:'control',x:2015,y:470,width:330,height:160},
  {id:'control-gate',x:2330,y:1235,width:330,height:155},
  {id:'repair',x:1770,y:1790,width:330,height:140},
  {id:'festival',x:1375,y:1530,width:290,height:170},
  {id:'awakening',x:1320,y:1110,width:425,height:240},
  {id:'sports',x:120,y:1370,width:430,height:260},
  {id:'reading',x:210,y:1100,width:335,height:210},
  {id:'cafe',x:1230,y:1435,width:180,height:185},
  {id:'residence',x:280,y:1725,width:695,height:255},
] as const;

export type PropKind = 'bench' | 'hedge' | 'board' | 'bicycle' | 'crate' | 'crane' | 'telescope' | 'console' | 'table' | 'parasol' | 'repairbot' | 'flag' | 'pergola' | 'planter' | 'banner' | 'toolrack';
export interface CampusProp { id: string; kind: PropKind; x: number; y: number; width: number; height: number; u: number; v: number }
const prop = (id: string, kind: PropKind, x: number, y: number, width = 40, height = 18): CampusProp => {
  const footprint:Partial<Record<PropKind,readonly [number,number]>>={board:[24,24],bicycle:[42,42],telescope:[30,30],table:[46,46],parasol:[46,46],flag:[18,18],banner:[16,16]};
  const [u,v]=footprint[kind]??[width*.65,width*.35];
  return {id,kind,x,y,width,height:Math.max(height,width/2),u,v};
};
export function propFootprint(p: CampusProp): {x:number;y:number;width:number;height:number} {
  return {x:p.x-p.u/2,y:p.y-p.v/2,width:p.u,height:p.v};
}
export const PROPS: readonly CampusProp[] = [
  prop('academy-board','board',1342,1123,30,16),
  prop('academy-bench','bench',1338,1270,62,18),
  prop('academy-bicycles','bicycle',1185,1275,65,20),
  prop('academy-hedge','hedge',1680,1288,120,22),
  prop('yard-crane','crane',790,1045,88,40),
  prop('yard-crates','crate',795,942,62,34),
  prop('yard-tools','console',810,878,50,25),
  prop('observatory-scope','console',1060,633,58,26),
  prop('observatory-bench','bench',815,641,62,18),
  prop('control-console','console',2555,1330,60,26),
  prop('control-board','board',2400,1350,30,16),
  prop('control-hedge','hedge',2335,1320,100,22),
  prop('repair-bot','repairbot',1820,1840,50,28),
  prop('repair-crates','crate',2030,1840,62,34),
  prop('repair-tools','console',2025,1782,50,25),
  prop('arena-flags','flag',1388,1555,32,18),
  prop('arena-flags-east','flag',1655,1560,32,18),
  prop('library-pergola','pergola',250,1160,125,62),
  prop('library-table','table',330,1270,54,32),
  prop('library-board','board',380,1090,30,16),
  prop('cafe-parasol','parasol',1340,1540,60,32),
  prop('cafe-table','table',1350,1580,54,32),
  prop('residence-bicycle','bicycle',500,1895,65,20),
  prop('residence-bench','bench',650,1840,62,18),
  prop('garden-pergola','pergola',2880,1400,125,62),
  prop('pond-bench','bench',2610,1740,62,18),
  prop('north-pergola','pergola',760,260,125,62),
  prop('memory-flowers-nw','planter',1350,1105,42,21),
  prop('memory-flowers-ne','planter',1720,1125,42,21),
  prop('memory-flowers-sw','planter',1370,1300,42,21),
  prop('memory-flowers-se','planter',1720,1305,42,21),
  prop('awakening-banner','banner',1635,1130,30,16),
  prop('cafe-flowers','planter',1325,1382,40,20),
  prop('engineering-rack','toolrack',755,1285,76,38),
  prop('engineering-banner','banner',502,1225,30,16),
  prop('observation-flowers','planter',1110,595,48,24),
  prop('control-flowers','planter',2610,1290,48,24),
  prop('repair-banner','banner',1800,1880,30,16),
  prop('arena-flowers','planter',1675,1705,48,24),
];

export interface CampusRoad { id: string; kind: 'avenue'|'walkway'; points: readonly {x: number; y: number}[]; closed?: boolean }
const path = (id: string, kind: CampusRoad['kind'], coordinates: readonly (readonly [number,number])[]): CampusRoad => ({id,kind,points:coordinates.map(([x,y])=>({x,y}))});
const entry = (id: string): {x: number;y: number} => {
  const b=BUILDINGS.find(b=>b.id===id)!;
  return projectBuilding(b,b.u/2,b.v+36);
};

/** Planned boulevards and short entrance walks. Every branch ends in a court or doorway. */
export const ROADS: readonly CampusRoad[] = [
  {...path('harness-ring','avenue',[[870,740],[2240,740],[2240,1460],[870,1460]]),closed:true},
  path('core-west','avenue',[[870,1180],[1515,1180]]),
  path('core-south','walkway',[[1515,1180],[1515,1460]]),
  path('assembly-entrance','walkway',[[1515,1460],[1515,1724]]),
  path('core-east','avenue',[[1740,1180],[2240,1180]]),
  {id:'core-entrance',kind:'walkway',points:[{x:1515,y:1180},entry('model-core')]},
  path('core-north','walkway',[[1515,740],[1515,800]]),
  {id:'tools-entrance',kind:'walkway',points:[{x:870,y:1192},{x:605,y:1192},entry('tool-depot')]},
  {id:'loop-entrance',kind:'walkway',points:[{x:915,y:740},entry('loop-tower')]},
  {id:'memory-entrance',kind:'walkway',points:[{x:2165,y:740},entry('memory-archive')]},
  {id:'control-entrance',kind:'walkway',points:[{x:2240,y:1253},{x:2502.5,y:1253},entry('control-gate')]},
  {id:'repair-entrance',kind:'walkway',points:[{x:2085,y:1460},{x:2085,y:1815},{x:1920,y:1815},entry('repair-lab')]},
  {id:'library-entrance',kind:'walkway',points:[{x:870,y:1370},{x:430,y:1370},{x:430,y:1016},entry('campus-library')]},
  path('sports-entrance','walkway',[[870,1500],[560,1500]]),
  {id:'cafe-entrance',kind:'walkway',points:[{x:1232.5,y:1460},entry('garden-cafe')]},
  path('residence-lane','walkway',[[950,1460],[950,1950],[2240,1950],[2240,1460]]),
  {id:'west-residence-entrance',kind:'walkway',points:[{x:950,y:1950},{x:397.5,y:1950},entry('west-residence')]},
  {id:'east-residence-entrance',kind:'walkway',points:[{x:762.5,y:1950},entry('east-residence')]},
  {id:'gate-entrance',kind:'walkway',points:[{x:1307.5,y:1950},entry('south-gate')]},
  {id:'greenhouse-entrance',kind:'walkway',points:[{x:2240,y:740},{x:2700,y:740},entry('botanical-house')]},
  path('botanical-garden','walkway',[[870,740],[660,740],[660,405],[550,405],[550,350]]),
  path('waterside-deck','walkway',[[2240,1460],[2660,1460],[2660,1810]]),
];

export function roadDistance(x:number,y:number):number {
  let distance=Infinity;
  for(const road of ROADS)for(let i=0;i<road.points.length-(road.closed?0:1);i++) {
    const a=road.points[i]!,b=road.points[(i+1)%road.points.length]!,dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));
    distance=Math.min(distance,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));
  }
  return distance;
}

/** Seeded scenery keeps rendering, collision, and save coordinates consistent. */
export const TREES: {x:number;y:number;variant:number;scale:number}[]=[];
for(let row=0;row<14;row++)for(let column=0;column<22;column++) {
  const seed=(row*719+column*379+113)%997;
  const x=105+column*132+(seed%63)-31,y=100+row*139+(seed%71)-35;
  if(roadDistance(x,y)<80||Math.hypot((x-1536)/1.4,y-1050)<280)continue;
  if([...DESTINATIONS,...DEPARTMENTS].some(d=>Math.hypot((x-d.x)/1.2,y-d.y)<190))continue;
  if(BUILDINGS.some(b=>x>b.x-70&&x<b.x+b.u+70&&y>b.y-50&&y<b.y+b.v+50))continue;
  if(LANDSCAPES.some(b=>x>b.x-35&&x<b.x+b.width+35&&y>b.y-35&&y<b.y+b.height+35))continue;
  if(PROPS.some(p=>Math.hypot(x-p.x,y-p.y)<110))continue;
  // Leave open lawns between composed tree groups instead of filling every grid cell.
  if(seed%5===0)continue;
  if(x>2690&&y>1420)continue;
  TREES.push({x,y,variant:seed%3,scale:.72+(seed%25)/100});
}

export const OBSTACLES = [
  ...BUILDINGS.map(b=>({x:b.x,y:b.y,width:b.u,height:b.v,polygon:buildingFootprint(b)})),
  ...PROPS.map(propFootprint),
  {x:FOUNTAIN.x-FOUNTAIN.radius,y:FOUNTAIN.y-FOUNTAIN.radius,width:FOUNTAIN.radius*2,height:FOUNTAIN.radius*2,polygon:Array.from({length:20},(_,i)=>({x:FOUNTAIN.x+Math.cos(i/20*Math.PI*2)*FOUNTAIN.radius,y:FOUNTAIN.y+Math.sin(i/20*Math.PI*2)*FOUNTAIN.radius}))},
  {x:2710,y:1480,width:270,height:440},
  ...TREES.map(t=>({x:t.x-5,y:t.y-5,width:10,height:10})),
];

export function regionAt(x: number, y: number): typeof DESTINATIONS[number] | null {
  let region: typeof DESTINATIONS[number] | null = null;
  let distance = 345;
  for (const candidate of DESTINATIONS) {
    const current = Math.hypot(x - candidate.x, y - candidate.y);
    if (current < distance) { distance = current; region = candidate; }
  }
  return region;
}

export function departmentAt(x:number,y:number):typeof DEPARTMENTS[number]|null {
  let nearest:typeof DEPARTMENTS[number]|null=null,distance=230;
  for(const department of DEPARTMENTS){
    const b=BUILDINGS.find(b=>b.id===department.id)!;
    const current=Math.hypot(Math.max(b.x-x,0,x-b.x-b.u),Math.max(b.y-y,0,y-b.y-b.v));
    if(current<distance){distance=current;nearest=department;}
  }
  return nearest;
}
