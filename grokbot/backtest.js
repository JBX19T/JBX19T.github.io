/* DOLLOS · TESTE HISTÓRICO do Macro Desk (motor puro).
   Corre as MESMAS regras do Macro Desk ao vivo (strategy.js) sobre velas passadas, com a mesma conta, o mesmo risco por trade,
   o mesmo limite de alavancagem, os mesmos custos e as mesmas paragens de proteção (-20% desde o máximo, -5% num dia).
   Convenções (conservadoras, iguais à execução real):
   - o sinal nasce ao FECHO de uma vela; a ordem a mercado só pode ser enviada depois, por isso enche à ABERTURA da vela seguinte,
     com taxa (costBps) e slippage (slipBps) contra nós;
   - stop e alvo avaliam-se com o máximo/mínimo de cada vela; se o stop e o alvo cabem na mesma vela, conta o stop;
   - o stop é uma ordem de gatilho a mercado: saltos (gap) enchem à abertura e pagam taxa taker + slippage de stop (slipStopBps);
   - o alvo é uma ordem limitada na corretora (tpMode:'limit', como a Hyperliquid por omissão): só enche se o preço o ULTRAPASSAR
     (tocar não chega) e paga taxa maker; com tpMode:'market' (HL_TP_TRIGGER=1) enche ao tocar e paga taker + slippage;
   - saídas por tempo e paragens fecham a mercado (taker + slippage).
   Ordens limitadas (exec:'maker'): a entrada fica ao preço de fecho da vela do sinal durante UMA vela e só enche se o preço passar
   para lá dele (tocar não chega).
   Funding (opcional): cobrado ou recebido de hora a hora sobre o valor da posição, com as taxas reais de cada hora. */
