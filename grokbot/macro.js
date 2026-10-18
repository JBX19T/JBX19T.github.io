/* DOLLOS · MACRO DESK — paper trading de OURO, EUR/USD e S&P 500 com preços reais do Lighter.
   Conta fictícia própria (separada da dos memecoins), long/short, stop e take-profit por ATR.
   Nada aqui envia ordens: só lê preços públicos e simula. */
(()=>{
const LT='https://mainnet.zklighter.elliot.ai';
const DEMO=new URLSearchParams(location.search).has('demo');
const CFG={start:10000,riskPct:.01,maxLev:2,fast:20,slow:50,brk:20,atrN:14,stopATR:2,tpATR:3,maxHoldBars:96,costBps:2,ddStop:.20,dayLoss:.05,
  res:'15m',resMs:15*60e3,minATRpct:.0005,maxATRpct:.03,pricePoll:DEMO?1000:15000,candlePoll:DEMO?3000:60000};
/* Lighter negoceia estes ativos como perpétuos: o ouro via PAXG (token lastreado a ouro) e o S&P via SPY (ETF) — são proxies. */
const MK=[
  {key:'GOLD',  label:'OURO',    note:'PAXG',  match:[/^PAXG$/i,/^XAU/i,/^GOLD$/i],dec:2,sim:[4150,.0009]},
  {key:'EURUSD',label:'EUR/USD', note:'EURUSD',match:[/^EURUSD$/i,/^EUR[-_/]?USD/i],dec:5,sim:[1.1240,.00025]},
  {key:'SPX',   label:'S&P 500', note:'SPY',   match:[/^SPY$/i,/^SPX/i,/^US500/i],   dec:2,sim:[760,.0007]},
];
const LS_KEY='dollosMacroV1';
const fresh=()=>({cash:CFG.start,pos:{},hist:[CFG.start],closed:0,wins:0,log:[],peak:CFG.start,halt:null,day:{d:'',eq:CFG.start},trades:[],since:Date.now(),maxDD:0,ddPeak:CFG.start});
let S=fresh();
if(!DEMO){try{const j=JSON.parse(localStorage.getItem(LS_KEY)||'null');if(j&&j.cash>0)S={...fresh(),...j}}catch(e){}}
const save=()=>{if(DEMO)return;try{localStorage.setItem(LS_KEY,JSON.stringify(S))}catch(e){}};
const P={};MK.forEach(m=>P[m.key]={px:null,chg:null,ts:0,bars:[],src:'',err:'',id:null,sig:{dir:'wait',why:'a iniciar'}});
const $m=id=>document.getElementById(id);
const L=(c,t)=>{try{log(c,'MACRO '+t)}catch(e){}};
const num=v=>{const n=typeof v==='string'?parseFloat(v):v;return Number.isFinite(n)?n:null};
const fmtPx=(m,v)=>v==null?'—':v.toFixed(m.dec);
const usd=v=>(v<0?'-$':'$')+Math.abs(v).toFixed(2);

/* ===== indicadores e estratégia (puros, testáveis) ===== */
function ema(a,n){if(a.length<n)return null;const k=2/(n+1);let e=a.slice(0,n).reduce((s,v)=>s+v,0)/n;for(let i=n;i<a.length;i++)e=a[i]*k+e*(1-k);return e}
function atr(bars,n){if(bars.length<n+1)return null;let s=0;for(let i=bars.length-n;i<bars.length;i++){const b=bars[i],pc=bars[i-1].c;s+=Math.max(b.h-b.l,Math.abs(b.h-pc),Math.abs(b.l-pc))}return s/n}
/* tendência (EMA rápida vs lenta) + rompimento do máximo/mínimo das últimas N velas + filtro de volatilidade */
function signal(bars){
  const need=Math.max(CFG.slow,CFG.brk+1,CFG.atrN+1)+1;
  if(bars.length<need)return{dir:'wait',why:`velas ${bars.length}/${need}`};
  const c=bars.map(b=>b.c),last=bars[bars.length-1],f=ema(c,CFG.fast),s=ema(c,CFG.slow),a=atr(bars,CFG.atrN);
  const prev=bars.slice(-CFG.brk-1,-1),hi=Math.max(...prev.map(b=>b.h)),lo=Math.min(...prev.map(b=>b.l));
  const ap=a/last.c;
  if(ap<CFG.minATRpct)return{dir:'flat',why:'volatilidade muito baixa',atr:a};
  if(ap>CFG.maxATRpct)return{dir:'flat',why:'volatilidade extrema',atr:a};
  if(f>s&&last.c>hi)return{dir:'long',why:'tendência de alta + rompe máximo',atr:a};
  if(f<s&&last.c<lo)return{dir:'short',why:'tendência de baixa + rompe mínimo',atr:a};
  return{dir:'flat',why:f>s?'alta, sem rompimento':'baixa, sem rompimento',atr:a};
}
const cost=()=>CFG.costBps/1e4;
function unreal(p,px){return p.side*(px-p.entry)/p.entry*p.notional}
function equity(){let e=S.cash;for(const k in S.pos){const px=P[k].px;if(px!=null)e+=unreal(S.pos[k],px)}return e}
function sizeFor(eq,entry,stopDist){const riskUsd=eq*CFG.riskPct,n=riskUsd/(stopDist/entry);return Math.min(n,eq*CFG.maxLev/MK.length)}
function open(m,dir,sig){
  const p=P[m.key],px=p.px,side=dir==='long'?1:-1,entry=px*(1+side*cost()),stopDist=CFG.stopATR*sig.atr;
  const notional=sizeFor(equity(),entry,stopDist);if(!(notional>1))return;
  S.pos[m.key]={side,entry,notional,stop:entry-side*stopDist,tp:entry+side*CFG.tpATR*sig.atr,opened:Date.now(),held:0,why:sig.why};
  L('p',`${dir==='long'?'LONG':'SHORT'} ${m.label} ${usd(notional)} @ ${fmtPx(m,entry)} · SL ${fmtPx(m,S.pos[m.key].stop)} · TP ${fmtPx(m,S.pos[m.key].tp)}`);save();
}
function close(m,why){
  const p=S.pos[m.key],px=P[m.key].px;if(!p||px==null)return;
  const pnl=unreal(p,px)-p.notional*cost();S.cash+=pnl;S.closed++;if(pnl>0)S.wins++;delete S.pos[m.key];
  S.trades.push({l:m.label,side:p.side,o:p.opened,c:Date.now(),en:p.entry,ex:px,nt:p.notional,pnl,why});if(S.trades.length>500)S.trades.shift();
  L(pnl>0?'w':'l',`FECHO ${m.label} ${why} ${pnl>=0?'+':''}${usd(pnl)}`);save();window.RESULTS&&RESULTS.refresh();
}
function checkExits(m){
  const p=S.pos[m.key],px=P[m.key].px;if(!p||px==null)return;
  if(p.side>0?px<=p.stop:px>=p.stop)return close(m,'stop-loss');
  if(p.side>0?px>=p.tp:px<=p.tp)return close(m,'take-profit');
  if(p.held>=CFG.maxHoldBars)return close(m,'time-stop');
}
const today=()=>new Date().toISOString().slice(0,10);
function haltAll(kind,msg,why,day){MK.forEach(m=>{if(S.pos[m.key])close(m,why)});S.halt={kind,msg,day};L('l','⛔ PARADO · '+msg);save()}
function guard(){   // proteção de capital: corre a cada atualização de preços
  const e=equity(),d=today();
  if(!S.day||S.day.d!==d)S.day={d,eq:e};
  if(e>S.peak)S.peak=e;if(e>S.ddPeak)S.ddPeak=e;S.maxDD=Math.max(S.maxDD||0,1-e/S.ddPeak);
  if(!S.halt){
    if(e<=S.peak*(1-CFG.ddStop))haltAll('dd',`perda de ${Math.round(CFG.ddStop*100)}% desde o máximo da conta`,'kill-switch');
    else if(e<=S.day.eq*(1-CFG.dayLoss))haltAll('day',`perda diária de ${Math.round(CFG.dayLoss*100)}%`,'limite diário',d);
  }else if(S.halt.kind==='day'&&S.halt.day!==d){S.halt=null;L('p','retomado: novo dia');save()}
}
function resume(){S.halt=null;S.peak=equity();S.day={d:today(),eq:equity()};L('p','retomado manualmente');save()}
function onBar(m){   // corre quando há uma vela nova ou dados novos
  const p=P[m.key];if(p.px==null)return;
  const stale=p.src==='lighter'&&p.bars.length&&Date.now()-p.bars[p.bars.length-1].t>CFG.resMs*4;
  p.sig=stale?{dir:'flat',why:'mercado parado / sem velas novas'}:signal(p.bars);
  if(S.pos[m.key]){S.pos[m.key].held++;checkExits(m);return}
  if((p.sig.dir==='long'||p.sig.dir==='short')&&S.pos[m.key]==null&&!S.halt)open(m,p.sig.dir,p.sig);
}

/* ===== dados: Lighter (REST público) ===== */
async function jf(u){const r=await fetch(u);if(!r.ok)throw new Error(r.status+' '+u.replace(LT,'').split('?')[0]);return r.json()}
const arrays=o=>{const out=[];(function w(x,d){if(d>3||x==null)return;if(Array.isArray(x)){out.push(x);return}if(typeof x==='object')for(const k in x)w(x[k],d+1)})(o,0);return out};
function parseMarkets(j){   // [{symbol,market_id,...}] em qualquer chave do JSON
  for(const a of arrays(j))if(a.length&&a[0]&&typeof a[0]==='object'&&'symbol' in a[0]&&('market_id' in a[0]||'id' in a[0]))return a.map(x=>({symbol:String(x.symbol),id:x.market_id??x.id,type:String(x.market_type||'perp')}));
  return[];
}
function pickMarket(list,m){
  const cand=list.filter(x=>m.match.some(r=>r.test(x.symbol)));
  return cand.find(x=>/perp/i.test(x.type))||cand[0]||null;
}
function parseDetail(j){for(const a of arrays(j))for(const x of a)if(x&&typeof x==='object'&&('last_trade_price' in x))return x;return j&&j.last_trade_price!=null?j:null}
function parseCandles(j){
  for(const a of arrays(j)){if(!a.length)continue;
    const out=a.map(x=>Array.isArray(x)?{t:x[0],o:x[1],h:x[2],l:x[3],c:x[4]}:{t:x.timestamp??x.t??x.time??x.start_timestamp,o:x.open??x.o,h:x.high??x.h,l:x.low??x.l,c:x.close??x.c})
      .map(b=>({t:num(b.t),o:num(b.o),h:num(b.h),l:num(b.l),c:num(b.c)})).filter(b=>b.t!=null&&b.o!=null&&b.h!=null&&b.l!=null&&b.c!=null);
    if(out.length){out.forEach(b=>{if(b.t<1e12)b.t*=1000});return out.sort((x,y)=>x.t-y.t)}}
  return[];
}
async function discover(){
  const j=await jf(LT+'/api/v1/orderBooks'),list=parseMarkets(j);
  if(!list.length)throw new Error('lista de mercados vazia ou em formato desconhecido');
  for(const m of MK){const f=pickMarket(list,m),p=P[m.key];if(f){p.id=f.id;p.sym=f.symbol}else p.err='mercado não encontrado no Lighter'}
}
async function pollPrice(m){
  const p=P[m.key];if(p.id==null)return;
  try{const d=parseDetail(await jf(`${LT}/api/v1/orderBookDetails?market_id=${p.id}`));
    const px=d&&num(d.last_trade_price);if(!(px>0))throw new Error('sem preço');
    p.px=px;p.chg=d&&num(d.daily_price_change);p.ts=Date.now();p.err='';
    if(p.src!=='lighter'||!p.bars.length)tickBar(p,px);   // sem velas da API: constrói 1 min a partir dos preços
    checkExits(m);guard();
  }catch(e){p.err=e.message}
}
function tickBar(p,px){
  const t=Math.floor(Date.now()/60e3)*60e3,b=p.bars[p.bars.length-1];
  if(b&&b.t===t){b.h=Math.max(b.h,px);b.l=Math.min(b.l,px);b.c=px}
  else{p.bars.push({t,o:px,h:px,l:px,c:px});if(p.bars.length>300)p.bars.shift();p.newBar=true}
  p.src=p.src||'ticks';
}
async function pollCandles(m){
  const p=P[m.key];if(p.id==null)return;
  const end=Date.now(),start=end-CFG.resMs*120;
  const tries=[`resolution=${CFG.res}&start_timestamp=${Math.floor(start/1000)}&end_timestamp=${Math.floor(end/1000)}&count_back=120`,
               `resolution=${CFG.res}&start_timestamp=${start}&end_timestamp=${end}&count_back=120`];
  for(const q of tries){
    try{const bars=parseCandles(await jf(`${LT}/api/v1/candles?market_id=${p.id}&${q}`));
      if(bars.length>=5){const prevLast=p.bars.length&&p.src==='lighter'?p.bars[p.bars.length-1].t:0;p.bars=bars.slice(-200);p.src='lighter';p.err='';
        if(p.bars[p.bars.length-1].t!==prevLast)onBar(m);else if(p.src==='lighter')checkExits(m);return}
    }catch(e){p.candleErr=e.message}
  }
  if(p.src!=='lighter'){p.src='ticks'}   // continua com velas de 1 min construídas localmente
}

/* ===== modo demo: preços simulados, mesma lógica ===== */
function demoInit(){
  MK.forEach(m=>{const p=P[m.key];p.id='demo';p.sym=m.note;let px=m.sim[0],drift=0;const bars=[];let t=Date.now()-130*CFG.resMs;
    for(let i=0;i<130;i++){if(i%25===0)drift=(Math.random()-.45)*m.sim[1]*.5;const o=px;px*=1+drift+(Math.random()-.5)*m.sim[1];bars.push({t,o,h:Math.max(o,px)*(1+Math.random()*m.sim[1]*.3),l:Math.min(o,px)*(1-Math.random()*m.sim[1]*.3),c:px});t+=CFG.resMs}
    p.bars=bars;p.px=px;p.src='lighter';p.chg=0;p.ts=Date.now();p.drift=drift});
}
function demoStep(m){
  const p=P[m.key],b=p.bars[p.bars.length-1];if(Math.random()<.08)p.drift=(Math.random()-.47)*m.sim[1]*.9;
  const o=b.c,c=o*(1+p.drift+(Math.random()-.5)*m.sim[1]*1.2);
  p.bars.push({t:b.t+CFG.resMs,o,h:Math.max(o,c)*(1+Math.random()*m.sim[1]*.3),l:Math.min(o,c)*(1-Math.random()*m.sim[1]*.3),c});if(p.bars.length>200)p.bars.shift();
  p.px=c;p.ts=Date.now();onBar(m);guard();
}

/* ===== UI ===== */
function render(){
  const eq=equity(),pnl=eq-CFG.start,body=$m('mkBody');if(!body)return;
  const live=MK.some(m=>P[m.key].px!=null&&P[m.key].src==='lighter');
  $m('mkInfo').textContent=DEMO?'DEMO · SIMULADO':MK.every(m=>P[m.key].err&&P[m.key].px==null)?'SEM DADOS':live?'LIGHTER · LIVE':MK.some(m=>P[m.key].px!=null)?'LIGHTER · SÓ PREÇOS':'A LIGAR…';
  const cards=MK.map(m=>{const p=P[m.key],pos=S.pos[m.key],s=(p.src==='ticks'&&(!p.sig||p.sig.dir==='wait'))?signal(p.bars):(p.sig||{}),chg=p.chg;
    const upnl=pos&&p.px!=null?unreal(pos,p.px):null;
    const tag=pos?`<b class="${pos.side>0?'up':'dn'}">${pos.side>0?'LONG':'SHORT'}</b>`:`<span class="sg">${({long:'sinal LONG',short:'sinal SHORT',flat:'sem sinal',wait:'a recolher velas'})[s.dir]||'—'}</span>`;
    return `<div class="mkc"><div class="mkh"><b>${m.label}</b><small>${p.sym||m.note}</small></div>
      <div class="mkp">${fmtPx(m,p.px)}</div>
      <div class="mkr"><span class="${chg>0?'up':chg<0?'dn':''}">${chg!=null?(chg>0?'+':'')+chg.toFixed(2)+'% 24h':'—'}</span>${tag}</div>
      <div class="mkr"><small>${p.err?'⚠ '+p.err:(s.why||'')+(p.src==='ticks'?' · velas locais de 1 min':'')}</small>${upnl!=null?`<span class="${upnl>=0?'up':'dn'}">${upnl>=0?'+':''}${usd(upnl)}</span>`:''}</div></div>`}).join('');
  const rows=MK.filter(m=>S.pos[m.key]).map(m=>{const p=S.pos[m.key],px=P[m.key].px,u=px!=null?unreal(p,px):0;
    return `<tr><td>${m.label}</td><td>${p.side>0?'LONG':'SHORT'}</td><td>${fmtPx(m,p.entry)}</td><td>${fmtPx(m,px)}</td><td>${fmtPx(m,p.stop)}</td><td>${fmtPx(m,p.tp)}</td><td class="${u>=0?'up':'dn'}">${u>=0?'+':''}${usd(u)}</td><td><button class="ghost" data-k="${m.key}" aria-label="Fechar ${m.label}">✕</button></td></tr>`}).join('');
  body.innerHTML=`${S.halt?`<div class="halt">⛔ <b>PARADO</b> · ${S.halt.msg}. Nenhuma entrada nova. <button class="ghost" id="mkResume">RETOMAR</button></div>`:''}<div class="mkg">${cards}</div>
    <div class="mkacc"><span>Saldo <b>${usd(eq)}</b> <span class="${pnl>=0?'up':'dn'}">(${pnl>=0?'+':''}${(pnl/CFG.start*100).toFixed(2)}%)</span></span><span>${S.wins}W ${S.closed-S.wins}L</span><button class="ghost" id="mkReset">REINICIAR</button></div>
    ${rows?`<table><thead><tr><th>Ativo</th><th></th><th>Entrada</th><th>Preço</th><th>SL</th><th>TP</th><th>P/L</th><th></th></tr></thead><tbody id="mkRows">${rows}</tbody></table>`:'<div class="note">Sem posições abertas. O bot só entra quando há tendência e rompimento (EMA 20/50 + máximo/mínimo de 20 velas).</div>'}
    <div class="note">Paper trading: conta fictícia de ${usd(CFG.start)}, risco de 1% por trade, stop 2×ATR, alvo 3×ATR, custo ${CFG.costBps} bps por lado, sem alavancagem acima de ${CFG.maxLev}×. Proteção: se a conta perder ${Math.round(CFG.ddStop*100)}% desde o máximo, fecha tudo e pára; perde ${Math.round(CFG.dayLoss*100)}% num dia, pausa até amanhã (retomar é manual). Ouro e S&P usam proxies do Lighter (PAXG e SPY). O estado fica guardado no telemóvel.</div>`;
}
function record(){guard();const e=equity();S.hist.push(e);if(S.hist.length>500)S.hist.shift();save()}
function bind(){
  $m('mkBody').addEventListener('click',e=>{
    if(e.target.id==='mkResume'){resume();render();return}
    if(e.target.id==='mkReset'){if(!confirm('Reiniciar a conta do Macro Desk?'))return;S=fresh();save();render();return}
    const k=e.target.dataset&&e.target.dataset.k;if(k){const m=MK.find(x=>x.key===k);close(m,'manual');render()}
  });
}

async function start(){
  if(!$m('mkBody'))return;bind();alBind();render();
  if(DEMO){demoInit();setInterval(()=>{MK.forEach(demoStep);record();render()},CFG.candlePoll);render();return}
  try{await discover()}catch(e){MK.forEach(m=>P[m.key].err=e.message);L('l','mercados: '+e.message)}
  const loop=async()=>{await Promise.all(MK.map(pollPrice));render()};
  const cloop=async()=>{await Promise.all(MK.map(pollCandles));record();render()};
  await loop();cloop();setInterval(loop,CFG.pricePoll);setInterval(cloop,CFG.candlePoll);
  setInterval(()=>MK.forEach(m=>{const p=P[m.key];if(p.src==='ticks'&&p.newBar){p.newBar=false;onBar(m)}}),5000);
}
/* ===== ALPACA (paper): espelha as posições do Macro Desk numa conta de paper trading da Alpaca =====
   Passa pelo worker (/alpaca/*), que guarda as chaves e só fala com o endereço de PAPER. Estratégia de sincronização:
   a cada minuto compara a posição que o Macro Desk quer (S.pos) com a que existe na Alpaca e envia só a diferença,
   apenas com o mercado de ações aberto. ETFs: ouro→GLD, EUR/USD→FXE, S&P→SPY. */
const AL_MAP={GOLD:'GLD',EURUSD:'FXE',SPX:'SPY'},AL_KEY='dollosAlpacaV1',AL_POLL=60000;
const AL={on:false,token:'',st:null,err:'',busy:false,managed:{},log:[]};
try{const j=JSON.parse(localStorage.getItem(AL_KEY)||'null');if(j&&j.token)Object.assign(AL,{on:!!j.on,token:j.token,managed:j.managed||{}})}catch(e){}
const alSave=()=>{try{localStorage.setItem(AL_KEY,JSON.stringify({on:AL.on,token:AL.token,managed:AL.managed}))}catch(e){}};
const alApi=()=>typeof HOLDERS_API==='string'?HOLDERS_API:'';
async function alFetch(method,path,body){
  const f=window.CapacitorWebFetch||fetch,r=await f(alApi()+path,{method,headers:{'x-token':AL.token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j;
}
const alNote=t=>{AL.log.unshift(new Date().toISOString().slice(11,16)+' '+t);AL.log.length=Math.min(AL.log.length,5);L('p','ALPACA '+t)};
/* decide o que enviar: puro, para testar */
function alPlan(want,have,managed){   // want: {SYM:{side:'buy'|'sell',notional}}, have: {SYM:'buy'|'sell'}
  const acts=[];
  for(const sym of new Set([...Object.keys(want),...Object.keys(have)])){
    const w=want[sym],h=have[sym];
    if(w&&!h)acts.push({op:'open',symbol:sym,side:w.side,notional:w.notional});
    else if(h&&(!w||w.side!==h)&&managed[sym])acts.push({op:'close',symbol:sym});
  }
  return acts;
}
async function alSync(){
  if(!AL.on||AL.busy||DEMO)return;AL.busy=true;
  try{
    const st=await alFetch('GET','/alpaca/state');AL.st=st;AL.err='';
    if(st.open){
      const want={};for(const m of MK){const p=S.pos[m.key];if(p)want[AL_MAP[m.key]]={side:p.side>0?'buy':'sell',notional:p.notional}}
      const have={};st.positions.forEach(p=>have[p.symbol]=p.side==='long'?'buy':'sell');
      for(const a of alPlan(want,have,AL.managed)){
        const r=await alFetch('POST',a.op==='open'?'/alpaca/order':'/alpaca/close',a);
        if(r.skipped){AL.err=a.symbol+': '+r.skipped;continue}
        if(a.op==='open'){AL.managed[a.symbol]=true;alNote(`${a.side==='buy'?'COMPRA':'VENDA A DESCOBERTO'} ${r.qty} ${a.symbol} @ ~${(+r.price).toFixed(2)}`)}
        else{delete AL.managed[a.symbol];alNote(`FECHO ${a.symbol}`)}
        alSave();
      }
      AL.st=await alFetch('GET','/alpaca/state');
    }
  }catch(e){AL.err=e.message}
  AL.busy=false;alRender();
}
function alRender(){
  const el=$m('alBody');if(!el)return;
  if(DEMO||!alApi()){el.innerHTML='';return}
  const st=AL.st;
  el.innerHTML=!AL.on?`<div class="alh"><b>ALPACA · PAPER</b><small>copia as posições do Macro Desk (ouro→GLD, EUR/USD→FXE, S&amp;P→SPY) numa conta de paper trading real da Alpaca</small></div>
      <div class="pmbar"><input id="alTok" type="password" autocomplete="off" placeholder="token do worker (APP_TOKEN)"><button class="ghost" id="alOn">LIGAR</button></div>
      <div class="note">Precisas de ter configurado os segredos ALPACA_KEY, ALPACA_SECRET e APP_TOKEN no Cloudflare Worker. O token fica só neste aparelho. Só dinheiro fictício: o worker só fala com a conta de paper.</div>`
    :`<div class="alh"><b>ALPACA · PAPER</b><small>${st?`${st.open?'mercado ABERTO':'mercado FECHADO'} · equity $${(+st.equity).toFixed(2)} · ${st.status}`:'a ligar…'}</small><button class="ghost" id="alOff">DESLIGAR</button></div>
      ${AL.err?`<div class="note">⚠ ${AL.err}</div>`:''}
      ${st&&st.positions.length?`<table><thead><tr><th>ETF</th><th></th><th>Qtd</th><th>Entrada</th><th>P/L</th></tr></thead><tbody>${st.positions.map(p=>`<tr><td>${p.symbol}</td><td>${p.side==='long'?'LONG':'SHORT'}</td><td>${Math.abs(p.qty)}</td><td>${p.avg.toFixed(2)}</td><td class="${p.pl>=0?'up':'dn'}">${p.pl>=0?'+':''}${usd(p.pl)}</td></tr>`).join('')}</tbody></table>`:'<div class="note">Sem posições na Alpaca.</div>'}
      ${AL.log.length?`<div class="note">${AL.log.join('<br>')}</div>`:''}
      <div class="note">Só envia ordens com a bolsa dos EUA aberta (seg–sex, 14:30–21:00 em Portugal). Fora desse horário o Macro Desk continua mas a Alpaca espera.</div>`;
}
function alBind(){
  const el=$m('alBody');if(!el)return;
  el.addEventListener('click',e=>{
    if(e.target.id==='alOn'){const t=($m('alTok').value||'').trim();if(!t)return;AL.token=t;AL.on=true;AL.err='';alSave();alRender();alSync()}
    if(e.target.id==='alOff'){AL.on=false;AL.st=null;alSave();alRender()}
  });
  alRender();setInterval(alSync,AL_POLL);if(AL.on)setTimeout(alSync,3000);
}

window.MACRO={alPlan,AL,alSync,guard,resume,CFG,MK,P,ema,atr,signal,sizeFor,parseMarkets,pickMarket,parseDetail,parseCandles,state:()=>S,reset:()=>{S=fresh()},equity,unreal,open:(k,d,s)=>open(MK.find(m=>m.key===k),d,s),close:k=>close(MK.find(m=>m.key===k),'teste'),setPrice:(k,px)=>{P[k].px=px},checkExits:k=>checkExits(MK.find(m=>m.key===k))};
start();
})();
