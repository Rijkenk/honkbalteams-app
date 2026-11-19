// Maakt voor elke club een complete app-map uit de gedeelde app (map app/) en de instellingen van de club (<club>/config.js).
// Gebruik: node scripts/build.mjs   (draait ook vanzelf in GitHub Actions na elke wijziging)
//
// Per club is alleen dit eigen werk:   <club>/config.js, <club>/icons/ (logo en app-iconen), eventueel <club>/data/
// Dit maakt het script (niet met de hand aanpassen):
//   <club>/index.html, app.js, style.css, sw.js, manifest.webmanifest   (de app)
//   backend/<club>/Code.gs                                               (de koppeling met de Google Sheet van de club)
//   index.html in de hoofdmap                                            (lijst van clubs + eigen webadressen)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fill = (s, vars) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
const js = v => JSON.stringify(v ?? "");

// ---------- Kleuren ----------
const rgb = h => { h = String(h).replace("#", ""); if (h.length === 3) h = [...h].map(c => c + c).join(""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const hex = a => "#" + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const lum = a => { const [r, g, b] = a.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const mix = (h, met, f) => hex(rgb(h).map((v, i) => v * f + rgb(met)[i] * (1 - f))); // f = deel van h
const donkerTot = (h, max) => { let a = rgb(h); for (let i = 0; i < 30 && lum(a) > max; i++) a = a.map(v => v * 0.9); return hex(a); };
const lichtTot = (h, min) => { let a = rgb(h); for (let i = 0; i < 30 && lum(a) < min; i++) a = a.map(v => 255 - (255 - v) * 0.88); return hex(a); };

// Zonder eigen kleuren gebruikt de app de kleuren uit app/style.css (die van Uitsmijters '55).
function themaCss(k) {
  if (!k || (!k.hoofd && !k.accent)) return "";
  const H = donkerTot(k.hoofd || "#12104a", 0.06); // kopbalk moet donker zijn: daar staat witte tekst op
  const A = k.accent || "#d8342e";
  const opA = lum(rgb(A)) > 0.4 ? "#14141a" : "#ffffff";
  const ink = donkerTot(mix(H, "#000000", 0.85), 0.02);
  const dag = [`--navy:${H}`, `--red:${A}`, `--on-red:${opA}`, `--accent:${donkerTot(A, 0.2)}`, `--t-heren:${donkerTot(A, 0.2)}`,
    `--ink:${ink}`, `--muted:${mix(ink, "#8a8a95", 0.55)}`, `--bg:${mix(H, "#ffffff", 0.06)}`, `--line:${mix(H, "#ffffff", 0.15)}`];
  const AL = lichtTot(A, 0.18);
  const nacht = [`--navy:${H}`, `--red:${AL}`, `--on-red:${lum(rgb(AL)) > 0.4 ? "#14141a" : "#ffffff"}`, `--accent:${lichtTot(A, 0.32)}`, `--t-heren:${lichtTot(A, 0.32)}`,
    `--bg:${mix(H, "#000000", 0.6)}`, `--surface:${mix(H, "#000000", 0.85)}`, `--line:${mix(H, "#ffffff", 0.8)}`];
  return `\n<style>/* clubkleuren uit config.js */
:root{${dag.join(";")}}
@media (prefers-color-scheme: dark) { :root:not([data-theme=light]){${nacht.join(";")}} }
:root[data-theme=dark]{${nacht.join(";")}}</style>`;
}

// ---------- Afmetingen van het logo (PNG of JPEG), voor de juiste hoogte in de kopbalk ----------
function afmeting(pad) {
  const b = readFileSync(pad);
  if (b[0] === 0x89 && b[1] === 0x50) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  return null;
}

// ---------- Clubs zoeken: elke map met een config.js die window.CLUB instelt ----------
function leesConfig(dir) {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(`${dir}/config.js`, "utf8"), ctx, { filename: `${dir}/config.js` });
  const c = ctx.window.CLUB;
  if (!c || !c.id) throw new Error(`${dir}/config.js: window.CLUB of id ontbreekt`);
  if (c.id !== dir) throw new Error(`${dir}/config.js: id moet "${dir}" zijn (nu "${c.id}")`);
  return c;
}
const clubs = readdirSync(".").filter(d => !d.startsWith(".") && !["app", "backend", "scripts", "node_modules"].includes(d)
  && statSync(d).isDirectory() && existsSync(`${d}/config.js`)).sort().map(d => ({ dir: d, c: leesConfig(d) }));

const tpl = readFileSync("app/index.html", "utf8");
const swTpl = readFileSync("app/sw.js", "utf8");
const appJs = readFileSync("app/app.js", "utf8");
const styleCss = readFileSync("app/style.css", "utf8");
const gs = readFileSync("backend/Code.gs", "utf8");
const KOP = "Gemaakt door scripts/build.mjs uit app/";

for (const { dir, c } of clubs) {
  const logo = c.logo || "icons/logo.png";
  if (!existsSync(`${dir}/${logo}`)) throw new Error(`${dir}: logo ${logo} ontbreekt`);
  const maat = afmeting(`${dir}/${logo}`);
  const kleur = (c.kleuren && c.kleuren.hoofd) ? donkerTot(c.kleuren.hoofd, 0.06) : "#12104a";
  const kort = c.kort || c.naam;
  const html = fill(tpl, {
    naam: esc(c.naam), kort: esc(kort), logo: esc(logo), themaKleur: kleur, themaCss: themaCss(c.kleuren),
    logoH: maat ? Math.round(76 * maat[1] / maat[0]) : 76,
    beschrijving: esc(c.beschrijving || `De clubapp van honk- en softbalvereniging ${c.naam}${c.plaats ? " uit " + c.plaats : ""}: agenda, wedstrijden, vrijwilligersdiensten en nieuws.`)
  });
  writeFileSync(`${dir}/index.html`, html);
  writeFileSync(`${dir}/app.js`, `// ${KOP}app.js (niet hier aanpassen)\n` + appJs);
  writeFileSync(`${dir}/style.css`, `/* ${KOP}style.css (niet hier aanpassen) */\n` + styleCss);
  writeFileSync(`${dir}/manifest.webmanifest`, JSON.stringify({
    name: `${c.naam} clubapp`, short_name: kort,
    description: `Agenda, wedstrijden, vrijwilligersdiensten en nieuws van ${c.naam}.`,
    lang: "nl", start_url: "./", scope: "./", display: "standalone", background_color: kleur, theme_color: kleur,
    icons: [
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  }, null, 2) + "\n");
  // Service worker: versie = vingerafdruk van alles wat de club krijgt, dus bij elke wijziging vanzelf een nieuwe versie
  const bestanden = ["./", "index.html", "style.css", "config.js", "app.js", "manifest.webmanifest", logo, "icons/icon-192.png"];
  if (existsSync(`${dir}/data/wedstrijden-voorbeeld.json`)) bestanden.push("data/wedstrijden-voorbeeld.json");
  const vinger = createHash("sha1").update(html + appJs + styleCss + readFileSync(`${dir}/config.js`)).digest("hex").slice(0, 8);
  writeFileSync(`${dir}/sw.js`, fill(swTpl, { id: c.id, versie: `${c.id}-${vinger}`, bestanden: JSON.stringify(bestanden) }));

  // Koppeling (Apps Script) met de gegevens van deze club
  const blok = `// CLUB-BEGIN (gemaakt door scripts/build.mjs uit ${dir}/config.js)
const CLUB = {
  naam: ${js(c.naam)},
  nieuwsFeed: ${js(c.nieuwsFeed)},
  site: ${js(c.site)},
  foysBasis: "https://api.foys.io/competition/public-api/v1",
  foysFederatie: ${js((c.foys && c.foys.federationId) || "d82c5610-66b2-4939-9897-8dac34becfc5")},
  foysClub: ${js(c.foys && c.foys.clubId)},
  agenda: ${js(c.googleAgenda)} // Google Agenda van de club (Scripteigenschap AGENDA_ID gaat voor)
};
// CLUB-EINDE`;
  const code = gs.replace(/\/\/ CLUB-BEGIN[\s\S]*?\/\/ CLUB-EINDE/, () => blok);
  if (code === gs) throw new Error("backend/Code.gs: CLUB-BEGIN/CLUB-EINDE niet gevonden");
  mkdirSync(`backend/${dir}`, { recursive: true });
  writeFileSync(`backend/${dir}/Code.gs`, code);
  console.log(`${dir}: ${c.naam}${c.domein ? " (" + c.domein + ")" : ""}${c.api ? "" : " - nog niet gekoppeld aan een Google Sheet"}`);
}

// ---------- Startpagina in de hoofdmap: eigen webadressen doorsturen + lijst van clubs ----------
const domeinen = Object.fromEntries(clubs.filter(k => k.c.domein).map(k => [k.c.domein, k.dir + "/"]));
writeFileSync("index.html", `<!doctype html>
<!-- Gemaakt door scripts/build.mjs (niet hier aanpassen) -->
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Honkbalteams-app</title>
<script>
  // Op het eigen adres van een club meteen naar de app van die club
  const clubs = ${JSON.stringify(domeinen)};
  if (clubs[location.hostname]) location.replace(clubs[location.hostname]);
</script>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 32px 16px; background: #f1f2f7; color: #1a1652; }
  main { max-width: 460px; margin: 0 auto; }
  a { display: block; margin-bottom: 10px; padding: 16px; background: #fff; border: 1px solid #dcdde8; border-left: 6px solid #d8342e; border-radius: 12px; color: inherit; text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
<main>
  <h1>Honkbalteams-app</h1>
  <p>Clubapps voor honk- en softbalverenigingen.</p>
${clubs.map(k => `  <a href="${esc(k.dir)}/"${k.c.kleuren && k.c.kleuren.accent ? ` style="border-left-color:${esc(k.c.kleuren.accent)}"` : ""}>${esc(k.c.naam)}${k.c.plaats ? ", " + esc(k.c.plaats) : ""}</a>`).join("\n")}
</main>
</body>
</html>
`);
console.log(`${clubs.length} club(s) gebouwd.`);
