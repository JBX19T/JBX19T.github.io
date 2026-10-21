/* DOLLOS · ESTATÍSTICA DO LABORATÓRIO: correção para testes múltiplos, deduplicação por correlação e dados de controlo.
   Funções puras (testadas em worker/test/lab.test.mjs). Só Node. */
(function(root){
const BT=require('./backtest.js');
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
function tstat(xs){const n=xs.length;if(n<2)return{n,mean:n?xs[0]:null,sd:null,t:null};const m=mean(xs),sd=Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(n-1));return{n,mean:m,sd,t:sd>0?m/(sd/Math.sqrt(n)):null}}
/* função de distribuição da normal (Abramowitz-Stegun 26.2.17, erro < 1e-7) */
function normCdf(x){const k=1/(1+.2316419*Math.abs(x)),d=.3989422804014327*Math.exp(-x*x/2),p=d*k*(.319381530+k*(-.356563782+k*(1.781477937+k*(-1.821255978+k*1.330274429))));return x>=0?1-p:p}
const pTwo=t=>t==null?1:2*(1-normCdf(Math.abs(t)));
/* limiar |t| de Bonferroni para N hipóteses a um nível global alpha (bilateral) */
const bonferroniZ=(N,alpha=.05)=>BT.qnorm(1-alpha/(2*Math.max(1,N)));
/* Benjamini-Hochberg: devolve o conjunto de índices rejeitados a uma taxa de falsas descobertas q */
function benjaminiHochberg(p,q=.1){
  const idx=p.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),m=p.length;let k=-1;
  idx.forEach(([v],r)=>{if(v<=q*(r+1)/m)k=r});
  return new Set(k>=0?idx.slice(0,k+1).map(x=>x[1]):[]);
}
const corr=(a,b)=>{const n=a.length;let ma=0,mb=0;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i]}ma/=n;mb/=n;let sab=0,saa=0,sbb=0;for(let i=0;i<n;i++){const x=a[i]-ma,y=b[i]-mb;sab+=x*y;saa+=x*x;sbb+=y*y}return saa>0&&sbb>0?sab/Math.sqrt(saa*sbb):0};
/* agrupa séries (resultado diário de cada configuração) em grupos com correlação >= thr com o representante; devolve o grupo de cada série.
   O número de grupos é o nº efetivo de hipóteses independentes (variantes quase idênticas contam como uma). */
function cluster(series,thr=.9){
  const reps=[],group=new Array(series.length).fill(-1);
  series.forEach((s,i)=>{for(let r=0;r<reps.length;r++){if(corr(series[reps[r]],s)>=thr){group[i]=r;return}}reps.push(i);group[i]=reps.length-1});
  return{group,count:reps.length,reps};
}
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
/* dados de controlo SEM estrutura temporal exploravel: baralha blocos de "velas relativas" (abertura face ao fecho anterior, máximo/mínimo/fecho face à abertura),
   mantendo datas, distribuição de amplitudes e volume. block=1: baralhar vela a vela; block>1 mantém dependência curta dentro do bloco. */
function shuffleBars(bars,seed=1,block=1){
  const n=bars.length;if(n<3)return bars.slice();
  const rel=[];for(let i=1;i<n;i++){const b=bars[i],pc=bars[i-1].c;rel.push({go:b.o/pc,ho:b.h/b.o,lo:b.l/b.o,co:b.c/b.o,v:b.v})}
  const r=rng(seed),m=rel.length,picked=[];
  while(picked.length<m){const st=Math.floor(r()*m);for(let j=0;j<block&&picked.length<m;j++)picked.push(rel[(st+j)%m])}
  const out=[{...bars[0]}];let pc=bars[0].c;
  for(let i=1;i<n;i++){const x=picked[i-1],o=pc*x.go,c=o*x.co,h=Math.max(o*x.ho,o,c),l=Math.min(o*x.lo,o,c);out.push({t:bars[i].t,o,h,l,c,v:x.v});pc=c}
  return out;
}

