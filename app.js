(()=>{
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const cam=$('#cam'), photo=$('#photo'), cv=$('#ov'), ctx=cv.getContext('2d');
const RAD=Math.PI/180;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm360=d=>((d%360)+360)%360;
const fmt=d=>d.toFixed(1).replace('.',',')+'°';
const num=s=>parseFloat(String(s).replace(',','.'));

let W=0,H=0;
const S={c:{x:0,y:0},r:150,rot:0,A:{x:0,y:0},B:{x:0,y:0},external:false,sel:'c',drag:null,off:{x:0,y:0}};
let hist=[]; try{hist=JSON.parse(localStorage.getItem('tar_hist')||'[]')}catch(e){}
let mission=null;

/* ---------- matemática ---------- */
// Equivalente a arccos((u·v)/(|u||v|)), porém estável perto de 0° e 180°.
function angleBetween(u,v){
  return Math.atan2(Math.abs(u.x*v.y-u.y*v.x), u.x*v.x+u.y*v.y)/RAD;
}
function measure(){
  const u={x:S.A.x-S.c.x,y:S.A.y-S.c.y}, v={x:S.B.x-S.c.x,y:S.B.y-S.c.y};
  if(Math.hypot(u.x,u.y)<20||Math.hypot(v.x,v.y)<20) return null;
  const inner=angleBetween(u,v);
  return S.external ? 360-inner : inner;   // externo = replemento
}
function classify(d){
  if(d<0.5) return 'Ângulo nulo';
  if(d<89.5) return 'Ângulo agudo';
  if(d<=90.5) return 'Ângulo reto';
  if(d<179.5) return 'Ângulo obtuso';
  if(d<=180.5) return 'Ângulo raso';
  if(d<359.5) return 'Ângulo côncavo (maior que 180°)';
  return 'Ângulo completo';
}
// ponto a "len" px do centro, no ângulo phi (graus) lido na escala do transferidor
function pt(phi,len){return {x:S.c.x+len*Math.cos(S.rot-phi*RAD), y:S.c.y+len*Math.sin(S.rot-phi*RAD)}}
const basePt=()=>({x:S.c.x-S.r*Math.cos(S.rot), y:S.c.y-S.r*Math.sin(S.rot)});

/* ---------- layout ---------- */
function reset(){
  const hudH=$('#hud').offsetHeight, top=$('#top').offsetHeight, availB=H-hudH-16;
  S.r=Math.max(80,Math.min(W*0.38,(availB-top)*0.55));
  S.c={x:W/2,y:availB-24}; S.rot=0;
  S.A=pt(0,S.r*1.12); S.B=pt(60,S.r*1.12); S.sel='c';
}
function resize(){
  const nw=innerWidth, nh=innerHeight, dpr=devicePixelRatio||1;
  if(W){const dx=(nw-W)/2, dy=(nh-H)/2; for(const p of [S.c,S.A,S.B]){p.x+=dx;p.y+=dy}} // translada, não distorce ângulos
  const first=!W; W=nw; H=nh;
  cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(first) reset();
  draw();
}

/* ---------- desenho ---------- */
function label(t,p,size){
  ctx.font=`700 ${size}px system-ui,sans-serif`; ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.75)';
  ctx.strokeText(t,p.x,p.y); ctx.fillStyle='#fff'; ctx.fillText(t,p.x,p.y);
}
function line(a,b,col){
  ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
  ctx.lineWidth=7; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.stroke();
  ctx.lineWidth=3.5; ctx.strokeStyle=col; ctx.stroke();
}
function draw(){
  ctx.clearRect(0,0,W,H);
  const {c,r,rot}=S;
  // corpo + base + marcações (referencial girado)
  ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(rot);
  ctx.beginPath(); ctx.arc(0,0,r,Math.PI,2*Math.PI); ctx.closePath();
  ctx.fillStyle='rgba(255,255,255,.2)'; ctx.fill();
  ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.stroke();
  ctx.lineWidth=2; ctx.strokeStyle='#fff'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r,0); ctx.lineTo(r,0);
  ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.stroke();
  ctx.lineWidth=2; ctx.strokeStyle='#fff'; ctx.stroke();
  const paths=[new Path2D(),new Path2D(),new Path2D()], lens=[0.05,0.085,0.14];
  for(let i=0;i<=180;i++){
    const k=i%10===0?2:(i%5===0?1:0), a=i*RAD, l=r*lens[k];
    paths[k].moveTo(r*Math.cos(a),-r*Math.sin(a));
    paths[k].lineTo((r-l)*Math.cos(a),-(r-l)*Math.sin(a));
  }
  const widths=[1,1.5,2.2];
  for(const [col,extra] of [['rgba(0,0,0,.6)',2],['#fff',0]]){
    ctx.strokeStyle=col;
    paths.forEach((p,k)=>{ctx.lineWidth=widths[k]+extra;ctx.stroke(p)});
  }
  ctx.restore();
  // números (sempre na horizontal, para facilitar a leitura)
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const key=[0,30,45,60,90,120,135,150,180];
  for(const a of key) label(a+'°',pt(a,r*0.68),Math.max(11,r*0.085));
  if(r>170) for(let a=10;a<180;a+=10){ if(!key.includes(a)) label(String(a),pt(a,r*0.8),10); }

  // lados e arco do ângulo
  const m=measure();
  if(m!=null){
    const sa=Math.atan2(S.A.y-c.y,S.A.x-c.x), sb=Math.atan2(S.B.y-c.y,S.B.x-c.x);
    let d=sb-sa; d=Math.atan2(Math.sin(d),Math.cos(d));
    const ar=Math.max(30,r*0.3), acw=S.external ? d>=0 : d<0;
    ctx.beginPath(); ctx.moveTo(c.x,c.y); ctx.arc(c.x,c.y,ar,sa,sb,acw); ctx.closePath();
    ctx.fillStyle='rgba(255,70,70,.35)'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#ff5252'; ctx.stroke();
    const mid=sa+(S.external? d/2+Math.PI : d/2);
    label(fmt(Math.round(m*10)/10),{x:c.x+(ar+28)*Math.cos(mid),y:c.y+(ar+28)*Math.sin(mid)},16);
  }
  line(c,S.A,'#ffd400'); line(c,S.B,'#00e5ff');

  // marcadores
  const hs={A:[S.A,'#ffd400','A'],B:[S.B,'#00e5ff','B'],base:[basePt(),'#ff9800','↻'],c:[S.c,'#ff3b30','']};
  for(const k in hs){
    const [p,col,t]=hs[k], rad=k==='c'?9:15;
    ctx.beginPath(); ctx.arc(p.x,p.y,rad,0,Math.PI*2);
    ctx.globalAlpha=.92; ctx.fillStyle=col; ctx.fill(); ctx.globalAlpha=1;
    ctx.lineWidth=2.5; ctx.strokeStyle='#fff'; ctx.stroke();
    if(S.sel===k){ctx.beginPath();ctx.arc(p.x,p.y,rad+7,0,Math.PI*2);ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke()}
    if(t){ctx.fillStyle='#000';ctx.font='700 14px system-ui';ctx.fillText(t,p.x,p.y+1)}
  }
  ctx.lineWidth=1.5; ctx.strokeStyle='#fff'; ctx.beginPath();
  ctx.moveTo(c.x-22,c.y);ctx.lineTo(c.x+22,c.y);ctx.moveTo(c.x,c.y-22);ctx.lineTo(c.x,c.y+22);ctx.stroke();
  updateHUD(m);
}

