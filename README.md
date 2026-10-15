# Ubicarmen

Mapa web de Ciudad del Carmen con Búsqueda, Rutas, Paradas y Mapa general.

## Abrir

Ejecuta `npm start` y visita http://localhost:5173, o usa Live Server de VS Code. La carga de GeoJSON requiere HTTP; no abras el HTML con file://.

## PBF integrado

El archivo planet_-91.853,18.618_-91.757,18.682.osm.pbf se convirtió localmente a data/carmen.geojson, data/stops.geojson y data/metadata.json. El original permanece intacto. Contiene 63,362 elementos OSM convertidos a 10,559 entidades GeoJSON, incluida una parada. No se detectaron geometrías incompletas.

La página muestra calles, edificios (al acercar), zonas verdes, agua, lugares y paradas del archivo sobre un fondo OpenStreetMap. Pulsa un elemento para ver sus datos. En Conectar mapa puedes ocultar las capas locales o utilizar un estilo externo. Volver a mi mapa local restaura la fuente importada. El fondo OpenStreetMap es independiente del PBF y puede tener otra fecha de actualización.

Por el tamaño reducido del extracto (510 KB), se usa GeoJSON en vez de generar teselas vectoriales. La conversión usa tiny-osmpbf y osmtogeojson, conserva etiquetas y geometrías y omite metadatos personales de los editores. El navegador no decodifica directamente el original.

## Actualizar el archivo

1. Si faltan dependencias: `npm ci --ignore-scripts`.
2. Sustituye el PBF y ejecuta `npm run import:pbf`. Si hay varios: `npm run import:pbf -- "nombre.osm.pbf"`.
3. Recarga el navegador. La conversión no es automática al sustituir el archivo.

El importador admite extractos de hasta 50 MB, procesados en memoria. Para regiones grandes conviene generar teselas vectoriales. Puedes configurar su estilo MapLibre en config.js (styleUrl); cambia center y zoom si importas otra ciudad.

## Alcance

- Búsqueda por coordenadas con marcador.
- Paradas del extracto con botón para ubicarlas.
- Rutas pendientes de integrar un motor de cálculo de recorridos.
- MapLibre, tipografías y fondo OpenStreetMap requieren internet; el GeoJSON se sirve desde el proyecto.
- No se sube el PBF a servicios externos. Datos © OpenStreetMap contributors, licencia ODbL.

Referencias: https://github.com/tyrasd/tiny-osmpbf · https://github.com/tyrasd/osmtogeojson · https://maplibre.org/maplibre-style-spec/sources/