/* ===== inferência para a Fase 2 ===== */
/* bootstrap estacionário (Politis-Romano): índices de uma reamostragem com blocos de comprimento geométrico (média meanBlock) */
function statIdx(n,meanBlock,r){const p=1/Math.max(1,meanBlock),idx=new Int32Array(n);let cur=Math.floor(r()*n);for(let i=0;i<n;i++){idx[i]=cur;cur=r()<p?Math.floor(r()*n):(cur+1)%n}return idx}
/* correção de Holm: devolve os p ajustados pela mesma ordem de entrada */
function holm(p){const m=p.length,o=p.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),adj=new Array(m);let run=0;o.forEach(([v,i],k)=>{run=Math.max(run,Math.min(1,(m-k)*v));adj[i]=run});return adj}
/* White (2000) Reality Check e Hansen (2005) SPA. M[k] = série diária da configuração k (retorno em excesso face à referência; aqui, face a zero).
   H0: nenhuma configuração tem média positiva. Estatística: máximo dos t (SPA) ou da média escalada (RC); distribuição nula por bootstrap estacionário recentrado. */
function realityCheck(M,{B=1000,meanBlock=10,seed=7}={}){
  const N=M.length;if(!N)return null;const n=M[0].length,r=rng(seed),mean=new Float64Array(N);
  for(let k=0;k<N;k++){let s=0;for(let i=0;i<n;i++)s+=M[k][i];mean[k]=s/n}
  const draws=[],sumSq=new Float64Array(N);
  for(let b=0;b<B;b++){const idx=statIdx(n,meanBlock,r),bm=new Float64Array(N);for(let k=0;k<N;k++){const row=M[k];let s=0;for(let i=0;i<n;i++)s+=row[idx[i]];bm[k]=s/n}draws.push(bm);for(let k=0;k<N;k++)sumSq[k]+=(bm[k]-mean[k])**2}
  const om=Array.from(sumSq,x=>Math.sqrt(x/B)||1e-12);   // erro-padrão bootstrap de cada média (já com a dependência temporal)
  let Vrc=-Infinity,Tspa=-Infinity,best=-1;for(let k=0;k<N;k++){Vrc=Math.max(Vrc,Math.sqrt(n)*mean[k]);const t=mean[k]/om[k];if(t>Tspa){Tspa=t;best=k}}
  Tspa=Math.max(Tspa,0);Vrc=Math.max(Vrc,0);
  const thr=Math.sqrt(2*Math.log(Math.log(Math.max(n,3)))),mu=Array.from(mean,(m,k)=>m/om[k]<=-thr?m:0);   // recentragem «consistente» do SPA (Hansen 2005): só as claramente más (t muito negativo) mantêm a sua média negativa na distribuição nula; as outras recentram em 0
  let cRC=0,cSPA=0;
  for(let b=0;b<B;b++){let v=-Infinity,t=-Infinity;for(let k=0;k<N;k++){const d=draws[b][k]-mean[k];v=Math.max(v,Math.sqrt(n)*d);t=Math.max(t,(draws[b][k]-mean[k]+mu[k])/om[k])}
    if(Math.max(v,0)>=Vrc)cRC++;if(Math.max(t,0)>=Tspa)cSPA++}
  return{N,n,best,bestMean:mean[best],bestT:mean[best]/om[best],pRC:(cRC+1)/(B+1),pSPA:(cSPA+1)/(B+1)};
}
/* média por «clusters» (ex.: meses de calendário): bootstrap reamostrando clusters inteiros */
function clusterBootstrap(values,clusters,{B=5000,seed=11}={}){
  const map=new Map();values.forEach((v,i)=>{const k=clusters[i];if(!map.has(k))map.set(k,[]);map.get(k).push(v)});
  const G=[...map.values()],n=values.length,m=mean(values);if(G.length<3)return{n,mean:m,se:null,lo:null,hi:null,t:null,pOne:null,clusters:G.length};
  const r=rng(seed),means=[];
  for(let b=0;b<B;b++){let s=0,c=0;for(let g=0;g<G.length;g++){const grp=G[Math.floor(r()*G.length)];for(const v of grp){s+=v;c++}}means.push(s/c)}
  means.sort((a,b)=>a-b);const se=Math.sqrt(means.reduce((x,y)=>x+(y-m)**2,0)/B),q=p=>means[Math.min(B-1,Math.max(0,Math.floor(p*B)))];
  return{n,mean:m,se,lo:q(.025),hi:q(.975),t:se>0?m/se:null,pOne:means.filter(x=>x<=0).length/B,clusters:G.length};
}
/* diferença emparelhada de duas séries diárias (variante − referência), bootstrap estacionário; pOne = P(média da diferença <= 0) */
function pairedBootstrap(a,b,{B=3000,meanBlock=20,seed=5}={}){
  const n=a.length,d=new Float64Array(n);for(let i=0;i<n;i++)d[i]=a[i]-b[i];const m=mean(Array.from(d)),r=rng(seed),means=[];
  for(let k=0;k<B;k++){const idx=statIdx(n,meanBlock,r);let s=0;for(let i=0;i<n;i++)s+=d[idx[i]];means.push(s/n)}
  const se=Math.sqrt(means.reduce((x,y)=>x+(y-m)**2,0)/B);return{n,mean:m,se,t:se>0?m/se:null,pOne:(means.filter(x=>x<=0).length+1)/(B+1)};
}
/* Teste da ENTRADA (independente de saídas e custos). signals: [{i,side}] (sinal ao fecho da vela i; entrada à abertura de i+1).
   Para cada horizonte h mede o retorno futuro em unidades de R (R = stopATR × ATR do sinal), MFE e MAE em ATR, e compara com entradas aleatórias
   (mesmo nº de sinais e mesma proporção de compras, instantes ao acaso). */
