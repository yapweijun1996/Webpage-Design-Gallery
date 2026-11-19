/* Run with the Khronos gltf-validator package on Node's module search path. */
const fs = require('node:fs');
const path = require('node:path');
const validator = require('gltf-validator');
// Optional directory for another kit with the same three quality tiers.
const root = process.argv[2] ?? path.resolve(__dirname,'../demos/corporate/gjh/v11/assets/elevator');

async function validate() {
  for (const tier of ['low','balanced','detailed']) {
    const file = tier + '.glb';
    const bytes = fs.readFileSync(path.join(root,file));
    const {issues} = await validator.validateBytes(new Uint8Array(bytes),{uri:file});
    console.log(file, issues.numErrors+' errors, '+issues.numWarnings+' warnings');
    if (issues.numErrors || issues.numWarnings) {
      console.error(issues.messages);
      process.exitCode = 1;
    }
  }
}
validate().catch(error => { console.error(error); process.exitCode=1; });
