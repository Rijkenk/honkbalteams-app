/**
 * Koppeling (backend) voor de clubapp, als Google Apps Script bij een Google Sheet.
 * Installatie: zie backend/LEESMIJ.md. Na een wijziging opnieuw implementeren (Implementeren > Implementaties beheren > nieuwe versie).
 *
 * Wat het doet:
 *  - bewaart aanmeldingen (alleen voornaam en aantal), activiteiten, vrijwilligersverzoeken en taken in tabbladen van deze Sheet;
 *  - haalt het clubnieuws (RSS van de clubsite) en de wedstrijden (openbare KNBSB/FOYS-gegevens) op voor de app;
 *  - ruimt elke nacht aanmeldingen op die meer dan een maand na de activiteit zijn.
 */

const CLUB = {
  naam: "Uitsmijters '55",
  nieuwsFeed: "https://www.uitsmijters55.nl/index.php/component/content/category/nieuws?Itemid=101&format=feed&type=rss&limit=30",
  site: "https://www.uitsmijters55.nl",
  foysBasis: "https://api.foys.io/competition/public-api/v1",
  foysFederatie: "d82c5610-66b2-4939-9897-8dac34becfc5",
  foysClub: "0b84a685-dbef-4a60-b965-49b2a7df7f6d"
};
const BEWAARDAGEN = 31; // aanmeldingen worden zoveel dagen na de activiteit verwijderd

const TABBLADEN = {
  Aanmeldingen: ["id", "tijd", "toestel", "soort", "ref", "naam", "aantal", "datum"],
  Activiteiten: ["id", "aangemaakt", "titel", "datum", "wie", "tekst", "waar", "aanmelden", "kaarten"],
  Verzoeken: ["id", "aangemaakt", "titel", "datum", "slots"],
  Taken: ["id", "aangemaakt", "groep", "titel", "wie", "deadline", "klaar"]
};

// ---------------- Eenmalige installatie ----------------
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABBLADEN).forEach(naam => {
    let sh = ss.getSheetByName(naam);
    if (!sh) sh = ss.insertSheet(naam);
    sh.getRange(1, 1, 1, TABBLADEN[naam].length).setValues([TABBLADEN[naam]]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.getRange("A:Z").setNumberFormat("@"); // alles als tekst, zodat datums niet omgezet worden
  });
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === "opruimen")) {
    ScriptApp.newTrigger("opruimen").timeBased().everyDays(1).atHour(3).create();
  }
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("BEHEERCODE")) {
    const code = String(Math.floor(100000 + Math.random() * 900000)) + "-" + Utilities.getUuid().slice(0, 4);
    props.setProperty("BEHEERCODE", code);
    Logger.log("Beheercode voor AC en bestuur: " + code + " (te wijzigen bij Projectinstellingen > Scripteigenschappen)");
  } else {
    Logger.log("Beheercode staat al ingesteld (zie Projectinstellingen > Scripteigenschappen).");
  }
}

// ---------------- Webadres: lezen ----------------
function doGet(e) {
  const a = (e && e.parameter && e.parameter.a) || "";
  try {
    if (a === "data") return antwoord(publiekeData());
    if (a === "nieuws") return antwoord(gecachet("nieuws", 1800, haalNieuws));
    if (a === "wedstrijden") return antwoord(gecachet("wedstrijden", 1800, haalWedstrijden));
    return antwoord({ ok: true, app: CLUB.naam });
  } catch (err) {
    console.error(err);
    return antwoord({ ok: false, fout: "server" });
  }
}

// ---------------- Webadres: schrijven ----------------
function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return antwoord({ ok: false, fout: "invoer" }); }
  try {
    if (b.a === "mijn") return antwoord(mijnAanmeldingen(b));
    if (b.a === "aanmelden") return metSlot(() => aanmelden(b));
    if (b.a === "afmelden") return metSlot(() => afmelden(b));
    if (b.a === "beheer") return beheer(b);
    return antwoord({ ok: false, fout: "onbekend" });
  } catch (err) {
    console.error(err);
    return antwoord({ ok: false, fout: err.code || "server" });
  }
}

