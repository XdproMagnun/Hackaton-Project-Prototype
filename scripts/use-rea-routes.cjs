#!/usr/bin/env node
'use strict';

// Sustituye el catalogo de la app (data/routes.json + data/transit.geojson) por
// las rutas importadas de REA (data/rea/). Antes de escribir nada, guarda una
// copia del catalogo anterior en data/legacy/ para poder volver atras.
//
// Por defecto solo publica las rutas de "Amor x Carmen" (Campus III, Costera y
// Laguna de Terminos) con sus tramos y paradas.
//
//   npm run use:rea                    # respalda lo viejo y deja las 3 de Amor x Carmen
//   npm run use:rea -- --all           # las 15 rutas de REA
//   npm run use:rea -- --only ac-campus3,ac-costera
//   npm run use:rea -- --restore       # devuelve data/legacy/ al lugar original
//
// No toca data/carmen.geojson, data/stops.geojson ni data/metadata.json: esos
// son el extracto del PBF y son independientes del catalogo de rutas.

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const reaDir = path.join(dataDir, 'rea');
const legacyDir = path.join(dataDir, 'legacy');
const targets = ['routes.json', 'transit.geojson'];

// Catalogo de la app: solo las rutas de Amor x Carmen del APK de REA.
const AMOR_X_CARMEN = ['ac-campus3', 'ac-costera', 'ac-laguna-terminos'];

function parseArgs(argv) {
  const args = {restore: argv.includes('--restore'), all: argv.includes('--all'), only: null, help: argv.includes('--help') || argv.includes('-h')};
  const index = argv.indexOf('--only');
  if (index !== -1 && argv[index + 1]) {
    args.only = argv[index + 1].split(',').map(id => id.trim()).filter(Boolean);
  }
  return args;
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, value, compact = false) {
  const text = JSON.stringify(value, null, compact ? 0 : 2);
  fs.writeFileSync(file, `${text}\n`, 'utf8');
}

function backup() {
  fs.mkdirSync(legacyDir, {recursive: true});
  const saved = [];
  for (const name of targets) {
    const source = path.join(dataDir, name);
    const destination = path.join(legacyDir, name);
    // Si ya hay respaldo no se pisa: evita perder el original al repetir el cambio.
    if (fs.existsSync(destination)) continue;
    if (!fs.existsSync(source)) continue;
    fs.copyFileSync(source, destination);
    saved.push(name);
  }
  return saved;
}

function restore() {
  const restored = [];
  for (const name of targets) {
    const source = path.join(legacyDir, name);
    if (!fs.existsSync(source)) continue;
    fs.copyFileSync(source, path.join(dataDir, name));
    restored.push(name);
  }
  if (!restored.length) throw new Error('No hay respaldo en data/legacy/ para restaurar.');
  return restored;
}

function build(selectedIds) {
  const catalog = readJSON(path.join(reaDir, 'routes.json'));
  const lines = readJSON(path.join(reaDir, 'routes.geojson'));
  const stops = readJSON(path.join(reaDir, 'stops.geojson'));

  if (!Array.isArray(catalog.routes) || !catalog.routes.length) {
    throw new Error('data/rea/routes.json no tiene rutas. Ejecuta npm run import:rea.');
  }
  if (lines.type !== 'FeatureCollection' || stops.type !== 'FeatureCollection') {
    throw new Error('data/rea/*.geojson no son FeatureCollection. Ejecuta npm run import:rea.');
  }

  const known = new Set(catalog.routes.map(route => route.id));
  for (const feature of [...lines.features, ...stops.features]) {
    const routeId = feature.properties?.routeId;
    if (!known.has(routeId)) throw new Error(`Elemento de data/rea apunta a una ruta inexistente: ${routeId}`);
  }
  for (const id of selectedIds) {
    if (!known.has(id)) throw new Error(`--only pide una ruta que no esta en data/rea: ${id}`);
  }

  const included = new Set(selectedIds);
  const routes = catalog.routes
    .filter(route => included.has(route.id))
    .map(route => {
      const segments = lines.features.filter(feature => feature.properties.routeId === route.id);
      const routeStops = stops.features.filter(feature => feature.properties.routeId === route.id);
      if (!segments.length) throw new Error(`La ruta ${route.id} no tiene trazado en data/rea/routes.geojson`);
      if (!routeStops.length) console.warn(`Aviso: ${route.id} no tiene paradas georreferenciadas en data/rea/`);
      return {...route, stopCount: routeStops.length, segmentCount: segments.length};
    });

  const features = [...lines.features, ...stops.features]
    .filter(feature => included.has(feature.properties.routeId));

  return {
    routes: {
      updated: catalog.updated,
      source: catalog.source,
      routes,
      method: {
        import: 'npm run import:rea',
        swap: routes.length === catalog.routes.length ? 'npm run use:rea -- --all' : `npm run use:rea -- --only ${selectedIds.join(',')}`,
        restore: 'npm run use:rea -- --restore',
        note: 'Catalogo sustituido por rutas de REA (Go Carmen). El catalogo anterior quedo en data/legacy/.',
        source: catalog.method
      }
    },
    transit: {type: 'FeatureCollection', features}
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Uso: node scripts/use-rea-routes.cjs [--all | --only id1,id2] [--restore]');
    console.log(`Sin opciones deja solo Amor x Carmen: ${AMOR_X_CARMEN.join(', ')}`);
    return;
  }

  if (args.restore) {
    const restored = restore();
    console.log(`Restaurado: ${restored.join(', ')} (desde data/legacy/)`);
    return;
  }

  const selectedIds = args.only || (args.all ? readJSON(path.join(reaDir, 'routes.json')).routes.map(route => route.id) : AMOR_X_CARMEN);
  const saved = backup();
  const {routes, transit} = build(selectedIds);
  writeJSON(path.join(dataDir, 'routes.json'), routes);
  writeJSON(path.join(dataDir, 'transit.geojson'), transit, true);

  const stopFeatures = transit.features.filter(feature => feature.properties.kind === 'stop').length;
  const lineFeatures = transit.features.filter(feature => feature.properties.kind === 'route').length;
  if (saved.length) console.log(`Respaldo del catalogo anterior: data/legacy/ (${saved.join(', ')})`);
  console.log(`${routes.routes.length} rutas · ${lineFeatures} tramos · ${stopFeatures} paradas escritos en data/`);
  for (const route of routes.routes) {
    console.log(`  ${route.id}  ${String(route.stopCount).padStart(3)} paradas  ${String(route.segmentCount).padStart(2)} tramos  ${route.name}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
