'use strict';
let reviewCache=null,reviewHighlight=null,recordingDisplayKey=null;
const formatKm=n=>(n/1000).toLocaleString('pl-PL',{maximumFractionDigits:2})+' km';
function secondsLabel(n){if(!Number.isFinite(n))return 'Brak danych';const seconds=Math.round(n);return Math.floor(seconds/3600)+' h '+String(Math.floor(seconds%3600/60)).padStart(2,'0')+' min '+String(seconds%60).padStart(2,'0')+' s'}
function updateRecordingDisplay(){
 const r=routeType==='import'?gpxRecording:null,key=r?JSON.stringify([r,length(track),mapDistancePending]):'';
 if(key===recordingDisplayKey)return;recordingDisplayKey=key;
 $('recordingPanel').hidden=!r;if(!r)return;
 $('recordingStatus').textContent=r.modified?'Dane z oryginalnego pliku — przebieg był edytowany.':'Dane z pliku GPX · niezależne od parametrów planowanej jazdy.';
 const values=[['Dystans urządzenia',r.deviceMeters===null?'Brak danych':formatKm(r.deviceMeters)],['Dystans geometrii',formatKm(length(track)*1000)],['Czas aktywności urządzenia',secondsLabel(r.deviceSeconds)],['Cały zapis',secondsLabel(r.elapsedSeconds)],['Szacowany ruch',secondsLabel(r.estimatedMovingSeconds)],['Szacowane postoje',secondsLabel(r.estimatedStoppedSeconds)]];
 const host=$('recordingRows');host.replaceChildren();for(const [label,value] of values){const cell=document.createElement('div'),name=document.createElement('span'),data=document.createElement('strong');name.textContent=label;data.textContent=value;cell.append(name,data);host.append(cell)}
 const notes=['Ruch i postoje: okna 30 s, próg 3 km/h; wynik może różnić się od automatycznej pauzy urządzenia.'];
 if(r.start!==null)notes.push('Początek zapisu: '+new Date(r.start).toLocaleString('pl-PL')+'.');
 if(r.deviceMeters!==null&&r.deviceMeters>0)notes.push('Różnica geometrii względem licznika: '+(100*(length(track)*1000/r.deviceMeters-1)).toLocaleString('pl-PL',{maximumFractionDigits:2})+'%.');
 if(r.deviceSeconds!==null&&r.elapsedSeconds!==null){const d=r.elapsedSeconds-r.deviceSeconds;notes.push(d>=0?'Różnica całego zapisu i czasu aktywności: '+secondsLabel(d)+'.':'Czas aktywności w pliku jest dłuższy od zakresu znaczników czasu — sprawdź dane źródłowe.')}
 if(r.deviceAscent!==null)notes.push('Podjazdy urządzenia: '+Math.round(r.deviceAscent)+' m. Licznik planera używa własnego wygładzania.');
 if(r.incomplete)notes.push('Niepełne czasy lub '+r.invalidIntervals+' pominiętych przedziałów: przerwy ponad 5 min, cofnięty czas albo prędkość ponad 100 km/h. Szacunek ruchu i postojów obejmuje tylko poprawne przedziały.');
 if(r.modified)notes.push('Podsumowanie nagrania dotyczy oryginału; zmienionej trasie nie przypisujemy dawnych czasów.');
 $('recordingNotes').textContent=notes.join(' ');
 const seconds=r.deviceSeconds||r.estimatedMovingSeconds,meters=r.deviceMeters||length(track)*1000,pace=seconds>0?meters/seconds*3.6:0;
 $('useGPXPace').disabled=r.modified||r.incomplete&&!r.deviceSeconds||pace<3||pace>60||mapDistancePending;
 $('useGPXPace').textContent=pace>=3&&pace<=60?'Ustaw tempo '+pace.toLocaleString('pl-PL',{maximumFractionDigits:1})+' km/h':'Brak tempa do zastosowania';
}
function updateReviewDisplay(){
 if(reviewCache?.track===track&&reviewCache.surface===surfaceData&&reviewCache.pending===mapDistancePending)return;
 reviewHighlight?.remove();reviewHighlight=null;
 const host=$('reviewRows');host.replaceChildren();
 if(track.length<2||mapDistancePending){reviewCache={track,surface:surfaceData,pending:mapDistancePending};$('reviewStatus').textContent=mapDistancePending?'Czekam na aktualny przebieg.':'Wyznacz lub wczytaj trasę.';return}
 const review=PlannerAnalysis.review(track,routeTerrain(),surfaceData);reviewCache={track,surface:surfaceData,pending:false,review};
 const kinds={climb:'Podjazd',surface:'Nawierzchnia',road:'Droga główna'},roads={trunk:'Droga główna ruchu przyspieszonego',primary:'Droga główna',secondary:'Droga klasy secondary'};
 const ordered=review.items.slice().sort((a,b)=>Number(!!b.longest)-Number(!!a.longest)||a.start-b.start),visible=ordered.slice(0,40);
 for(const item of visible){
  const button=document.createElement('button'),title=document.createElement('strong'),detail=document.createElement('span');button.type='button';button.className='review-item';
  title.textContent=item.longest?'Najdłuższy podjazd':item.kind==='surface'?PlannerCore.surfaceKinds[item.surface].label:item.kind==='road'?(roads[item.roadClass.replace('_link','')]||'Droga główna')+(item.ref?' · '+item.ref:''):kinds[item.kind];
  detail.textContent=formatKm(item.start)+'–'+formatKm(item.end)+' · długość '+formatKm(item.end-item.start)+(item.kind==='climb'?' · ↑ '+Math.round(item.gain)+' m · średnio ≈ '+(100*item.gain/(item.end-item.start)).toLocaleString('pl-PL',{maximumFractionDigits:1})+'%':'');
  button.append(title,detail);button.onclick=()=>focusReviewSection(item);host.append(button);
 }
 let status=review.items.length?review.items.length+' odcinków do sprawdzenia. Kliknij, aby przybliżyć mapę i profil.':'Brak odcinków spełniających progi podsumowania.';
 if(!review.heightAvailable)status+=' Brak wysokości: podjazdy nie zostały ocenione.';
 const coverage=review.total?Math.round(review.knownRoadMeters/review.total*100):0;status+=' Klasy dróg opisane na '+coverage+'% trasy.';
 if(!surfaceData||surfaceData.parts.every(p=>p.kind==='unknown'))status+=' Brak opisów nawierzchni.';
 if(review.items.length>visible.length)status+=' Pokazano pierwsze 40; najdłuższy podjazd jest wyróżniony.';
 $('reviewStatus').textContent=status;
}
function focusReviewSection(item){
 const model=routeTerrain(),cs=[];
 for(let i=0;i<track.length;i++)if(model.distances[i]>=item.start-100&&model.distances[i]<=item.end+100)cs.push([track[i][1],track[i][0]]);
 if(!cs.length)return;reviewHighlight?.remove();reviewHighlight=L.polyline(cs,{color:'#e7b44b',weight:10,opacity:.85,interactive:false}).addTo(map);map.fitBounds(reviewHighlight.getBounds(),{...mapDockFitOptions(),maxZoom:16});
 viewStart=Math.max(0,(item.start-200)/1000);viewEnd=Math.min(routeDistance,(item.end+200)/1000);drawProfile();$('map').scrollIntoView({block:'start',behavior:'smooth'});
}
function initReviewControls(){
 $('useGPXPace').onclick=()=>{if($('useGPXPace').disabled||!gpxRecording)return;const r=gpxRecording;checkpoint();$('speed').value=(((r.deviceMeters||length(track)*1000)/(r.deviceSeconds||r.estimatedMovingSeconds))*3.6).toFixed(1);stats();status('Ustawiono tempo na podstawie zapisu GPX. Czas planu nadal wynika z aktualnej geometrii i zaplanowanych postojów.')};
 $('clearReviewHighlight').onclick=()=>{reviewHighlight?.remove();reviewHighlight=null};
 updateRecordingDisplay();updateReviewDisplay();
}
