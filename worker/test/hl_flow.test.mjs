import assert from 'node:assert/strict';
import { makeHL } from '../hl.mjs';
const AGENT='0x'+'22'.repeat(32), ACC='0x'+'33'.repeat(20);
function sim({equity=100, mid=4000, failStop=false, positions=[], orders=[], fillOrders=true}={}){
  const S={calls:[],positions:[...positions],orders:[...orders],equity,mid};
  const f=async(url,o)=>{const body=JSON.parse(o.body);const R=j=>({ok:true,status:200,text:async()=>JSON.stringify(j),json:async()=>j});
    S.calls.push({url:url.split('.xyz')[1]||url,body});
    if(url.endsWith('/info')){
      if(body.type==='perpDexs')return R([null,{name:'xyz'}]);
      if(body.type==='meta')return R({universe:body.dex==='xyz'?[{name:'xyz:GOLD',szDecimals:4,maxLeverage:10},{name:'xyz:SP500',szDecimals:3,maxLeverage:10},{name:'xyz:JPY',szDecimals:2,maxLeverage:20}]:[{name:'BTC',szDecimals:5,maxLeverage:40}]});
      if(body.type==='allMids')return R(body.dex==='xyz'?{'xyz:GOLD':String(S.mid),'xyz:SP500':'5200.5','xyz:JPY':'150'}:{BTC:'60000'});
      if(body.type==='clearinghouseState')return R({marginSummary:{accountValue:String(S.equity)},assetPositions:S.positions.map(p=>({position:{coin:p.coin,szi:String(p.szi),entryPx:'4000',unrealizedPnl:'0'}}))});
      if(body.type==='openOrders')return R(S.orders);
    }
    if(url.endsWith('/exchange')){const a=body.action;
      assert.ok(body.signature.r.startsWith('0x')&&[27,28].includes(body.signature.v));assert.equal(body.vaultAddress,null);
      if(a.type==='updateLeverage'){S.lev=a;return R({status:'ok',response:{type:'default'}})}
      if(a.type==='cancel'){S.orders=S.orders.filter(x=>!a.cancels.some(c=>c.o===x.oid));return R({status:'ok',response:{type:'cancel',data:{statuses:a.cancels.map(()=>'success')}}})}
      if(a.type==='order'){
        const st=a.orders.map(o=>{
          if(o.t.trigger){if(failStop)return{error:'Trigger rejeitado'};S.orders.push({coin:'xyz:GOLD',oid:900+S.orders.length,reduceOnly:true});return{resting:{oid:900}}}
          if(!fillOrders)return{error:'sem liquidez'};
          if(o.r){S.positions=S.positions.filter(p=>p.coin!=='xyz:GOLD');return{filled:{totalSz:o.s,avgPx:o.p,oid:1}}}
          S.positions.push({coin:'xyz:GOLD',szi:(o.b?1:-1)*parseFloat(o.s)});return{filled:{totalSz:o.s,avgPx:o.p,oid:1}}});
        return R({status:'ok',response:{type:'order',data:{statuses:st}}})}
    }
    throw new Error('rota inesperada '+url)};
  return {S,f};
}
const env=(x={})=>({HL_AGENT_KEY:AGENT,HL_ACCOUNT:ACC,...x});
const ex=S=>S.calls.filter(c=>c.url==='/exchange');
const want={GOLD:{side:'long',frac:0.667,slPct:0.01,tpPct:0.015}};
let t=0;const ok=(n)=>console.log('ok  ',n,'');

// 1 simulação: plano sem enviar nada
{const {S,f}=sim();const hl=makeHL(env(),f);const r=await hl.sync(want);
 assert.equal(r.mode,'simulacao');assert.equal(ex(S).length,0);assert.equal(r.plan[0].op,'open');assert.equal(r.plan[0].usd<=15,true);
 console.log('plano:',JSON.stringify(r.plan[0]));ok('1 simulação não envia nada (limite $15 por ordem)')}
// 2 real em testnet: entrada + stops
{const {S,f}=sim();const hl=makeHL(env({HL_LIVE:'1'}),f);const r=await hl.sync(want);
 const types=ex(S).map(c=>c.body.action.type+(c.body.action.orders?':'+c.body.action.orders.length:''));
 assert.deepEqual(types,['updateLeverage','order:1','order:2']);
 const entry=ex(S)[1].body.action.orders[0],stops=ex(S)[2].body.action.orders;
 assert.equal(entry.b,true);assert.equal(entry.r,false);assert.equal(entry.t.limit.tif,'Ioc');assert.ok(parseFloat(entry.p)>4000);
 assert.ok(stops.every(s=>s.r===true&&s.b===false&&s.t.trigger.isMarket));assert.deepEqual(stops.map(s=>s.t.trigger.tpsl),['sl','tp']);
 assert.equal(S.lev.isCross,false);assert.equal(S.lev.leverage,3);assert.equal(r.results.at(-1).ok,true);ok('2 testnet: alavancagem isolada 3x, entrada IOC e stops reduce-only')}
