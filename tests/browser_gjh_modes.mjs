// Compatibility entrypoint: use the repository's Python Playwright conventions.
// Set GALLERY_PYTHON when Playwright is installed in a dedicated environment.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const result = spawnSync(process.env.GALLERY_PYTHON || 'python3',
  [fileURLToPath(new URL('./browser_gjh_modes.py', import.meta.url)), ...process.argv.slice(2)],
  {stdio: 'inherit'});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
