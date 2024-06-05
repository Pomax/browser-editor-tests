import {
  readFileSync,
  writeFileSync,
  existsSync,
  watch,
  statSync,
  mkdirSync,
} from "fs";
import { sep, posix } from "path";
import { exec, spawnSync } from "child_process";
import express from "express";
import multer from "multer";
import helmet from "helmet";
import nocache from "nocache";
import bodyParser from "body-parser";
import { applyPatch } from "./prebaked/vendor/diff.js";
import { DirTree } from "./prebaked/dirtree.js";

const CONTENT_DIR = `./content`;
const upload = multer({
  limits: {
    fieldSize: 25 * 1024 * 1024,
  },
});

// Set up the core server
const app = express();
app.set("etag", false);
app.use(nocache());

// I hate CSP so much
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: `* data: mediastream: blob: filesystem: about: ws: wss: 'unsafe-eval' 'unsafe-inline'`,
      scriptSrc: `* data: blob: 'unsafe-inline' 'unsafe-eval'`,
      scriptSrcElem: `* data: blob: 'unsafe-inline'`,
      connectSrc: `* data: blob: 'unsafe-inline'`,
      imgSrc: `* data: blob: 'unsafe-inline'`,
      mediaSrc: `* data: blob: 'unsafe-inline'`,
      frameSrc: `* data: blob:`,
      styleSrc: `* data: blob: 'unsafe-inline'`,
      fontSrc: `* data: blob: 'unsafe-inline'`,
      frameAncestors: `* data: blob: 'unsafe-inline'`,
    },
  })
);

// A route to trigger on-disk code formatting, based on file extension.
app.post(`/format/:slug*`, (req, res) => {
  const filename = `${CONTENT_DIR}/${req.params.slug + req.params[0]}`;
  const ext = filename.substring(filename.lastIndexOf(`.`), filename.length);
  if ([`.js`, `.css`, `.html`].includes(ext)) {
    spawnSync(`npm`, [`run`, `prettier`, `--`, filename], { stdio: `inherit` });
  }
  res.send(`ok`);
});

// Create a new file.
app.post(`/new/:slug*`, (req, res) => {
  const full = `${CONTENT_DIR}/${req.params.slug + req.params[0]}`;
  const slug = full.substring(full.lastIndexOf(`/`) + 1);
  const dirs = full.replace(`/${slug}`, ``);
  mkdirSync(dirs, { recursive: true });
  if (!existsSync(full)) writeFileSync(full, ``);
  return res.send(`ok`);
});

// Create a fully qualified file.
app.post(`/upload/:slug*`, upload.none(), (req, res) => {
  const full = `${CONTENT_DIR}/${req.params.slug + req.params[0]}`;
  const slug = full.substring(full.lastIndexOf(`/`) + 1);
  const dirs = full.replace(`/${slug}`, ``);
  const data = req.body.content;
  mkdirSync(dirs, { recursive: true });
  writeFileSync(full, data);
  return res.send(`ok`);
});

// Synchronize file changes from the browser to the on-disk file, by applying a diff patch
app.post(`/sync/:slug*`, bodyParser.text(), (req, res) => {
  const filename = `${CONTENT_DIR}/${req.params.slug + req.params[0]}`;
  let data = readFileSync(filename).toString(`utf8`);
  const patch = req.body;
  const patched = applyPatch(data, patch);
  if (patched) writeFileSync(filename, patched);
  res.send(`${getFileSum(filename, true)}`);
});

// Get the current file tree from the server, and send it over in a way
// that lets the receiver reconstitute it as a DirTree object.
app.get(`/dir`, async (req, res) => {
  const dir = await readContentDir(CONTENT_DIR);
  const dirTree = new DirTree(dir, (filename) => getFileSum(filename));
  res.send(JSON.stringify(dirTree.tree));
});

// serve content from the "content" (user content) and "prebaked" (page itself)
// directories, with a redirect to index.html (because obviously).
app.get(`/`, (req, res) => res.redirect(`/index.html`));
app.use(`/`, express.static(`content`));
app.use(`/`, express.static(`prebaked`));

// Run the server, and trigger a client bundle rebuild every time script.js changes.
app.listen(8000, () => {
  console.log(`http://127.0.0.1:8000`);
  rebuild();
  watch(`./script.js`, () => rebuild());
});

// -----------------------------------------------------------

/**
 * Create a super simple hash digest by summing all bytes in the file.
 * We don't need cryptographically secure, we're just need it to tell
 * whether a file on-disk and the same file in the browser differ, and
 * if they're not, the browser simply redownloads the file.
 */
function getFileSum(filename, nofill = false) {
  const filepath = nofill ? filename : `${CONTENT_DIR}/${filename}`;
  const enc = new TextEncoder();
  return enc.encode(readFileSync(filepath)).reduce((t, e) => t + e, 0);
}

/**
 * A little wrapper that turns exec() into an async call
 */
function execPromise(command) {
  return new Promise((resolve, reject) =>
    exec(command, (err, stdout, stderr) => {
      if (err) return reject(stderr);
      resolve(stdout.trim());
    })
  );
}

/**
 * Ask the OS for a flat dir listing.
 */
async function readContentDir() {
  let listCommand =
    process.platform === `win32`
      ? `dir ${CONTENT_DIR} /b/o/s`
      : `find ${CONTENT_DIR}`;
  const output = await execPromise(listCommand);
  const allFileListing = output
    .split(/\r?\n/)
    .map((v) => {
      let stats = statSync(v);
      if (stats.isDirectory()) return false;
      return v
        .split(sep)
        .join(posix.sep)
        .replace(`${CONTENT_DIR}${posix.sep}`, ``);
    })
    .filter((v) => !!v);
  return allFileListing;
}

/**
 * Trigger a rebuild by telling npm to run the `build` script from package.json.
 */
function rebuild() {
  spawnSync(`npm`, [`run`, `build`], { stdio: `inherit` });
}
