# Datos de Ubicarmen

## Fuentes

| Archivo | Origen | Licencia / nota |
| --- | --- | --- |
| `planet_-91.853,18.618_-91.757,18.682.osm.pbf` | extracto de OpenStreetMap, 510 KB | © OpenStreetMap contributors, ODbL |
| `data/carmen.geojson` | generado desde el PBF con `npm run import:pbf` | ODbL |
| `data/stops.geojson` | paradas OSM del mismo extracto | ODbL |
| `data/routes.json` | catalogo de Amor X Carmen, curado a mano | del proyecto |
| `data/transit.geojson` | generado con `npm run build:route` | del proyecto |
| `data/laguna-source.kml` | KML del My Maps compartido | del proyecto |
| `assets/*.png` | carteles y capturas aportadas por el equipo | del proyecto; no son imagen de producto |

El extracto cubre `[-91.853, 18.618] – [-91.757, 18.682]`, con 63,362 elementos OSM
convertidos a 10,559 entidades GeoJSON. `data/metadata.json` guarda el sha256 del PBF,
la fecha de la fuente y los conteos.

MapLibre, las fuentes tipograficas y las teselas de `tile.openstreetmap.org` no son
locales: sin Internet el mapa base no se dibuja, aunque los datos y la app si cargan.

## Generacion

```bash
npm ci --ignore-scripts     # solo la primera vez: tiny-osmpbf y osmtogeojson
npm run import:pbf          # PBF -> carmen.geojson, stops.geojson, metadata.json
npm run build:route         # reconstruye transit.geojson y routes.json
npm run check               # valida sintaxis, JSON y coherencia del catalogo
```

`build:route` **sobrescribe** `transit.geojson` y `routes.json`: no lo ejecutes si
acabas de corregir coordenadas a mano sin guardar el cambio en `scripts/`.

## Precisicion y limites

- Campus III: 12 paradas estimadas por calibracion de pixeles entre Chedraui y
  Bodega Aurrera; los numeros identifican marcadores, no el orden de paso.
- Costera: 29 paradas; las 3 primeras usan coordenadas del My Maps compartido y el
  resto se estimo desde una captura de 1365x582 y se ajusto a la red vial del PBF.
- Laguna de Terminos: trazado importado del KML, con todos sus vertices. No tiene
  paradas georreferenciadas.
- No hay coordenadas GPS ni nombres oficiales completos. No se calculan sentidos,
  horarios, frecuencias ni tarifas. El trazado es de referencia, no navegacion.
- Los camiones son una simulacion de 2 unidades por ruta en ciclos de 3 minutos.

Estas limitaciones se muestran en la interfaz y no deben eliminarse sin datos nuevos.

## Criterios para editar datos

1. Corregir coordenadas en `scripts/build-campus-route.cjs` o `scripts/costera.cjs`
   y regenerar; no editar `transit.geojson` a mano de forma permanente.
2. Al cambiar el numero de paradas, actualizar `stopCount` en `routes.json`
   (`npm run build:route` lo hace por las rutas Costera y Laguna).
3. Mantener la atribucion a OpenStreetMap visible en el mapa.
4. `npm run check` debe pasar antes de cualquier commit que toque datos.
