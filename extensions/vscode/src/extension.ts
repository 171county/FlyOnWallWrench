import * as vscode from "vscode";

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("helpMe.askAboutSelection", () => run("answer_user")),
    vscode.commands.registerCommand("helpMe.explainCrashLog", () => run("developer_triage", "Explain this crash log and the likely cause.")),
    vscode.commands.registerCommand("helpMe.createIssueDraft", () => run("developer_triage", "Draft a triage issue from this evidence.")),
  );
}

function getPanel(): vscode.WebviewPanel {
  if (panel) return panel;
  panel = vscode.window.createWebviewPanel("helpMeComms", "Help Me Comms", vscode.ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: true,
  });
  panel.webview.html = renderHtml(panel.webview);
  panel.onDidDispose(() => { panel = undefined; });
  return panel;
}

async function run(mode: string, prefix?: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { vscode.window.showInformationMessage("Open a file and select text first."); return; }
  const selection = editor.document.getText(editor.selection);
  if (!selection.trim()) { vscode.window.showInformationMessage("Select the log, error, or code snippet you want to ask about."); return; }

  const config = vscode.workspace.getConfiguration("helpMe");
  const localAppUrl = config.get<string>("localAppUrl", "http://localhost:3000");
  const message = `${prefix ? `${prefix}\n\n` : ""}${selection}`;

  const p = getPanel();
  p.reveal(vscode.ViewColumn.Beside);
  p.webview.postMessage({ type: "loading", query: selection.slice(0, 500) });

  // Fetch in the extension host; the webview only renders. Selected text only —
  // no files are read or edited, no commands run.
  try {
    const res = await fetch(`${localAppUrl}/api/community-help`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_message: message, mode }),
    });
    p.webview.postMessage({ type: "result", data: await res.json() });
  } catch (error) {
    p.webview.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error), url: localAppUrl });
  }
}

export function deactivate() {
  panel?.dispose();
}

