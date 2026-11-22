// Zet een nieuwe club klaar: maakt <code>/config.js en de iconen uit het logo. Daarna maakt scripts/build.mjs de app.
// Wordt gestart door de knop "Nieuwe club" in GitHub (Actions > Nieuwe club > Run workflow), maar kan ook met de hand:
//   node scripts/nieuwe-club.mjs --code hcr --naam "HCR" --plaats Rijssen --site https://www.hcr.nl \
//        --hoofdkleur "#0b3d2e" --accentkleur "#f2b705" --logo https://www.hcr.nl/logo.png [--sponsorkliks 1234] [--knbsb <club-id>] [--agenda <agenda-id>] [--domein app.hcr.nl]
// Nodig: ImageMagick (convert) voor de iconen.
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const arg = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k.startsWith("--")) arg[k.slice(2)] = (process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) ? process.argv[++i] : "";
}
const stop = msg => { console.error("Fout: " + msg); process.exit(1); };
const leeg = v => !v || !String(v).trim();

// ---------- Controleren ----------
const code = String(arg.code || "").trim().toLowerCase();
if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(code)) stop('code moet uit kleine letters, cijfers of streepjes bestaan (bijv. "hcr" of "pioniers"), minimaal 2 tekens.');
if (["app", "backend", "scripts", "cloudflare", "dist", "node_modules", "u55", "www"].includes(code)) stop(`de code "${code}" kan niet.`);
if (existsSync(`${code}/config.js`)) stop(`club "${code}" bestaat al. Pas ${code}/config.js aan in plaats van hem opnieuw te maken.`);
const naam = String(arg.naam || "").trim();
if (leeg(naam)) stop("geef de naam van de club op.");
const kleur = (v, standaard) => { v = String(v || "").trim(); if (!v) return standaard; if (!v.startsWith("#")) v = "#" + v; if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) stop(`"${v}" is geen kleurcode (gebruik bijv. #12104a).`); return v.toLowerCase(); };
const hoofd = kleur(arg.hoofdkleur, "#12104a");
const accent = kleur(arg.accentkleur, "#d8342e");
let site = String(arg.site || "").trim().replace(/\/+$/, "");
if (site && !/^https?:\/\//.test(site)) site = "https://" + site;
const plaats = String(arg.plaats || "").trim();
const sk = String(arg.sponsorkliks || "").trim();
if (sk && !/^\d+$/.test(sk)) stop("het SponsorKliks-clubnummer bestaat alleen uit cijfers.");
const knbsb = String(arg.knbsb || "").trim();
if (knbsb && !/^[0-9a-f-]{36}$/i.test(knbsb)) stop("het KNBSB-club-id ziet eruit als 0b84a685-dbef-4a60-b965-49b2a7df7f6d (laat leeg als je het niet weet).");
const agenda = String(arg.agenda || "").trim();
const domein = String(arg.domein || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
const kort = String(arg.kort || "").trim() || (naam.length <= 12 ? naam : naam.split(/\s+/).map(w => w[0]).join("").toUpperCase());

// ---------- Logo en iconen ----------
mkdirSync(`${code}/icons`, { recursive: true });
const bron = `${code}/icons/logo-bron`;
const logo = String(arg.logo || "").trim();
if (leeg(logo)) stop("geef een link naar het logo op (rechtsklik op het logo op de clubsite > Afbeeldingsadres kopiëren).");
if (/^https?:\/\//.test(logo)) {
  const r = await fetch(logo, { headers: { "User-Agent": "Mozilla/5.0 (clubapp)" } });
  if (!r.ok) stop(`het logo kon niet worden opgehaald (${r.status}). Controleer de link.`);
  writeFileSync(bron, Buffer.from(await r.arrayBuffer()));
} else if (existsSync(logo)) writeFileSync(bron, readFileSync(logo));
else stop("het logo is geen link en geen bestaand bestand.");
const im = (...a) => execFileSync("convert", a, { stdio: ["ignore", "inherit", "inherit"] });
try {
  // Logo voor de kopbalk (in een wit rondje): max. 400 px, transparante randen weg
  im(`${bron}[0]`, "-background", "none", "-trim", "+repage", "-resize", "400x400>", `${code}/icons/logo.png`);
  // App-iconen: logo op de hoofdkleur. Maskable heeft meer rand, omdat Android de hoeken eraf knipt.
  const icoon = (maat, deel, uit) => im("-size", `${maat}x${maat}`, `xc:${hoofd}`, "(", `${code}/icons/logo.png`, "-resize", `${Math.round(maat * deel)}x${Math.round(maat * deel)}`, ")", "-gravity", "center", "-composite", "-alpha", "off", uit);
  icoon(512, 0.8, `${code}/icons/icon-512.png`);
  icoon(192, 0.8, `${code}/icons/icon-192.png`);
  icoon(180, 0.8, `${code}/icons/apple-touch-icon.png`);
  icoon(512, 0.62, `${code}/icons/maskable-512.png`);
} catch (e) { stop("het logo kon niet worden omgezet. Is het een afbeelding (PNG, JPG, SVG of WebP)?"); }
execFileSync("rm", ["-f", bron]);

// ---------- config.js ----------
const j = v => JSON.stringify(v);
const jaar = new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear();
const config = `// Instellingen voor de clubapp van ${naam}. Gemaakt met de knop "Nieuwe club"; hierna gewoon in dit bestand aanpassen.
// Uitleg van alle onderdelen: zie u55/config.js (Uitsmijters '55) als voorbeeld.
window.CLUB = {
  id: ${j(code)},
  naam: ${j(naam)},
  kort: ${j(kort)}, // korte naam onder het app-icoon
  plaats: ${j(plaats)},
  sub: ${j(["Honk- en softbalvereniging", plaats].filter(Boolean).join(" "))},
  site: ${j(site)},
  domein: ${j(domein)}, // eigen webadres van de app (leeg = alleen via de map)
  logo: "icons/logo.png",
  kleuren: { hoofd: ${j(hoofd)}, accent: ${j(accent)} }, // hoofd = kopbalk (donker), accent = knoppen en lijnen

  // Webadres van de koppeling met de Google Sheet van de club (zie backend/LEESMIJ.md). Leeg = aanmelden en Overzicht staan nog uit.
  api: "",

  // Alleen voor de koppeling (backend/${code}/Code.gs)
  nieuwsFeed: "", // RSS-link van het nieuws op de clubsite (leeg = geen Nieuws)
  googleAgenda: ${j(agenda)}, // agenda-ID van de Google Agenda van de club (leeg = alleen de agenda hieronder)

  // KNBSB/FOYS: wedstrijden, uitslagen en standen. Leeg = de Wedstrijden-tab zegt dat het nog gekoppeld wordt.
  foys: ${knbsb ? `{ federationId: "d82c5610-66b2-4939-9897-8dac34becfc5", clubId: ${j(knbsb.toLowerCase())} }` : "null"},
  foysNaam: "", // naam van de club bij de KNBSB, als die anders is dan "naam" hierboven
  // Teamcodes van de KNBSB met een eigen naam en kleur (t-heren, t-u15, t-u12, t-bee), bijv. "MH-1": { naam: "Heren", klasse: "t-heren" }
  teams: {},

  socials: [
    // { naam: "Facebook", url: "https://www.facebook.com/...", icoon: "facebook" },
    // { naam: "Instagram", url: "https://www.instagram.com/.../", icoon: "instagram" },
  ],

  agendaTitel: ${j("Agenda " + jaar)},
  agendaDoorlopend: [],
  // Vaste activiteiten, bijv. { id: "nieuwjaar", datum: "${jaar}-01-09", d: "9", m: "jan", titel: "Nieuwjaarsborrel", tekst: "...", wie: "Alle leden", tags: ["Kantine"], aanmelden: true }
  agenda: [],

  // Blokken in de Club-tab: [titel, ondertitel, pad op de clubsite of volledige link, icoon]
  clubBlokken: [
    { kop: "Clubinfo", items: [
      ["Website", "Alles over de club", "/", "info"]${sk ? `,
      ["SponsorKliks", "Steun de club bij online shoppen", "https://www.sponsorkliks.com/products/shops.php?club=${sk}", "tas"]` : ""} ] }
  ],
${sk ? `
  sponsorkliks: {
    url: "https://www.sponsorkliks.com/products/shops.php?club=${sk}",
    uitleg: "",
    tekst: "Shop je online via SponsorKliks, dan krijgt de club een deel van het aankoopbedrag. Jij betaalt niets extra.",
    acties: [
      { van: "11-15", tot: "12-31", titel: "Sint- en kerstinkopen? Steun de club!", tekst: "Bestel je cadeaus via SponsorKliks. De club krijgt commissie, jij betaalt niets extra." }
    ]
  },
` : ""}
  privacy: "Alleen je voornaam als je je aanmeldt voor een activiteit of dienst. Die ziet alleen het bestuur. We verwijderen hem uiterlijk een maand na de activiteit. Geen adressen, telefoonnummers of geboortedata.",
  privacyUrl: ${j(site)}
};
`;
writeFileSync(`${code}/config.js`, config);
console.log(`Club "${naam}" klaargezet in de map ${code}/.`);
