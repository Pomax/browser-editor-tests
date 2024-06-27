import { fileURLToPath } from "url";
import { dirname, sep, posix } from "path";
export const __dirname = dirname(fileURLToPath(import.meta.url))
  .replaceAll(sep, posix.sep)
  .replace(`/src`, ``);
