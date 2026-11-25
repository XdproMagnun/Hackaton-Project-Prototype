#!/usr/bin/env node
'use strict';

// Arranca los emuladores de Firebase con el JRE local si hace falta.
// firebase-tools 15 exige Java 21+; el proyecto puede traer un JRE en .tools/
// (fuera de git) para no depender de una instalacion global.
//
//   npm run emulators
//   UBICARMEN_JAVA_HOME=/ruta/al/jdk npm run emulators

const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const javaBinary = process.platform === 'win32' ? 'java.exe' : 'java';

function hasJava(home) {
  return Boolean(home) && fs.existsSync(path.join(home, 'bin', javaBinary));
}

function findJavaHome() {
  for (const candidate of [process.env.UBICARMEN_JAVA_HOME, process.env.JAVA_HOME]) {
    if (hasJava(candidate)) return candidate;
  }
  const tools = path.join(root, '.tools');
  if (fs.existsSync(tools)) {
    for (const entry of fs.readdirSync(tools)) {
      const candidate = path.join(tools, entry);
      if (hasJava(candidate)) return candidate;
    }
  }
  return null;
}

const javaHome = findJavaHome();
const firebaseBin = path.join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');

if (!fs.existsSync(firebaseBin)) {
  console.error('Falta firebase-tools. Ejecuta: npm ci');
  process.exit(1);
}

const env = {...process.env};
if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${path.join(javaHome, 'bin')}${path.delimiter}${env.PATH || ''}`;
  console.log(`Java: ${javaHome}`);
} else {
  console.warn('No se encontro un JDK 21+. Coloca uno en .tools/ o define UBICARMEN_JAVA_HOME.');
}

const extra = process.argv.slice(2);
const args = [
  firebaseBin,
  'emulators:start',
  '--config', path.join('firebase', 'firebase.json'),
  '--project', 'demo-ubicarmen',
  ...extra
];

const child = spawn(process.execPath, args, {cwd: root, env, stdio: 'inherit'});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', code => process.exit(code ?? 0));
