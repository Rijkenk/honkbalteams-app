// Zet de apps van clubs met een eigen domein online op Cloudflare Pages (zoals bij de poolteams).
// Draait in GitHub Actions na build.mjs. Zonder de secrets CLOUDFLARE_API_TOKEN en CLOUDFLARE_ACCOUNT_ID wordt deze stap overgeslagen.
//
// Elke club met "domein" in config.js (bijv. app.pioniers.nl) wordt aan het Pages-project gekoppeld.
// De club zet zelf bij haar domein één DNS-record:  CNAME  app  ->  clubapps.pages.dev   (de Action toont het precies).
// Het domein in het bestand CNAME (app.uitsmijters55.nl) blijft op GitHub Pages en wordt hier overgeslagen.
import { readFileSync, writeFileSync, rmSync, cpSync, existsSync, appendFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

const PROJECT = "clubapps", WRANGLER = "wrangler@4.20.0";
const token = process.env.CLOUDFLARE_API_TOKEN, account = process.env.CLOUDFLARE_ACCOUNT_ID;
const samenvatting = s => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, s + "\n"); };
if (!token || !account) { console.log("Geen Cloudflare-secrets ingesteld, overslaan."); process.exit(0); }

// 1. Clubs met een eigen domein (niet het GitHub Pages-domein)
const githubDomein = existsSync("CNAME") ? readFileSync("CNAME", "utf8").trim().toLowerCase() : "";
const clubs = readdirSync(".").filter(d => !d.startsWith(".") && !["app", "backend", "scripts", "cloudflare", "dist", "node_modules"].includes(d)
  && statSync(d).isDirectory() && existsSync(`${d}/config.js`)).map(code => {
  const ctx = { window: {} }; vm.runInNewContext(readFileSync(`${code}/config.js`, "utf8"), ctx);
  return { code, naam: ctx.window.CLUB.naam, domein: String(ctx.window.CLUB.domein || "").toLowerCase() };
}).filter(k => k.domein && k.domein !== githubDomein);
if (!clubs.length) { console.log("Geen clubs met een eigen domein buiten GitHub Pages, overslaan."); process.exit(0); }

const api = async (path, opts = {}) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) }
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.success !== false, status: r.status, result: j.result, errors: j.errors };
};

// 2. Site samenstellen: alleen de mappen van deze clubs, plus de worker die domeinen naar mappen stuurt
rmSync("dist", { recursive: true, force: true });
for (const k of clubs) cpSync(k.code, `dist/${k.code}`, { recursive: true });
writeFileSync("dist/index.html", "<!doctype html><meta charset=utf-8><title>Clubapps</title><p>Clubapps voor honk- en softbalverenigingen.</p>\n");
writeFileSync("dist/_worker.js", readFileSync("cloudflare/_worker.js", "utf8")
  .replace("__DOMEINEN__", JSON.stringify(Object.fromEntries(clubs.map(k => [k.domein, k.code])))));

// 3. Pages-project (eenmalig aanmaken)
let p = await api(`/accounts/${account}/pages/projects/${PROJECT}`);
if (!p.ok) {
  p = await api(`/accounts/${account}/pages/projects`, { method: "POST", body: JSON.stringify({ name: PROJECT, production_branch: "main" }) });
  if (!p.ok) throw new Error("Pages-project aanmaken mislukt: " + JSON.stringify(p.errors));
  console.log("Pages-project aangemaakt");
}
const pagesHost = p.result.subdomain; // bv. clubapps.pages.dev

// 4. Uploaden
execFileSync("npx", ["--yes", WRANGLER, "pages", "deploy", "dist", "--project-name", PROJECT, "--branch", "main", "--commit-dirty=true"],
  { stdio: "inherit", env: { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } });

// 5. Domeinen koppelen en tonen welk DNS-record elke club moet maken
const gekoppeld = new Map(((await api(`/accounts/${account}/pages/projects/${PROJECT}/domains`)).result || []).map(d => [d.name, d]));
samenvatting("## Eigen domeinen van clubs\n\n| Club | Adres | DNS-record bij de club | Status |\n| --- | --- | --- | --- |");
for (const k of clubs) {
  let d = gekoppeld.get(k.domein);
  if (!d) {
    const r = await api(`/accounts/${account}/pages/projects/${PROJECT}/domains`, { method: "POST", body: JSON.stringify({ name: k.domein }) });
    console.log(r.ok ? `Domein ${k.domein} gekoppeld` : `Domein ${k.domein} mislukt: ${JSON.stringify(r.errors)}`);
    d = r.result || { status: "mislukt" };
  }
  const naam = k.domein.split(".").length > 2 ? k.domein.split(".")[0] : "@";
  const status = d.status === "active" ? "werkt" : d.status === "mislukt" ? "koppelen mislukt" : "wacht op het DNS-record";
  samenvatting(`| ${k.naam} | https://${k.domein} | CNAME \`${naam}\` naar \`${pagesHost}\` | ${status} |`);
  console.log(`${k.naam}: https://${k.domein} -> CNAME ${naam} naar ${pagesHost} (${status})`);
}
console.log(`Ook te testen op https://${pagesHost}/<code>/`);
