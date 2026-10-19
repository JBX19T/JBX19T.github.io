/* DOLLOS · LIVE — liga os desks ao worker, que executa em corretoras reais.
   Hyperliquid: ouro, S&P 500 e EUR/USD do Macro Desk.   Solana (Jupiter): as memecoins do desk de memecoins.
   A app só diz o que quer ter (posições desejadas); o worker é que decide e executa, com os seus limites.
   O modo (simulação ou real) e a rede (teste ou real) são decididos pelo worker, não por esta página. Tudo vem desligado. */
(()=>{
const DEMO=new URLSearchParams(location.search).has('demo');
const KEY='dollosLiveV1';
const L={token:'',hl:false,sol:false};
try{const j=JSON.parse(localStorage.getItem(KEY)||'null');if(j)Object.assign(L,{token:j.token||'',hl:!!j.hl,sol:!!j.sol})}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(L))}catch(e){}};
const api=()=>typeof HOLDERS_API==='string'?HOLDERS_API:'';
const $l=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const usd=v=>(v<0?'-$':'$')+Math.abs(v).toFixed(2);
const note=t=>{try{log('p',t)}catch(e){}};
const P={hl:{st:null,last:null,err:'',busy:false,log:[],sig:null,at:0},sol:{st:null,last:null,err:'',busy:false,log:[],sig:null,at:0},risk:null};
const HL_EVERY=30000,SOL_EVERY=20000;

