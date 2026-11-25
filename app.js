'use strict';
const config = window.MAP_CONFIG;
const statusElement = document.querySelector('#map-status');
const notice = document.querySelector('#notice');
let noticeTimer;
let map;
let marker;
let userLocationMarker;
let userLocationCentered = false;
let customSource = Boolean(config.styleUrl);
let localMetadata;
let localReady = false;
let localSourceAdded = false;
let sourceError = false;
const localLayerIds = ['local-land', 'local-water', 'local-buildings', 'local-roads-outline', 'local-roads', 'local-points', 'local-stops'];
function updateStatus() {
  if (sourceError) return;
  statusElement.textContent = customSource ? 'Cartografia personalizada' : localReady ? `${localMetadata ? localMetadata.features.toLocaleString('es-MX') + ' elementos - ' : ''}PBF local - fondo OpenStreetMap` : localSourceAdded ? 'Cargando datos del PBF local...' : 'Mapa base listo; PBF local desactivado';
}
function addLocalLayers() {
  localReady = false;
  sourceError = false;
  if (customSource || localSourceAdded || !document.querySelector('#local-visible').checked) return;
  map.addSource('local-pbf', {type: 'geojson', data: config.localData, attribution: 'Datos PBF Â© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL)'});
  localSourceAdded = true;
  const layer = (id, type, filter, paint, minzoom = 0) => map.addLayer({id, type, source: 'local-pbf', filter, paint, minzoom, layout: {visibility: document.querySelector('#local-visible').checked ? 'visible' : 'none'}});
  const polygon = ['==', ['geometry-type'], 'Polygon'];
  const road = ['all', ['==', ['geometry-type'], 'LineString'], ['has', 'highway']];
  layer('local-land', 'fill', ['all', polygon, ['any', ['has', 'landuse'], ['has', 'leisure']]], {'fill-color': '#b8d3a2', 'fill-opacity': 0.35});
  // El extracto cierra artificialmente la laguna en su borde sur. El fondo OSM
  // ya contiene agua completa; no superponer el polÃ­gono recortado del PBF.
  layer('local-buildings', 'fill', ['all', polygon, ['has', 'building']], {'fill-color': '#bdc9bc', 'fill-outline-color': '#8fa08c', 'fill-opacity': 0.7}, 14);
  layer('local-roads-outline', 'line', road, {'line-color': '#748d77', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 5, 19, 13], 'line-opacity': 0.7});
  layer('local-roads', 'line', road, {'line-color': ['match', ['get', 'highway'], ['primary', 'secondary', 'tertiary'], '#e7c879', '#fffdf0'], 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 3, 19, 10]});
  layer('local-points', 'circle', ['all', ['==', ['geometry-type'], 'Point'], ['any', ['has', 'amenity'], ['has', 'shop'], ['has', 'tourism']]], {'circle-radius': 4, 'circle-color': '#276e57', 'circle-stroke-color': '#fffef9', 'circle-stroke-width': 1.5}, 15);
  layer('local-stops', 'circle', ['all', ['==', ['geometry-type'], 'Point'], ['any', ['==', ['get', 'highway'], 'bus_stop'], ['in', ['get', 'public_transport'], ['literal', ['platform', 'stop_position']]]]], {'circle-radius': 7, 'circle-color': '#cc853c', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2});
}
function featurePopup(feature, lngLat) {
  const content = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = feature.properties.name || feature.properties['addr:street'] || 'Elemento del mapa';
  const description = document.createElement('small');
  description.textContent = [feature.properties.highway, feature.properties.amenity, feature.properties.shop, feature.properties.building && 'Edificio', feature.properties.id].filter(Boolean).join(' Â· ');
  content.append(title, description);
  new maplibregl.Popup().setLngLat(lngLat).setDOMContent(content).addTo(map);
}
async function fetchJSON(url) {
  const response = await fetch(url, {cache: 'default'});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
fetchJSON(config.metadata).then(metadata => {
  localMetadata = metadata;
  document.querySelector('#local-summary').textContent = `${metadata.file} Â· ${metadata.features.toLocaleString('es-MX')} elementos importados.`;
  updateStatus();
}).catch(() => { document.querySelector('#local-summary').textContent = 'No se encontraron los datos locales. Ejecuta npm run import:pbf y abre la pÃ¡gina con un servidor local.'; });
fetchJSON(config.stops).then(data => {
  const list = document.querySelector('#stop-list');
  list.replaceChildren();
  if (!data.features.length) list.textContent = 'Este extracto no contiene paradas registradas.';
  data.features.forEach((feature, index) => {
    const button = document.createElement('button');
    button.className = 'stop-card';
    button.textContent = `${feature.properties.name || 'Parada ' + (index + 1)} â†—`;
    button.addEventListener('click', () => {
      if (!map) return notify('El mapa no estÃ¡ disponible.');
      if (window.matchMedia('(max-width: 650px)').matches) showPanel('general');
      map.flyTo({center: feature.geometry.coordinates, zoom: 17});
      featurePopup(feature, feature.geometry.coordinates);
    });
    list.append(button);
  });
}).catch(() => { document.querySelector('#stop-list').textContent = 'No se pudieron cargar las paradas locales.'; });
function notify(message, kind = 'status') {
  if (kind === 'optional' && window.uiPrefs?.alerts === false) return;
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 6500);
}
function showPanel(name) {
  document.querySelector('.header-more').open = false;
  document.body.classList.toggle('panel-open', name !== 'general');
  document.querySelectorAll('.panel').forEach(panel => { panel.hidden = panel.id !== name; });
  document.querySelectorAll('[data-panel]').forEach(button => {
    const selected = button.dataset.panel === name;
    button.classList.toggle('active', selected);
    if (button.hasAttribute('aria-controls')) button.setAttribute('aria-expanded', String(selected));
    if (button.closest('nav') && selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelector('#welcome').hidden = name !== 'general';
}
window.showPanel = showPanel;
window.showUserLocation = ({latitude, longitude, accuracy}) => {
  if (!map) return;
  const coordinates = [longitude, latitude];
  if (!userLocationMarker) {
    const element = document.createElement('div');
    element.className = 'user-location-marker';
    element.setAttribute('aria-label', 'Tu ubicaciÃ³n actual');
    userLocationMarker = new maplibregl.Marker({element}).setLngLat(coordinates).addTo(map);
  } else userLocationMarker.setLngLat(coordinates);
  if (!userLocationCentered) {
    map.flyTo({center: coordinates, zoom: Math.max(map.getZoom(), 16)});
    userLocationCentered = true;
  }
  window.dispatchEvent(new CustomEvent('ubicarmen:user-location', {detail: {latitude, longitude, accuracy}}));
};
window.clearUserLocation = () => {
  userLocationMarker?.remove();
  userLocationMarker = null;
  userLocationCentered = false;
  window.dispatchEvent(new Event('ubicarmen:user-location-cleared'));
};
window.notify = notify;
document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => showPanel(button.dataset.panel)));
document.querySelectorAll('.panel').forEach(panel => {
  const close = document.createElement('button');
  close.className = 'panel-close';
  close.type = 'button';
  close.append(appIcon('close'));
  close.setAttribute('aria-label', 'Cerrar panel');
  close.addEventListener('click', () => {
    showPanel('general');
    document.querySelector('nav [data-panel="general"]').focus({preventScroll: true});
  });
  panel.prepend(close);
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') showPanel('general'); });
function baseStyle() {
  return {version: 8, sources: {osm: {type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: 'Â© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}}, layers: [{id: 'base', type: 'raster', source: 'osm', paint: {'raster-saturation': -0.55, 'raster-contrast': -0.08}}]};
}
try {
  if (!window.maplibregl) throw new Error('MapLibre no disponible');
  map = new maplibregl.Map({container: 'map', style: config.styleUrl || baseStyle(), center: config.center, zoom: config.zoom, attributionControl: true});
  map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');
  map.addControl(new maplibregl.ScaleControl({unit: 'metric'}), 'bottom-left');
  map.on('style.load', () => { addLocalLayers(); updateStatus(); });
  map.on('sourcedata', event => {
    if (event.sourceId === 'local-pbf' && event.isSourceLoaded) { localReady = true; updateStatus(); }
  });
  map.on('error', event => {
    sourceError = true;
    statusElement.textContent = event.sourceId === 'local-pbf' ? 'No se pudo cargar el PBF convertido. Ejecuta npm run import:pbf y usa un servidor local.' : 'No se pudo cargar parte del mapa. Revisa la conexiÃ³n o la fuente.';
  });
  map.on('click', event => {
    const layers = [...localLayerIds].reverse().filter(id => map.getLayer(id));
    if (!layers.length) return;
    const features = map.queryRenderedFeatures(event.point, {layers});
    if (features.length) featurePopup(features[0], event.lngLat);
  });
} catch (error) {
  statusElement.textContent = 'Mapa no disponible. Comprueba tu conexiÃ³n y la compatibilidad con WebGL.';
}
document.querySelector('#home').addEventListener('click', () => {
  if (!map) return notify('El mapa no estÃ¡ disponible. Recarga la pÃ¡gina con conexiÃ³n a internet.');
  map.flyTo({center: config.center, zoom: config.zoom});
  if (marker) { marker.remove(); marker = null; }
  showPanel('general');
});
document.querySelector('#search-form').addEventListener('submit', event => {
  event.preventDefault();
  const raw = document.querySelector('#coordinates').value.trim();
  const parts = raw.split(',').map(part => part.trim());
  const [lat, lng] = parts.map(Number);
  if (parts.length !== 2 || parts.some(part => !part) || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85.051129 || Math.abs(lng) > 180) return notify('Escribe coordenadas vÃ¡lidas: latitud, longitud. Ejemplo: 18.651, -91.807');
  if (!map) return notify('El mapa todavÃ­a no estÃ¡ disponible.');
  if (marker) marker.remove();
  marker = new maplibregl.Marker({color: '#125b46'}).setLngLat([lng, lat]).addTo(map);
  if (window.matchMedia('(max-width: 650px)').matches) {
    document.querySelector('#coordinates').blur();
    showPanel('general');
  }
  map.flyTo({center: [lng, lat], zoom: 15});
  notify('UbicaciÃ³n encontrada en el mapa.');
});
document.querySelector('#source-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!map) return notify('El mapa todavÃ­a no estÃ¡ disponible.');
  const url = new URL(document.querySelector('#style-url').value);
  if (!['http:', 'https:'].includes(url.protocol)) return notify('Usa una direcciÃ³n HTTP o HTTPS.');
  customSource = true;
  localSourceAdded = false;
  localReady = false;
  statusElement.textContent = 'Conectando cartografÃ­aâ€¦';
  map.setStyle(url.href);
});
document.querySelector('#reset-source').addEventListener('click', () => {
  if (!map) return notify('El mapa todavÃ­a no estÃ¡ disponible.');
  customSource = false;
  localSourceAdded = false;
  localReady = false;
  map.setStyle(baseStyle(), {diff: false});
  document.querySelector('#style-url').value = '';
});
document.querySelector('#local-visible').addEventListener('change', event => {
  if (!map) return;
  if (event.target.checked && !localSourceAdded) {
    addLocalLayers();
    updateStatus();
    return;
  }
  localLayerIds.forEach(id => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', event.target.checked ? 'visible' : 'none');
  });
});

document.addEventListener('click', event => {
 const menu = document.querySelector('.header-more');
 if (!menu.contains(event.target)) menu.open = false;
});
