// Recorrido reconstruido del cartel de Ruta Laguna de Términos compartido
// por el usuario. La línea se enruta sobre la red vial del PBF para mantener
// sus tramos conectados; el cartel no aporta coordenadas GPS ni paradas.
module.exports = function lagunaTerminos() {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const osm = JSON.parse(fs.readFileSync(path.join(root, 'data/carmen.geojson')));
  const steps = [
    {name:'Paradero Mercado AFA',at:[-91.83857,18.64007]},
    {name:'Malecón del Centro',at:[-91.8363,18.6373],pattern:/^Malecon$/i},
    {name:'Calle 25',at:[-91.8298,18.6380],pattern:/^Calle 25$/i},
    {name:'Calle 24',at:[-91.8335,18.6360],pattern:/^Calle 24$/i},
    {name:'Monumento a la Bandera',at:[-91.8326,18.6365]},
    {name:'Calle 28 × 17',at:[-91.8320,18.6340],pattern:/^Calle 28$/i},
    {name:'Parque del Pescador',at:[-91.8305,18.6325]},
    {name:'Av. 10 de Julio',at:[-91.8272,18.6360]},
    {name:'Calle 40',at:[-91.8254,18.6390],pattern:/^Calle 40$/i},
    {name:'Calle Independencia',at:[-91.8215,18.6335],pattern:/^Calle Independencia$/i},
    {name:'Calle Constitución',at:[-91.8197,18.6322],pattern:/^Calle Constitución$/i},
    {name:'Vicente Guerrero',at:[-91.8190,18.6300],pattern:/^Calle Vicente Guerrero$/i},
    {name:'Balneario de la Manigua',at:[-91.8155,18.6308]},
    {name:'Av. 16 de Septiembre',at:[-91.8148,18.6340]},
    {name:'Calle Satélite',at:[-91.8120,18.6390],pattern:/^Calle Satélite$/i},
    {name:'Francisco Javier Mina',at:[-91.8098,18.6409],pattern:/^Calle Francisco Javier Mina$/i},
    {name:'Capilla San Judas Tadeo',at:[-91.8097,18.6402]},
    {name:'Calle 17-D',at:[-91.8095,18.6392],pattern:/^Prolongación 17-D$/i},
    {name:'Av. 10 de Julio',at:[-91.8065,18.6425]},
    {name:'Calle 19',at:[-91.8150,18.6445],pattern:/^Calle 19$/i},
    {name:'Calle 42',at:[-91.8270,18.6420],pattern:/^Calle 42$/i},
    {name:'Calle 31',at:[-91.8330,18.6390],pattern:/^Calle 31$/i},
    {name:'Calle 22',at:[-91.8383,18.6382],pattern:/^Calle 22$/i},
    {name:'Regreso al paradero Mercado AFA',at:[-91.83857,18.64007]}
  ];
  const sections = [{
    type:'Feature',properties:{name:'Paradero Mercado AFA'},
    geometry:{type:'LineString',coordinates:[steps[0].at,steps[0].at]}
  }, ...steps.slice(1).map((step, i) => ({
    type:'Feature',
    properties:{name:step.name},
    geometry:{type:'LineString',coordinates:[steps[i].at,step.at]}
  }))];
  const patterns = Object.fromEntries(steps.filter(step=>step.pattern).map(step=>[step.name,step.pattern]));
  require('./align-roads.cjs')(osm, sections, patterns);
  const coordinates = [];
  sections.forEach(section => coordinates.push(...(coordinates.length ? section.geometry.coordinates.slice(1) : section.geometry.coordinates)));
  if (coordinates.length < 2) throw new Error('No se pudo generar la ruta Laguna de Términos');
  const feature = {
    type:'Feature', id:'laguna-terminos-route-1',
    properties:{routeId:'laguna-terminos',kind:'route',name:'Circuito Laguna de Términos',accuracy:'approximate',source:'poster-user',alignment:'local-osm-roads'},
    geometry:{type:'LineString',coordinates}
  };
  return {
    feature,
    route:{
      id:'laguna-terminos',name:'Laguna de Términos',color:'#da8b20',status:'reference',stopCount:0,
      description:'Circuito desde Soriana Centro · ruta de calles del cartel',
      note:'Recorrido reconstruido siguiendo el cartel y unido sobre las calles del PBF. La línea queda continua; su ubicación es aproximada y el cartel no incluye coordenadas GPS ni marcadores de paradas.',
      streets:['Malecón del Centro','Calle 25','Calle 24','Calle 28 × 17','Av. 10 de Julio','Calle 40','Calle Independencia','Calle Constitución','Vicente Guerrero','Balneario de la Manigua','Av. 16 de Septiembre','Calle Satélite','Francisco Javier Mina','Calle 17-D','Calle 19','Calle 42','Calle 31','Calle 22'],
      sources:[{id:'laguna-poster-user',title:'Cartel Ruta Laguna de Términos · compartido por el usuario',url:'https://www.google.com/maps/d/u/0/viewer?mid=1S7tfEO4a6EizA1P0045_WfPYP7HCeYQ'}]
    }
  };
};
