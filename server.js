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

const maintenanceFlag = path.join(__dirname, "maintenance.on");
const maintenancePage = path.join(__dirname, "public", "system-update.html");

function maintenanceIsOn() {
  return fs.existsSync(maintenanceFlag);
}

function sendMaintenance(res) {
  let page;
  try {
    page = fs.readFileSync(maintenancePage);
  } catch (_err) {
    page = Buffer.from(
      "<!doctype html><html><meta name=viewport content='width=device-width'><title>AgriBridge Update</title><body style='font-family:system-ui;text-align:center;padding:15vh 20px'><h1>AgriBridge System Update</h1><p>Aap ka data mehfooz hai. Thori dair baad dobara check karein.</p></body></html>"
    );
  }
  res.statusCode = 503;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Length", page.length);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Retry-After", "120");
  res.end(page);
}

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
  const port = process.env.PORT || 3000;
  let handle = null;

  // Server pehle sunna shuru karta hai. Is se maintenance.on maujood ho
  // to .next replace/restart ke darmiyan bhi user ko Passenger error ke
  // bajaye hamara branded safha milta hai. Flag File Manager se banaya ya
  // delete kiya ja sakta hai; terminal aur restart ki zaroorat nahi.
  createServer((req, res) => {
    if (maintenanceIsOn() || !handle) {
      sendMaintenance(res);
      return;
    }
    handle(req, res);
  }).listen(port, (err) => {
    if (err) { logCrash(err); throw err; }
    console.log(`AgriBridge server listening on port ${port}`);
  });

  app.prepare()
    .then(() => {
      handle = app.getRequestHandler();
      console.log("AgriBridge application ready");
    })
    .catch((err) => {
      // HTTP server branded maintenance screen deta rahega. Asal crash
      // server-error.log mein mil jayega; public ko technical page nahi.
      logCrash(err);
      console.error("AgriBridge prepare failed; maintenance screen active", err);
    });
} catch (err) {
  logCrash(err);
  throw err;
}