(function(root){
const D=(typeof require!=='undefined'&&typeof module!=='undefined'&&module.exports)?require('./strategy.js'):root.DSTRAT;
const WIN=200;   // o Macro Desk ao vivo guarda as últimas 200 velas
const H=36e5;

function prepCfg(cfgIn,override,strategy){
  let cfg={...cfgIn};
  if(strategy)cfg=D.withStrategy(cfg,strategy);
  cfg={...cfg,...(override||{})};
  return cfg;   // o filtro de volatilidade/custo é calculado por strategy.js a partir da própria configuração
}
/* funding: { GOLD:[[t,taxa],...] } -> procura por hora; nas horas sem dado usa a média das conhecidas */
function fundingIndex(fund){
  const out={};
  for(const [k,pts] of Object.entries(fund||{})){
    if(!pts||!pts.length)continue;const m=new Map();let s=0;
    for(const [t,r] of pts){m.set(Math.round(t/H),r);s+=r}
    out[k]={m,avg:s/pts.length};
  }
  return out;
}

/* barsByKey: { GOLD:[{t,o,h,l,c},...], SPX:[...], EURUSD:[...] } (t em ms, ordenado)
   opts: { override, strategy, nMarkets, from, to (só negoceia entre from e to; as velas anteriores servem de aquecimento), funding } */
function simulate(barsByKey,cfgIn,opts={}){
  const cfg=prepCfg(cfgIn,opts.override,opts.strategy),st=D.make(cfg,opts.nMarkets||3);
  const maker=cfg.exec==='maker',taker=cfg.costBps/1e4,makerFee=(cfg.makerBps??3)/1e4;
  const slip=(cfg.slipBps||0)/1e4,slipStop=(cfg.slipStopBps??cfg.slipBps??0)/1e4,tpLimit=cfg.tpMode!=='market';
  const barMs=cfg.barMs||(()=>{for(const k of Object.keys(barsByKey)){const b=barsByKey[k];if(b&&b.length>2){const d=[];for(let i=1;i<Math.min(b.length,60);i++)d.push(b[i].t-b[i-1].t);d.sort((x,y)=>x-y);return d[d.length>>1]}}return 36e5})();
  const FI=fundingIndex(opts.funding);
  const sigAt=typeof opts.signalAt==='function'?opts.signalAt:null;   // gancho do laboratório: sinal calculado sobre indicadores pré-calculados (k,i,barras) em vez de st.signal(janela)
  const xq={};let expoBars=0,slots=0;
  // diagnóstico: para cada vela avaliada, porque entrou ou não entrou (contagens; opts.log guarda também o detalhe por vela)
  const stNF=D.make({...cfg,minATRpct:0},opts.nMarkets||3);   // mesmas regras sem o filtro de custo: mostra quantos sinais ele bloqueou
  const diag={bars:0,reasons:{},wouldBe:{long:0,short:0},accepted:{long:0,short:0},minATRpct:D.minATRpct(cfg),atr:{},log:opts.log?[]:null};
  const why1=(r,n=1)=>{diag.reasons[r]=(diag.reasons[r]||0)+n};
  const category=w=>/^velas \d/.test(w)?'aquecimento (velas insuficientes)':/^custo/.test(w)?'filtro de custo (custo por trade acima do máximo em R)':/muito baixa/.test(w)?'volatilidade muito baixa':/extrema/.test(w)?'volatilidade extrema':/sem rompimento/.test(w)?'sem rompimento':/cruzamento/.test(w)?'sem cruzamento novo':/perto da média/.test(w)?'perto da média':/^RSI2/.test(w)?'RSI2 fora dos extremos':/sem variação/.test(w)?'sem variação':'outro: '+w;
  const keys=Object.keys(barsByKey).filter(k=>barsByKey[k]&&barsByKey[k].length);
  const ix={},times=new Set();
  for(const k of keys){ix[k]=new Map();barsByKey[k].forEach((b,i)=>{ix[k].set(b.t,i);times.add(b.t)})}
  const timeline=[...times].sort((a,b)=>a-b);
  let cash=cfg.start,peak=cash,top=cash,maxDD=0,halted=null,dayKey='',dayEq=cash,t0=null,tEnd=0;
  const pos={},pend={},qe={},last={},trades=[],curve=[],halts={dd:0,day:0},orders={signals:0,placed:0,filled:0};let firstHalt=null;
  const unreal=(p,px)=>p.side*(px-p.entry)/p.entry*p.notional;
  const eqNow=()=>{let e=cash;for(const k in pos)e+=unreal(pos[k],last[k])-pos[k].fund;return e};
  // pxRaw: preço de mercado da saída; o slippage piora-o e a taxa sai do resultado. Entrada: p.entry já inclui taxa e slippage.
  const closeAt=(k,pxRaw,t,why,fee=taker,slipOut=slip)=>{const p=pos[k],px=pxRaw*(1-p.side*slipOut),fees=p.notional*(p.fee+fee),slipUsd=p.notional*(p.slipIn+slipOut),
    pnl=unreal(p,px)-p.notional*fee-p.fund;cash+=pnl;
    trades.push({k,side:p.side,o:p.o,c:t,en:p.entry,ex:px,nt:p.notional,pnl,why,bars:p.held,risk:p.notional*p.sf,atrPct:p.atr>0?p.atr/p.entry:null,costUsd:fees+slipUsd+p.fund,fees,slipUsd,fund:p.fund});delete pos[k]};
  const flatten=(t,why)=>{for(const k of Object.keys(pos))closeAt(k,last[k],t,why);for(const k of Object.keys(pend))delete pend[k];for(const k of Object.keys(qe))delete qe[k]};
  const openPos=(k,side,refPx,fee,slipIn,o)=>{const entry=refPx*(1+side*(fee+slipIn));
    pos[k]={side,entry,fee,slipIn,notional:o.notional,stop:0,tp:null,o:o.t,held:0,sf:o.stopDist/entry,fund:0,fundH:Math.floor(o.t/H),atr:o.atr};
    const p=pos[k];p.stop=entry-side*o.stopDist;if(o.tpDist>0)p.tp=entry+side*o.tpDist;p.best=entry;return p};

  for(const t of timeline){
    if(opts.to!=null&&t>=opts.to)break;
    if(opts.from!=null&&t<opts.from){for(const k of keys){const i=ix[k].get(t);if(i!=null)last[k]=barsByKey[k][i].c}continue}
    if(t0==null)t0=t;tEnd=t;
    // 0) funding de cada hora completa desde a última vela
    for(const k in pos){const p=pos[k],f=FI[k];const hNow=Math.floor(t/H);
      if(f)for(let h=p.fundH+1;h<=hNow;h++){const r=f.m.has(h)?f.m.get(h):f.avg;p.fund+=p.side*r*p.notional}
      p.fundH=hNow}
    // 1) ordens limitadas pendentes (só no modo maker): enchem se o preço passar para lá do limite nesta vela
    for(const k of Object.keys(pend)){
      const i=ix[k].get(t);if(i==null)continue;
      const b=barsByKey[k][i],o=pend[k];delete pend[k];
      const long=o.side>0;if(!(long?b.l<o.limit:b.h>o.limit))continue;   // não encheu: cancela
      orders.filled++;const p=openPos(k,o.side,o.limit,makerFee,0,{...o,t});
      p.fresh=true;   // na vela em que enche só pode sair pelo stop (não se sabe a ordem dos movimentos)
    }
    // 1a) saídas por sinal (só com o gancho do laboratório): fecham à abertura desta vela, a mercado
    for(const k of Object.keys(xq)){const i=ix[k].get(t);if(i==null)continue;delete xq[k];if(pos[k])closeAt(k,barsByKey[k][i].o,t,'sinal de saída',taker,slip)}
    // 1b) ordens a mercado geradas ao fecho da vela anterior: enchem à abertura desta vela, com taxa e slippage
    for(const k of Object.keys(qe)){
      const i=ix[k].get(t);if(i==null)continue;
      const o=qe[k];delete qe[k];if(halted||pos[k]){why1('ordem descartada ao abrir (proteção ativa ou posição aberta)');continue}
      const b=barsByKey[k][i],stopDist=cfg.stopATR*o.atr,tpDist=cfg.tpATR*o.atr;
      const notional=st.sizeFor(eqNow(),b.o*(1+o.side*(taker+slip)),stopDist);if(!(notional>1)){why1('ordem não enviada (tamanho da posição abaixo de $1)');continue}
      orders.placed++;orders.filled++;
      openPos(k,o.side,b.o,taker,slip,{notional,stopDist,tpDist,t,atr:o.atr});
    }
    // 2) saídas (stop, alvo, tempo) com a vela deste instante
    for(const k of keys){
      const i=ix[k].get(t);if(i==null)continue;
      const b=barsByKey[k][i];last[k]=b.c;const p=pos[k];if(!p)continue;
      const long=p.side>0,stopHit=long?b.l<=p.stop:b.h>=p.stop;
      if(p.fresh){p.fresh=false;if(stopHit)closeAt(k,p.stop,t,'stop-loss',taker,slipStop);continue}
      p.held++;
      const tpHit=p.tp!=null&&(tpLimit?(long?b.h>p.tp:b.l<p.tp):(long?b.h>=p.tp:b.l<=p.tp));
      if(stopHit)closeAt(k,long?Math.min(p.stop,b.o):Math.max(p.stop,b.o),t,'stop-loss',taker,slipStop);
      else if(tpHit)tpLimit?closeAt(k,p.tp,t,'take-profit',makerFee,0):closeAt(k,long?Math.max(p.tp,b.o):Math.min(p.tp,b.o),t,'take-profit',taker,slipStop);
      else if(p.held>=cfg.maxHoldBars)closeAt(k,b.c,t,'time-stop');
      if(pos[k])pos[k].stop=st.trailStop(pos[k],b);   // stop móvel: só vale a partir da vela seguinte
    }
    slots+=keys.length;for(const k of keys)if(pos[k])expoBars++;
    // 2b) day trade: à última vela do dia UTC fecha tudo a mercado (nunca dorme com posição)
    if(st.isEOD(t+barMs)){for(const k of Object.keys(pos)){const i=ix[k].get(t);if(i!=null)closeAt(k,barsByKey[k][i].c,t,'fim do dia')}for(const k of Object.keys(pend))delete pend[k];for(const k of Object.keys(qe))delete qe[k]}
    // 3) proteção de capital (como no desk: -20% desde o máximo fecha tudo; -5% num dia pausa até amanhã)
    let e=eqNow();const dk=new Date(t).toISOString().slice(0,10);
    if(dk!==dayKey){dayKey=dk;dayEq=e;if(halted){if(halted.kind==='dd')peak=e;halted=null}}   // retoma no dia seguinte (equivale a tocar em RETOMAR)
    if(e>peak)peak=e;if(e>top)top=e;maxDD=Math.max(maxDD,1-e/top);
    if(!halted){
      if(e<=peak*(1-cfg.ddStop)){flatten(t,'kill-switch');halted={kind:'dd'};halts.dd++;e=eqNow();if(!firstHalt)firstHalt={t,equity:e,trades:trades.length}}
      else if(e<=dayEq*(1-cfg.dayLoss)){flatten(t,'limite diário');halted={kind:'day'};halts.day++;e=eqNow()}
    }
    // 4) entradas
    for(const k of keys){
      const i=ix[k].get(t);if(i==null)continue;
      if(sigAt&&pos[k]&&!xq[k]){const s2=sigAt(k,i,barsByKey[k]);if(s2&&s2.exit===pos[k].side)xq[k]=true}
      const note=(dir,w,extra)=>{if(diag.log&&diag.log.length<50000)diag.log.push({t,k,dir,why:w,...extra})};
      if(halted){why1('proteção de capital ativa (sem novas entradas)');note('flat','proteção de capital ativa');continue}
      if(pos[k]||pend[k]||qe[k]){why1('posição ou ordem já aberta neste mercado');continue}
      if(st.noEntry(t+barMs)){why1('janela sem entradas (day trade: últimas horas do dia)');note('flat','janela sem entradas');continue}
      const b=barsByKey[k][i],sig=sigAt?sigAt(k,i,barsByKey[k]):st.signal(barsByKey[k].slice(Math.max(0,i-WIN+1),i+1));
      diag.bars++;
      const ap=sig.atr>0?sig.atr/b.c:null;if(ap!=null)(diag.atr[k]??=[]).push(ap);
      if(sig.dir!=='long'&&sig.dir!=='short'){
        const cat=category(sig.why||'');why1(cat);
        if(!sigAt&&/^filtro de custo|muito baixa/.test(cat)){const nf=stNF.signal(barsByKey[k].slice(Math.max(0,i-WIN+1),i+1));if(nf.dir==='long'||nf.dir==='short')diag.wouldBe[nf.dir]++}
        note(sig.dir,sig.why,{atrPct:ap});continue;
      }
      diag.accepted[sig.dir]++;orders.signals++;note(sig.dir,sig.why,{atrPct:ap,action:'sinal aceite'});
      const side=sig.dir==='long'?1:-1,stopDist=cfg.stopATR*sig.atr,tpDist=cfg.tpATR*sig.atr;
      if(maker){const notional=st.sizeFor(eqNow(),b.c,stopDist);if(!(notional>1)){why1('ordem não enviada (tamanho da posição abaixo de $1)');continue}pend[k]={side,limit:b.c,notional,stopDist,tpDist,t,atr:sig.atr};orders.placed++}
      else qe[k]={side,atr:sig.atr};   // ordem a mercado: só pode ser enviada depois do fecho; enche à abertura seguinte
    }
    curve.push([t,eqNow()]);
  }
  const open=Object.keys(pos).length;flatten(tEnd,'fim do teste');
  const bh={},bars={};
  for(const k of keys){const b=barsByKey[k].filter(x=>(opts.from==null||x.t>=opts.from)&&(opts.to==null||x.t<opts.to));bars[k]=b.length;bh[k]=b.length>1?b[b.length-1].c/b[0].o-1:0}
  const pc=(a,q)=>a[Math.min(a.length-1,Math.floor(q*a.length))];
  const atrSum={};for(const k of Object.keys(diag.atr)){const a=diag.atr[k].slice().sort((x,y)=>x-y);atrSum[k]={n:a.length,p10:pc(a,.1),p50:pc(a,.5),p90:pc(a,.9),max:a[a.length-1],aboveMin:a.filter(x=>x>=diag.minATRpct).length/a.length}}
  diag.atr=atrSum;
  return{cfg,trades,curve,halts,maxDD,openAtEnd:open,finalCash:cash,firstHalt,bh,start:t0||0,end:tEnd,bars,orders,diag,exposure:slots?expoBars/slots:0};
}

const sum=a=>a.reduce((s,x)=>s+x.pnl,0);
function summarize(res){
  const tr=res.trades,n=tr.length,w=tr.filter(t=>t.pnl>0),l=tr.filter(t=>t.pnl<=0);
  const gw=sum(w),gl=-sum(l),net=sum(tr),start=res.cfg.start;
  const group=(f)=>{const o={};for(const t of tr){const g=f(t);(o[g]??={n:0,wins:0,pnl:0});o[g].n++;if(t.pnl>0)o[g].wins++;o[g].pnl+=t.pnl}return o};
  const final=res.finalCash;
  const pts=res.curve.length>140?res.curve.filter((_,i)=>i%Math.ceil(res.curve.length/140)===0):res.curve;
  // em "R" (múltiplos do risco de cada trade): mostra se a regra perde por si ou só por causa dos custos (taxas + funding)
  const rt=tr.filter(t=>t.risk>0),mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const rs=rt.map(t=>t.pnl/t.risk),avgR=mean(rs),avgGrossR=mean(rt.map(t=>(t.pnl+t.costUsd)/t.risk));
  const sdR=rs.length>1?Math.sqrt(rs.reduce((s,x)=>s+(x-avgR)**2,0)/(rs.length-1)):null;
  const tR=sdR>0?avgR/(sdR/Math.sqrt(rs.length)):null;   // quantos "erros padrão" a média está acima de zero (2 = dificilmente é sorte)
  const rStats={avgR,avgGrossR,sdR,tR,costR:avgR==null?null:avgGrossR-avgR,breakEvenWin:res.cfg.tpATR>0?res.cfg.stopATR/(res.cfg.stopATR+res.cfg.tpATR):null};
  return{...rStats,n,wins:w.length,losses:l.length,winRate:n?w.length/n:null,net,netPct:net/start,finalEquity:final,
    pf:gl>0?gw/gl:(gw>0?Infinity:null),avgWin:w.length?gw/w.length:null,avgLoss:l.length?-gl/l.length:null,exp:n?net/n:null,
    feesUsd:tr.reduce((s,t)=>s+(t.fees||0),0),slipUsd:tr.reduce((s,t)=>s+(t.slipUsd||0),0),fundUsd:tr.reduce((s,t)=>s+(t.fund||0),0),
    strategy:res.cfg.strategy||'breakout',exec:res.cfg.exec==='maker'?'maker':'taker',orders:res.orders,
    maxDD:res.maxDD,halts:res.halts,firstHalt:res.firstHalt,from:res.start,to:res.end,days:res.end&&res.start?(res.end-res.start)/864e5:0,
    byMarket:group(t=>t.k),byReason:group(t=>t.why),byMonth:group(t=>new Date(t.c).toISOString().slice(0,7)),
    avgRw:rt.length?sum(rt)/rt.reduce((s,t)=>s+t.risk,0):null,   // R ponderado pelo risco: Σ resultado / Σ risco (tem sempre o sinal do resultado em $)
    openAtEnd:res.openAtEnd,diag:res.diag,finalCash:res.finalCash,startCash:res.cfg.start,
    bh:res.bh,bars:res.bars,sparkline:pts.map(p=>p[1]),_trades:tr};
}

/* corre o teste principal e variantes de custo/alavancagem/execução para mostrar quanto o resultado depende disso */
function runAll(barsByKey,cfg,opts={}){
  const run=(label,override)=>({label,override,s:summarize(simulate(barsByKey,cfg,{override,funding:opts.funding}))});
  const main=run('regras atuais',{});
  const variants=[
    run('custo 2 bps (otimista)',{costBps:2}),
    run('custo 15 bps (pessimista)',{costBps:15}),
    run('alavancagem 2×',{maxLev:2}),
    run('alavancagem 5×',{maxLev:5}),
    run('slippage 3× maior',{slipBps:(cfg.slipBps||0)*3||9,slipStopBps:(cfg.slipStopBps??cfg.slipBps??0)*3||15}),
    run('sem slippage (irreal)',{slipBps:0,slipStopBps:0}),
    run('sem filtro de custo (só para ver o estrago)',{minATRpct:0}),
    run('ordens limitadas (maker)',{exec:'maker'}),
  ];
  return{main,variants,research:research(barsByKey,opts.base||cfg,opts)};   // a comparação parte das regras base, não da estratégia em uso
}

/* teste honesto em duas partes ("walk-forward"): escolhe a melhor combinação só com a 1.ª parte (60% do período)
   e mede-a na 2.ª parte, que a escolha nunca viu. Só a 2.ª parte diz alguma coisa sobre o futuro.
   Para passar, a 2.ª parte tem de ter 30+ trades, ganhar em média, fator de lucro > 1,1 e a média tem de estar
   2,5 erros padrão acima de zero (com 6 combinações à escolha, sem esta exigência o puro acaso passa muitas vezes). */
const MIN_A=10,MIN_B=30,MIN_T=D.APPROVAL_MIN_T;
function research(barsByKey,cfg,opts={}){
  const times=[...new Set(Object.values(barsByKey).flatMap(b=>(b||[]).map(x=>x.t)))].sort((a,b)=>a-b);
  if(times.length<50)return{rows:[],best:null,pass:false,split:null};
  const split=times[Math.floor(times.length*(opts.split||0.6))];
  const rows=[];
  const names=opts.only&&opts.only.length?opts.only:Object.keys(D.PRESETS).filter(k=>D.PRESETS[k].mode==='classic');   // os modos (scalping, day trade, swing) comparam-se à parte
  for(const strategy of names)for(const exec of ['taker','maker']){
    const o={strategy,override:{exec},funding:opts.funding};
    rows.push({strategy,exec,label:D.PRESETS[strategy].label+(exec==='maker'?' · limitadas':' · a mercado'),
      A:summarize(simulate(barsByKey,cfg,{...o,to:split})),B:summarize(simulate(barsByKey,cfg,{...o,from:split}))});
  }
  const cands=rows.filter(r=>r.A.n>=MIN_A&&r.A.avgR!=null);
  const best=cands.length?cands.reduce((a,b)=>b.A.avgR>a.A.avgR?b:a):null;
  const pass=!!(best&&best.A.avgR>0&&best.B.n>=MIN_B&&best.B.avgR>0&&best.B.pf!=null&&best.B.pf>1.1&&best.B.tR!=null&&best.B.tR>=MIN_T);
  return{rows,best,pass,split,minA:MIN_A,minB:MIN_B,minT:MIN_T};
}


/* ===== auditoria estatística (só lê as trades; não muda nada no teste) ===== */
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const q=(a,p)=>{const b=a.slice().sort((x,y)=>x-y);return b.length?b[Math.min(b.length-1,Math.max(0,Math.floor(p*b.length)))]:null};
const sd=a=>{if(a.length<2)return null;const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1))};
/* intervalo de confiança da média por "bootstrap por blocos": reamostra blocos de trades consecutivas (por data de fecho), para respeitar
   a dependência entre trades vizinhas (mesmo regime, mercados correlacionados). Determinístico (semente fixa). */
