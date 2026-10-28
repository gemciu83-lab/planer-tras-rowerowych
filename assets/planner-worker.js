'use strict';
importScripts('planner-trip.js?v=3.11.0','planner-core.js?v=3.11.0');
self.onmessage=({data})=>{
 try{
  const {id,track}=data;if(!PlannerCore.coordinatesValid(track))throw Error('Nieprawidłowy ślad');
  const start=performance.now(),distance=PlannerTrip.haversine;
  const elevation=PlannerCore.elevationModel(track,distance),metrics=PlannerCore.rideMetrics(track,distance),terrain=PlannerCore.terrainModel(track,distance);
  self.postMessage({id,elevation,metrics,terrain,milliseconds:performance.now()-start},[metrics.meters.buffer,metrics.rise.buffer,terrain.distances.buffer]);
 }catch(error){self.postMessage({id:data.id,error:error.message})}
};
