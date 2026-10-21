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
const api={mean,tstat,normCdf,pTwo,bonferroniZ,benjaminiHochberg,corr,cluster,rng,shuffleBars};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DLABSTATS=api;
})(typeof window!=='undefined'?window:globalThis);
