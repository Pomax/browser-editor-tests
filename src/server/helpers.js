// exports first, so it's easier for someone to see what's on offer.
// And this works because functions get hoisted at parse-time.
export {
  createRewindPoint,
  execPromise,
  getFileSum,
  readContentDir,
  rebuild,
  setupGit,
  switchUser,
  reloadPageInstruction,
  watchForRebuild,
};

import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  watch,
} from "fs";

import { sep, posix } from "path";
import { exec, execSync, spawnSync } from "child_process";

const isWindows = process.platform === `win32`;
const npm = isWindows ? `npm.cmd` : `npm`;

const CONTENT_BASE = process.env.CONTENT_BASE ?? `content`;
process.env.CONTENT_BASE = CONTENT_BASE;

const CONTENT_DIR = isWindows ? CONTENT_BASE : `./${CONTENT_BASE}`;
process.env.CONTENT_DIR = CONTENT_DIR;

// schedule a git commit, but as an API call because
// users should also be able to trigger one, too.
const SAVE_TIMEOUT_MS = 5_000;

let saveDebounce = false;

function createRewindPoint(req, reason = `Autosave`) {
  if (saveDebounce) clearTimeout(saveDebounce);
  console.log(`scheduling rewind point`);
  saveDebounce = setTimeout(async () => {
    console.log(`creating rewind point`);
    const name = req.session.name;
    const dir = req.session.dir;
    const cmd = `cd ${dir} && git add . && git commit -m ${reason} --allow-empty --author=\"${name} <autosave@browsertests.local>\"`;
    // console.log(cmd);
    // const output =
    await execPromise(cmd);
    // console.log(output);
    saveDebounce = false;
  }, SAVE_TIMEOUT_MS);
}

function watchForRebuild() {
  [
    // append to this list as necessary
    `./src/script.js`,
    `./public/dirtree.js`,
  ].forEach((filename) => watch(filename, () => rebuild()));
  rebuild();
}

/**
 * Create a super simple hash digest by summing all bytes in the file.
 * We don't need cryptographically secure, we're just need it to tell
 * whether a file on-disk and the same file in the browser differ, and
 * if they're not, the browser simply redownloads the file.
 */
function getFileSum(dir, filename, noFill = false) {
  const filepath = noFill ? filename : `${dir}/${filename}`;
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
async function readContentDir(dir) {
  let listCommand = isWindows ? `dir /b/o/s "${dir}"` : `find ${dir}`;
  let dirListing;
  try {
    dirListing = await execPromise(listCommand);
  } catch (e) {
    // This can happen if the server reboots but the client didn't
    // reload, leading to a session name mismatch.
    console.warn(e);
    return false;
  }
  const allFileListing = dirListing
    .split(/\r?\n/)
    .map((v) => {
      let stats = statSync(v);
      if (stats.isDirectory()) return false;
      return v.split(sep).join(posix.sep).replace(`${dir}${posix.sep}`, ``);
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
    `user.email "actions@browsertests.local"`,
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
  spawnSync(npm, [`run`, `build`], {
    stdio: `inherit`,
  });
  console.log(`Build took ${Date.now() - start}ms`), 8;
}

/**
 * ...
 */
function switchUser(req, name = req.params.name) {
  const oldName = req.session.name;
  const oldDir = req.session.dir;
  const dir = `${CONTENT_DIR}/${name}`;

  console.log(`switching user from ${oldName} to ${name}`);

  req.session.name = name;
  req.session.dir = dir;
  req.session.save();

  let newUser = false;
  if (!existsSync(dir)) {
    newUser = true;
    mkdirSync(dir);
    // New, temporary anonymous dir?
    if (name.startsWith(`anonymous-`)) {
      const index = `${CONTENT_DIR}/anonymous/index.html`;
      const target = `${dir}/index.html`;
      console.log(`${index} => ${target}`);
      copyFileSync(index, target);
    }
    // "regular" user, give them the test user content
    else {
      cpSync(dir.replace(name, `testuser`), dir, { recursive: true });
    }
  } else if (oldName.startsWith(`anonymous-`)) {
    // If we switch from anonymous to real user, we
    // delete the anonymous dir because that content
    // was mostly a signal for someone to log in.
    rmSync(oldDir, { recursive: true, force: true });
  }

  // ensure there's a git dir
  if (!existsSync(`${dir}/.git`)) {
    console.log(`adding git tracking for ${dir}`);
    execSync(`cd ${dir} && git init && cd ..`);
  }

  // If not, is this a switch from an anonymous "account" to a new, real "account"?
  else if (oldName.startsWith(`anonymous-`) && oldDir && newUser) {
    // TODO: Copy the anonymous user's files to their new, real
    //       dir, and then delete the anonymous-12345 directory.
  }
  return dir;
}

/**
 * Send a response that triggers a page-reload in the browser.
 */
function reloadPageInstruction(res, status = 400) {
  res.status(status).json({ reloadPage: true });
}