function nonce(): string {
  let s = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 24; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function renderHtml(webview: vscode.Webview): string {
  const n = nonce();
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    "style-src 'unsafe-inline'",
    `script-src 'nonce-${n}'`,
  ].join("; ");

  // GLSL lives in non-executing tags so the main script can stay backtick-free.
  const vert = "attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }";
  const frag = [
    "precision highp float; uniform vec2 u_res; uniform float u_time;",
    "float hash(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }",
    "float noise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.)); vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }",
    "float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.; a*=.5; } return v; }",
    "void main(){ vec2 uv=gl_FragCoord.xy/u_res.xy; vec2 p=uv; p.x*=u_res.x/u_res.y; p*=1.6; float t=u_time*0.045;",
    "vec2 q=vec2(fbm(p+t),fbm(p+vec2(5.2,1.3)-t)); vec2 r=vec2(fbm(p+1.5*q+vec2(1.7,9.2)+0.5*t),fbm(p+1.5*q+vec2(8.3,2.8)-0.5*t)); float f=fbm(p+1.6*r);",
    "vec3 deep=vec3(0.020,0.028,0.045),steel=vec3(0.30,0.70,1.0),slate=vec3(0.40,0.46,0.70),amber=vec3(0.85,0.55,0.28);",
    "vec3 col=mix(deep,slate,clamp(f*1.30,0.,1.)); col=mix(col,steel,clamp(length(r)*0.60,0.,1.)); col=mix(col,amber,clamp(q.x*q.y*1.10,0.,1.));",
    "col+=steel*pow(f,3.0)*0.45; col+=vec3(0.16,1.0,0.50)*pow(f,5.0)*0.16; col*=smoothstep(1.25,0.30,length(uv-0.5)); col=mix(col*0.5,col,0.76);",
    "col+=(hash(uv*(u_time+1.0))-0.5)*0.022; gl_FragColor=vec4(col,1.0); }",
  ].join("\n");

  const style = `
    :root{--ink:#eaf2ff;--muted:#9aa6c4;--faint:#6b7799;--steel:#4cc2ff;--slate:#7d88c8;--amber:#e0964a;--green:#2ee06a;--copper:#c77b3e;--copper-lit:#e6a062;--grad:linear-gradient(135deg,#4cc2ff,#6f7bbf 52%,#e0964a);}
    *{box-sizing:border-box;} html,body{margin:0;height:100%;}
    body{background:#070a11;color:var(--ink);font-family:ui-sans-serif,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden;}
    #bg{position:fixed;inset:0;width:100%;height:100%;z-index:0;}
    body::after{content:"";position:fixed;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(7,10,17,.2),rgba(7,10,17,.7));}
    main{position:relative;z-index:2;max-width:680px;margin:0 auto;padding:22px 20px;display:flex;flex-direction:column;gap:14px;}
    .brand{display:flex;align-items:center;gap:12px;}
    .logo{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-weight:800;color:#061018;background:var(--grad);box-shadow:0 8px 24px rgba(76,194,255,.4);}
    .kicker{font-size:10px;letter-spacing:2.2px;text-transform:uppercase;color:var(--steel);font-weight:700;}
    .title{font-size:19px;font-weight:800;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
    .glass{background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.10);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.14);}
    .head{padding:10px 14px;display:flex;align-items:center;gap:10px;border:1px solid color-mix(in srgb,var(--copper-lit) 55%,transparent);border-radius:14px;box-shadow:0 0 0 1px color-mix(in srgb,var(--copper) 65%,transparent),0 0 18px -6px var(--copper);font-size:12px;color:var(--muted);}
    .head .led{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 10px var(--green);}
    .card{padding:16px;display:flex;flex-direction:column;gap:13px;}
    .chiprow{display:flex;gap:8px;flex-wrap:wrap;}
    .chip{font-size:11px;font-weight:700;padding:5px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(135deg,rgba(76,194,255,.18),rgba(224,150,74,.16));text-transform:capitalize;}
    .chip.ok{color:#07150d;background:var(--green);border-color:transparent;text-transform:none;box-shadow:0 0 16px rgba(46,224,106,.4);}
    .answer{font-size:14px;line-height:1.55;color:#dce6ff;white-space:pre-wrap;}
    .lbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--faint);}
    .mwrap{display:flex;align-items:center;gap:10px;}
    .meter{position:relative;flex:1;height:9px;border-radius:999px;background:rgba(255,255,255,.08);}
    .meter>i{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,#ff7a3c,#e8b25a 48%,#2ee06a);box-shadow:0 0 16px rgba(46,224,106,.6);}
    .mval{font-size:13px;font-weight:800;}
    .pills{display:flex;flex-wrap:wrap;gap:7px;}
    .pill{display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;font-size:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);}
    .pill .d{width:8px;height:8px;border-radius:50%;box-shadow:0 0 9px currentColor;}
    .ev{padding:11px 13px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);margin-top:8px;}
    .ev .es{font-size:13px;color:#dce6ff;line-height:1.45;}
    .ev .em{font-size:10.5px;color:var(--faint);margin-top:5px;}
    .fu{display:flex;gap:9px;padding:11px 13px;border-radius:12px;background:rgba(76,194,255,.07);border:1px solid rgba(76,194,255,.22);font-size:13px;color:#cdeffb;}
    .fu .q{color:var(--steel);}
    .act{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;font-size:13px;font-weight:600;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);margin-top:8px;}
    .act .gate{margin-left:auto;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--amber);border:1px solid rgba(224,150,74,.4);padding:3px 7px;border-radius:999px;}
    .pv{display:flex;align-items:center;gap:8px;font-size:10.5px;color:var(--faint);}
    .pv .d{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);}
    .skel{height:14px;border-radius:7px;margin:6px 0;background:linear-gradient(90deg,rgba(255,255,255,.05),rgba(255,255,255,.14),rgba(255,255,255,.05));background-size:200% 100%;animation:sh 1.2s linear infinite;}
    @keyframes sh{to{background-position:-200% 0;}}
    .muted{color:var(--muted);font-size:12.5px;}
  `;

  // Main script: plain JS, no backticks / template literals (keeps the outer
  // TS template literal clean). Renders messages posted from the host.
  const script = [
    "var SRC={discord:['Discord','#5865f2'],reddit:['Reddit','#ff4500'],steam_reviews:['Steam','#66c0f4'],steam_news:['Steam News','#66c0f4'],forum:['Forum','#2ee06a'],github_discussions:['GitHub','#c9d1d9'],github_issues:['GitHub Issues','#c9d1d9'],youtube:['YouTube','#ff4d9d'],twitch:['Twitch','#8b5cff'],slack:['Slack','#36c5f0'],matrix:['Matrix','#0dbd8b']};",
    "function meta(s){return SRC[s]||[s,'#9aa6c4'];}",
    "function E(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}",
    "var root=document.getElementById('out');",
    "function clear(){root.innerHTML='';}",
    "function loading(q){clear();var c=E('div','card glass');c.appendChild(E('div','lbl','Asking about'));var m=E('div','muted',q);c.appendChild(m);var s1=E('div','skel');s1.style.width='40%';var s2=E('div','skel');s2.style.width='90%';var s3=E('div','skel');s3.style.width='70%';c.appendChild(s1);c.appendChild(s2);c.appendChild(s3);root.appendChild(c);}",
    "function error(msg,url){clear();var c=E('div','card glass');c.appendChild(E('div','answer','Could not reach '+url+'/api/community-help'));c.appendChild(E('div','muted',msg+'  ·  run: pnpm --filter @help-me-comms/web dev'));root.appendChild(c);}",
    "function render(d){clear();var c=E('div','card glass');",
    "var cr=E('div','chiprow');var st=E('span',(d.status==='ok'?'chip ok':'chip'),(d.status||'ok').replace(/_/g,' '));cr.appendChild(st);if(d.intent){cr.appendChild(E('span','chip',d.intent.replace(/_/g,' ')));}c.appendChild(cr);",
    "if(d.answer){c.appendChild(E('div','answer',d.answer));}",
    "if(typeof d.confidence==='number'){var pct=Math.round(d.confidence*100);c.appendChild(E('div','lbl','Confidence'));var mw=E('div','mwrap');var mt=E('div','meter');var fi=E('i');fi.style.width=pct+'%';mt.appendChild(fi);mw.appendChild(mt);mw.appendChild(E('span','mval',pct+'%'));c.appendChild(mw);}",
    "if(d.sourcesUsed&&d.sourcesUsed.length){c.appendChild(E('div','lbl','Sources scoped'));var ps=E('div','pills');d.sourcesUsed.forEach(function(s){var m=meta(s);var pl=E('span','pill');var dd=E('span','d');dd.style.color=m[1];pl.appendChild(dd);pl.appendChild(document.createTextNode(m[0]));ps.appendChild(pl);});c.appendChild(ps);}",
    "if(d.evidence&&d.evidence.length){c.appendChild(E('div','lbl','Top evidence'));d.evidence.slice(0,3).forEach(function(it){var m=meta(it.source);var ev=E('div','ev');ev.appendChild(E('div','es',it.summary||it.title||''));var cc=it.confidenceSignals&&it.confidenceSignals.confirmationCount;ev.appendChild(E('div','em',it.source+(cc!=null?(' · '+cc+' confirmations'):'')));c.appendChild(ev);});}",
    "if(d.followupQuestion){var fu=E('div','fu');fu.appendChild(E('span','q','*'));fu.appendChild(E('span',null,d.followupQuestion));c.appendChild(fu);}",
    "if(d.suggestedActions&&d.suggestedActions.length){c.appendChild(E('div','lbl','Suggested next actions'));d.suggestedActions.forEach(function(a){var ac=E('div','act');ac.appendChild(E('span',null,a.label));if(a.requiresApproval){ac.appendChild(E('span','gate','Approval'));}c.appendChild(ac);});}",
    "if(d.privacyNotice){var pv=E('div','pv');pv.appendChild(E('span','d'));pv.appendChild(E('span',null,d.privacyNotice));c.appendChild(pv);}",
    "root.appendChild(c);}",
    "window.addEventListener('message',function(e){var m=e.data;if(m.type==='loading')loading(m.query);else if(m.type==='result')render(m.data);else if(m.type==='error')error(m.message,m.url);});",
    // shader
    "(function(){var cv=document.getElementById('bg');var gl=cv.getContext('webgl')||cv.getContext('experimental-webgl');if(!gl){cv.style.background='#070a11';return;}",
    "function S(t,s){var sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);return sh;}",
    "var pr=gl.createProgram();gl.attachShader(pr,S(gl.VERTEX_SHADER,document.getElementById('v').textContent));gl.attachShader(pr,S(gl.FRAGMENT_SHADER,document.getElementById('f').textContent));gl.linkProgram(pr);gl.useProgram(pr);",
    "var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);var lo=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(lo);gl.vertexAttribPointer(lo,2,gl.FLOAT,false,0,0);",
    "var uR=gl.getUniformLocation(pr,'u_res'),uT=gl.getUniformLocation(pr,'u_time'),dpr=Math.min(window.devicePixelRatio||1,1.5),t0=performance.now();",
    "function fr(){var w=Math.floor(cv.clientWidth*dpr),h=Math.floor(cv.clientHeight*dpr);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;gl.viewport(0,0,w,h);}gl.uniform2f(uR,cv.width,cv.height);gl.uniform1f(uT,(performance.now()-t0)/1000);gl.drawArrays(gl.TRIANGLES,0,3);requestAnimationFrame(fr);}requestAnimationFrame(fr);})();",
  ].join("\n");

  return [
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"/>",
    `<meta http-equiv="Content-Security-Policy" content="${csp}"/>`,
    `<style>${style}</style></head><body>`,
    "<canvas id=\"bg\"></canvas>",
    "<main>",
    "<div class=\"brand\"><div class=\"logo\">&lt;/&gt;</div><div><div class=\"kicker\">FlyOnWall &middot; Comms</div><div class=\"title\">Help Me Comms</div></div></div>",
    "<div class=\"head glass\"><span class=\"led\"></span> Sends selected text only · no files edited, no commands run</div>",
    "<div id=\"out\"><div class=\"card glass\"><div class=\"muted\">Select a log, error, or snippet, then run <b>Help Me: Ask About Selection</b>.</div></div></div>",
    "</main>",
    `<script id="v" type="x-shader/x-vertex" nonce="${n}">${vert}</script>`,
    `<script id="f" type="x-shader/x-fragment" nonce="${n}">${frag}</script>`,
    `<script nonce="${n}">${script}</script>`,
    "</body></html>",
  ].join("\n");
}
