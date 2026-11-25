// Cambia styleUrl por la URL de tu estilo MapLibre cuando tengas tus teselas PBF.
// El style.json debe incluir sus sources, source-layer y capas de representación.
window.MAP_CONFIG = {
  center: [-91.807, 18.651], // longitud, latitud: Ciudad del Carmen
  zoom: 13,
  styleUrl: '',
  localData: 'data/carmen.geojson',
  metadata: 'data/metadata.json',
  stops: 'data/stops.geojson',
  vehiclesUrl: '', // API JSON: {vehicles:[{id,routeId,longitude,latitude,updatedAt,active:true}]}
  simulateVehicles: true, // Dos unidades por ruta disponible; desactivar al conectar GPS.
  // Capa de datos (data-layer.js): catalogo desde Firestore en la nube.
  // Mantener estos valores en sincronia con firebase-config.js (login con SDK).
  // Si Firestore falla o no hay red, la app usa el snapshot local data/*.json.
  // Emulador local: {projectId:'demo-ubicarmen', useEmulators:true}
  firebase: {
    apiKey: 'AIzaSyDv0wS_7HaCn7-L4P7CaGnfN5TPAMawC0',
    authDomain: 'ubicarmen.firebaseapp.com',
    projectId: 'ubicarmen',
    appId: '1:88835741842:web:e7f25a0408f43f7d006e4b',
    useEmulators: false,
  },
};
