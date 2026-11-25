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

## Acceso y ubicación del usuario

La web y la app móvil comparten Firebase Authentication con cuentas de correo y contraseña. Antes de habilitar el acceso:

1. Crea un proyecto en Firebase y registra una aplicación web en ese proyecto.
2. En Authentication, habilita el proveedor **Correo electrónico/Contraseña**.
3. Copia el objeto de configuración web en `../firebase-config.js`.
4. En Firebase Authentication, agrega el dominio de GitHub Pages a los dominios autorizados.

El GPS se activa únicamente al tocar el botón de ubicación. La posición se pinta en el mapa del dispositivo y **no se envía ni guarda en Firebase**. La app solicita permiso de ubicación mientras se usa; el navegador también requiere permiso y un contexto seguro como HTTPS. El seguimiento funciona mientras la app/página está abierta; no es seguimiento en segundo plano.

Al crear el proyecto iOS en una Mac, agrega en `ios/App/App/Info.plist` la clave `NSLocationWhenInUseUsageDescription` con el texto `Ubicarmen usa tu ubicación para mostrarte en el mapa. Tu posición no se comparte.` antes de compilar la app.
