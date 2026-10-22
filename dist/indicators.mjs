import {packParticles,INDICATOR_TILT} from './landscape.mjs';

export function cylinderMesh(segments=40){
 const data=[],point=(angle,z,cap=0)=>[Math.cos(angle),Math.sin(angle),z,...(cap?[0,0,cap]:[Math.cos(angle),Math.sin(angle),0])];
 for(let i=0;i<segments;i++){
  const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
  data.push(...point(a,0),...point(b,0),...point(a,1),...point(a,1),...point(b,0),...point(b,1));
  data.push(0,0,0,0,0,-1,...point(b,0,-1),...point(a,0,-1));
  data.push(0,0,1,0,0,1,...point(a,1,1),...point(b,1,1));
 }
 return new Float32Array(data);
}

// One common world-space axis for every cylinder, projected by the map's perspective camera.
export function indicatorAxis(matrix,width,height,tilt=INDICATOR_TILT){
 const ax=matrix[0]*width,ay=matrix[1]*height,bx=matrix[4]*width,by=matrix[5]*height;
 const zx=matrix[8]*width,zy=matrix[9]*height,det=ax*by-bx*ay;
 if(Math.abs(det)<1e-10)return [tilt,0,1];
 const rise=Math.max(Math.hypot(zx,zy),Math.hypot(ax,ay)*.4),tx=tilt*rise-zx,ty=rise-zy;
 return [(tx*by-bx*ty)/det,(ax*ty-tx*ay)/det,1];
}

