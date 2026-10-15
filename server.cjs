const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = new Set(['index.html', 'styles.css', 'config.js', 'app.js', 'data/carmen.geojson', 'data/stops.geojson', 'data/metadata.json']);
['transit.js','data/transit.geojson','data/routes.json','assets/campus-3-paradas.png','assets/campus-3-recorrido.png'].forEach(file => files.add(file));
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.geojson': 'application/geo+json; charset=utf-8', '.json': 'application/json; charset=utf-8'};
types['.png'] = 'image/png';
http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!files.has(name)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(__dirname, name), (error, data) => {
    if (error) { res.writeHead(500); return res.end('Unable to read file'); }
    res.writeHead(200, {'Content-Type': types[path.extname(name)]}); res.end(data);
  });
}).listen(5173, '127.0.0.1', () => console.log('Local: http://localhost:5173'));
