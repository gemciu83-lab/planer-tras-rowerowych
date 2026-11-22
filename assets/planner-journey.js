'use strict';
const PlannerJourney = (() => {
  function fix(position, now = Date.now()) {
    const c = position?.coords, time = position?.timestamp;
    if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || Math.abs(c.latitude) > 90 ||
        Math.abs(c.longitude) > 180 || !Number.isFinite(c.accuracy) || c.accuracy < 0 ||
        !Number.isFinite(time) || now - time > 15000 || time - now > 5000) return null;
    const result = { lon: c.longitude, lat: c.latitude, accuracy: c.accuracy, time };
    if (Number.isFinite(c.altitude) && Number.isFinite(c.altitudeAccuracy) && c.altitudeAccuracy >= 0 && c.altitudeAccuracy <= 50) result.height = c.altitude;
    return result;
  }

  function recorder(saved) {
    let segments = [], state = 'stopped', count = 0, meters = 0, newSegment = true;
    if (saved?.version === 1 && Array.isArray(saved.segments)) {
      let previous = -Infinity;
      for (const segment of saved.segments) {
        if (!Array.isArray(segment)) continue;
        const clean = [];
        for (const p of segment) {
          if (count >= 150000) break;
          if (!p || !Number.isFinite(p.lon) || !Number.isFinite(p.lat) || Math.abs(p.lon) > 180 || Math.abs(p.lat) > 90 ||
              !Number.isFinite(p.time) || p.time <= previous || p.time < 0 || p.time > 8640000000000000) continue;
          const point = { lon: p.lon, lat: p.lat, time: p.time, accuracy: Number.isFinite(p.accuracy) ? Math.max(0, p.accuracy) : 50 };
          if (Number.isFinite(p.height)) point.height = p.height;
          if (clean.length) meters += PlannerTrip.haversine([clean.at(-1).lon, clean.at(-1).lat], [point.lon, point.lat]) * 1000;
          clean.push(point); previous = point.time; count++;
        }
        if (clean.length) segments.push(clean);
      }
      state = count && saved.state !== 'stopped' ? 'paused' : 'stopped';
    }
    function append(point, maxSpeed = 30) {
      if (state !== 'recording' || !point || point.accuracy > 50) return false;
      if (count >= 150000) { state = 'stopped'; return false; }
      const last = segments.at(-1)?.at(-1);
      if (last && point.time <= last.time) return false;
      let distance = last ? PlannerTrip.haversine([last.lon, last.lat], [point.lon, point.lat]) * 1000 : 0;
      const seconds = last ? (point.time - last.time) / 1000 : 0;
      if (!newSegment && last && seconds <= 120 && distance / seconds > maxSpeed) return false;
      if (!newSegment && last && seconds <= 120 && distance < Math.max(3, (last.accuracy + point.accuracy) * .3)) {
        if (seconds < 15) return false;
        point = { ...point, lon: last.lon, lat: last.lat }; distance = 0;
      }
      if (newSegment || !last || seconds > 120) { segments.push([]); distance = 0; }
      segments.at(-1).push({ ...point }); count++; meters += distance; newSegment = false;
      return true;
    }
    return {
      append,
      start() { state = 'recording'; newSegment = true; },
      pause() { if (state === 'recording') state = 'paused'; newSegment = true; },
      stop() { state = 'stopped'; newSegment = true; },
      snapshot() { return { version: 1, state, segments: segments.map(s => s.map(p => ({ ...p }))) }; },
      get state() { return state; }, get count() { return count; }, get meters() { return meters; },
      get segments() { return segments; }
    };
  }

  function progress(index, point, previous = null) {
    if (!index || index.cs.length < 2) return null;
    const coordinate = [point.lon, point.lat];
    if (!previous) return PlannerTrip.nearest(index, coordinate);
    // Search near the previous position first, so crossings do not jump to a later loop.
    const span = Math.max(400, Math.min(3000, Math.max(0, point.time - previous.time) / 1000 * 35));
    const low = Math.max(0, previous.meters - 150), high = Math.min(index.total, previous.meters + span);
    function at(meters) {
      let a = 0, b = index.meters.length - 1;
      while (a < b) { const m = (a + b) >> 1; if (index.meters[m] < meters) a = m + 1; else b = m; }
      return a;
    }
    const start = Math.max(0, at(low) - 1), end = Math.min(index.cs.length, at(high) + 2);
    const local = PlannerTrip.nearest(PlannerTrip.routeIndex(index.cs.slice(start, end)), coordinate);
    if (!local) return null;
    return { ...local, segment: local.segment + start, meters: local.meters + index.meters[start] };
  }

  function deviation() {
    let outside = 0, since = 0, inside = 0, alarm = false, lastTime = -Infinity;
    return {
      update(point, offset) {
        if (!point || point.time <= lastTime) return { alarm, entered: false };
        if (point.time - lastTime > 30000) { outside = inside = 0; since = 0; }
        lastTime = point.time;
        const was = alarm;
        if (point.accuracy > 50 || !Number.isFinite(offset)) { outside = inside = 0; since = 0; return { alarm, entered: false }; }
        if (offset > Math.max(40, point.accuracy * 2)) {
          if (!outside) since = point.time;
          outside++; inside = 0;
          if (outside >= 3 && point.time - since >= 5000) alarm = true;
        } else if (offset < Math.max(20, point.accuracy)) {
          outside = 0; since = 0; inside++;
          if (inside >= 2) alarm = false;
        } else { outside = inside = 0; since = 0; }
        return { alarm, entered: alarm && !was };
      }
    };
  }

  function gpx(record) {
    const segments = record.segments.filter(s => s.length);
    if (!segments.length) throw Error('Nagranie nie zawiera jeszcze punktów GPS.');
    return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Planer tras — nagranie GPS" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Nagranie wyprawy</name>' +
      segments.map(s => '<trkseg>' + s.map(p => '<trkpt lat="' + p.lat + '" lon="' + p.lon + '">' +
        (Number.isFinite(p.height) ? '<ele>' + p.height + '</ele>' : '') + '<time>' + new Date(p.time).toISOString() + '</time></trkpt>').join('') + '</trkseg>').join('') + '</trk></gpx>';
  }
  return { fix, recorder, progress, deviation, gpx };
})();
