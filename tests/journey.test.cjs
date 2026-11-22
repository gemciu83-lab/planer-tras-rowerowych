'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const dir = __dirname + '/../assets/';
const source = name => fs.readFileSync(dir + name + '.js', 'utf8');
const core = vm.createContext({ Date });
vm.runInContext(source('planner-trip') + source('planner-journey') + ';this.J=PlannerJourney;', core);
const J = core.J, T = core.PlannerTrip, plain = value => JSON.parse(JSON.stringify(value));
const start = Date.UTC(2026, 10, 22, 12);
const point = (lon, seconds = 0, lat = 51, accuracy = 5) => ({ lon, lat, time: start + seconds * 1000, accuracy });
const position = p => ({ timestamp: p.time, coords: { longitude: p.lon, latitude: p.lat, accuracy: p.accuracy } });

{
  assert(J.fix(position(point(19)), start));
  assert.equal(J.fix(position(point(19)), start + 16000), null);
  assert.equal(J.fix(position(point(19, 6)), start), null);
  assert.equal(J.fix(position(point(181)), start), null);
  const r = J.recorder(); r.start();
  r.append(point(19)); r.append(point(19.0004, 10));
  const before = r.meters;
  assert(before > 20 && before < 40);
  assert.equal(r.append(point(20, 11)), false, 'Rejects an impossible GPS jump');
  assert.equal(r.append(point(19.0005, 12, 51, 100)), false, 'Poor accuracy cannot add distance');
  r.pause(); r.start(); r.append(point(20, 60));
  assert.equal(r.meters, before, 'Pause never bridges the gap with a straight line');
  assert.equal(r.segments.length, 2);
  r.append(point(21, 200));
  assert.equal(r.meters, before, 'Long GPS outage starts another segment');
  assert.equal(r.segments.length, 3);
  assert.equal(J.recorder(r.snapshot()).state, 'paused', 'Reload requires explicit recording resume');
  const xml = J.gpx(r);
  assert.equal((xml.match(/<trkseg>/g) || []).length, 3);
  assert(xml.includes('<time>2026-11-22T12:00:00.000Z</time>'));
  assert(!xml.includes('<ele>null'));
  const alarm = J.deviation();
  assert.equal(alarm.update(point(19, 0), 150).alarm, false);
  assert.equal(alarm.update(point(19, 2), 150).alarm, false);
  assert.equal(alarm.update(point(19, 6), 150).entered, true);
  assert.equal(alarm.update(point(19, 7), 150).entered, false);
  assert.equal(alarm.update(point(19, 8), 5).alarm, true);
  assert.equal(alarm.update(point(19, 9), 5).alarm, false);
  const poor = J.deviation();
  for (let i = 0; i < 10; i++) assert.equal(poor.update(point(19, i, 51, 100), 150).alarm, false);
  const route = [[19,51],[19.01,51],[19.01,51.01],[19,51.01],[19,51],[19.02,51]];
  const index = T.routeIndex(route), first = J.progress(index, point(19.001, 0));
  const second = J.progress(index, point(19.002, 5), { ...first, time: start });
  assert(second.meters > first.meters && second.meters < 400, 'Crossing does not jump to a later lap');
  console.log('PASS: GPS validation, jitter/jump filters, pause and outage segments, recovery, timestamped GPX and deviation hysteresis');
}

