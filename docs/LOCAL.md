# Entorno local de Ubicarmen

Estado: **local primero**. La app se sirve entera desde este repositorio, sin build y
sin backend propio. Firebase es opcional: si esta configurado, Firestore manda; si
falla o no hay red, la app sigue con el snapshot `data/*.json`.

## Niveles de independencia de la red

| Nivel | Que queda fuera del repo | Estado |
| --- | --- | --- |
| 1 | Teselas del mapa base (`tile.openstreetmap.org`) | base, siempre |
| 2 | MapLibre GL JS y las fuentes (DM Sans, Manrope) | **hecho** (`vendor/`) |
| 3 | Teselas vectoriales locales (PMTiles, 2-5 MB) | opcion futura, no implementada |

Con el nivel 2, la unica peticion externa que hace la pagina son las teselas raster de
OpenStreetMap. Sin internet el mapa base queda gris, pero la interfaz, los datos y la
navegacion siguen funcionando.

## Assets vendorizados (`vendor/`)

```
vendor/maplibre-gl/maplibre-gl.js     MapLibre GL JS 5.6.0 (sin CDN)
vendor/maplibre-gl/maplibre-gl.css    estilos de MapLibre
vendor/fonts/fonts.css               @font-face generado, rutas relativas
vendor/fonts/*.woff2                 subconjuntos latin y latin-ext
```

`index.html` carga `vendor/maplibre-gl/maplibre-gl.*` y `styles.css` importa
`vendor/fonts/fonts.css`. No hay ninguna URL de CDN en `index.html` ni en los CSS; el
unico `https://` que queda en la app es la plantilla de teselas de OpenStreetMap y la
atribucion ODbL, que deben conservarse.

Para refrescar o recuperar los archivos (requiere internet, una sola vez):

```bash
npm run vendor             # descarga la version fijada en el script
node scripts/vendor-assets.cjs --check   # solo comprueba que existen
```

`server.cjs` sirve `vendor/` desde la lista blanca de archivos, con
`Content-Type: font/woff2` para las fuentes.

## Firebase local (emuladores)

No hace falta cuenta, ni cuota, ni internet: el proyecto falso `demo-ubicarmen` corre
en la maquina.

```bash
npm run emulators   # Firestore 8080 + Auth 9099 + UI 4000
npm run seed        # 3 rutas, 41 paradas, 43 tramos, meta
npm run test:rules  # 10/10 comprobaciones
```

Detalle del camino de nube, reglas y despliegue real: [FIREBASE.md](FIREBASE.md).

## Entorno Node

- `.nvmrc` y `engines` fijan **Node 24**.
- Las dependencias viven solo en `node_modules/` (ignorado por git).
- `.env.local.example` documenta las variables previstas para la fase con build;
  `.env.local` no se versiona y nunca contiene claves privadas.
