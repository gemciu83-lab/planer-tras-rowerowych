/* Same-origin update checks; no service worker or automatic reload. */
(function(root){
 'use strict';
 const version='3.11.0',app='planer-tras-rowerowych',key='rowerem-update-recovery-v1';
 function compare(a,b){const valid=v=>typeof v==='string'&&/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v);if(!valid(a)||!valid(b))return null;const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0}
 function manifest(value){
  if(!value||value.app!==app||compare(value.version,version)===null||!/^[a-f0-9]{64}$/.test(value.indexSHA||'')||!Array.isArray(value.assets)||value.assets.length<5||value.assets.length>50)return null;
  const seen=new Set();for(const a of value.assets){if(!a||!/^assets\/[a-z0-9-]+\.(js|css)$/.test(a.path)||!/^[a-f0-9]{64}$/.test(a.sha256||'')||seen.has(a.path))return null;seen.add(a.path)}
  if(!['assets/app.js','assets/planner-core.js','assets/planner.css','assets/planner-release.js'].every(a=>seen.has(a)))return null;return value;
 }
 function recovery(value,token,now=Date.now()){
  if(!value||!token||value.token!==token||value.version!==version||!Number.isFinite(value.time)||now-value.time<0||now-value.time>900000)return null;
  return root.PlannerCore.sanitizeTrip(value.snapshot);
 }
 root.PlannerRelease={version,app,key,compare,manifest,recovery};
})(typeof globalThis!=='undefined'?globalThis:this);
let availableRelease=null,releaseChecking=false,releaseApplying=false,releaseLastCheck=0,releaseDismissed='';
async function releaseFetch(file,signal){
 const url=new URL(file,location.href);url.search='check='+Date.now();url.hash='';const response=await fetch(url,{cache:'no-store',signal});if(!response.ok)throw Error('HTTP '+response.status);return response;
}
async function checkRelease(manual=false){
 if(releaseChecking||releaseApplying||location.protocol==='file:')return;
 releaseChecking=true;releaseLastCheck=Date.now();$('checkRelease').disabled=true;
 if(manual)$('releaseStatus').textContent='Sprawdzam…';
 const request=new AbortController(),timer=setTimeout(()=>request.abort(),10000);
 try{
  const value=PlannerRelease.manifest(await (await releaseFetch('version.json',request.signal)).json());if(!value)throw Error('Nieprawidłowy opis wersji');
  if(PlannerRelease.compare(value.version,PlannerRelease.version)>0){availableRelease=value;$('releaseMessage').textContent='Dostępna wersja '+value.version+'.';if(manual||releaseDismissed!==value.version)$('releaseBanner').hidden=false;$('releaseStatus').textContent='Nowa '+value.version}
  else{availableRelease=null;$('releaseBanner').hidden=true;$('releaseStatus').textContent=manual?'Masz aktualną wersję.':''}
 }catch{$('releaseStatus').textContent=manual?'Nie udało się sprawdzić wersji.':''}
 finally{clearTimeout(timer);releaseChecking=false;$('checkRelease').disabled=false}
}
async function releaseHash(buffer){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',buffer));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
function releaseBusy(){return mapDistancePending||pngExporting||!!gpxEditTask||!!gpxElevationTask||!!energyRequest||!!loopGenerating||!!routeDrag}
async function applyRelease(){
 if(!availableRelease||releaseApplying)return;
 if(releaseBusy()){$('releaseMessage').textContent='Zakończ bieżące obliczenia lub eksport, potem ponów aktualizację.';return}
 const target=availableRelease;releaseApplying=true;$('applyRelease').disabled=true;$('releaseMessage').textContent='Sprawdzam komplet plików nowej wersji…';
 const request=new AbortController(),timer=setTimeout(()=>request.abort(),60000);
 try{
  if(!crypto?.subtle)throw Error('Przeglądarka nie udostępnia weryfikacji plików.');
  const page=await (await releaseFetch('index.html',request.signal)).arrayBuffer();if(await releaseHash(page)!==target.indexSHA)throw Error('Strona nowej wersji nie jest jeszcze opublikowana w komplecie.');
  let at=0;await Promise.all(Array.from({length:3},async()=>{while(at<target.assets.length){const asset=target.assets[at++],buffer=await (await releaseFetch(asset.path,request.signal)).arrayBuffer();if(await releaseHash(buffer)!==asset.sha256)throw Error('Pliki aktualizacji są jeszcze niespójne.')}}));
  const latest=PlannerRelease.manifest(await (await releaseFetch('version.json',request.signal)).json());if(!latest||JSON.stringify(latest)!==JSON.stringify(target))throw Error('W trakcie sprawdzania pojawiła się inna wersja. Sprawdź ponownie.');
  if(releaseBusy())throw Error('Trwają obliczenia lub eksport. Ponów po ich zakończeniu.');
  const token=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('-'),payload={token,time:Date.now(),version:target.version,snapshot:captureTrip()};
  const json=JSON.stringify(payload);try{sessionStorage.setItem(PlannerRelease.key,json);if(sessionStorage.getItem(PlannerRelease.key)!==json)throw Error()}catch{throw Error('Brak miejsca na kopię bieżącej pracy. Zapisz lub wyeksportuj trasę przed ręcznym odświeżeniem.');}
  const url=new URL('index.html',location.href);url.searchParams.set('v',target.version);url.searchParams.set('restoreUpdate',token);location.replace(url.href);
 }catch(error){request.abort();$('releaseMessage').textContent=(error.name==='AbortError'?'Sprawdzanie aktualizacji przekroczyło czas.':error.message)+' Bieżąca praca pozostaje w tej karcie.'}
 finally{clearTimeout(timer);releaseApplying=false;$('applyRelease').disabled=false}
}
async function restoreReleaseWork(){
 const url=new URL(location.href),token=url.searchParams.get('restoreUpdate');if(!token)return;
 url.searchParams.delete('restoreUpdate');history.replaceState(null,'',url.href);
 try{
  const snapshot=PlannerRelease.recovery(JSON.parse(sessionStorage.getItem(PlannerRelease.key)||'null'),token);if(!snapshot)throw Error();
  const start=revision;if(typeof PlannerCompute!=='undefined')await PlannerCompute.prepare(snapshot.track);if(start!==revision)throw Error();applyTrip(snapshot,true);sessionStorage.removeItem(PlannerRelease.key);status('Wersja '+PlannerRelease.version+'. Przywrócono pracę po świadomej aktualizacji.');
 }catch{status('Nie udało się przywrócić kopii aktualizacji. Sprawdź ręcznie zapisane wyprawy lub kopię GPX.',true)}
}
function initReleaseControls(){
 $('checkRelease').onclick=()=>checkRelease(true);$('applyRelease').onclick=applyRelease;$('dismissRelease').onclick=()=>{releaseDismissed=availableRelease?.version||'';$('releaseBanner').hidden=true};
 restoreReleaseWork();setTimeout(()=>checkRelease(false),4000);setInterval(()=>{if(document.visibilityState==='visible')checkRelease(false)},900000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-releaseLastCheck>300000)checkRelease(false)});
}