export class MetallicIndicators {
 constructor(){this.id='formation-indicators';this.type='custom';this.renderingMode='3d';this.vertices=new Float32Array();this.dirty=false;this.animated=true;this.time=0;this.lastTime=null;}
 onAdd(map,gl){
  this.map=map;
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const vs=compile(gl.VERTEX_SHADER,`#version 300 es
   precision highp float;uniform mat4 u_matrix;uniform vec3 u_axis;uniform float u_scale;uniform float u_height;
   in vec3 a_vertex;in vec3 a_normal;in vec3 a_position;in float a_width;in float a_reach;
   out vec3 v_normal;out vec2 v_uv;out vec2 v_radial;out float v_cap;
   void main(){
    vec3 axis=normalize(u_axis),side=normalize(cross(axis,vec3(0.,0.,1.)));
    vec3 front=normalize(cross(axis,side));
    vec3 radial=side*a_vertex.x+front*a_vertex.y;
    vec3 position=a_position+radial*a_width*u_scale+u_axis*a_vertex.z*u_height*a_reach;
    gl_Position=u_matrix*vec4(position,1.);
    v_normal=side*a_normal.x+front*a_normal.y+axis*a_normal.z;
    v_uv=vec2(atan(a_vertex.y,a_vertex.x),a_vertex.z);
    v_radial=a_vertex.xy;v_cap=abs(a_normal.z);
   }`);
  const fs=compile(gl.FRAGMENT_SHADER,`#version 300 es
   precision highp float;uniform sampler2D u_scene;uniform vec2 u_resolution;uniform vec3 u_view;uniform float u_time;
   in vec3 v_normal;in vec2 v_uv;in vec2 v_radial;in float v_cap;out vec4 fragColor;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   void main(){
    vec3 n=normalize(v_normal),view=normalize(u_view),light=normalize(vec3(-.6,-.4,1.));
    float diffuse=max(0.,dot(n,light)),fresnel=pow(1.-abs(dot(n,view)),3.);
    float spec=pow(max(0.,dot(n,normalize(light+view))),48.);
    float rim=max(smoothstep(.72,.98,fresnel),v_cap*smoothstep(.9,.995,length(v_radial)));
    vec2 screen=gl_FragCoord.xy/u_resolution;
    vec3 detail=texture(u_scene,screen+n.xy*.005).rgb;
    float inverse=1.-dot(detail,vec3(.2126,.7152,.0722));
    float dust=smoothstep(.91,.995,hash(floor(vec2(v_uv.x*110.,v_uv.y*950.-u_time*8.))));
    vec3 tint=mix(vec3(.025,.06,.25),vec3(.14,.32,.9),diffuse);
    vec3 glass=mix(detail,tint,.27);
    glass=mix(glass,vec3(.12,.38,.7)*inverse,.15);
    vec3 lightColor=vec3(.85,.94,1.)*spec*4.5+vec3(.42,.68,1.)*fresnel*2.5;
    lightColor+=vec3(.92,.97,1.)*rim*2.2;
    lightColor+=vec3(.72,.86,1.)*dust*.6;
    float alpha=clamp(.10+fresnel*.42+spec*.6+rim*.42,.10,.94);
    fragColor=vec4(glass+lightColor,alpha);
   }`);
  this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);
  if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
  gl.deleteShader(vs);gl.deleteShader(fs);this.buffer=gl.createBuffer();this.meshBuffer=gl.createBuffer();this.vao=gl.createVertexArray();this.scene=gl.createTexture();
  gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.meshBuffer);
  const mesh=cylinderMesh();this.meshCount=mesh.length/6;gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);
  for(const [name,offset] of [['a_vertex',0],['a_normal',12]]){const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset);}
  gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  for(const [name,size,offset] of [['a_position',3,0],['a_width',1,12],['a_reach',1,16]]){const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,20,offset);gl.vertexAttribDivisor(loc,1);}
  gl.bindVertexArray(null);this.uniforms=Object.fromEntries(['u_matrix','u_axis','u_scale','u_height','u_scene','u_resolution','u_view','u_time'].map(name=>[name,gl.getUniformLocation(this.program,name)]));
  const particleVertex=compile(gl.VERTEX_SHADER,`#version 300 es
   precision highp float;uniform mat4 u_matrix;uniform vec3 u_axis;uniform float u_scale;uniform float u_height;uniform float u_time;uniform float u_ratio;
   in vec3 a_position;in float a_width;in float a_reach;out vec4 v_color;
   float hash(float x){return fract(sin(x*127.1)*43758.5453);}
   void main(){
    float id=float(gl_VertexID),angle=hash(id+3.)*6.2831853,t=fract(hash(id*1.37)+u_time*.026);
    vec3 axis=normalize(u_axis),side=normalize(cross(axis,vec3(0.,0.,1.))),front=normalize(cross(axis,side));
    float radius=a_width*u_scale*(1.1+hash(id+9.)*.75);
    vec3 p=a_position+(side*cos(angle)+front*sin(angle))*radius+u_axis*t*u_height*a_reach;
    gl_Position=u_matrix*vec4(p,1.);gl_PointSize=(1.7+hash(id+14.)*2.5)*u_ratio;
    float bright=step(.82,hash(id+29.));v_color=vec4(mix(vec3(.2,.38,1.),vec3(.85,.94,1.),bright),.25+bright*.5);
   }`);
  const particleFragment=compile(gl.FRAGMENT_SHADER,`#version 300 es
   precision highp float;in vec4 v_color;out vec4 fragColor;
   void main(){if(max(abs(gl_PointCoord.x-.5),abs(gl_PointCoord.y-.5))>.48)discard;fragColor=v_color;}`);
  this.shell=gl.createProgram();gl.attachShader(this.shell,particleVertex);gl.attachShader(this.shell,particleFragment);gl.linkProgram(this.shell);
  if(!gl.getProgramParameter(this.shell,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.shell));
  gl.deleteShader(particleVertex);gl.deleteShader(particleFragment);this.shellVao=gl.createVertexArray();gl.bindVertexArray(this.shellVao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  for(const [name,size,offset] of [['a_position',3,0],['a_width',1,12],['a_reach',1,16]]){const loc=gl.getAttribLocation(this.shell,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,20,offset);gl.vertexAttribDivisor(loc,1);}
  gl.bindVertexArray(null);this.shellUniforms=Object.fromEntries(['u_matrix','u_axis','u_scale','u_height','u_time','u_ratio'].map(name=>[name,gl.getUniformLocation(this.shell,name)]));
 }
 setAnimated(value){this.animated=value;this.lastTime=null;this.map?.triggerRepaint();}
 setIndicators(indicators){
  const positions=packParticles(indicators.map(p=>({...p,color:[0,0,0]})));this.vertices=new Float32Array(indicators.length*5);
  indicators.forEach((p,i)=>{this.vertices.set(positions.subarray(i*8,i*8+3),i*5);this.vertices[i*5+3]=p.width;this.vertices[i*5+4]=p.reach;});
  this.dirty=true;this.map?.triggerRepaint();
 }
 render(gl,args){
  if(!this.vertices.length)return;
  const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,canvas=this.map.getCanvas(),matrix=args.defaultProjectionData?.mainMatrix||args;
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.scene);
  if(this.width!==width||this.height!==height){
   this.width=width;this.height=height;
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  }
  gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,width,height);
  gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  if(this.dirty){gl.bufferData(gl.ARRAY_BUFFER,this.vertices,gl.DYNAMIC_DRAW);this.dirty=false;}
  const scale=1/(512*2**this.map.getZoom()),axis=indicatorAxis(matrix,canvas.clientWidth,canvas.clientHeight),bearing=this.map.getBearing()*Math.PI/180,pitch=this.map.getPitch()*Math.PI/180;
  const detail=Math.max(0,Math.min(1,(this.map.getZoom()-2)/8)),extent=scale*canvas.clientHeight*(.32+.83*detail);
  gl.uniformMatrix4fv(this.uniforms.u_matrix,false,matrix);gl.uniform3fv(this.uniforms.u_axis,axis);gl.uniform1f(this.uniforms.u_scale,scale);gl.uniform1f(this.uniforms.u_height,extent);
  gl.uniform3f(this.uniforms.u_view,-Math.sin(bearing)*Math.sin(pitch),Math.cos(bearing)*Math.sin(pitch),Math.cos(pitch));
  const now=performance.now();if(this.animated&&this.lastTime!==null)this.time+=(now-this.lastTime)/1000;this.lastTime=now;
  gl.uniform1f(this.uniforms.u_time,this.time);gl.uniform2f(this.uniforms.u_resolution,width,height);gl.uniform1i(this.uniforms.u_scene,0);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(false);gl.enable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.cullFace(gl.FRONT);
  gl.drawArraysInstanced(gl.TRIANGLES,0,this.meshCount,this.vertices.length/5);
  gl.cullFace(gl.BACK);
  gl.drawArraysInstanced(gl.TRIANGLES,0,this.meshCount,this.vertices.length/5);
  gl.disable(gl.CULL_FACE);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.useProgram(this.shell);gl.bindVertexArray(this.shellVao);
  const s=this.shellUniforms;gl.uniformMatrix4fv(s.u_matrix,false,matrix);gl.uniform3fv(s.u_axis,axis);gl.uniform1f(s.u_scale,scale);gl.uniform1f(s.u_height,extent);gl.uniform1f(s.u_time,this.time);gl.uniform1f(s.u_ratio,this.map.getPixelRatio());
  gl.drawArraysInstanced(gl.POINTS,0,canvas.clientWidth<=760?650:1400,this.vertices.length/5);
  gl.bindVertexArray(null);gl.disable(gl.CULL_FACE);gl.depthMask(true);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 }
 onRemove(map,gl){gl.deleteTexture(this.scene);gl.deleteBuffer(this.buffer);gl.deleteBuffer(this.meshBuffer);gl.deleteVertexArray(this.vao);gl.deleteVertexArray(this.shellVao);gl.deleteProgram(this.program);gl.deleteProgram(this.shell);}
}
