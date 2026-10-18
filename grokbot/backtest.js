/* DOLLOS · TESTE HISTÓRICO do Macro Desk (motor puro).
   Corre as MESMAS regras do Macro Desk ao vivo (strategy.js) sobre velas passadas, com a mesma conta, o mesmo risco por trade,
   o mesmo limite de alavancagem, os mesmos custos e as mesmas paragens de proteção (-20% desde o máximo, -5% num dia).
   Convenções (conservadoras): entra ao fecho da vela do sinal; stop e alvo avaliam-se com o máximo/mínimo da vela seguinte;
   se o stop e o alvo cabem na mesma vela, conta o stop; saltos (gap) enchem ao preço de abertura.
   Ordens limitadas (exec:'maker'): a entrada fica ao preço de fecho da vela do sinal durante UMA vela e só enche se o preço passar
   para lá dele (tocar não chega); o alvo também é uma ordem limitada (só enche se o preço o ultrapassar); o stop é sempre a mercado.
   Funding (opcional): cobrado ou recebido de hora a hora sobre o valor da posição, com as taxas reais de cada hora. */
(function(root){
const D=(typeof require!=='undefined'&&typeof module!=='undefined'&&module.exports)?require('./strategy.js'):root.DSTRAT;
const WIN=200;   // o Macro Desk ao vivo guarda as últimas 200 velas
const H=36e5;

function prepCfg(cfgIn,override,strategy){
  let cfg={...cfgIn};
  if(strategy)cfg=D.withStrategy(cfg,strategy);
  cfg={...cfg,...(override||{})};
  cfg.minATRpct=Math.max(.0005,2*cfg.costBps/1e4);   // mesma regra do macro.js: ATR >= 2x custo
  return cfg;
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
  const FI=fundingIndex(opts.funding);
  const keys=Object.keys(barsByKey).filter(k=>barsByKey[k]&&barsByKey[k].length);
  const ix={},times=new Set();
  for(const k of keys){ix[k]=new Map();barsByKey[k].forEach((b,i)=>{ix[k].set(b.t,i);times.add(b.t)})}
  const timeline=[...times].sort((a,b)=>a-b);
  let cash=cfg.start,peak=cash,top=cash,maxDD=0,halted=null,dayKey='',dayEq=cash,t0=null,tEnd=0;
  const pos={},pend={},last={},trades=[],curve=[],halts={dd:0,day:0},orders={placed:0,filled:0};let firstHalt=null;
  const unreal=(p,px)=>p.side*(px-p.entry)/p.entry*p.notional;
  const eqNow=()=>{let e=cash;for(const k in pos)e+=unreal(pos[k],last[k])-pos[k].fund;return e};
  const closeAt=(k,px,t,why,fee=taker)=>{const p=pos[k],fees=p.notional*(p.fee+fee),pnl=unreal(p,px)-p.notional*fee-p.fund;cash+=pnl;
    trades.push({k,side:p.side,o:p.o,c:t,en:p.entry,ex:px,nt:p.notional,pnl,why,bars:p.held,risk:p.notional*p.sf,costUsd:fees+p.fund,fees,fund:p.fund});delete pos[k]};
  const flatten=(t,why)=>{for(const k of Object.keys(pos))closeAt(k,last[k],t,why);for(const k of Object.keys(pend))delete pend[k]};
  const openPos=(k,side,entryPx,fee,o)=>{pos[k]={side,entry:entryPx*(1+side*fee),fee,notional:o.notional,stop:0,tp:null,o:o.t,held:0,sf:o.stopDist/(entryPx*(1+side*fee)),fund:0,fundH:Math.floor(o.t/H),atr:o.atr};
    const p=pos[k];p.stop=p.entry-side*o.stopDist;if(o.tpDist>0)p.tp=p.entry+side*o.tpDist;p.best=p.entry;return p};

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
      orders.filled++;const p=openPos(k,o.side,o.limit,makerFee,{...o,t});
      p.fresh=true;   // na vela em que enche só pode sair pelo stop (não se sabe a ordem dos movimentos)
    }
    // 2) saídas (stop, alvo, tempo) com a vela deste instante
    for(const k of keys){
      const i=ix[k].get(t);if(i==null)continue;
      const b=barsByKey[k][i];last[k]=b.c;const p=pos[k];if(!p)continue;
      const long=p.side>0,stopHit=long?b.l<=p.stop:b.h>=p.stop;
      if(p.fresh){p.fresh=false;if(stopHit)closeAt(k,p.stop,t,'stop-loss');continue}
      p.held++;
      const tpHit=p.tp!=null&&(maker?(long?b.h>p.tp:b.l<p.tp):(long?b.h>=p.tp:b.l<=p.tp));
      if(stopHit)closeAt(k,long?Math.min(p.stop,b.o):Math.max(p.stop,b.o),t,'stop-loss');
      else if(tpHit)closeAt(k,maker?p.tp:(long?Math.max(p.tp,b.o):Math.min(p.tp,b.o)),t,'take-profit',maker?makerFee:taker);
      else if(p.held>=cfg.maxHoldBars)closeAt(k,b.c,t,'time-stop');
      if(pos[k])pos[k].stop=st.trailStop(pos[k],b);   // stop móvel: só vale a partir da vela seguinte
    }
    // 3) proteção de capital (como no desk: -20% desde o máximo fecha tudo; -5% num dia pausa até amanhã)
    let e=eqNow();const dk=new Date(t).toISOString().slice(0,10);
    if(dk!==dayKey){dayKey=dk;dayEq=e;if(halted){if(halted.kind==='dd')peak=e;halted=null}}   // retoma no dia seguinte (equivale a tocar em RETOMAR)
    if(e>peak)peak=e;if(e>top)top=e;maxDD=Math.max(maxDD,1-e/top);
    if(!halted){
      if(e<=peak*(1-cfg.ddStop)){flatten(t,'kill-switch');halted={kind:'dd'};halts.dd++;e=eqNow();if(!firstHalt)firstHalt={t,equity:e,trades:trades.length}}
      else if(e<=dayEq*(1-cfg.dayLoss)){flatten(t,'limite diário');halted={kind:'day'};halts.day++;e=eqNow()}
    }
    // 4) entradas
    if(!halted)for(const k of keys){
      const i=ix[k].get(t);if(i==null||pos[k]||pend[k])continue;
      const sig=st.signal(barsByKey[k].slice(Math.max(0,i-WIN+1),i+1));
      if(sig.dir!=='long'&&sig.dir!=='short')continue;
      const b=barsByKey[k][i],side=sig.dir==='long'?1:-1,stopDist=cfg.stopATR*sig.atr,tpDist=cfg.tpATR*sig.atr;
      const ref=maker?b.c:b.c*(1+side*taker),notional=st.sizeFor(eqNow(),ref,stopDist);if(!(notional>1))continue;
      if(maker){pend[k]={side,limit:b.c,notional,stopDist,tpDist,t,atr:sig.atr};orders.placed++}
      else openPos(k,side,b.c,taker,{notional,stopDist,tpDist,t,atr:sig.atr});
    }
    curve.push([t,eqNow()]);
  }
  const open=Object.keys(pos).length;flatten(tEnd,'fim do teste');
  const bh={},bars={};
  for(const k of keys){const b=barsByKey[k].filter(x=>(opts.from==null||x.t>=opts.from)&&(opts.to==null||x.t<opts.to));bars[k]=b.length;bh[k]=b.length>1?b[b.length-1].c/b[0].o-1:0}
  return{cfg,trades,curve,halts,maxDD,openAtEnd:open,finalCash:cash,firstHalt,bh,start:t0||0,end:tEnd,bars,orders};
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
    feesUsd:tr.reduce((s,t)=>s+(t.fees||0),0),fundUsd:tr.reduce((s,t)=>s+(t.fund||0),0),
    strategy:res.cfg.strategy||'breakout',exec:res.cfg.exec==='maker'?'maker':'taker',orders:res.orders,
    maxDD:res.maxDD,halts:res.halts,firstHalt:res.firstHalt,from:res.start,to:res.end,days:res.end&&res.start?(res.end-res.start)/864e5:0,
    byMarket:group(t=>t.k),byReason:group(t=>t.why),byMonth:group(t=>new Date(t.c).toISOString().slice(0,7)),
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
    run('ordens limitadas (maker)',{exec:'maker'}),
  ];
  return{main,variants,research:research(barsByKey,opts.base||cfg,opts)};   // a comparação parte das regras base, não da estratégia em uso
}

