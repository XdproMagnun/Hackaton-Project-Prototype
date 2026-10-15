'use strict';
(() => {
  const defaults = {name: '', alerts: true, favorites: []};
  let stored;
  try { stored = JSON.parse(localStorage.getItem('ubicarmen-preferences')); } catch {}
  window.uiPrefs = {
    name: typeof stored?.name === 'string' ? stored.name.slice(0, 40) : defaults.name,
    alerts: typeof stored?.alerts === 'boolean' ? stored.alerts : defaults.alerts,
    favorites: Array.isArray(stored?.favorites) ? stored.favorites.filter(id => ['campus-3','costera','laguna-terminos'].includes(id)) : []
  };
  window.saveUiPrefs = () => {
    try { localStorage.setItem('ubicarmen-preferences', JSON.stringify(window.uiPrefs)); return true; }
    catch { notify('El navegador no permite guardar preferencias. Se conservarán durante esta sesión.'); return false; }
  };
  const name = document.querySelector('#profile-name');
  name.value = window.uiPrefs.name;
  document.querySelector('#profile-form').addEventListener('submit', event => {
    event.preventDefault();
    window.uiPrefs.name = name.value.trim().slice(0, 40);
    if (window.saveUiPrefs()) notify('Perfil guardado en este dispositivo.');
  });
  document.querySelector('#profile-cancel').addEventListener('click', () => {
    name.value = window.uiPrefs.name;
    showPanel('general');
    document.querySelector('nav [data-panel="general"]').focus();
  });
  const bell = document.querySelector('#notification-toggle');
  function updateBell() {
    bell.replaceChildren(appIcon(window.uiPrefs.alerts ? 'bell' : 'bell-off'), document.createTextNode(window.uiPrefs.alerts ? 'Avisos activados' : 'Avisos silenciados'));
    bell.setAttribute('aria-pressed', String(window.uiPrefs.alerts));
    bell.title = 'Avisos dentro de la aplicación; no incluye alertas de llegadas';
  }
  bell.addEventListener('click', () => {
    window.uiPrefs.alerts = !window.uiPrefs.alerts;
    updateBell();
    if (window.saveUiPrefs()) notify(window.uiPrefs.alerts ? 'Avisos dentro de la app activados.' : 'Avisos opcionales silenciados. Los errores seguirán visibles.');
  });
  updateBell();
  window.syncLayerIcons = () => document.querySelectorAll('[data-layer-icon]').forEach(icon => {
    icon.className = 'app-icon icon-' + (document.getElementById(icon.dataset.layerIcon).checked ? 'eye' : 'eye-off');
  });
  ['routes-visible','stops-visible'].forEach(id => document.getElementById(id).addEventListener('change', window.syncLayerIcons));
  window.syncLayerIcons();
})();

// El menú no tapa el mapa hasta que el usuario lo abre.
const layerMenu = document.querySelector('#layer-menu');
document.addEventListener('pointerdown', event => {
  if (!layerMenu.contains(event.target)) layerMenu.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && layerMenu.open) {
    layerMenu.open = false;
    layerMenu.querySelector('summary').focus();
  }
});
