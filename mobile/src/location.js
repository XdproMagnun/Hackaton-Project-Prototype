import { Geolocation } from '@capacitor/geolocation';

const button = document.querySelector('#location-toggle');
let nativeWatchId = null;
let browserWatchId = null;
let hasLocation = false;

function setTracking(active) {
  button.setAttribute('aria-pressed', String(active));
  button.textContent = active ? '■' : '⌖';
  button.setAttribute('aria-label', active ? 'Detener seguimiento de mi ubicación' : 'Iniciar seguimiento de mi ubicación');
  button.title = active ? 'Detener GPS' : 'Seguir mi ubicación';
}

function reportPosition(position) {
  if (!position?.coords) return;
  hasLocation = true;
  const {latitude, longitude, accuracy} = position.coords;
  window.showUserLocation?.({latitude, longitude, accuracy});
  document.querySelector('#map-status').textContent = `GPS activo · precisión aproximada ${Math.round(accuracy)} m`;
}

function reportError(error) {
  const messages = {
    1: 'Permite el acceso a la ubicación en los ajustes del dispositivo o navegador.',
    2: 'No se pudo obtener la ubicación. Comprueba que el GPS esté activado.',
    3: 'El GPS tardó demasiado. Intenta de nuevo en un lugar con mejor señal.'
  };
  window.notify(messages[error?.code] || error?.message || 'No se pudo acceder al GPS.', 'optional');
  if (!hasLocation) stopTracking();
}

async function startTracking() {
  const isNative = Boolean(window.Capacitor?.isNativePlatform?.());
  if (isNative) {
    const permission = await Geolocation.checkPermissions();
    if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
      const requested = await Geolocation.requestPermissions();
      if (requested.location !== 'granted' && requested.coarseLocation !== 'granted') throw {code: 1};
    }
    nativeWatchId = await Geolocation.watchPosition({enableHighAccuracy: true, timeout: 20000, maximumAge: 5000, interval: 3000}, (position, error) => {
      if (error) reportError(error);
      else reportPosition(position);
    });
  } else {
    if (!navigator.geolocation) throw new Error('Este navegador no ofrece acceso a la ubicación.');
    browserWatchId = navigator.geolocation.watchPosition(reportPosition, reportError, {enableHighAccuracy: true, timeout: 20000, maximumAge: 5000});
  }
  setTracking(true);
  window.notify('Buscando tu ubicación…');
}

async function stopTracking() {
  if (nativeWatchId !== null) {
    await Geolocation.clearWatch({id: nativeWatchId}).catch(() => {});
    nativeWatchId = null;
  }
  if (browserWatchId !== null) {
    navigator.geolocation.clearWatch(browserWatchId);
    browserWatchId = null;
  }
  hasLocation = false;
  setTracking(false);
  window.clearUserLocation?.();
}

button.addEventListener('click', async () => {
  if (!window.ubicarmenUser) {
    window.notify('Inicia sesión en Mi perfil para activar tu ubicación.');
    window.showPanel('account');
    return;
  }
  if (button.getAttribute('aria-pressed') === 'true') {
    await stopTracking();
    window.notify('Seguimiento GPS detenido.');
    return;
  }
  button.disabled = true;
  try { await startTracking(); }
  catch (error) { reportError(error); }
  finally { button.disabled = false; }
});

window.addEventListener('ubicarmen:auth-changed', event => {
  if (!event.detail.user) stopTracking();
});
