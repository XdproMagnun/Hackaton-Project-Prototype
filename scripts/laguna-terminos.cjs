const fs=require('node:fs');
const path=require('node:path');
// Fuente conservada sin ajustar ni sustituir conexiones por rutas más cortas.
module.exports=function lagunaTerminos(){
 const source=fs.readFileSync(path.join(__dirname,'../data/laguna-source.kml'),'utf8');
 const lines=[...source.matchAll(/<LineString\b[^>]*>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/g)];
 if(lines.length!==1)throw new Error('La fuente de Laguna debe contener una línea');
 const coordinates=lines[0][1].trim().split(/\s+/).map(row=>row.split(',').slice(0,2).map(Number));
 if(coordinates.length<2||coordinates.some(p=>p.length!==2||!p.every(Number.isFinite)))throw new Error('Coordenadas KML inválidas');
 const previous={"id":"laguna-terminos","name":"Laguna de Términos","color":"#da8b20","status":"reference","stopCount":0,"streets":["Malecón del Centro","Calle 25","Calle 24","Calle 28 × 17","Av. 10 de Julio","Calle 40","Calle Independencia","Calle Constitución","Vicente Guerrero","Balneario de la Manigua","Av. 16 de Septiembre","Calle Satélite","Francisco Javier Mina","Calle 17-D","Calle 19","Calle 42","Calle 31","Calle 22"]};
 return {feature:{type:'Feature',id:'laguna-terminos-route-1',properties:{routeId:'laguna-terminos',kind:'route',name:'Línea 2 · My Maps',accuracy:'source-coordinate',source:'google-mymaps-laguna'},geometry:{type:'LineString',coordinates}},route:{...previous,description:'Recorrido original del My Maps compartido',note:'Línea importada directamente del KML compartido, conservando sus conexiones y su orden. Es un trazado de referencia, no un registro GPS de los camiones.',sources:[{id:'google-mymaps-laguna',title:'Google My Maps · trazado original de Laguna de Términos',url:'https://www.google.com/maps/d/u/0/viewer?mid=1S7tfEO4a6EizA1P0045_WfPYP7HCeYQ'}]}};
};
