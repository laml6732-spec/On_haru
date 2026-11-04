// On_Haru temporary Cloudflare edge deployment.
// Source files remain in GitHub /public. Replace this proxy with a Git-integrated
// Cloudflare Pages/Workers Static Assets deployment for production.
// GitHub's raw origin can be rate-limited and is not an asset hosting SLA.
const SOURCE = "https://raw.githubusercontent.com/laml6732-spec/On_haru/main/public";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp"
};

addEventListener("fetch", event => {
  event.respondWith(serve(event.request));
});

async function serve(request) {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/legacy") {
    return Response.redirect(url.origin + "/legacy/" + url.search + url.hash, 302);
  }

  let path = url.pathname;
  if (path.endsWith("/")) path += "index.html";

  const src = SOURCE + path;
  const ext = Object.keys(MIME).find(k => path.toLowerCase().endsWith(k)) || "";
  const dynamic = ext === ".html" || ext === ".js" || ext === ".webmanifest";
  const cacheSeconds = dynamic ? 60 : 300;

  let upstream;
  try {
    upstream = await fetch(src, { cf: { cacheEverything: true, cacheTtl: cacheSeconds } });
  } catch (error) {
    console.error(JSON.stringify({ error: "github_origin_unreachable", path, message: String(error) }));
    return new Response("Source temporarily unavailable", { status: 502 });
  }

  if (upstream.status === 404) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (!upstream.ok) {
    console.error(JSON.stringify({ error: "github_origin_error", path, status: upstream.status }));
    return new Response("Source temporarily unavailable", { status: 502 });
  }

  const headers = new Headers(upstream.headers);
  if (MIME[ext]) headers.set("content-type", MIME[ext]);
  headers.set("cache-control", dynamic ? "public, max-age=60, must-revalidate" : "public, max-age=300");
  headers.delete("content-security-policy");
  headers.delete("set-cookie");
  headers.delete("content-disposition");
  headers.set("x-on-haru-deployment", "github-edge-preview");
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: 200,
    headers
  });
}