// 3 abaixo do mínimo ($10)
{const {S,f}=sim({equity:10});const hl=makeHL(env({HL_LIVE:'1'}),f);const r=await hl.sync(want);
 assert.equal(ex(S).length,0);assert.match(r.skipped[0].reason,/abaixo do mínimo/);console.log('   ',r.skipped[0].reason);ok('3 saldo $10 -> não opera (mínimo por ordem)')}
// 4 mainnet sem confirmação continua em simulação
{const {S,f}=sim();const hl=makeHL(env({HL_LIVE:'1',HL_NETWORK:'mainnet'}),f);const r=await hl.sync(want);
 assert.equal(r.mode,'simulacao');assert.equal(ex(S).length,0);assert.ok(S.calls[0].url.length>0);ok('4 mainnet sem HL_CONFIRM_MAINNET=YES fica em simulação')}
{const {S,f}=sim();const hl=makeHL(env({HL_LIVE:'1',HL_NETWORK:'mainnet',HL_CONFIRM_MAINNET:'YES'}),f);const r=await hl.sync(want);assert.equal(r.mode,'real');ok('4b mainnet com confirmação explícita fica real')}
// 5 pausa
{const {S,f}=sim();const hl=makeHL(env({HL_LIVE:'1',HL_PAUSED:'1'}),f);const r=await hl.sync(want);
 assert.equal(ex(S).length,0);assert.match(r.skipped[0].reason,/pausado/);ok('5 HL_PAUSED bloqueia aberturas')}
// 6 limite bruto
{const {S,f}=sim({equity:1000});const hl=makeHL(env({HL_LIVE:'1',HL_MAX_ORDER_USD:'50',HL_MAX_GROSS_USD:'30'}),f);const r=await hl.sync(want);
 assert.ok(r.plan[0].usd<=30.01,'usd='+r.plan[0].usd);ok('6 limite bruto $30 respeitado ('+r.plan[0].usd+')')}
// 7 stop recusado -> fecha a posição
{const {S,f}=sim({failStop:true});const hl=makeHL(env({HL_LIVE:'1'}),f);const r=await hl.sync(want);
 const last=ex(S).at(-1).body.action.orders[0];assert.equal(last.r,true);assert.equal(last.b,false);assert.equal(S.positions.length,0);assert.equal(r.results.at(-1).ok,false);ok('7 stop recusado -> posição fechada logo')}
// 8 entrada não preenchida
{const {S,f}=sim({fillOrders:false});const hl=makeHL(env({HL_LIVE:'1'}),f);const r=await hl.sync(want);
 assert.equal(ex(S).length,2);assert.equal(r.results.at(-1).ok,false);ok('8 entrada sem liquidez -> sem stops, sem posição')}
// 9 fechar quando o desk já não quer + cancelar ordens órfãs
{const {S,f}=sim({positions:[{coin:'xyz:GOLD',szi:0.0024}],orders:[{coin:'xyz:GOLD',oid:77}]});const hl=makeHL(env({HL_LIVE:'1'}),f);const r=await hl.sync({});
 const a=ex(S)[0].body.action;assert.equal(a.orders[0].r,true);assert.equal(a.orders[0].b,false);assert.equal(S.positions.length,0);assert.equal(S.orders.length,0);ok('9 desk sem posição -> fecha e cancela stops pendentes')}
{const {S,f}=sim({orders:[{coin:'xyz:GOLD',oid:5}]});const hl=makeHL(env({HL_LIVE:'1'}),f);await hl.sync({});assert.equal(S.orders.length,0);ok('9b stop órfão sem posição é cancelado')}
// 10 lado contrário: fecha agora, abre na sincronização seguinte
{const {S,f}=sim({positions:[{coin:'xyz:GOLD',szi:0.0024}]});const hl=makeHL(env({HL_LIVE:'1'}),f);await hl.sync({GOLD:{side:'short',frac:.5}});
 assert.equal(ex(S).length,1);assert.equal(S.positions.length,0);await hl.sync({GOLD:{side:'short',frac:.5}});assert.equal(S.positions[0].szi<0,true);ok('10 inversão: fecha primeiro, abre depois')}
