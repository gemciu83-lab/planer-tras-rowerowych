/* Approximate walking energy from 2024 Adult Compendium MET categories. */
(function(root){
 'use strict';
 const table=[[1,2.3],[3.2,2.8],[4,3],[4.5,3.8],[5.5,3.8],[5.6,4.8],[6.3,4.8],[6.4,5.5],[7.1,5.5],[7.2,7],[8,7]];
 function speed(value){const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.min(8,n)):5}
 function flatMET(value){const v=speed(value);for(let i=1;i<table.length;i++)if(v<=table[i][0]){const a=table[i-1],b=table[i];return a[1]+(b[1]-a[1])*(v-a[0])/(b[0]-a[0])}return table.at(-1)[1]}
 function estimate(cs,metrics,grades,options={}){
  const rider=root.PlannerEnergy.settings(options).rider,luggage=root.PlannerEnergy.settings(options).luggage,v=speed(options.speed),terrain=options.walkingTerrain==='firm'?'firm':'trail',base=Math.max(flatMET(v),terrain==='trail'?(v<4?3.8:v<6.4?5.3:6):0);
  let meters=0,heightMeters=0,active=0,uphillMeters=0;
  for(let i=0;i<metrics.meters.length;i++){
   const d=metrics.meters[i];if(!Number.isFinite(d)||d<.01)continue;meters+=d;
   if(Number.isFinite(cs[i]?.[2])&&Number.isFinite(cs[i+1]?.[2]))heightMeters+=d;
   const grade=grades?.[i],up=Number.isFinite(grade)&&grade>=1;
   const hill=up?(v<=3&&grade>=5?5:grade<=5?5.3:grade<=10?7:8.8):0;
   const met=Math.max(base,hill),hours=d/1000/v;
   // MET includes resting metabolism. Remove 1 MET for active kcal, add rest once below.
   // Load correction is a transparent approximation: carried mass increases active cost only.
   active+=(met-1)*(rider+luggage)*hours;if(up)uphillMeters+=d;
  }
  const rideHours=meters/1000/v,stopMinutes=Math.max(0,Number(options.stopMinutes)||0),restRide=rider*rideHours,restStops=rider*stopMinutes/60;
  return {valid:true,walking:true,active,total:active+restRide+restStops,rest:restRide+restStops,restRide,restStops,rideHours,meters,heightMeters,missingHeightMeters:Math.max(0,meters-heightMeters),mass:rider+luggage,baseMET:base,terrain,uphillMeters,windMeters:0};
 }
 root.PlannerWalking={speed,flatMET,estimate};
})(typeof globalThis!=='undefined'?globalThis:this);
