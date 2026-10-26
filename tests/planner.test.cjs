const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(root+'/assets/planner-features.js','utf8'),app=fs.readFileSync(root+'/assets/app.js','utf8');
const coreContext=vm.createContext({});vm.runInContext(fs.readFileSync(root+'/assets/planner-trip.js','utf8'),coreContext);vm.runInContext(fs.readFileSync(root+'/assets/planner-core.js','utf8'),coreContext);const C=coreContext.PlannerCore;
const labels=C.sanitizePointLabels([[19,51]],{'19.000000,51.000000':'Rynek','other':'ignored'});assert.deepEqual(JSON.parse(JSON.stringify(labels)),{'19.000000,51.000000':'Rynek'});
const choices=C.chooseLoopVariants([{km:8,ascent:100},{km:10.2,ascent:120},{km:11,ascent:30}],10);assert.equal(choices[0].km,10.2);assert.equal(choices[1].label,'Krótsza');assert.equal(choices[2].label,'Mniej podjazdów');assert.equal(new Set(choices.map(c=>c.km)).size,3);
const clean=C.sanitizeTrip({points:[[19,51]],track:[],pointLabels:{'19.000000,51.000000':'Rynek'},settings:{}});assert.equal(clean.pointLabels['19.000000,51.000000'],'Rynek');
console.log('PASS: named point persistence, metadata validation, three distinct loop choices');
function createContext(){
 const nodes=new Map();let id=0,closed=0;
 const node=key=>{if(!nodes.has(key))nodes.set(key,{tagName:'DIV',value:({profile:'trekking',loopDistance:'10',loopBearing:'0',name:'Testowa',speed:'16',pause:'30',riderWeight:'70',bikeWeight:'22',bikeType:'trekking'})[key]||'',textContent:'',dataset:{},children:[],style:{setProperty(){}},classList:{add(){},remove(){}},hidden:false,append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},setAttribute(){},close(){closed++},getBounds:()=>[],remove(){}});return nodes.get(key)};
 const environment={console,PlannerCore:C,getPointStops:()=>[],getRoutingPreferences:()=>({}),getRouteBreaks:()=>[],getRestSettings:()=>({}),clearRouteBreaks(){},JSON,Map,Set,Number,Math,Date,AbortController,DOMException,$:node,setTimeout:()=>1,clearTimeout(){},queueMicrotask:fn=>fn(),document:{createElement(tag){const el=node('el'+ ++id);el.tagName=tag.toUpperCase();return el},querySelectorAll:()=>[]},window:{innerWidth:390,matchMedia:()=>({matches:true})},distance:(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]),length:cs=>cs.km||1,stats(){},status(){},checkpoint(){environment.checkpoints++},checkpoints:0,stopGPS(){},stopFollow(){},mapDockFitOptions:()=>({}),commitTrip(){},renderPoints(){},invalidate(){},persist:()=>true,map:{fitBounds(){},closePopup(){}},routeLayer:{getBounds:()=>[]},L:{popup(){return {setLatLng(){return this},setContent(el){environment.popupContent=el;return this},openOn(){return this}}}}};
 const ctx=vm.createContext(environment);vm.runInContext("let points=[[19,51],[20,52]],track=[[19,51,100],[20,52,110]],markers=[],surfaceData=null,routeType='trekking',revision=0,controller=null,autoRouteTimer=null,mapDistancePending=false,previousRoute=null,loopGenerating=false,saved=[],tripReady=true;const initialTrack=track;",ctx);vm.runInContext(source,ctx);return {ctx,environment,node,closed:()=>closed};
}
async function tests(){
 const a=createContext();let requestNo=0;
 a.environment.fetchRoutingFeature=async()=>{requestNo++;const coords=[[19,51,100],[19+requestNo*.001,51.05,110],[19,51,100]];coords.km=[8.5,9.8,10.2,9.5][requestNo-1]||10;return {geometry:{coordinates:coords},properties:{}}};
 await vm.runInContext('generateLoopChoices()',a.ctx);
 assert.equal(vm.runInContext('loopChoices.length',a.ctx),3);assert.equal(vm.runInContext('track===initialTrack',a.ctx),true);assert.equal(a.environment.checkpoints,0);
 const first=a.node('loopCandidates').children[0],select=first.children.at(-1).children[1];select.onclick();assert.equal(a.environment.checkpoints,1);assert.equal(vm.runInContext('points.length',a.ctx),5);assert.equal(vm.runInContext('track===initialTrack',a.ctx),false);
 console.log('PASS: loop search leaves active route unchanged; only selection replaces route and creates undo checkpoint');
 const b=createContext();let wasAborted=false;
 b.environment.fetchRoutingFeature=(_ps,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{wasAborted=true;reject(new DOMException('Aborted','AbortError'))}));
 const pending=vm.runInContext('generateLoopChoices()',b.ctx);vm.runInContext('cancelLoopSearch(false)',b.ctx);await pending;assert(wasAborted);assert.equal(vm.runInContext('loopGenerating',b.ctx),false);assert.equal(vm.runInContext('track===initialTrack',b.ctx),true);
 console.log('PASS: cancellation preserves current route');
 const limited=createContext();let forbiddenRequests=0;limited.environment.fetchRoutingFeature=async()=>{forbiddenRequests++;throw Object.assign(new Error('Przerwa serwera 60 s'),{rateLimited:true})};await vm.runInContext('generateLoopChoices()',limited.ctx);assert.equal(forbiddenRequests,1);assert(limited.node('loopResult').textContent.includes('Przerwa serwera'));
 console.log('PASS: loop generator stops after one rate-limit refusal');
 const pointSave=createContext();pointSave.environment.showSaved=()=>{};
 vm.runInContext('points=Array.from({length:100},(_,i)=>[19+i*.001,51]);track=[];mapDistancePending=true;saveCurrentTrip()',pointSave.ctx);
 assert.equal(vm.runInContext('saved.length',pointSave.ctx),1);assert.equal(vm.runInContext('saved[0].points.length',pointSave.ctx),100);assert.equal(vm.runInContext('savedSnapshot(saved[0]).track.length',pointSave.ctx),0);
 console.log('PASS: save and validate 100 unrouted points while routing is unavailable');
 const c=createContext();vm.runInContext("pointNames.set(PlannerCore.pointKey(points[0]),'Moja nazwa');updatePointName(PlannerCore.pointKey(points[0]),'Spóźniony adres')",c.ctx);assert.equal(vm.runInContext('pointNames.get(PlannerCore.pointKey(points[0]))',c.ctx),'Moja nazwa');
 vm.runInContext('handlePlannerMapClick({latlng:{lat:53,lng:21},originalEvent:{pointerType:"touch"}})',c.ctx);assert.equal(vm.runInContext('points[0][0]',c.ctx),19);c.environment.popupContent.children[1].onclick();assert.equal(vm.runInContext('points[0][0]',c.ctx),21);assert.equal(c.environment.checkpoints,1);
 console.log('PASS: manual name wins over late reverse geocode; a touch changes nothing until an action is chosen');
 const html=fs.readFileSync(root+'/index.html','utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 for(const file of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g))assert(fs.existsSync(root+'/'+file[1].split(/[?#]/)[0]));
 for(const file of ['app','planner-core','planner-features'])assert(html.includes('assets/'+file+'.js?v=3.9.0'));
 for(const file of [app,source])for(const match of file.matchAll(/\$\('([^']+)'\)/g))assert(ids.includes(match[1])||['mapParameters','toggleMapParameters','profileCursor'].includes(match[1]),'Missing DOM '+match[1]);
 assert(app.includes('function initializeFreshTrip()'));assert(!app.includes("getItem('rowerem-draft-v2')"));
 console.log('PASS: assets and control references; empty-map startup retained');
}
tests().then(()=>{require('./gpx.test.cjs');require('./startup.test.cjs');require('./trip-planning.test.cjs');require('./rest-markers.test.cjs');require('./location.test.cjs');require('./energy.test.cjs');require('./dock.test.cjs');require('./route-regression.test.cjs');require('./routing-throttle.test.cjs')}).catch(error=>{console.error(error);process.exitCode=1});
