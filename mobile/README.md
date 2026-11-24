# Ubicarmen para Android y iPhone

Este proyecto móvil usa Capacitor y mantiene una copia de los recursos web dentro de `mobile/www`. Los archivos de la versión web en la raíz del repositorio son solo de lectura para `copy:web`; no se editan.

## Preparación

1. Instala Node.js 22 o superior y Android Studio; para compilar iPhone, necesitas macOS con Xcode.
2. Desde esta carpeta ejecuta `npm install`.
3. Ejecuta `npx cap add android` para crear el proyecto Android y `npx cap add ios` para crear el proyecto iOS.
4. Ejecuta `npm run sync` para copiar el prototipo y sincronizar los proyectos nativos.
5. Abre el proyecto con `npm run android` o `npm run ios`.

Cuando cambie el prototipo web, `npm run sync` actualiza la copia empaquetada dentro de la app móvil. No modifica los archivos originales de la web.

## Alcance actual

La primera etapa empaqueta el prototipo existente como aplicación móvil instalable. El seguimiento GPS real de autobuses aún necesita dispositivos GPS y un servicio backend; el prototipo actual muestra unidades simuladas.