const SEL_NAMES={c:'Vértice (move tudo)',A:'Lado A: ◀▶ gira 0,1° · ▲▼ alonga',B:'Lado B: ◀▶ gira 0,1° · ▲▼ alonga',base:'Base: ◀▶ gira 0,1° · ▲▼ tamanho'};
function updateHUD(m){
  $('#selName').textContent=SEL_NAMES[S.sel];
  const tip=$('#tip');
  if(m==null){ $('#deg').textContent='—'; $('#kind').textContent='Lados muito curtos'; tip.textContent='Arraste os marcadores A e B para longe do vértice.'; return; }
  const v=Math.round(m*10)/10;
  $('#deg').textContent=fmt(v); $('#kind').textContent=classify(v)+(S.external?' (externo)':'');
  const lenA=Math.hypot(S.A.x-S.c.x,S.A.y-S.c.y), lenB=Math.hypot(S.B.x-S.c.x,S.B.y-S.c.y);
  const f=p=>norm360(S.rot/RAD-Math.atan2(p.y-S.c.y,p.x-S.c.x)/RAD);
  const al=x=>Math.min(x,360-x)<2||Math.abs(x-180)<2;
  let t;
  if(Math.min(lenA,lenB)<50) t='Dica: lados curtos reduzem a precisão. Afaste os marcadores do vértice.';
  else if(al(f(S.A))||al(f(S.B))) t='Base alinhada com um lado. Leia o outro lado na escala do transferidor.';
  else t='Dica: gire a base (ponto laranja) até coincidir com um lado e leia o outro lado na escala.';
  tip.textContent=t;
}

