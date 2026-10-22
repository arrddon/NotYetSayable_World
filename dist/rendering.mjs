// Keep the HTML console at display resolution while bounding map framebuffer work.
export const MAX_MAP_PIXELS=2560*1440;
export const ANIMATION_FPS=30;
export function mapPixelRatio(width,height,deviceRatio=1){
 const w=Math.max(1,Number.isFinite(width)?width:1),h=Math.max(1,Number.isFinite(height)?height:1);
 const ratio=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
 return Math.min(ratio,1.25,Math.sqrt(MAX_MAP_PIXELS/(w*h)),4096/Math.max(w,h));
}

// Align redraw requests with display frames, dropping missed work after a stall.
export function animationFrameGate(fps=ANIMATION_FPS){
 const interval=1000/fps;let next=null;
 return (now,active=true)=>{
  if(!active){next=null;return false;}
  if(next!==null&&now+.75<next)return false;
  next=next===null||now-next>interval?now+interval:next+interval;
  return true;
 };
}
