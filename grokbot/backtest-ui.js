/* DOLLOS · painel do TESTE HISTÓRICO: vai buscar velas reais da Hyperliquid (pelo worker) e corre as regras do Macro Desk sobre elas. */
(()=>{
const DEMO=new URLSearchParams(location.search).has('demo');
const $b=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const usd=v=>(v>0?'+$':v<0?'-$':'$')+Math.abs(v).toFixed(2);
const pct=v=>v==null||!isFinite(v)?'—':(v>=0?'+':'')+(v*100).toFixed(1)+'%';
const dt=t=>new Date(t).toISOString().slice(0,10);
const IV={'15m':{label:'15 min · cerca de 50 dias',note:'as mesmas velas do Macro Desk'},'1h':{label:'1 hora · cerca de 7 meses',note:'teste de robustez: a estratégia foi feita para 15 min'},'4h':{label:'4 horas · até cerca de 2 anos',note:'robustez com velas maiores (o custo pesa menos); o período real pode ser mais curto se o mercado for mais recente'}};
let state={busy:false,msg:'',err:'',res:null,iv:'15m',coins:null};
const api=()=>typeof HOLDERS_API==='string'?HOLDERS_API:'';
const token=()=>window.LIVE&&LIVE.L.token||'';

const HL='https://api.hyperliquid.xyz/info',MS={'15m':9e5,'1h':36e5,'4h':144e5};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const DEFAULT_COINS={GOLD:'xyz:GOLD',SPX:'xyz:SP500',EURUSD:'xyz:EUR'};   // nomes que o painel HYPERLIQUID já mostrou; se o painel os tiver, usa esses
function knownCoins(){
  try{const m=LIVE.P.hl.st&&LIVE.P.hl.st.markets;if(m){const o={};for(const k of Object.keys(DEFAULT_COINS))o[k]=m[k]&&m[k].coin||DEFAULT_COINS[k];return o}}catch(e){}
  return DEFAULT_COINS;
}
/* 1.º caminho: o próprio telemóvel pede à Hyperliquid (o endereço do worker é partilhado e a Hyperliquid limita pedidos por endereço). Repete se vier 429. */
async function fetchDirect(iv){
  const coins=knownCoins(),end=Date.now(),start=Math.floor(end-5000*MS[iv]*.999),markets={};
  for(const [k,coin] of Object.entries(coins)){
    let arr=null,last='';
    for(let a=0;a<4&&!arr;a++){
      try{
        const r=await fetch(HL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'candleSnapshot',req:{coin,interval:iv,startTime:start,endTime:end}})});
        if(r.status===429){last='429';await sleep(1500*(a+1));continue}
        if(!r.ok)throw new Error('HTTP '+r.status);
        arr=await r.json();
      }catch(e){last=e.message;if(a<3)await sleep(800)}
    }
    if(!Array.isArray(arr))throw new Error(`${coin}: ${last||'sem resposta'}`);
    markets[k]={coin,bars:arr.map(x=>[x.t,+x.o,+x.h,+x.l,+x.c,+x.v])};
    await sleep(250);
  }
  return{interval:iv,markets};
}
/* 2.º caminho (plano B): pelo worker */
async function fetchViaWorker(iv){
  const f=window.CapacitorWebFetch||fetch;
  const r=await f(api()+'/hl/candles',{method:'POST',headers:{'x-token':token(),'content-type':'application/json'},body:JSON.stringify({interval:iv,days:iv==='15m'?52:iv==='1h'?210:840})});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j;
}
async function fetchCandles(iv){
  try{state.msg='a descarregar velas da Hyperliquid (direto do telemóvel)…';render();return await fetchDirect(iv)}
  catch(e){
    if(!token())throw new Error('Pedido direto falhou ('+e.message+') e falta o token do worker para tentar o plano B.');
    state.msg='o pedido direto falhou ('+e.message+'); a tentar pelo worker…';render();
    try{return await fetchViaWorker(iv)}catch(e2){throw new Error('direto: '+e.message+' · worker: '+e2.message)}
  }
}
function toBars(j){
  const out={},coins={};
  for(const [k,m] of Object.entries(j.markets||{})){if(!m||!m.bars||!m.bars.length)continue;coins[k]=m.coin;out[k]=m.bars.map(a=>({t:a[0],o:a[1],h:a[2],l:a[3],c:a[4]})).sort((x,y)=>x.t-y.t)}
  return{bars:out,coins};
}
async function run(){
  if(state.busy)return;
  state={...state,busy:true,msg:'a preparar…',err:'',res:null};render();
  try{
    const j=await fetchCandles(state.iv),{bars,coins}=toBars(j);
    const ks=Object.keys(bars);if(!ks.length)throw new Error('a Hyperliquid não devolveu velas para ouro, S&P ou EUR/USD');
    state.msg='a simular…';render();await new Promise(r=>setTimeout(r,30));
    const all=BT.runAll(bars,MACRO.CFG);
    state.res={all,coins,iv:state.iv,missing:['GOLD','SPX','EURUSD'].filter(k=>!bars[k])};state.err='';
  }catch(e){state.err=e.message}
  state.busy=false;state.msg='';render();
}

