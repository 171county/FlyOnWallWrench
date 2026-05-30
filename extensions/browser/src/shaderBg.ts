// Luminous "liquid aurora" background — a domain-warped fbm field in a
// WebGL fragment shader. Deep space base with flowing cyan / violet / magenta,
// tuned to sit behind glass panels without washing out text.

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;
  p *= 1.6;
  float t = u_time * 0.045;

  // domain warp
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 1.5 * q + vec2(1.7, 9.2) + 0.5 * t),
                fbm(p + 1.5 * q + vec2(8.3, 2.8) - 0.5 * t));
  float f = fbm(p + 1.6 * r);

  vec3 deep    = vec3(0.025, 0.035, 0.075);
  vec3 cyan    = vec3(0.22, 0.91, 1.00);
  vec3 violet  = vec3(0.55, 0.36, 1.00);
  vec3 magenta = vec3(1.00, 0.30, 0.62);

  vec3 col = mix(deep, violet, clamp(f * 1.35, 0.0, 1.0));
  col = mix(col, cyan,    clamp(length(r) * 0.65, 0.0, 1.0));
  col = mix(col, magenta, clamp(q.x * q.y * 1.7, 0.0, 1.0));
  col += cyan * pow(f, 3.0) * 0.55;                 // luminous cores
  col *= smoothstep(1.25, 0.30, length(uv - 0.5)); // vignette
  col = mix(col * 0.5, col, 0.78);                  // keep it deep for contrast
  col += (hash(uv * (u_time + 1.0)) - 0.5) * 0.025; // film grain

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export function initShaderBackground(canvasId: string): void {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return;
  const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
  if (!gl) { canvas.style.background = "#070a16"; return; }

  const prog = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!prog || !vs || !fs) return;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  function resize() {
    const w = Math.max(1, Math.floor(canvas!.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas!.clientHeight * dpr));
    if (canvas!.width !== w || canvas!.height !== h) {
      canvas!.width = w; canvas!.height = h;
      gl!.viewport(0, 0, w, h);
    }
  }
  window.addEventListener("resize", resize);

  const start = performance.now();
  function frame() {
    resize();
    gl!.uniform2f(uRes, canvas!.width, canvas!.height);
    gl!.uniform1f(uTime, (performance.now() - start) / 1000);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
