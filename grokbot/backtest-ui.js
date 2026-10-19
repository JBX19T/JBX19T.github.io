/* DOLLOS · painel do TESTE HISTÓRICO: vai buscar velas reais da Hyperliquid (pelo worker) e corre as regras do Macro Desk sobre elas. */
(()=>{
const DEMO=new URLSearchParams(location.search).has('demo');
const $b=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const usd=v=>(v>0?'+$':v<0?'-$':'$')+Math.abs(v).toFixed(2);
const pct=v=>v==null||!isFinite(v)?'—':(v>=0?'+':'')+(v*100).toFixed(1)+'%';
const dt=t=>new Date(t).toISOString().slice(0,10);
const IV={'1d':{label:'1 dia · ~300 dias na Hyperliquid, ~6 anos no histórico longo (swing)',note:'SWING: velas diárias; poucas trades por ano, por isso o histórico longo (Binance, desde 2020) é o que dá amostra'},'1m':{label:'1 min · cerca de 3 dias (scalping)',note:'SCALPING: a Hyperliquid só guarda 5000 velas (3 dias de 1 min); com «Histórico longo» a Binance dá ~20 dias. Quase sempre sem trades: o custo de ida e volta vale muitos R com stops tão curtos'},'5m':{label:'5 min · cerca de 17 dias (scalping)',note:'SCALPING: a Hyperliquid só guarda 5000 velas (17 dias de 5 min); com «Histórico longo» a Binance dá ~100 dias. Compara só o scalping, com ordens a mercado e limitadas'},'15m':{label:'15 min · cerca de 50 dias',note:'as mesmas velas do Macro Desk'},'1h':{label:'1 hora · cerca de 7 meses',note:'teste de robustez: a estratégia foi feita para 15 min'},'4h':{label:'4 horas · até cerca de 2 anos',note:'robustez com velas maiores (o custo pesa menos); o período real pode ser mais curto se o mercado for mais recente'}};
let state={busy:false,msg:'',err:'',res:null,iv:'15m',coins:null,src:'hl',mode:'all'};
/* origem das velas: os mercados reais da Hyperliquid (curtos: só existem há ~300 dias) ou um histórico longo desde 2020
   na Binance (ouro através do PAXG, EUR/USD através do EURUSDT; sem S&P 500), que dá centenas de trades para confirmar */
const SRC={hl:{label:'Hyperliquid (mercados reais, ~300 dias)'},long:{label:'Histórico longo desde 2020 (Binance: ouro e EUR/USD)'}};
const api=()=>typeof HOLDERS_API==='string'?HOLDERS_API:'';
const token=()=>window.LIVE&&LIVE.L.token||'';

const HL='https://api.hyperliquid.xyz/info',MS={'1m':6e4,'5m':3e5,'15m':9e5,'1h':36e5,'4h':144e5,'1d':864e5};
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
  const r=await f(api()+'/hl/candles',{method:'POST',headers:{'x-token':token(),'content-type':'application/json'},body:JSON.stringify({interval:iv,days:iv==='1d'?300:iv==='1m'?3.4:iv==='5m'?17:iv==='15m'?52:iv==='1h'?210:840})});
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
/* histórico longo: velas públicas da Binance (1000 por pedido), desde 2020; no máximo 30 000 velas por mercado */
const BINANCE=['https://data-api.binance.vision','https://api.binance.com'];
const LONG_COINS={GOLD:'PAXGUSDT',EURUSD:'EURUSDT'},LONG_FROM=Date.UTC(2020,0,1),LONG_MAX=30000;
async function fetchBinance(iv){
  const markets={},end=Date.now();
  for(const [k,sym] of Object.entries(LONG_COINS)){
    const rows=[];let t=Math.max(LONG_FROM,end-LONG_MAX*MS[iv]),host=0,fails=0;
    while(t<end&&rows.length<LONG_MAX){
      let arr=null;
      try{const r=await fetch(`${BINANCE[host]}/api/v3/klines?symbol=${sym}&interval=${iv}&startTime=${t}&limit=1000`);
        if(r.status===429||r.status===418){await sleep(2000);continue}
        if(!r.ok)throw new Error('HTTP '+r.status);arr=await r.json()}
      catch(e){if(++fails>4)throw new Error(`${sym}: ${e.message}`);host=(host+1)%BINANCE.length;await sleep(700);continue}
      if(!Array.isArray(arr)||!arr.length)break;
      for(const x of arr)if(x[0]+MS[iv]<=end)rows.push([x[0],+x[1],+x[2],+x[3],+x[4],+x[5]]);
      t=arr[arr.length-1][0]+MS[iv];
      state.msg=`a descarregar histórico longo da Binance: ${sym} ${rows.length} velas…`;render();
      if(arr.length<1000)break;
      await sleep(120);
    }
    if(rows.length)markets[k]={coin:sym+' (Binance)',bars:rows};
  }
  if(!Object.keys(markets).length)throw new Error('a Binance não devolveu velas');
  return{interval:iv,markets};
}
/* funding real de cada hora (fundingHistory devolve 500 horas por pedido): no máximo 4 pedidos por mercado, os mais recentes;
   nas horas sem dado o teste usa a média das horas conhecidas */
async function fetchFunding(coins,from,to){
  const out={},cover={};
  for(const [k,coin] of Object.entries(coins)){
    const pts=[];let t=Math.max(from,to-4*500*36e5);
    for(let page=0;page<4&&t<to;page++){
      let arr=null;
      for(let a=0;a<3&&!arr;a++){
        try{const r=await fetch(HL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'fundingHistory',coin,startTime:Math.floor(t),endTime:to})});
          if(r.status===429){await sleep(1500*(a+1));continue}if(!r.ok)throw new Error('HTTP '+r.status);arr=await r.json()}catch(e){if(a<2)await sleep(600)}
      }
      if(!Array.isArray(arr)||!arr.length)break;
      for(const x of arr)pts.push([x.time,+x.fundingRate]);
      t=arr[arr.length-1].time+1;await sleep(250);
      if(arr.length<500)break;
    }
    if(pts.length){out[k]=pts;cover[k]=Math.min(1,pts.length/((to-from)/36e5))}
  }
  return{funding:out,cover};
}
/* aprovação para dinheiro real: guardada no telemóvel e enviada ao worker (para o piloto automático) */
const APPROVAL_KEY='dollosApprovalV2';
function approvals(){try{return JSON.parse(localStorage.getItem(APPROVAL_KEY)||'{}')||{}}catch(e){return{}}}
function approve(best,iv){
  const B=best.B,a={strategy:best.strategy,iv,at:Date.now(),n:B.n,avgR:B.avgR,pf:B.pf,tR:B.tR,exec:best.exec};
  const all=approvals();all[best.strategy+'|'+iv]=a;try{localStorage.setItem(APPROVAL_KEY,JSON.stringify(all))}catch(e){}
  if(token()&&api()){const f=window.CapacitorWebFetch||fetch;f(api()+'/hl/approve',{method:'POST',headers:{'x-token':token(),'content-type':'application/json'},body:JSON.stringify(a)}).catch(()=>{})}
}
function toBars(j){
  const out={},coins={},ms=MS[j.interval||state.iv]||0,now=Date.now();
  for(const [k,m] of Object.entries(j.markets||{})){if(!m||!m.bars||!m.bars.length)continue;coins[k]=m.coin;out[k]=m.bars.map(a=>({t:a[0],o:a[1],h:a[2],l:a[3],c:a[4]})).filter(b=>b.t+ms<=now).sort((x,y)=>x.t-y.t)}   // só velas fechadas
  return{bars:out,coins};
}
async function run(){
  if(state.busy)return;
  state={...state,busy:true,msg:'a preparar…',err:'',res:null,csv:''};render();
  try{
    const long=state.src==='long'&&state.iv!=='15m';
    const j=long?await fetchBinance(state.iv):await fetchCandles(state.iv),{bars,coins}=toBars(j);
    const ks=Object.keys(bars);if(!ks.length)throw new Error('não vieram velas para ouro, S&P ou EUR/USD');
    const from=Math.min(...ks.map(k=>bars[k][0].t)),to=Math.max(...ks.map(k=>bars[k][bars[k].length-1].t));
    let fund={funding:{},cover:{}};
    if(!long)try{state.msg='a descarregar o histórico de funding…';render();fund=await fetchFunding(Object.fromEntries(ks.map(k=>[k,coins[k]])),from,to)}catch(e){}
    const nS=Object.keys(DSTRAT.PRESETS).length;
    state.msg=`a simular ${nS} estratégias × 2 tipos de ordem${long?' sobre anos de velas (pode demorar uns segundos)':''}…`;render();await new Promise(r=>setTimeout(r,30));
    const MD=DSTRAT.MODES[state.mode]||DSTRAT.MODES.all,fam=MD.only?MD.only[0]:null;   // modos (scalping, day trade, swing): só a sua família, com os parâmetros próprios
    const all=BT.runAll(bars,fam?DSTRAT.withStrategy(MACRO.BASE,fam):MACRO.CFG,{funding:fund.funding,base:MACRO.BASE,only:MD.only||null});
    state.res={all,coins,iv:state.iv,long,cover:fund.cover,missing:(long?['GOLD','EURUSD']:['GOLD','SPX','EURUSD']).filter(k=>!bars[k])};state.err='';
    const X=all.research;if(X.pass)approve(X.best,state.iv);
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
  v.push(`${state.res&&state.res.long?'Vários anos e regimes de mercado, mas em proxies (PAXG e EURUSDT).':'Uma janela curta e um só regime de mercado.'} ${state.res&&state.res.long?'Dados spot da Binance: sem funding.':state.res&&Object.keys(state.res.cover||{}).length?'Inclui funding.':'Sem funding (não foi possível descarregá-lo).'} Sem escorregamento além do custo fixo. Resultado passado não garante o futuro.`);
  return v;
}
function spark(arr){
  if(!arr||arr.length<2)return'';
  const mn=Math.min(...arr),mx=Math.max(...arr),w=300,h=54,pts=arr.map((v,i)=>`${(i/(arr.length-1)*w).toFixed(1)},${(h-(v-mn)/((mx-mn)||1)*(h-6)-3).toFixed(1)}`).join(' ');
  return`<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" role="img" aria-label="curva da conta"><polyline points="${pts}" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`;
}
const row=(a,b)=>`<div class="rr"><span>${a}</span><b>${b}</b></div>`;
const tbl=(o,fmt)=>{const r=Object.entries(o).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v.n}</td><td>${v.n?Math.round(v.wins/v.n*100):0}%</td><td class="${v.pnl>=0?'up':'dn'}">${usd(v.pnl)}</td></tr>`).join('');return r?`<table><thead><tr><th>${fmt}</th><th>trades</th><th>acerto</th><th>P/L</th></tr></thead><tbody>${r}</tbody></table>`:''};

const P_=k=>DSTRAT.PRESETS[k]||DSTRAT.PRESETS.breakout;
const r2=v=>v==null?'—':(v>=0?'+':'')+v.toFixed(2);
const pf2=v=>v==null?'—':v===Infinity?'∞':v.toFixed(2);
function researchHtml(R){
  const X=R.all.research;if(!X||!X.rows.length)return'';
  const best=X.best,cur=MACRO.CHOICE||{strategy:'breakout',iv:'15m'};
  const rows=X.rows.map(r=>`<tr${r===best?' style="font-weight:700"':''}><td>${r===best?'★ ':''}${esc(P_(r.strategy).short)}<br><small>${r.exec==='maker'?'limitadas':'a mercado'}</small></td><td>${r.A.n}</td><td class="${(r.A.avgR||0)>0?'up':'dn'}">${r2(r.A.avgR)}</td><td>${pf2(r.A.pf)}</td><td>${r.B.n}</td><td class="${(r.B.avgR||0)>0?'up':'dn'}">${r2(r.B.avgR)}</td><td>${pf2(r.B.pf)}</td></tr>`).join('');
  let v='';
  if(!best)v=`Nenhuma combinação teve ${X.minA}+ trades na 1.ª parte: não há base para escolher.`;
  else if(X.pass)v=`★ <b>${esc(best.label)}</b> foi a melhor na 1.ª parte e <b>continuou a ganhar na 2.ª</b>, que a escolha não viu: ${r2(best.B.avgR)} R por trade, fator de lucro ${pf2(best.B.pf)} em ${best.B.n} trades (t = ${best.B.tR==null?"—":best.B.tR.toFixed(1)}). Fica <b>aprovada durante ${DSTRAT.APPROVAL_DAYS} dias</b> para estas velas: só depois de a pores no desk e de semanas em papel faz sentido ligar dinheiro real.${best.exec==='maker'?' Atenção: o resultado conta com ordens limitadas; o desk em papel entra a mercado, por isso ao vivo deverá ser um pouco pior.':''}`;
  else{
    const why=[];const B=best.B;
    if(!(best.A.avgR>0))why.push('nem na 1.ª parte ganhou');
    if(B.n<X.minB)why.push(`só ${B.n} trades na 2.ª parte (mínimo ${X.minB})`);
    if(!(B.avgR>0)||!(B.pf>1.1))why.push('na 2.ª parte perdeu ou quase empatou');
    else if(!(B.tR>=X.minT))why.push(`o ganho na 2.ª parte é pequeno demais para excluir a sorte (t = ${B.tR==null?'—':B.tR.toFixed(1)}; precisa de ${X.minT})`);
    v=`★ <b>${esc(best.label)}</b> foi a melhor na 1.ª parte (${r2(best.A.avgR)} R por trade); na 2.ª parte, que não viu, ficou em ${r2(B.avgR)} R com fator de lucro ${pf2(B.pf)} em ${B.n} trades. Não passou: ${why.join('; ')}. <b>Nenhuma estratégia tem vantagem comprovada</b> nestes mercados com estas velas: não operes com dinheiro real.`;
  }
  const can=X.pass&&!(cur.strategy===best.strategy&&cur.iv===R.iv);
  const back=cur.strategy!=='breakout'||cur.iv!=='15m';
  return`<div class="sub">QUE ESTRATÉGIA GANHA? (TESTE EM DUAS PARTES)</div>
    <div class="note">1.ª parte: até ${dt(X.split)} (60% do período), serve para escolher. 2.ª parte: depois disso, serve para confirmar. R = resultado por trade em múltiplos do risco (1 R = 1% da conta), já com taxas e funding. Para passar, a 2.ª parte precisa de ${X.minB}+ trades, fator de lucro acima de 1,1 e um ganho médio grande o suficiente para não ser sorte.</div>
    <table><thead><tr><th></th><th colspan="3">1.ª parte</th><th colspan="3">2.ª parte</th></tr><tr><th>estratégia</th><th>trades</th><th>R</th><th>f.l.</th><th>trades</th><th>R</th><th>f.l.</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="note">${v}</div>
    ${can?`<div class="pmbar"><button class="ghost" id="btApply" data-s="${best.strategy}" data-iv="${R.iv}">USAR NO MACRO DESK (PAPEL): ${esc(P_(best.strategy).short.toUpperCase())} · ${R.iv}</button></div>`:''}
    ${back?`<div class="pmbar"><button class="ghost" id="btApply" data-s="breakout" data-iv="15m">VOLTAR AO ROMPIMENTO · 15m</button></div>`:''}
    <div class="note">Desk em papel agora: ${esc(P_(cur.strategy).label)} em velas de ${cur.iv}.</div>`;
}
function exportTrades(){
  const R=state.res;if(!R||!window.RESULTS)return;
  const iso=t=>new Date(t).toISOString().replace('T',' ').slice(0,19);
  const rows=[['mercado','lado','aberta_utc','fechada_utc','entrada','saida','valor_usd','pnl_usd','taxas_usd','funding_usd','R','motivo']];
  for(const t of R.all.main.s._trades||[])rows.push([t.k,t.side>0?'long':'short',iso(t.o),iso(t.c),t.en.toFixed(5),t.ex.toFixed(5),t.nt.toFixed(2),t.pnl.toFixed(2),(t.fees||0).toFixed(2),(t.fund||0).toFixed(2),t.risk>0?(t.pnl/t.risk).toFixed(2):'',t.why]);
  RESULTS.exportCsv(`dollos-teste-${R.iv}-${new Date().toISOString().slice(0,10)}.csv`,rows).then(r=>{state.msg=`${rows.length-1} trades do teste: ${r.how}.`;state.csv=r.csv||'';render()});
}
function resHtml(){
  const R=state.res;if(!R)return'';
  const s=R.all.main.s,names={GOLD:'Ouro',SPX:'S&P 500',EURUSD:'EUR/USD'};
  const bh=Object.entries(s.bh).map(([k,v])=>`${names[k]||k} ${pct(v)}`).join(' · ');
  const vars=R.all.variants.map(x=>`<tr><td>${esc(x.label)}</td><td>${x.s.n}</td><td class="${x.s.net>=0?'up':'dn'}">${pct(x.s.netPct)}</td><td>${x.s.pf==null?'—':x.s.pf===Infinity?'∞':x.s.pf.toFixed(2)}</td><td>${(x.s.maxDD*100).toFixed(1)}%</td></tr>`).join('');
  const cov=Object.entries(R.cover||{}).map(([k,v])=>`${names[k]||k} ${Math.round(v*100)}%`).join(' · ');
  return`<div class="rs"><h4>RESULTADO · ${esc(P_(s.strategy).short.toUpperCase())}<small>${({'15m':'velas de 15 min','1h':'velas de 1 h','4h':'velas de 4 h','1m':'velas de 1 min','5m':'velas de 5 min','1d':'velas diárias'})[R.iv]} · ${s.days.toFixed(0)} dias${R.long?' · Binance':''}</small></h4>
    ${row('Período',`${dt(s.from)} → ${dt(s.to)}`)}
    ${row('Trades',`${s.n} · ${s.wins}W ${s.losses}L`)}
    ${row('Taxa de acerto',s.winRate==null?'—':(s.winRate*100).toFixed(0)+'%')}
    ${row('Resultado (conta de $10 000)',`<span class="${s.net>=0?'up':'dn'}">${usd(s.net)} (${pct(s.netPct)})</span>`)}
    ${row('Fator de lucro',s.pf==null?'—':s.pf===Infinity?'∞':s.pf.toFixed(2))}
    ${row('Média por trade em R',s.avgR==null?'—':`${s.avgR.toFixed(2)} R <small>(antes de custos ${s.avgGrossR.toFixed(2)} R · custos ${s.costR.toFixed(2)} R)</small>`)}
    ${row('Acerto para empatar',s.breakEvenWin==null?'— (sem alvo fixo: depende do tamanho dos ganhos)':`~${Math.round(s.breakEvenWin*100)}% (antes de custos)`)}
    ${row('Ganho / perda média',s.n?`${s.avgWin==null?'—':usd(s.avgWin)} / ${s.avgLoss==null?'—':usd(s.avgLoss)}`:'—')}
    ${row('Taxas / slippage / funding',`${usd(-s.feesUsd)} / ${usd(-(s.slipUsd||0))} / ${Object.keys(R.cover||{}).length?usd(-s.fundUsd):'não incluído'}`)}
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
    <div class="sub">VEREDICTO (ESTRATÉGIA EM USO)</div><div class="note">${verdict(s).join('<br>')}</div>
    ${researchHtml(R)}
    ${cov?`<div class="note">Funding real em ${cov} das horas; nas restantes usa a média das horas conhecidas.${(()=>{const miss=Object.keys(R.coins).filter(k=>!(k in (R.cover||{})));return miss.length?` A Hyperliquid não devolveu o histórico de funding de ${miss.map(k=>names[k]||k).join(', ')}: aí o funding conta como zero.`:''})()}</div>`:''}
    <div class="pmbar"><button class="ghost" id="btCsv">EXPORTAR TRADES DO TESTE (CSV)</button></div>
    ${state.csv?`<textarea readonly style="width:100%;height:90px;font-size:10px">${esc(state.csv)}</textarea>`:''}
    ${R.missing.length?`<div class="note">Sem dados para: ${R.missing.map(k=>names[k]).join(', ')}.</div>`:''}
    <div class="note">Mercados usados: ${esc(Object.entries(R.coins).map(([k,c])=>names[k]+' = '+c).join(' · '))}</div></div>`;
}
function render(){
  const el=$b('btBody');if(!el)return;
  if(DEMO||!api()){el.innerHTML='<div class="note">Indisponível no modo demo ou sem o endereço do worker.</div>';return}
  const MD=DSTRAT.MODES[state.mode]||DSTRAT.MODES.all;
  const modeSel=Object.entries(DSTRAT.MODES).map(([k,v])=>`<option value="${k}" ${state.mode===k?'selected':''}>${esc(v.label)}</option>`).join('');
  const sel=Object.entries(IV).filter(([k])=>MD.ivs.includes(k)).map(([k,v])=>`<option value="${k}" ${state.iv===k?'selected':''}>${v.label}</option>`).join('');
  el.innerHTML=`<div class="note">Corre as <b>mesmas regras do Macro Desk</b> (mesmo risco, alavancagem, custos de 9 bps e paragens de -20% e -5%) sobre velas reais passadas de ouro, S&amp;P 500 e EUR/USD da Hyperliquid, com o funding real. Depois compara ${Object.keys(DSTRAT.PRESETS).length} estratégias (${Object.values(DSTRAT.PRESETS).map(p=>p.short).join(', ')}) com ordens a mercado e limitadas, num teste em duas partes. Não envia ordens nem gasta nada. A Hyperliquid só guarda as últimas 5000 velas por mercado. Convenções: o sinal nasce ao fecho da vela e a ordem enche à abertura da seguinte, com taxa e slippage; o alvo é uma ordem limitada (taxa maker); o stop paga slippage; só entra se o custo de ida e volta for no máximo 15% do risco. O slippage (3 bps, stops 5 bps) é uma SUPOSIÇÃO até haver execuções reais medidas (ver «Execuções reais registadas» no painel da Hyperliquid).</div>
    ${token()?'':`<div class="pmbar"><input id="btTok" type="password" autocomplete="off" placeholder="token do worker (APP_TOKEN)"></div>`}
    <div class="pmbar"><select id="btMode" aria-label="Modo">${modeSel}</select></div>
    ${state.mode==='day'?'<div class="note"><b>Day trade:</b> o rompimento original, mas fecha tudo à última vela do dia UTC e não abre nas últimas 2 h. Nunca dorme com posição.</div>':state.mode==='swing'?'<div class="note"><b>Swing trade:</b> rompimento de 20 velas a favor da tendência, sem alvo fixo, stop móvel a 3×ATR, posições de dias a semanas. Em velas diárias há poucas trades: usa o «Histórico longo».</div>':state.mode==='scalp'?'<div class="note"><b>Scalping:</b> só papel e teste. O worker nunca o executa em real.</div>':''}
    <div class="pmbar"><select id="btSrc">${Object.entries(SRC).map(([k,v])=>`<option value="${k}" ${state.src===k?'selected':''}>${v.label}</option>`).join('')}</select></div>
    ${state.src==='long'?`<div class="note">Histórico longo: velas spot da Binance desde 2020 (ouro = PAXG, EUR/USD = EURUSDT), em 1 h e 4 h (e 1/5 min para scalping). Dá muitas mais trades para a 2.ª parte e por isso um veredicto mais fiável. Não tem S&amp;P 500 nem funding; os custos são os mesmos (9 bps).${state.iv==='15m'?' <b>Em 15 min usa a Hyperliquid.</b>':''}</div>`:''}
    <div class="pmbar"><select id="btIv">${sel}</select><button class="ghost" id="btRun" ${state.busy?'disabled':''}>${state.busy?'A CORRER…':'CORRER TESTE'}</button></div>
    <div class="note">${esc(IV[state.iv].note)}</div>
    ${state.msg?`<div class="note">${esc(state.msg)}</div>`:''}${state.err?`<div class="halt">⚠ ${esc(state.err)}</div>`:''}${resHtml()}`;
  const info=$b('btInfo');if(info)info.textContent=state.res?`${state.res.all.main.s.n} TRADES`:'';
}
function bind(){
  const el=$b('btBody');if(!el)return;
  el.addEventListener('click',e=>{
    if(e.target.id==='btRun'){const t=$b('btTok');if(t&&t.value.trim()&&window.LIVE)LIVE.setToken(t.value.trim());run()}
    if(e.target.id==='btCsv')exportTrades();
    if(e.target.id==='btApply'){const s=e.target.dataset.s,iv=e.target.dataset.iv;
      const hl=window.LIVE&&LIVE.L.hl;
      if(!confirm(`Mudar o Macro Desk (papel) para ${P_(s).label} em velas de ${iv}? A página recarrega e as posições abertas mantêm-se até ao stop, alvo ou tempo.${hl?' ATENÇÃO: a Hyperliquid LIVE está ligada e passa a seguir esta estratégia.':''}`))return;
      if(MACRO.setStrategy(s,iv))location.reload()}
  });
  el.addEventListener('change',e=>{if(e.target.id==='btIv'){state.iv=e.target.value;render()}if(e.target.id==='btSrc'){state.src=e.target.value;render()}
    if(e.target.id==='btMode'){state.mode=e.target.value;const ivs=DSTRAT.MODES[state.mode].ivs;if(!ivs.includes(state.iv))state.iv=ivs[ivs.length>2?1:0];render()}});
  render();
}
window.BTUI={run,state:()=>state,approvals};
if($b('btBody'))bind();
})();
