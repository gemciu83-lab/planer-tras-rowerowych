'use strict';
function mapDockFitOptions(){const panel=$('mapReadings');return {paddingTopLeft:[45,75],paddingBottomRight:[45,panel&&!panel.hidden?panel.offsetHeight+76:60]}}
function centerMapAboveDock(position,zoom){
 if(zoom===undefined)map.panTo(position,{animate:false});else map.setView(position,zoom,{animate:false});
 const panel=$('mapReadings');if(panel&&!panel.hidden)map.panBy([0,Math.round((panel.offsetHeight+44)/2)],{animate:false});
}
function setMapDockOpen(open,remember=false,focus=false){
 const panel=$('mapReadings'),show=$('showMapReadings'),toggle=$('toggleMapParameters');
 panel.hidden=!open;show.hidden=open;
 show.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-expanded',String(open));
 if(focus)(open?toggle:show).focus({preventScroll:true});
 positionMapActions();if(remember)saveViewPreferences();
}
function syncMapDock(){if(document.activeElement!==$('mapProfile'))$('mapProfile').value=$('profile').value}
function initMapDock(){
 $('mapProfile').addEventListener('change',()=>{$('profile').value=$('mapProfile').value;$('profile').dispatchEvent(new Event('change',{bubbles:true}))});
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.key.toLowerCase()!=='p'||e.target.closest('input,textarea,select,[contenteditable="true"],dialog[open]'))return;
  e.preventDefault();setMapDockOpen($('mapReadings').hidden,true,true);
 });
 syncMapDock();positionMapActions();
}
