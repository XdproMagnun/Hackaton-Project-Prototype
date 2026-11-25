'use strict';
// Perfil y favoritos sobre la sesion de Firebase Auth (firebase-auth.js).
//
// Sin sesion este modulo no hace peticiones de red: todo sigue en localStorage a
// traves de window.uiPrefs, igual que antes. Con sesion usa la capa de datos
// (window.UbiData.firestore) y el ID token que entrega el SDK de Firebase.
// Cualquier fallo deja los datos locales intactos y avisa por consola con
// [UbiAccount] ...; nunca bloquea la app ni la deja en blanco.
(() => {
  const config = window.MAP_CONFIG || {};
  const data = window.UbiData || null;
  const enabled = Boolean(config.firebase?.projectId && data?.firestore?.enabled());
  let user = null;
  // La sesion anonima no sincroniza: las reglas le niegan users/{uid} y sus
  // favoritos. Su perfil se queda en localStorage, como sin sesion.
  const canSync = () => Boolean(user) && !user.isAnonymous;

  const warn = message => console.warn(`[UbiAccount] ${message}`);

  function render(message) {
    const status = document.querySelector('#account-status');
    if (status) status.textContent = message;
  }

  async function pullUserData() {
    const idToken = await user.getIdToken();
    const uid = user.uid;
    const profile = await data.firestore.get(`users/${uid}`, idToken);
    const favorites = await data.firestore.list(`users/${uid}/favorites`, idToken);
    const favoriteIds = favorites
      .map(document => String(document.id || document.routeId || ''))
      .filter(Boolean);

    if (!profile && !favoriteIds.length) {
      // Cuenta nueva: sube lo que ya habia en local.
      await pushAllUserData(idToken);
      return;
    }

    if (profile && typeof profile.name === 'string' && profile.name.trim()) {
      window.uiPrefs.name = profile.name.trim().slice(0, 40);
    }
    window.uiPrefs.favorites = favoriteIds;
    window.saveUiPrefs();

    const nameInput = document.querySelector('#profile-name');
    if (nameInput) nameInput.value = window.uiPrefs.name;
  }

  async function pushAllUserData(idToken) {
    const uid = user.uid;
    if (window.uiPrefs.name) {
      await data.firestore.set(`users/${uid}`, {name: window.uiPrefs.name, updatedAt: new Date().toISOString()}, idToken);
    }
    for (const routeId of window.uiPrefs.favorites) {
      await data.firestore.set(
        `users/${uid}/favorites/${routeId}`,
        {routeId, savedAt: new Date().toISOString()},
        idToken
      );
    }
  }

  async function onSignedIn() {
    if (!canSync()) {
      render('Sesión de invitado: tu perfil y favoritos quedan en este dispositivo.');
      return;
    }
    render('Sincronizando perfil y favoritos…');
    try {
      await pullUserData();
      render('Perfil y favoritos sincronizados con tu cuenta.');
    } catch (error) {
      warn(`No se pudieron cargar tus datos (${error.message}). Uso los datos locales.`);
      render('Sin conexión con la base de datos. Tu perfil y favoritos quedan en este dispositivo.');
    }
  }

  window.addEventListener('ubicarmen:auth-changed', event => {
    user = event.detail?.user || null;
    if (!user) {
      render('Sin sesión. Tu perfil y favoritos se guardan en este dispositivo.');
      return;
    }
    onSignedIn();
  });

  // --- API publica ---------------------------------------------------------

  window.UbiAccount = {
    get enabled() {
      return enabled;
    },
    get signedIn() {
      return Boolean(user);
    },
    get email() {
      return user ? user.email || '' : '';
    },
    saveFavorite(routeId, saved) {
      const persisted = window.saveUiPrefs();
      if (canSync()) {
        user.getIdToken().then(idToken => saved
          ? data.firestore.set(`users/${user.uid}/favorites/${routeId}`, {routeId, savedAt: new Date().toISOString()}, idToken)
          : data.firestore.delete(`users/${user.uid}/favorites/${routeId}`, idToken)
        ).catch(error => warn(`No se pudo sincronizar el favorito (${error.message}). Se guardó en local.`));
      }
      return persisted;
    },
    syncProfile() {
      if (!canSync()) return;
      user.getIdToken().then(idToken => data.firestore.set(
        `users/${user.uid}`,
        {name: window.uiPrefs.name, updatedAt: new Date().toISOString()},
        idToken
      )).catch(error => warn(`No se pudo sincronizar el perfil (${error.message}). Se guardó en local.`));
    },
    signOut() {
      user = null;
      render('Sin sesión. Tu perfil y favoritos se guardan en este dispositivo.');
    }
  };

  if (window.ubicarmenUser) {
    user = window.ubicarmenUser;
    onSignedIn();
  } else if (enabled) {
    render('Sin sesión. Tu perfil y favoritos se guardan en este dispositivo.');
  }
})();
