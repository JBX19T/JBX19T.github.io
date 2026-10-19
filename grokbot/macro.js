/* DOLLOS · MACRO DESK — paper trading de OURO, EUR/USD e S&P 500.
   Preços e velas da HYPERLIQUID (xyz:GOLD, xyz:SP500, xyz:EUR): os mesmos mercados onde o worker executa e onde o teste histórico corre.
   (O Lighter, com PAXG e SPY como proxies, continua disponível com ?feed=lighter, mas já não é o padrão: sinais calculados num feed e
   executados noutro não são comparáveis.) Os sinais usam só VELAS FECHADAS, como o teste histórico.
   Conta fictícia própria (separada da dos memecoins), long/short, stop e take-profit por ATR.
   Nada aqui envia ordens: só lê preços públicos e simula. */
(()=>{
const LT='https://mainnet.zklighter.elliot.ai';
const DEMO=new URLSearchParams(location.search).has('demo');
/* regras comuns em strategy.js (DSTRAT.DEFAULTS): risco 1%, alavancagem 5×, EMA 20/50, rompimento de 20 velas, ATR 14, stop 2×ATR, alvo 3×ATR, 96 velas,
   custo 9 bps por ordem de mercado nos mercados HIP-3 da Hyperliquid (valor de uma fonte secundária, por confirmar) */
const CFG={...DSTRAT.DEFAULTS,start:10000,
 ddStop:.20,dayLoss:.05,
  res:'15m',resMs:15*60e3,pricePoll:DEMO?1000:15000,candlePoll:DEMO?3000:60000};
/* o filtro de volatilidade/custo é calculado por strategy.js (custo de ida e volta <= 15% do risco da trade), igual ao do teste histórico */
/* estratégia e tamanho das velas escolhidos no TESTE HISTÓRICO (por omissão: rompimento em velas de 15 min) */
const STRAT_KEY='dollosStratV1',IV_MS={'1m':6e4,'5m':3e5,'15m':9e5,'1h':36e5,'4h':144e5,'1d':864e5};
let CHOICE={strategy:'breakout',iv:'15m'};
if(!DEMO){try{const j=JSON.parse(localStorage.getItem(STRAT_KEY)||'null');if(j&&DSTRAT.PRESETS[j.strategy]&&IV_MS[j.iv])CHOICE={strategy:j.strategy,iv:j.iv}}catch(e){}}
const BASE={...CFG};   // regras sem os parâmetros próprios da estratégia (o teste histórico compara as estratégias a partir daqui)
Object.assign(CFG,DSTRAT.withStrategy(CFG,CHOICE.strategy),{res:CHOICE.iv,resMs:IV_MS[CHOICE.iv]});
CFG.candlePoll=DEMO?3000:Math.min(60000,Math.max(10000,CFG.resMs/4));   // velas curtas (scalping) pedem-se com mais frequência: a decisão não pode esperar uma vela inteira
const SCALP=DSTRAT.isScalp(CHOICE.strategy,CHOICE.iv);
function setStrategy(strategy,iv){
  if(!DSTRAT.PRESETS[strategy]||!IV_MS[iv])return false;
  try{localStorage.setItem(STRAT_KEY,JSON.stringify({strategy,iv}))}catch(e){return false}
  return true;   // aplica-se ao recarregar a página
}
/* Lighter negoceia estes ativos como perpétuos: o ouro via PAXG (token lastreado a ouro) e o S&P via SPY (ETF) — são proxies. */
const MK=[
  {key:'GOLD',  label:'OURO',    note:'PAXG',  match:[/^PAXG$/i,/^XAU/i,/^GOLD$/i],dec:2,sim:[4150,.0009]},
  {key:'EURUSD',label:'EUR/USD', note:'EURUSD',match:[/^EURUSD$/i,/^EUR[-_/]?USD/i],dec:5,sim:[1.1240,.00025]},
  {key:'SPX',   label:'S&P 500', note:'SPY',   match:[/^SPY$/i,/^SPX/i,/^US500/i],   dec:2,sim:[760,.0007]},
];
/* origem dos dados: 'hl' (padrão) ou 'lighter' (?feed=lighter ou localStorage dollosFeedV1) */
let FEED='hl';
try{const q=new URLSearchParams(location.search).get('feed'),j=localStorage.getItem('dollosFeedV1');if(q==='lighter'||(q==null&&j==='lighter'))FEED='lighter'}catch(e){}
const HLURL='https://api.hyperliquid.xyz/info',HLC={GOLD:'xyz:GOLD',SPX:'xyz:SP500',EURUSD:'xyz:EUR'};
const LS_KEY='dollosMacroV1';
const fresh=()=>({cash:CFG.start,pos:{},hist:[CFG.start],closed:0,wins:0,log:[],peak:CFG.start,halt:null,day:{d:'',eq:CFG.start},trades:[],since:Date.now(),maxDD:0,ddPeak:CFG.start,sigStats:{}});
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
const {ema,atr,signal,cost,sizeFor,trailStop,hasTarget,isEOD,noEntry}=DSTRAT.make(CFG,MK.length);   // regras em strategy.js, partilhadas com o teste histórico
function unreal(p,px){return p.side*(px-p.entry)/p.entry*p.notional}
function equity(){let e=S.cash;for(const k in S.pos){const px=P[k].px;if(px!=null)e+=unreal(S.pos[k],px)}return e}
const slipIn=()=>(CFG.slipBps||0)/1e4;
/* custo de saída por motivo: o alvo é uma ordem limitada (taxa maker, sem slippage); o stop paga taxa taker + slippage de stop; o resto sai a mercado */
function exitCost(why){
  if(why==='take-profit'&&CFG.tpMode!=='market')return{fee:(CFG.makerBps||0)/1e4,slip:0};
  return{fee:cost(),slip:((why==='stop-loss'?CFG.slipStopBps:CFG.slipBps)||0)/1e4};
}
function open(m,dir,sig){
  const p=P[m.key],px=p.px,side=dir==='long'?1:-1,entry=px*(1+side*(cost()+slipIn())),stopDist=CFG.stopATR*sig.atr;
  const notional=sizeFor(equity(),entry,stopDist);if(!(notional>1))return;
  S.pos[m.key]={side,entry,notional,risk:notional*stopDist/entry,stop:entry-side*stopDist,tp:hasTarget?entry+side*CFG.tpATR*sig.atr:null,atr:sig.atr,best:entry,opened:Date.now(),held:0,why:sig.why};
  L('p',`${dir==='long'?'LONG':'SHORT'} ${m.label} ${usd(notional)} @ ${fmtPx(m,entry)} · SL ${fmtPx(m,S.pos[m.key].stop)} · ${hasTarget?'TP '+fmtPx(m,S.pos[m.key].tp):'stop móvel, sem alvo'}`);save();
}
function close(m,why){
  const p=S.pos[m.key],px=P[m.key].px;if(!p||px==null)return;
  const x=exitCost(why),pxe=px*(1-p.side*x.slip),pnl=unreal(p,pxe)-p.notional*x.fee;S.cash+=pnl;S.closed++;if(pnl>0)S.wins++;delete S.pos[m.key];
  // risk e custos ficam registados: sem eles não se consegue medir o resultado em R nem quanto os custos pesaram
  S.trades.push({l:m.label,side:p.side,o:p.opened,c:Date.now(),en:p.entry,ex:pxe,nt:p.notional,pnl,why,risk:p.risk,cost:p.notional*(cost()+slipIn()+x.fee+x.slip)});if(S.trades.length>500)S.trades.shift();
  L(pnl>0?'w':'l',`FECHO ${m.label} ${why} ${pnl>=0?'+':''}${usd(pnl)}`);save();window.RESULTS&&RESULTS.refresh();
}
function checkExits(m){
  const p=S.pos[m.key],px=P[m.key].px;if(!p||px==null)return;
  if(p.side>0?px<=p.stop:px>=p.stop)return close(m,'stop-loss');
  if(p.tp!=null&&(p.side>0?px>=p.tp:px<=p.tp))return close(m,'take-profit');
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
/* só velas FECHADAS entram nos sinais (a vela em formação muda a cada tick e o teste histórico nunca a vê) */
const barMs=p=>p.src==='ticks'?60e3:CFG.resMs;
const closedBars=p=>DEMO?p.bars:p.bars.filter(b=>b.t+barMs(p)<=Date.now());
function onBar(m){   // corre quando fecha uma vela nova
  const p=P[m.key];if(p.px==null)return;
  const cb=closedBars(p),lastT=cb.length?cb[cb.length-1].t:0;
  const stale=!DEMO&&p.src!=='ticks'&&lastT&&Date.now()-lastT>CFG.resMs*4;
  p.sig=stale?{dir:'flat',why:'mercado parado / sem velas novas'}:signal(cb);
  const cat=p.sig.dir==='flat'?(/custo/.test(p.sig.why)?'flat:custo':/volatilidade/.test(p.sig.why)?'flat:vol':'flat'):p.sig.dir;   // contagem de sinais: dados para diagnosticar
  const ss=(S.sigStats??={})[m.key]??={};ss[cat]=(ss[cat]||0)+1;
  const barEnd=lastT?lastT+barMs(p):0;   // instante em que a vela fechou
  if(S.pos[m.key]){const q=S.pos[m.key];q.held++;checkExits(m);
    if(S.pos[m.key]&&isEOD(barEnd)){close(m,'fim do dia');return}   // day trade: nunca dorme com posição
    if(S.pos[m.key]&&cb.length){q.stop=trailStop(q,cb[cb.length-1]);save()}   // stop móvel (só na estratégia que o usa)
    return}
  if(noEntry(barEnd))return;   // day trade: não abre nas últimas horas do dia
  if((p.sig.dir==='long'||p.sig.dir==='short')&&S.pos[m.key]==null&&!S.halt)open(m,p.sig.dir,p.sig);
}
/* chamado depois de cada atualização de velas: se fechou uma vela nova, decide; senão só vigia saídas */
function afterCandles(m){
  const p=P[m.key],cb=closedBars(p),t=cb.length?cb[cb.length-1].t:0;
  if(t&&t!==p.lastClosedT){const first=p.lastClosedT==null;p.lastClosedT=t;if(!first)onBar(m);else{p.sig=signal(cb);checkExits(m)}}   // no arranque não decide sobre uma vela antiga
  else checkExits(m);
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
  const end=Date.now(),start=end-CFG.resMs*200;
  const tries=[`resolution=${CFG.res}&start_timestamp=${Math.floor(start/1000)}&end_timestamp=${Math.floor(end/1000)}&count_back=200`,
               `resolution=${CFG.res}&start_timestamp=${start}&end_timestamp=${end}&count_back=200`];
  for(const q of tries){
    try{const bars=parseCandles(await jf(`${LT}/api/v1/candles?market_id=${p.id}&${q}`));
      if(bars.length>=5){p.bars=bars.slice(-200);p.src='lighter';p.err='';afterCandles(m);return}
    }catch(e){p.candleErr=e.message}
  }
  if(p.src!=='lighter'){p.src='ticks'}   // continua com velas de 1 min construídas localmente
}

/* ===== dados: Hyperliquid (API pública /info) — o mesmo feed do worker e do teste histórico ===== */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hlCoin=k=>{try{const m=LIVE.P.hl.st&&LIVE.P.hl.st.markets;if(m&&m[k]&&m[k].coin)return m[k].coin}catch(e){}return HLC[k]};
async function hlPost(body){
  let last='';
  for(let a=0;a<3;a++){
    try{const r=await fetch(HLURL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      if(r.status===429){last='429';await sleep(1200*(a+1));continue}
      if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}catch(e){last=e.message;if(a<2)await sleep(500)}
  }
  throw new Error('hyperliquid '+last);
}
async function pollHLPrices(){
  try{const mids=await hlPost({type:'allMids',dex:'xyz'});
    for(const m of MK){const p=P[m.key],px=num(mids[hlCoin(m.key)]);
      if(!(px>0)){p.err='sem preço de '+hlCoin(m.key);continue}
      p.px=px;p.ts=Date.now();p.err='';p.sym=hlCoin(m.key);p.src='hl';checkExits(m)}
    guard();
  }catch(e){MK.forEach(m=>{P[m.key].err=e.message})}
}
async function pollHLCandles(m){
  const p=P[m.key],coin=hlCoin(m.key),end=Date.now();
  try{const arr=await hlPost({type:'candleSnapshot',req:{coin,interval:CFG.res,startTime:end-CFG.resMs*205,endTime:end}});
    const bars=(arr||[]).map(x=>({t:+x.t,o:+x.o,h:+x.h,l:+x.l,c:+x.c})).filter(b=>b.t&&b.o>0&&b.h>0&&b.l>0&&b.c>0).sort((a,b)=>a.t-b.t);
    if(bars.length<5)throw new Error('poucas velas ('+bars.length+')');
    p.bars=bars.slice(-200);p.src='hl';p.sym=coin;p.err='';
    const back=Math.round(864e5/CFG.resMs),ref=p.bars[p.bars.length-1-back];if(ref&&p.px)p.chg=(p.px/ref.c-1)*100;
    afterCandles(m);
  }catch(e){p.err=e.message}
}

/* ===== modo demo: preços simulados, mesma lógica ===== */
function demoInit(){
  MK.forEach(m=>{const p=P[m.key];p.id='demo';p.sym=m.note;let px=m.sim[0],drift=0;const bars=[];let t=Date.now()-130*CFG.resMs;
    for(let i=0;i<130;i++){if(i%25===0)drift=(Math.random()-.45)*m.sim[1]*.5;const o=px;px*=1+drift+(Math.random()-.5)*m.sim[1];bars.push({t,o,h:Math.max(o,px)*(1+Math.random()*m.sim[1]*.3),l:Math.min(o,px)*(1-Math.random()*m.sim[1]*.3),c:px});t+=CFG.resMs}
    p.bars=bars;p.px=px;p.src=FEED;p.chg=0;p.ts=Date.now();p.drift=drift});
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
  const FN=FEED==='hl'?'HYPERLIQUID':'LIGHTER',live=MK.some(m=>P[m.key].px!=null&&P[m.key].src===FEED);
  $m('mkInfo').textContent=DEMO?'DEMO · SIMULADO':MK.every(m=>P[m.key].err&&P[m.key].px==null)?'SEM DADOS':live?FN+' · LIVE':MK.some(m=>P[m.key].px!=null)?FN+' · SÓ PREÇOS':'A LIGAR…';
  const cards=MK.map(m=>{const p=P[m.key],pos=S.pos[m.key],s=(p.src==='ticks'&&(!p.sig||p.sig.dir==='wait'))?signal(p.bars):(p.sig||{}),chg=p.chg;
    const upnl=pos&&p.px!=null?unreal(pos,p.px):null;
    const tag=pos?`<b class="${pos.side>0?'up':'dn'}">${pos.side>0?'LONG':'SHORT'}</b>`:`<span class="sg">${({long:'sinal LONG',short:'sinal SHORT',flat:'sem sinal',wait:'a recolher velas'})[s.dir]||'—'}</span>`;
    return `<div class="mkc"><div class="mkh"><b>${m.label}</b><small>${p.sym||m.note}</small></div>
      <div class="mkp">${fmtPx(m,p.px)}</div>
      <div class="mkr"><span class="${chg>0?'up':chg<0?'dn':''}">${chg!=null?(chg>0?'+':'')+chg.toFixed(2)+'% 24h':'—'}</span>${tag}</div>
      <div class="mkr"><small>${p.err?'⚠ '+p.err:(s.why||'')+(p.src==='ticks'?' · velas locais de 1 min':'')}</small>${upnl!=null?`<span class="${upnl>=0?'up':'dn'}">${upnl>=0?'+':''}${usd(upnl)}</span>`:''}</div></div>`}).join('');
  const rows=MK.filter(m=>S.pos[m.key]).map(m=>{const p=S.pos[m.key],px=P[m.key].px,u=px!=null?unreal(p,px):0;
    return `<tr><td>${m.label}</td><td>${p.side>0?'LONG':'SHORT'}</td><td>${fmtPx(m,p.entry)}</td><td>${fmtPx(m,px)}</td><td>${fmtPx(m,p.stop)}</td><td>${p.tp==null?'móvel':fmtPx(m,p.tp)}</td><td class="${u>=0?'up':'dn'}">${u>=0?'+':''}${usd(u)}</td><td><button class="ghost" data-k="${m.key}" aria-label="Fechar ${m.label}">✕</button></td></tr>`}).join('');
  body.innerHTML=`${S.halt?`<div class="halt">⛔ <b>PARADO</b> · ${S.halt.msg}. Nenhuma entrada nova. <button class="ghost" id="mkResume">RETOMAR</button></div>`:''}<div class="mkg">${cards}</div>
    <div class="mkacc"><span>Saldo <b>${usd(eq)}</b> <span class="${pnl>=0?'up':'dn'}">(${pnl>=0?'+':''}${(pnl/CFG.start*100).toFixed(2)}%)</span></span><span>${S.wins}W ${S.closed-S.wins}L</span><button class="ghost" id="mkReset">REINICIAR</button></div>
    ${rows?`<table><thead><tr><th>Ativo</th><th></th><th>Entrada</th><th>Preço</th><th>SL</th><th>TP</th><th>P/L</th><th></th></tr></thead><tbody id="mkRows">${rows}</tbody></table>`:`<div class="note">Sem posições abertas. Estratégia: <b>${DSTRAT.PRESETS[CFG.strategy].label}</b> em velas de ${CFG.res}.</div>`}
    <div class="note">Paper trading: conta fictícia de ${usd(CFG.start)}, risco de 1% por trade, estratégia ${DSTRAT.PRESETS[CFG.strategy].label} (velas de ${CFG.res}), stop ${CFG.stopATR}×ATR, ${CFG.tpATR>0?`alvo ${CFG.tpATR}×ATR`:`sem alvo, stop móvel a ${CFG.trailATR}×ATR`}, taxa ${CFG.costBps} bps (alvo: ordem limitada ${CFG.makerBps} bps) mais slippage de ${CFG.slipBps} bps (stops ${CFG.slipStopBps} bps), sem alavancagem acima de ${CFG.maxLev}×; só entra se o custo de ida e volta for no máximo ${Math.round(CFG.maxCostR*100)}% do risco. Sinais só em velas fechadas. Proteção: se a conta perder ${Math.round(CFG.ddStop*100)}% desde o máximo, fecha tudo e pára; perde ${Math.round(CFG.dayLoss*100)}% num dia, pausa até amanhã (retomar é manual). ${CFG.flatEOD?'<b>MODO DAY TRADE:</b> fecha tudo à última vela do dia UTC e não abre nas últimas '+CFG.noEntryHours+' h. ':''}${CHOICE.strategy==='swing'?'<b>MODO SWING:</b> posições de dias a semanas, stop móvel a '+CFG.trailATR+'×ATR, sem alvo fixo. ':''}${SCALP?'<b>MODO SCALPING (só papel):</b> velas de '+CFG.res+', stop '+CFG.stopATR+'×ATR, alvo '+CFG.tpATR+'×ATR, no máximo '+CFG.maxHoldBars+' velas. O worker não executa scalping em real. ':''}${FEED==='hl'?'Preços e velas da Hyperliquid (xyz:GOLD, xyz:SP500, xyz:EUR): os mesmos mercados onde o worker executa.':'ATENÇÃO: feed do Lighter com proxies (PAXG e SPY), diferente do mercado onde o worker executa.'} O estado fica guardado no telemóvel.</div>`;
}
function record(){guard();const e=equity();S.hist.push(e);if(S.hist.length>500)S.hist.shift();save()}
const MODES=[['breakout','15m','Padrão · rompimento · 15 min'],['daytrade','1h','Day trade · 1 h (fecha no fim do dia)'],['daytrade','4h','Day trade · 4 h (fecha no fim do dia)'],['swing','1d','Swing trade · diário (dias a semanas)'],['swing','4h','Swing trade · 4 h'],['scalp','5m','Scalping · 5 min (só papel)'],['scalp','1m','Scalping · 1 min (só papel)']];
function bindMode(){
  const body=$m('mkBody');if(!body||$m('mkMode'))return;
  const cur=CHOICE.strategy+'|'+CHOICE.iv,list=MODES.some(x=>x[0]+'|'+x[1]===cur)?MODES:[...MODES,[CHOICE.strategy,CHOICE.iv,`${DSTRAT.PRESETS[CHOICE.strategy].label} · ${CHOICE.iv}`]];
  const bar=document.createElement('div');bar.className='pmbar';
  bar.innerHTML=`<select id="mkMode" aria-label="Modo do Macro Desk">${list.map(x=>`<option value="${x[0]}|${x[1]}" ${x[0]+'|'+x[1]===cur?'selected':''}>${x[2]}</option>`).join('')}</select>`;
  body.parentNode.insertBefore(bar,body);
  bar.addEventListener('change',e=>{
    const [st,iv]=e.target.value.split('|');
    const extra=DSTRAT.isScalp(st,iv)?' Com as taxas atuais quase nunca passa o filtro de custo (só papel).':st==='daytrade'?' Fecha todas as posições à última vela do dia UTC e não abre nas últimas 2 h.':st==='swing'?' Posições de dias a semanas, com stop móvel.':'';
    if(!confirm(`Mudar o Macro Desk para ${DSTRAT.PRESETS[st].label} em velas de ${iv}?${extra} A página recarrega.`)){e.target.value=cur;return}
    if(setStrategy(st,iv))location.reload();
  });
}
function bind(){
  bindMode();
  $m('mkBody').addEventListener('click',e=>{
    if(e.target.id==='mkResume'){resume();render();return}
    if(e.target.id==='mkReset'){if(!confirm('Reiniciar a conta do Macro Desk?'))return;S=fresh();save();render();return}
    const k=e.target.dataset&&e.target.dataset.k;if(k){const m=MK.find(x=>x.key===k);close(m,'manual');render()}
  });
}

async function start(){
  if(!$m('mkBody'))return;bind();render();
  if(DEMO){demoInit();setInterval(()=>{MK.forEach(demoStep);record();render()},CFG.candlePoll);render();return}
  if(FEED==='hl'){
    const loop=async()=>{await pollHLPrices();render()};
    const cloop=async()=>{for(const m of MK){await pollHLCandles(m);await sleep(250)}record();render()};
    await loop();await cloop();setInterval(loop,CFG.pricePoll);setInterval(cloop,CFG.candlePoll);return;
  }
  try{await discover()}catch(e){MK.forEach(m=>P[m.key].err=e.message);L('l','mercados: '+e.message)}
  const loop=async()=>{await Promise.all(MK.map(pollPrice));render()};
  const cloop=async()=>{await Promise.all(MK.map(pollCandles));record();render()};
  await loop();cloop();setInterval(loop,CFG.pricePoll);setInterval(cloop,CFG.candlePoll);
  setInterval(()=>MK.forEach(m=>{const p=P[m.key];if(p.src==='ticks'&&p.newBar){p.newBar=false;onBar(m)}}),5000);
}

window.MACRO={guard,resume,setStrategy,CHOICE,BASE,CFG,SCALP,MK,P,onBar:k=>onBar(MK.find(m=>m.key===k)),afterCandles:k=>afterCandles(MK.find(m=>m.key===k)),closedBars:k=>closedBars(P[k]),pollHLPrices,pollHLCandles:k=>pollHLCandles(MK.find(m=>m.key===k)),feed:()=>FEED,exitCost,ema,atr,signal,sizeFor,parseMarkets,pickMarket,parseDetail,parseCandles,state:()=>S,reset:()=>{S=fresh()},equity,unreal,open:(k,d,s)=>open(MK.find(m=>m.key===k),d,s),close:k=>close(MK.find(m=>m.key===k),'teste'),setPrice:(k,px)=>{P[k].px=px},checkExits:k=>checkExits(MK.find(m=>m.key===k))};
start();
})();
