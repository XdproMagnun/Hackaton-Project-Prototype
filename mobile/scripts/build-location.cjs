const path = require('node:path');
const esbuild = require('esbuild');

const projectRoot = path.resolve(__dirname, '..', '..');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'location.js')],
  outfile: path.join(projectRoot, 'location.bundle.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020']
});
