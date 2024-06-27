import express from "express";
import nunjucks from "nunjucks";
import { addMiddleware, pageNotFound, verifyOwnership } from "./middleware.js";
import { addGetRoutes, addPostRoutes } from "./routing/index.js";
import { setupGit, watchForRebuild } from "./helpers.js";

const PORT = process.env.PORT ?? 8000;
process.env.PORT = PORT;

const HOSTNAME = process.env.HOSTNAME ?? `localhost`;
process.env.HOSTNAME = HOSTNAME;

// Set up the core server
const app = express();
app.set("etag", false);
nunjucks.configure("public", { autoescape: true, express: app });
addMiddleware(app);
addGetRoutes(app);
addPostRoutes(app);

// static routes
app.use(`/`, express.static(`public`));
app.use(`/content`, verifyOwnership, express.static(`content`));
app.use(pageNotFound);

// Run the server, and trigger a client bundle rebuild every time script.js changes.
app.listen(PORT, () => {
  console.log(`http://${HOSTNAME}:${PORT}`);
  setupGit();
  watchForRebuild();
});
