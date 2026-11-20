// Rasterize both projection layers from the same SVG coordinates and palette.
// The baked glasses occupy raised geometry in front of the eyelids and cheeks.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const sharp = require('sharp');

async function main() {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: node render_face.cjs OUTPUT_DIRECTORY');
  const svg = readFileSync(join(__dirname, 'visitor-face.svg'), 'utf8');
  const skin = svg.replace('<defs>', '<style>.rim { display: none; }</style><defs>');
  for (const [name, source] of [['overlay', svg], ['skin', skin]]) {
    await sharp(Buffer.from(source)).png().toFile(join(directory, name + '.png'));
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
