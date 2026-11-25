#!/usr/bin/env node
'use strict';

// Vendoriza las unicas dependencias externas que quedan en la app: MapLibre GL JS
// y las fuentes de Google (DM Sans y Manrope). Despues de esto, la pagina no pide
// nada a internet salvo las teselas del mapa base de OpenStreetMap.
//
//   node scripts/vendor-assets.cjs            # descarga version fijada
//   node scripts/vendor-assets.cjs --check    # solo comprueba que existen
//
// Los archivos se versionan en vendor/ para que `npm start` funcione sin red.

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const MAPLIBRE_VERSION = '5.6.0';
const FONT_FAMILIES = ['DM+Sans:wght@400;500;600;700', 'Manrope:wght@400;500;600;700;800'];
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const maplibreDir = path.join(root, 'vendor', 'maplibre-gl');
const fontsDir = path.join(root, 'vendor', 'fonts');

function ensureDirectory(directory) {
  fs.mkdirSync(directory, {recursive: true});
}

async function download(url, destination) {
  const response = await fetch(url, {headers: {'User-Agent': USER_AGENT}});
  if (!response.ok) throw new Error(`GET ${url} fallo (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  ensureDirectory(path.dirname(destination));
  fs.writeFileSync(destination, buffer);
  return buffer.length;
}

function fontFileName(family, weight, subset) {
  return `${family.toLowerCase().replace(/\s+/g, '-')}-${weight}-${subset}.woff2`;
}

async function vendorFonts() {
  const cssURL = `https://fonts.googleapis.com/css2?${FONT_FAMILIES.map(family => `family=${family}`).join('&')}&display=swap`;
  const response = await fetch(cssURL, {headers: {'User-Agent': USER_AGENT}});
  if (!response.ok) throw new Error(`GET ${cssURL} fallo (${response.status})`);
  const css = await response.text();

  // Google sirve una sola fuente variable por familia: varias reglas @font-face
  // (400, 500, 600, 700) comparten la misma URL. El archivo se descarga una vez y
  // todas las reglas apuntan al mismo nombre local.
  const fileByUrl = new Map();
  let currentFamily = '';
  let currentWeight = '';
  const blocks = css.split('@font-face').slice(1).map(block => `@font-face${block.split('}')[0]}}`);
  const localBlocks = [];

  for (const block of blocks) {
    const family = /font-family:\s*'([^']+)'/.exec(block);
    const weight = /font-weight:\s*(\d+)/.exec(block);
    const url = /url\((https:[^)]+)\)/.exec(block);
    const unicodeRange = /unicode-range:\s*([^;]+);/.exec(block);
    if (!family || !weight || !url) continue;
    currentFamily = family[1];
    currentWeight = weight[1];

    const range = unicodeRange ? unicodeRange[1].trim() : '';
    // Solo se conserva el subconjunto latin (U+0000-00FF) y latin-ext: son los
    // que usa el espanol y evitan bajar decenas de archivos.
    const subset = range.includes('U+0000-00FF') ? 'latin' : range.includes('U+0100') ? 'latin-ext' : null;
    if (!subset) continue;

    let fileName = fileByUrl.get(url[1]);
    if (!fileName) {
      fileName = fontFileName(currentFamily, currentWeight, subset);
      fileByUrl.set(url[1], fileName);
      const size = await download(url[1], path.join(fontsDir, fileName));
      console.log(`Fuente: vendor/fonts/${fileName} (${(size / 1024).toFixed(1)} KB)`);
    }

    localBlocks.push([
      '@font-face {',
      `  font-family: '${currentFamily}';`,
      '  font-style: normal;',
      `  font-weight: ${currentWeight};`,
      '  font-display: swap;',
      `  src: url('./${fileName}') format('woff2');`,
      range ? `  unicode-range: ${range};` : null,
      '}'
    ].filter(Boolean).join('\n'));
  }

  const header = '/* Generado por scripts/vendor-assets.cjs: fuentes locales, sin CDN. */\n';
  fs.writeFileSync(path.join(fontsDir, 'fonts.css'), header + localBlocks.join('\n') + '\n');
  return {faces: localBlocks.length, files: fileByUrl.size};
}

async function main() {
  const check = process.argv.includes('--check');
  const required = [
    path.join(maplibreDir, 'maplibre-gl.js'),
    path.join(maplibreDir, 'maplibre-gl.css'),
    path.join(fontsDir, 'fonts.css')
  ];

  if (check) {
    const missing = required.filter(file => !fs.existsSync(file));
    if (missing.length) {
      console.error(`Faltan archivos vendorizados:\n${missing.map(file => `- ${path.relative(root, file)}`).join('\n')}`);
      console.error('Ejecuta: node scripts/vendor-assets.cjs');
      process.exit(1);
    }
    console.log('Assets vendorizados presentes (MapLibre + fuentes).');
    return;
  }

  const jsSize = await download(
    `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`,
    path.join(maplibreDir, 'maplibre-gl.js')
  );
  const cssSize = await download(
    `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`,
    path.join(maplibreDir, 'maplibre-gl.css')
  );
  console.log(`MapLibre ${MAPLIBRE_VERSION}: ${(jsSize / 1024).toFixed(1)} KB JS, ${(cssSize / 1024).toFixed(1)} KB CSS`);

  const fonts = await vendorFonts();
  console.log(`Fuentes: ${fonts.files} archivos, ${fonts.faces} reglas @font-face en vendor/fonts/fonts.css`);
}

main().catch(error => {
  console.error(`No se pudieron vendorizar los assets: ${error.message}`);
  process.exit(1);
});
