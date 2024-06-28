export {
  addMiddleware,
  deleteExpiredAnonymousContent,
  pageNotFound,
  parseBodyText,
  verifyOwnership,
};

import session from "express-session";
import helmet from "helmet";
import nocache from "nocache";
import { readdirSync, rmSync } from "fs";
import { reloadPageInstruction, switchUser } from "./helpers.js";
import { __dirname } from "../constants.js";

function pageNotFound(req, res) {
  if (req.query.preview) {
    res.status(404).send(`Preview not found`);
  } else {
    res.status(404).send(`${req.url} not found`);
  }
}

function daysInMS(d = 1) {
  // 10 seconds so there's always a gap
  if (d === 0) return 10_000;
  return d * 24 * 3600 * 1000;
}

function deleteExpiredAnonymousContent(_req, _res, next) {
  next();
  // run this without interfering with the route handling itself.
  const dir = `${__dirname}/${process.env.CONTENT_BASE}`;
  readdirSync(dir)
    .filter((v) => v.startsWith(`anonymous-`))
    .forEach((name) => {
      const timestamp = parseFloat(name.replace(`anonymous-`, ``));
      const now = Date.now();
      if (timestamp < now - daysInMS(0)) {
        rmSync(`${dir}/${name}`, { recursive: true, force: true });
      }
    });
}

function verifyOwnership(req, res, next) {
  if (!req.url.startsWith(`/${req.session.name}`)) {
    return reloadPageInstruction(res, 403);
  }
  next();
}

function parseBodyText(req, res, next) {
  let chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    req.body = Buffer.concat(chunks).toString(`utf-8`);
    next();
  });
}

function addMiddleware(app) {
  app.use(nocache());

  // Use session management so we can use different dirs for different "users"
  app.use(
    session({
      secret: `this shouldn't matter but here we are anyway`,
      resave: false,
      saveUninitialized: false,
    })
  );

  app.use(async (req, res, next) => {
    if (!req.session.dir) {
      switchUser(req, `anonymous-${Date.now()}`);
    }
    next();
  });

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
}
