'use strict';
let walkingModeShown=false,lastCyclingProfile='trekking',lastCyclingSpeed='16',lastWalkingSpeed='5',lastCyclingRests=null,lastWalkingRests=null;
function isWalking(){return $('profile').value==='walking'}
function changeWalkingProfile(){
 const walk=isWalking();
 if(walk!==walkingModeShown){
  if(typeof getRestSettings==='function'&&typeof restoreRestSettings==='function'){if(walk){lastCyclingRests=getRestSettings();restoreRestSettings(lastWalkingRests||{intervalKm:5,minutes:10})}else{lastWalkingRests=getRestSettings();restoreRestSettings(lastCyclingRests||{})}}
  if(walk){lastCyclingSpeed=$('speed').value;$('speed').value=lastWalkingSpeed;$('loopDistance').value='5';if($('name').value==='Moja rowerowa wyprawa')$('name').value='Mój spacer'}
  else{lastWalkingSpeed=$('speed').value;$('speed').value=lastCyclingSpeed;$('loopDistance').value='40';if($('name').value==='Mój spacer')$('name').value='Moja rowerowa wyprawa'}
 }
}
function syncWalkingUI(){
 const walk=isWalking();walkingModeShown=walk;if(!walk&&$('profile').value!=='direct')lastCyclingProfile=$('profile').value;
 for(const id of ['mapBikeTile','mapBikeTypeTile'])$(id).hidden=walk;
 $('riderWeight').closest('.section').hidden=walk;$('walkingSettings').hidden=!walk;$('energySettings').hidden=walk;$('walkingTerrainTile').hidden=!walk;
 for(const id of ['speed','mapSpeed']){$(id).min=walk?'1':'3';$(id).max=walk?'8':'60';$(id).step=walk?'0.1':'1'}
 const pace=Number($('speed').value);if(Number.isFinite(pace)&&pace>0){if(walk)lastWalkingSpeed=$('speed').value;else lastCyclingSpeed=$('speed').value}
 $('mapTimeTile').querySelector('span').textContent=walk?'Czas spaceru':'Czas jazdy';
 $('mapRiderTile').querySelector('label').textContent=walk?'Osoba · kg':'Rowerzysta · kg';$('mapLuggageTile').querySelector('label').textContent=walk?'Plecak · kg':'Bagaż · kg';
 $('mapRiderWeight').setAttribute('aria-label',walk?'Masa osoby na mapie w kilogramach':'Masa rowerzysty na mapie w kilogramach');$('mapLuggageWeight').setAttribute('aria-label',walk?'Masa plecaka na mapie w kilogramach':'Masa bagażu na mapie w kilogramach');
 $('ride').closest('.stat').querySelector('.caption').textContent=walk?'Samo chodzenie':'Sama jazda';
 $('walkingToggle').textContent='🚶 Spacer';$('walkingToggle').setAttribute('aria-pressed',String(walk));$('walkingToggle').title=walk?'Spacer włączony — kliknij, aby wrócić do roweru':'Włącz planowanie spaceru';
 $('loopDistance').min=walk?'1':'5';$('loopDistance').max='200';
 for(const [mapField,source]of [['mapWalkingTerrain','walkingTerrain'],['walkRiderWeight','riderWeight'],['walkLuggageWeight','luggageWeight']])if(document.activeElement!==$(mapField))$(mapField).value=$(source).value;
 if(typeof syncMapSelects==='function')syncMapSelects();
}
function updateWalkingEnergyDisplay(){
 if(energyRequest){energyRequestKey++;energyRequest.abort();energyRequest=null}
 const valid=track.length>1,result=valid?estimateTripEnergy():null;
 $('calories').textContent=$('energyActive').textContent=valid?'≈ '+energyKcal(result.active):'— kcal';
 $('energyTotal').textContent=valid?'≈ '+energyKcal(result.total):'— kcal';$('mapTotalCaloriesValue').textContent=valid?'Całkowite: ≈ '+energyKcal(result.total):'Całkowite: —';
 $('mapWindSummary').textContent='Spacer · '+($('walkingTerrain').value==='firm'?'ścieżki':'teren');$('mapWindSummary').title='Kalorie spaceru — kliknij parametry marszu';
 $('walkingEnergyNote').textContent=valid?'Marsz: ≈ '+energyKcal(result.active)+' aktywnych · ≈ '+energyKcal(result.total)+' całkowitych. Model bazowy '+result.baseMET.toLocaleString('pl-PL',{maximumFractionDigits:1})+' MET; masa osoby i plecaka. '+(result.missingHeightMeters>.01?'Na '+Math.round(result.missingHeightMeters/result.meters*100)+'% dystansu brakuje wysokości.':'Nachylenie uwzględnione tam, gdzie są wysokości.'):'Wyznacz spacer lub wczytaj GPX. Kalorie obliczamy modelem marszu.';
 $('calorieNote').textContent='Spacer: orientacyjny model MET z Compendium 2024, zależny od tempa, wybranego terenu i nachylenia. Aktywne = wydatek ponad spoczynek; całkowite dodają spoczynek osoby przez marsz i postoje. Plecak zwiększa koszt aktywny proporcjonalnie do niesionej masy — to uproszczenie. Masa i rodzaj roweru oraz wiatr nie zmieniają kalorii marszu. Podłoże, strome zejścia, schody, porywy wiatru i indywidualna sprawność mogą zmieniać rzeczywisty wysiłek. Wybór terenu jest założeniem, nie automatycznym rozpoznaniem nawierzchni.';
 $('mapCaloriesTile').title=$('walkingEnergyNote').textContent;
}
function initWalkingControls(){
 $('walkingToggle').onclick=()=>{const next=isWalking()?lastCyclingProfile:'walking';$('profile').value=next;$('profile').dispatchEvent(new Event('change',{bubbles:true}))};
 $('mapWalkingTerrain').addEventListener('change',()=>{$('walkingTerrain').value=$('mapWalkingTerrain').value;$('walkingTerrain').dispatchEvent(new Event('input',{bubbles:true}))});
 for(const [quick,source]of [['walkRiderWeight','riderWeight'],['walkLuggageWeight','luggageWeight']])$(quick).addEventListener('input',()=>{if(!$(quick).value||!$(quick).checkValidity())return;checkpoint();$(source).value=$(quick).value;stats()});
 $('walkingTerrain').addEventListener('input',stats);
 syncWalkingUI();
}
