// Node module hook: resolve extensionless relative imports to .ts / /index.ts so Node's native
// type stripping can load src/sim without editing it. Dev tool only, never bundled.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (/^\.\.?\//.test(specifier)) {
        for (const suffix of ['.ts', '/index.ts']) {
          try {
            return nextResolve(specifier + suffix, context);
          } catch {
            /* try next */
          }
        }
      }
      throw err;
    }
  },
});
