import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const form = document.querySelector('#auth-form');
const status = document.querySelector('#auth-status');
const submit = document.querySelector('#auth-submit');
const modeToggle = document.querySelector('#auth-mode-toggle');
const gate = document.querySelector('#auth-gate');
const googleButton = document.querySelector('#auth-google');
const logout = document.querySelector('#auth-logout');
const description = document.querySelector('#auth-description');
const emailLabel = document.querySelector('#auth-email-label');
const password = document.querySelector('#auth-password');
let mode = 'signin';

window.ubicarmenUser = null;

function showStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('auth-error', error);
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
  try { await signOut(auth); showStatus('Sesión cerrada.'); }
  catch (error) { showStatus(authError(error), true); }
});

let auth;
if (!configured) {
  showStatus('Falta conectar el proyecto Firebase. El inicio de sesión se habilitará al agregar su configuración web.');
  submit.disabled = true;
  modeToggle.disabled = true;
  googleButton.disabled = true;
} else {
  try {
    auth = getAuth(initializeApp(firebaseConfig));
    onAuthStateChanged(auth, user => {
      window.ubicarmenUser = user;
      form.hidden = Boolean(user);
      gate.hidden = Boolean(user);
      emailLabel.textContent = user ? `Sesión iniciada como ${user.email || 'usuario'}.` : '';
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
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (error) { showStatus(authError(error), true); }
      finally { googleButton.disabled = false; }
    });
  } catch (error) {
    showStatus('No se pudo iniciar Firebase. Revisa la configuración del proyecto.', true);
    submit.disabled = true;
  }
}
