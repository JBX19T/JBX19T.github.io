/* DOLLOS · estratégias do Macro Desk (puras), com tamanho por risco.
   São partilhadas pelo Macro Desk ao vivo (macro.js), pelo teste histórico (backtest.js) e pelo piloto automático do worker,
   para que todos usem exatamente as mesmas regras.
   Famílias:  breakout  = tendência EMA + rompimento do máximo/mínimo (a original)
              reversion = reversão à média: aposta no regresso à média depois de um afastamento de 2 desvios-padrão
              trend     = tendência lenta: cruzamento de EMAs 20/100 com stops largos */
(function(root){
/* parâmetros comuns (os mesmos do Macro Desk e do piloto automático do worker) */
const DEFAULTS={riskPct:.01,maxLev:5,fast:20,slow:50,brk:20,atrN:14,stopATR:2,tpATR:3,maxHoldBars:96,costBps:9,maxATRpct:.03};
const PRESETS={
  breakout:{label:'Rompimento (original)',short:'rompimento',p:{}},
  reversion:{label:'Reversão à média',short:'reversão',p:{bandN:20,band:2,stopATR:2,tpATR:2}},
  trend:{label:'Tendência lenta',short:'tendência',p:{fast:20,slow:100,stopATR:3,tpATR:6,maxHoldBars:192}},
};
/* devolve a configuração com os parâmetros próprios da estratégia escolhida */
function withStrategy(cfg,name){
  const k=PRESETS[name]?name:'breakout';
  return{...cfg,...PRESETS[k].p,strategy:k};
}
function make(CFG,nMarkets=3){
  const kind=PRESETS[CFG.strategy]?CFG.strategy:'breakout';
  const ema=(a,n)=>{if(a.length<n)return null;const k=2/(n+1);let e=a.slice(0,n).reduce((s,v)=>s+v,0)/n;for(let i=n;i<a.length;i++)e=a[i]*k+e*(1-k);return e};
  const atr=(bars,n)=>{if(bars.length<n+1)return null;let s=0;for(let i=bars.length-n;i<bars.length;i++){const b=bars[i],pc=bars[i-1].c;s+=Math.max(b.h-b.l,Math.abs(b.h-pc),Math.abs(b.l-pc))}return s/n};
  const volFilter=(a,px)=>{const ap=a/px;if(ap<CFG.minATRpct)return'volatilidade muito baixa';if(ap>CFG.maxATRpct)return'volatilidade extrema';return null};
  /* tendência (EMA rápida vs lenta) + rompimento do máximo/mínimo das últimas N velas + filtro de volatilidade */
  const breakout=bars=>{
    const need=Math.max(CFG.slow,CFG.brk+1,CFG.atrN+1)+1;
    if(bars.length<need)return{dir:'wait',why:`velas ${bars.length}/${need}`};
    const c=bars.map(b=>b.c),last=bars[bars.length-1],f=ema(c,CFG.fast),s=ema(c,CFG.slow),a=atr(bars,CFG.atrN);
    const prev=bars.slice(-CFG.brk-1,-1),hi=Math.max(...prev.map(b=>b.h)),lo=Math.min(...prev.map(b=>b.l));
    const vf=volFilter(a,last.c);if(vf)return{dir:'flat',why:vf,atr:a};
    if(f>s&&last.c>hi)return{dir:'long',why:'tendência de alta + rompe máximo',atr:a};
    if(f<s&&last.c<lo)return{dir:'short',why:'tendência de baixa + rompe mínimo',atr:a};
    return{dir:'flat',why:f>s?'alta, sem rompimento':'baixa, sem rompimento',atr:a};
  };
  /* reversão à média: fecho a mais de `band` desvios-padrão da média das últimas `bandN` velas -> aposta no regresso */
  const reversion=bars=>{
    const n=CFG.bandN||20,need=Math.max(n,CFG.atrN+1)+1;
    if(bars.length<need)return{dir:'wait',why:`velas ${bars.length}/${need}`};
    const c=bars.slice(-n).map(b=>b.c),m=c.reduce((s,v)=>s+v,0)/n,sd=Math.sqrt(c.reduce((s,v)=>s+(v-m)**2,0)/n);
    const last=bars[bars.length-1],a=atr(bars,CFG.atrN);
    const vf=volFilter(a,last.c);if(vf)return{dir:'flat',why:vf,atr:a};
    if(!(sd>0))return{dir:'flat',why:'sem variação',atr:a};
    const z=(last.c-m)/sd,b=CFG.band||2;
    if(z<=-b)return{dir:'long',why:`${z.toFixed(1)} desvios abaixo da média`,atr:a};
    if(z>=b)return{dir:'short',why:`+${z.toFixed(1)} desvios acima da média`,atr:a};
    return{dir:'flat',why:`perto da média (${z>=0?'+':''}${z.toFixed(1)} desvios)`,atr:a};
  };
  /* tendência lenta: entra só na vela em que a EMA rápida cruza a lenta */
  const trend=bars=>{
    const need=Math.max(CFG.slow,CFG.atrN+1)+2;
    if(bars.length<need)return{dir:'wait',why:`velas ${bars.length}/${need}`};
    const c=bars.map(b=>b.c),p=c.slice(0,-1),last=bars[bars.length-1],a=atr(bars,CFG.atrN);
    const f=ema(c,CFG.fast),s=ema(c,CFG.slow),fp=ema(p,CFG.fast),sp=ema(p,CFG.slow);
    const vf=volFilter(a,last.c);if(vf)return{dir:'flat',why:vf,atr:a};
    if(f>s&&fp<=sp)return{dir:'long',why:`EMA ${CFG.fast} cruza acima da ${CFG.slow}`,atr:a};
    if(f<s&&fp>=sp)return{dir:'short',why:`EMA ${CFG.fast} cruza abaixo da ${CFG.slow}`,atr:a};
    return{dir:'flat',why:f>s?'alta, sem cruzamento novo':'baixa, sem cruzamento novo',atr:a};
  };
  const signal={breakout,reversion,trend}[kind];
  const cost=()=>CFG.costBps/1e4;
  const sizeFor=(eq,entry,stopDist)=>{const riskUsd=eq*CFG.riskPct,n=riskUsd/(stopDist/entry);return Math.min(n,eq*CFG.maxLev/nMarkets)};
  return{ema,atr,signal,cost,sizeFor,kind};
}
const api={make,PRESETS,withStrategy,DEFAULTS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DSTRAT=api;
})(typeof window!=='undefined'?window:globalThis);
