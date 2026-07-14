import fs from "fs";
import path from "path";

// Vercel serverless function bound to the site root ("/").
//
// Bitrix24 loads local apps in an iframe by sending a POST request with
// auth params (AUTH_ID, DOMAIN, ...) to the app's "Путь обработчика" URL,
// and it also appends its own query params (APP_SID, DOMAIN, PROTOCOL,
// LANG) to that URL. The BX24 JS SDK reads APP_SID from location.search
// to perform its postMessage handshake with the parent frame — so we must
// NOT redirect (the old 302 flow dropped APP_SID and silently broke every
// BX24.* call, which is why user autofill and CRM settings never worked).
//
// Instead we serve the built SPA directly for both GET and POST, and for
// POST we inject the auth params into the page as window.__BX_AUTH__ so
// the client can also use the REST proxy fallback.
const AUTH_KEYS = [
  "AUTH_ID",
  "REFRESH_ID",
  "DOMAIN",
  "MEMBER_ID",
  "PLACEMENT",
  "PLACEMENT_OPTIONS",
  "USER_ID",
  "APP_SID",
  "LANG",
  "PROTOCOL",
];

export default function handler(req: any, res: any) {
  let html: string;
  try {
    // NOTE: the build renames dist/index.html -> dist/app.html so that no
    // static file exists at "/". If a static index.html were present,
    // Vercel would serve it directly for requests to "/" and skip this
    // function entirely (for both GET and POST).
    html = fs.readFileSync(path.join(process.cwd(), "dist", "app.html"), "utf-8");
  } catch (err) {
    console.error("Failed to read dist/app.html:", err);
    res.status(500).send("Build output not found. Did the build run?");
    return;
  }

  const source: Record<string, any> = {
    ...(req.query || {}),
    ...(req.method === "POST" ? req.body || {} : {}),
  };

  const auth: Record<string, string> = {};
  for (const key of AUTH_KEYS) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      auth[key] = typeof value === "object" ? JSON.stringify(value) : String(value);
    }
  }

  if (Object.keys(auth).length > 0) {
    // <-escape so user-controlled values can't close the script tag
    const json = JSON.stringify(auth).replace(/</g, "\\u003c");
    html = html.replace(
      "<head>",
      `<head><script>window.__BX_AUTH__=${json};</script>`
    );
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
