import fs from 'node:fs'; import assert from 'node:assert/strict';
import { b58encode, b58decode, parseKeypair, signVersionedTx, makeSol } from '../sol.mjs';
const ref=JSON.parse(fs.readFileSync(new URL('./fixtures/sol_ref.json', import.meta.url),'utf8'));
const hex=u=>Buffer.from(u).toString('hex'), unh=h=>Uint8Array.from(Buffer.from(h,'hex'));
for(const [h,s] of ref.b58tests){assert.equal(b58encode(unh(h)),s);assert.equal(hex(b58decode(s)),h)} console.log('ok   base58 igual ao pacote python');
for(const raw of [ref.key64,ref.seed58,JSON.stringify(ref.json64)]){const k=parseKeypair(raw);assert.equal(b58encode(k.pub),ref.pub58);assert.equal(hex(k.seed),ref.seed)} console.log('ok   3 formatos de chave dão a mesma carteira');
assert.throws(()=>parseKeypair(b58encode(new Uint8Array(64).fill(1))),/inconsistente/);console.log('ok   chave de 64 bytes inconsistente é recusada');
const k=parseKeypair(ref.key64);
for(const c of ref.cases){
  if(c.name==='v0_other_payer'){assert.throws(()=>signVersionedTx(unh(c.tx),k.seed,k.pub),/pagador/);console.log('ok   pagador diferente é recusado');continue}
  const r=signVersionedTx(unh(c.tx),k.seed,k.pub);assert.equal(hex(r.tx.slice(1,65)),c.expectedSig);assert.equal(hex(r.tx.slice(65)),c.tx.slice(2+128));assert.equal(b58encode(unh(c.expectedSig)),r.signature);console.log('ok   assinatura idêntica à do PyNaCl:',c.name)}
