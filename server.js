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
// import { applyPatch } from "./prebaked/vendor/textdiff-patch.js";
import { applyPatch } from "./prebaked/vendor/diff.js";
import { DirTree } from "./prebaked/dirtree.js";

const CONTENT_DIR = `./content`;

const app = express();
app.set("etag", false);
app.use(nocache());

// app.use(bodyParser.json());

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

app.post(`/format/:slug*`, (req, res) => {
  const filename = `${CONTENT_DIR}/${req.params.slug + req.params[0]}`;
  const ext = filename.substring(filename.lastIndexOf(`.`), filename.length);
  if ([`.js`, `.css`, `.html`].includes(ext)) {
    spawnSync(`npm`, [`run`, `prettier`, `--`, filename], { stdio: `inherit` });
  }
  res.send(`ok`);
});

app.post(`/new/:slug*`, (req, res) => {
  const slug = `${CONTENT_DIR}/${req.params.slug}`;
  mkdirSync(slug, { recursive: true });
  const filename = slug + req.params[0];
  if (!existsSync(filename)) {
    writeFileSync(filename, ``);
  }
  return res.send(`ok`);
});

app.post(`/sync/:slug*`, bodyParser.text(), (req, res) => {
  const filename = `${CONTENT_DIR}/${req.params.slug + req.params[0]}`;
  const patch = req.body;
  let data = readFileSync(filename).toString(`utf8`);
  const patched = applyPatch(data, patch);
  if (patched) writeFileSync(filename, patched);
  res.send(`${getFileSum(filename, true)}`);
});

function getFileSum(filename, nofill = false) {
  const filepath = nofill ? filename : `${CONTENT_DIR}/${filename}`;
  const enc = new TextEncoder();
  return enc.encode(readFileSync(filepath)).reduce((t, e) => t + e, 0);
}

app.get(`/dir`, async (req, res) => {
  const dir = await readContentDir(CONTENT_DIR);
  const dirTree = new DirTree(dir, (filename) => {
    return getFileSum(filename);
  });
  res.send(JSON.stringify(dirTree.tree));
});

app.get(`/`, (req, res) => res.redirect(`/index.html`));
app.use(`/`, express.static(`content`));
app.use(`/`, express.static(`prebaked`));

app.listen(8000, () => console.log(`http://127.0.0.1:8000`));

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

// file-watch to see if we need to rebuild
function rebuild() {
  spawnSync(`npm`, [`run`, `build`], { stdio: `inherit` });
}

rebuild();

console.log(`watching...`);
watch(`./script.js`, () => rebuild());