async function call(method,path,body){
  const f=window.CapacitorWebFetch||fetch;
  const r=await f(api()+path,{method,headers:{'x-token':L.token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j;
}
const stamp=()=>new Date().toISOString().slice(11,16);
function remember(k,res){   // resume o que o worker fez e guarda nas últimas linhas
  const out=[];
  for(const x of res.results||[]){
    const nm=x.market||(x.mint?x.mint.slice(0,4)+'…':'');
    out.push(`${x.op.toUpperCase()} ${nm} ${x.ok?(x.simulated?'(simulado)':'ok'):'FALHOU: '+esc(x.error||JSON.stringify(x.detail||'').slice(0,90))}`);
  }
  for(const x of res.skipped||[])out.push(`ignorado ${x.market||(x.mint||'').slice(0,4)+'…'}: ${esc(x.reason)}`);
  if(res.mode==='simulacao')for(const x of res.plan||[])out.push(`plano ${x.op} ${x.market||(x.mint||'').slice(0,4)+'…'}${x.usd?' $'+x.usd:''} (simulação: nada enviado)`);
  out.forEach(t=>{P[k].log.unshift(stamp()+' '+t);if(res.mode==='real'||/FALHOU/.test(t))note((k==='hl'?'HYPERLIQUID ':'SOLANA ')+t)});
  P[k].log.length=Math.min(P[k].log.length,6);
}

/* ===== travas do dinheiro real =====
   Hyperliquid: só envia ordens se a estratégia em uso (e as velas) passou o teste histórico em duas partes há menos de 45 dias.
   Memecoins: só compra se o desk de memecoins em papel já provou lucro (30+ trades fechadas, fator de lucro > 1,1). Vender continua sempre. */
function hlGate(){
  try{
    const c=(window.MACRO&&MACRO.CHOICE)||{strategy:'breakout',iv:'15m'};
    const all=JSON.parse(localStorage.getItem('dollosApprovalV2')||'{}')||{},a=all[c.strategy+'|'+c.iv];
    const label=`${DSTRAT.PRESETS[c.strategy].label} · ${c.iv}`;
    if(DSTRAT.isScalp(c.strategy,c.iv))return{ok:false,label,why:'é scalping: só corre em papel e no teste histórico (o worker sincroniza de 30 s a 5 min, o que não serve para scalping)'};
    if(DSTRAT.approvalOk(a,c.strategy,c.iv))return{ok:true,label,until:a.at+DSTRAT.APPROVAL_DAYS*864e5};
    return{ok:false,label,why:a&&a.at?'a aprovação expirou (refaz o teste)':'não passou no teste histórico'};
  }catch(e){return{ok:false,label:'?',why:'sem dados'}}
}
function memeGate(){
  try{const M=window.MEME;if(!M)return{ok:false,why:'desk de memecoins indisponível'};
    const st=RESULTS.compute(M.state().trades||[],M.start(),0,0);
    const ok=st.n>=30&&st.net>0&&st.pf!=null&&st.pf>1.1;
    return{ok,n:st.n,pf:st.pf,why:ok?'':`o desk em papel tem ${st.n} trades fechadas e fator de lucro ${st.pf==null?'—':st.pf===Infinity?'∞':st.pf.toFixed(2)} (precisa de 30+ e acima de 1,1)`};
  }catch(e){return{ok:false,why:'sem dados'}}
}

/* o que a app diz ao worker sobre a estratégia em uso e a sua aprovação: o worker volta a verificar e só abre posições se for válida */
function hlAttest(){
  const c=(window.MACRO&&MACRO.CHOICE)||{strategy:'breakout',iv:'15m'};let a=null;
  try{a=(JSON.parse(localStorage.getItem('dollosApprovalV2')||'{}')||{})[c.strategy+'|'+c.iv]}catch(e){}
  return{strategy:c.strategy,iv:c.iv,...(a?{approval:a}:{})};
}
/* ===== o que cada desk quer ter ===== */
function hlDesired(){
  const K=window.MACRO;if(!K)return {};
  const S=K.state(),eq=K.equity(),d={};
  for(const m of K.MK){const p=S.pos[m.key];if(!p||!(eq>0))continue;
    d[m.key]={side:p.side>0?'long':'short',frac:+(p.notional/eq).toFixed(4),slPct:+(Math.abs(p.entry-p.stop)/p.entry).toFixed(5),tpPct:p.tp==null?null:+(Math.abs(p.tp-p.entry)/p.entry).toFixed(5)};
    if(p.atr)d[m.key].slPx=+p.stop.toPrecision(6)}   // estratégia de stop móvel: a corretora acompanha o stop do desk
  return d;
}
function solDesired(){
  let want=[];
  try{want=S.positions.filter(p=>p.t&&p.t.chain==='solana'&&p.t.addr&&!String(p.t.addr).startsWith('demo')).map(p=>p.t.addr)}catch(e){return[]}
  if(!memeGate().ok){const held=new Set(((P.sol.st&&P.sol.st.tokens)||[]).map(t=>t.mint));want=want.filter(m=>held.has(m))}   // travado: não compra nada novo, só mantém/vende
  return want;
}

/* ===== sincronização ===== */
async function sync(k){
  const on=L[k];if(!on||P[k].busy||DEMO||!api()||!L.token)return;
  P[k].busy=true;
  try{
    P[k].err='';
    try{P[k].st=await call('GET',`/${k}/state`)}catch(e){P[k].err=e.message}   // o estado (mercados, saldo) mostra-se mesmo que a sincronização falhe
    if(k==='sol'&&!P.sol.st){P[k].sig=JSON.stringify(solDesired());P[k].at=Date.now();P[k].busy=false;render(k);return}   // sem saber o que a carteira tem, não decide nada (a trava depende disso)
    const want=k==='hl'?hlDesired():solDesired();P[k].sig=JSON.stringify(want);
    const auto=k==='hl'&&P.hl.st&&P.hl.st.autopilot&&P.hl.st.autopilot.on;   // piloto automático no servidor: a app só observa
    // sem aprovação a app continua a sincronizar: o worker recusa ABRIR, mas continua a fechar e a manter stops das posições que existam
    try{P.risk=await call('GET','/risk/state')}catch(e){}
    if(!auto)try{P[k].last=await call('POST',`/${k}/sync`,k==='hl'?{desired:want,...hlAttest()}:{desired:want});remember(k,P[k].last);P[k].st=await call('GET',`/${k}/state`).catch(()=>P[k].st)}catch(e){P[k].err=e.message}
    P[k].at=Date.now();
  }catch(e){P[k].err=e.message}
  P[k].busy=false;render(k);
}
async function flatten(k){
  if(!confirm(k==='hl'?'Fechar já todas as posições da Hyperliquid (ouro, S&P, EUR/USD)?':'Vender já todas as memecoins da carteira Solana?'))return;
  try{const r=await call('POST',`/${k}/flatten`,{});remember(k,r);P[k].err='';P[k].st=await call('GET',`/${k}/state`)}catch(e){P[k].err=e.message}
  render(k);
}
async function panic(){
  if(!confirm('PARAGEM DE EMERGÊNCIA: fecha já todas as posições da Hyperliquid e vende todas as memecoins da carteira Solana, e bloqueia novas entradas até tocares em RETOMAR TUDO. Continuar?'))return;
  try{const r=await call('POST','/risk/panic',{});for(const k of ['hl','sol'])if(r[k])remember(k,r[k]);P.risk=await call('GET','/risk/state');for(const k of ['hl','sol'])P[k].err=''}catch(e){P.hl.err='emergência: '+e.message}
  render('hl');render('sol');
}
async function riskResume(){
  try{await call('POST','/risk/resume',{});P.risk=await call('GET','/risk/state')}catch(e){P.hl.err=e.message}
  render('hl');render('sol');
}
function riskHtml(){
  const r=P.risk;if(!r||!r.on)return'';
  const halt=r.riskHalt?`<div class="halt">🛑 <b>PARAGEM GLOBAL ativa</b> desde ${new Date(r.riskHalt.t).toISOString().slice(0,16).replace('T',' ')} UTC: nada abre, nem na Hyperliquid nem na Solana. <button class="ghost" data-a="riskresume">RETOMAR TUDO</button></div>`:'';
  const blind=(r.fails&&(r.fails.hl>=3||r.fails.sol>=3))?`<div class="halt">⚠ A proteção do servidor não consegue ler a corretora há ${Math.max(r.fails.hl||0,r.fails.sol||0)*5} min. Só os stops que já estão na corretora te protegem.</div>`:'';
  const ex=r.exec&&r.exec.total?`<div class="note">Execuções reais registadas: ${r.exec.total}${r.exec.failed?` (${r.exec.failed} falhadas)`:''}${r.exec.hl&&r.exec.hl.fills?` · slippage real médio na Hyperliquid ${r.exec.hl.slipBpsMean} bps (pior ${r.exec.hl.slipBpsWorst})`:''}${r.exec.sol&&(r.exec.sol.buys||r.exec.sol.sells)?` · memecoins ${r.exec.sol.buys} compras / ${r.exec.sol.sells} vendas, resultado realizado ${usd(r.exec.sol.pnlUsd)}`:''}.</div>`:'';
  const fe=r.feeStats&&r.feeStats.n?`<div class="note">Taxas reais cobradas pela Hyperliquid (últimas ${r.feeStats.n} execuções): taker ${r.feeStats.takerBps==null?'—':r.feeStats.takerBps+' bps'} · maker ${r.feeStats.makerBps==null?'—':r.feeStats.makerBps+' bps'}. O backtest assume 9 bps taker e 3 bps maker: se estes valores forem diferentes, o teste está errado.</div>`:'';
  const nt=r.notifyOn===false?`<div class="note">🔕 Sem notificações (falta o segredo <code>NTFY_TOPIC</code> no worker): os avisos de emergência não chegam ao telemóvel.</div>`:'';
  return halt+blind+ex+fe+nt;
}
async function resume(){
  if(!confirm('Retomar a Hyperliquid? O máximo da conta passa a ser o saldo de agora e o bot pode voltar a abrir posições.'))return;
  try{await call('POST','/hl/resume',{});P.hl.err='';P.hl.st=await call('GET','/hl/state')}catch(e){P.hl.err=e.message}
  render('hl');
}
let pushMsg='';
async function testPush(k){
  try{const r=await call('POST','/notify/test',{});pushMsg=r.sent?'Notificação enviada: vê o telemóvel (app ntfy).':r.configured?'O worker tentou enviar mas o ntfy recusou.':'Falta o segredo NTFY_TOPIC no worker (vê o guia).'}catch(e){pushMsg='Erro: '+e.message}
  render(k);
}
const ago=t=>{if(!t)return'nunca';const m=Math.round((Date.now()-t)/60000);return m<1?'agora':m<60?`há ${m} min`:`há ${Math.floor(m/60)} h ${m%60} min`};
function guardHtml(k,st){
  const g=st.guard;if(!g)return'';
  if(!g.on)return`<div class="note">Proteção do servidor: <b>desligada</b> (o worker ainda não tem a memória GUARD; publica a versão nova).</div>`;
  const last=g.last&&g.last.t?ago(g.last.t):'ainda não correu';
  const run=g.last&&g.last.t&&Date.now()-g.last.t<20*60e3;
  if(k==='hl'){
    const halt=g.halted?`<div class="halt">⛔ <b>PARADO pela proteção do servidor</b>: o saldo caiu de $${(+g.halted.peak).toFixed(2)} para $${(+g.halted.eq).toFixed(2)} ${ago(g.halted.t)}. ${g.halted.mode==='real'?'As posições foram fechadas.':'(simulação)'} Nenhuma entrada nova. <button class="ghost" data-k="hl" data-a="resume">RETOMAR</button></div>`:'';
    return halt+`<div class="note">Proteção do servidor (corre a cada 5 min, mesmo com a app fechada): ${run?'<span class="up">ativa</span>':'<span class="dn">sem verificações recentes</span>'} · última ${last}${g.peak>0?` · máximo $${(+g.peak).toFixed(2)} · fecha tudo a -${Math.round(g.dd*100)}%`:''}</div>`;
  }
  return`<div class="note">Proteção do servidor (a cada 5 min, mesmo com a app fechada): ${run?'<span class="up">ativa</span>':'<span class="dn">sem verificações recentes</span>'} · última ${last}. Vende uma memecoin a -${Math.round(g.sl*100)}% ou +${Math.round(g.tp*100)}% da entrada ou ao fim de ${g.maxHours} h${g.staleMin>0?`; se a app ficar ${g.staleMin} min sem sincronizar, vende tudo`:''}.${g.blocked?` ${g.blocked} bloqueada(s) para recompra.`:''}</div>`;
}
function gateHtml(k){
  if(k==='hl'){const g=hlGate();
    return g.ok?`<div class="note">🔓 Estratégia em uso aprovada pelo teste histórico (${esc(g.label)}) até ${new Date(g.until).toISOString().slice(0,10)}.</div>`
      :`<div class="halt">🔒 <b>Dinheiro real bloqueado</b>: a estratégia em uso (${esc(g.label)}) ${esc(g.why)}. O worker recusa abrir posições na Hyperliquid enquanto nenhuma estratégia passar; fechos e stops de posições que já existam continuam a funcionar.</div>`}
  const g=memeGate();
  return g.ok?`<div class="note">🔓 O desk de memecoins em papel provou lucro (${g.n} trades, fator de lucro ${g.pf===Infinity?'∞':g.pf.toFixed(2)}): compras reais permitidas.</div>`
    :`<div class="halt">🔒 <b>Compras reais bloqueadas</b>: ${esc(g.why)}. Continua a vender o que houver na carteira.</div>`;
}
function autoHtml(st){
  const a=st.autopilot;if(!a||!a.on)return'';
  const notes=a.last&&a.last.notes?Object.entries(a.last.notes).map(([m,n])=>`${m}: ${esc(n)}`).join(' · '):'';
  return`<div class="note">🤖 <b>Piloto automático no servidor</b>: ${esc(a.label)} em velas de ${esc(a.interval)}. É o worker que decide a Hyperliquid, mesmo com a app fechada; o Macro Desk desta página fica só em papel.${a.last?`<br>Última decisão ${ago(a.last.t)}: ${notes||'—'}`:''}</div>`;
}
const tick=()=>{   // sincroniza logo que o desk muda de ideias, senão a cada intervalo
  for(const k of ['hl','sol']){
    if(!L[k])continue;
    const want=JSON.stringify(k==='hl'?hlDesired():solDesired());
    if(want!==P[k].sig||Date.now()-P[k].at>(k==='hl'?HL_EVERY:SOL_EVERY))sync(k);
  }
};

/* ===== interface ===== */
const modeTag=st=>st?`${st.network?(st.network==='mainnet'?'REDE REAL':'REDE DE TESTE')+' · ':''}${st.mode==='real'?'<b>ORDENS REAIS</b>':'SIMULAÇÃO (nada é enviado)'}${st.paused?' · PAUSADO':''}`:'a ligar…';
function offHtml(k){
  const hl=k==='hl';
  return `<div class="alh"><b>${hl?'HYPERLIQUID · LIVE':'SOLANA · LIVE (MEMECOINS)'}</b><small>${hl?'o Macro Desk (ouro, S&amp;P 500, EUR/USD) passa a operar numa conta da Hyperliquid':'o desk de memecoins passa a comprar e vender na Jupiter com uma carteira Solana dedicada'}</small></div>
    ${L.token?'':`<div class="pmbar"><input id="liveTok" type="password" autocomplete="off" placeholder="token do worker (APP_TOKEN)"></div>`}
    <div class="pmbar"><button class="ghost" data-k="${k}" data-a="on">LIGAR</button></div>
    <div class="note">Vem desligado. Mesmo ligado, é o <b>worker</b> que decide se envia ordens: só envia se tiveres ativado ${hl?'<code>HL_LIVE=1</code>':'<code>SOL_LIVE=1</code>'} no Cloudflare. Sem isso só mostra o plano. ${hl?'Começa na rede de teste.':'Usa uma carteira só para isto, com poucos dólares.'}</div>`;
}
function onHtml(k){
  const st=P[k].st,hl=k==='hl',e=P[k];
  let body='';
  if(st){
    if(hl){
      const mk=Object.entries(st.markets||{}).map(([n,m])=>`${n}: ${m?esc(m.coin)+(m.mid?' ($'+m.mid+')':''):'<span class="dn">não encontrado</span>'}`).join(' · ');
      const eq=st.account?Object.entries(st.account).map(([d,v])=>`${d} ${usd(v)}`).join(' · '):'';
      body+=`<div class="note">Mercados: ${mk}${eq?'<br>Saldo: '+eq:''}${st.agentAddress?'<br>Carteira de API: '+esc(st.agentAddress):''}</div>`;
      if(st.seen&&st.seen.length)body+=`<div class="note">Confere os preços (ouro ≈ preço da onça; S&amp;P 500 ≈ nível do índice; EUR/USD ≈ 1,1). Parecidos na Hyperliquid: ${esc(st.seen.join(' · '))}. Se o nome certo for outro, fixa-o em <code>HL_MARKETS</code> no worker.</div>`;
      if(st.rejected&&st.rejected.length)body+=`<div class="note">Rejeitados por o preço não fazer sentido: ${esc(st.rejected.join(' · '))}</div>`;
      body+=st.positions&&st.positions.length?`<table><thead><tr><th>Mercado</th><th>Lado</th><th>Qtd</th><th>Entrada</th><th>P/L</th></tr></thead><tbody>${st.positions.map(p=>`<tr><td>${esc(p.coin)}</td><td>${p.szi>0?'LONG':'SHORT'}</td><td>${Math.abs(p.szi)}</td><td>${p.entryPx}</td><td class="${p.pnl>=0?'up':'dn'}">${p.pnl>=0?'+':''}${usd(p.pnl)}</td></tr>`).join('')}</tbody></table>`:'<div class="note">Sem posições na Hyperliquid.</div>';
    }else{
      body+=`<div class="note">Carteira: ${esc(st.address)}<br>SOL ${st.sol.toFixed(4)} · USDC ${usd(st.usdc)} · ticket ${usd(st.ticket)} · máx. ${st.maxOpen} posições</div>`;
      body+=st.tokens&&st.tokens.length?`<table><thead><tr><th>Token</th><th>Quantidade</th></tr></thead><tbody>${st.tokens.map(t=>`<tr><td>${esc(t.mint.slice(0,4)+'…'+t.mint.slice(-4))}</td><td>${t.amount}</td></tr>`).join('')}</tbody></table>`:'<div class="note">Sem memecoins na carteira.</div>';
    }
  }
  return `<div class="alh"><b>${hl?'HYPERLIQUID · LIVE':'SOLANA · LIVE (MEMECOINS)'}</b><small>${modeTag(st)}</small><button class="ghost" data-k="${k}" data-a="off">DESLIGAR</button></div>
    ${e.err?`<div class="halt">⚠ ${esc(e.err)}</div>`:''}${body}
    ${riskHtml()}${gateHtml(k)}
    ${st?guardHtml(k,st)+(hl?autoHtml(st):''):''}
    ${e.log.length?`<div class="note">${e.log.join('<br>')}</div>`:''}
    <div class="pmbar"><button class="ghost" data-k="${k}" data-a="flat">FECHAR TUDO</button><button class="ghost" data-k="${k}" data-a="push">TESTAR NOTIFICAÇÃO</button><button class="ghost" data-k="${k}" data-a="panic">⛔ EMERGÊNCIA (TUDO)</button></div>
    ${pushMsg?`<div class="note">${esc(pushMsg)}</div>`:''}
    <div class="note">${hl?'Os stops ficam na própria Hyperliquid e protegem-te mesmo com a app fechada. O alvo é uma ordem limitada (taxa mais baixa).':(st&&st.guard&&st.guard.on?'Com a app aberta, as saídas seguem o desk. Com a app fechada, a proteção do servidor vende pelas regras acima.':'As saídas das memecoins só acontecem com a app aberta e a funcionar. Se fechares a app com posições abertas, ficam abertas.')}</div>`;
}
function render(k){
  const el=$l(k+'Body');if(!el)return;
  if(DEMO||!api()){el.innerHTML='<div class="note">Indisponível no modo demo ou sem o endereço do worker.</div>';return}
  el.innerHTML=L[k]?onHtml(k):offHtml(k);
  const info=$l(k+'Info');if(info)info.textContent=L[k]?(P[k].st?(P[k].st.mode==='real'?'ORDENS REAIS':'SIMULAÇÃO'):'A LIGAR…'):'DESLIGADO';
}
function bind(){
  for(const k of ['hl','sol']){
    const el=$l(k+'Body');if(!el)continue;
    el.addEventListener('click',async e=>{
      const a=e.target.dataset&&e.target.dataset.a;if(!a)return;
      if(a==='on'){const t=$l('liveTok');if(t&&t.value.trim())L.token=t.value.trim();if(!L.token)return;L[k]=true;P[k].err='';P[k].at=0;save();render(k);sync(k)}
      if(a==='off'){if(confirm('Desligar não fecha as posições abertas na corretora. Queres fechá-las agora?'))await flatten(k);L[k]=false;P[k].st=null;save();render(k)}
      if(a==='flat')flatten(k);
      if(a==='resume')resume();
      if(a==='panic')panic();
      if(a==='riskresume')riskResume();
      if(a==='push')testPush(k);
    });
    render(k);
  }
  setInterval(tick,5000);setTimeout(tick,2000);
}
const setToken=t=>{L.token=t;save();for(const k of ['hl','sol'])render(k)};
window.LIVE={hlDesired,solDesired,L,P,sync,flatten,setToken,resume,hlGate,memeGate};
if($l('hlBody'))bind();
})();
