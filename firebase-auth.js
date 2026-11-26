import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.04.0/firebase-app.js';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { firebaseConfig as baseConfig } from './firebase-config.js';

// config.js manda en tiempo de ejecucion (emulador o proyecto real);
// firebase-config.js es el respaldo si la pagina no carga config.js.
const runtime = window.MAP_CONFIG?.firebase || {};
const firebaseConfig = {...baseConfig, ...runtime};

const form = document.querySelector('#auth-form');
const status = document.querySelector('#auth-status');
const submit = document.querySelector('#auth-submit');
const modeToggle = document.querySelector('#auth-mode-toggle');
const gate = document.querySelector('#auth-gate');
const googleButton = document.querySelector('#auth-google');
const anonymousButton = document.querySelector('#auth-anonymous');
const logout = document.querySelector('#auth-logout');
const description = document.querySelector('#auth-description');
const emailLabel = document.querySelector('#auth-email-label');
const password = document.querySelector('#auth-password');
let mode = 'signin';
const localDemoHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

window.ubicarmenUser = null;

function showStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('auth-error', error);
}

function enterLocalDemo() {
  const user = {uid: 'local-demo', email: null, isAnonymous: true, localDemo: true};
  window.ubicarmenUser = user;
  form.hidden = true;
  gate.hidden = true;
  emailLabel.textContent = 'Modo de prueba local: tus datos se guardan en este dispositivo.';
  window.dispatchEvent(new CustomEvent('ubicarmen:auth-changed', {detail: {user}}));
}

function authError(error) {
  const messages = {
    'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Inicia sesión.',
    'auth/invalid-email': 'Escribe un correo válido.',
    'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/network-request-failed': 'No hay conexión con Firebase. Revisa tu internet.',
    'auth/unauthorized-domain': 'Firebase aún no autoriza este sitio. Agrega xdpromagnun.github.io en Authentication → Configuración → Dominios autorizados.',
    'auth/operation-not-allowed': 'Este método de acceso está deshabilitado en Firebase Authentication.',
    'auth/admin-restricted-operation': 'El acceso como invitado está deshabilitado. Actívalo en Authentication → Método de acceso → Anónimo.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo otra vez.',
    'auth/popup-closed-by-user': 'Se cerró el inicio de sesión de Google antes de terminar.',
    'auth/invalid-api-key': 'La clave web de Firebase no coincide con el proyecto.'
  };
  console.error('Ubicarmen Firebase Auth:', error.code, error.message);
  return messages[error.code] || `Firebase respondió ${error.code || 'con un error'}. Revisa la configuración de Authentication.`;
}

const configured = ['apiKey', 'authDomain', 'projectId', 'appId'].every(key =>
  typeof firebaseConfig[key] === 'string' && firebaseConfig[key].trim() && !firebaseConfig[key].includes('PON_')
);

modeToggle.addEventListener('click', () => {
  mode = mode === 'signin' ? 'signup' : 'signin';
  submit.textContent = mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta';
  modeToggle.textContent = mode === 'signin' ? 'Crear cuenta' : 'Ya tengo cuenta';
  description.textContent = mode === 'signin'
    ? 'Inicia sesión para usar el seguimiento GPS de tu dispositivo.'
    : 'Crea una cuenta Ubicarmen con tu correo y contraseña.';
  password.autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
  showStatus('');
});

logout.addEventListener('click', async () => {
  if (window.ubicarmenUser?.localDemo) {
    window.ubicarmenUser = null;
    form.hidden = false;
    gate.hidden = false;
    emailLabel.textContent = '';
    window.dispatchEvent(new CustomEvent('ubicarmen:auth-changed', {detail: {user: null}}));
    showStatus('');
    return;
  }
  try {
    await signOut(auth);
    if (window.Capacitor?.isNativePlatform?.()) {
      const { signOutNative } = await import('./native-auth.bundle.js');
      await signOutNative();
    }
    showStatus('Sesión cerrada.');
  }
  catch (error) { showStatus(authError(error), true); }
});

let auth;
if (localDemoHost) {
  anonymousButton.disabled = false;
  anonymousButton.textContent = 'Entrar al mapa de prueba';
  document.querySelector('#auth-anonymous-hint').textContent = 'Modo local sin Firebase. Perfil y favoritos se quedan en este dispositivo.';
  anonymousButton.addEventListener('click', enterLocalDemo);
  enterLocalDemo();
} else if (!configured) {
  showStatus('Falta conectar el proyecto Firebase. El inicio de sesión se habilitará al agregar su configuración web.');
  submit.disabled = true;
  modeToggle.disabled = true;
  googleButton.disabled = true;
  anonymousButton.disabled = true;
} else {
  try {
    auth = getAuth(initializeApp(firebaseConfig));
    if (firebaseConfig.useEmulators) {
      const emulatorHost = String(firebaseConfig.authEmulatorHost || '127.0.0.1:9099')
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '');
      connectAuthEmulator(auth, `http://${emulatorHost}`, {disableWarnings: true});
    }
    onAuthStateChanged(auth, user => {
      window.ubicarmenUser = user;
      form.hidden = Boolean(user);
      gate.hidden = Boolean(user);
      emailLabel.textContent = user ? `Sesión iniciada como ${user.email || (user.isAnonymous ? 'invitado' : 'usuario')}.` : '';
      showStatus(user ? 'Tu ubicación se queda en este dispositivo.' : '');
      window.dispatchEvent(new CustomEvent('ubicarmen:auth-changed', {detail: {user}}));
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;
      showStatus(mode === 'signin' ? 'Iniciando sesión…' : 'Creando cuenta…');
      const email = document.querySelector('#auth-email').value.trim();
      const pass = password.value;
      try {
        if (mode === 'signup') await createUserWithEmailAndPassword(auth, email, pass);
        else await signInWithEmailAndPassword(auth, email, pass);
      } catch (error) { showStatus(authError(error), true); }
      finally { submit.disabled = false; }
    });
    googleButton.addEventListener('click', async () => {
      googleButton.disabled = true;
      showStatus('Conectando con Google…');
      try {
        if (window.Capacitor?.isNativePlatform?.()) {
          const { signInWithGoogleNative, signOutNative } = await import('./native-auth.bundle.js');
          try {
            const idToken = await signInWithGoogleNative();
            await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
          } catch (error) {
            await signOutNative().catch(() => {});
            throw error;
          }
        } else {
          await signInWithPopup(auth, new GoogleAuthProvider());
        }
      } catch (error) { showStatus(authError(error), true); }
      finally { googleButton.disabled = false; }
    });
    // Sesion de invitado: misma puerta y mismo SDK, sin correo ni contrasena.
    // Perfil y favoritos quedan en el dispositivo; las reglas no dejan escribir
    // datos de usuario a una sesion anonima.
    anonymousButton.addEventListener('click', async () => {
      anonymousButton.disabled = true;
      showStatus('Entrando como invitado…');
      try {
        await signInAnonymously(auth);
      } catch (error) {
        if (localDemoHost) enterLocalDemo();
        else showStatus(authError(error), true);
      }
      finally { anonymousButton.disabled = false; }
    });
  } catch (error) {
    showStatus('No se pudo iniciar Firebase. Revisa la configuración del proyecto.', true);
    submit.disabled = true;
    anonymousButton.disabled = true;
  }
}
