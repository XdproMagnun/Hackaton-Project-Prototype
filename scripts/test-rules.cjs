#!/usr/bin/env node
'use strict';

// Comprueba las reglas de firebase/firestore.rules contra los emuladores.
// Requiere `npm run emulators` en otra terminal y el seed ya cargado.
//
//   npm run test:rules
//
// Verifica: lectura publica del catalogo, escritura publica denegada,
// aislamiento entre dos usuarios, sesion anonima (invitado) sin permisos de
// escritura y creacion de reportes validada.

const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-ubicarmen';

const base = `http://${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const results = [];

function encodeFields(object) {
  const encode = value => {
    if (value === null || value === undefined) return {nullValue: null};
    if (Array.isArray(value)) return {arrayValue: {values: value.map(encode)}};
    if (typeof value === 'string') return {stringValue: value};
    if (typeof value === 'boolean') return {booleanValue: value};
    if (typeof value === 'number') {
      return Number.isInteger(value) ? {integerValue: String(value)} : {doubleValue: value};
    }
    return {mapValue: {fields: encodeFields(value)}};
  };
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, encode(value)]));
}

function record(name, expected, status) {
  const ok = status === expected;
  results.push({name, expected, status, ok});
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} · esperado ${expected}, recibido ${status}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${base}/${path}?key=fake`, options);
  if (response.body) await response.arrayBuffer();
  return response.status;
}

async function signUp(email) {
  const response = await fetch(
    `http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, password: 'prueba-local-123', returnSecureToken: true})
    }
  );
  if (!response.ok) throw new Error(`No se pudo crear ${email}: ${await response.text()}`);
  return response.json();
}

async function signUpAnonymous() {
  const response = await fetch(
    `http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({returnSecureToken: true})
    }
  );
  if (!response.ok) throw new Error(`No se pudo crear la sesion anonima: ${await response.text()}`);
  const account = await response.json();
  if (!account.idToken || !account.localId) throw new Error('El emulador no devolvio una sesion anonima valida');
  return account;
}

async function main() {
  const isUp = await fetch(`http://${FIRESTORE}/`).then(() => true).catch(() => false);
  if (!isUp) throw new Error(`El emulador de Firestore no responde en ${FIRESTORE}`);

  // Catalogo: lectura publica, escritura solo admin.
  record('lectura publica del catalogo', 200, await request('routes'));
  record(
    'escritura publica del catalogo denegada',
    403,
    await request('routes/intruso', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({fields: encodeFields({name: 'Intruso'})})
    })
  );

  const suffix = Date.now();
  const userA = await signUp(`a-${suffix}@ubicarmen.local`);
  const userB = await signUp(`b-${suffix}@ubicarmen.local`);
  const asA = {Authorization: `Bearer ${userA.idToken}`, 'Content-Type': 'application/json'};

  record('usuario A escribe sus favoritos', 200, await request(`users/${userA.localId}/favorites/costera`, {
    method: 'PATCH', headers: asA, body: JSON.stringify({fields: encodeFields({routeId: 'costera', savedAt: new Date().toISOString()})})
  }));

  record('usuario A no escribe los datos de B', 403, await request(`users/${userB.localId}/favorites/costera`, {
    method: 'PATCH', headers: asA, body: JSON.stringify({fields: encodeFields({routeId: 'costera'})})
  }));

  record('usuario A no lee los datos de B', 403, await request(`users/${userB.localId}`, {method: 'GET', headers: asA}));

  record('sin sesion no se leen datos de usuario', 403, await request(`users/${userA.localId}`, {method: 'GET'}));

  // Usuario normal no puede editar el catalogo.
  record('usuario normal no edita rutas', 403, await request('routes/costera', {
    method: 'PATCH', headers: asA, body: JSON.stringify({fields: encodeFields({name: 'Editado'})})
  }));

  record('reporte con sesion valida', 200, await request(`reports/r-${suffix}`, {
    method: 'PATCH',
    headers: asA,
    body: JSON.stringify({fields: encodeFields({
      routeId: 'costera', kind: 'incident', message: 'Prueba local', createdAt: new Date().toISOString(), uid: userA.localId, status: 'open'
    })})
  }));

  record('reporte sin sesion denegado', 403, await request(`reports/publico-${suffix}`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({fields: encodeFields({
      routeId: 'costera', kind: 'incident', message: 'Sin sesion', createdAt: new Date().toISOString(), uid: 'nadie', status: 'open'
    })})
  }));

  record('reporte con uid ajeno denegado', 403, await request(`reports/ajeno-${suffix}`, {
    method: 'PATCH',
    headers: asA,
    body: JSON.stringify({fields: encodeFields({
      routeId: 'costera', kind: 'incident', message: 'Uid ajeno', createdAt: new Date().toISOString(), uid: userB.localId, status: 'open'
    })})
  }));

  // Sesion anonima (invitado) del emulador de Auth: lee el catalogo, no escribe nada.
  const guest = await signUpAnonymous();
  const asGuest = {Authorization: `Bearer ${guest.idToken}`, 'Content-Type': 'application/json'};

  record('anonimo lee el catalogo', 200, await request('routes', {method: 'GET', headers: asGuest}));

  record('anonimo no escribe el catalogo', 403, await request('routes/costera', {
    method: 'PATCH', headers: asGuest, body: JSON.stringify({fields: encodeFields({name: 'Invitado'})})
  }));

  record('anonimo no escribe su perfil', 403, await request(`users/${guest.localId}`, {
    method: 'PATCH', headers: asGuest, body: JSON.stringify({fields: encodeFields({name: 'Invitado', updatedAt: new Date().toISOString()})})
  }));

  record('anonimo no crea reportes', 403, await request(`reports/invitado-${suffix}`, {
    method: 'PATCH',
    headers: asGuest,
    body: JSON.stringify({fields: encodeFields({
      routeId: 'costera', kind: 'incident', message: 'Invitado', createdAt: new Date().toISOString(), uid: guest.localId, status: 'open'
    })})
  }));

  const failed = results.filter(result => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas.`);
  if (failed.length) {
    console.error(`Fallaron: ${failed.map(result => result.name).join('; ')}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`\nError ejecutando las pruebas de reglas: ${error.message}`);
  console.error('Comprueba que el emulador esta arriba: npm run emulators');
  process.exit(1);
});
