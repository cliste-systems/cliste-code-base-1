import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

try {
  const id = require.resolve("server-only");
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: {},
  } as NodeModule;
} catch {
  // next may hoist server-only elsewhere — ignore
}
