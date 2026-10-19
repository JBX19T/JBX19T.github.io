/* DOLLOS · RESULTADOS — estatísticas das trades fechadas dos dois desks (memecoins e macro).
   Só lê o estado dos desks; não altera nada. */
(()=>{
const $r=id=>document.getElementById(id);
const usd=v=>(v>0?'+$':v<0?'-$':'$')+Math.abs(v).toFixed(2);
const pct=v=>v==null?'—':(v>=0?'+':'')+(v*100).toFixed(1)+'%';
const sum=a=>a.reduce((s,t)=>s+t.pnl,0);
const MIN_TRADES=30;
const REASON={'take-profit':'alvo','stop-loss':'stop','time-stop':'tempo','manual':'manual','kill-switch':'paragem','limite diário':'limite diário','follow-exit':'copy-exit'};

/* estatísticas puras (testáveis) */
function compute(trades,start,maxDD,since){
  const n=trades.length,w=trades.filter(t=>t.pnl>0),l=trades.filter(t=>t.pnl<=0);
  const gw=sum(w),gl=-sum(l),net=sum(trades);
  const byReason={},byDay={};
  for(const t of trades){
    const r=REASON[t.why]||t.why||'?';(byReason[r]??={n:0,pnl:0});byReason[r].n++;byReason[r].pnl+=t.pnl;
    const d=new Date(t.c).toISOString().slice(0,10);(byDay[d]??={n:0,pnl:0});byDay[d].n++;byDay[d].pnl+=t.pnl;
  }
  // em R (múltiplos do risco da trade), só para trades que registaram o risco (o Macro Desk regista; as memecoins não têm stop fixo em %)
  const rt=trades.filter(t=>t.risk>0),mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const avgR=mean(rt.map(t=>t.pnl/t.risk)),costR=mean(rt.filter(t=>t.cost!=null).map(t=>t.cost/t.risk));
  return{avgR,costR,nR:rt.length,n,wins:w.length,losses:l.length,rate:n?w.length/n:null,net,netPct:start?net/start:null,
    avgWin:w.length?gw/w.length:null,avgLoss:l.length?-gl/l.length:null,
    pf:gl>0?gw/gl:(gw>0?Infinity:null),exp:n?net/n:null,
    best:n?Math.max(...trades.map(t=>t.pnl)):null,worst:n?Math.min(...trades.map(t=>t.pnl)):null,
    maxDD:maxDD||0,since,byReason,byDay};
}
function ago(ts){if(!ts)return '—';const m=Math.max(0,Math.round((Date.now()-ts)/60000));return m<60?m+' min':m<1440?Math.floor(m/60)+'h '+m%60+'m':Math.floor(m/1440)+'d '+Math.floor(m%1440/60)+'h'}

function block(title,st,eq){
  const row=(a,b)=>`<div class="rr"><span>${a}</span><b>${b}</b></div>`;
  const reasons=Object.entries(st.byReason).sort((a,b)=>b[1].n-a[1].n).map(([k,v])=>`<tr><td>${k}</td><td>${v.n}</td><td class="${v.pnl>=0?'up':'dn'}">${usd(v.pnl)}</td></tr>`).join('');
  const days=Object.entries(st.byDay).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,5).map(([k,v])=>`<tr><td>${k.slice(5)}</td><td>${v.n}</td><td class="${v.pnl>=0?'up':'dn'}">${usd(v.pnl)}</td></tr>`).join('');
  const enough=st.n>=MIN_TRADES;
  return `<div class="rs"><h4>${title}<small>há ${ago(st.since)}</small></h4>
    ${row('Resultado (fechadas)',`<span class="${st.net>=0?'up':'dn'}">${usd(st.net)} (${pct(st.netPct)})</span>`)}
    ${row('Equity agora',`$${eq.toFixed(2)}`)}
    ${row('Trades',`${st.n} · ${st.wins}W ${st.losses}L`)}
    ${row('Taxa de acerto',st.rate==null?'—':(st.rate*100).toFixed(0)+'%')}
    ${row('Ganho / perda média',st.n?`${st.avgWin==null?'—':usd(st.avgWin)} / ${st.avgLoss==null?'—':usd(st.avgLoss)}`:'—')}
    ${row('Fator de lucro',st.pf==null?'—':st.pf===Infinity?'∞':st.pf.toFixed(2))}
    ${row('Média por trade',st.exp==null?'—':usd(st.exp))}
    ${st.avgR==null?'':row('Média por trade em R',`${st.avgR>=0?'+':''}${st.avgR.toFixed(2)} R${st.costR==null?'':` <small>(custos ${st.costR.toFixed(2)} R)</small>`} <small>· ${st.nR} trades</small>`)}
    ${row('Melhor / pior',st.n?`${usd(st.best)} / ${usd(st.worst)}`:'—')}
    ${row('Pior queda',(st.maxDD*100).toFixed(1)+'%')}
    ${reasons?`<div class="sub">POR SAÍDA</div><table><tbody>${reasons}</tbody></table>`:''}
    ${days?`<div class="sub">POR DIA (UTC)</div><table><tbody>${days}</tbody></table>`:''}
    <div class="note">${st.n===0?'Ainda sem trades fechadas.':enough?'Amostra razoável, mas continua a ser dinheiro fictício.':`Amostra pequena (${st.n}/${MIN_TRADES}): ainda não dá para concluir nada.`}</div></div>`;
}

/* ===== exportar trades em CSV (abre em Google Sheets / Excel) =====
   Navegador: partilha o ficheiro (iPhone) ou descarrega-o. App Android: copia para a área de transferência (a WebView não descarrega ficheiros). */
const csvOf=rows=>rows.map(r=>r.map(v=>{const x=v==null?'':String(v);return /[",;\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x}).join(',')).join('\n');
const native=()=>!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
async function exportCsv(name,rows){
  const csv=csvOf(rows);
  if(!native()){
    try{const file=new File(['\ufeff'+csv],name,{type:'text/csv'});if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return{ok:true,how:'partilhado'}}}catch(e){if(e&&e.name==='AbortError')return{ok:false,how:'cancelado'}}
    try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},3000);return{ok:true,how:'descarregado'}}catch(e){}
  }
  try{await navigator.clipboard.writeText(csv);return{ok:true,how:'copiado: cola numa folha de cálculo'}}catch(e){return{ok:false,how:'não deu para copiar',csv}}
}
const iso=t=>t?new Date(t).toISOString().replace('T',' ').slice(0,19):'';
function tradeRows(){
  const rows=[['desk','aberta_utc','fechada_utc','ativo','cadeia','lado','entrada','saida','valor_usd','pnl_usd','motivo']];
  try{for(const t of (window.MEME&&MEME.state().trades)||[])rows.push(['memecoins',iso(t.o),iso(t.c),t.l,t.ch||'','long',t.en,t.ex,(+t.nt).toFixed(2),(+t.pnl).toFixed(2),t.why])}catch(e){}
  try{for(const t of (window.MACRO&&MACRO.state().trades)||[])rows.push(['macro',iso(t.o),iso(t.c),t.l,'',t.side>0?'long':'short',t.en,t.ex,(+t.nt).toFixed(2),(+t.pnl).toFixed(2),t.why])}catch(e){}
  return rows;
}
let expMsg='',expCsv='';
async function doExport(){
  const rows=tradeRows();if(rows.length<2){expMsg='Ainda não há trades fechadas para exportar.';refresh();return}
  const r=await exportCsv('dollos-trades-'+new Date().toISOString().slice(0,10)+'.csv',rows);
  expMsg=`${rows.length-1} trades: ${r.how}.`;expCsv=r.csv||'';refresh();
  if(expCsv)setTimeout(()=>{expCsv='';refresh()},120000);
}

function refresh(){
  const body=$r('resBody');if(!body)return;
  const blocks=[];
  try{const M=window.MEME;if(M){const S=M.state();blocks.push(block('MEMECOINS',compute(S.trades||[],M.start(),S.maxDD,S.since),S.cash+S.positions.reduce((s,p)=>s+p.size*(p.px/p.entry),0)))}}catch(e){}
  try{const K=window.MACRO;if(K){const S=K.state();blocks.push(block('MACRO',compute(S.trades||[],K.CFG.start,S.maxDD,S.since),K.equity()))}}catch(e){}
  body.innerHTML=`<div class="rsg">${blocks.join('')}</div>
    <div class="pmbar"><button class="ghost" id="resCsv">EXPORTAR TRADES (CSV)</button></div>
    ${expMsg?`<div class="note">${expMsg}</div>`:''}${expCsv?`<textarea readonly style="width:100%;height:90px;font-size:10px">${expCsv.replace(/</g,'&lt;')}</textarea>`:''}
    <div class="note">Dinheiro fictício: ignora parte do atrito real (slippage na saída, ordens falhadas, rugs mais rápidos do que o preço lido). Os resultados reais seriam piores. Fator de lucro acima de 1 = ganhou mais do que perdeu. Só conta com 30+ trades fechadas.</div>`;
  const tot=[window.MEME&&MEME.state().trades.length,window.MACRO&&MACRO.state().trades.length].filter(x=>x!=null).reduce((a,b)=>a+b,0);
  $r('resInfo').textContent=tot+' TRADES FECHADAS';
}
window.RESULTS={compute,refresh,exportCsv,csvOf};
const rb=$r('resBody');if(rb)rb.addEventListener('click',e=>{if(e.target.id==='resCsv')doExport()});
refresh();setInterval(()=>{if(!expCsv)refresh()},10000);
})();
