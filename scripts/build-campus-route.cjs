// Reconstrucción de referencia a partir de las dos imágenes aportadas por el usuario.
// No es un itinerario de navegación ni una lista oficial georreferenciada de paradas.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const osm = JSON.parse(fs.readFileSync(path.join(root, 'data/carmen.geojson')));
const features = [];
function way(id, from, to) {
  const original = osm.features.find(f => f.id === `way/${id}`);
  if (!original || original.geometry.type !== 'LineString') throw new Error(`Falta la vía ${id}`);
  let coordinates = original.geometry.coordinates;
  const nearest = point => coordinates.reduce((best, c, i) => Math.hypot(c[0]-point[0], c[1]-point[1]) < Math.hypot(coordinates[best][0]-point[0], coordinates[best][1]-point[1]) ? i : best, 0);
  if (from && to) {
    const a = nearest(from), b = nearest(to);
    coordinates = coordinates.slice(Math.min(a,b), Math.max(a,b)+1);
    if (a > b) coordinates.reverse();
  }
  if (coordinates.length < 2) throw new Error(`Tramo vacío ${id}`);
  features.push({type:'Feature', properties:{routeId:'campus-3', kind:'route', name:original.properties.name || 'Tramo de referencia', osmWay:original.id, accuracy:'approximate', source:'poster-user'}, geometry:{type:'LineString',coordinates}});
}
// Corredores del cartel, apoyados en las geometrías del PBF. No se deducen sentidos.
way(113835841); // Concordia
way(957350315,[-91.8214719,18.6480568],[-91.819201,18.6458912]);
way(957350317);
way(113835923,[-91.8182026,18.645215],[-91.8116796,18.6479068]);
way(113835870,[-91.8116796,18.6479068],[-91.817444,18.6585426]);
[166727910,166727918,957689241,113835922,514551230,694604221,958304372,958306024,224503134,905386038,514899834].forEach(id=>way(id));
way(114002666); // Rama del malecón de la Caleta visible en el cartel
[694604232,903729857,906297116,113843571,114016412,1296183973,1296183976].forEach(id=>way(id));
way(694618897,[-91.8101812,18.6547792],[-91.8073094,18.6515734]);
way(956653131,[-91.7957713,18.6499873],[-91.7929237,18.6468424]);
[955412756,114002724].forEach(id=>way(id));
way(114002620,[-91.7957713,18.6499873],[-91.7886167,18.6544385]);
[113835877,957166826,949849916].forEach(id=>way(id));
// Conexión sur interpretada del cartel; geometría orientativa, no ajustada a una vía OSM.
features.push({type:'Feature',properties:{routeId:'campus-3',kind:'route',name:'Conexión Abasolo · aproximada',accuracy:'approximate',source:'poster-user'},geometry:{type:'LineString',coordinates:[[-91.7827341,18.6374411],[-91.78045,18.63696],[-91.77858,18.63718],[-91.7760823,18.6381112]]}});
way(957176769,[-91.7760823,18.6381112],[-91.7795987,18.6461497]);
[694604224,114002613,955813193].forEach(id=>way(id));

// Puntos rojos etiquetados como Amor X Carmen en la captura de 1305 × 504.
// Calibración aproximada con Chedraui (436,362) y Bodega Aurrera (975,175),
// usando sus ubicaciones en el PBF. Los iconos comerciales NO son paradas.
const pixels = [[447,295],[460,276],[538,302],[567,275],[607,241],[628,234],[596,187],[567,154],[690,100],[813,210],[1021,308],[1097,261]];
const anchors = {chedraui:{pixel:[436,362],coordinate:[-91.82146474,18.64246032]},aurrera:{pixel:[975,175],coordinate:[-91.7822696,18.6553726]}};
pixels.forEach(([x,y],index)=>{
  const lon = anchors.chedraui.coordinate[0]+(x-436)*(anchors.aurrera.coordinate[0]-anchors.chedraui.coordinate[0])/(975-436);
  const lat = anchors.chedraui.coordinate[1]+(y-362)*(anchors.aurrera.coordinate[1]-anchors.chedraui.coordinate[1])/(175-362);
  features.push({type:'Feature',id:`campus-3-stop-${index+1}`,properties:{routeId:'campus-3',kind:'stop',number:index+1,name:`Parada de referencia ${String(index+1).padStart(2,'0')}`,accuracy:'approximate',source:'screenshot-user',referencePixel:[x,y],note:'Posición estimada desde la captura. Nombre oficial, sentido y ubicación exacta por confirmar.'},geometry:{type:'Point',coordinates:[Number(lon.toFixed(6)),Number(lat.toFixed(6))]}});
});
const catalog = {
  updated:'2026-10-15',
  routes:[
    {id:'campus-3',name:'Campus III',color:'#8b23c9',status:'reference',stopCount:12,description:'Campus I (principal) · Campus III',note:'Recorrido y posiciones aproximados, reconstruidos desde las imágenes compartidas. No representan un servicio en tiempo real. La numeración identifica marcadores; no indica orden de paso. La captura no es un inventario completo de paradas.',streets:['Calle 31','Periférica Norte','Av. Concordia','Av. Corregidora','Calle 37','Boquerón del Palmar','Carretera Carmen–Puerto Real','Calle Escárcega','Av. Puerto de Campeche','Av. Abasolo','Av. Contadores','Av. Central','Campus III'],sources:[{id:'poster-user',title:'Cartel Ruta Campus III · compartido por el usuario',url:'assets/campus-3-recorrido.png'},{id:'screenshot-user',title:'Captura de paradas · compartida por el usuario',url:'assets/campus-3-paradas.png'}]},
    {id:'costera',name:'Costera',color:'#159ca0',status:'pending',stopCount:0,description:'Pendiente de recorrido y paradas'},
    {id:'laguna-terminos',name:'Laguna de Términos',color:'#da8b20',status:'pending',stopCount:0,description:'Pendiente de recorrido y paradas'}
  ],
  method:{stopCalibration:anchors,route:'Tramos OSM seleccionados según el cartel, más una conexión aproximada en Abasolo. Sin cálculo de sentidos ni horarios.'}
};
const costera = require('./costera.cjs')();
features.push(...costera.features);
catalog.routes[catalog.routes.findIndex(route=>route.id==='costera')] = costera.route;
catalog.method.costera = {stopCalibration:costera.anchors,route:'Tramos del cartel encadenados sobre la red vial del PBF, del circuito del centro a Av. Constelación Pléyades. Sin sentidos de circulación confirmados.'};
const laguna = require('./laguna-terminos.cjs')();
features.push(laguna.feature);
catalog.routes[catalog.routes.findIndex(route=>route.id==='laguna-terminos')] = laguna.route;
catalog.method.lagunaTerminos = {route:'Recorrido del cartel unido sobre la red vial del PBF; los puntos de paso se aproximaron visualmente y se encadenaron para eliminar cortes.'};
fs.writeFileSync(path.join(root,'data/transit.geojson'),JSON.stringify({type:'FeatureCollection',features}));
fs.writeFileSync(path.join(root,'data/routes.json'),JSON.stringify(catalog,null,2));
console.log(`${features.filter(f=>f.properties.kind==='route').length} tramos de referencia y ${features.filter(f=>f.properties.kind==='stop').length} paradas aproximadas.`);
