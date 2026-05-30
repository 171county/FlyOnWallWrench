"use client";

import { useEffect, useRef } from "react";

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
float hash(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.)); vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.; a*=.5; } return v; }
void main(){
  vec2 uv=gl_FragCoord.xy/u_res.xy; vec2 p=uv; p.x*=u_res.x/u_res.y; p*=1.6;
  float t=u_time*0.045;
  vec2 q=vec2(fbm(p+t), fbm(p+vec2(5.2,1.3)-t));
  vec2 r=vec2(fbm(p+1.5*q+vec2(1.7,9.2)+0.5*t), fbm(p+1.5*q+vec2(8.3,2.8)-0.5*t));
  float f=fbm(p+1.6*r);
  vec3 deep=vec3(0.020,0.028,0.045), steel=vec3(0.30,0.70,1.0), slate=vec3(0.40,0.46,0.70), amber=vec3(0.85,0.55,0.28);
  vec3 col=mix(deep,slate,clamp(f*1.30,0.,1.));
  col=mix(col,steel,clamp(length(r)*0.60,0.,1.));
  col=mix(col,amber,clamp(q.x*q.y*1.10,0.,1.));
  col+=steel*pow(f,3.0)*0.45;
  col+=vec3(0.16,1.0,0.50)*pow(f,5.0)*0.16;
  col*=smoothstep(1.25,0.30,length(uv-0.5));
  col=mix(col*0.5,col,0.76);
  col+=(hash(uv*(u_time+1.0))-0.5)*0.022;
  gl_FragColor=vec4(col,1.0);
}`;

export default function ShaderBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) { canvas.style.background = "#070a11"; return; }

    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog); gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    let raf = 0;
    const start = performance.now();
    const frame = () => {
      const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas id="bg" ref={ref} />;
}
