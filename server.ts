import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support urlencoded and JSON bodies
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(express.json({ limit: "50mb" }));

  // Intercept the POST request from Bitrix24 iframe load
  // and redirect it to GET with query parameters
  app.post("/", (req, res) => {
    const { 
      AUTH_ID, 
      REFRESH_ID, 
      DOMAIN, 
      MEMBER_ID, 
      PLACEMENT, 
      PLACEMENT_OPTIONS, 
      USER_ID 
    } = req.body;

    const params = new URLSearchParams();
    if (AUTH_ID) params.append("AUTH_ID", String(AUTH_ID));
    if (REFRESH_ID) params.append("REFRESH_ID", String(REFRESH_ID));
    if (DOMAIN) params.append("DOMAIN", String(DOMAIN));
    if (MEMBER_ID) params.append("MEMBER_ID", String(MEMBER_ID));
    if (PLACEMENT) params.append("PLACEMENT", String(PLACEMENT));
    if (USER_ID) params.append("USER_ID", String(USER_ID));
    
    if (PLACEMENT_OPTIONS) {
      const optStr = typeof PLACEMENT_OPTIONS === "object" 
        ? JSON.stringify(PLACEMENT_OPTIONS) 
        : String(PLACEMENT_OPTIONS);
      params.append("PLACEMENT_OPTIONS", optStr);
    }

    const queryString = params.toString();
    res.redirect(`/?${queryString}`);
  });

  // REST API Proxy to bypass browser CORS restrictions
  app.post("/api/rest", async (req, res) => {
    const { method, domain, auth, params } = req.body;

    if (!method || !domain || !auth) {
      res.status(400).json({ error: "Missing required parameters: method, domain, and auth are required." });
      return;
    }

    // Clean domain (remove protocol or slashes if they exist)
    let cleanDomain = String(domain)
      .replace(/^(https?:\/\/)/, "")
      .replace(/\/$/, "");

    const url = `https://${cleanDomain}/rest/${method}.json`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth,
          ...params,
        }),
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error(`Error proxying Bitrix24 REST API for ${method}:`, err);
      res.status(500).json({ error: "Failed to proxy request to Bitrix24.", details: err.message });
    }
  });

  // API Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