/* teste honesto em duas partes ("walk-forward"): escolhe a melhor combinação só com a 1.ª parte (60% do período)
   e mede-a na 2.ª parte, que a escolha nunca viu. Só a 2.ª parte diz alguma coisa sobre o futuro.
   Para passar, a 2.ª parte tem de ter 30+ trades, ganhar em média, fator de lucro > 1,1 e a média tem de estar
   2 erros padrão acima de zero (com 6 combinações à escolha, sem esta exigência o puro acaso passa muitas vezes). */
const MIN_A=10,MIN_B=30,MIN_T=2;
function research(barsByKey,cfg,opts={}){
  const times=[...new Set(Object.values(barsByKey).flatMap(b=>(b||[]).map(x=>x.t)))].sort((a,b)=>a-b);
  if(times.length<50)return{rows:[],best:null,pass:false,split:null};
  const split=times[Math.floor(times.length*(opts.split||0.6))];
  const rows=[];
  for(const strategy of Object.keys(D.PRESETS))for(const exec of ['taker','maker']){
    const o={strategy,override:{exec},funding:opts.funding};
    rows.push({strategy,exec,label:D.PRESETS[strategy].label+(exec==='maker'?' · limitadas':' · a mercado'),
      A:summarize(simulate(barsByKey,cfg,{...o,to:split})),B:summarize(simulate(barsByKey,cfg,{...o,from:split}))});
  }
  const cands=rows.filter(r=>r.A.n>=MIN_A&&r.A.avgR!=null);
  const best=cands.length?cands.reduce((a,b)=>b.A.avgR>a.A.avgR?b:a):null;
  const pass=!!(best&&best.A.avgR>0&&best.B.n>=MIN_B&&best.B.avgR>0&&best.B.pf!=null&&best.B.pf>1.1&&best.B.tR!=null&&best.B.tR>=MIN_T);
  return{rows,best,pass,split,minA:MIN_A,minB:MIN_B,minT:MIN_T};
}

const api={simulate,summarize,runAll,research,prepCfg};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BT=api;
})(typeof window!=='undefined'?window:globalThis);
