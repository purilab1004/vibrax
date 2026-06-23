// Node test resolver hook.
// Source files import sibling modules without a `.ts` extension (required by the
// Next/tsc build, which has allowImportingTsExtensions disabled). `node --test`
// strips types but does not add extensions, so cross-module imports like
// `import ... from './catalog'` fail to resolve. This hook rewrites extensionless
// relative specifiers to their `.ts` file when one exists.
//
// Usage: node --import ./scripts/ts-resolve.mjs --test lib/**/*.test.ts
import { register } from 'node:module'

// When preloaded via --import, register this same module as a resolution hook
// for the test worker. Guard against re-registering in the worker thread.
if (!process.env.__TS_RESOLVE_REGISTERED) {
  process.env.__TS_RESOLVE_REGISTERED = '1'
  register(import.meta.url)
}

export async function resolve(specifier, context, next) {
  if (/^\.\.?\//.test(specifier) && !/\.[mc]?[jt]s$/.test(specifier)) {
    try {
      return await next(specifier + '.ts', context)
    } catch {
      // Fall back to the original specifier (e.g. directory or .js resolution).
    }
  }
  return next(specifier, context)
}
