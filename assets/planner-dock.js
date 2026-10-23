'use strict';
function mapDockFitOptions(){const panel=$('mapReadings');return {paddingTopLeft:[45,75],paddingBottomRight:[45,panel&&!panel.hidden?panel.offsetHeight+76:60]}}
function centerMapAboveDock(position,zoom){
 if(zoom===undefined)map.panTo(position,{animate:false});else map.setView(position,zoom,{animate:false});
 const panel=$('mapReadings');if(panel&&!panel.hidden)map.panBy([0,Math.round((panel.offsetHeight+44)/2)],{animate:false});
}
function setMapDockOpen(open,remember=false,focus=false){
 const panel=$('mapReadings'),show=$('showMapReadings'),toggle=$('toggleMapParameters');
 if(!open&&typeof closeMapSelects==='function')closeMapSelects();
 panel.hidden=!open;show.hidden=open;
 show.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-expanded',String(open));
 if(focus)(open?(document.getElementById?.('mapProfileButton')||$('mapProfile')):show).focus({preventScroll:true});
 positionMapActions();if(remember)saveViewPreferences();
}
function syncMapDock(){for(const [quick,source] of [['mapProfile','profile'],['mapBikeType','bikeType']])if(document.activeElement!==$(quick))$(quick).value=$(source).value;if(typeof syncMapSelects==='function')syncMapSelects()}
function initMapDock(){
 $('mapBikeType').addEventListener('change',()=>{$('bikeType').value=$('mapBikeType').value;$('bikeType').dispatchEvent(new Event('input',{bubbles:true}))});
 $('mapProfile').addEventListener('change',()=>{$('profile').value=$('mapProfile').value;$('profile').dispatchEvent(new Event('change',{bubbles:true}))});
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.key.toLowerCase()!=='p'||e.target.closest('input,textarea,select,[contenteditable="true"],dialog[open]'))return;
  e.preventDefault();setMapDockOpen($('mapReadings').hidden,true,true);
 });
 syncMapDock();positionMapActions();
}
