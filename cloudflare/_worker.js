// Cloudflare Pages: stuurt het eigen domein van elke club naar de map van die club.
// app.pioniers.nl/...  ->  /pioniers/...      Op *.pages.dev werkt alles gewoon op pad (voor testen).
// Gemaakt door scripts/cloudflare.mjs (__DOMEINEN__ wordt daar ingevuld).
const DOMEINEN = __DOMEINEN__;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const dir = DOMEINEN[url.hostname] || DOMEINEN[url.hostname.replace(/^www\./, "")];
    if (!dir) return env.ASSETS.fetch(req);
    const inner = new URL(url); inner.pathname = `/${dir}${url.pathname}`;
    const res = await env.ASSETS.fetch(new Request(inner, req));
    const loc = res.headers.get("location");
    if (loc) { // doorverwijzingen van Pages (bv. index.html -> /) zonder de map teruggeven
      const l = new URL(loc, inner);
      if (l.pathname.startsWith(`/${dir}/`) || l.pathname === `/${dir}`) {
        const h = new Headers(res.headers); h.set("location", (l.pathname.slice(dir.length + 1) || "/") + l.search);
        return new Response(res.body, { status: res.status, headers: h });
      }
    }
    return res;
  }
};
