// Register the player illustration's vector features against each NPC's bind pose.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const profiles = require('./npc-profiles.json');

async function render(id, output) {
  const p = profiles[id];
  let player = fs.readFileSync(path.join(__dirname,'visitor-face.svg'),'utf8');
  ['#3b1222','#6a1428','#be2a30','#eb6550','#ffab78'].forEach((color,i) => {
    player = player.replace(color,p.iris[i]);
  });
  const defs = player.match(/<defs>([\s\S]*?)<\/defs>/)[1];
  const position = (x,y,sx,sy,cx,cy,content) =>
    `<g transform="translate(${x} ${y}) scale(${sx} ${sy}) translate(${-cx} ${-cy})">${content}</g>`;
  const [x,y,sx,sy] = p.eye, [bx,by,bs] = p.brow;
  const eye = position(x,y,sx,sy,178,315,'<use xlink:href="#eye"/><ellipse cx="186" cy="297" rx="8" ry="8.6" fill="#fffdf7"/><circle cx="171" cy="329" r="3.7" fill="#ffe9d4"/>');
  const brow = position(bx,by,bs,1,178,236,'<use xlink:href="#eyebrow"/>');
  const [cx,cy] = p.cheek;
  const side = eye+brow+`<ellipse cx="${cx}" cy="${cy}" rx="29" ry="13" fill="url(#rouge)" opacity=".58"/>`;
  function feature(id) {
    const group = player.match(new RegExp(`<g id="${id}">([\\s\\S]*?)</g>`));
    if (!group) throw new Error('Missing player face feature: '+id);
    return group[1];
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="2048" height="2048" viewBox="0 0 500 500">
  <defs>${defs}</defs>${side}<g transform="translate(500 0) scale(-1 1)">${side}</g>
  ${position(...p.nose,1,1,247,354,feature('nose'))}${position(...p.mouth,p.mouth[2],248,378,feature('mouth'))}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(output);
}

render(process.argv[2],process.argv[3]).catch(error=>{console.error(error);process.exitCode=1;});
