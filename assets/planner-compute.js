/* Worker jobs are keyed to immutable track references. Older jobs cannot replace a route. */
(function(root){
 'use strict';
 const jobs=new Map(),pending=new WeakMap();let worker=null,id=0,disabled=false;
 function fail(){disabled=true;worker?.terminate();worker=null;for(const job of jobs.values()){clearTimeout(job.timer);job.resolve(false)}jobs.clear()}
 function prepare(track){
  if(track.length<5000||disabled||typeof root.Worker!=='function')return Promise.resolve(false);
  if(pending.has(track))return pending.get(track);
  const promise=new Promise(resolve=>{
   try{
    if(!worker){worker=new Worker('assets/planner-worker.js?v=3.11.0');worker.onerror=fail;worker.onmessage=({data})=>{const job=jobs.get(data.id);if(!job)return;jobs.delete(data.id);clearTimeout(job.timer);if(!data.error){root.PlannerCore.seed(job.track,data);root.PlannerCompute.last={mode:'worker',points:job.track.length,milliseconds:data.milliseconds}}job.resolve(!data.error)}}
    const key=++id;jobs.set(key,{track,resolve,timer:setTimeout(fail,20000)});worker.postMessage({id:key,track});
   }catch{fail();resolve(false)}
  });pending.set(track,promise);return promise;
 }
 root.PlannerCompute={prepare,last:null};
})(typeof globalThis!=='undefined'?globalThis:this);
