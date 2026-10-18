/* DOLLOS · TESTE HISTÓRICO do Macro Desk (motor puro).
   Corre as MESMAS regras do Macro Desk ao vivo (strategy.js) sobre velas passadas, com a mesma conta, o mesmo risco por trade,
   o mesmo limite de alavancagem, os mesmos custos e as mesmas paragens de proteção (-20% desde o máximo, -5% num dia).
   Convenções (conservadoras): entra ao fecho da vela do sinal; stop e alvo avaliam-se com o máximo/mínimo da vela seguinte;
   se o stop e o alvo cabem na mesma vela, conta o stop; saltos (gap) enchem ao preço de abertura. Não inclui funding. */
(function(root){
const D=(typeof require!=='undefined'&&typeof module!=='undefined'&&module.exports)?require('./strategy.js'):root.DSTRAT;
const WIN=200;   // o Macro Desk ao vivo guarda as últimas 200 velas

function prepCfg(cfgIn,override){
  const cfg={...cfgIn,...(override||{})};
  cfg.minATRpct=Math.max(.0005,2*cfg.costBps/1e4);   // mesma regra do macro.js: ATR >= 2x custo
  return cfg;
}

/* barsByKey: { GOLD:[{t,o,h,l,c},...], SPX:[...], EURUSD:[...] } (t em ms, ordenado) */
function simulate(barsByKey,cfgIn,opts={}){
  const cfg=prepCfg(cfgIn,opts.override),st=D.make(cfg,opts.nMarkets||3);
  const keys=Object.keys(barsByKey).filter(k=>barsByKey[k]&&barsByKey[k].length);
  const ix={},times=new Set();
  for(const k of keys){ix[k]=new Map();barsByKey[k].forEach((b,i)=>{ix[k].set(b.t,i);times.add(b.t)})}
  const timeline=[...times].sort((a,b)=>a-b);
  let cash=cfg.start,peak=cash,top=cash,maxDD=0,halted=null,dayKey='',dayEq=cash;
  const pos={},last={},trades=[],curve=[],halts={dd:0,day:0};let firstHalt=null;
  const unreal=(p,px)=>p.side*(px-p.entry)/p.entry*p.notional;
  const eqNow=()=>{let e=cash;for(const k in pos)e+=unreal(pos[k],last[k]);return e};
  const closeAt=(k,px,t,why)=>{const p=pos[k],pnl=unreal(p,px)-p.notional*st.cost();cash+=pnl;
    trades.push({k,side:p.side,o:p.o,c:t,en:p.entry,ex:px,nt:p.notional,pnl,why,bars:p.held});delete pos[k]};
  const flatten=(t,why)=>{for(const k of Object.keys(pos))closeAt(k,last[k],t,why)};

  for(const t of timeline){
    // 1) saídas (stop, alvo, tempo) com a vela deste instante
    for(const k of keys){
      const i=ix[k].get(t);if(i==null)continue;
      const b=barsByKey[k][i];last[k]=b.c;const p=pos[k];if(!p)continue;
      p.held++;const long=p.side>0;
      const stopHit=long?b.l<=p.stop:b.h>=p.stop,tpHit=long?b.h>=p.tp:b.l<=p.tp;
      if(stopHit)closeAt(k,long?Math.min(p.stop,b.o):Math.max(p.stop,b.o),t,'stop-loss');
      else if(tpHit)closeAt(k,long?Math.max(p.tp,b.o):Math.min(p.tp,b.o),t,'take-profit');
      else if(p.held>=cfg.maxHoldBars)closeAt(k,b.c,t,'time-stop');
    }
    // 2) proteção de capital (como no desk: -20% desde o máximo fecha tudo; -5% num dia pausa até amanhã)
    let e=eqNow();const dk=new Date(t).toISOString().slice(0,10);
    if(dk!==dayKey){dayKey=dk;dayEq=e;if(halted){if(halted.kind==='dd')peak=e;halted=null}}   // retoma no dia seguinte (equivale a tocar em RETOMAR)
    if(e>peak)peak=e;if(e>top)top=e;maxDD=Math.max(maxDD,1-e/top);
    if(!halted){
      if(e<=peak*(1-cfg.ddStop)){flatten(t,'kill-switch');halted={kind:'dd'};halts.dd++;e=eqNow();if(!firstHalt)firstHalt={t,equity:e,trades:trades.length}}
      else if(e<=dayEq*(1-cfg.dayLoss)){flatten(t,'limite diário');halted={kind:'day'};halts.day++;e=eqNow()}
    }
    // 3) entradas
    if(!halted)for(const k of keys){
      const i=ix[k].get(t);if(i==null||pos[k])continue;
      const sig=st.signal(barsByKey[k].slice(Math.max(0,i-WIN+1),i+1));
      if(sig.dir!=='long'&&sig.dir!=='short')continue;
      const b=barsByKey[k][i],side=sig.dir==='long'?1:-1,entry=b.c*(1+side*st.cost()),stopDist=cfg.stopATR*sig.atr;
      const notional=st.sizeFor(eqNow(),entry,stopDist);if(!(notional>1))continue;
      pos[k]={side,entry,notional,stop:entry-side*stopDist,tp:entry+side*cfg.tpATR*sig.atr,o:t,held:0};
    }
    curve.push([t,eqNow()]);
  }
  const tEnd=timeline.length?timeline[timeline.length-1]:0;
  const open=Object.keys(pos).length;flatten(tEnd,'fim do teste');
  const bh={};
  for(const k of keys){const b=barsByKey[k];bh[k]=b.length>1?b[b.length-1].c/b[0].o-1:0}
  return{cfg,trades,curve,halts,maxDD,openAtEnd:open,finalCash:cash,firstHalt,bh,start:timeline[0]||0,end:tEnd,bars:Object.fromEntries(keys.map(k=>[k,barsByKey[k].length]))};
}

const sum=a=>a.reduce((s,x)=>s+x.pnl,0);
function summarize(res){
  const tr=res.trades,n=tr.length,w=tr.filter(t=>t.pnl>0),l=tr.filter(t=>t.pnl<=0);
  const gw=sum(w),gl=-sum(l),net=sum(tr),start=res.cfg.start;
  const group=(f)=>{const o={};for(const t of tr){const g=f(t);(o[g]??={n:0,wins:0,pnl:0});o[g].n++;if(t.pnl>0)o[g].wins++;o[g].pnl+=t.pnl}return o};
  const final=res.finalCash;
  const pts=res.curve.length>140?res.curve.filter((_,i)=>i%Math.ceil(res.curve.length/140)===0):res.curve;
  return{n,wins:w.length,losses:l.length,winRate:n?w.length/n:null,net,netPct:net/start,finalEquity:final,
    pf:gl>0?gw/gl:(gw>0?Infinity:null),avgWin:w.length?gw/w.length:null,avgLoss:l.length?-gl/l.length:null,exp:n?net/n:null,
    maxDD:res.maxDD,halts:res.halts,firstHalt:res.firstHalt,from:res.start,to:res.end,days:res.end&&res.start?(res.end-res.start)/864e5:0,
    byMarket:group(t=>t.k),byReason:group(t=>t.why),byMonth:group(t=>new Date(t.c).toISOString().slice(0,7)),
    bh:res.bh,bars:res.bars,sparkline:pts.map(p=>p[1])};
}

/* corre o teste principal e variantes de custo/alavancagem para mostrar quanto o resultado depende disso */
function runAll(barsByKey,cfg){
  const run=(label,override)=>({label,override,s:summarize(simulate(barsByKey,cfg,{override}))});
  const main=run('regras atuais',{});
  const variants=[
    run('custo 2 bps (otimista)',{costBps:2}),
    run('custo 15 bps (pessimista)',{costBps:15}),
    run('alavancagem 2×',{maxLev:2}),
    run('alavancagem 5×',{maxLev:5}),
  ];
  return{main,variants};
}

const api={simulate,summarize,runAll,prepCfg};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BT=api;
})(typeof window!=='undefined'?window:globalThis);
