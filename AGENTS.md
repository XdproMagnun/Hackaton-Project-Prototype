# AGENTS.md · Instrucciones para los modelos de IA

Este repositorio lo trabajan **varios modelos de IA**. Estas reglas existen para que
nadie rompa el trabajo de otro y para que la version publicada nunca se caiga.

## Contexto del proyecto

Ubicarmen es un mapa web de Ciudad del Carmen (Campeche) con rutas y paradas de
"Amor X Carmen". Hoy es HTML/CSS/JS clasico sin build: `index.html`, `app.js`,
`transit.js`, `preferences.js`, `icons.js`, `config.js`, `server.cjs`, tres CSS en la
raiz, datos en `data/` y el pipeline en `scripts/`.

La app usa **Firestore en la nube** como fuente principal, detras de una capa de datos
(`data-layer.js`). El snapshot `data/*.json` es solo respaldo si Firestore falla. El
login (Google y correo) lo resuelve `firebase-auth.js` con el SDK de Firebase.

## Estado actual (importante)

- `main` es la version publicada: **no la toques**.
- El tag `v0-hackathon` congela el estado inicial: **no lo muevas ni lo borres**.
- El trabajo va en la rama `feat/local-first`. Cada modelo usa una rama propia que
  salga de ahi (`feat/<tema>-<modelo>`).
- La **limpieza y el refactor estan aplazados**. No borres CSS "muerto", no
  reformatees archivos completos y no reescribas `app.js`/`transit.js` sin que se
  apruebe esa fase.
- La app ya esta conectada a Firebase (`config.js` + `firebase-auth.js`).
  `firebase/` y `scripts/seed-*` sirven para emuladores y para desplegar reglas/indices.
- **La base de datos de Firestore del proyecto real todavia no existe** en la consola;
  hasta crearla, la app cae al snapshot local y los datos de usuario no se sincronizan.

## Comandos

```bash
npm start                 # sirve la app actual en http://127.0.0.1:5173
npm run check             # obligatorio antes de commitear
npm run emulators         # Firestore + Auth en local (project demo-ubicarmen)
npm run seed              # catalogo de ejemplo en el emulador
npm run test:rules        # reglas con dos identidades
npm run build:route       # regenera transit.geojson/routes.json
npm run vendor            # revendoriza MapLibre y fuentes en vendor/ (requiere red)
```

## Reglas de convivencia

1. **Un cambio, un tema.** No mezcles refactor con funcionalidad ni con formato.
2. **Un archivo por cambio** cuando sea posible; si dos modelos necesitan el mismo
   archivo, gana quien lo anuncie primero y el otro rebasa.
3. **`npm run check` en verde** antes de cada commit. Si tocas reglas, tambien
   `npm run test:rules` con el emulador arriba.
4. **Nada de secretos**: ni service accounts, ni claves privadas, ni `.env.local`.
   La apiKey web de Firebase no es un secreto, pero tambien va en `.env.local`.
5. **No versiones `.tools/`** (JRE local) ni `node_modules/`: estan ignorados y son
   parte del entorno de cada maquina.
6. **No edites archivos generados** (`data/carmen.geojson`, `data/stops.geojson`,
   `data/transit.geojson`, `data/routes.json`) a mano: usa `scripts/` y regenera.
7. **No reescribas historia** ni fuerces push. No commitees directo en `main`.
8. **Dependencias**: justifica cualquiera nueva y prefiere resolver con la plataforma.
   Nada que exija un servidor Node en produccion si el sitio es estatico.
9. **Archivos pequenos**: si un archivo pasa de ~400 lineas, divide por modulo en la
   fase de refactor, no antes.
10. **Accesibilidad y datos**: conserva `aria-*`, los objetivos tactiles de 44 px, la
   atribucion ODbL y los avisos de "aproximado"/"simulacion". No los quites.
11. **Idioma**: interfaz y documentacion en espanol neutro; nombres de codigo en
    ingles. Commits convencionales (`feat:`, `fix:`, `docs:`, `chore:`).
12. **Cuenta**: la sesion la gestiona `firebase-auth.js` (SDK) y se consume con
    `window.ubicarmenUser` / el evento `ubicarmen:auth-changed`. Perfil y favoritos pasan
    por `window.UbiAccount` (`account.js`). No agregues otro login paralelo ni leas
    sesiones a mano en otros modulos.
13. **Datos**: toda lectura pasa por `window.UbiData` (`data-layer.js`). No uses
    `fetch('data/...')` en `app.js` ni en `transit.js`: `npm run check` lo detecta.
    Si añades una fuente, devuelve la misma forma que el snapshot (rutas, GeoJSON con
    `kind: 'stop' | 'route'`, vehiculos con `longitude`/`latitude`) y cae al snapshot
    ante cualquier fallo.

## Definicion de "terminado"

- El cambio hace lo que pide, sin funciones extra.
- `npm run check` pasa y, si aplica, `npm run build` (cuando exista).
- La app sigue cargando en `npm start` sin errores de consola.
- No hay archivos de datos regenerados ni `.env.local` en el diff.
- El resumen explica que se verifico y que no se pudo verificar.
