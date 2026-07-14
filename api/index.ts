import fs from "fs";
import path from "path";

// Vercel serverless function bound to the site root ("/").
// Bitrix24 loads local apps by sending a POST request with auth params
// to the app's "Путь обработчика" URL. We convert that POST into a
// redirect with query params (matching the old Express server.ts logic),
// and for plain GET requests we serve the built SPA (dist/index.html).
export default function handler(req: any, res: any) {
  if (req.method === "POST") {
    const body = req.body || {};
    const {
      AUTH_ID,
      REFRESH_ID,
      DOMAIN,
      MEMBER_ID,
      PLACEMENT,
      PLACEMENT_OPTIONS,
      USER_ID,
    } = body;

    const params = new URLSearchParams();
    if (AUTH_ID) params.append("AUTH_ID", String(AUTH_ID));
    if (REFRESH_ID) params.append("REFRESH_ID", String(REFRESH_ID));
    if (DOMAIN) params.append("DOMAIN", String(DOMAIN));
    if (MEMBER_ID) params.append("MEMBER_ID", String(MEMBER_ID));
    if (PLACEMENT) params.append("PLACEMENT", String(PLACEMENT));
    if (USER_ID) params.append("USER_ID", String(USER_ID));

    if (PLACEMENT_OPTIONS) {
      const optStr =
        typeof PLACEMENT_OPTIONS === "object"
          ? JSON.stringify(PLACEMENT_OPTIONS)
          : String(PLACEMENT_OPTIONS);
      params.append("PLACEMENT_OPTIONS", optStr);
    }

    res.writeHead(302, { Location: `/?${params.toString()}` });
    res.end();
    return;
  }

  // GET (and anything else): serve the built single-page app.
  // NOTE: the build renames dist/index.html -> dist/app.html so that no
  // static file exists at "/". If a static index.html were present,
  // Vercel would serve it directly for requests to "/" and skip this
  // function entirely (for both GET and POST), which is exactly the bug
  // that caused Bitrix24's POST-based auth handoff to silently no-op.
  try {
    const indexPath = path.join(process.cwd(), "dist", "app.html");
    const html = fs.readFileSync(indexPath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (err) {
    console.error("Failed to read dist/index.html:", err);
    res.status(500).send("Build output not found. Did the build run?");
  }
}