function blockBootstrap(xs,{block=5,reps=2000,seed=12345}={}){
  const n=xs.length;if(n<8)return{lo:null,hi:null,pPos:null,block:0};
  const L=Math.min(block,n),r=rng(seed),means=[];
  for(let b=0;b<reps;b++){let sum=0,c=0;while(c<n){const st=Math.floor(r()*n);for(let j=0;j<L&&c<n;j++,c++)sum+=xs[(st+j)%n]}means.push(sum/n)}
  return{lo:q(means,.025),hi:q(means,.975),pPos:means.filter(m=>m>0).length/reps,block:L};
}
const SESSIONS=[['Ásia 00-08 UTC',0,8],['Europa 08-13 UTC',8,13],['EUA 13-21 UTC',13,21],['Noite 21-24 UTC',21,24]];
function analyze(res){
  const tr=res.trades.slice().sort((a,b)=>a.c-b.c),n=tr.length,start=res.cfg.start;
  const w=tr.filter(t=>t.pnl>0),l=tr.filter(t=>t.pnl<=0),gw=sum(w),gl=-sum(l),net=sum(tr);
  const rt=tr.filter(t=>t.risk>0),Rs=rt.map(t=>t.pnl/t.risk),mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const avgR=mean(Rs),s=sd(Rs),ci=blockBootstrap(Rs);
  let streak=0,maxStreak=0,ddUsd=0,peak=start;
  for(const t of tr){streak=t.pnl>0?0:streak+1;maxStreak=Math.max(maxStreak,streak)}
  for(const [,e] of res.curve){if(e>peak)peak=e;ddUsd=Math.max(ddUsd,peak-e)}
  const grp=f=>{const o={};for(const t of tr){const g=f(t);if(g==null)continue;const x=(o[g]??={n:0,wins:0,pnl:0,rs:[]});x.n++;if(t.pnl>0)x.wins++;x.pnl+=t.pnl;if(t.risk>0)x.rs.push(t.pnl/t.risk)}for(const g of Object.keys(o)){o[g].avgR=mean(o[g].rs);delete o[g].rs}return o};
  const aps=rt.map(t=>t.atrPct).filter(x=>x>0),c1=q(aps,1/3),c2=q(aps,2/3);
  return{n,wins:w.length,losses:l.length,hit:n?w.length/n:null,grossWin:gw,grossLoss:gl,net,netPct:net/start,pf:gl>0?gw/gl:(gw>0?Infinity:null),
    avgWin:w.length?gw/w.length:null,avgLoss:l.length?-gl/l.length:null,payoff:w.length&&l.length?(gw/w.length)/(gl/l.length):null,
    expUsd:n?net/n:null,expR:avgR,sdR:s,tR:s>0?avgR/(s/Math.sqrt(Rs.length)):null,ci,
    maxDDpct:res.maxDD,maxDDusd:ddUsd,maxLossStreak:maxStreak,
    costs:{fees:tr.reduce((x,t)=>x+(t.fees||0),0),slip:tr.reduce((x,t)=>x+(t.slipUsd||0),0),funding:tr.reduce((x,t)=>x+(t.fund||0),0)},
    grossBeforeCosts:net+tr.reduce((x,t)=>x+(t.costUsd||0),0),
    byMarket:grp(t=>t.k),byExit:grp(t=>t.why),byMonth:grp(t=>new Date(t.c).toISOString().slice(0,7)),
    bySession:grp(t=>{const h=new Date(t.o).getUTCHours();const x=SESSIONS.find(z=>h>=z[1]&&h<z[2]);return x?x[0]:null}),
    byVol:aps.length>=9?grp(t=>t.atrPct>0?(t.atrPct<=c1?'ATR baixo (1/3 inferior)':t.atrPct<=c2?'ATR médio':'ATR alto (1/3 superior)'):null):{},
    openAtEnd:res.openAtEnd};
}
/* recalcula tudo a partir da lista de trades e compara com o que o relatório mostra; devolve as inconsistências (lista vazia = tudo coerente) */
function crossCheck(res,sm){
  const out=[],tr=res.trades,eps=1e-6,near=(a,b,t=eps)=>Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b));
  const net=tr.reduce((x,t)=>x+t.pnl,0),sdr=sm||summarize(res);
  if(!near(res.finalCash-res.cfg.start,net))out.push(`conta final − inicial (${(res.finalCash-res.cfg.start).toFixed(4)}) ≠ soma dos resultados das trades (${net.toFixed(4)})`);
  if(sdr.n!==tr.length)out.push('número de trades difere');
  if(sdr.wins+sdr.losses!==tr.length)out.push('vitórias + derrotas ≠ trades');
  if(!near(sdr.net,net))out.push('resultado líquido difere');
  const gw=tr.filter(t=>t.pnl>0).reduce((x,t)=>x+t.pnl,0),gl=-tr.filter(t=>t.pnl<=0).reduce((x,t)=>x+t.pnl,0);
  if(gl>0&&!near(sdr.pf,gw/gl))out.push('fator de lucro difere');
  const rt=tr.filter(t=>t.risk>0),avgR=rt.length?rt.reduce((x,t)=>x+t.pnl/t.risk,0)/rt.length:null;
  if(avgR!=null&&!near(sdr.avgR,avgR))out.push('média em R difere');
  if(avgR!=null&&sdr.avgGrossR!=null&&sdr.costR!=null&&!near(sdr.avgGrossR-sdr.costR,sdr.avgR))out.push('R bruto − custos em R ≠ R líquido');
  const costs=tr.reduce((x,t)=>x+t.costUsd,0),parts=tr.reduce((x,t)=>x+t.fees+t.slipUsd+t.fund,0);
  if(!near(costs,parts))out.push('custos totais ≠ taxas + slippage + funding');
  if(sdr.avgRw!=null&&Math.sign(Math.round(sdr.avgRw*1e9))!==Math.sign(Math.round(net*1e9)))out.push('R ponderado pelo risco com sinal diferente do resultado');
  return out;
}
/* inverso da normal (Acklam, precisão ~1e-9) para o limiar corrigido pelo número de variantes testadas */
function qnorm(p){
  const a=[-39.69683028665376,220.9460984245205,-275.9285104469687,138.357751867269,-30.66479806614716,2.506628277459239],
    b=[-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572],
    c=[-.007784894002430293,-.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783],
    d=[.007784695709041462,.3224671290700398,2.445134137142996,3.754408661907416];
  const lo=.02425,hi=1-lo;let x;
  if(p<lo){const t=Math.sqrt(-2*Math.log(p));x=(((((c[0]*t+c[1])*t+c[2])*t+c[3])*t+c[4])*t+c[5])/((((d[0]*t+d[1])*t+d[2])*t+d[3])*t+1)}
  else if(p>hi){const t=Math.sqrt(-2*Math.log(1-p));x=-(((((c[0]*t+c[1])*t+c[2])*t+c[3])*t+c[4])*t+c[5])/((((d[0]*t+d[1])*t+d[2])*t+d[3])*t+1)}
  else{const t=p-.5,r=t*t;x=(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*t/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)}
  return x;
}
/* protocolo em três partes cronológicas: desenvolvimento (escolher), validação (confirmar) e teste final (só se olha uma vez).
   Regra fixada antes de ver resultados: uma variante só é "promissora" se, face à referência, tiver melhor R médio no desenvolvimento
   E na validação E R médio positivo na validação. O teste final só é calculado para a referência e para as promissoras.
   Cada hipótese muda UM parâmetro. O número de variantes entra no limiar de significância (Bonferroni). */
