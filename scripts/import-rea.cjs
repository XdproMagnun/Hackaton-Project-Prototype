#!/usr/bin/env node
'use strict';

// Importa las lineas de ruta del proyecto REA (APK "Go Carmen") al formato de
// Ubicarmen. Lee `assets/routes.geojson` del APK y escribe:
//
//   data/rea/routes.json       catalogo (misma forma que data/routes.json)
//   data/rea/routes.geojson    trazados: un Feature LineString por tramo
//   data/rea/stops.geojson     paradas: Feature Point por parada
//
// Solo lee el APK; no modifica data/routes.json ni data/transit.geojson.
//
//   npm run import:rea
//   node scripts/import-rea.cjs --apk "hacer REA/Go Carmen.apk" --out data/rea
//   node scripts/import-rea.cjs --from ruta/al/routes.geojson

const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const SOURCE_ID = 'rea-go-carmen';
const SOURCE_TITLE = 'REA · Go Carmen (APK) · assets/routes.geojson';

function parseArgs(argv) {
  const args = {apk: path.join(root, 'hacer REA', 'Go Carmen.apk'), out: path.join(root, 'data', 'rea'), from: ''};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === '--apk' && value) { args.apk = path.resolve(value); index++; }
    else if (key === '--out' && value) { args.out = path.resolve(value); index++; }
    else if (key === '--from' && value) { args.from = path.resolve(value); index++; }
    else if (key === '--help' || key === '-h') { args.help = true; }
  }
  return args;
}

function readFromApk(apkPath) {
  return execFileSync('unzip', ['-p', apkPath, 'assets/routes.geojson'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
}

function readSource(args) {
  if (args.from) return fs.readFileSync(args.from, 'utf8');
  if (!fs.existsSync(args.apk)) {
    throw new Error(`No encuentro el APK: ${args.apk}`);
  }
  try {
    return readFromApk(args.apk);
  } catch (error) {
    const extracted = path.join(root, 'hacer REA', 'extraido', 'assets', 'routes.geojson');
    if (fs.existsSync(extracted)) return fs.readFileSync(extracted, 'utf8');
    throw new Error(`No pude leer assets/routes.geojson del APK (${error.message}). Usa --from.`);
  }
}

const ROMAN = new Set(['II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'X']);
const ACRONYMS = new Set(['UNACAR', 'PEMEX', 'SMAPAC']);
const CONNECTORS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'x']);

// "AMOR X CARMEN | CAMPUS III" -> "Amor X Carmen | Campus III".
function prettyName(text) {
  return String(text || '')
    .split('|')
    .map(chunk => chunk
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((word, index) => {
        const upper = word.toUpperCase();
        if (index > 0 && CONNECTORS.has(word)) return word;
        if (word.length === 1 || ROMAN.has(upper) || ACRONYMS.has(upper)) return upper;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' '))
    .join(' | ');
}

function roundCoordinates(coordinates) {
  return coordinates
    .map(point => [Number(point[0]), Number(point[1])])
    .filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map(point => [Number(point[0].toFixed(6)), Number(point[1].toFixed(6))]);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Uso: node scripts/import-rea.cjs [--apk RUTA] [--out CARPETA] [--from GEOJSON]');
    return;
  }

  const collection = JSON.parse(readSource(args));
  if (!collection || collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    throw new Error('El origen no es una FeatureCollection valida.');
  }

  const routeFeatures = collection.features.filter(feature => feature.properties?.kind === 'route');
  const stopFeatures = collection.features.filter(feature => feature.properties?.kind === 'stop');
  if (!routeFeatures.length) throw new Error('El origen no tiene rutas (kind:"route").');

  const routes = [];
  const lines = [];
  const stops = [];

  for (const feature of routeFeatures) {
    const properties = feature.properties;
    const routeId = properties.id;
    if (!routeId) throw new Error('Ruta sin id.');

    const parts = feature.geometry?.type === 'MultiLineString'
      ? feature.geometry.coordinates
      : feature.geometry?.type === 'LineString'
        ? [feature.geometry.coordinates]
        : [];

    const routeStops = stopFeatures
      .filter(stop => stop.properties.routeId === routeId)
      .sort((a, b) => (Number(a.properties.orden) || 0) - (Number(b.properties.orden) || 0));

    let pointCount = 0;
    parts.forEach((part, index) => {
      const coordinates = roundCoordinates(part);
      if (coordinates.length < 2) return;
      pointCount += coordinates.length;
      lines.push({
        type: 'Feature',
        id: `${routeId}-line-${index + 1}`,
        properties: {
          routeId,
          kind: 'route',
          number: index + 1,
          name: prettyName(properties.nombre) || properties.nombreLista,
          color: properties.color || '',
          type: properties.tipo || '',
          accuracy: 'imported',
          source: SOURCE_ID
        },
        geometry: {type: 'LineString', coordinates}
      });
    });

    routeStops.forEach((stop, index) => {
      const [lng, lat] = roundCoordinates([stop.geometry?.coordinates || []])[0] || [];
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      stops.push({
        type: 'Feature',
        id: `${routeId}-stop-${Number(stop.properties.orden) || index + 1}`,
        properties: {
          routeId,
          kind: 'stop',
          number: Number(stop.properties.orden) || index + 1,
          name: stop.properties.nombre || 'Parada de referencia',
          accuracy: 'imported',
          source: SOURCE_ID
        },
        geometry: {type: 'Point', coordinates: [lng, lat]}
      });
    });

    routes.push({
      id: routeId,
      name: prettyName(properties.nombre) || properties.nombreLista,
      nameList: properties.nombreLista || prettyName(properties.nombre),
      color: properties.color || '',
      type: properties.tipo || '',
      status: 'reference',
      active: properties.activo !== false,
      stopCount: stops.filter(stop => stop.properties.routeId === routeId).length,
      description: properties.descripcion || '',
      note: 'Trazado importado del APK de REA; no representa un servicio en tiempo real.',
      streets: [],
      sources: [{id: SOURCE_ID, title: SOURCE_TITLE, url: 'hacer REA/Go Carmen.apk'}],
      camera: Array.isArray(properties.camara) ? properties.camara : undefined,
      pointCount
    });
  }

  const routesCatalog = {
    updated: new Date().toISOString().slice(0, 10),
    source: {id: SOURCE_ID, title: SOURCE_TITLE},
    method: 'Importacion automatica de assets/routes.geojson (scripts/import-rea.cjs).',
    routes
  };

  fs.mkdirSync(args.out, {recursive: true});
  const write = (name, value) => {
    const file = path.join(args.out, name);
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    return file;
  };

  write('routes.json', routesCatalog);
  write('routes.geojson', {type: 'FeatureCollection', features: lines});
  write('stops.geojson', {type: 'FeatureCollection', features: stops});

  const padding = Math.max(...routes.map(route => route.id.length));
  console.log(`${routes.length} rutas · ${lines.length} tramos · ${stops.length} paradas`);
  for (const route of routes) {
    console.log(`${route.id.padEnd(padding)}  ${String(route.stopCount).padStart(3)} paradas  ${route.pointCount} puntos  ${route.name} (${route.type})`);
  }
  console.log(`\nEscrito en ${path.relative(root, args.out) || '.'}`);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