function publiekeData() {
  const vandaag = vandaagIso();
  const bezet = {};
  rijen("Aanmeldingen").forEach(r => { if (r.soort === "dienst") bezet[r.ref] = true; });
  const activiteiten = rijen("Activiteiten").filter(r => r.datum >= vandaag).map(r => ({
    id: r.id, titel: r.titel, datum: r.datum, wie: r.wie, tekst: r.tekst, waar: r.waar, aanmelden: r.aanmelden === "ja", kaarten: r.kaarten || ""
  }));
  const verzoeken = rijen("Verzoeken").filter(r => !r.datum || r.datum >= vandaag).sort((x, y) => String(x.datum).localeCompare(String(y.datum))).map(r => ({
    id: r.id, titel: r.titel, datum: r.datum,
    slots: jsonOf(r.slots, []).map((taak, j) => ({ taak: taak, bezet: !!bezet[r.id + "-" + j] }))
  }));
  return { ok: true, activiteiten: activiteiten, verzoeken: verzoeken };
}

function mijnAanmeldingen(b) {
  const t = toestelHash(b.toestel);
  const uit = { ok: true, activiteiten: {}, diensten: {} };
  rijen("Aanmeldingen").filter(r => r.toestel === t).forEach(r => {
    if (r.soort === "activiteit") uit.activiteiten[r.ref] = { naam: r.naam, aantal: Number(r.aantal) || 1 };
    else uit.diensten[r.ref] = { naam: r.naam };
  });
  return uit;
}

function aanmelden(b) {
  const t = toestelHash(b.toestel);
  const soort = b.soort === "dienst" ? "dienst" : "activiteit";
  const ref = tekst(b.ref, 80);
  const naam = tekst(b.naam, 40);
  if (!/^[\w-]{1,80}$/.test(ref) || !naam) throw fout("invoer");
  const aantal = Math.min(6, Math.max(1, parseInt(b.aantal, 10) || 1));
  let datum = /^\d{4}-\d{2}-\d{2}$/.test(b.datum || "") ? b.datum : "";
  const alle = rijen("Aanmeldingen");
  if (alle.filter(r => r.toestel === t).length >= 60) throw fout("teveel");
  if (soort === "dienst") {
    const vid = ref.slice(0, ref.lastIndexOf("-")), j = Number(ref.slice(ref.lastIndexOf("-") + 1));
    const v = rijen("Verzoeken").find(r => r.id === vid);
    if (!v || !(j >= 0 && j < jsonOf(v.slots, []).length)) throw fout("onbekend");
    if (alle.some(r => r.soort === "dienst" && r.ref === ref && r.toestel !== t)) throw fout("bezet");
    datum = v.datum || datum;
  }
  verwijderRijen("Aanmeldingen", r => r.toestel === t && r.soort === soort && r.ref === ref);
  voegToe("Aanmeldingen", { id: Utilities.getUuid(), tijd: new Date().toISOString(), toestel: t, soort: soort, ref: ref, naam: naam, aantal: soort === "dienst" ? 1 : aantal, datum: datum });
  return { ok: true };
}

function afmelden(b) {
  const t = toestelHash(b.toestel);
  const soort = b.soort === "dienst" ? "dienst" : "activiteit";
  const ref = tekst(b.ref, 80);
  verwijderRijen("Aanmeldingen", r => r.toestel === t && r.soort === soort && r.ref === ref);
  return { ok: true };
}

