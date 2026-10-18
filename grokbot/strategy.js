/* DOLLOS · estratégia do Macro Desk (pura): tendência EMA + rompimento + filtro de volatilidade, tamanho por risco.
   É partilhada pelo Macro Desk ao vivo (macro.js) e pelo teste histórico (backtest.js), para que ambos usem exatamente as mesmas regras. */
(function(root){
function make(CFG,nMarkets=3){
  const ema=(a,n)=>{if(a.length<n)return null;const k=2/(n+1);let e=a.slice(0,n).reduce((s,v)=>s+v,0)/n;for(let i=n;i<a.length;i++)e=a[i]*k+e*(1-k);return e};
  const atr=(bars,n)=>{if(bars.length<n+1)return null;let s=0;for(let i=bars.length-n;i<bars.length;i++){const b=bars[i],pc=bars[i-1].c;s+=Math.max(b.h-b.l,Math.abs(b.h-pc),Math.abs(b.l-pc))}return s/n};
  /* tendência (EMA rápida vs lenta) + rompimento do máximo/mínimo das últimas N velas + filtro de volatilidade */
  const signal=bars=>{
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
  };
  const cost=()=>CFG.costBps/1e4;
  const sizeFor=(eq,entry,stopDist)=>{const riskUsd=eq*CFG.riskPct,n=riskUsd/(stopDist/entry);return Math.min(n,eq*CFG.maxLev/nMarkets)};
  return{ema,atr,signal,cost,sizeFor};
}
const api={make};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DSTRAT=api;
})(typeof window!=='undefined'?window:globalThis);