function protocol(barsByKey,cfg,hyps,opts={}){
  const times=[...new Set(Object.values(barsByKey).flatMap(b=>(b||[]).map(x=>x.t)))].sort((a,b)=>a-b);
  if(times.length<200)return null;
  const fr=opts.fracs||[.5,.25,.25],t1=times[Math.floor(times.length*fr[0])],t2=times[Math.floor(times.length*(fr[0]+fr[1]))];
  const segs={dev:{to:t1},val:{from:t1,to:t2},test:{from:t2}};
  const cands=[{id:'base',hypothesis:'referência (parâmetros originais)',override:{}},...hyps];
  const run=(c,seg)=>{const r=simulate(barsByKey,cfg,{override:c.override,funding:opts.funding,...segs[seg]}),sm=summarize(r),a=analyze(r);
    return{n:sm.n,avgR:sm.avgR,avgGrossR:sm.avgGrossR,pf:sm.pf,netPct:sm.netPct,maxDD:sm.maxDD,tR:sm.tR,ciLo:a.ci.lo,ciHi:a.ci.hi,pPos:a.ci.pPos}};
  const rows=cands.map(c=>({id:c.id,hypothesis:c.hypothesis,override:c.override,dev:run(c,'dev'),val:run(c,'val')}));
  const base=rows[0];
  for(const r of rows){
    r.promising=r.id==='base'?null:!!(r.dev.avgR!=null&&base.dev.avgR!=null&&r.val.avgR!=null&&base.val.avgR!=null&&r.dev.avgR>base.dev.avgR&&r.val.avgR>base.val.avgR&&r.val.avgR>0);
    r.test=(r.id==='base'||r.promising)?run(cands.find(c=>c.id===r.id),'test'):null;
  }
  const k=rows.length,zAdj=qnorm(1-0.025/k);
  return{split:[t1,t2],rows,variantsTested:k,tCrit:{single:1.96,adjusted:zAdj}};
}