// 11 flatten
{const {S,f}=sim({positions:[{coin:'xyz:GOLD',szi:-0.002}]});const hl=makeHL(env({HL_LIVE:'1',HL_PAUSED:'1'}),f);await hl.flatten();assert.equal(S.positions.length,0);ok('11 flatten fecha mesmo em pausa')}
// 12 mercado não encontrado + sem chave
{const {S,f}=sim();const hl=makeHL(env({HL_LIVE:'1'}),f);const r=await hl.sync({EURUSD:{side:'long',frac:.5}});assert.match(r.skipped[0].reason,/não encontrado/);ok('12 EUR/USD inexistente -> avisa e ignora')}
{const {S,f}=sim();const hl=makeHL({HL_LIVE:'1'},f);await assert.rejects(()=>hl.sync(want).then(r=>{if(r.results.length)throw new Error('enviou');return hl.sync({}).then(()=>{throw new Error('nada falhou')})}),/HL_AGENT_KEY|HL_ACCOUNT|nada falhou/);ok('13 sem segredos não envia nada')}
// 14 estado
{const {S,f}=sim();const hl=makeHL(env(),f);const st=await hl.state();assert.equal(st.markets.GOLD.coin,'xyz:GOLD');assert.equal(st.markets.GOLD.asset,110000);assert.equal(st.markets.SPX.asset,110001);assert.equal(st.markets.EURUSD,null);assert.ok(st.agentAddress.startsWith('0x'));console.log('   ',JSON.stringify(st.markets));ok('14 estado: ids dos mercados e endereço da carteira de API')}
console.log('TUDO OK');
// 15 corrida: outra sincronização abriu a posição entre o plano e a ordem
{ const {S,f}=sim(); const hl=makeHL(env({HL_LIVE:'1'}),f);
  let n=0; const f2=async(u,o)=>{ const b=JSON.parse(o.body); if(u.endsWith('/info')&&b.type==='clearinghouseState'&&++n===2) S.positions.push({coin:'xyz:GOLD',szi:0.0024}); return f(u,o); };
  const hl2=makeHL(env({HL_LIVE:'1'}),f2); const r=await hl2.sync(want);
  assert.equal(ex(S).length,0); assert.match(JSON.stringify(r.results[0].detail),/já existe/); console.log('ok   15 corrida entre duas sincronizações: não duplica'); }
// 16 sem HL_ACCOUNT: erro claro em vez de pedir à Hyperliquid
{ const {S,f}=sim(); const hl=makeHL({HL_AGENT_KEY:AGENT},f); await assert.rejects(()=>hl.sync(want),/HL_ACCOUNT em falta/); console.log('ok   16 sem HL_ACCOUNT -> erro claro'); const st=await hl.state(); assert.equal(st.markets.GOLD.coin,'xyz:GOLD'); assert.ok(st.agentAddress); console.log('ok   16b o estado mostra os mercados mesmo sem conta'); }

// 17 o "SPX" do mercado principal (memecoin) não pode passar por S&P 500; só xyz com preço plausível
{ const f=async(u,o)=>{const b=JSON.parse(o.body);const R=j=>({ok:true,status:200,text:async()=>JSON.stringify(j),json:async()=>j});
    if(b.type==='perpDexs')return R([null,{name:'xyz'}]);
    if(b.type==='meta')return R({universe:b.dex==='xyz'?[{name:'xyz:GOLD',szDecimals:4,maxLeverage:10},{name:'xyz:SP500',szDecimals:3,maxLeverage:10},{name:'xyz:EUR',szDecimals:2,maxLeverage:10}]:[{name:'SPX',szDecimals:1,maxLeverage:5},{name:'GOLD',szDecimals:2,maxLeverage:5}]});
    if(b.type==='allMids')return R(b.dex==='xyz'?{'xyz:GOLD':'4100','xyz:SP500':'7600','xyz:EUR':'1.12'}:{SPX:'1.3',GOLD:'0.5'});
    throw new Error('x')};
  const d=await makeHL(env(),f).discover();
  assert.equal(d.resolved.SPX.coin,'xyz:SP500'); assert.equal(d.resolved.GOLD.coin,'xyz:GOLD'); assert.equal(d.resolved.EURUSD.coin,'xyz:EUR');
  // se o único candidato tiver um preço absurdo, fica por resolver
  const f2=async(u,o)=>{const b=JSON.parse(o.body);if(b.type==='allMids'&&b.dex==='xyz')return {ok:true,status:200,json:async()=>({'xyz:GOLD':'4100','xyz:SP500':'1.3','xyz:EUR':'1.12'}),text:async()=>''};return f(u,o)};
  const d2=await makeHL(env(),f2).discover(); assert.equal(d2.resolved.SPX,null); assert.ok(d2.rejected.some(x=>x.includes('SP500')));
  console.log('ok   17 SPX da memecoin e preços absurdos são rejeitados'); }
