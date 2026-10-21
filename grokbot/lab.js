/* DOLLOS · BIBLIOTECA DE ESTRATÉGIAS DO LABORATÓRIO (investigação; NÃO é produção)
   Cada estratégia tem identificador, família, fontes, grelha de parâmetros e regras formais de entrada/saída.
   Os indicadores são pré-calculados uma vez por mercado e só usam dados até à vela i (sem olhar para o futuro:
   worker/test/lab.test.mjs verifica-o recalculando cada sinal sobre as velas truncadas em i).
   Uma estratégia só passa para strategy.js (produção) depois de aprovada pelo protocolo e de existir um teste de paridade. */
(function(root){
const D=(typeof require!=='undefined'&&typeof module!=='undefined'&&module.exports)?require('./strategy.js'):root.DSTRAT;
const H=36e5,DAY=864e5;

/* ---------- indicadores (arrays do tamanho das velas; NaN onde ainda não há dados) ---------- */
function makeCtx(bars){
  const n=bars.length,memo=new Map(),NaNs=()=>new Array(n).fill(NaN);
  const g=(key,fn)=>{let v=memo.get(key);if(v===undefined){v=fn();memo.set(key,v)}return v};
  const t=bars.map(b=>b.t),o=bars.map(b=>b.o),h=bars.map(b=>b.h),l=bars.map(b=>b.l),c=bars.map(b=>b.c),v=bars.map(b=>b.v);
  const hasVol=bars.length>0&&bars.every(b=>b.v>0);
  const barMs=(()=>{const d=[];for(let i=1;i<Math.min(n,200);i++)d.push(t[i]-t[i-1]);d.sort((x,y)=>x-y);return d.length?d[d.length>>1]:H})();
  const ema=(src,len,key)=>g(key||'ema'+len+':'+(src===c?'c':'x'),()=>{const out=NaNs();let first=-1;for(let i=0;i<n;i++)if(Number.isFinite(src[i])){first=i;break}
    if(first<0||first+len>n)return out;let e=0;for(let i=first;i<first+len;i++)e+=src[i];e/=len;out[first+len-1]=e;const k=2/(len+1);
    for(let i=first+len;i<n;i++){e=src[i]*k+e*(1-k);out[i]=e}return out});
  const sma=(src,len,key)=>g(key||'sma'+len+(src===c?'c':'x'),()=>{const out=NaNs();let s=0,cnt=0;for(let i=0;i<n;i++){if(Number.isFinite(src[i])){s+=src[i];cnt++}if(i>=len&&Number.isFinite(src[i-len])){s-=src[i-len];cnt--}if(i>=len-1&&cnt===len)out[i]=s/len}return out});
  const sdv=(src,len,key)=>g(key||'sd'+len+(src===c?'c':'x'),()=>{const out=NaNs(),m=sma(src,len);for(let i=len-1;i<n;i++){let s=0;for(let j=i-len+1;j<=i;j++)s+=(src[j]-m[i])**2;out[i]=Math.sqrt(s/len)}return out});
  const tr=g('tr',()=>{const out=NaNs();for(let i=0;i<n;i++)out[i]=i?Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])):h[i]-l[i];return out});
  const atr=len=>g('atr'+len,()=>{const out=NaNs();let s=0;for(let i=0;i<n;i++){s+=tr[i];if(i>=len)s-=tr[i-len];if(i>=len)out[i]=s/len}return out});   // média simples das últimas len velas (como a produção: vela 0 sem close anterior fica de fora)
  const roc=len=>g('roc'+len,()=>{const out=NaNs();for(let i=len;i<n;i++)out[i]=c[i]/c[i-len]-1;return out});
  const don=(len,hi)=>g('don'+len+(hi?'H':'L'),()=>{const out=NaNs();for(let i=len;i<n;i++){let m=hi?-Infinity:Infinity;for(let j=i-len;j<i;j++)m=hi?Math.max(m,h[j]):Math.min(m,l[j]);out[i]=m}return out});
  const rsi=len=>g('rsi'+len,()=>{const out=NaNs();if(n<=len)return out;let gn=0,ls=0;for(let i=1;i<=len;i++){const d=c[i]-c[i-1];if(d>0)gn+=d;else ls-=d}gn/=len;ls/=len;out[len]=ls===0?100:100-100/(1+gn/ls);
    for(let i=len+1;i<n;i++){const d=c[i]-c[i-1];gn=(gn*(len-1)+Math.max(d,0))/len;ls=(ls*(len-1)+Math.max(-d,0))/len;out[i]=ls===0?100:100-100/(1+gn/ls)}return out});
  const adx=len=>g('adx'+len,()=>{const pdi=NaNs(),mdi=NaNs(),ax=NaNs();if(n<=2*len)return{pdi,mdi,adx:ax};
    let trS=0,pS=0,mS=0;for(let i=1;i<=len;i++){const up=h[i]-h[i-1],dn=l[i-1]-l[i];trS+=tr[i];pS+=up>dn&&up>0?up:0;mS+=dn>up&&dn>0?dn:0}
    const dx=NaNs();const push=i=>{pdi[i]=100*pS/trS;mdi[i]=100*mS/trS;dx[i]=100*Math.abs(pdi[i]-mdi[i])/((pdi[i]+mdi[i])||1)};push(len);
    for(let i=len+1;i<n;i++){const up=h[i]-h[i-1],dn=l[i-1]-l[i];trS=trS-trS/len+tr[i];pS=pS-pS/len+(up>dn&&up>0?up:0);mS=mS-mS/len+(dn>up&&dn>0?dn:0);push(i)}
    let a=0;for(let i=len;i<2*len;i++)a+=dx[i];a/=len;ax[2*len-1]=a;for(let i=2*len;i<n;i++){a=(a*(len-1)+dx[i])/len;ax[i]=a}return{pdi,mdi,adx:ax}});
  const macd=(f,s,sg)=>g('macd'+f+'_'+s+'_'+sg,()=>{const ef=ema(c,f),es=ema(c,s),line=NaNs();for(let i=0;i<n;i++)line[i]=ef[i]-es[i];
    const sig=ema(line,sg,'macdsig'+f+'_'+s+'_'+sg),hist=NaNs();for(let i=0;i<n;i++)hist[i]=line[i]-sig[i];return{line,sig,hist}});
  const stoch=(k,d)=>g('st'+k+'_'+d,()=>{const K=NaNs();for(let i=k-1;i<n;i++){let hh=-Infinity,ll=Infinity;for(let j=i-k+1;j<=i;j++){hh=Math.max(hh,h[j]);ll=Math.min(ll,l[j])}K[i]=hh>ll?100*(c[i]-ll)/(hh-ll):50}return{K,D:sma(K,d,'stD'+k+'_'+d)}});
  const bb=(len,k)=>g('bb'+len+'_'+k,()=>{const m=sma(c,len),s=sdv(c,len),up=NaNs(),lo=NaNs();for(let i=0;i<n;i++){up[i]=m[i]+k*s[i];lo[i]=m[i]-k*s[i]}return{mid:m,up,lo}});
  const kc=(len,mult)=>g('kc'+len+'_'+mult,()=>{const m=ema(c,len),a=atr(len),up=NaNs(),lo=NaNs();for(let i=0;i<n;i++){up[i]=m[i]+mult*a[i];lo[i]=m[i]-mult*a[i]}return{mid:m,up,lo}});
  const hour=i=>new Date(t[i]).getUTCHours();
  const dayOf=i=>Math.floor(t[i]/DAY);
  const vwap=g.bind(null,'vwap',()=>{const out=NaNs();if(!hasVol)return out;let pv=0,vv=0,day=-1;for(let i=0;i<n;i++){const d=dayOf(i);if(d!==day){day=d;pv=0;vv=0}const tp=(h[i]+l[i]+c[i])/3;pv+=tp*v[i];vv+=v[i];out[i]=vv>0?pv/vv:NaN}return out});
  /* tendência de uma escala maior (f velas juntas), usando só barras já completas: no instante i vale a EMA até ao grupo anterior */
  const htfTrend=(f,fast,slow)=>g('htf'+f+'_'+fast+'_'+slow,()=>{const out=NaNs(),span=f*barMs,gid=i=>Math.floor(t[i]/span),closes=[],gIndex=new Map();
    for(let i=0;i<n;i++){const k=gid(i);if(!gIndex.has(k)){gIndex.set(k,closes.length);closes.push(c[i])}else closes[gIndex.get(k)]=c[i]}
    const emaArr=(a,len)=>{const r=new Array(a.length).fill(NaN);if(a.length<len)return r;let e=0;for(let i=0;i<len;i++)e+=a[i];e/=len;r[len-1]=e;const k=2/(len+1);for(let i=len;i<a.length;i++){e=a[i]*k+e*(1-k);r[i]=e}return r};
    const ef=emaArr(closes,fast),es=emaArr(closes,slow);
    for(let i=0;i<n;i++){const gi=gIndex.get(gid(i))-1;if(gi>=0&&Number.isFinite(ef[gi])&&Number.isFinite(es[gi]))out[i]=ef[gi]>es[gi]?1:-1}return out});
  /* pivôs confirmados com k velas de atraso (máximo/mínimo local em ±k): só se conhecem k velas depois */
  const pivots=k=>g('piv'+k,()=>{const ph=[],pl=[];for(let j=k;j<n-k;j++){let isH=true,isL=true;for(let q=j-k;q<=j+k;q++){if(q===j)continue;if(h[q]>=h[j])isH=false;if(l[q]<=l[j])isL=false}
      if(isH)ph.push({j,at:j+k,v:h[j]});if(isL)pl.push({j,at:j+k,v:l[j]})}return{ph,pl}});
  const lastTwo=(arr,i)=>{let lo=0,hi=arr.length-1,q=-1;while(lo<=hi){const m=(lo+hi)>>1;if(arr[m].at<=i){q=m;lo=m+1}else hi=m-1}return[q>=0?arr[q]:null,q>=1?arr[q-1]:null]};
  /* regressão logística em janela deslizante: treina só com dados já conhecidos (rótulo = sinal do retorno de H velas, só usado quando já passou) */
  const ml=hz=>g('ml'+hz,()=>{const p=NaNs(),R=250,W=3000,START=1000;if(n<START+hz+10)return p;
    const a14=atr(14),r14=rsi(14),m=macd(12,26,9),e20=ema(c,20),e50=ema(c,50);
    const feat=i=>{const x=[c[i]/c[i-1]-1,c[i]/c[i-3]-1,c[i]/c[i-6]-1,c[i]/c[i-12]-1,(c[i]-e20[i])/a14[i],(e20[i]-e50[i])/a14[i],r14[i]/100-.5,m.hist[i]/a14[i]];return x.every(Number.isFinite)?x:null};
    const X=new Array(n).fill(null);for(let i=50;i<n;i++)X[i]=feat(i);
    let w=null,mu=null,sd=null;
    for(let T=START;T<n;T++){
      if((T-START)%R===0){const rows=[];for(let j=Math.max(50,T-W);j<=T-hz;j++)if(X[j])rows.push([X[j],c[j+hz]>c[j]?1:0]);
        if(rows.length>300){const d=rows[0][0].length;mu=new Array(d).fill(0);sd=new Array(d).fill(0);for(const[x]of rows)x.forEach((q,k)=>mu[k]+=q/rows.length);for(const[x]of rows)x.forEach((q,k)=>sd[k]+=(q-mu[k])**2/rows.length);sd=sd.map(q=>Math.sqrt(q)||1);
          w=new Array(d+1).fill(0);for(let it=0;it<150;it++){const gr=new Array(d+1).fill(0);for(const[x,y]of rows){let z=w[d];for(let k=0;k<d;k++)z+=w[k]*(x[k]-mu[k])/sd[k];const q=1/(1+Math.exp(-z)),e=q-y;for(let k=0;k<d;k++)gr[k]+=e*(x[k]-mu[k])/sd[k];gr[d]+=e}
            for(let k=0;k<=d;k++)w[k]-=.3*(gr[k]/rows.length+(k<d?.01*w[k]:0))}}}
      if(w&&X[T]){const d=w.length-1;let z=w[d];for(let k=0;k<d;k++)z+=w[k]*(X[T][k]-mu[k])/sd[k];p[T]=1/(1+Math.exp(-z))}}
    return p});
  return{n,t,o,h,l,c,v,hasVol,barMs,ema,sma,sdv,atr,roc,don,rsi,adx,macd,stoch,bb,kc,hour,dayOf,vwap,htfTrend,pivots,lastTwo,ml};
}

