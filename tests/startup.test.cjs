const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const app=fs.readFileSync(path.join(__dirname,'../assets/app.js'),'utf8');
function fn(name){const a=app.indexOf('function '+name+'('),b=app.indexOf('\n}\n',a);assert(a>=0&&b>a);return app.slice(a,b+3)}
function setup(initial={},blocked=false){
 const store=new Map(Object.entries(initial)),nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'99',textContent:'',classList:{add(){},remove(){}}});return nodes.get(id)};
 const env={$:node,localStorage:{getItem(key){if(blocked)throw Error('Storage blocked');return store.get(key)||null},setItem(key,value){if(blocked)throw Error('Storage blocked');store.set(key,value)}},clearTimeout(){},restoreRoutingPreferences(value){env.preferences=value||'default'},restoreRestSettings(value){env.rests=value||'default'},clearRouteBreaks(){env.breaks=[]},renderPoints(){},captureTrip(){return {settings:Object.fromEntries([...nodes].map(([k,v])=>[k,v.value]))}},updateHistoryButtons(){}};
 const ctx=vm.createContext(env);vm.runInContext("let tripReady=true,draftTimer=null,points=[[19,51]],track=[[19,51],[20,52]],routeType='direct',surfaceData={},previousRoute={},mapDistancePending=true,historyPast=[1],historyFuture=[2],historyCurrent=null;",ctx);
 vm.runInContext(fn('readRiderPreference')+fn('initializeFreshTrip')+fn('saveDraft'),ctx);
 return {store,node,env,ctx,run:code=>vm.runInContext(code,ctx)};
}
const legacy={riderWeight:'68.5',profile:'mtb',speed:'43',pause:'120',bikeWeight:'9',luggageWeight:'19',bikeType:'road',ridingPosition:'tucked',windMode:'forecast',windSpeed:'60',windDirection:'270',routingPreferences:{surface:'paved'}};
const test=setup({'rowerem-settings-v1':JSON.stringify(legacy),'rowerem-routes-v1':'keep my trips'});
test.run('initializeFreshTrip()');
for(const [id,value] of Object.entries({riderWeight:'68.5',profile:'trekking',bikeType:'trekking',luggageWeight:'2',speed:'16',bikeWeight:'22',pause:'0',windMode:'manual',windSpeed:'0',windDirection:'0',ridingPosition:'auto'}))assert.equal(test.node(id).value,value,id);
assert.equal(test.env.preferences,'default');assert.equal(test.env.rests,'default');assert.equal(test.run('points.length+track.length+historyPast.length+historyFuture.length'),0);assert.equal(test.run('mapDistancePending'),false);
test.node('riderWeight').value='72.3';test.node('luggageWeight').value='50';test.node('profile').value='direct';assert(test.run('saveDraft()'));
assert.deepEqual(JSON.parse(test.store.get('rowerem-rider-v1')),{riderWeight:'72.3'});assert.equal(test.store.get('rowerem-routes-v1'),'keep my trips');
const reopened=setup(Object.fromEntries(test.store));reopened.run('initializeFreshTrip()');assert.equal(reopened.node('riderWeight').value,'72.3');assert.equal(reopened.node('luggageWeight').value,'2');assert.equal(reopened.node('profile').value,'trekking');
for(const invalid of ['', 'NaN','Infinity','0','251']){test.node('riderWeight').value=invalid;assert.equal(test.run('saveDraft()'),false);assert.equal(JSON.parse(test.store.get('rowerem-rider-v1')).riderWeight,'72.3')}
for(const data of ['{bad json',JSON.stringify({riderWeight:'Infinity'}),JSON.stringify({riderWeight:''}),JSON.stringify({riderWeight:999})]){const broken=setup({'rowerem-rider-v1':data});broken.run('initializeFreshTrip()');assert.equal(broken.node('riderWeight').value,'70');assert.equal(broken.node('luggageWeight').value,'2')}
const blocked=setup({},true);blocked.run('initializeFreshTrip()');assert.equal(blocked.node('riderWeight').value,'70');assert.equal(blocked.run('saveDraft()'),false);assert.equal(blocked.run('points.length+track.length'),0);
console.log('PASS: startup migrates only rider weight, resets trekking/baggage/session defaults, preserves saved trips, handles invalid/blocked storage and reload');
