// Digitalización visual aproximada de la Línea 2 del My Maps compartido.
// El viewer muestra una línea continua sin vértices ni marcadores de paradas
// accesibles; se trazó sobre la vista centrada en 18.638468, -91.820652 (z14).
module.exports = function lagunaTerminos() {
  const coordinates = [
    [-91.838290,18.639281],[-91.837689,18.637411],[-91.836745,18.635703],[-91.835028,18.634076],
    [-91.832969,18.632775],[-91.830651,18.631636],[-91.828334,18.630823],[-91.826274,18.630579],
    [-91.825072,18.631148],[-91.824557,18.632531],[-91.823356,18.633588],[-91.821725,18.634320],
    [-91.820180,18.635052],[-91.818635,18.635947],[-91.817004,18.636923],[-91.815459,18.637980],
    [-91.813828,18.638875],[-91.812112,18.639200],[-91.810481,18.638956],[-91.808850,18.638143],
    [-91.807391,18.637004],[-91.806104,18.636109],[-91.804988,18.636272],[-91.804559,18.637167],
    [-91.804730,18.638468],[-91.805245,18.639688],[-91.806361,18.641233],[-91.807820,18.642290],
    [-91.809451,18.643185],[-91.811168,18.643998],[-91.812884,18.644649],[-91.814515,18.644893],
    [-91.815974,18.644486],[-91.817433,18.643348],[-91.818978,18.642128],[-91.820695,18.640827],
    [-91.822240,18.639363],[-91.823785,18.637817],[-91.825415,18.636272],[-91.826875,18.634727],
    [-91.827990,18.633181]
  ];
  return {
    feature: {type:'Feature', id:'laguna-terminos-route-1', properties:{routeId:'laguna-terminos',kind:'route',name:'Línea 2 · recorrido de referencia',accuracy:'approximate',source:'google-mymaps-user',note:'Trazado aproximado digitalizado visualmente de la vista del My Maps. El viewer no expone coordenadas de vértices ni paradas.'}, geometry:{type:'LineString',coordinates}},
    route: {id:'laguna-terminos',name:'Laguna de Términos',color:'#da8b20',status:'reference',stopCount:0,description:'Recorrido Línea 2 · Laguna de Términos',note:'Recorrido aproximado digitalizado visualmente de la Línea 2 del Google My Maps compartido. El mapa no muestra paradas ni expone coordenadas exactas de la línea; no usar para navegación giro a giro.',streets:['Recorrido de referencia · Línea 2'],sources:[{id:'google-mymaps-laguna',title:'Google My Maps · ruta Laguna de Términos',url:'https://www.google.com/maps/d/u/0/viewer?mid=1S7tfEO4a6EizA1P0045_WfPYP7HCeYQ'}]}
  };
};