/* ---------- estratégias ----------
   build(P,X) devolve {entry(i)->1|-1|0, exit?(i)->1|-1|0 (lado a fechar)}. edge: só entra na vela em que a condição passa a verdadeira. */
const sg=x=>x>0?1:x<0?-1:0;
const trendUp=(X,f,s)=>{const a=X.ema(X.c,f),b=X.ema(X.c,s);return i=>sg(a[i]-b[i])};
const LIB=[
 {id:'brk_ema',family:'A. Price action',name:'Rompimento + tendência EMA (regra atual do bot)',src:['G'],edge:false,ivs:['1h','4h','1d'],grid:{brk:[20,40]},
  build:(P,X)=>{const tu=trendUp(X,20,50),hi=X.don(P.brk,true),lo=X.don(P.brk,false);return{entry:i=>X.c[i]>hi[i]&&tu(i)>0?1:X.c[i]<lo[i]&&tu(i)<0?-1:0}}},
 {id:'don',family:'A. Price action',name:'Canal de Donchian (rompimento de N velas)',src:['S10'],edge:false,ivs:['1h','4h','1d'],grid:{N:[10,20,40,55],tr:[0,1]},
  build:(P,X)=>{const tu=trendUp(X,20,50),hi=X.don(P.N,true),lo=X.don(P.N,false);return{entry:i=>X.c[i]>hi[i]&&(!P.tr||tu(i)>0)?1:X.c[i]<lo[i]&&(!P.tr||tu(i)<0)?-1:0}}},
 {id:'emax',family:'B. Indicadores',name:'Cruzamento de médias móveis exponenciais',src:['S1','S3'],edge:false,ivs:['1h','4h','1d'],grid:{f:[10,20,50],s:[30,50,200]},valid:P=>P.f<P.s,
  build:(P,X)=>{const a=X.ema(X.c,P.f),b=X.ema(X.c,P.s),st=i=>sg(a[i]-b[i]);return{entry:i=>i>0&&st(i)>0&&st(i-1)<=0?1:i>0&&st(i)<0&&st(i-1)>=0?-1:0,exit:i=>st(i)>0?-1:st(i)<0?1:0}}},
 {id:'tsmom',family:'C. Quantitativas',name:'Momentum de série temporal (sinal do retorno de L dias)',src:['S1','S2'],edge:true,ivs:['4h','1d'],grid:{Ldays:[10,20,60,120]},
  build:(P,X)=>{const L=Math.max(2,Math.round(P.Ldays*DAY/X.barMs)),r1=X.roc(L),r2=X.roc(Math.max(1,Math.round(L/4)));
    return{entry:i=>r1[i]>0&&r2[i]>0?1:r1[i]<0&&r2[i]<0?-1:0,exit:i=>r1[i]>0?-1:r1[i]<0?1:0}}},
 {id:'macd',family:'B. Indicadores',name:'MACD: cruzamento do histograma',src:['G'],edge:false,ivs:['1h','4h','1d'],grid:{set:[[12,26,9],[8,17,9],[24,52,18]],filt:[0,1]},
  build:(P,X)=>{const m=X.macd(...P.set),e=X.ema(X.c,100);return{entry:i=>{if(i<1)return 0;const u=m.hist[i]>0&&m.hist[i-1]<=0,d=m.hist[i]<0&&m.hist[i-1]>=0;return u&&(!P.filt||X.c[i]>e[i])?1:d&&(!P.filt||X.c[i]<e[i])?-1:0},exit:i=>m.hist[i]>0?-1:m.hist[i]<0?1:0}}},
 {id:'adx',family:'B. Indicadores',name:'ADX: tendência só quando há força',src:['G'],edge:true,ivs:['1h','4h','1d'],grid:{thr:[20,25,30]},
  build:(P,X)=>{const a=X.adx(14),e=X.ema(X.c,20);return{entry:i=>a.adx[i]>P.thr&&a.pdi[i]>a.mdi[i]&&X.c[i]>e[i]?1:a.adx[i]>P.thr&&a.pdi[i]<a.mdi[i]&&X.c[i]<e[i]?-1:0,exit:i=>a.pdi[i]<a.mdi[i]?1:a.pdi[i]>a.mdi[i]?-1:0}}},
 {id:'rsi',family:'B. Indicadores',name:'RSI: reversão em extremos',src:['S6'],edge:true,ivs:['1h','4h','1d'],grid:{set:[[2,10,90],[2,5,95],[3,15,85],[14,30,70],[14,20,80]],filt:[0,1]},
  build:(P,X)=>{const[len,lo,hi]=P.set,r=X.rsi(len),e=X.ema(X.c,100);return{entry:i=>r[i]<lo&&(!P.filt||X.c[i]>e[i])?1:r[i]>hi&&(!P.filt||X.c[i]<e[i])?-1:0,exit:i=>r[i]>50?1:r[i]<50?-1:0}}},
 {id:'bbrev',family:'B. Indicadores',name:'Bandas de Bollinger: reversão à média',src:['S5'],edge:true,ivs:['1h','4h','1d'],grid:{k:[2,2.5,3],filt:[0,1]},
  build:(P,X)=>{const b=X.bb(20,P.k),a=X.adx(14);return{entry:i=>{if(P.filt&&!(a.adx[i]<25))return 0;return X.c[i]<b.lo[i]?1:X.c[i]>b.up[i]?-1:0},exit:i=>X.c[i]>b.mid[i]?1:X.c[i]<b.mid[i]?-1:0}}},
 {id:'bbbrk',family:'B. Indicadores',name:'Bandas de Bollinger: rompimento a favor da tendência',src:['S5'],edge:true,ivs:['1h','4h','1d'],grid:{k:[2,2.5],tr:[0,1]},
  build:(P,X)=>{const b=X.bb(20,P.k),tu=trendUp(X,20,50);return{entry:i=>X.c[i]>b.up[i]&&(!P.tr||tu(i)>0)?1:X.c[i]<b.lo[i]&&(!P.tr||tu(i)<0)?-1:0,exit:i=>X.c[i]<b.mid[i]?1:X.c[i]>b.mid[i]?-1:0}}},
 {id:'stoch',family:'B. Indicadores',name:'Estocástico: cruzamento em zona extrema',src:['G'],edge:false,ivs:['1h','4h','1d'],grid:{lo:[20,10],filt:[0,1]},
  build:(P,X)=>{const s=X.stoch(14,3),e=X.ema(X.c,100);return{entry:i=>{if(i<1)return 0;const up=s.K[i-1]<s.D[i-1]&&s.K[i]>=s.D[i]&&s.K[i]<P.lo,dn=s.K[i-1]>s.D[i-1]&&s.K[i]<=s.D[i]&&s.K[i]>100-P.lo;return up&&(!P.filt||X.c[i]>e[i])?1:dn&&(!P.filt||X.c[i]<e[i])?-1:0},exit:i=>s.K[i]>50?1:s.K[i]<50?-1:0}}},
 {id:'squeeze',family:'A. Price action',name:'Compressão de volatilidade (Bollinger dentro de Keltner) e libertação',src:['G'],edge:false,ivs:['1h','4h','1d'],grid:{kcm:[1,1.5]},
  build:(P,X)=>{const b=X.bb(20,2),k=X.kc(20,P.kcm),m=X.sma(X.c,20),sq=i=>b.up[i]<k.up[i]&&b.lo[i]>k.lo[i];return{entry:i=>i>0&&sq(i-1)&&!sq(i)?sg(X.c[i]-m[i]):0}}},
 {id:'vwap',family:'B. Indicadores',name:'VWAP diário ancorado às 00:00 UTC: reversão',src:['G'],edge:true,ivs:['1h','4h'],needVol:true,grid:{k:[1.5,2,3]},
  build:(P,X)=>{const w=X.vwap(),a=X.atr(14);return{entry:i=>{const d=(X.c[i]-w[i])/a[i];return d<-P.k?1:d>P.k?-1:0},exit:i=>{const d=X.c[i]-w[i];return d>0?1:d<0?-1:0}}}},
 {id:'pbk',family:'A. Price action',name:'Pullback à média rápida dentro da tendência',src:['G'],edge:true,ivs:['1h','4h','1d'],grid:{set:[[20,50],[20,100],[50,200]]},
  build:(P,X)=>{const f=X.ema(X.c,P.set[0]),s=X.ema(X.c,P.set[1]);return{entry:i=>f[i]>s[i]&&X.l[i]<=f[i]&&X.c[i]>f[i]?1:f[i]<s[i]&&X.h[i]>=f[i]&&X.c[i]<f[i]?-1:0}}},
 {id:'nr',family:'A. Price action',name:'Barra de intervalo estreito (NR4/NR7) e rompimento',src:['G'],edge:false,ivs:['1h','4h','1d'],grid:{N:[4,7],tr:[0,1]},
  build:(P,X)=>{const tu=trendUp(X,20,50),rg=X.h.map((v,i)=>v-X.l[i]);return{entry:i=>{if(i<P.N+1)return 0;let nr=true;for(let j=i-P.N;j<i-1;j++)if(rg[j]<=rg[i-1]){nr=false;break}
    if(!nr)return 0;return X.c[i]>X.h[i-1]&&(!P.tr||tu(i)>0)?1:X.c[i]<X.l[i-1]&&(!P.tr||tu(i)<0)?-1:0}}}},
 {id:'candle',family:'A. Price action',name:'Padrões de velas (engolfo e pin bar) com filtro de tendência',src:['G'],edge:false,ivs:['1h','4h','1d'],grid:{pat:['engulf','pin'],filt:[0,1]},
  build:(P,X)=>{const e=X.ema(X.c,50);return{entry:i=>{if(i<1)return 0;const o=X.o,c=X.c,h=X.h,l=X.l;let u=false,d=false;
    if(P.pat==='engulf'){u=c[i-1]<o[i-1]&&c[i]>o[i]&&c[i]>=o[i-1]&&o[i]<=c[i-1];d=c[i-1]>o[i-1]&&c[i]<o[i]&&c[i]<=o[i-1]&&o[i]>=c[i-1]}
    else{const body=Math.abs(c[i]-o[i])||1e-12,lw=Math.min(c[i],o[i])-l[i],uw=h[i]-Math.max(c[i],o[i]),rng=h[i]-l[i]||1e-12;u=lw>2*body&&lw>2*uw&&(c[i]-l[i])/rng>.66;d=uw>2*body&&uw>2*lw&&(h[i]-c[i])/rng>.66}
    return u&&(!P.filt||c[i]>e[i])?1:d&&(!P.filt||c[i]<e[i])?-1:0}}}},
 {id:'fbo',family:'A. Price action',name:'Falsa rutura (varrimento de liquidez) e reversão',src:['G'],edge:false,ivs:['1h','4h','1d'],grid:{N:[20,40]},
  build:(P,X)=>{const hi=X.don(P.N,true),lo=X.don(P.N,false);return{entry:i=>X.h[i]>hi[i]&&X.c[i]<hi[i]?-1:X.l[i]<lo[i]&&X.c[i]>lo[i]?1:0}}},
 {id:'swing',family:'A. Price action',name:'Estrutura de máximos e mínimos (pivôs) e rompimento do último pivô',src:['G'],edge:true,ivs:['1h','4h','1d'],grid:{k:[2,3]},
  build:(P,X)=>{const pv=X.pivots(P.k);return{entry:i=>{const[h1,h2]=X.lastTwo(pv.ph,i),[l1,l2]=X.lastTwo(pv.pl,i);if(!h1||!h2||!l1||!l2)return 0;
    return h1.v>h2.v&&l1.v>l2.v&&X.c[i]>h1.v?1:h1.v<h2.v&&l1.v<l2.v&&X.c[i]<l1.v?-1:0}}}},
 {id:'zrev',family:'C. Quantitativas',name:'Reversão do retorno de N velas (z-score)',src:['G'],edge:true,ivs:['1h','4h','1d'],grid:{N:[6,12,24],thr:[2,2.5]},
  build:(P,X)=>{const r=X.roc(P.N),r1=X.c.map((v,i)=>i?v/X.c[i-1]-1:0),s=X.sdv(r1,100,'r1sd');return{entry:i=>{const z=r[i]/(s[i]*Math.sqrt(P.N));return z<-P.thr?1:z>P.thr?-1:0},exit:i=>{const z=r[i];return z>0?1:z<0?-1:0}}}},
 {id:'zmom',family:'C. Quantitativas',name:'Continuação do retorno de N velas (z-score)',src:['S1'],edge:true,ivs:['1h','4h','1d'],grid:{N:[6,12,24],thr:[2,2.5]},
  build:(P,X)=>{const r=X.roc(P.N),r1=X.c.map((v,i)=>i?v/X.c[i-1]-1:0),s=X.sdv(r1,100,'r1sd');return{entry:i=>{const z=r[i]/(s[i]*Math.sqrt(P.N));return z>P.thr?1:z<-P.thr?-1:0},exit:i=>r[i]>0?-1:r[i]<0?1:0}}},
 {id:'thrmom',family:'C. Quantitativas',name:'Impulso de uma vela (k×ATR) a favor da tendência',src:['G'],edge:false,ivs:['1h','4h','1d'],grid:{k:[1,1.5,2]},
  build:(P,X)=>{const tu=trendUp(X,20,50),a=X.atr(14);return{entry:i=>{if(i<1)return 0;const m=(X.c[i]-X.c[i-1])/a[i];return m>P.k&&tu(i)>0?1:m<-P.k&&tu(i)<0?-1:0}}}},
 {id:'thrfade',family:'C. Quantitativas',name:'Compra da queda (k×ATR) a favor da tendência maior',src:['G'],edge:false,ivs:['1h','4h','1d'],grid:{k:[1.5,2,3]},
  build:(P,X)=>{const tu=trendUp(X,20,50),a=X.atr(14);return{entry:i=>{if(i<1)return 0;const m=(X.c[i]-X.c[i-1])/a[i];return m<-P.k&&tu(i)>0?1:m>P.k&&tu(i)<0?-1:0}}}},
 {id:'regime',family:'E. Avançadas',name:'Mudança de regime por ADX: tendência (EMA 20/50) ou reversão (Bollinger)',src:['G'],edge:false,ivs:['1h','4h','1d'],grid:{thr:[20,25,30]},
  build:(P,X)=>{const a=X.adx(14),ef=X.ema(X.c,20),es=X.ema(X.c,50),b=X.bb(20,2);return{entry:i=>{if(i<1)return 0;
    if(a.adx[i]>=P.thr){const s=sg(ef[i]-es[i]),sp=sg(ef[i-1]-es[i-1]);return s!==sp?s:0}
    return X.c[i]<b.lo[i]&&X.c[i-1]>=b.lo[i-1]?1:X.c[i]>b.up[i]&&X.c[i-1]<=b.up[i-1]?-1:0}}}},
 {id:'ens',family:'E. Avançadas',name:'Pontuação de sinais: EMA, momentum, MACD e RSI',src:['S1'],edge:true,ivs:['4h','1d'],grid:{Ldays:[20,60,120],th:[3,4]},
  build:(P,X)=>{const tu=trendUp(X,20,50),L=Math.max(2,Math.round(P.Ldays*DAY/X.barMs)),r=X.roc(L),m=X.macd(12,26,9),rs=X.rsi(14);
    const sc=i=>tu(i)+sg(r[i])+sg(m.hist[i])+sg(rs[i]-50);return{entry:i=>sc(i)>=P.th?1:sc(i)<=-P.th?-1:0,exit:i=>sc(i)>0?-1:sc(i)<0?1:0}}},
 {id:'mtf',family:'E. Avançadas',name:'Vários horizontes: tendência da escala maior e pullback na escala menor',src:['G'],edge:true,ivs:['1h','4h','1d'],grid:{f:[4,6],fast:[20,50]},
  build:(P,X)=>{const T=X.htfTrend(P.f,20,50),e=X.ema(X.c,P.fast);return{entry:i=>T[i]>0&&X.l[i]<=e[i]&&X.c[i]>e[i]?1:T[i]<0&&X.h[i]>=e[i]&&X.c[i]<e[i]?-1:0}}},
 {id:'asian',family:'D. Sessões',name:'Rompimento do intervalo da sessão asiática (00-08 UTC) na abertura de Londres',src:['S8'],edge:false,ivs:['1h','4h'],cfg:{flatEOD:true},grid:{minR:[0,1]},
  build:(P,X)=>{const a=X.atr(14);return{entry:i=>{const hr=X.hour(i);if(hr<8||hr>=12)return 0;const d=X.dayOf(i);let hi=-Infinity,lo=Infinity,cnt=0;for(let j=i-1;j>=0&&X.dayOf(j)===d;j--){const hj=X.hour(j);if(hj<8){hi=Math.max(hi,X.h[j]);lo=Math.min(lo,X.l[j]);cnt++}}
    if(!cnt||(hi-lo)<P.minR*a[i])return 0;return X.c[i]>hi?1:X.c[i]<lo?-1:0}}}},
 {id:'orb',family:'D. Sessões',name:'Rompimento do 1.º intervalo da sessão americana (13-14 UTC)',src:['G'],edge:false,ivs:['1h'],cfg:{flatEOD:true},grid:{x:[0]},
  build:(P,X)=>({entry:i=>{const hr=X.hour(i);if(hr<14||hr>=18)return 0;const d=X.dayOf(i);let hi=NaN,lo=NaN;for(let j=i-1;j>=0&&X.dayOf(j)===d;j--)if(X.hour(j)===13){hi=X.h[j];lo=X.l[j];break}
    if(!Number.isFinite(hi))return 0;return X.c[i]>hi?1:X.c[i]<lo?-1:0}})},
 {id:'imom',family:'D. Sessões',name:'Momentum intradiário: movimento desde a abertura do dia continua até ao fecho',src:['S7'],edge:true,ivs:['1h','4h'],cfg:{flatEOD:true},grid:{Hh:[4,8,12],k:[.5,1]},
  build:(P,X)=>{const a=X.atr(14);return{entry:i=>{const end=X.hour(i)+X.barMs/H;if(end!==P.Hh)return 0;const d=X.dayOf(i);let j=i;while(j>0&&X.dayOf(j-1)===d)j--;const mv=X.c[i]-X.o[j];return mv>P.k*a[i]?1:mv<-P.k*a[i]?-1:0}}}},
 {id:'ml',family:'E. Avançadas',name:'Regressão logística em janela deslizante (8 variáveis), previsão do sinal de H velas',src:['G'],edge:true,ivs:['1h','4h'],grid:{hz:[6,12],thr:[.55,.6]},
  build:(P,X)=>{const p=X.ml(P.hz);return{entry:i=>p[i]>P.thr?1:p[i]<1-P.thr?-1:0}}},
 {id:'long200',family:'C. Quantitativas',name:'Referência: só comprado acima da EMA longa (filtro de tendência)',src:['S2'],edge:true,ivs:['4h','1d'],grid:{N:[100,200]},
  build:(P,X)=>{const e=X.ema(X.c,P.N);return{entry:i=>X.c[i]>e[i]?1:0,exit:i=>X.c[i]<e[i]?1:0}}},
];

