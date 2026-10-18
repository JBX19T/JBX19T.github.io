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
const P={hl:{st:null,last:null,err:'',busy:false,log:[],sig:null,at:0},sol:{st:null,last:null,err:'',busy:false,log:[],sig:null,at:0}};
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

/* ===== o que cada desk quer ter ===== */
function hlDesired(){
  const K=window.MACRO;if(!K)return {};
  const S=K.state(),eq=K.equity(),d={};
  for(const m of K.MK){const p=S.pos[m.key];if(!p||!(eq>0))continue;
    d[m.key]={side:p.side>0?'long':'short',frac:+(p.notional/eq).toFixed(4),slPct:+(Math.abs(p.entry-p.stop)/p.entry).toFixed(5),tpPct:+(Math.abs(p.tp-p.entry)/p.entry).toFixed(5)}}
  return d;
}
function solDesired(){
  try{return S.positions.filter(p=>p.t&&p.t.chain==='solana'&&p.t.addr&&!String(p.t.addr).startsWith('demo')).map(p=>p.t.addr)}catch(e){return[]}
}

/* ===== sincronização ===== */
async function sync(k){
  const on=L[k];if(!on||P[k].busy||DEMO||!api()||!L.token)return;
  P[k].busy=true;
  try{
    const want=k==='hl'?hlDesired():solDesired();P[k].sig=JSON.stringify(want);
    P[k].err='';
    try{P[k].st=await call('GET',`/${k}/state`)}catch(e){P[k].err=e.message}   // o estado (mercados, saldo) mostra-se mesmo que a sincronização falhe
    const auto=k==='hl'&&P.hl.st&&P.hl.st.autopilot&&P.hl.st.autopilot.on;   // piloto automático no servidor: a app só observa
    if(!auto)try{P[k].last=await call('POST',`/${k}/sync`,{desired:want});remember(k,P[k].last);P[k].st=await call('GET',`/${k}/state`).catch(()=>P[k].st)}catch(e){P[k].err=e.message}
    P[k].at=Date.now();
  }catch(e){P[k].err=e.message}
  P[k].busy=false;render(k);
}
async function flatten(k){
  if(!confirm(k==='hl'?'Fechar já todas as posições da Hyperliquid (ouro, S&P, EUR/USD)?':'Vender já todas as memecoins da carteira Solana?'))return;
  try{const r=await call('POST',`/${k}/flatten`,{});remember(k,r);P[k].err='';P[k].st=await call('GET',`/${k}/state`)}catch(e){P[k].err=e.message}
  render(k);
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
    ${st?guardHtml(k,st)+(hl?autoHtml(st):''):''}
    ${e.log.length?`<div class="note">${e.log.join('<br>')}</div>`:''}
    <div class="pmbar"><button class="ghost" data-k="${k}" data-a="flat">FECHAR TUDO</button><button class="ghost" data-k="${k}" data-a="push">TESTAR NOTIFICAÇÃO</button></div>
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
      if(a==='push')testPush(k);
    });
    render(k);
  }
  setInterval(tick,5000);setTimeout(tick,2000);
}
const setToken=t=>{L.token=t;save();for(const k of ['hl','sol'])render(k)};
window.LIVE={hlDesired,solDesired,L,P,sync,flatten,setToken,resume};
if($l('hlBody'))bind();
})();
