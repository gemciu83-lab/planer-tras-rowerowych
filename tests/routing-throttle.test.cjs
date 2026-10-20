const fs=require('fs'),vm=require('vm'),assert=require('assert');
const env={DOMException,setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync(__dirname+'/../assets/planner-network.js','utf8'),env);
const create=env.PlannerNetwork.createClient;
async function tests(){
 let clock=0,active=0,maximum=0;const starts=[];
 const client=create({now:()=>clock,wait:async ms=>{clock+=ms},fetch:async()=>{starts.push(clock);active++;maximum=Math.max(maximum,active);await Promise.resolve();active--;return {ok:true,status:200}}});
 await Promise.all(Array.from({length:8},()=>client.fetch('test')));
 assert.equal(maximum,1);assert.deepEqual(starts,[0,5000,10000,15000,20000,25000,30000,35000]);
 console.log('PASS: one routing request at a time, minimum five-second gap');
 clock=0;let calls=0;const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const limited=create({storage,now:()=>clock,wait:async ms=>{clock+=ms},fetch:async()=>{calls++;return {ok:false,status:403,headers:{get:()=>null}}}});
 const blocked=await Promise.allSettled([limited.fetch('one'),limited.fetch('two'),limited.fetch('three')]);
 assert.equal(calls,1);assert(blocked.every(r=>r.status==='rejected'&&r.reason.rateLimited));assert.equal(limited.remaining(),60000);
 await assert.rejects(limited.fetch('four'),e=>e.rateLimited);assert.equal(calls,1);
 const reloaded=create({storage,now:()=>clock,fetch:async()=>{throw Error('Must not run during persisted pause')}});
 await assert.rejects(reloaded.fetch('five'),e=>e.rateLimited);
 clock=60000;await assert.rejects(limited.fetch('six'),e=>e.rateLimited);assert.equal(calls,2);assert.equal(limited.remaining(),120000);
 console.log('PASS: exact HTTP 403 refusal blocks queued requests, survives reload, increases pause on repeated refusal');
 clock=0;const retry=create({now:()=>clock,fetch:async()=>({ok:false,status:429,headers:{get:()=> '180'}})});
 await assert.rejects(retry.fetch('test'),e=>e.rateLimited);assert.equal(retry.remaining(),180000);
 console.log('PASS: HTTP 429 Retry-After respected');
 let resolveFirst,netCalls=0;clock=0;
 const queue=create({now:()=>clock,wait:async ms=>{clock+=ms},fetch:async()=>{netCalls++;if(netCalls===1)return new Promise(resolve=>{resolveFirst=resolve});return {ok:true,status:200}}});
 const first=queue.fetch('first');await Promise.resolve();
 const cancelled=new AbortController(),second=queue.fetch('second',{signal:cancelled.signal});second.catch(()=>{});cancelled.abort();
 resolveFirst({ok:true,status:200});await first;await assert.rejects(second,e=>e.name==='AbortError');await queue.fetch('third');assert.equal(netCalls,2);
 console.log('PASS: cancelled queued request never reaches routing server');
}
tests().catch(e=>{console.error(e);process.exitCode=1});
