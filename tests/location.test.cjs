const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const app=fs.readFileSync(path.join(__dirname,'../assets/app.js'),'utf8');
const gps=app.slice(app.indexOf('let gpsSession=null;'),app.indexOf("window.addEventListener('pagehide'"));
function setup({points=[],watch=true}={}){
 const nodes=new Map(),jobs=new Map(),calls={quick:[],watch:[],clear:[],views:[],status:[],draws:[]};let id=0;
 const env={Date,Number,JSON,Math,window:{isSecureContext:true},navigator:{geolocation:{
  getCurrentPosition:(ok,fail,options)=>calls.quick.push({ok,fail,options}),
  clearWatch:n=>calls.clear.push(n)
 }},setTimeout:(fn,ms)=>{jobs.set(++id,{fn,ms});return id},clearTimeout:n=>jobs.delete(n),stopFollow(){},status:(...args)=>calls.status.push(args),showGPSQuality(p){node('gpsQuality').textContent='GPS ±'+p.coords.accuracy+' m'},
 map:{setView:(...args)=>calls.views.push(args)},setGPSStart(lon,lat){env.points[0]=[lon,lat];env.revision++},
 $:node,L:{circle:()=>layer(),circleMarker:()=>layer()}};
 function node(n){if(!nodes.has(n))nodes.set(n,{textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this[k]=v}});return nodes.get(n)}
 function layer(){return {addTo(){return this},bindTooltip(){return this},on(){return this},setLatLng(p){calls.draws.push(p);return this},setRadius(){return this},setTooltipContent(){return this}}}
 if(watch)env.navigator.geolocation.watchPosition=(ok,fail,options)=>{calls.watch.push({ok,fail,options});return calls.watch.length};
 Object.assign(env,{points,revision:0,locationMarker:null,accuracyCircle:null});vm.createContext(env);vm.runInContext(gps,env);
 const fix=(lon=19,lat=51,accuracy=150,age=0)=>({coords:{longitude:lon,latitude:lat,accuracy},timestamp:Date.now()-age});
 return {env,calls,jobs,node,fix,run:s=>vm.runInContext(s,env)};
}
{
 const t=setup();t.run('locate(true)');assert.equal(t.calls.quick[0].options.maximumAge,60000);assert.equal(t.calls.watch[0].options.maximumAge,0);
 t.calls.watch[0].ok(t.fix());assert.deepEqual(t.env.points,[[19,51]]);assert.equal(t.node('locate')['aria-busy'],'false');
 assert(![...t.jobs.values()].some(j=>j.ms===8000||j.ms===1200));
 t.calls.watch[0].ok(t.fix(19.001,51,30));assert.deepEqual(t.env.points,[[19.001,51]]);
 t.env.points.push([20,52]);t.env.revision++;t.calls.watch[0].ok(t.fix(19.002,51,5));assert.deepEqual(t.env.points,[[19.001,51],[20,52]]);assert.equal(t.calls.clear.length,1);
 console.log('PASS: first GPS fix sets S immediately; refinement stops moving S after waypoint 1');
}
{
 const t=setup();t.run('locate(true)');t.calls.quick[0].ok(t.fix(18,50,5,30000));assert.deepEqual(t.env.points,[[18,50]]);assert.match(t.node('locationInfo').textContent,/pomiar sprzed/);
 t.calls.watch[0].ok(t.fix(19,51,150));assert.deepEqual(t.env.points,[[19,51]]);assert(!t.node('locationInfo').textContent.includes('pomiar sprzed'));
 t.calls.quick[0].ok(t.fix(18,50,1,30000));assert.deepEqual(t.env.points,[[19,51]]);
 console.log('PASS: recent browser fix is labeled; fresh position supersedes cached precision and cannot be replaced by late cache');
}
{
 const t=setup();t.run('locate(true)');t.calls.watch[0].ok(t.fix());t.env.points[0]=[21,53];t.env.revision++;t.calls.watch[0].ok(t.fix(19.01,51,5));assert.deepEqual(t.env.points,[[21,53]]);
 const old=setup({points:[[20,52],[21,53]]});old.run('locate(true)');old.calls.watch[0].ok(old.fix());assert.deepEqual(old.env.points,[[20,52],[21,53]]);
 old.run('locate(false)');old.calls.watch[1].ok(old.fix(19,51,40));assert.deepEqual(old.env.points,[[19,51],[21,53]]);old.calls.watch[1].ok(old.fix(18,50,10));assert.deepEqual(old.env.points,[[19,51],[21,53]]);
 console.log('PASS: dragged start and existing trip protected; explicit locate replaces start once');
}
{
 const t=setup();t.run('locate(true)');const q=t.calls.quick[0],w=t.calls.watch[0];
 for(const p of [t.fix(181),t.fix(19,91),t.fix(19,51,-1),t.fix(19,51,5,61000),{coords:{longitude:19,latitude:51,accuracy:3}}])q.ok(p);
 assert.equal(t.env.points.length,0);q.fail({code:3});assert(t.run('gpsSession!==null'));w.fail({code:1});assert(t.run('gpsSession===null'));assert.equal(t.node('locate')['aria-busy'],'false');
 q.ok(t.fix());assert.equal(t.env.points.length,0);
 t.run('locate(true)');[...t.jobs.values()][0].fn();assert(t.run('gpsSession===null'));assert.match(t.node('locationInfo').textContent,/Ustaw start na mapie/);
 console.log('PASS: invalid/expired positions rejected; denial, timeout and late callbacks release GPS safely');
}
{
 const t=setup({watch:false});t.run('locate(true)');assert.equal(t.calls.quick.length,2);t.calls.quick[1].ok(t.fix(19,51,8));assert.equal(t.env.points.length,1);assert(t.run('gpsSession===null'));
 const sync=setup();sync.env.navigator.geolocation.getCurrentPosition=()=>{};sync.env.navigator.geolocation.watchPosition=ok=>{ok(sync.fix(19,51,5));return 99};sync.run('locate(true)');assert.deepEqual(sync.calls.clear,[99]);
 console.log('PASS: getCurrentPosition fallback and synchronous watch cleanup');
}
// Exercise the real add() guard after a first fix: the next click must become point 1.
{
 const t=setup();Object.assign(t.env,{checkpoint(){},pointNames:new Map(),invalidate(){t.env.revision++},renderPoints(){}});
 const line=app.slice(app.indexOf('function add('),app.indexOf('\n',app.indexOf('function add(')));t.run(line+';locate(true)');t.calls.watch[0].ok(t.fix());t.run('add([20,52])');assert.equal(t.env.points.length,2);
 assert.match(t.calls.status[1][0],/Kliknij mapę/);console.log('PASS: waypoint 1 can be added during GPS refinement');
}