function uiEnvironment() {
  let now = start;
  const nodes = new Map(), storage = new Map(), watches = new Map(), mapEvents = new Map(), calls = { watches: 0, clears: 0, downloads: [], renders: 0 };
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: id === 'speed' ? '16' : id === 'profile' ? 'trekking' : '', checked: false, style: {}, hidden: false,
      textContent: '', classList: { toggle() {} }, setAttribute(k,v) { this[k] = v; } });
    return nodes.get(id);
  };
  const map = { getSize: () => ({x:1000,y:600}), on(name, callback) { const previous=mapEvents.get(name);mapEvents.set(name,(...args)=>{previous?.(...args);callback(...args)}); } };
  const window = Object.assign(new EventTarget(), { isSecureContext: true, confirm: () => true });
  const document = Object.assign(new EventTarget(), { hidden: false });
  const env = vm.createContext({ console, Map, Set, Number, Math, JSON, Event, window, document,
    Date: class extends Date { static now() { return now; } },
    localStorage: { getItem: k => storage.get(k) || null, setItem(k,v) { storage.set(k,v); } },
    navigator: { geolocation: {
      watchPosition(ok, fail) { const id = ++calls.watches; watches.set(id, {ok,fail}); return id; },
      clearWatch(id) { watches.delete(id); calls.clears++; }
    } },
    setInterval() {}, $: node, map,
    L: { polyline() { return { addTo() { return this; }, setLatLngs(cs) { calls.renders++; calls.trail = cs; } }; }, DomEvent: { disableClickPropagation() {}, disableScrollPropagation() {} } },
    track: [[19,51],[19.01,51]], mapDistancePending: false, previousRoute: null,
    stopGPS() {}, stopFollow() {}, drawGPSPosition() {}, centerMapAboveDock() {}, restMarkerItems: () => [],
    download(...args) { calls.downloads.push(args); }
  });
  vm.runInContext(source('planner-trip') + source('planner-journey') + source('planner-simulation') + source('planner-journey-ui') + ';this.control=initJourney(map);', env);
  return { env, node, calls, watches, mapEvents, storage, window,
    send(p) { now = p.time; [...watches.values()].forEach(w => w.ok(position(p))); }, setNow(v) { now = v; } };
}
{
  const e = uiEnvironment(), original = JSON.stringify(e.env.track);
  e.node('journeyStart').onclick();
  assert.equal(e.calls.watches, 1);
  e.node('journeyRecordStart').onclick();
  assert.equal(e.calls.watches, 1, 'Navigation and recording share one GPS subscription');
  e.send(point(19)); e.send(point(19.0004, 10));
  assert.match(e.node('journeyPassed').textContent, /km/);
  assert.notEqual(e.node('journeyRemaining').textContent, '—');
  assert.equal(JSON.stringify(e.env.track), original, 'GPS never edits the planned route');
  e.node('journeyRecordPause').onclick();
  assert.equal(e.watches.size, 1, 'Navigation remains active during recording pause');
  e.send(point(19.0007, 20));
  e.node('journeyRecordStart').onclick(); e.send(point(19.0008, 25));
  e.node('journeyRecordExport').onclick();
  assert.equal(e.calls.downloads.length, 1);
  assert.equal((e.calls.downloads[0][0].match(/<trkseg>/g)||[]).length, 2);
  e.mapEvents.get('dragstart')();
  assert.equal(e.node('journeyFollow').checked, false);
  assert.equal(e.watches.size, 1, 'Inspecting the map does not interrupt recording');
  e.node('journeyEnd').onclick();
  assert.equal(e.watches.size, 1, 'Ending navigation does not silently discard a recording');
  e.node('journeyRecordStop').onclick();
  assert.equal(e.watches.size, 0);
  const saved = JSON.parse(e.storage.get('rowerem-recording-v1'));
  assert.equal(saved.state, 'stopped');
  assert.equal(saved.segments.length, 2);
  e.node('journeyRecordStart').onclick();
  const latest = [...e.watches.values()][0]; latest.fail({code:1});
  assert.equal(e.watches.size, 0, 'Permission denial releases the subscription');
  assert.match(e.node('journeyRecordStatus').textContent, /Pauza/);
  e.node('journeyRecordStart').onclick();
  e.window.dispatchEvent(new Event('pagehide'));
  assert.equal(e.watches.size, 0);
  assert.equal(JSON.parse(e.storage.get('rowerem-recording-v1')).state, 'paused');
  console.log('PASS: normal journey controls share GPS, preserve the plan, export paused segments, save recovery and release GPS on denial/page exit');
}

{
  const env = vm.createContext({ URLSearchParams, Date });
  vm.runInContext(source('planner-trip') + source('planner-hybrid'), env);
  const ps = [[19,51],[19.001,51],[19.002,51],[19.003,51]];
  const track = [[19,51,100],[19.0005,51,101],[19.001,51,102],[19.0015,51,103],[19.002,51,104],[19.0025,51,105],[19.003,51,106]];
  const replacement = env.PlannerHybrid.replaceSection(track, ps, 1, [[19.0015,51.001]], T.haversine, [0,2,4,6]);
  assert.deepEqual(plain(replacement.track.slice(0,2)), track.slice(0,2));
  assert.deepEqual(plain(replacement.track.slice(-2)), track.slice(-2));
  assert(replacement.track.some(c => c[0] === 19.0015 && c[1] === 51.001));
  assert.equal(replacement.track[2][2], 102);
  assert.equal(replacement.track[replacement.indices[2]][2], 104);
  assert.equal(replacement.indices.at(-1), replacement.track.length - 1);
  assert.throws(() => env.PlannerHybrid.replaceSection(track, ps, 10, [], T.haversine));
  assert.deepEqual(track[3], [19.0015,51,103], 'Original array is never modified in place');
  console.log('PASS: replacing an interior hybrid section preserves untouched GPX vertices, elevations and anchor indices');
}