function verdict(s){
  const v=[];
  if(s.n<30)v.push(`Poucas trades (${s.n}): qualquer conclusão é fraca.`);
  if(s.net<=0)v.push(`Com as regras atuais teria <b>perdido ${(Math.abs(s.netPct)*100).toFixed(1)}%</b> neste período.`);
  else v.push(`Com as regras atuais teria <b>ganho ${(s.netPct*100).toFixed(1)}%</b> neste período, já com custos.`);
  if(s.avgGrossR!=null){
    if(s.avgGrossR<=0)v.push(`A regra perde <b>mesmo antes de custos</b> (${s.avgGrossR.toFixed(2)} R por trade): o problema é a regra, não os custos.`);
    else if(s.avgR<=0)v.push(`Antes de custos a regra ganharia ${s.avgGrossR.toFixed(2)} R por trade, mas os custos (${s.costR.toFixed(2)} R) comem tudo: velas maiores ou menos trades podem ajudar.`);
    else v.push(`Ganha ${s.avgR.toFixed(2)} R por trade já com custos (${s.avgGrossR.toFixed(2)} R antes).`);
  }
  if(s.pf!=null&&s.pf!==Infinity&&s.pf<1.2)v.push(`Fator de lucro ${s.pf.toFixed(2)}: margem pequena; basta um pouco de azar ou de escorregamento para virar prejuízo.`);
  if(s.firstHalt)v.push(`A proteção de -20% disparou a ${dt(s.firstHalt.t)}, com a conta em $${s.firstHalt.equity.toFixed(0)}. Este teste retoma sozinho no dia seguinte; na prática ficarias parado até tocares em RETOMAR, por isso a perda real não passaria muito de ${pct(s.firstHalt.equity/MACRO.CFG.start-1)}.`);
  if(s.maxDD>0.15)v.push(`A pior queda foi de ${(s.maxDD*100).toFixed(1)}%: perto do limite de paragem de 20%.`);
  v.push('Uma janela curta e um só regime de mercado. Sem funding nem escorregamento. Resultado passado não garante o futuro.');
  return v;
}
function spark(arr){
  if(!arr||arr.length<2)return'';
  const mn=Math.min(...arr),mx=Math.max(...arr),w=300,h=54,pts=arr.map((v,i)=>`${(i/(arr.length-1)*w).toFixed(1)},${(h-(v-mn)/((mx-mn)||1)*(h-6)-3).toFixed(1)}`).join(' ');
  return`<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" role="img" aria-label="curva da conta"><polyline points="${pts}" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`;
}
const row=(a,b)=>`<div class="rr"><span>${a}</span><b>${b}</b></div>`;
const tbl=(o,fmt)=>{const r=Object.entries(o).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v.n}</td><td>${v.n?Math.round(v.wins/v.n*100):0}%</td><td class="${v.pnl>=0?'up':'dn'}">${usd(v.pnl)}</td></tr>`).join('');return r?`<table><thead><tr><th>${fmt}</th><th>trades</th><th>acerto</th><th>P/L</th></tr></thead><tbody>${r}</tbody></table>`:''};

function resHtml(){
  const R=state.res;if(!R)return'';
  const s=R.all.main.s,names={GOLD:'Ouro',SPX:'S&P 500',EURUSD:'EUR/USD'};
  const bh=Object.entries(s.bh).map(([k,v])=>`${names[k]||k} ${pct(v)}`).join(' · ');
  const vars=R.all.variants.map(x=>`<tr><td>${esc(x.label)}</td><td>${x.s.n}</td><td class="${x.s.net>=0?'up':'dn'}">${pct(x.s.netPct)}</td><td>${x.s.pf==null?'—':x.s.pf===Infinity?'∞':x.s.pf.toFixed(2)}</td><td>${(x.s.maxDD*100).toFixed(1)}%</td></tr>`).join('');
  return`<div class="rs"><h4>RESULTADO<small>${({'15m':'velas de 15 min','1h':'velas de 1 h','4h':'velas de 4 h'})[R.iv]} · ${s.days.toFixed(0)} dias</small></h4>
    ${row('Período',`${dt(s.from)} → ${dt(s.to)}`)}
    ${row('Trades',`${s.n} · ${s.wins}W ${s.losses}L`)}
    ${row('Taxa de acerto',s.winRate==null?'—':(s.winRate*100).toFixed(0)+'%')}
    ${row('Resultado (conta de $10 000)',`<span class="${s.net>=0?'up':'dn'}">${usd(s.net)} (${pct(s.netPct)})</span>`)}
    ${row('Fator de lucro',s.pf==null?'—':s.pf===Infinity?'∞':s.pf.toFixed(2))}
    ${row('Média por trade em R',s.avgR==null?'—':`${s.avgR.toFixed(2)} R <small>(antes de custos ${s.avgGrossR.toFixed(2)} R · custos ${s.costR.toFixed(2)} R)</small>`)}
    ${row('Acerto para empatar',`~${Math.round(s.breakEvenWin*100)}% (antes de custos)`)}
    ${row('Ganho / perda média',s.n?`${s.avgWin==null?'—':usd(s.avgWin)} / ${s.avgLoss==null?'—':usd(s.avgLoss)}`:'—')}
    ${row('Pior queda',(s.maxDD*100).toFixed(1)+'%')}
    ${row('Paragens de proteção',`${s.halts.dd} de -20% · ${s.halts.day} diárias`)}
    ${s.firstHalt?row('1.ª paragem de -20%',`${dt(s.firstHalt.t)} · conta $${s.firstHalt.equity.toFixed(0)} (${pct(s.firstHalt.equity/MACRO.CFG.start-1)})`):''}
    ${row('Comprar e manter',bh||'—')}
    <div style="margin-top:6px">${spark(s.sparkline)}</div>
    <div class="sub">POR MERCADO</div>${tbl(s.byMarket,'mercado')}
    <div class="sub">POR SAÍDA</div>${tbl(s.byReason,'saída')}
    <div class="sub">POR MÊS</div>${tbl(s.byMonth,'mês')}
    <div class="sub">E SE OS CUSTOS OU A ALAVANCAGEM FOSSEM OUTROS?</div>
    <table><thead><tr><th></th><th>trades</th><th>result.</th><th>f. lucro</th><th>queda</th></tr></thead><tbody>${vars}</tbody></table>
    <div class="sub">VEREDICTO</div><div class="note">${verdict(s).join('<br>')}</div>
    ${R.missing.length?`<div class="note">Sem dados para: ${R.missing.map(k=>names[k]).join(', ')}.</div>`:''}
    <div class="note">Mercados usados: ${esc(Object.entries(R.coins).map(([k,c])=>names[k]+' = '+c).join(' · '))}</div></div>`;
}
function render(){
  const el=$b('btBody');if(!el)return;
  if(DEMO||!api()){el.innerHTML='<div class="note">Indisponível no modo demo ou sem o endereço do worker.</div>';return}
  const sel=Object.entries(IV).map(([k,v])=>`<option value="${k}" ${state.iv===k?'selected':''}>${v.label}</option>`).join('');
  el.innerHTML=`<div class="note">Corre as <b>mesmas regras do Macro Desk</b> (mesmo risco, alavancagem, custos de 9 bps e paragens de -20% e -5%) sobre velas reais passadas de ouro, S&amp;P 500 e EUR/USD da Hyperliquid. Não envia ordens nem gasta nada. A Hyperliquid só guarda as últimas 5000 velas por mercado.</div>
    ${token()?'':`<div class="pmbar"><input id="btTok" type="password" autocomplete="off" placeholder="token do worker (APP_TOKEN)"></div>`}
    <div class="pmbar"><select id="btIv">${sel}</select><button class="ghost" id="btRun" ${state.busy?'disabled':''}>${state.busy?'A CORRER…':'CORRER TESTE'}</button></div>
    <div class="note">${esc(IV[state.iv].note)}</div>
    ${state.msg?`<div class="note">${esc(state.msg)}</div>`:''}${state.err?`<div class="halt">⚠ ${esc(state.err)}</div>`:''}${resHtml()}`;
  const info=$b('btInfo');if(info)info.textContent=state.res?`${state.res.all.main.s.n} TRADES`:'';
}
function bind(){
  const el=$b('btBody');if(!el)return;
  el.addEventListener('click',e=>{if(e.target.id==='btRun'){const t=$b('btTok');if(t&&t.value.trim()&&window.LIVE)LIVE.setToken(t.value.trim());run()}});
  el.addEventListener('change',e=>{if(e.target.id==='btIv'){state.iv=e.target.value;render()}});
  render();
}
window.BTUI={run,state:()=>state};
if($b('btBody'))bind();
})();
