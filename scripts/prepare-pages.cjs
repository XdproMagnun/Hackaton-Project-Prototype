'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.pages');
const files = [
  'index.html',
  'account.js',
  'app.js',
  'config.js',
  'data-layer.js',
  'firebase-auth.js',
  'firebase-config.js',
  'icons.css',
  'icons.js',
  'location.bundle.js',
  'preferences.js',
  'styles.css',
  'theme.css',
  'transit.js'
];
const directories = ['assets', 'data', 'vendor'];

fs.rmSync(output, {recursive: true, force: true});
fs.mkdirSync(output, {recursive: true});

for (const file of files) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) throw new Error(`Falta el archivo requerido para Pages: ${file}`);
  fs.copyFileSync(source, path.join(output, file));
}

for (const directory of directories) {
  const source = path.join(root, directory);
  if (!fs.existsSync(source)) throw new Error(`Falta la carpeta requerida para Pages: ${directory}`);
  fs.cpSync(source, path.join(output, directory), {recursive: true});
}

console.log(`Sitio estático listo en ${path.relative(root, output)}.`);
