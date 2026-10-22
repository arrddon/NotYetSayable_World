import {THEMES,CITIES} from './core.mjs';
import {normalizeGraphics} from './graphics.mjs';

export const EXHIBITION_PROTOCOL=1;
export const MAX_STATE_BYTES=256*1024;
const number=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const string=(value,max)=>typeof value==='string'&&value.length<=max;

// Only navigation, public IDs and appearance cross the LAN. No records or raw text.
export function validateExhibitionState(value){
 if(!value||value.protocol!==EXHIBITION_PROTOCOL)throw new Error('Unsupported state');
 const camera=value.camera;
 if(!camera||!number(camera.lng,-180,180)||!number(camera.lat,-85.051129,85.051129)||!number(camera.zoom,1.3,18)||!number(camera.bearing,-180,180)||!number(camera.pitch,0,65)||!number(camera.fov,20,60))throw new Error('Invalid camera');
 if(value.city!==null&&!CITIES.some(city=>city.id===value.city))throw new Error('Invalid city');
 const oldDemoTheme=typeof value.archiveVersion==='string'&&value.archiveVersion.startsWith('demo-')&&['creativity','community'].includes(value.theme);
 if(value.theme!==null&&!THEMES.some(theme=>theme.id===value.theme)&&!oldDemoTheme)throw new Error('Invalid theme');
 if(value.selection!==null&&(!Array.isArray(value.selection)||value.selection.length>5000||!value.selection.every(id=>string(id,160)&&id.length>0)))throw new Error('Invalid selection');
 if(!string(value.archiveVersion,160))throw new Error('Invalid archive version');
 if(!Array.isArray(value.scope)||value.scope.length>5000||!value.scope.every(id=>string(id,160)&&id.length>0))throw new Error('Invalid scope');
 return {
  protocol:EXHIBITION_PROTOCOL,archiveVersion:value.archiveVersion,
  camera:{lng:camera.lng,lat:camera.lat,zoom:camera.zoom,bearing:0,pitch:camera.pitch,fov:camera.fov},
  city:value.city,theme:oldDemoTheme?null:value.theme,selection:value.selection===null?null:[...new Set(value.selection)],
  scope:[...new Set(value.scope)],graphics:normalizeGraphics(value.graphics),
 };
}

// Only the controller migrates a saved camera to the server's current archive.
// Displays wait for that controller's newly calculated scope instead of guessing it.
export function reconcileControllerArchive(snapshot,archive,serverVersion){
 if(!archive||archive.version!==serverVersion)return null;
 const clean=validateExhibitionState(snapshot),ids=new Set(archive.records.map(record=>record.id));
 const selected=clean.selection?.filter(id=>ids.has(id));
 return {...clean,archiveVersion:archive.version,selection:selected?.length?selected:null,scope:[]};
}
