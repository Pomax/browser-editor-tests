export { addPostRoutes };

import {
  getFileSum,
  execPromise,
  switchUser,
  createRewindPoint,
} from "../helpers.js";
import { parseBodyText } from "../middleware.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { spawnSync } from "child_process";
import multer from "multer";
import { applyPatch } from "../../../public/vendor/diff.js";

const isWindows = process.platform === `win32`;
const npm = isWindows ? `npm.cmd` : `npm`;

const upload = multer({
  limits: {
    fieldSize: 25 * 1024 * 1024,
  },
});

function addPostRoutes(app) {
  // A route to trigger on-disk code formatting, based on file extension.
  app.post(`/format/:slug*`, (req, res) => {
    let formatted = false;
    const filename = `${req.session.dir}/${req.params.slug + req.params[0]}`;
    const ext = filename.substring(filename.lastIndexOf(`.`), filename.length);
    if ([`.js`, `.css`, `.html`].includes(ext)) {
      console.log(`running prettier...`);
      spawnSync(npm, [`run`, `prettier`, `--`, filename], { stdio: `inherit` });
      formatted = true;
    }
    res.json({ formatted });
    createRewindPoint(req);
  });

  // fake user login
  app.post(`/login/:name`, (req, res) => {
    const name = req.params.name;
    if ([`anonymous`, `testuser`].includes(name)) {
      return res.status(400).send("Reserved name, pick a different one.");
    }
    console.log(`we got a login for ${name}`);
    switchUser(req);
    res.send(`ok`);
  });

  // Create a new file.
  app.post(`/new/:slug*`, (req, res) => {
    const full = `${req.session.dir}/${req.params.slug + req.params[0]}`;
    const slug = full.substring(full.lastIndexOf(`/`) + 1);
    const dirs = full.replace(`/${slug}`, ``);
    mkdirSync(dirs, { recursive: true });
    if (!existsSync(full)) writeFileSync(full, ``);
    res.send(`ok`);
    createRewindPoint(req);
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
      const cwd = { cwd: req.session.dir };
      await execPromise(`git cat-file -t ${hash}`, cwd); // throws if not found
      if (hard) {
        await execPromise(`git reset ${hash}`, cwd);
      } else {
        await execPromise(`git diff HEAD ${hash} | git apply`, cwd);
      }
      // TODO: add the actual git commit? rewind needs work.
      res.send(`ok`);
    } catch (err) {
      res.status(400).send(`no`);
    }
  });

  // Synchronize file changes from the browser to the on-disk file, by applying a diff patch
  app.post(`/sync/:slug*`, parseBodyText, (req, res) => {
    const filename = `${req.session.dir}/${req.params.slug + req.params[0]}`;
    let data = readFileSync(filename).toString(`utf8`);
    const patch = req.body;
    const patched = applyPatch(data, patch);
    if (patched) writeFileSync(filename, patched);
    const hash = "" + getFileSum(req.session.dir, filename, true);
    res.send(hash);
    createRewindPoint(req);
  });

  // Create a fully qualified file.
  app.post(`/upload/:slug*`, upload.none(), (req, res) => {
    const full = `${req.session.dir}/${req.params.slug + req.params[0]}`;
    const slug = full.substring(full.lastIndexOf(`/`) + 1);
    const dirs = full.replace(`/${slug}`, ``);
    const data = req.body.content;
    mkdirSync(dirs, { recursive: true });
    writeFileSync(full, data);
    res.send(`ok`);
    createRewindPoint(req);
  });

  // OMG CHEATING, THE NEXT ONE'S A DELETE ROUTE!!

  // (Reversibly, thanks to git) delete a file
  app.delete(`/delete/:slug*`, (req, res) => {
    const filename = req.params.slug + req.params[0];
    const filepath = `${req.session.dir}/${filename}`;
    try {
      unlinkSync(filepath);
      res.send(`deleted`);
      createRewindPoint(req);
    } catch (e) {
      res.status(400).send(`could not delete ${filepath}`);
    }
  });
}
