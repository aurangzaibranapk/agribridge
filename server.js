// cPanel's "Setup Node.js App" (Phusion Passenger) runs this file directly
// with `node server.js` — it does NOT run `npm start` or `next start`.
// Passenger sets process.env.PORT itself; this file just needs to listen
// on whatever port it's given. This is the standard way to run a Next.js
// app under cPanel/Passenger hosting.
//
// IMPORTANT: Passenger has been observed running scripts from the wrong
// working directory on this host (same root cause fixed in build.js) —
// so this forces cwd AND passes `dir` explicitly to next(), rather than
// relying on process.cwd() to be correct. Any startup crash is also
// written to server-error.log in this same folder, since Passenger's own
// error page doesn't show the real error without digging through its log.
const path = require("path");
process.chdir(__dirname);

const fs = require("fs");
const { createServer } = require("http");

function logCrash(err) {
  try {
    fs.writeFileSync(
      path.join(__dirname, "server-error.log"),
      `Crashed at: ${new Date().toISOString()}\ncwd: ${process.cwd()}\n\n${err && err.stack ? err.stack : String(err)}\n`
    );
  } catch (e) {
    // if we can't even write the log, there's nothing more we can do here
  }
}

process.on("uncaughtException", (err) => { logCrash(err); throw err; });
process.on("unhandledRejection", (err) => { logCrash(err); throw err; });

try {
  const next = require("next");

  const dev = process.env.NODE_ENV !== "production";
  const app = next({ dev, dir: __dirname });
  const handle = app.getRequestHandler();

  const port = process.env.PORT || 3000;

  app.prepare().then(() => {
    createServer((req, res) => {
      handle(req, res);
    }).listen(port, (err) => {
      if (err) { logCrash(err); throw err; }
      console.log(`AgriBridge ready on port ${port}`);
    });
  }).catch((err) => { logCrash(err); throw err; });
} catch (err) {
  logCrash(err);
  throw err;
}