/* métricas de risco/retorno a partir da curva da conta (valores diários, UTC): Sharpe e Sortino anualizados (365 dias), CAGR, Calmar,
   fator de recuperação, pior período debaixo de água e exposição ao mercado (fração de velas×mercados com posição aberta) */
function perf(res){
  const start=res.cfg.start,cv=res.curve||[];
  const empty={sharpe:null,sortino:null,cagr:null,calmar:null,recovery:null,underwaterDays:0,exposure:res.exposure??null,returnPct:res.finalCash!=null?res.finalCash/start-1:null,days:0};
  if(cv.length<3)return empty;
  const days=new Map();for(const [t,e] of cv)days.set(Math.floor(t/864e5),e);
  const ds=[...days.keys()].sort((a,b)=>a-b),eq=ds.map(d=>days.get(d));
  const rets=[];let prev=start;for(const e of eq){rets.push(e/prev-1);prev=e}
  const m=rets.reduce((x,y)=>x+y,0)/rets.length,sdv=Math.sqrt(rets.reduce((x,y)=>x+(y-m)**2,0)/(rets.length-1||1));
  const dn=Math.sqrt(rets.reduce((x,y)=>x+Math.min(y,0)**2,0)/rets.length);
  const years=Math.max(1,(ds[ds.length-1]-ds[0]+1))/365,fin=eq[eq.length-1],cagr=fin>0?(fin/start)**(1/years)-1:-1;
  let peak=start,ddUsd=0,uw=0,maxUw=0;for(const e of eq){if(e>=peak){peak=e;uw=0}else{uw++;maxUw=Math.max(maxUw,uw)}ddUsd=Math.max(ddUsd,peak-e)}
  return{sharpe:sdv>0?m/sdv*Math.sqrt(365):null,sortino:dn>0?m/dn*Math.sqrt(365):null,cagr,calmar:res.maxDD>0?cagr/res.maxDD:null,
    recovery:ddUsd>0?(fin-start)/ddUsd:null,underwaterDays:maxUw,exposure:res.exposure??null,returnPct:fin/start-1,days:ds.length};
}
const api={simulate,summarize,runAll,research,prepCfg,analyze,crossCheck,blockBootstrap,protocol,qnorm,perf};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BT=api;
})(typeof window!=='undefined'?window:globalThis);
