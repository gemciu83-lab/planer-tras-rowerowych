/* Estimated riding energy, independent of routing and the DOM. */
(function(root){
 'use strict';
 const bikes={trekking:{crr:.008,cda:.6},gravel:{crr:.007,cda:.45},road:{crr:.005,cda:.32},mtb:{crr:.012,cda:.65}};
 const positions={upright:.65,touring:.5,tucked:.32};
 const rad=Math.PI/180;
 function bearing(a,b){const p=a[1]*rad,q=b[1]*rad,d=(b[0]-a[0])*rad;return Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))}
 function number(v,fallback,min,max){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}
 function settings(value={}){return {
  rider:number(value.rider,70,25,250),bike:number(value.bike,22,3,60),luggage:number(value.luggage,0,0,100),speed:number(value.speed,16,3,60),
  type:Object.hasOwn(bikes,value.type)?value.type:'trekking',position:Object.hasOwn(positions,value.position)?value.position:'auto',
  windSpeed:number(value.windSpeed,0,0,120),windDirection:((number(value.windDirection,0,-360,360)%360)+360)%360,
  stopMinutes:number(value.stopMinutes,0,0,1000000)
 }}
 function estimate(cs,metrics,options={}){
  const s=settings(options),bike=bikes[s.type],mass=s.rider+s.bike+s.luggage,v=s.speed/3.6,cda=positions[s.position]||bike.cda;
  let work=0,meters=0,windMeters=0,upwind=0,downwind=0,crosswind=0,windMin=Infinity,windMax=0;
  for(let i=0;i<metrics.meters.length;i++){
   const d=metrics.meters[i];if(!Number.isFinite(d)||d<.01)continue;
   const wind=options.windAt?options.windAt(meters+d/2):{speed:s.windSpeed/3.6,direction:s.windDirection};
   if(!wind||!Number.isFinite(wind.speed)||wind.speed<0||!Number.isFinite(wind.direction))return {valid:false,reason:'wind'};
   windMin=Math.min(windMin,wind.speed);windMax=Math.max(windMax,wind.speed);
   const angle=wind.direction*rad-bearing(cs[i],cs[i+1]),along=wind.speed*Math.cos(angle),side=wind.speed*Math.sin(angle),relativeAlong=v+along;
   const air=.5*1.225*cda*Math.hypot(relativeAlong,side)*relativeAlong;
   work+=Math.max(0,(mass*9.81*bike.crr+air)*d+mass*9.81*(Number.isFinite(metrics.rise[i])?metrics.rise[i]:0));
   if(wind.speed>=.5){windMeters+=d;if(along>Math.abs(side)*.5)upwind+=d;else if(along < -Math.abs(side)*.5)downwind+=d;else crosswind+=d}
   meters+=d;
  }
  // 24% is an assumed NET efficiency. Add the resting component exactly once.
  const rideHours=meters/1000/s.speed,active=work/(.97*.24*4184),restRide=s.rider*rideHours,restStops=s.rider*s.stopMinutes/60;
  return {valid:true,active,restRide,restStops,rest:restRide+restStops,total:active+restRide+restStops,rideHours,meters,mass,cda,windMeters,upwind,downwind,crosswind,windMin:Number.isFinite(windMin)?windMin:0,windMax};
 }
 function parseForecast(json,samples){
  const records=Array.isArray(json)?json:[json];if(records.length!==samples.length)throw Error('Niepełna prognoza dla miejsc na trasie.');
  return records.map((record,i)=>{
   const h=record?.hourly,t=h?.time,s=h?.wind_speed_10m,d=h?.wind_direction_10m;
   if(!Array.isArray(t)||!t.length||t.length>1000||!Array.isArray(s)||!Array.isArray(d)||s.length!==t.length||d.length!==t.length||record.hourly_units?.wind_speed_10m!=='m/s')throw Error('Niepoprawne dane prognozy wiatru.');
   if(t.some((v,j)=>!Number.isFinite(v)||(j&&v<=t[j-1])))throw Error('Niepoprawny czas prognozy.');
   return {meters:samples[i].meters,times:t.map(v=>v*1000),winds:t.map((_,j)=>Number.isFinite(s[j])&&s[j]>=0&&s[j]<=100&&Number.isFinite(d[j])?{speed:s[j],direction:((d[j]%360)+360)%360}:null)};
  });
 }
 function forecastAt(records,meters,epoch){
  if(!records?.length||!Number.isFinite(epoch))return null;
  let row=records[0];for(const next of records)if(Math.abs(next.meters-meters)<Math.abs(row.meters-meters))row=next;
  let lo=0,hi=row.times.length;while(lo<hi){const mid=(lo+hi)>>1;if(row.times[mid]<=epoch)lo=mid+1;else hi=mid}
  const i=lo-1;return i>=0&&epoch-row.times[i]<3600000?row.winds[i]:null;
 }
 root.PlannerEnergy={settings,estimate,bearing,parseForecast,forecastAt};
})(typeof globalThis!=='undefined'?globalThis:this);