{
  const e=uiEnvironment(),total=T.routeIndex(e.env.track).total;
  e.env.energySettings=()=>({speed:16,rider:67});e.env.energyStops=()=>[];
  e.env.manualWindSections=[];e.env.energyForecastSerial=0;
  e.env.estimateTripEnergy=callback=>{callback({meters:total,active:500});return {valid:true,active:500}};
  e.env.requestAnimationFrame=()=>1;e.env.cancelAnimationFrame=()=>{};
  e.env.L.circleMarker=()=>({addTo(){return this},setLatLng(){},remove(){}});
  e.env.stats=()=>{};
  for(const id of ['mapTimeTile','mapCaloriesTile'])e.node(id).querySelector=()=>({textContent:''});
  e.node('simulationSpeed').value='100';
  e.node('simulationStart').onclick();
  assert.match(e.node('journeyGPS').textContent,/SYMULACJA/);
  assert.equal(e.calls.watches,0,'Starting simulation never subscribes to real GPS');
  assert.equal(e.storage.size,0,'Simulation never writes to the real recording');
  assert.equal(e.node('journeyRecordStart').disabled,true);
  assert.equal(e.node('followGPS').disabled,true);
  e.node('simulationStop').onclick();
  assert.equal(e.node('journeyRecordStart').disabled,false);
  assert.equal(e.node('journeySimulationMetrics').hidden,true);
  console.log('PASS: Journey entry point runs simulation without GPS or recording writes and restores live controls on stop');
}

{
  vm.runInContext(source('planner-gpx'),core);
  const node = (lon,lat) => ({getAttribute:k=>String(k==='lat'?lat:lon),getElementsByTagNameNS:()=>[]});
  const groups = [[node(19,51),node(19.01,51)],[node(20,52),node(20.01,52)]];
  const segments = groups.map(nodes=>({getElementsByTagNameNS:()=>nodes}));
  const doc = {getElementsByTagNameNS(_namespace,name){return name==='gpx'?[{}]:name==='trkseg'?segments:name==='trkpt'?groups.flat():[];}};
  assert.throws(()=>core.PlannerGPX.parse(doc),/kilka/);
  const imported=core.PlannerGPX.parse(doc,1);
  assert.deepEqual(plain(imported.track),[[20,52],[20.01,52]]);
  assert.throws(()=>core.PlannerGPX.parse(doc,3),/odcinek/);
  console.log('PASS: multi-segment recording imports the explicitly selected continuous segment without bridging pauses');
}