/* ---------- interação ---------- */
function setHandle(k,x,y){
  x=clamp(x,0,W); y=clamp(y,0,H);
  if(k==='c'){const dx=x-S.c.x,dy=y-S.c.y;S.c.x=x;S.c.y=y;S.A.x+=dx;S.A.y+=dy;S.B.x+=dx;S.B.y+=dy}
  else if(k==='A'||k==='B'){S[k].x=x;S[k].y=y}
  else {S.rot=Math.atan2(y-S.c.y,x-S.c.x)+Math.PI; S.r=Math.max(70,Math.hypot(x-S.c.x,y-S.c.y))}
}
function hit(x,y){
  let best=null,bd=40;
  for(const [k,p] of [['A',S.A],['B',S.B],['base',basePt()],['c',S.c]]){
    const d=Math.hypot(p.x-x,p.y-y); if(d<bd){bd=d;best=k}
  }
  return best;
}
cv.addEventListener('pointerdown',e=>{
  const k=hit(e.clientX,e.clientY); if(!k) return;
  S.drag=k; S.sel=k;
  const p=k==='base'?basePt():S[k]; S.off={x:p.x-e.clientX,y:p.y-e.clientY};
  cv.setPointerCapture(e.pointerId); draw();
});
cv.addEventListener('pointermove',e=>{ if(!S.drag) return; setHandle(S.drag,e.clientX+S.off.x,e.clientY+S.off.y); draw(); });
['pointerup','pointercancel'].forEach(t=>cv.addEventListener(t,()=>{S.drag=null}));

function nudge(dx,dy){
  const k=S.sel;
  if(k==='c') setHandle('c',S.c.x+dx,S.c.y+dy);
  else if(k==='A'||k==='B'){
    const p=S[k], vx=p.x-S.c.x, vy=p.y-S.c.y, L=Math.max(20,Math.hypot(vx,vy)-dy), a=Math.atan2(vy,vx)+dx*0.1*RAD;
    p.x=S.c.x+L*Math.cos(a); p.y=S.c.y+L*Math.sin(a);
  } else { S.rot+=dx*0.1*RAD; S.r=Math.max(70,S.r-dy); }
  draw();
}
$$('[data-n]').forEach(b=>b.onclick=()=>{const [dx,dy]=b.dataset.n.split(',').map(Number);nudge(dx,dy)});

/* ---------- botões ---------- */
function toast(t,ms=3500){const el=$('#toast');el.textContent=t;el.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>el.style.display='none',ms)}
$('#bMode').onclick=()=>{S.external=!S.external;$('#bMode').textContent=S.external?'Ângulo externo':'Ângulo interno';draw()};
$('#bFreeze').onclick=()=>{
  if(photo.style.display==='block'){toast('Na foto a imagem já está parada.');return}
  if(cam.paused){cam.play();$('#bFreeze').textContent='Congelar';$('#bFreeze').classList.remove('on')}
  else{cam.pause();$('#bFreeze').textContent='Continuar';$('#bFreeze').classList.add('on')}
};
$('#bReset').onclick=()=>{reset();$('#est').value='';draw()};
$('#bSave').onclick=()=>{
  const m=measure(); if(m==null){toast('Afaste os lados do vértice antes de salvar.');return}
  const v=Math.round(m*10)/10, est=num($('#est').value);
  const item={v,k:classify(v),ext:S.external,t:Date.now()};
  let msg='Medida salva: '+fmt(v)+'.';
  if(!isNaN(est)){
    item.est=est; const diff=Math.abs(est-v);
    msg+= diff<=5 ? ` Ótima estimativa! Diferença de ${fmt(diff)}.` : diff<=15 ? ` Boa tentativa. Diferença de ${fmt(diff)}.` : ` Sua estimativa errou por ${fmt(diff)}. Compare o ângulo com 90° para se orientar.`;
  }
  if(mission){
    if(Math.abs(v-mission.t)<=mission.tol){msg+=' Missão cumprida!';mission=null;$('#mission').textContent='';$('#missionText').textContent='Missão cumprida! Sorteie outra.'}
    else msg+=` Para a missão, procure algo perto de ${mission.t}°.`;
  }
  hist.unshift(item); hist=hist.slice(0,50); localStorage.setItem('tar_hist',JSON.stringify(hist));
  $('#est').value=''; toast(msg,5000);
};

