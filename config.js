// Cambia styleUrl por la URL de tu estilo MapLibre cuando tengas tus teselas PBF.
// El style.json debe incluir sus sources, source-layer y capas de representación.
window.MAP_CONFIG = {
  center: [-91.807, 18.651], // longitud, latitud: Ciudad del Carmen
  zoom: 13,
  styleUrl: '',
  localData: 'data/carmen.geojson',
  metadata: 'data/metadata.json',
  stops: 'data/stops.geojson',
};
