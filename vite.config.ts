import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version?: string;
};

const APP_VERSION = String(pkg.version ?? '1.0.0');

/**
 * Short commit SHA. `SOURCE_COMMIT` wins: the Docker build has no .git (see .dockerignore),
 * and Coolify passes the deployed commit in that variable.
 */
export const BUILD_SHA: string = (() => {
  const fromEnv = process.env.SOURCE_COMMIT?.trim().slice(0, 7);
  if (fromEnv) return fromEnv;
  try {
    return execSync('git rev-parse --short HEAD', { cwd: repoRoot }).toString().trim();
  } catch {
    return 'dev';
  }
})();

/**
 * Tag the app's own `/sw.js` is currently served under (null = untouched). Set through
 * `/__publish-sw?tag=x`: "a new version was deployed", for foreground update checks.
 */
let publishedTag: string | null = null;

function testWorkerHandler(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const path = req.url?.split('?')[0];
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (path === '/__publish-sw') {
    publishedTag = url.searchParams.get('tag')?.replace(/[^a-zA-Z0-9-]/g, '') || null;
    res.writeHead(204).end();
    return;
  }
  if (path !== '/__update-sw.js' && !(path === '/sw.js' && publishedTag)) {
    next();
    return;
  }
  const raw = path === '/sw.js' ? publishedTag : url.searchParams.get('tag');
  const tag = (raw ?? 'test').replace(/[^a-zA-Z0-9-]/g, '') || 'test';
  // Serve the real worker template with the tag substituted: same protocol, different
  // bytes, so the browser installs it as a new version of the / registration.
  const source = readFileSync(resolve(repoRoot, 'public', 'sw.js'), 'utf8')
    .replaceAll('[SB_BUILD_ID]', `sista-bussen-test-${tag}`)
    .replaceAll('[SB_BUILD_SHA]', tag)
    .replaceAll('/*SB_PRECACHE*/', '');
  // `fail=1` makes the whole precache fail: boot must survive it (tests/e2e/update.spec.ts).
  const body = url.searchParams.get('fail') === '1' ? source.replace("'./icon-192.png'", "'./missing-on-purpose.png'") : source;
  res.writeHead(200, {
    'Content-Type': 'text/javascript; charset=utf-8',
    'Service-Worker-Allowed': '/',
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}

/** Test-only endpoint consumed by tests/e2e/update.spec.ts. */
function updateTestWorker(): Plugin {
  const wire = (middlewares: {
    use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
  }): void => {
    middlewares.use(testWorkerHandler);
  };
  return {
    name: 'sista-bussen:update-test-worker',
    configureServer(server) {
      wire(server.middlewares);
    },
    configurePreviewServer(server) {
      wire(server.middlewares);
    },
  };
}

/**
 * Build markers, substituted in two places:
 *  - `index.html` boot screen version line (`[SB_BOOT_VERSION]`), via transformIndexHtml
 *    (dev and build).
 *  - `public/sw.js` cache name, reportable build and asset precache list
 *    (`[SB_BUILD_ID]`, `[SB_BUILD_SHA]`, `/*SB_PRECACHE*\/`). `public/` files are copied
 *    verbatim, so the worker is patched in `closeBundle`, after the copy has landed.
 *
 * The cache name carries a hash of the asset list, so two builds of the same commit with
 * different output never share a cache. The app modules get version and SHA through
 * `define` below.
 */
function buildIdPlugin(): Plugin {
  return {
    name: 'sista-bussen:build-id',
    transformIndexHtml: (html) => html.replaceAll('[SB_BOOT_VERSION]', `v${APP_VERSION} · ${BUILD_SHA}`),
    closeBundle() {
      const sw = resolve(repoRoot, 'dist', 'sw.js');
      const assetsDir = resolve(repoRoot, 'dist', 'assets');
      if (!existsSync(sw)) return;
      const assets = existsSync(assetsDir) ? readdirSync(assetsDir).sort() : [];
      const urls = assets.map((name) => `./assets/${name}`);
      const hash = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 8);
      writeFileSync(
        sw,
        readFileSync(sw, 'utf8')
          .replaceAll('[SB_BUILD_ID]', `sista-bussen-v${APP_VERSION}-${BUILD_SHA}-${hash}`)
          .replaceAll('[SB_BUILD_SHA]', BUILD_SHA)
          .replaceAll('/*SB_PRECACHE*/', urls.map((u) => JSON.stringify(u)).join(', ')),
      );
    },
  };
}

export default defineConfig({
  base: './',
  define: {
    __SB_APP_VERSION__: JSON.stringify(APP_VERSION),
    __SB_BUILD_SHA__: JSON.stringify(BUILD_SHA),
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  server: {
    host: true,
  },
  plugins: [buildIdPlugin(), updateTestWorker()],
});
