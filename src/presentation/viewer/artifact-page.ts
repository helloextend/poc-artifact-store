// Builds the page an artifact preview loads (served from the artifact: protocol in a sandboxed iframe).
const CDN = "https://cdnjs.cloudflare.com/ajax/libs";

/** Scripts only from cdnjs (and Tailwind's CDN for React artifacts); no network calls, no forms, no frames. */
export const ARTIFACT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.tailwindcss.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src data: blob:",
  "connect-src 'none'",
  "form-action 'none'",
  "frame-src 'none'",
].join("; ");

/** JSON for embedding in a <script>, with '<' escaped so content can never close the tag. */
const embed = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c");

const shell = (head: string, bodyHtml: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head}<style>body{margin:0;padding:16px;font:15px/1.5 -apple-system,sans-serif;background:#fff;color:#1f1e1c}</style></head><body>${bodyHtml}</body></html>`;

export function artifactPage(type: string, content: string): string {
  switch (type) {
    case "text/html":
      return content;
    case "image/svg+xml":
      return shell("", `<div style="display:grid;place-items:center;min-height:90vh">${content}</div>`);
    case "application/vnd.mermaid":
      return shell(
        `<script src="${CDN}/mermaid/10.9.1/mermaid.min.js"></script>`,
        `<div id="m" class="mermaid"></div><script>const src=${embed(content)};document.getElementById("m").textContent=src;mermaid.initialize({startOnLoad:false,securityLevel:"strict"});mermaid.run({nodes:[document.getElementById("m")]});</script>`,
      );
    case "application/vnd.react":
      return shell(
        `<script src="${CDN}/react/18.3.1/umd/react.production.min.js"></script><script src="${CDN}/react-dom/18.3.1/umd/react-dom.production.min.js"></script><script src="${CDN}/babel-standalone/7.26.4/babel.min.js"></script><script src="https://cdn.tailwindcss.com"></script>`,
        `<div id="root"></div><script>
const src=${embed(content)}
  .replace(/^\\s*import\\s+[^;]*?from\\s+['"]react['"];?\\s*$/gm,"")
  .replace(/export\\s+default\\s+function\\s+(\\w+)/,"window.__Artifact=function $1")
  .replace(/export\\s+default\\s+/,"window.__Artifact=");
const {useState,useEffect,useRef,useMemo,useCallback,useReducer,Fragment}=React;
try{eval(Babel.transform(src,{presets:["react"]}).code);ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(window.__Artifact));}
catch(e){document.getElementById("root").textContent="Could not render this component: "+e.message;}
</script>`,
      );
    case "text/markdown":
      return shell(`<script src="${CDN}/marked/12.0.2/marked.min.js"></script>`, `<div id="md"></div><script>document.getElementById("md").innerHTML=marked.parse(${embed(content)});</script>`);
    default:
      return shell("", `<pre style="white-space:pre-wrap"></pre><script>document.querySelector("pre").textContent=${embed(content)};</script>`);
  }
}
