/* Routing transport: serialize requests and respect server backoff. */
(function(root){
 'use strict';
 function createClient(options={}){
  const request=options.fetch||root.fetch.bind(root),now=options.now||Date.now;
  const minGap=options.minGapMs??5000,basePause=options.basePauseMs??60000;
  const storage=options.storage,key='rowerem-routing-pause-v1';
  let tail=Promise.resolve(),nextAt=0,pausedUntil=0,failures=0;
  try{const value=JSON.parse(storage?.getItem(key)||'null');if(value&&Number.isFinite(value.until)&&value.until>now())pausedUntil=value.until}catch{}
  function abort(signal){if(signal?.aborted)throw new DOMException('Anulowano','AbortError')}
  function sleep(ms,signal){
   if(options.wait)return options.wait(ms,signal);
   return new Promise((resolve,reject)=>{
    abort(signal);
    const cancel=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(new DOMException('Anulowano','AbortError'))};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve()},ms);
    signal?.addEventListener('abort',cancel,{once:true});
   });
  }
  function remaining(){return Math.max(0,pausedUntil-now())}
  function pauseError(){const left=Math.ceil(remaining()/1000);const error=Error(left>0?'Serwer tras prosi o przerwę. Odczekaj co najmniej '+left+' s, potem kliknij „Wyznacz trasę”. Punkty są zachowane.':'Obliczenia automatyczne są wstrzymane po odmowie serwera. Kliknij „Wyznacz trasę”, aby ponowić. Punkty są zachowane.');error.routing=true;error.rateLimited=true;error.retryAt=pausedUntil;return error}
  function savePause(){try{storage?.setItem(key,JSON.stringify({until:pausedUntil}))}catch{}}
  function retryDelay(response){
   const value=response.headers?.get?.('Retry-After');
   if(value){const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return seconds*1000;const date=Date.parse(value);if(Number.isFinite(date))return Math.max(0,date-now())}
   return basePause*Math.min(15,2**failures);
  }
  async function perform(url,init){
   abort(init.signal);if(remaining())throw pauseError();
   const delay=nextAt-now();if(delay>0)await sleep(delay,init.signal);
   abort(init.signal);if(remaining())throw pauseError();
   try{
    const response=await request(url,init);
    if(response.status===403||response.status===429){
     pausedUntil=now()+Math.max(basePause,retryDelay(response));failures++;savePause();
     const error=pauseError();error.httpStatus=response.status;options.onPause?.(error);throw error;
    }
    if(response.ok){failures=0;pausedUntil=0;try{storage?.removeItem(key)}catch{}}
    return response;
   }finally{nextAt=now()+minGap}
  }
  function fetchRoute(url,init={}){
   const result=tail.then(()=>perform(url,init));tail=result.catch(()=>{});return result;
  }
  return {fetch:fetchRoute,remaining,pauseError};
 }
 root.PlannerNetwork={createClient};
})(typeof globalThis!=='undefined'?globalThis:this);
