import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version?: string;
};

const APP_VERSION = String(pkg.version ?? '1.0.0');

/** Short git SHA of the current commit; "dev" when the tree is not a git repo. */
export const BUILD_SHA: string = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: repoRoot }).toString().trim();
  } catch {
    return 'dev';
  }
})();

function testWorkerHandler(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  if (req.url?.split('?')[0] !== '/__update-sw.js') {
    next();
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  const tag = (url.searchParams.get('tag') ?? 'test').replace(/[^a-zA-Z0-9-]/g, '') || 'test';
  // Serve the real worker template with the tag substituted: same protocol, different
  // bytes, so the browser installs it as a new version of the / registration.
  const source = readFileSync(resolve(repoRoot, 'public', 'sw.js'), 'utf8')
    .replaceAll('[SB_BUILD_ID]', `sista-bussen-test-${tag}`)
    .replaceAll('[SB_BUILD_SHA]', tag);
  res.writeHead(200, {
    'Content-Type': 'text/javascript; charset=utf-8',
    'Service-Worker-Allowed': '/',
    'Cache-Control': 'no-cache',
  });
  res.end(source);
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
 * Replace the build markers in two dist files:
 *  - `index.html` boot screen version line (`[SB_BOOT_VERSION]`)
 *  - `public/sw.js` cache name + reportable build (`[SB_BUILD_ID]`, `[SB_BUILD_SHA]`)
 *
 * `public/` files are copied verbatim and are not transformed, so the service worker is
 * patched by text substitution in `closeBundle`, after the copy has landed on disk. The
 * app modules get the same values through `define` below.
 */
function buildIdPlugin(): Plugin {
  return {
    name: 'sista-bussen:build-id',
    apply: 'build',
    closeBundle() {
      const cache = `sista-bussen-v${APP_VERSION}-${BUILD_SHA}`;
      const swap = (text: string): string =>
        text
          .replaceAll('[SB_BOOT_VERSION]', `v${APP_VERSION} · ${BUILD_SHA}`)
          .replaceAll('[SB_BUILD_ID]', cache)
          .replaceAll('[SB_BUILD_SHA]', BUILD_SHA);
      for (const name of ['index.html', 'sw.js']) {
        const file = resolve(repoRoot, 'dist', name);
        if (!existsSync(file)) continue;
        writeFileSync(file, swap(readFileSync(file, 'utf8')));
      }
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
