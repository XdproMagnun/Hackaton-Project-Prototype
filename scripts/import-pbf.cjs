// Importación local para extractos pequeños. No envía el archivo a ningún servicio.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const parse = require('tiny-osmpbf');
const toGeoJSON = require('osmtogeojson');
const root = path.resolve(__dirname, '..');
const candidates = fs.readdirSync(root).filter(name => name.endsWith('.osm.pbf'));
if (!process.argv[2] && candidates.length !== 1) throw new Error('Indica el archivo: npm run import:pbf -- "archivo.osm.pbf"');
const input = path.resolve(root, process.argv[2] || candidates[0]);
if (fs.statSync(input).size > 50 * 1024 * 1024) throw new Error('Para extractos mayores de 50 MB usa un flujo de teselas vectoriales.');
const bytes = fs.readFileSync(input);
const osm = parse(bytes);
const data = toGeoJSON(osm, {flatProperties: true});
let incomplete = 0;
for (const feature of data.features) {
  if (feature.properties.tainted) incomplete++;
  // La interfaz necesita las etiquetas, no los datos personales del editor OSM.
  for (const key of ['user', 'uid', 'changeset', 'timestamp', 'version']) delete feature.properties[key];
}
const stops = data.features.filter(f => f.geometry.type === 'Point' && (f.properties.highway === 'bus_stop' || ['platform', 'stop_position'].includes(f.properties.public_transport)));
const bounds = osm.bounds ? [[osm.bounds.minlon, osm.bounds.minlat], [osm.bounds.maxlon, osm.bounds.maxlat]] : null;
const metadata = {file: path.basename(input), sha256: crypto.createHash('sha256').update(bytes).digest('hex'), sourceDate: osm.osm3s?.timestamp_osm_base, bounds, elements: osm.elements.length, features: data.features.length, incomplete, stops: stops.length};
fs.mkdirSync(path.join(root, 'data'), {recursive: true});
fs.writeFileSync(path.join(root, 'data', 'carmen.geojson'), JSON.stringify(data));
fs.writeFileSync(path.join(root, 'data', 'stops.geojson'), JSON.stringify({type: 'FeatureCollection', features: stops}));
fs.writeFileSync(path.join(root, 'data', 'metadata.json'), JSON.stringify(metadata, null, 2));
console.log(JSON.stringify(metadata, null, 2));