// ---- fluxo com Jupiter/RPC simulados ----
const USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const M1=b58encode(new Uint8Array(32).fill(21)),M2=b58encode(new Uint8Array(32).fill(22)),M3=b58encode(new Uint8Array(32).fill(23)),M4=b58encode(new Uint8Array(32).fill(24));
function sim({sol=0.5,usdc=10,tokens=[],impact={},noRoute={},failSend=false}={}){
  const S={calls:[],sent:[],swaps:[]};
  const tx=unh(ref.cases[0].tx);
  const f=async(url,o={})=>{const R=j=>({ok:true,status:200,json:async()=>j,text:async()=>JSON.stringify(j)});
    S.calls.push(url.split('?')[0]);
    if(url.includes('helius')){const b=JSON.parse(o.body);
      if(b.method==='getBalance')return R({result:{value:Math.round(sol*1e9)}});
      if(b.method==='getTokenAccountsByOwner'){const prog=b.params[1].programId;if(!prog.startsWith('Tokenkeg'))return R({result:{value:[]}});
        const mk=(mint,ui,dec,raw)=>({account:{data:{parsed:{info:{mint,tokenAmount:{amount:raw,decimals:dec,uiAmountString:String(ui)}}}}}});
        return R({result:{value:[mk(USDC,usdc,6,String(usdc*1e6)),...tokens.map(t=>mk(t.mint,t.ui,6,String(t.ui*1e6)))]}})}
      if(b.method==='sendTransaction'){if(failSend)return R({error:{message:'Blockhash not found'}});S.sent.push(b.params[0]);return R({result:'sig'})}
      if(b.method==='getSignatureStatuses')return R({result:{value:[{confirmationStatus:'confirmed',err:null}]}});}
    if(url.includes('/quote')){const u=new URL(url);const inM=u.searchParams.get('inputMint'),outM=u.searchParams.get('outputMint');const mint=inM===USDC?outM:inM;
      if(noRoute[mint])return R({error:'Could not find any route'});
      return R({inputMint:inM,outputMint:outM,inAmount:u.searchParams.get('amount'),outAmount:'12345',priceImpactPct:String(impact[mint]??0.001)})}
    if(url.endsWith('/swap')){S.swaps.push(JSON.parse(o.body));return R({swapTransaction:Buffer.from(tx).toString('base64')})}
    throw new Error('rota inesperada '+url)};
  return {S,f};
}
const env=(x={})=>({SOL_KEY:ref.key64,HELIUS_API_KEY:'k',...x});
{const {S,f}=sim();const r=await makeSol(env(),f).sync([M1,M2]);assert.equal(r.mode,'simulacao');assert.equal(S.swaps.length,0);assert.equal(S.sent.length,0);assert.equal(r.plan.length,2);assert.ok(r.results.every(x=>x.simulated));console.log('ok   simulação: cotações sim, assinar/enviar não')}
{const {S,f}=sim();const r=await makeSol(env({SOL_LIVE:'1'}),f).sync([M1,M2]);assert.equal(S.sent.length,2);assert.equal(r.results.filter(x=>x.ok).length,2);
 const q=S.swaps[0].quoteResponse;assert.equal(q.inAmount,'2000000');assert.equal(S.swaps[0].userPublicKey,ref.pub58);
 const raw=unh(Buffer.from(S.sent[0],'base64').toString('hex'));assert.equal(hex(raw.slice(1,65)),ref.cases[0].expectedSig);console.log('ok   real: 2 compras de $2, transação assinada pela nossa carteira')}
{const {S,f}=sim();const r=await makeSol(env({SOL_LIVE:'1',SOL_MAX_OPEN:'2'}),f).sync([M1,M2,M3]);assert.equal(S.sent.length,2);assert.match(r.skipped[0].reason,/máximo/);console.log('ok   máximo de posições')}
{const {S,f}=sim();const r=await makeSol(env({SOL_LIVE:'1',SOL_TICKET_USD:'50'}),f).sync([M1]);assert.equal(S.swaps[0].quoteResponse.inAmount,'5000000');console.log('ok   ticket limitado ao teto de $5')}
{const {S,f}=sim({usdc:1});const r=await makeSol(env({SOL_LIVE:'1'}),f).sync([M1]);assert.equal(S.sent.length,0);assert.match(r.skipped[0].reason,/USDC insuficiente/);console.log('ok   USDC insuficiente')}
{const {S,f}=sim({sol:0.002});const r=await makeSol(env({SOL_LIVE:'1'}),f).sync([M1]);assert.equal(S.sent.length,0);assert.match(r.skipped[0].reason,/SOL insuficiente/);console.log('ok   SOL insuficiente para taxas')}
{const {S,f}=sim({impact:{[M1]:0.2}});const r=await makeSol(env({SOL_LIVE:'1'}),f).sync([M1,M2]);assert.equal(S.sent.length,1);assert.match(r.results[0].error,/impacto/);console.log('ok   impacto de preço >5% recusado e continua para o próximo')}
{const {S,f}=sim({tokens:[{mint:M1,ui:3},{mint:M2,ui:5}]});const r=await makeSol(env({SOL_LIVE:'1'}),f).sync([M1]);assert.equal(S.sent.length,1);assert.equal(r.plan[0].op,'sell');assert.equal(r.plan[0].mint,M2);assert.equal(S.swaps[0].quoteResponse.inAmount,'5000000');console.log('ok   vende o que o desk já não quer; mantém o que quer')}
{const {S,f}=sim({tokens:[{mint:M1,ui:3},{mint:M2,ui:5}],noRoute:{[M1]:true}});const r=await makeSol(env({SOL_LIVE:'1'}),f).flatten();assert.equal(S.sent.length,1);assert.match(r.results.find(x=>!x.ok).error,/sem rota/);console.log('ok   flatten: uma sem rota não impede as outras')}
{const {S,f}=sim();const r=await makeSol(env({SOL_LIVE:'1',SOL_PAUSED:'1'}),f).sync([M1]);assert.equal(S.sent.length,0);console.log('ok   SOL_PAUSED bloqueia compras')}
{const {S,f}=sim();const r=await makeSol(env({SOL_LIVE:'1'}),f).sync(['abc',USDC,M1]);assert.equal(r.skipped[0].reason,'mint inválido');assert.equal(S.sent.length,1);console.log('ok   mint inválido ignorado; USDC nunca é comprado')}
{const {S,f}=sim({failSend:true});const r=await makeSol(env({SOL_LIVE:'1'}),f).sync([M1]);assert.equal(r.results[0].ok,false);assert.match(r.results[0].error,/Blockhash/);console.log('ok   erro do RPC fica registado')}
{const {S,f}=sim({tokens:[{mint:M1,ui:3}]});const st=await makeSol(env(),f).state();assert.equal(st.address,ref.pub58);assert.equal(st.usdc,10);assert.equal(st.tokens.length,1);console.log('ok   estado:',JSON.stringify({sol:st.sol,usdc:st.usdc,tokens:st.tokens.length}))}
console.log('TUDO OK');
