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
import helmet from "helmet";
import nocache from "nocache";
import bodyParser from "body-parser";
import { applyPatch } from "./prebaked/vendor/diff.js";
import { DirTree } from "./prebaked/dirtree.js";

const CONTENT_DIR = `./content`;

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

// A route to trigger prettier, or any other code formatter based on file extension.
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
  const slug = `${CONTENT_DIR}/${req.params.slug}`;
  mkdirSync(slug, { recursive: true });
  const filename = slug + req.params[0];
  if (!existsSync(filename)) {
    writeFileSync(filename, ``);
  }
  return res.send(`ok`);
});

// Sync edits from the browser to the file on disk, by applying a diff patch 
app.post(`/sync/:slug*`, bodyParser.text(), (req, res) => {
  const filename = `${CONTENT_DIR}/${req.params.slug + req.params[0]}`;
  const patch = req.body;
  let data = readFileSync(filename).toString(`utf8`);
  const patched = applyPatch(data, patch);
  if (patched) writeFileSync(filename, patched);
  res.send(`${getFileSum(filename, true)}`);
});

// Get the current file tree from the server, and send it over in a way
// that lets the receiver reconstitute it as a DirTree object.
app.get(`/dir`, async (req, res) => {
  const dir = await readContentDir(CONTENT_DIR);
  const dirTree = new DirTree(dir, (filename) => {
    return getFileSum(filename);
  });
  res.send(JSON.stringify(dirTree.tree));
});

// serve content from the "content" (user content) and "prebaked" (page itself)
// directories, with a redirect to index.html for direct / requests.
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
 * ...docs go here...
 * @param {*} filename 
 * @param {*} nofill 
 * @returns 
 */
function getFileSum(filename, nofill = false) {
  const filepath = nofill ? filename : `${CONTENT_DIR}/${filename}`;
  const enc = new TextEncoder();
  return enc.encode(readFileSync(filepath)).reduce((t, e) => t + e, 0);
}

/**
 * ...docs go here...
 * @param {*} command 
 * @returns 
 */
function execPromise(command) {
  return new Promise(function (resolve, reject) {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(stdout.trim());
    });
  });
}

/**
 * ...docs go here...
 * @returns 
 */
async function readContentDir() {
  const output = (await execPromise(`find ${CONTENT_DIR}`))
    .split(/\r?\n/)
    .map((v) => {
      let stats = statSync(v);
      if (stats.isDirectory()) {
        return ``;
      }
      return v
        .split(sep)
        .join(posix.sep)
        .replace(`${CONTENT_DIR}${posix.sep}`, ``);
    })
    .filter((v) => !!v);
  return output;
}

/**
 * ...docs go here...
 */
function rebuild() {
  spawnSync(`npm`, [`run`, `build`], { stdio: `inherit` });
}
