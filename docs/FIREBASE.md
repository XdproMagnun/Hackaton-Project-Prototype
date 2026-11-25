# Firebase en Ubicarmen

Estado: **catalogo en la nube, con respaldo local**. La app lee todo a traves de
`data-layer.js` (`window.UbiData`), apunta al proyecto real `ubicarmen` y cae al
snapshot `data/*.json` solo si Firestore falla o no hay red. El login con Google y
correo lo resuelve el SDK de Firebase en `firebase-auth.js`.

> **Pendiente en la consola:** el proyecto `ubicarmen` todavia no tiene la base de
> datos de Firestore creada (la API responde 404). Hasta crearla y desplegar
> `firebase/firestore.rules`, el catalogo y los datos de usuario siguen saliendo del
> respaldo local.

## Principios

1. **La nube manda.** Con configuracion de Firebase, el catalogo y los datos de
   usuario vienen de Firestore; el snapshot local es solo respaldo.
2. **El respaldo nunca falla.** Si Firestore falla, la app sigue funcionando con el
   snapshot local.
3. **La apiKey web es publica.** La seguridad real son `firestore.rules` y App Check.
4. **Nunca** se versiona un service account, una clave privada ni el admin SDK.

## Capa de datos local-first (`data-layer.js`)

`window.UbiData` es la unica puerta a los datos. `app.js` y `transit.js` no leen
`data/*.json` directamente; `npm run check` falla si vuelven a hacerlo.

Precedencia del catalogo (rutas, paradas y tramos):

1. Firestore, si `MAP_CONFIG.firebase` esta configurado y responde con datos validos.
2. Snapshot local `data/routes.json` + `data/transit.geojson`.

Si Firestore falla, responde vacio o devuelve una forma inesperada, la capa avisa por
consola (`[UbiData] ...`) y usa el snapshot. La app nunca se queda en blanco.

Vehiculos: Firestore (`vehicles`) -> API `config.vehiclesUrl` -> simulacion local.

Configuracion (por ahora en `config.js`, porque todavia no hay build; el login usa la
misma configuracion desde `firebase-config.js`):

```js
firebase: {projectId: 'ubicarmen', apiKey: 'AIza...', useEmulators: false},
// Emulador local: firebase: {projectId: 'demo-ubicarmen', useEmulators: true}
// Sin Firebase: firebase: null
```

`emulatorHost` permite apuntar a otro puerto (`127.0.0.1:8080` por defecto).

Normalizacion: Firestore guarda coordenadas como `[{lng, lat}]`; la capa las entrega
como `[[lng, lat]]` dentro de GeoJSON, con las mismas claves que ya usaba la app
(`routeId`, `kind`, `number`, `name`, `accuracy`, `source`, ...), de modo que el resto
del codigo no sabe de donde vienen.

## Cuenta y datos de usuario (`account.js`)

`window.UbiAccount` sincroniza perfil y favoritos; la sesion la gestiona
`firebase-auth.js` con el SDK de Firebase.

- **Login:** `firebase-auth.js` monta la pantalla de acceso (Google y
  correo/contrasena). Al entrar expone `window.ubicarmenUser` y emite
  `ubicarmen:auth-changed`; al salir se emite otra vez con `user: null`.
- **Datos:** `account.js` escucha ese evento, pide el ID token al SDK y lee/escribe
  `users/{uid}` (`name`, `updatedAt`) y `users/{uid}/favorites/{routeId}` a traves de
  `UbiData.firestore`. Sin sesion no hace peticiones: perfil y favoritos viven en
  `localStorage` (`ubicarmen-preferences`).
- **Primer inicio de sesion en una cuenta nueva:** se sube el nombre y los favoritos
  que ya estaban en el dispositivo. Si la cuenta ya tiene datos, mandan los remotos.
- **Fallos** (sin red, base de datos ausente, respuesta inesperada): aviso
  `[UbiAccount] ...` en consola, mensaje en Mi perfil y los datos locales intactos.

Campos de `MAP_CONFIG.firebase` relevantes: `projectId`, `apiKey`, `useEmulators`,
`emulatorHost` (Firestore, 8080) y `authEmulatorHost` (Auth, 9099).

En el proyecto real hay que habilitar los proveedores **Email/Password** y **Google** en
Authentication y autorizar el dominio donde se sirve la app. Las reglas de
`firebase/firestore.rules` ya permiten al dueño leer y escribir solo su `users/{uid}` y
sus favoritos.

## Entornos

| Entorno | Proyecto | Datos | Uso |
| --- | --- | --- | --- |
| Local | `demo-ubicarmen` (emulador) | efimeros, en memoria | desarrollo y pruebas |
| Nube | proyecto real `ubicarmen` | persistentes | uso normal de la app |

El emulador no necesita Internet, ni cuenta de Firebase, ni cuota, y no puede tocar
el proyecto real.

## Comandos

