import {
  readFileSync,
  writeFileSync,
  existsSync,
  watch,
  statSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { sep, posix } from "path";
import { exec, execSync, spawnSync } from "child_process";
import express from "express";
import multer from "multer";
import helmet from "helmet";
import nocache from "nocache";
import bodyParser from "body-parser";
import { applyPatch } from "./prebaked/vendor/diff.js";
import { DirTree } from "./prebaked/dirtree.js";

const __dirname = import.meta.dirname.replaceAll(sep, posix.sep);
const isWindows = process.platform === `win32`;
const npm = isWindows ? `npm.cmd` : `npm`;
const CONTENT_DIR = isWindows ? `content` : `./content`;
const toWatch = [`./script.js`, `./prebaked/dirtree.js`];
const upload = multer({
  limits: {
    fieldSize: 25 * 1024 * 1024,
  },
});

// Ensure that git is watching the content dir
if (!existsSync(`${CONTENT_DIR}/.git`)) {
  console.log(`adding git tracking for content dir`);
  execSync(`cd ${CONTENT_DIR} && git init`);
}

// schedule a git commit, but as an API call because
// users should also be able to trigger one, too.
const SAVE_TIMEOUT_MS = 5_000;
let saveDebounce = false;
function createRewindPoint() {
  if (saveDebounce) clearTimeout(saveDebounce);
  console.log(`scheduling rewind point`);
  saveDebounce = setTimeout(async () => {
    console.log(`creating rewind point`);
    // FIXME: this domain should obviously not be hard-coded.
    await fetch(`http://localhost:8000/save?autosave=1`, {
      method: `post`,
    });
    saveDebounce = false;
  }, SAVE_TIMEOUT_MS);
}

// Set up the core server
const app = express();
app.set("etag", false);
app.use(nocache());

// I hate CSP so much...
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
    console.log(`running prettier...`);
    spawnSync(npm, [`run`, `prettier`, `--`, filename], { stdio: `inherit` });
  }
  res.send(`ok`);
  createRewindPoint();
});

// Create a new file.
app.post(`/new/:slug*`, (req, res) => {
  const full = `${CONTENT_DIR}/${req.params.slug + req.params[0]}`;
  const slug = full.substring(full.lastIndexOf(`/`) + 1);
  const dirs = full.replace(`/${slug}`, ``);
  mkdirSync(dirs, { recursive: true });
  if (!existsSync(full)) writeFileSync(full, ``);
  res.send(`ok`);
  createRewindPoint();
});

// Create a fully qualified file.
app.post(`/upload/:slug*`, upload.none(), (req, res) => {
  const full = `${CONTENT_DIR}/${req.params.slug + req.params[0]}`;
  const slug = full.substring(full.lastIndexOf(`/`) + 1);
  const dirs = full.replace(`/${slug}`, ``);
  const data = req.body.content;
  mkdirSync(dirs, { recursive: true });
  writeFileSync(full, data);
  res.send(`ok`);
  createRewindPoint();
});

// Synchronize file changes from the browser to the on-disk file, by applying a diff patch
app.post(`/sync/:slug*`, bodyParser.text(), (req, res) => {
  const filename = `${CONTENT_DIR}/${req.params.slug + req.params[0]}`;
  let data = readFileSync(filename).toString(`utf8`);
  const patch = req.body;
  const patched = applyPatch(data, patch);
  if (patched) writeFileSync(filename, patched);
  res.send(`${getFileSum(filename, true)}`);
  createRewindPoint();
});

// Create a "rewind" point.
app.post(`/save`, async (req, res) => {
  const autosave = !!req.query.autosave;
  const rewind = req.query.rewind;
  let reason = req.query.reason ?? `Manual save`;
  if (autosave) reason = `Autosave`;
  if (rewind) reason = `Rewind to ${rewind}`;
  const opts = { cwd: CONTENT_DIR, stdio: `inherit` };
  spawnSync(`git`, [`add`, `.`], opts);
  spawnSync(`git`, [`commit`, `-m`, `"${reason}"`, `--allow-empty`], opts);
  res.send(`saved`);
});

// Get the git log, to show all rewind points.
app.get(`/history`, async (req, res) => {
  const output = await execPromise(
    `git log  --no-abbrev-commit --pretty=format:"%H%x09%ad%x09%s"`,
    {
      cwd: CONTENT_DIR,
    }
  );
  const parsed = output.split(`\n`).map((line) => {
    let [hash, timestamp, reason] = line.split(`\t`).map((e) => e.trim());
    reason = reason.replace(/^['"]?/, ``).replace(/['"]?$/, ``);
    return { hash, timestamp, reason };
  });
  res.json(parsed);
});

// Instead of a true rewind, revert the files, but *keep* the git history,
// and just spin a new commit that "rolls back" everything between the
// HEAD and the target commit, so that we never lose work.
//
// It's only ever a linear timeline, because the human experience is
// linear in time.
//
// Unless ?hard=1 is used, in which case I hope you know what you're doing.
app.post(`/rewind/:hash`, async (req, res) => {
  const hash = req.params.hash;
  const hard = !!req.query.hard;
  console.log(`checking hash ${hash}`);
  try {
    const cwd = { cwd: CONTENT_DIR };
    await execPromise(`git cat-file -t ${hash}`, cwd); // throws if not found
    if (hard) {
      await execPromise(`git reset ${hash}`, cwd);
    } else {
      await execPromise(`git diff HEAD ${hash} | git apply`, cwd);
    }
    await fetch(`http://localhost:8000/save?rewind=${hash}`, {
      method: `post`,
    });
    res.send(`ok`);
  } catch (err) {
    res.status(400).send(`no`);
  }
});

// Irreversibly delete a file
app.delete(`/delete/:slug*`, (req, res) => {
  const filename = `${CONTENT_DIR}/${req.params.slug + req.params[0]}`;
  unlinkSync(filename);
  res.send(`gone`);
  createRewindPoint();
});

// Get the current file tree from the server, and send it over in a way
// that lets the receiver reconstitute it as a DirTree object.
app.get(`/dir`, async (req, res) => {
  const osResponse = await readContentDir(CONTENT_DIR);
  const dir = osResponse.map((v) => v.replace(__dirname + posix.sep, ``));
  const dirTree = new DirTree(dir, {
    getFileValue: (filename) => getFileSum(filename.replace(__dirname, ``)),
    ignore: [`.git`],
  });
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
  setupGit();
  toWatch.forEach((filename) => watch(filename, () => rebuild()));
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
function execPromise(command, options = {}) {
  return new Promise((resolve, reject) =>
    exec(command, options, (err, stdout, stderr) => {
      if (err) return reject(stderr);
      resolve(stdout.trim());
    })
  );
}

/**
 * Ask the OS for a flat dir listing.
 */
async function readContentDir() {
  let listCommand = isWindows
    ? `dir /b/o/s ${CONTENT_DIR}`
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
 * Make git not guess at the name and email for the commits we'll be making
 */
async function setupGit() {
  for (let cfg of [
    `user.name "browser tests"`,
    `user.email "browsertests@localhost"`,
  ]) {
    await execPromise(`git config --local ${cfg}`, { cwd: CONTENT_DIR });
  }
}

/**
 * Trigger a rebuild by telling npm to run the `build` script from package.json.
 */
function rebuild() {
  console.log(`rebuilding`);
  const start = Date.now();
  spawnSync(npm, [`run`, `build:esbuild`], {
    stdio: `inherit`,
  });
  console.log(`Build took ${Date.now() - start}ms`);
}