/* ---------- câmera e foto ---------- */
function showMsg(t){const m=$('#msg');m.textContent=t;m.style.display=t?'block':'none'}
async function startCam(){
  photo.style.display='none'; cam.style.display='block';
  if(!navigator.mediaDevices?.getUserMedia){showMsg('Este navegador não permite acessar a câmera aqui. Abra o app por HTTPS ou use uma foto.');return}
  try{
    const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
    cam.srcObject=st; await cam.play(); showMsg('');
  }catch(e){showMsg('Não foi possível usar a câmera ('+e.name+'). Permita o acesso nas configurações do navegador ou toque em "Foto".')}
}
$('#bCam').onclick=startCam;
$('#bPhoto').onclick=()=>$('#file').click();
$('#file').onchange=e=>{
  const f=e.target.files[0]; if(!f) return;
  photo.src=URL.createObjectURL(f); photo.style.display='block'; cam.style.display='none'; showMsg('');
};

/* ---------- abas e telas ---------- */
function goTab(name){
  $$('#top nav button').forEach(x=>x.classList.toggle('on',x.dataset.tab===name));
  $$('.panel').forEach(p=>p.classList.toggle('show',p.id===name));
  if(name==='historico') renderHist();
}
$$('#top nav button').forEach(b=>b.onclick=()=>goTab(b.dataset.tab));
$$('[data-go]').forEach(b=>b.onclick=()=>{
  $('#home').style.display='none'; goTab(b.dataset.go);
  if(b.dataset.go==='medir'){resize();startCam()} else startCam();
});

/* ---------- histórico ---------- */
function renderHist(){
  const ul=$('#histList'); ul.innerHTML='';
  if(!hist.length){ul.innerHTML='<li>Nenhuma medição ainda.</li>';return}
  hist.forEach((h,i)=>{
    const li=document.createElement('li'), s=document.createElement('span');
    s.textContent=`${fmt(h.v)} · ${h.k}${h.ext?' (externo)':''}${h.est!=null?' · estimativa '+fmt(h.est):''} · ${new Date(h.t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
    const b=document.createElement('button'); b.textContent='Apagar';
    b.onclick=()=>{hist.splice(i,1);localStorage.setItem('tar_hist',JSON.stringify(hist));renderHist()};
    li.append(s,b); ul.appendChild(li);
  });
}
$('#bClear').onclick=()=>{if(confirm('Apagar todo o histórico?')){hist=[];localStorage.removeItem('tar_hist');renderHist()}};

/* ---------- missão (caça aos ângulos) ---------- */
$('#bMission').onclick=()=>{
  const t=[90,45,60,120,30,135,180][Math.floor(Math.random()*7)];
  mission={t,tol:5};
  const txt=`Encontre na escola um ângulo de aproximadamente ${t}° (±5°), meça e salve.`;
  $('#missionText').textContent=txt; $('#mission').textContent='Missão: '+txt;
};

/* ---------- desafio de estimativa ---------- */
let ch=null,score=0,tries=0;
function drawCh(){
  const c=$('#chCv'),g=c.getContext('2d'); g.clearRect(0,0,240,180);
  const cx=120,cy=90,L=75, a1=ch.a0, a2=ch.a0-ch.deg*RAD;
  g.lineWidth=4; g.lineCap='round'; g.strokeStyle='#0b3d91';
  for(const a of [a1,a2]){g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+L*Math.cos(a),cy+L*Math.sin(a));g.stroke()}
  g.fillStyle='#d32f2f'; g.beginPath(); g.arc(cx,cy,5,0,7); g.fill();
}
function newChallenge(){ch={deg:5*(2+Math.floor(Math.random()*33)),a0:Math.random()*Math.PI*2};$('#chIn').value='';$('#chRes').textContent=`Acertos (até 5° de diferença): ${score}/${tries}`;drawCh()}
$('#chNew').onclick=newChallenge;
$('#chOk').onclick=()=>{
  if(!ch) newChallenge();
  const e=num($('#chIn').value); if(isNaN(e)){toast('Digite uma estimativa.');return}
  const d=Math.abs(e-ch.deg); tries++; if(d<=5) score++;
  $('#chRes').textContent=`O ângulo mede ${ch.deg}°. Sua diferença foi de ${d.toFixed(0)}°. ${d<=5?'Muito bem!':'Meça com o transferidor e tente de novo.'} Acertos: ${score}/${tries}`;
};

/* ---------- teste matemático (rode selfTest() no console) ---------- */
window.selfTest=()=>{
  const r=[30,45,60,90,120,180].map(a=>{
    const v=angleBetween({x:1,y:0},{x:Math.cos(a*RAD),y:Math.sin(a*RAD)});
    return {esperado:a,calculado:+v.toFixed(3),ok:Math.abs(v-a)<0.01};
  });
  console.table(r); return r;
};

addEventListener('resize',resize); addEventListener('orientationchange',()=>setTimeout(resize,250));
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
newChallenge(); resize();
})();
