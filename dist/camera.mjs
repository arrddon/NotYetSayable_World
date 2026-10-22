// Exhibition framing follows the reference automatically; it is not a saved graphics control.
export function referenceCamera(zoom=13.3,mobile=false){
 const detail=Math.max(0,Math.min(1,(zoom-3)/8));
 // Preserve the city framing; raise the viewing angle only for very close inspection.
 const closeup=Math.max(0,Math.min(1,(zoom-14)/4));
 return {pitch:30+22*detail-12*closeup*closeup*(3-2*closeup),fov:mobile?50:48};
}
