'use strict';
// Capa de datos local-first de Ubicarmen.
//
// Contrato publico: window.UbiData.
//   getRoutes()        -> {updated, routes: [...]}  (misma forma que data/routes.json)
//   getTransit()       -> FeatureCollection GeoJSON (tramos kind:'route' y paradas kind:'stop')
//   getVehicles()      -> [{id, routeId, longitude, latitude, updatedAt, active, simulated}]
//   getMetadata()      -> contenido de data/metadata.json
//   getOsmStops()      -> contenido de data/stops.geojson
//   getLocalDataUrl()  -> URL del GeoJSON base del PBF
//   hasFirebase()      -> true si hay configuracion de Firebase utilizable
//   origin             -> 'local' | 'firestore' (origen del catalogo resuelto)
//   lastVehicleOrigin  -> 'simulation' | 'firestore' | 'api'
//   reset()            -> olvida cache y errores (solo para pruebas)
//
// Precedencia del catalogo: Firestore (si esta configurado y responde) -> snapshot
// data/*.json. Cualquier fallo, respuesta vacia o forma inesperada cae al snapshot
// y se avisa por consola. La app nunca se queda sin datos por culpa de Firebase.
// Vehiculos: Firestore -> API config.vehiclesUrl -> simulacion local.
(() => {
  const config = window.MAP_CONFIG || {};
  const firebaseConfig = config.firebase && config.firebase.projectId ? config.firebase : null;
  const LOCAL = {
    routes: config.routesUrl || 'data/routes.json',
    transit: config.transitUrl || 'data/transit.geojson',
    metadata: config.metadata || 'data/metadata.json',
    osmStops: config.stops || 'data/stops.geojson',
    localData: config.localData || 'data/carmen.geojson'
  };
  const TIMEOUT_MS = 5000;
  const warned = new Set();
  const simulationStarted = Date.now();
  let simulationPaths = null;

  let catalogPromise = null;
  let metadataPromise = null;
  let osmStopsPromise = null;
  let catalogOrigin = 'local';
  let lastVehicleOrigin = 'simulation';
  let firestoreDown = false;
  let vehiclesFirestoreDown = false;

  // Aviso visible para el usuario cuando la nube falla y se usa el respaldo local.
  function notifyFallback(message) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent('ubicarmen:fallback', {detail: {message}}));
  }

  const warnOnce = (key, message) => {
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`[UbiData] ${message}`);
  };

  function firebaseEnabled() {
    if (!firebaseConfig) return false;
    if (!firebaseConfig.useEmulators && !firebaseConfig.apiKey) {
      warnOnce('no-api-key', 'Hay configuracion de Firebase sin apiKey; se usa el snapshot local.');
      return false;
    }
    return true;
  }

  function timeoutSignal() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    return {signal: controller.signal, done: () => clearTimeout(timer)};
  }

  async function fetchJSON(url, label, cache = 'default') {
    const {signal, done} = timeoutSignal();
    try {
      const response = await fetch(url, {cache, signal});
      if (!response.ok) throw new Error(`${label || url}: HTTP ${response.status}`);
      return await response.json();
    } finally {
      done();
    }
  }

  // --- Firestore por REST (sin SDK ni build) -------------------------------

  function firestoreBase() {
    if (!firebaseConfig.useEmulators) {
      return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)`;
    }
    const host = (firebaseConfig.emulatorHost || '127.0.0.1:8080')
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
    return `http://${host}/v1/projects/${firebaseConfig.projectId}/databases/(default)`;
  }

  function decodeFields(fields) {
    const result = {};
    for (const [key, value] of Object.entries(fields || {})) result[key] = decodeValue(value);
    return result;
  }

  function decodeValue(value) {
    if (!value || typeof value !== 'object') return null;
    if ('stringValue' in value) return value.stringValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('booleanValue' in value) return value.booleanValue;
    if ('nullValue' in value) return null;
    if ('timestampValue' in value) return value.timestampValue;
    if ('referenceValue' in value) return value.referenceValue;
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
    if ('mapValue' in value) return decodeFields(value.mapValue.fields);
    return null;
  }

  function encodeFields(fields) {
    const encode = value => {
      if (value === null || value === undefined) return {nullValue: null};
      if (Array.isArray(value)) return {arrayValue: {values: value.map(encode)}};
      if (typeof value === 'string') return {stringValue: value};
      if (typeof value === 'boolean') return {booleanValue: value};
      if (typeof value === 'number') {
        return Number.isInteger(value) ? {integerValue: String(value)} : {doubleValue: value};
      }
      return {mapValue: {fields: encodeFields(value)}};
    };
    return Object.fromEntries(
      Object.entries(fields)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, encode(value)])
    );
  }

  async function requestFirestore(path, {method = 'GET', token, body, params = {}} = {}) {
    const search = new URLSearchParams();
    if (firebaseConfig.apiKey) search.set('key', firebaseConfig.apiKey);
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    const {signal, done} = timeoutSignal();
    try {
      const headers = {};
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${firestoreBase()}/${path}?${search}`, {
        method,
        headers,
        signal,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}${detail ? ` · ${detail.slice(0, 120)}` : ''}`);
      }
      if (response.status === 204) return null;
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } finally {
      done();
    }
  }

  async function listDocuments(collectionPath, token) {
    const documents = [];
    let pageToken = '';
    do {
      const body = await requestFirestore(`documents/${collectionPath}`, {token, params: {pageSize: '300', pageToken}});
      for (const document of body?.documents || []) {
        documents.push({id: document.name.split('/').pop(), ...decodeFields(document.fields)});
      }
      pageToken = body?.nextPageToken || '';
    } while (pageToken);
    return documents;
  }

  async function getDocument(path, token) {
    try {
      const body = await requestFirestore(`documents/${path}`, {token});
      return body ? {id: body.name.split('/').pop(), ...decodeFields(body.fields)} : null;
    } catch (error) {
      if (/HTTP 404/.test(error.message)) return null;
      throw error;
    }
  }

  async function setDocument(path, fields, token) {
    return requestFirestore(`documents/${path}`, {method: 'PATCH', token, body: {fields: encodeFields(fields)}});
  }

  async function deleteDocument(path, token) {
    return requestFirestore(`documents/${path}`, {method: 'DELETE', token});
  }

  // --- Normalizacion al contrato de la app ---------------------------------

  function assertRoutes(value) {
    if (!value || !Array.isArray(value.routes) || !value.routes.length) {
      throw new Error('catalogo sin rutas');
    }
    for (const route of value.routes) {
      if (!route.id || !route.name) throw new Error('ruta sin id o nombre');
    }
    return value;
  }

  function assertTransit(value) {
    if (!value || value.type !== 'FeatureCollection' || !Array.isArray(value.features) || !value.features.length) {
      throw new Error('GeoJSON invalido o vacio');
    }
    return value;
  }

  function routesFromDocuments(documents) {
    const routes = documents.map(document => ({
      id: document.id,
      name: document.name,
      color: document.color,
      status: document.status,
      stopCount: Number(document.stopCount) || 0,
      description: document.description || '',
      note: document.note || '',
      streets: Array.isArray(document.streets) ? document.streets : [],
      sources: Array.isArray(document.sources) ? document.sources : []
    }));
    const updated = documents.reduce((latest, document) => {
      return document.updated && document.updated > latest ? document.updated : latest;
    }, '');
    return {updated, routes};
  }

  function transitFromDocuments(stopDocuments, segmentDocuments) {
    const features = [];

    for (const stop of stopDocuments) {
      const lng = Number(stop.lng);
      const lat = Number(stop.lat);
      if (!stop.routeId || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      features.push({
        type: 'Feature',
        id: `${stop.routeId}-stop-${stop.number}`,
        properties: {
          routeId: stop.routeId,
          kind: 'stop',
          number: Number(stop.number),
          name: stop.name || 'Parada de referencia',
          note: stop.note || '',
          accuracy: stop.accuracy || 'approximate',
          source: stop.source || 'firestore'
        },
        geometry: {type: 'Point', coordinates: [lng, lat]}
      });
    }

    const ordered = [...segmentDocuments].sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));
    for (const segment of ordered) {
      const raw = Array.isArray(segment.coordinates) ? segment.coordinates : [];
      // Acepta [{lng, lat}] (Firestore) y [[lng, lat]] (GeoJSON).
      const coordinates = raw
        .map(point => (Array.isArray(point) ? [Number(point[0]), Number(point[1])] : [Number(point && point.lng), Number(point && point.lat)]))
        .filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
      if (!segment.routeId || coordinates.length < 2) continue;
      features.push({
        type: 'Feature',
        id: `${segment.routeId}-segment-${segment.index}`,
        properties: {
          routeId: segment.routeId,
          kind: 'route',
          name: segment.name || 'Tramo de referencia',
          accuracy: segment.accuracy || 'approximate',
          source: segment.source || 'firestore',
          osmWay: segment.osmWay
        },
        geometry: {type: 'LineString', coordinates}
      });
    }

    return {type: 'FeatureCollection', features};
  }

  function vehiclesFromDocuments(documents) {
    return documents
      .map(document => ({
        id: document.id,
        routeId: document.routeId,
        longitude: Number(document.longitude),
        latitude: Number(document.latitude),
        updatedAt: document.updatedAt,
        active: document.active !== false,
        simulated: document.simulated === true
      }))
      .filter(vehicle => Number.isFinite(vehicle.longitude) && Number.isFinite(vehicle.latitude));
  }

  // --- Catalogo ------------------------------------------------------------

  async function loadLocalCatalog() {
    const [routes, transit] = await Promise.all([
      fetchJSON(LOCAL.routes, 'snapshot de rutas').then(assertRoutes),
      fetchJSON(LOCAL.transit, 'snapshot de rutas y paradas').then(assertTransit)
    ]);
    return {routes, transit};
  }

  function ensureCatalog() {
    if (!catalogPromise) {
      catalogPromise = (async () => {
        if (firebaseEnabled() && !firestoreDown) {
          try {
            const [routeDocuments, stopDocuments, segmentDocuments] = await Promise.all([
              listDocuments('routes'),
              listDocuments('stops'),
              listDocuments('routeSegments')
            ]);
            const routes = assertRoutes(routesFromDocuments(routeDocuments));
            const transit = assertTransit(transitFromDocuments(stopDocuments, segmentDocuments));
            const routeIds = new Set(routes.routes.map(route => route.id));
            const unknown = transit.features.filter(feature => !routeIds.has(feature.properties.routeId));
            if (unknown.length) throw new Error(`${unknown.length} elementos apuntan a rutas inexistentes`);
            catalogOrigin = 'firestore';
            console.info('[UbiData] Catalogo cargado desde Firestore.');
            return {routes, transit};
          } catch (error) {
            firestoreDown = true;
            warnOnce('catalog-fallback', `Firestore no disponible (${error.message}). Uso el snapshot local de data/*.json.`);
            notifyFallback('Sin conexión con la nube: mostrando el catálogo guardado en este dispositivo.');
          }
        }
        const local = await loadLocalCatalog();
        catalogOrigin = 'local';
        return local;
      })();
    }
    return catalogPromise;
  }

  // --- Vehiculos -----------------------------------------------------------

  function routeDistanceMeters(a, b) {
    const radians = degrees => degrees * Math.PI / 180;
    const latitudeDelta = radians(b[1] - a[1]);
    const longitudeDelta = radians(b[0] - a[0]);
    const value = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(longitudeDelta / 2) ** 2;
    return 6371008.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  function connectRouteSegments(features) {
    const remaining = features
      .map(feature => feature.geometry.coordinates.filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1])))
      .filter(coordinates => coordinates.length > 1);
    const paths = [];
    const connectionLimit = 15;

    while (remaining.length) {
      const path = remaining.shift().slice();
      let connected = true;
      while (connected && remaining.length) {
        connected = false;
        let closest = {distance: connectionLimit + 1};
        remaining.forEach((coordinates, index) => {
          const candidates = [
            {distance: routeDistanceMeters(path[path.length - 1], coordinates[0]), side: 'end', reverse: false},
            {distance: routeDistanceMeters(path[path.length - 1], coordinates[coordinates.length - 1]), side: 'end', reverse: true},
            {distance: routeDistanceMeters(path[0], coordinates[coordinates.length - 1]), side: 'start', reverse: false},
            {distance: routeDistanceMeters(path[0], coordinates[0]), side: 'start', reverse: true}
          ];
          candidates.forEach(candidate => {
            if (candidate.distance < closest.distance) closest = {...candidate, index};
          });
        });
        if (closest.distance <= connectionLimit) {
          const coordinates = remaining.splice(closest.index, 1)[0];
          const ordered = closest.reverse ? coordinates.slice().reverse() : coordinates;
          if (closest.side === 'end') path.push(...ordered.slice(1));
          else path.unshift(...ordered.slice(0, -1));
          connected = true;
        }
      }
      paths.push(path);
    }

    return paths
      .map(coordinates => {
        const segments = [];
        let length = 0;
        coordinates.slice(1).forEach((b, index) => {
          const a = coordinates[index];
          const size = routeDistanceMeters(a, b);
          if (size > 0) {
            segments.push({a, b, start: length, end: length + size});
            length += size;
          }
        });
        return {segments, length};
      })
      .filter(path => path.length > 0)
      .sort((a, b) => b.length - a.length);
  }

  function buildSimulationPaths(routes, transit) {
    return routes
      .filter(route => route.status === 'reference')
      .map(route => ({
        id: route.id,
        paths: connectRouteSegments(transit.features.filter(feature =>
          feature.properties.routeId === route.id && feature.properties.kind === 'route'
        ))
      }))
      .filter(route => route.paths.length > 0);
  }

  async function simulateVehicles() {
    const {routes, transit} = await ensureCatalog();
    if (!simulationPaths) simulationPaths = buildSimulationPaths(routes.routes, transit);
    const elapsed = (Date.now() - simulationStarted) / 1000;

    return simulationPaths.flatMap(route => [0, 1].map(index => {
      // Cada unidad sigue un tramo conectado sin saltar entre calles separadas.
      const path = route.paths[Math.min(index, route.paths.length - 1)];
      const phase = (elapsed / 180 + index) % 2;
      const progress = phase <= 1 ? phase : 2 - phase;
      const distance = progress * path.length;
      const segment = path.segments.find(item => distance <= item.end) || path.segments.at(-1);
      const t = (distance - segment.start) / (segment.end - segment.start);
      return {
        id: `${route.id}-${index + 1}`,
        routeId: route.id,
        active: true,
        simulated: true,
        updatedAt: new Date().toISOString(),
        longitude: segment.a[0] + (segment.b[0] - segment.a[0]) * t,
        latitude: segment.a[1] + (segment.b[1] - segment.a[1]) * t
      };
    }));
  }

  async function getVehicles() {
    try {
      if (firebaseEnabled() && !firestoreDown && !vehiclesFirestoreDown) {
        try {
          const vehicles = vehiclesFromDocuments(await listDocuments('vehicles'));
          if (!vehicles.length) throw new Error('la coleccion vehicles esta vacia');
          lastVehicleOrigin = 'firestore';
          return vehicles;
        } catch (error) {
          vehiclesFirestoreDown = true;
          warnOnce('vehicles-firestore', `Vehiculos de Firestore no disponibles (${error.message}).`);
          notifyFallback('Sin conexión con la nube: los camiones vuelven a la simulación local.');
        }
      }

      if (config.vehiclesUrl) {
        try {
          const data = await fetchJSON(config.vehiclesUrl, 'API de vehiculos', 'no-store');
          if (!Array.isArray(data.vehicles)) throw new Error('respuesta sin vehicles[]');
          const vehicles = vehiclesFromDocuments(data.vehicles.map(vehicle => ({...vehicle, id: String(vehicle.id)})))
            .filter(vehicle => Number.isFinite(Date.parse(vehicle.updatedAt)));
          lastVehicleOrigin = 'api';
          return vehicles;
        } catch (error) {
          warnOnce('vehicles-api', `API de vehiculos no disponible (${error.message}). Uso la simulacion local.`);
        }
      }

      lastVehicleOrigin = 'simulation';
      return await simulateVehicles();
    } finally {
      /* sin estado pendiente: el llamador evita solapamientos */
    }
  }

  // --- Datos locales del PBF ----------------------------------------------

  function getMetadata() {
    if (!metadataPromise) {
      metadataPromise = fetchJSON(LOCAL.metadata, 'metadata local').then(value => {
        if (!value || typeof value.features !== 'number') throw new Error('metadata invalida');
        return value;
      });
    }
    return metadataPromise;
  }

  function getOsmStops() {
    if (!osmStopsPromise) {
      osmStopsPromise = fetchJSON(LOCAL.osmStops, 'paradas OSM').then(value => {
        if (!value || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
          throw new Error('paradas OSM invalidas');
        }
        return value;
      });
    }
    return osmStopsPromise;
  }

  window.UbiData = {
    getRoutes: async () => (await ensureCatalog()).routes,
    getTransit: async () => (await ensureCatalog()).transit,
    getVehicles,
    getMetadata,
    getOsmStops,
    getLocalDataUrl: () => LOCAL.localData,
    hasFirebase: firebaseEnabled,
    // Acceso REST a Firestore para modulos con sesion (UbiAccount).
    firestore: {
      enabled: firebaseEnabled,
      config: () => firebaseConfig,
      list: listDocuments,
      get: getDocument,
      set: setDocument,
      delete: deleteDocument
    },
    get origin() {
      return catalogOrigin;
    },
    get lastVehicleOrigin() {
      return lastVehicleOrigin;
    },
    reset() {
      catalogPromise = null;
      metadataPromise = null;
      osmStopsPromise = null;
      simulationPaths = null;
      firestoreDown = false;
      vehiclesFirestoreDown = false;
      catalogOrigin = 'local';
      lastVehicleOrigin = 'simulation';
      warned.clear();
    }
  };
})();
