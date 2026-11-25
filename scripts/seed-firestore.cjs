#!/usr/bin/env node
'use strict';

// Carga el catalogo actual (data/routes.json + data/transit.geojson) en Firestore.
// Pensado para el emulador local: usa el token "owner" del emulador, sin credenciales.
//
//   npm run emulators           # en otra terminal
//   npm run seed                # escribe en 127.0.0.1:8080
//   npm run seed -- --dry-run   # solo cuenta documentos
//
// Proyecto real (credenciales fuera del repo, nunca en git ni en el chat):
//   node scripts/seed-firestore.cjs --project ubicarmen \
//     --host https://firestore.googleapis.com \
//     --token "$(gcloud auth print-access-token)"
// Con un token de OAuth de administrador, Firestore ignora las reglas de cliente.

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const withEquals = argv.find(arg => arg.startsWith(`${name}=`));
  if (withEquals) return withEquals.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index !== -1 && argv[index + 1] ? argv[index + 1] : fallback;
};

const projectId = flag('--project', 'demo-ubicarmen');
const host = flag('--host', 'http://127.0.0.1:8080').replace(/\/$/, '');
const dryRun = argv.includes('--dry-run');
const accessToken = flag('--token', process.env.FIRESTORE_ACCESS_TOKEN || '');
const authorization = accessToken ? `Bearer ${accessToken}` : 'Bearer owner';

function readJSON(relativePath) {
  const absolute = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function encode(value) {
  if (value === null || value === undefined) return {nullValue: null};
  if (Array.isArray(value)) return {arrayValue: {values: value.map(encode)}};
  if (typeof value === 'string') return {stringValue: value};
  if (typeof value === 'boolean') return {booleanValue: value};
  if (typeof value === 'number') {
    return Number.isInteger(value) ? {integerValue: String(value)} : {doubleValue: value};
  }
  if (typeof value === 'object') {
    return {mapValue: {fields: encodeFields(value)}};
  }
  throw new TypeError(`Tipo no soportado: ${typeof value}`);
}

function encodeFields(object) {
  return Object.fromEntries(
    Object.entries(object)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encode(value)])
  );
}

function documentURL(collection, id) {
  return `${host}/v1/projects/${projectId}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}?key=fake`;
}

async function writeDocument(collection, id, fields) {
  const body = JSON.stringify({fields: encodeFields(fields)});
  if (Buffer.byteLength(body) > 900_000) {
    throw new Error(`El documento ${collection}/${id} supera el limite de 1 MiB de Firestore`);
  }
  if (dryRun) return 'dry-run';
  const response = await fetch(documentURL(collection, id), {
    method: 'PATCH',
    headers: {Authorization: authorization, 'Content-Type': 'application/json'},
    body
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`PATCH ${collection}/${id} fallo (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response.status;
}

function buildDocuments() {
  const catalog = readJSON('data/routes.json');
  const transit = readJSON('data/transit.geojson');
  const features = transit.features || [];

  const routes = catalog.routes.map(route => ({
    collection: 'routes',
    id: route.id,
    fields: {
      name: route.name,
      color: route.color,
      status: route.status,
      stopCount: route.stopCount,
      description: route.description,
      note: route.note,
      streets: route.streets || [],
      sources: route.sources || [],
      updated: catalog.updated
    }
  }));

  const stops = features
    .filter(feature => feature.properties.kind === 'stop')
    .map(feature => {
      const [lng, lat] = feature.geometry.coordinates;
      const properties = feature.properties;
      return {
        collection: 'stops',
        id: `${properties.routeId}-${properties.number}`,
        fields: {
          routeId: properties.routeId,
          number: properties.number,
          name: properties.name,
          note: properties.note,
          accuracy: properties.accuracy,
          source: properties.source,
          lng,
          lat
        }
      };
    });

  const counters = new Map();
  const segments = features
    .filter(feature => feature.properties.kind === 'route')
    .map(feature => {
      const properties = feature.properties;
      const index = counters.get(properties.routeId) || 0;
      counters.set(properties.routeId, index + 1);
      return {
        collection: 'routeSegments',
        id: `${properties.routeId}-${String(index + 1).padStart(2, '0')}`,
        fields: {
          routeId: properties.routeId,
          index,
          name: properties.name,
          accuracy: properties.accuracy,
          source: properties.source,
          osmWay: properties.osmWay,
          // Firestore no admite arreglos anidados: el LineString se guarda como
          // lista de puntos {lng, lat}. La app lo rehidrata a [[lng, lat], ...].
          coordinates: feature.geometry.coordinates.map(([lng, lat]) => ({lng, lat}))
        }
      };
    });

  const version = {
    collection: 'meta',
    id: 'version',
    fields: {
      seededAt: new Date().toISOString(),
      source: 'data/routes.json + data/transit.geojson',
      projectId,
      routes: routes.length,
      stops: stops.length,
      segments: segments.length
    }
  };

  return [...routes, ...stops, ...segments, version];
}

async function main() {
  const documents = buildDocuments();
  const counts = documents.reduce((accumulator, document) => {
    accumulator[document.collection] = (accumulator[document.collection] || 0) + 1;
    return accumulator;
  }, {});

  console.log(`Proyecto: ${projectId} (${host})${dryRun ? ' · DRY RUN' : ''}`);
  console.log(`Documentos: ${JSON.stringify(counts)}`);

  if (dryRun) return;

  for (const document of documents) {
    await writeDocument(document.collection, document.id, document.fields);
  }

  if (/127\.0\.0\.1|localhost/.test(host)) {
    console.log('Catalogo cargado. Abre http://127.0.0.1:4000 para verlo en el emulador.');
    console.log('Siguiente paso: npm run test:rules');
  } else {
    console.log(`Catalogo cargado en ${projectId}. La app debe mostrar "Catalogo cargado desde Firestore" en consola.`);
  }
}

main().catch(error => {
  console.error(`\nNo se pudo cargar el catalogo: ${error.message}`);
  console.error('Comprueba que el emulador esta arriba: npm run emulators');
  process.exit(1);
});
