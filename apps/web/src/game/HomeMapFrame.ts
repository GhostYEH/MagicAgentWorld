import {VIEW,toView} from './WorldProjection';
import {BUILDINGS,DEPARTMENTS} from './WorldMap';

// Include the renderer's roof/texture margins, door steps and the assembly court.
// This keeps whole buildings visible, rather than only their ground anchors.
const coreRects=BUILDINGS.filter(b=>DEPARTMENTS.some(d=>d.id===b.id)).map(b=>{
  const p=toView(b);
  return {left:p.x-b.v-80,right:p.x+b.u+80,top:p.y-b.elevation-160,bottom:p.y+b.height+60};
});
const assembly=toView({x:1515,y:1724});
export const CORE_VIEW_BOUNDS={
  left:Math.min(...coreRects.map(b=>b.left))-40,
  right:Math.max(...coreRects.map(b=>b.right))+40,
  top:Math.min(...coreRects.map(b=>b.top))-50,
  bottom:Math.max(...coreRects.map(b=>b.bottom),assembly.y+70)+40,
};

/** Clamp both zoom and camera movement so every core remains in the free HUD area. */
export function coreMapFrame(width:number,height:number,requestedZoom=Infinity,desired?:{x:number;y:number},bottom=130):{zoom:number;maxZoom:number;x:number;y:number} {
  const left=315,top=100,right=24;
  const availableWidth=width-left-right,availableHeight=height-top-bottom,b=CORE_VIEW_BOUNDS;
  const maxZoom=Math.min(availableWidth/(b.right-b.left),availableHeight/(b.bottom-b.top));
  const zoom=Math.max(.01,Math.min(requestedZoom,maxZoom));
  const centerX=left+availableWidth/2,centerY=top+availableHeight/2;
  const minX=b.right-availableWidth/(2*zoom),maxX=b.left+availableWidth/(2*zoom);
  const minY=b.bottom-availableHeight/(2*zoom),maxY=b.top+availableHeight/(2*zoom);
  const x=Math.max(minX,Math.min(desired?.x??(b.left+b.right)/2,maxX));
  const y=Math.max(minY,Math.min(desired?.y??(b.top+b.bottom)/2,maxY));
  return {zoom,maxZoom,x:x+(width/2-centerX)/zoom,y:y+(height/2-centerY)/zoom};
}

/** Reserve desktop HUD space while keeping the entire map in one camera. */
export function homeMapFrame(width:number,height:number):{zoom:number;x:number;y:number} {
  const left=315,top=92,right=20,bottom=110;
  const availableWidth=width-left-right,availableHeight=height-top-bottom;
  const zoom=Math.min(availableWidth/VIEW.width,availableHeight/VIEW.height);
  const centerX=left+availableWidth/2,centerY=top+availableHeight/2;
  return {zoom,x:VIEW.width/2+(width/2-centerX)/zoom,y:VIEW.height/2+(height/2-centerY)/zoom};
}
