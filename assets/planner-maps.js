'use strict';

const styleDefinitions = (() => {
  const osmCredit = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const osm = { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: osmCredit };
  const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const imagery = {
    url: `${esri}World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics and GIS User Community'
  };
  const topographic = {
    url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    maxNativeZoom: 17,
    attribution: `${osmCredit}, SRTM · <a href="https://opentopomap.org/">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>)`
  };
  const poland = [[48.9, 14.0], [55.0, 24.3]];
  const forestCredit = '© <a href="https://www.bdl.lasy.gov.pl/portal/">Bank Danych o Lasach</a>';

  function mercatorBounds({ x, y, z }) {
    const edge = 20037508.342789244;
    const size = (2 * edge) / (2 ** z);
    return [x * size - edge, edge - (y + 1) * size, (x + 1) * size - edge, edge - y * size].join(',');
  }

  function forestOverlay(service, layers) {
    return {
      bounds: poland,
      noWrap: true,
      minZoom: 9,
      attribution: forestCredit,
      tileUrl(coords) {
        const params = new URLSearchParams({
          bbox: mercatorBounds(coords), bboxSR: '3857', imageSR: '3857',
          size: '256,256', format: 'png32', transparent: 'true', layers: `show:${layers}`, f: 'image'
        });
        return `https://mapserver.bdl.lasy.gov.pl/arcgis/rest/services/${service}/MapServer/export?${params}`;
      }
    };
  }

  const orthophoto = {
    bounds: poland,
    noWrap: true,
    minZoom: 10,
    attribution: '© <a href="https://www.geoportal.gov.pl/pl/dane/ortofotomapa-orto/">GUGiK · Geoportal</a>',
    tileUrl(coords) {
      const params = new URLSearchParams({
        SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap', LAYERS: 'Raster', STYLES: '',
        FORMAT: 'image/png', TRANSPARENT: 'TRUE', SRS: 'EPSG:3857',
        BBOX: mercatorBounds(coords), WIDTH: '256', HEIGHT: '256'
      });
      return `https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution?${params}`;
    }
  };

  return {
    normal: [osm],
    walking: [topographic, forestOverlay('WMS_BDL_Mapa_turystyczna', '6,8,18,20,21,22')],
    cycle: [{
      url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
      attribution: `${osmCredit} · <a href="https://www.cyclosm.org/">CyclOSM</a> · tiles OpenStreetMap France`
    }],
    topographic: [topographic],
    forest: [osm, forestOverlay('WMS_BDL', '1,3,5')],
    terrain: [{
      url: `${esri}World_Topo_Map/MapServer/tile/{z}/{y}/{x}`,
      attribution: `Tiles © Esri, HERE, Garmin, Intermap, USGS, FAO, NPS · ${osmCredit}`
    }],
    orthophoto: [imagery, orthophoto],
    satellite: [imagery],
    hybrid: [imagery, {
      url: `${esri}Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
      attribution: `Nazwy i granice © Esri, HERE, Garmin · ${osmCredit}`
    }]
  };
})();
