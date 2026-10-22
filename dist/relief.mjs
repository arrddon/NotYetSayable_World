// Invisible depth support only. The visible landform is entirely moving particles.
export class FormationRelief {
 constructor(){this.id='formation-relief';this.type='custom';this.renderingMode='3d';this.vertices=new Float32Array();this.dirty=false;}
 onAdd(map,gl){
  this.map=map;
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const vs=compile(gl.VERTEX_SHADER,`#version 300 es
   precision highp float;uniform mat4 u_matrix;in vec3 a_position;
   void main(){vec3 p=a_position;p.z*=.65;gl_Position=u_matrix*vec4(p,1.);}`);
  const fs=compile(gl.FRAGMENT_SHADER,`#version 300 es
   precision highp float;out vec4 fragColor;
   void main(){fragColor=vec4(0.);}`);
  this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);
  if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
  gl.deleteShader(vs);gl.deleteShader(fs);this.buffer=gl.createBuffer();this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  const loc=gl.getAttribLocation(this.program,'a_position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,36,0);
  gl.bindVertexArray(null);this.matrix=gl.getUniformLocation(this.program,'u_matrix');
 }
 setMesh(vertices){this.vertices=vertices;this.dirty=true;this.map?.triggerRepaint();}
 render(gl,args){
  if(!this.vertices.length)return;
  gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  if(this.dirty){gl.bufferData(gl.ARRAY_BUFFER,this.vertices,gl.DYNAMIC_DRAW);this.dirty=false;}
  gl.uniformMatrix4fv(this.matrix,false,args.defaultProjectionData?.mainMatrix||args);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
  gl.colorMask(false,false,false,false);
  gl.drawArrays(gl.TRIANGLES,0,this.vertices.length/9);
  gl.colorMask(true,true,true,true);
  gl.bindVertexArray(null);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 }
 onRemove(map,gl){gl.deleteBuffer(this.buffer);gl.deleteVertexArray(this.vao);gl.deleteProgram(this.program);}
}
