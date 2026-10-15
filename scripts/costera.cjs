// Digitalización aproximada de la captura de 1365 × 582 aportada por el usuario.
// Se usa la punta de cada pin, no el centro del icono. No implica orden de paso.
module.exports = function costera() {
  const anchors = {
    chedraui: {pixel:[662,389],coordinate:[-91.82146474,18.64246032]},
    aurrera: {pixel:[1114,231],coordinate:[-91.7822696,18.6553726]}
  };
  const project = ([x,y]) => [
    Number((-91.82146474+(x-662)*(.03919514/452)).toFixed(6)),
    Number((18.64246032+(y-389)*(.01291228/-158)).toFixed(6))
  ];
  const pins = [[496,486],[480,462],[471,453],[482,437],[443,403],[457,397],[444,366],[427,376],[466,351],[461,337],[455,322],[444,287],[428,242],[423,224],[416,211],[423,165],[514,155],[539,153],[656,131],[755,126],[842,120],[894,116],[952,119],[978,147],[1026,180],[1068,166],[1065,139],[1053,117],[1027,100]];
  const features = pins.map((pixel,index)=>({type:'Feature',id:`costera-stop-${index+1}`,properties:{routeId:'costera',kind:'stop',number:index+1,name:`Parada de referencia ${String(index+1).padStart(2,'0')}`,accuracy:'approximate',source:'costera-screenshot-user',referencePixel:pixel,note:'Posición estimada desde la captura. Los marcadores superpuestos pueden reducir la precisión; nombre oficial, sentido y ubicación exacta por confirmar.'},geometry:{type:'Point',coordinates:project(pixel)}}));
  // Corredores interpretados del cartel sobre la captura. No son indicaciones giro a giro.
  // El orden sigue el cartel: arranca en el circuito del centro (Calle 20 · Malecón),
  // sube por Calle 22 · Calle 47 y Calle 26 hasta Playa Norte, sigue la costa hacia el
  // este (Malecón Costero · Paseo del Mar) y cierra en Av. Constelación Pléyades.
  const sections = [
    ['Circuito del centro · Calle 20 · Malecón',[[448,369],[427,376],[443,403],[471,453],[480,462],[496,486],[509,478],[500,457],[491,442],[482,437]]],
    ['Calle 22 · Calle 47',[[482,437],[469,413],[459,391],[448,369],[466,357]]],
    ['Calle 26 · Playa Norte',[[466,357],[454,322],[444,291],[433,257],[419,215],[412,192],[423,165],[448,158],[481,151],[514,155],[539,153]]],
    ['Malecón Costero · Paseo del Mar',[[539,153],[578,145],[608,141],[656,131],[704,127],[755,126],[797,121],[842,120],[894,116],[928,113],[952,119]]],
    ['Amado Nervo · Nardos · Constelación Pléyades',[[952,119],[978,147],[1001,165],[1026,180],[1068,166],[1065,139],[1053,117],[1043,97],[1027,100]]]
  ];
  // Calles que el cartel asocia a cada tramo; el ajuste ancla ahí los puntos de la captura.
  const streets = {
    'Circuito del centro · Calle 20 · Malecón':/^Calle 20$|^Calle 22$|^Calle 47$|^Calle 26$|^Malecon$|^Malecón$/,
    'Calle 22 · Calle 47':/^Calle 22$|^Calle 47$/,
    'Calle 26 · Playa Norte':/^Calle 26$|^Calle 26-A$|^Avenida Héroes del 21 de Abril$/,
    'Malecón Costero · Paseo del Mar':/^Malecón Costero$|^Avenida Paseo del Mar$|^Avenida del Mar$/,
    'Amado Nervo · Nardos · Constelación Pléyades':/^Calle Amado Nervo$|^Avenida Nardos$|^Calle Constelación Pléyades$/
  };
  sections.forEach(([name,pixels],i)=>features.push({type:'Feature',id:`costera-section-${i+1}`,properties:{routeId:'costera',kind:'route',name,accuracy:'approximate',source:'costera-poster-user'},geometry:{type:'LineString',coordinates:pixels.map(project)}}));
  const osm=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../data/carmen.geojson')));
  require('./align-roads.cjs')(osm,features.filter(f=>f.properties.kind==='route'),streets);
  return {features,anchors,route:{id:'costera',name:'Costera',color:'#087f83',status:'reference',stopCount:pins.length,description:'Calle 22 · Playa Norte · Malecón Costero',note:'Recorrido aproximado alineado a la red vial local y reconstruido desde el cartel. Las paradas estimadas de la captura se agrupan si sus pines se superponen. Los números son referencias internas, no equivalen a los nombres «Punto» de My Maps ni indican orden de paso. No se han confirmado sentidos, horarios ni la totalidad de las paradas.',streets:['Calle 22','Calle 47','Calle 26','Playa Norte','Malecón Costero','P. del Mar','Av. Amado Nervo','Av. Nardos','Av. Constelación'],sources:[{id:'costera-poster-user',title:'Cartel Ruta Costera · compartido por el usuario',url:'assets/costera-recorrido.png'},{id:'costera-screenshot-user',title:'Captura de paradas Costera · compartida por el usuario',url:'assets/costera-paradas.png'}]}};
};
