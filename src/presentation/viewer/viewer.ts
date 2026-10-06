import { ARTIFACT_CSP, artifactPage } from "./artifact-page.ts";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; frame-src 'self'; frame-ancestors 'none'";

export function viewerPage(id: string, token: string, a: { title: string; ownerEmail: string; version: number; updatedAt: string }): Response {
  const src = `/a/${encodeURIComponent(id)}/content?t=${encodeURIComponent(token)}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(a.title)}</title>
<style>:root{--bg:#f5f6f4;--ink:#1a2220;--muted:#5c6662;--rule:#d8ddda}@media (prefers-color-scheme:dark){:root{--bg:#121615;--ink:#e5eae7;--muted:#9aa5a0;--rule:#2c3532}}
body{margin:0;height:100vh;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,"Segoe UI",sans-serif}
header{padding:12px 20px;border-bottom:1px solid var(--rule)}h1{margin:0;font-size:17px}small{color:var(--muted)}iframe{flex:1;border:0;background:#fff;width:100%}</style></head>
<body><header><h1>${esc(a.title)}</h1><small>${esc(a.ownerEmail)} · version ${a.version} · ${esc(a.updatedAt.slice(0, 10))} · Extend artifacts</small></header>
<iframe sandbox="allow-scripts" src="${src}" title="${esc(a.title)}"></iframe></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": PAGE_CSP, "cache-control": "no-store" } });
}

export function contentPage(type: string, content: string): Response {
  return new Response(artifactPage(type, content), { headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": `${ARTIFACT_CSP}; frame-ancestors 'self'`, "cache-control": "no-store" } });
}
