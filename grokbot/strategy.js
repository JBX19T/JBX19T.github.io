/* DOLLOS · estratégias do Macro Desk (puras), com tamanho por risco.
   São partilhadas pelo Macro Desk ao vivo (macro.js), pelo teste histórico (backtest.js) e pelo piloto automático do worker,
   para que todos usem exatamente as mesmas regras.
   Famílias:  breakout  = tendência EMA + rompimento do máximo/mínimo (a original)
              reversion = reversão à média: aposta no regresso à média depois de um afastamento de 2 desvios-padrão
              trend     = tendência lenta: cruzamento de EMAs 20/100 com stops largos
              trail     = tendência com stop móvel: rompimento de 40 velas a favor da EMA 20/100, sem alvo fixo; o stop
                          acompanha o preço a 3×ATR do melhor preço desde a entrada (deixa correr os ganhos, corta as perdas)
              pullback  = compra nas quedas dentro da tendência: tendência de alta (preço e EMA 20 acima da EMA 100) e RSI de 2
                          períodos abaixo de 10 -> long; o inverso -> short. Alvo curto, saída rápida (estilo Connors) */
(function(root){
/* parâmetros comuns (os mesmos do Macro Desk e do piloto automático do worker) */
const DEFAULTS={riskPct:.01,maxLev:5,fast:20,slow:50,brk:20,atrN:14,stopATR:2,tpATR:3,maxHoldBars:96,costBps:9,maxATRpct:.03};
const PRESETS={
  breakout:{label:'Rompimento (original)',short:'rompimento',p:{}},
  reversion:{label:'Reversão à média',short:'reversão',p:{bandN:20,band:2,stopATR:2,tpATR:2}},
  trend:{label:'Tendência lenta',short:'tendência',p:{fast:20,slow:100,stopATR:3,tpATR:6,maxHoldBars:192}},
  trail:{label:'Tendência com stop móvel',short:'stop móvel',p:{fast:20,slow:100,brk:40,stopATR:3,tpATR:0,trailATR:3,maxHoldBars:400}},
  pullback:{label:'Queda dentro da tendência (RSI 2)',short:'RSI 2',p:{fast:20,slow:100,stopATR:2,tpATR:1.5,maxHoldBars:12}},
};
/* devolve a configuração com os parâmetros próprios da estratégia escolhida */
function withStrategy(cfg,name){
  const k=PRESETS[name]?name:'breakout';
  // os parâmetros próprios de cada estratégia voltam ao valor comum antes de aplicar os da escolhida (não herdam de outra)
  const reset={fast:DEFAULTS.fast,slow:DEFAULTS.slow,brk:DEFAULTS.brk,stopATR:DEFAULTS.stopATR,tpATR:DEFAULTS.tpATR,maxHoldBars:DEFAULTS.maxHoldBars,trailATR:0};
  return{...cfg,...reset,...PRESETS[k].p,strategy:k};
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
  /* RSI de Wilder com n períodos (0..100) */
  const rsi=(c,n)=>{if(c.length<n+1)return null;let g=0,l=0;for(let i=1;i<=n;i++){const d=c[i]-c[i-1];if(d>0)g+=d;else l-=d}g/=n;l/=n;
    for(let i=n+1;i<c.length;i++){const d=c[i]-c[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n}return l===0?100:100-100/(1+g/l)};
  const pullback=bars=>{
    const need=Math.max(CFG.slow,CFG.atrN+1)+2;
    if(bars.length<need)return{dir:'wait',why:`velas ${bars.length}/${need}`};
    const c=bars.map(b=>b.c),last=bars[bars.length-1],a=atr(bars,CFG.atrN),f=ema(c,CFG.fast),s=ema(c,CFG.slow),r=rsi(c.slice(-60),2);
    const vf=volFilter(a,last.c);if(vf)return{dir:'flat',why:vf,atr:a};
    if(last.c>s&&f>s&&r<10)return{dir:'long',why:`queda em tendência de alta (RSI2 ${r.toFixed(0)})`,atr:a};
    if(last.c<s&&f<s&&r>90)return{dir:'short',why:`subida em tendência de baixa (RSI2 ${r.toFixed(0)})`,atr:a};
    return{dir:'flat',why:`RSI2 ${r.toFixed(0)}, ${f>s?'alta':'baixa'}`,atr:a};
  };
  const signal={breakout,reversion,trend,trail:breakout,pullback}[kind];
  /* stop móvel: devolve o novo stop depois de uma vela (só aperta, nunca alarga). p = {side, stop, best, atr} */
  const trailStop=(p,bar)=>{
    if(!(CFG.trailATR>0)||!(p.atr>0))return p.stop;
    const best=p.side>0?Math.max(p.best??bar.h,bar.h):Math.min(p.best??bar.l,bar.l);p.best=best;
    const s=best-p.side*CFG.trailATR*p.atr;
    return p.side>0?Math.max(p.stop,s):Math.min(p.stop,s);
  };
  const cost=()=>CFG.costBps/1e4;
  const sizeFor=(eq,entry,stopDist)=>{const riskUsd=eq*CFG.riskPct,n=riskUsd/(stopDist/entry);return Math.min(n,eq*CFG.maxLev/nMarkets)};
  const hasTarget=CFG.tpATR>0;
  return{ema,atr,rsi,signal,cost,sizeFor,kind,trailStop,hasTarget};
}
/* trava do dinheiro real: só se opera a sério uma estratégia (e tamanho de velas) que passou o teste em duas partes
   há menos de 45 dias. Mesmas exigências do teste: 30+ trades na 2.ª parte, ganho médio > 0, fator de lucro > 1,1, t >= 2. */
const APPROVAL_DAYS=45;
function approvalOk(a,strategy,iv,now=Date.now()){
  return !!(a&&a.strategy===strategy&&a.iv===iv&&a.at>0&&now-a.at<=APPROVAL_DAYS*864e5&&now>=a.at-6e5&&a.n>=30&&a.avgR>0&&a.pf>1.1&&a.tR>=2);
}
const api={make,PRESETS,withStrategy,DEFAULTS,approvalOk,APPROVAL_DAYS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DSTRAT=api;
})(typeof window!=='undefined'?window:globalThis);
