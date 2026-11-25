const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = new Set(['index.html', 'styles.css', 'config.js', 'app.js', 'data/carmen.geojson', 'data/stops.geojson', 'data/metadata.json']);
['data-layer.js','account.js','transit.js','firebase-auth.js','firebase-config.js','location.bundle.js','data/transit.geojson','data/routes.json','assets/campus-3-paradas.png','assets/campus-3-recorrido.png'].forEach(file => files.add(file));
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.geojson': 'application/geo+json; charset=utf-8', '.json': 'application/json; charset=utf-8'};
types['.png'] = 'image/png';
types['.svg'] = 'image/svg+xml';
['icons.css','icons.js','theme.css','preferences.js'].forEach(file=>files.add(file));
fs.readdirSync(path.join(__dirname,'assets/icons')).filter(file=>file.endsWith('.svg')).forEach(file=>files.add('assets/icons/'+file));
['assets/costera-paradas.png','assets/costera-recorrido.png'].forEach(file=>files.add(file));
// Assets vendorizados (MapLibre y fuentes) para que la app no dependa de CDN.
types['.woff2'] = 'font/woff2';
['vendor/maplibre-gl/maplibre-gl.js','vendor/maplibre-gl/maplibre-gl.css','vendor/fonts/fonts.css'].forEach(file=>files.add(file));
fs.readdirSync(path.join(__dirname,'vendor/fonts')).filter(file=>file.endsWith('.woff2')).forEach(file=>files.add('vendor/fonts/'+file));
http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!files.has(name)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(__dirname, name), (error, data) => {
    if (error) { res.writeHead(500); return res.end('Unable to read file'); }
    res.writeHead(200, {'Content-Type': types[path.extname(name)]}); res.end(data);
  });
}).listen(5173, '127.0.0.1', () => console.log('Local: http://localhost:5173'));
