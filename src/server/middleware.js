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

/**
 * Send a 404
 */
function pageNotFound(req, res) {
  if (req.query.preview) {
    res.status(404).send(`Preview not found`);
  } else {
    res.status(404).send(`${req.url} not found`);
  }
}

/**
 * The size of an interval measured in days, represented in milliseconds,
 * but with a minimum of 10 seconds when days is set to zero.
 */
function daysInMS(d = 1) {
  if (d < 0) d = 0;
  if (d === 0) return 10_000;
  return d * 24 * 3600 * 1000;
}

/**
 * Clean up all temporary anonymous dirs that got too old.
 */
function deleteExpiredAnonymousContent(_req, _res, next) {
  next();
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

/**
 * A simple bit of middleware that confirms that someone
 * trying to explicitly load a file from a content URL is
 * in fact the owner of that file by checking the session.
 * If it's not, it sends a response that forces the browser
 * to reload so that a new session can be negotiated.
 */
function verifyOwnership(req, res, next) {
  if (!req.url.startsWith(`/${req.session.name}`)) {
    req.session.name = undefined;
    req.session.dir = undefined;
    return reloadPageInstruction(res, 403);
  }
  next();
}

/**
 * No need for the "body-parser" middleware. It's just bloat.
 */
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

  // Use session management, so we can use different dirs for different "users".
  app.use(
    session({
      secret: `this shouldn't matter but here we are anyway`,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 24 * 3600 * 1000
      }
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
        connectSrc: `* data: blob: 'unsafe-inline'`,
        defaultSrc: `* data: mediastream: blob: filesystem: about: ws: wss: 'unsafe-eval' 'unsafe-inline'`,
        fontSrc: `* data: blob: 'unsafe-inline'`,
        frameAncestors: `* data: blob: 'unsafe-inline'`,
        frameSrc: `* data: blob:`,
        imgSrc: `* data: blob: 'unsafe-inline'`,
        mediaSrc: `* data: blob: 'unsafe-inline'`,
        scriptSrc: `* data: blob: 'unsafe-inline' 'unsafe-eval'`,
        scriptSrcElem: `* data: blob: 'unsafe-inline'`,
        styleSrc: `* data: blob: 'unsafe-inline'`,
      },
    })
  );
}
