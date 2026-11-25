const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const webRoot = path.join(__dirname, '..', 'www');
const files = [
  'index.html', 'styles.css', 'theme.css', 'icons.css', 'icons.js',
  'config.js', 'app.js', 'preferences.js', 'transit.js', 'firebase-auth.js', 'firebase-config.js', 'location.bundle.js',
  'data/carmen.geojson', 'data/stops.geojson', 'data/metadata.json',
  'data/transit.geojson', 'data/routes.json',
  'assets/icons', 'assets/campus-3-paradas.png', 'assets/campus-3-recorrido.png',
  'assets/costera-paradas.png', 'assets/costera-recorrido.png'
];

fs.rmSync(webRoot, {recursive: true, force: true});
fs.mkdirSync(webRoot, {recursive: true});
for (const file of files) {
  const source = path.join(projectRoot, file);
  const destination = path.join(webRoot, file);
  if (!fs.existsSync(source)) throw new Error(`No se encontró el recurso web: ${file}`);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.cpSync(source, destination, {recursive: true});
}
console.log(`Recursos compartidos copiados a ${webRoot}.`);