// ---------------- Beheer: alleen met de beheercode ----------------
function beheer(b) {
  const cache = CacheService.getScriptCache();
  const pogingen = Number(cache.get("foute-pogingen") || 0);
  if (pogingen >= 15) return antwoord({ ok: false, fout: "geblokkeerd" });
  const code = PropertiesService.getScriptProperties().getProperty("BEHEERCODE");
  if (!code || String(b.code || "") !== code) {
    cache.put("foute-pogingen", String(pogingen + 1), 600);
    Utilities.sleep(800);
    return antwoord({ ok: false, fout: "code" });
  }
  const actie = b.actie;
  if (actie === "check") return antwoord({ ok: true });
  if (actie === "overzicht") {
    return antwoord({
      ok: true,
      aanmeldingen: rijen("Aanmeldingen").map(r => ({ soort: r.soort, ref: r.ref, naam: r.naam, aantal: Number(r.aantal) || 1 })),
      taken: rijen("Taken").map(r => ({ id: r.id, groep: r.groep === "bestuur" ? "bestuur" : "ac", titel: r.titel, wie: r.wie, deadline: r.deadline, klaar: r.klaar === "ja" }))
    });
  }
  return metSlot(() => {
    const id = tekst(b.id, 60);
    if (actie === "taakNieuw") {
      voegToe("Taken", { id: Utilities.getUuid(), aangemaakt: new Date().toISOString(), groep: b.groep === "bestuur" ? "bestuur" : "ac", titel: tekst(b.titel, 120), wie: tekst(b.wie, 40), deadline: isoOfLeeg(b.deadline), klaar: "nee" });
    } else if (actie === "taakKlaar") {
      wijzigRij("Taken", id, { klaar: b.klaar ? "ja" : "nee" });
    } else if (actie === "taakWeg") {
      verwijderRijen("Taken", r => r.id === id);
    } else if (actie === "activiteitNieuw") {
      const datum = isoOfLeeg(b.datum); if (!datum || !tekst(b.titel, 80)) throw fout("invoer");
      const kaarten = /^https:\/\//.test(b.kaarten || "") ? tekst(b.kaarten, 300) : "";
      voegToe("Activiteiten", { id: "a" + Utilities.getUuid().slice(0, 8), aangemaakt: new Date().toISOString(), titel: tekst(b.titel, 80), datum: datum,
        wie: ["Iedereen", "Leden", "Jeugd", "Vrijwilligers"].indexOf(b.wie) >= 0 ? b.wie : "Iedereen", tekst: tekst(b.tekst, 300), waar: tekst(b.waar, 40),
        aanmelden: b.aanmelden && !kaarten ? "ja" : "nee", kaarten: kaarten });
    } else if (actie === "activiteitWeg") {
      verwijderRijen("Activiteiten", r => r.id === id);
      verwijderRijen("Aanmeldingen", r => r.soort === "activiteit" && r.ref === id);
    } else if (actie === "verzoekNieuw") {
      const slots = (Array.isArray(b.slots) ? b.slots : []).map(s => tekst(s, 80)).filter(Boolean).slice(0, 20);
      if (!tekst(b.titel, 120) || !slots.length) throw fout("invoer");
      voegToe("Verzoeken", { id: "v" + Utilities.getUuid().slice(0, 8), aangemaakt: new Date().toISOString(), titel: tekst(b.titel, 120), datum: isoOfLeeg(b.datum), slots: JSON.stringify(slots) });
    } else if (actie === "verzoekWeg") {
      verwijderRijen("Verzoeken", r => r.id === id);
      verwijderRijen("Aanmeldingen", r => r.soort === "dienst" && r.ref.indexOf(id + "-") === 0);
    } else {
      throw fout("onbekend");
    }
    return { ok: true };
  });
}

// ---------------- Nachtelijke opruiming (AVG) ----------------
function opruimen() {
  const grens = new Date(); grens.setDate(grens.getDate() - BEWAARDAGEN);
  const g = Utilities.formatDate(grens, "Europe/Amsterdam", "yyyy-MM-dd");
  const jaarGeleden = new Date(); jaarGeleden.setFullYear(jaarGeleden.getFullYear() - 1);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    verwijderRijen("Aanmeldingen", r => (r.datum && r.datum < g) || (!r.datum && new Date(r.tijd) < jaarGeleden));
    const oudeVerzoeken = rijen("Verzoeken").filter(r => r.datum && r.datum < g).map(r => r.id);
    verwijderRijen("Verzoeken", r => oudeVerzoeken.indexOf(r.id) >= 0);
    verwijderRijen("Aanmeldingen", r => r.soort === "dienst" && oudeVerzoeken.some(id => r.ref.indexOf(id + "-") === 0));
    verwijderRijen("Activiteiten", r => r.datum && r.datum < g);
    const halfJaar = new Date(); halfJaar.setMonth(halfJaar.getMonth() - 6);
    verwijderRijen("Taken", r => r.klaar === "ja" && new Date(r.aangemaakt) < halfJaar);
  } finally { lock.releaseLock(); }
}

