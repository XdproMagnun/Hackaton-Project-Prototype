const esbuild = require('esbuild');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
esbuild.buildSync({
  entryPoints: [path.join(projectRoot, 'src', 'native-auth.js')],
  outfile: path.join(projectRoot, 'www', 'native-auth.bundle.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020']
});
console.log('Puente de autenticación Google preparado para Capacitor.');
