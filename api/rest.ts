// Vercel serverless function: REST API proxy to bypass browser CORS
// restrictions when calling the Bitrix24 REST API from the client.
// Mirrors the old Express "/api/rest" route in server.ts.
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { method, domain, auth, params } = req.body || {};

  if (!method || !domain || !auth) {
    res.status(400).json({
      error: "Missing required parameters: method, domain, and auth are required.",
    });
    return;
  }

  // Clean domain (remove protocol or trailing slashes if present)
  const cleanDomain = String(domain)
    .replace(/^(https?:\/\/)/, "")
    .replace(/\/$/, "");

  const url = `https://${cleanDomain}/rest/${method}.json`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth, ...params }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    console.error(`Error proxying Bitrix24 REST API for ${method}:`, err);
    res.status(500).json({
      error: "Failed to proxy request to Bitrix24.",
      details: err.message,
    });
  }
}
