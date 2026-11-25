#!/usr/bin/env node
'use strict';

// Verificacion minima y sin dependencias para el trabajo con varios modelos de IA.
// Revisa sintaxis de todo el JavaScript, valida los JSON y la coherencia del catalogo.
//
//   npm run check
//
// No sustituye a los tests de la fase de refactor; es la red de seguridad de hoy.

const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const ignored = new Set(['node_modules', '.git', '.freebuff']);
const problems = [];
const checked = {scripts: 0, json: 0};

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    if (ignored.has(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const files = walk(root);
const jsFiles = files.filter(file => /\.(js|cjs)$/.test(file));
const jsonFiles = files.filter(file => file.endsWith('.json'));

for (const file of jsFiles) {
  const relative = path.relative(root, file);
  try {
    execFileSync(process.execPath, ['--check', file], {stdio: 'pipe'});
    checked.scripts++;
  } catch (error) {
    problems.push(`Sintaxis: ${relative}\n${String(error.stderr || error.message).trim()}`);
  }
}

const parsed = new Map();
for (const file of jsonFiles) {
  const relative = path.relative(root, file);
  try {
    parsed.set(relative, JSON.parse(fs.readFileSync(file, 'utf8')));
    checked.json++;
  } catch (error) {
    problems.push(`JSON invalido: ${relative} (${error.message})`);
  }
}

function parseFile(relative) {
  if (parsed.has(relative)) return parsed.get(relative);
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  } catch {
    return null;
  }
}

const catalog = parseFile('data/routes.json');
const transit = parseFile('data/transit.geojson');
const metadata = parseFile('data/metadata.json');
const carmen = parseFile('data/carmen.geojson');

if (!catalog || !Array.isArray(catalog.routes)) {
  problems.push('data/routes.json no tiene un arreglo routes');
} else if (transit && Array.isArray(transit.features)) {
  const features = transit.features;
  const ids = new Set();
  for (const feature of features) {
    if (feature.id && ids.has(feature.id)) problems.push(`id repetido en transit.geojson: ${feature.id}`);
    if (feature.id) ids.add(feature.id);
    const properties = feature.properties || {};
    if (!catalog.routes.some(route => route.id === properties.routeId)) {
      problems.push(`routeId desconocido en transit.geojson: ${properties.routeId}`);
    }
  }
  for (const route of catalog.routes) {
    const stops = features.filter(feature => feature.properties.routeId === route.id && feature.properties.kind === 'stop').length;
    if (stops !== route.stopCount) {
      problems.push(`stopCount de ${route.id} es ${route.stopCount} pero hay ${stops} paradas`);
    }
    const segments = features.filter(feature => feature.properties.routeId === route.id && feature.properties.kind === 'route').length;
    if (!segments) {
      problems.push(`La ruta ${route.id} no tiene tramos en transit.geojson`);
    } else if (Number.isInteger(route.segmentCount) && segments !== route.segmentCount) {
      problems.push(`segmentCount de ${route.id} es ${route.segmentCount} pero hay ${segments} tramos`);
    }
  }
}

if (metadata && carmen && Array.isArray(carmen.features) && metadata.features !== carmen.features.length) {
  problems.push(`metadata.features (${metadata.features}) no coincide con carmen.geojson (${carmen.features.length})`);
}

// La app solo puede leer datos a traves de window.UbiData (data-layer.js).
for (const moduleFile of ['data-layer.js', 'account.js']) {
  if (!fs.existsSync(path.join(root, moduleFile))) problems.push(`Falta ${moduleFile}`);
}
for (const file of ['app.js', 'transit.js', 'preferences.js', 'account.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  // La sesion y los datos de usuario viven en UbiAccount; nadie mas escribe la sesion.
  if (file !== 'account.js' && source.includes('ubicarmen-session')) {
    problems.push(`${file} manipula la sesion directamente; usa window.UbiAccount`);
  }
}
for (const file of ['app.js', 'transit.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const direct of ['data/routes.json', 'data/transit.geojson', 'data/metadata.json', 'data/stops.geojson']) {
    if (source.includes(direct)) problems.push(`${file} lee ${direct} directamente; usa window.UbiData (data-layer.js)`);
  }
}

const rules = path.join(root, 'firebase/firestore.rules');
if (!fs.existsSync(rules)) problems.push('Falta firebase/firestore.rules');

console.log(`Sintaxis JS: ${checked.scripts} archivos · JSON: ${checked.json} archivos`);
if (problems.length) {
  console.error(`\n${problems.length} problema(s):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log('Todo correcto.');
