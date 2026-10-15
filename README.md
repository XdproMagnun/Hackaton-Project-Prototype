Problemática: Ubicacion precisa de los autobuses de amor x carmen inexistente y sin ningun mapa claro de rutas y paradas
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
- Paradas de referencia de Campus III y Costera, y puntos OSM independientes, con botón para ubicarlos.
- Campus III, Costera y Laguna de Términos integrados como recorridos de referencia. No se calculan recorridos de navegación.
- MapLibre, tipografías y fondo OpenStreetMap requieren internet; el GeoJSON se sirve desde el proyecto.
- No se sube el PBF a servicios externos. Datos © OpenStreetMap contributors, licencia ODbL.

Referencias: https://github.com/tyrasd/tiny-osmpbf · https://github.com/tyrasd/osmtogeojson · https://maplibre.org/maplibre-style-spec/sources/

## Amor X Carmen · Campus III

La ruta se integra desde dos imágenes aportadas por el usuario el 15 de octubre de 2026, guardadas en assets/. El cartel proporciona el recorrido y la captura permite identificar 12 marcadores etiquetados de Amor X Carmen. Costera y Laguna de Términos se agregaron posteriormente desde sus referencias compartidas.

- `data/routes.json`: catálogo de las tres rutas, estado de verificación, calles del cartel y fuentes.
- `data/transit.geojson`: 43 tramos de referencia y 41 ubicaciones aproximadas; la fuente de Laguna de Términos no muestra paradas.
- `transit.js`: selección de ruta, capas, marcadores accesibles, lista de paradas y ajuste del mapa.
- `npm run build:route`: reconstruye los datos de referencia usando el PBF convertido; ejecutar solo si se desea reemplazar ajustes manuales de transit.geojson.

Las posiciones de las paradas se estimaron a partir de los píxeles de la captura y dos referencias del PBF (Chedraui y Bodega Aurrera). No hay coordenadas GPS originales ni nombres oficiales completos; los números identifican puntos de la imagen, no el orden de paso. La captura no garantiza contener todas las paradas. No se incluye una tolerancia métrica porque no se ha medido en campo.

El trazado usa vías OSM seleccionadas según el cartel, más una conexión aproximada en Abasolo. Se muestra discontinuo para señalar que es de referencia. No se han validado sentidos, horarios, frecuencias, tarifas ni vigencia operativa. No es un motor de navegación. Las paradas del PBF se presentan separadas porque no tienen una asociación confirmada con Amor X Carmen.

Para corregir puntos, editar las coordenadas [longitud, latitud] y propiedades en transit.geojson. Para añadir las otras rutas, incorporar geometrías con su routeId y cambiar su status de pending a reference en routes.json. Las capas de transporte son independientes de la visibilidad de los datos base del PBF.


## Amor X Carmen · Costera

Se digitalizaron 29 marcadores visibles de la captura My Maps. Los primeros tres usan las coordenadas del mapa My Maps compartido. Los otros 26 se calibraron con Chedraui y Bodega Aurrera y se ajustaron a la calle más cercana del PBF. Los nombres Punto 1, 2 y 3 coinciden con los del mapa; los números restantes son referencias internas y no indican orden de servicio. El recorrido se interpretó del cartel en cinco secciones; no está ajustado exactamente a las calles y no se debe usar para navegación giro a giro.

Las imágenes están en assets/costera-paradas.png y assets/costera-recorrido.png. scripts/costera.cjs conserva los píxeles originales, calibración y trazado. npm run build:route reconstruye las rutas y conserva Campus III. Para corregir permanentemente Costera, editar ese módulo.

## Amor X Carmen · Laguna de Términos

El recorrido se importa directamente del KML del My Maps compartido, conservado en `data/laguna-source.kml`. Se mantienen todos sus vértices y conexiones, sin recalcular caminos por calles cercanas. No contiene marcadores de paradas. `npm run build:route` reconstruye la ruta a partir de esta fuente y la simulación recorre su geometría.

## Mapa general y camiones

Mapa general reúne las rutas disponibles. Mostrar rutas y Mostrar paradas controlan capas independientes y no ocultan camiones. Rutas y Paradas filtran la vista a la ruta elegida. Hay dos unidades simuladas por cada una de las tres rutas (seis actualmente). La simulación recorre segmentos de referencia en ciclos de tres minutos, puede saltar entre tramos desconectados y no representa horarios, velocidades o ubicaciones reales.

config.js activa simulateVehicles. Para usar GPS, desactivarlo y configurar vehiclesUrl con una API JSON que devuelva vehicles: [{id, routeId, longitude, latitude, updatedAt, active}]. updatedAt debe ser una fecha ISO; solo se muestran registros activos de los últimos 120 segundos. Se consulta cada 15 segundos; la API necesita permitir el acceso desde el sitio. Ante fallos se retiran las posiciones y se muestra el estado de conexión.

Categoria de participacion: Hack for Humanity Challenge


Tecnologias que se usaron para este proyecto: Codex, ChatGPT.

Integrantes del equipo:
Julian Mendoza

Irving del Angel

Carlos Morales

Miguel Garcia

Dominic Ugarte

