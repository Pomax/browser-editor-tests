export { addGetRoutes };

import { deleteExpiredAnonymousContent } from "../middleware.js";
import {
  getFileSum,
  execPromise,
  readContentDir,
  reloadPageInstruction,
} from "../helpers.js";
import { posix } from "path";
import { DirTree } from "../../../public/dirtree.js";
import { __dirname } from "../../constants.js";

function addGetRoutes(app) {
  // Get the current file tree from the server, and send it over in a way
  // that lets the receiver reconstitute it as a DirTree object.
  app.get(`/dir`, async (req, res) => {
    const osResponse = await readContentDir(req.session.dir);
    if (osResponse === false) return reloadPageInstruction(res);
    const dir = osResponse.map((v) => v.replace(__dirname + posix.sep, ``));
    const dirTree = new DirTree(dir, {
      getFileValue: (filename) =>
        getFileSum(req.session.dir, filename.replace(__dirname, ``)),
      ignore: [`.git`],
    });
    res.json(dirTree.tree);
  });

  // Add an extra job when loading the editor that destroys old
  // anonymous content, cleaning up the dirs based on the timestamp.
  app.get(`/editor.html`, deleteExpiredAnonymousContent, (req, res) =>
    res.render(`editor.html`, req.session)
  );

  // Get the git log, to show all rewind points.
  app.get(`/history`, async (req, res) => {
    const output = await execPromise(
      `git log  --no-abbrev-commit --pretty=format:"%H%x09%ad%x09%s"`,
      {
        cwd: req.session.dir,
      }
    );
    const parsed = output.split(`\n`).map((line) => {
      let [hash, timestamp, reason] = line.split(`\t`).map((e) => e.trim());
      reason = reason.replace(/^['"]?/, ``).replace(/['"]?$/, ``);
      return { hash, timestamp, reason };
    });
    res.json(parsed);
  });

  // the default page is editor.html:
  app.get(`/`, (_, res) => res.redirect(`/editor.html`));
}