```bash
npm run emulators        # Firestore 8080 + Auth 9099 + UI 4000
npm run seed             # carga data/routes.json + data/transit.geojson
npm run seed -- --dry-run
npm run test:rules       # reglas con dos identidades
```

La UI del emulador queda en http://127.0.0.1:4000.

### Java 21

`firebase-tools` 15 exige Java 21 o superior. Si la maquina solo tiene una version
antigua, el proyecto puede usar un JRE local en `.tools/` (ignorado por git):
`npm run emulators` lo detecta y lo pone en `JAVA_HOME` para el emulador. Tambien
puedes apuntar a tu propio JDK con `UBICARMEN_JAVA_HOME=/ruta/al/jdk`.

Descarga de referencia (Temurin 21, Windows x64, JRE):

```
curl -L -o .tools/jre21.zip "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk"
```

## Modelo de datos

| Coleccion | Documento | Contenido | Lectura | Escritura |
| --- | --- | --- | --- | --- |
| `routes` | `{routeId}` | nombre, color, estado, `stopCount`, calles, fuentes | publica | admin |
| `stops` | `{routeId}-{number}` | `routeId`, `number`, nombre, `lng`, `lat`, precision, nota | publica | admin |
| `routeSegments` | `{routeId}-{NN}` | `routeId`, `index`, `coordinates` como `[{lng, lat}]` | publica | admin |
| `vehicles` | `{vehicleId}` | posicion, `updatedAt`, `simulated`, `routeId` | publica | admin |
| `meta` | `version` | fecha, origen y conteos del seed | publica | admin |
| `users` | `{uid}` | perfil y preferencias del usuario | solo el dueno | solo el dueno |
| `users/{uid}/favorites` | `{routeId}` | ruta favorita | solo el dueno | solo el dueno |
| `reports` | `{id}` | reporte ciudadano (`kind`, `message`, `status`) | solo admin | crear con sesion; editar admin |

La geometria vive en `routeSegments` y no dentro de `routes` para no acercarse al
limite de 1 MiB por documento (la ruta Laguna de Terminos tiene muchos vertices).
Firestore no admite arreglos anidados, por eso cada coordenada se guarda como
`{lng, lat}` y la app la convierte a `[lng, lat]` al leer.

### Vehiculos y contrato para GPS real

`vehicles/{vehicleId}` con `routeId`, `longitude` y `latitude` (WGS84), `updatedAt`
(ISO 8601 UTC), `active` (booleano, por defecto `true`) y `simulated` (booleano).

- La app solo pinta vehiculos `active` cuyo `updatedAt` cae dentro de +/-120 s, y
  refresca cada 15 s cuando la simulacion esta desactivada.
- La escritura es solo de administrador (service account con Admin SDK o un usuario con
  el claim `admin`). La ingesta real debe usar esa via; las reglas no permiten escritura
  publica.
- Si la coleccion esta vacia, falla o no hay red, la capa cae a la simulacion local
  (dos unidades por ruta, ciclo de 3 minutos) y lo indica por consola.
