const packager = require('electron-packager');
const path = require('path');
const fs = require('fs');

async function build() {
  console.log('Packaging Deck & Tackle into standalone Windows executable...');

  const outDir = path.resolve(__dirname, '../release');
  if (fs.existsSync(outDir)) {
    console.log('Cleaning existing release directory...');
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  const appPaths = await packager({
    dir: __dirname,
    name: 'Deck and Tackle',
    platform: 'win32',
    arch: 'x64',
    out: outDir,
    overwrite: true,
    asar: true,
    prune: true,
    ignore: [
      /^\/src($|\/)/,
      /^\/asset($|\/)/,
      /^\/scratch($|\/)/,
      /^\/tests($|\/)/,
      /^\/\.git($|\/)/,
      /^\/tsconfig\.json$/
    ]
  });

  console.log('Build completed! Executable generated at:');
  for (const p of appPaths) {
    console.log(' ->', p);
    const exePath = path.join(p, 'Deck and Tackle.exe');
    if (fs.existsSync(exePath)) {
      console.log(' -> Verified Deck and Tackle.exe exists:', exePath);
    }
  }
}

build().catch(err => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