function entryEdge(X,signals,hs,{stopATR=2,costBps=12,B=5000,seed=3}={}){
  const a=X.atr(14),n=X.n,r=rng(seed),out=[];
  const measure=(i,side,h)=>{const e=X.o[i+1],A=a[i];if(!(A>0)||i+h>=n)return null;let mfe=0,mae=0;for(let j=i+1;j<=i+h;j++){const fav=side>0?X.h[j]-e:e-X.l[j],adv=side>0?e-X.l[j]:X.h[j]-e;if(fav>mfe)mfe=fav;if(adv>mae)mae=adv}
    return{R:side*(X.c[i+h]-e)/(stopATR*A),mfe:mfe/A,mae:mae/A,costR:2*(costBps/1e4)*e/(stopATR*A)}};
  const valid=[];for(let i=0;i<n-1;i++)if(a[i]>0)valid.push(i);
  for(const h of hs){
    const obs=signals.map(s=>measure(s.i,s.side,h)).filter(Boolean);if(obs.length<8){out.push({h,n:obs.length});continue}
    const mR=mean(obs.map(x=>x.R)),sdR=Math.sqrt(obs.reduce((s,x)=>s+(x.R-mR)**2,0)/(obs.length-1)),eR=mean(obs.map(x=>x.mfe))/(mean(obs.map(x=>x.mae))||1e-12);
    const nl=signals.filter(s=>s.side>0).length,ns=signals.length-nl,nm=[],ne=[];
    for(let b=0;b<B;b++){let sr=0,sf=0,sa=0,c=0;for(let k=0;k<signals.length;k++){const side=k<nl?1:-1;let m=null,tries=0;while(!m&&tries++<5){m=measure(valid[Math.floor(r()*valid.length)],side,h)}if(m){sr+=m.R;sf+=m.mfe;sa+=m.mae;c++}}nm.push(c?sr/c:0);ne.push(sa>0?sf/sa:1)}
    const nmMean=mean(nm),nmSd=Math.sqrt(nm.reduce((s,x)=>s+(x-nmMean)**2,0)/B),neMean=mean(ne);
    out.push({h,n:obs.length,meanR:mR,tR:sdR>0?mR/(sdR/Math.sqrt(obs.length)):null,eRatio:eR,nullMeanR:nmMean,nullSdR:nmSd,pR:(nm.filter(x=>x>=mR).length+1)/(B+1),nullERatio:neMean,pE:(ne.filter(x=>x>=eR).length+1)/(B+1),costR:mean(obs.map(x=>x.costR)),nLong:nl,nShort:ns});
  }
  return out;
}
/* sinais sem sobreposição: um sinal por janela de `gap` velas */
function decluster(sigs,gap){const out=[];let last=-1e9;for(const s of sigs){if(s.i-last>=gap){out.push(s);last=s.i}}return out}
const api={mean,tstat,normCdf,pTwo,bonferroniZ,benjaminiHochberg,corr,cluster,rng,shuffleBars,statIdx,holm,realityCheck,clusterBootstrap,pairedBootstrap,entryEdge,decluster};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DLABSTATS=api;
})(typeof window!=='undefined'?window:globalThis);
