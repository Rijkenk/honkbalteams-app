// Zet het webadres van de Apps Script-koppeling in <code>/config.js (veld api).
// Gebruik: node scripts/koppel-club.mjs <code> <https://script.google.com/macros/s/.../exec>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const [code = "", api = ""] = process.argv.slice(2).map(s => s.trim());
const stop = msg => { console.error("Fout: " + msg); process.exit(1); };
const pad = `${code.toLowerCase()}/config.js`;
if (!/^[a-z0-9-]+$/i.test(code) || !existsSync(pad)) stop(`club "${code}" bestaat niet (er is geen ${pad}).`);
if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(api)) stop("de URL moet beginnen met https://script.google.com/macros/s/ en eindigen op /exec.");
const s = readFileSync(pad, "utf8");
const nieuw = s.replace(/^(\s*api:\s*)"[^"]*"/m, (m, kop) => `${kop}"${api}"`);
if (nieuw === s && !s.includes(`"${api}"`)) stop(`in ${pad} staat geen regel api: "..."`);
writeFileSync(pad, nieuw);
console.log(`Koppeling ingesteld in ${pad}.`);