- Para probar en local: crear un documento a mano en la UI del emulador
  (http://127.0.0.1:4000) con esos campos y `updatedAt` reciente.

## Reglas

`firebase/firestore.rules` implementa:

- catalogo de lectura publica, escritura solo con el custom claim `admin == true`;
- `users/{uid}` y sus favoritos solo para su dueno;
- `reports` solo son legibles por admin. Se crean con sesion, `uid` propio,
  `routeId` y `createdAt` string, `kind` permitido, `message` de 1 a 500
  caracteres y `status: "open"`; `stopId` es opcional; solo admin los edita o borra.
- todo lo no declarado queda cerrado.

Para probar el claim de administrador en el emulador puedes fijarlo en el token con
el Admin SDK del emulador; en un proyecto real se asigna con `admin.auth().setCustomUserClaims(uid, {admin: true})`.

## Variables

`.env.local` (fuera de git, plantilla en `.env.local.example`):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_USE_EMULATORS=true
```

Con `VITE_FIREBASE_USE_EMULATORS=true` el SDK se conecta a `127.0.0.1` y nunca a la nube.

Mientras no exista el build de Vite, la app clasica lee la configuracion de
`MAP_CONFIG.firebase` en `config.js`; `.env.local` queda preparado para esa fase.
Nunca se versiona un service account ni una clave privada.

## Probar el camino de nube en local (emulador)

### Estado del repositorio

`config.js` apunta al proyecto real `ubicarmen` con `useEmulators: false`: ese es el
estado normal y el que se publica. Para probar el camino de nube en local se cambia al
bloque del emulador de abajo y se restaura al terminar.

El emulador queda con el catalogo sembrado (3 rutas, 41 paradas, 43 tramos, `meta`) y
sin cuentas ni datos de usuario. Para limpiarlo y volver a sembrar:

```bash
curl -X DELETE "http://127.0.0.1:8080/emulator/v1/projects/demo-ubicarmen/databases/(default)/documents"
curl -X DELETE "http://127.0.0.1:9099/emulator/v1/projects/demo-ubicarmen/accounts"
npm run seed
```

Este procedimiento se verifico de punta a punta partiendo del emulador vacio; vuelve a probarlo antes de usarlo:
registro, login, perfil, favoritos, reglas, seed y catalogo desde Firestore.

1. En `config.js`, apuntar `MAP_CONFIG.firebase` al emulador:

```js
firebase: {
  apiKey: 'AIzaSyDv0wS_7HaCn7-L4P7CaGnfN5TPAMawC0',
  projectId: 'demo-ubicarmen',
  useEmulators: true,
  emulatorHost: '127.0.0.1:8080',
  authEmulatorHost: '127.0.0.1:9099',
},
```

2. `npm run emulators` (otra terminal) y `npm run seed`. Debe imprimir
   `Documentos: {"routes":3,"stops":41,"routeSegments":43,"meta":1}`.
3. `npm start`, crear cuenta con correo y contrasena, guardar el nombre en Mi perfil y
   marcar una ruta como favorita. En consola debe aparecer
   `[UbiData] Catalogo cargado desde Firestore.` y ningun aviso de respaldo.
4. Comprobar los documentos (con el `uid` de la sesion):

```bash
curl -H "Authorization: Bearer owner" \
  "http://127.0.0.1:8080/v1/projects/demo-ubicarmen/databases/(default)/documents/users/<uid>?key=fake"
curl -H "Authorization: Bearer owner" \
  "http://127.0.0.1:8080/v1/projects/demo-ubicarmen/databases/(default)/documents/users/<uid>/favorites?key=fake"
```

5. `npm run test:rules` → `10/10 comprobaciones correctas.`
6. Restaurar `config.js` al proyecto real (`ubicarmen`, `useEmulators: false`).
   Cierra sesion en la app antes de cambiar de entorno: el SDK guarda la sesion por
   `apiKey` y podria restaurar la del emulador contra el proyecto real (daria 404/400
   hasta cerrar sesion).

Sin sesion, escribir `users/<uid>` o sus favoritos devuelve **403** (`PERMISSION_DENIED`).

## Pasar a produccion real (solo lo puede hacer el dueno de la cuenta)

Estado de la CLI registrado anteriormente en esta maquina; confirma el estado actual antes de usarlo:

```
$ npx firebase login:list
!  No authorized accounts, run "firebase login"
$ npx firebase projects:list
Error: Failed to authenticate, have you run firebase login?
$ npx firebase firestore:databases:list --project ubicarmen
Error: Failed to authenticate, have you run firebase login?
```

Por eso **no se puede crear la base ni desplegar reglas desde aqui**: depende de la
cuenta Google del dueno. Orden exacto:

1. Iniciar sesion en la CLI con la cuenta duena del proyecto:

```bash
npx firebase login
npx firebase projects:list   # debe listar ubicarmen
```

2. Crear Cloud Firestore en la consola del proyecto `ubicarmen`:
   Firestore → Crear base de datos → **`northamerica-south1`** (no se puede cambiar
   despues) → modo produccion. Alternativa por CLI:

```bash
npx firebase firestore:databases:create "(default)" \
  --location northamerica-south1 --project ubicarmen
npx firebase firestore:databases:list --project ubicarmen   # debe mostrar (default)
```

3. Desplegar reglas e indices (la base debe existir antes):

```bash
npx firebase deploy --only firestore:rules,firestore:indexes \
  --config firebase/firebase.json --project ubicarmen
```

Debe terminar con `Deploy complete!` y las reglas visibles en
Firestore → Reglas.

4. Authentication → Sign-in method: habilitar **Email/Password** y **Google**.
   En Authentication → Settings → Authorized domains agregar el dominio publicado
   (por ejemplo `xdpromagnun.github.io`); `localhost` ya viene autorizado.
   Debe verse el proveedor en estado "Habilitado" y el dominio en la lista.

5. Cargar el catalogo con credenciales de administrador **fuera del repo**:

```bash
gcloud auth login
gcloud auth print-access-token   # solo para pasarlo al comando, no lo guardes
node scripts/seed-firestore.cjs --project ubicarmen \
  --host https://firestore.googleapis.com \
  --token "$(gcloud auth print-access-token)"
```

Debe imprimir `Documentos: {"routes":3,"stops":41,"routeSegments":43,"meta":1}` y
`Catalogo cargado en ubicarmen.` Nunca se versiona el token ni un service account.

6. Abrir la app: la consola debe decir `[UbiData] Catalogo cargado desde Firestore.`,
   el login debe completarse y, al recargar, el nombre y los favoritos deben volver
   desde la nube. Si aparece "Sin conexion con la nube", revisar el paso 2 y las reglas.

7. Opcional antes de abrir la escritura a usuarios: App Check (reCAPTCHA v3).

La apiKey web es publica y esta en el repo a proposito; la seguridad son las reglas.

`Cloud Functions` requiere el plan Blaze; no se usa en esta fase. La ingesta real de
GPS se documenta cuando existan los datos.
