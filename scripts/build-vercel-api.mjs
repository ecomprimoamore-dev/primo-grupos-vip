import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Bundle every project-local module into the concrete Vercel function entry.
// External package imports remain runtime dependencies listed in package.json.
await build({
  absWorkingDir: projectRoot,
  entryPoints: [path.join(projectRoot, 'src', 'server', 'vercel-handler.ts')],
  outfile: path.join(projectRoot, 'api', 'express.js'),
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