{
  const nodes = new Map(), events = new Map(), pane = {style:{},classList:{add(){}}}, layers = [], selected = [];
  let dragging=true;
  const node=()=>({value:'',options:[],style:{},events:new Map(),setAttribute(k,v){this[k]=v;},append(option){this.options.push(option);if(this.options.length===1)this.value=option.value;},addEventListener(name,fn){this.events.set(name,fn);},setPointerCapture(){}});
  const $ = id => { if (!nodes.has(id)) nodes.set(id,node());return nodes.get(id); };
  $('mapStyle').value='forest';$('mapStyle').options=['normal','forest','cycle','orthophotoHigh'].map(value=>({value,textContent:value}));
  const map = {createPane:()=>pane,getSize:()=>({x:1000,y:600}),containerPointToLayerPoint:()=>({x:30,y:40}),getContainer:()=>({getBoundingClientRect:()=>({left:100,width:1000})}),dragging:{enabled:()=>dragging,disable(){dragging=false},enable(){dragging=true}},on(names,fn){names.split(' ').forEach(n=>events.set(n,fn));}};
  const ctx = vm.createContext({map,$,document:{createElement:node},styleDefinitions:{normal:[{}],forest:[{},{}],cycle:[{}],orthophotoHigh:[{},{},{}]},switchMapStyle:(style,max)=>selected.push([style,max]),addMapTileLayer(){const layer={remove(){this.removed=true}};layers.push(layer);return layer;},L:{DomEvent:{disableClickPropagation(){},disableScrollPropagation(){}}}});
  vm.runInContext(source('planner-compare')+';this.comparison=initMapComparison(map);',ctx);
  $('compareRight').value='orthophotoHigh';
  $('compareToggle').onclick();
  assert.equal($('mapStyle').value,'forest');
  assert.equal(layers.length,3);
  assert.equal(pane.style.clip,'rect(40px, 1030px, 640px, 530px)');
  const event={pointerId:1,button:0,clientX:800,preventDefault(){},stopPropagation(){}};
  $('compareHandle').events.get('pointerdown')(event);
  assert.equal(dragging,false);
  assert.equal(ctx.comparison.split(),.7);
  assert.equal(pane.style.clip,'rect(40px, 1030px, 640px, 730px)');
  $('compareHandle').events.get('pointercancel')(event);
  assert.equal(dragging,true);
  $('compareLeft').value='cycle';$('compareLeft').onchange();assert.equal($('mapStyle').value,'cycle');
  $('compareRight').value='normal';$('compareRight').onchange();assert.equal(layers.length,4);
  $('compareHandle').events.get('keydown')({...event,key:'Home'});assert.equal(ctx.comparison.split(),0);
  $('compareHandle').events.get('keydown')({...event,key:'End'});assert.equal(ctx.comparison.split(),1);
  $('compareClose').onclick();
  assert.equal($('mapStyle').value,'forest');
  assert(layers.every(l=>l.removed));
  assert.equal(ctx.comparison.split(),null);
  console.log('PASS: independent map selectors, central drag handle, cancellation, keyboard clipping and restoring the previous map');
}

{
  const nodes = new Map(), calls = { checkpoints:0, heights:0 };
  const element = () => ({ value:'',disabled:false,hidden:false,textContent:'',children:[],style:{},
    get options(){return this.children;}, append(c){this.children.push(c);if(this.children.length===1)this.value=c.value;},
    replaceChildren(){this.children=[];this.value='';},setAttribute(){},classList:{add(){},remove(){}} });
  const $ = id => {if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  const layer = () => ({addTo(){return this;},setLatLngs(){},clearLayers(){}});
  const env = vm.createContext({$,console,document:{createElement:element,addEventListener(){}},
    L:{polyline:layer,layerGroup:layer,circleMarker:layer},
    map:{createPane:()=>({style:{}}),getContainer:element,closePopup(){},doubleClickZoom:{enabled:()=>true,disable(){},enable(){}}},
    manualPath:{close(){}},mapDistancePending:false,revision:0,controller:null,autoRouteTimer:null,routingRecalcRequested:false,
    clearRouteInspection(){},cancelLoopSearch(){},clearTimeout(){},checkpoint(){calls.checkpoints++;},
    renderPoints(){},status(){},fetchGPXHeights(){calls.heights++;},invalidate(){calls.invalidated=true;},
    distance:T.haversine,routeType:'trekking',surfaceData:null,previousRoute:null,
    track:[[19,51,100],[19.001,51,100],[19.002,51,100],[19.003,51,100]],
    points:[[19,51],[19.001,51],[19.002,51],[19.003,51]]
  });
  vm.runInContext(source('planner-hybrid')+source('planner-hybrid-ui')+';this.ui=initHybridUI(map);',env);
  const originalFirst=env.track[0],originalLast=env.track.at(-1);
  env.ui.update();$('hybridEdge').value='1';$('hybridEdge').onchange();$('hybridBegin').onclick();
  assert(env.ui.drawing);
  env.ui.addFromMap({wrap:()=>({lat:51.001,lng:19.0015})});
  $('hybridFinish').onclick();
  assert.equal(env.ui.drawing,false);
  assert.equal(calls.checkpoints,1);
  assert.equal(env.points.length,4,'Replacing does not append another waypoint');
  assert.equal(env.track[0],originalFirst);
  assert.equal(env.track.at(-1),originalLast);
  assert(env.track.some(c=>c[1]===51.001));
  assert.equal(calls.invalidated,undefined,'Local replacement does not reroute the whole plan');
  assert.equal(calls.heights,1);
  assert.equal(vm.runInContext('captureHybridSections()[0].edge',env),1);
  console.log('PASS: Hybrid UI selects an interior edge, commits once, preserves endpoints and requests missing heights without global routing');
}