// ---------------- Nieuws van de clubsite ----------------
function haalNieuws() {
  const r = UrlFetchApp.fetch(CLUB.nieuwsFeed, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw fout("bron");
  const doc = XmlService.parse(r.getContentText("UTF-8"));
  const items = doc.getRootElement().getChild("channel").getChildren("item");
  const jaar = new Date().getFullYear();
  const uit = items.map(it => {
    const g = k => (it.getChild(k) ? it.getChild(k).getText() : "");
    const datum = new Date(g("pubDate"));
    const html = g("description");
    const img = (html.match(/<img[^>]+src="([^"]+)"/i) || [])[1] || "";
    let t = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "’").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
    if (t.length > 420) t = t.slice(0, 400).replace(/\s\S*$/, "") + "…";
    return { titel: g("title").trim(), datum: isNaN(datum) ? "" : datum.toISOString(), tekst: t, img: img ? (img.indexOf("http") === 0 ? img : CLUB.site + "/" + img.replace(/^\//, "")) : "", url: g("link") };
  }).filter(n => n.datum && new Date(n.datum).getFullYear() === jaar).sort((a, b) => b.datum.localeCompare(a.datum));
  return { ok: true, items: uit };
}

// ---------------- Wedstrijden (KNBSB / FOYS) ----------------
function foys(pad) {
  const r = UrlFetchApp.fetch(CLUB.foysBasis + pad, { headers: { "X-FederationID": CLUB.foysFederatie }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw fout("bron");
  return JSON.parse(r.getContentText());
}
const lijst = j => Array.isArray(j) ? j : (j && j.items) || [];

function compacteWedstrijd(m) {
  return {
    id: m.id, d: String(m.date || "").slice(0, 10), t: String(m.startTime || "").slice(0, 5), s: m.status,
    h: (m.homeOrganisation && m.homeOrganisation.name) || "", ht: m.homeTeamName || "",
    a: (m.awayOrganisation && m.awayOrganisation.name) || "", at: m.awayTeamName || "",
    hs: m.homeScore, as: m.awayScore,
    c: String((m.competition && m.competition.name) || "").replace(/ - Reguliere competitie$/, ""), loc: m.accommodationName || ""
  };
}

function haalWedstrijden() {
  const vandaag = vandaagIso();
  const club = encodeURIComponent(CLUB.foysClub);
  const programma = lijst(foys("/matches?organisationId=" + club + "&startDate=" + vandaag + "&skipCount=0&maxResultCount=40&sorting=" + encodeURIComponent("date asc, startTime asc"))).map(compacteWedstrijd);
  const uitslagen = lijst(foys("/matches?organisationId=" + club + "&endDate=" + vandaag + "&skipCount=0&maxResultCount=30&sorting=" + encodeURIComponent("date desc, startTime desc"))).map(compacteWedstrijd)
    .filter(m => m.s === "Final" || m.s === "Cancelled" || m.d < vandaag);
  const standen = {};
  lijst(foys("/organisations/" + club + "/teams")).forEach(team => {
    try {
      const pools = lijst(foys("/pools?teamGuid=" + encodeURIComponent(team.guid) + "&maxResultCount=100"));
      let beste = null;
      pools.slice(0, 4).forEach(p => {
        const cId = p.competitionId || (p.competition && p.competition.id);
        const pId = p.poolId || p.id;
        if (!cId || !pId) return;
        const rows = lijst(foys("/competitions/" + cId + "/pools/" + pId + "/teams"));
        if (!rows.some(r => r.teamGuid === team.guid)) return;
        const gespeeld = rows.reduce((n, r) => n + (Number(r.gamesPlayed || r.matchesCount) || 0), 0);
        if (!beste || gespeeld > beste.gespeeld) beste = { gespeeld: gespeeld, rows: rows, titel: String(p.competitionName || (p.competition && p.competition.name) || p.name || "").replace(/ - Reguliere competitie$/, "") };
      });
      if (beste && beste.rows.length) {
        const poule = beste.rows[0].poolName || "";
        standen[team.name] = {
          titel: [beste.titel, poule].filter(Boolean).join(", "),
          r: beste.rows.sort((a, b) => a.position - b.position).map(r => ({ p: r.position, n: (r.clubName || "") + " " + (r.teamName || ""), u: r.teamGuid === team.guid, g: r.gamesPlayed || r.matchesCount || 0, w: r.wonCount || 0, l: r.lostCount || 0, pt: r.points || 0 }))
        };
      }
    } catch (err) { console.warn("Stand " + team.name + ": " + err); }
  });
  return { ok: true, bijgewerkt: new Date().toISOString(), programma: programma, uitslagen: uitslagen, standen: standen };
}

// ---------------- Hulpfuncties ----------------
function antwoord(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fout(code) { const e = new Error(code); e.code = code; return e; }
function tekst(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max); }
function isoOfLeeg(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || "") ? s : ""; }
function vandaagIso() { return Utilities.formatDate(new Date(), "Europe/Amsterdam", "yyyy-MM-dd"); }
function jsonOf(s, standaard) { try { return JSON.parse(s); } catch (e) { return standaard; } }
function toestelHash(t) {
  const s = tekst(t, 100); if (s.length < 10) throw fout("invoer");
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "u55:" + s)).slice(0, 32);
}
function metSlot(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return antwoord({ ok: false, fout: "druk" });
  try { return antwoord(fn()); } catch (err) { return antwoord({ ok: false, fout: err.code || "server" }); } finally { lock.releaseLock(); }
}
function gecachet(sleutel, seconden, fn) {
  const cache = CacheService.getScriptCache();
  const c = cache.get(sleutel);
  if (c) return JSON.parse(c);
  const v = fn();
  try { cache.put(sleutel, JSON.stringify(v), seconden); } catch (e) { /* te groot voor de cache: dan zonder */ }
  return v;
}
function blad(naam) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(naam);
  if (!sh) throw fout("setup");
  return sh;
}
function rijen(naam) {
  const sh = blad(naam); const kop = TABBLADEN[naam];
  const n = sh.getLastRow() - 1; if (n < 1) return [];
  return sh.getRange(2, 1, n, kop.length).getDisplayValues().map(v => { const o = {}; kop.forEach((k, i) => o[k] = v[i]); return o; }).filter(o => o.id);
}
function voegToe(naam, o) { blad(naam).appendRow(TABBLADEN[naam].map(k => o[k] === undefined ? "" : String(o[k]))); }
function verwijderRijen(naam, voorwaarde) {
  const sh = blad(naam); const kop = TABBLADEN[naam];
  const n = sh.getLastRow() - 1; if (n < 1) return;
  const vals = sh.getRange(2, 1, n, kop.length).getDisplayValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    const o = {}; kop.forEach((k, j) => o[k] = vals[i][j]);
    if (o.id && voorwaarde(o)) sh.deleteRow(i + 2);
  }
}
function wijzigRij(naam, id, velden) {
  const sh = blad(naam); const kop = TABBLADEN[naam];
  const n = sh.getLastRow() - 1; if (n < 1) return;
  const ids = sh.getRange(2, 1, n, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) if (ids[i][0] === id) {
    Object.keys(velden).forEach(k => sh.getRange(i + 2, kop.indexOf(k) + 1).setValue(String(velden[k])));
    return;
  }
}