/* ---------- saídas (gestão de posição) ---------- */
const EXITS={
  A:{label:'stop 2×ATR, alvo 3×ATR',p:{stopATR:2,tpATR:3},holdH:48},
  B:{label:'stop 2×ATR, alvo 1,5×ATR',p:{stopATR:2,tpATR:1.5},holdH:24},
  C:{label:'stop 3×ATR, stop móvel 3×ATR',p:{stopATR:3,tpATR:0,trailATR:3},holdH:480},
  E:{label:'stop 3×ATR, saída por sinal contrário',p:{stopATR:3,tpATR:0},holdH:480,sigExit:true},
  F:{label:'stop 2×ATR, break-even a 1,5×ATR, alvo 3×ATR',p:{stopATR:2,tpATR:3,beATR:1.5},holdH:96},
};
const BASE={...D.DEFAULTS,start:10000,ddStop:.20,dayLoss:.05};   // = MACRO.BASE do Macro Desk

function product(grid){const keys=Object.keys(grid);let out=[{}];for(const k of keys){const nx=[];for(const o of out)for(const v of grid[k])nx.push({...o,[k]:v});out=nx}return out}
const pkey=P=>Object.entries(P).map(([k,v])=>k+'='+(Array.isArray(v)?v.join('/'):v)).join(',');
/* expande a biblioteca em configurações: estratégia × parâmetros × saída, para um tamanho de vela */
function configs(iv,{only=null,exits=Object.keys(EXITS)}={}){
  const out=[];
  for(const S of LIB){if(only&&!only.includes(S.id))continue;if(!S.ivs.includes(iv))continue;
    for(const P of product(S.grid)){if(S.valid&&!S.valid(P))continue;
      for(const e of exits)out.push({id:`${S.id}[${pkey(P)}]/${e}`,sid:S.id,P,exit:e,iv})}}
  return out;
}
const byId=Object.fromEntries(LIB.map(s=>[s.id,s]));
/* configuração do motor para uma config do laboratório */
function cfgFor(conf,barMs,over={}){
  const S=byId[conf.sid],E=EXITS[conf.exit];
  const hold=Math.max(3,Math.round(E.holdH*H/barMs));
  return{...BASE,...E.p,maxHoldBars:hold,...(S.cfg||{}),...over};
}
/* sinal para o motor (opts.signalAt): usa indicadores pré-calculados por mercado e aplica a mesma regra de custo por risco da produção */
const ctxCache=new WeakMap();
function ctxOf(bars){let c=ctxCache.get(bars);if(!c){c=makeCtx(bars);ctxCache.set(bars,c)}return c}
function signalAtFor(conf,cfg){
  const S=byId[conf.sid],E=EXITS[conf.exit],perKey={},minATR=D.minATRpct(cfg),maxATR=cfg.maxATRpct;
  return(k,i,bars)=>{
    let st=perKey[k];if(!st||st.bars!==bars){const X=ctxOf(bars);st=perKey[k]={bars,X,fn:S.needVol&&!X.hasVol?{entry:()=>0}:S.build(conf.P,X),a:X.atr(14)}}
    const a=st.a[i];if(!(a>0))return{dir:'wait',why:'aquecimento'};
    const ex=E.sigExit&&st.fn.exit?st.fn.exit(i):0,base={atr:a,exit:ex||undefined};
    const raw=st.fn.entry(i);if(!raw)return{dir:'flat',why:'sem sinal',...base};
    if(S.edge&&i>0&&st.fn.entry(i-1)===raw)return{dir:'flat',why:'sinal já ativo',...base};
    const ap=a/bars[i].c;
    if(ap<minATR)return{dir:'flat',why:'custo por trade acima do máximo (filtro de custo)',...base};
    if(ap>maxATR)return{dir:'flat',why:'volatilidade extrema',...base};
    return{dir:raw>0?'long':'short',why:'sinal',...base};
  };
}
const api={makeCtx,LIB,EXITS,BASE,configs,cfgFor,signalAtFor,byId,pkey};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DLAB=api;
})(typeof window!=='undefined'?window:globalThis);
