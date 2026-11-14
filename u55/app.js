// Clubapp: één bestand met alle logica. Instellingen per club staan in config.js.
"use strict";
const C = window.CLUB;
const PREFIX = C.id + "-";
const main = document.getElementById("main");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const DAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const vandaagIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// ---------- Lokale opslag (veilig: werkt ook als de browser het blokkeert) ----------
const lees = (k, standaard) => { try { const v = localStorage.getItem(PREFIX + k); return v === null ? standaard : JSON.parse(v); } catch (e) { return standaard; } };
const schrijf = (k, v) => { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) {} };
const wis = k => { try { localStorage.removeItem(PREFIX + k); } catch (e) {} };

let toestel = lees("toestel", "");
if (!toestel) { toestel = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()) ; schrijf("toestel", toestel); }

// ---------- Toestand ----------
let mijn = lees("mijn", { activiteiten: {}, diensten: {} });
let laatsteNaam = lees("naam", "");
let extraActiviteiten = lees("cache-activiteiten", []);
let verzoeken = lees("cache-verzoeken", []);
let nieuws = lees("cache-nieuws", []);
let wedstrijden = lees("cache-wedstrijden", null);
let beheercode = lees("beheer", "");
let beheer = null; // { aanmeldingen: [...], taken: [...] } zodra ingelogd
let huidigeTab = "agenda", teamFilter = "alle", verwijderKlaar = null;
let status = { data: "laden", nieuws: "laden", wedstrijden: "laden" };

// ---------- Koppeling met de Google Apps Script-backend ----------
async function api(params, body) {
  if (!C.api) throw new Error("geen koppeling");
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 20000);
  try {
    const url = C.api + (C.api.includes("?") ? "&" : "?") + new URLSearchParams(params || {}).toString();
    const r = await fetch(url, body ? { method: "POST", body: JSON.stringify(body), signal: ctrl.signal, redirect: "follow" } : { signal: ctrl.signal, redirect: "follow" });
    const j = await r.json();
    if (!j.ok) throw Object.assign(new Error(j.fout || "fout"), { code: j.fout });
    return j;
  } finally { clearTimeout(tm); }
}

// ---------- Hulpjes ----------
function toast(t, fout) {
  const el = document.createElement("div"); el.className = "toast"; el.textContent = t;
  if (fout) el.style.background = "var(--red)";
  el.setAttribute("role", "status");
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}
const naamLabel = r => r.aantal > 1 ? `${r.naam} +${r.aantal - 1}` : r.naam;
const datumKort = s => { const d = new Date(s + "T12:00:00"); return isNaN(d) ? "" : `${d.getDate()} ${MAANDEN[d.getMonth()]}`; };
const team = code => C.teams[code] || { naam: code, klasse: "" };
const bezigMetTypen = () => !!document.activeElement?.closest?.("form");
const herteken = (...tabs) => { if (tabs.includes(huidigeTab) && !bezigMetTypen() && !document.getElementById("aanmeldform")) show(huidigeTab, true); };

function activiteiten() {
  const vandaag = vandaagIso();
  const eigen = extraActiviteiten.map(v => {
    const [j, mm, dd] = String(v.datum).split("-").map(Number);
    const a = { id: v.id, datum: v.datum, d: String(dd || ""), m: MAANDEN[mm - 1] || "", titel: v.titel, tekst: v.tekst || "", wie: v.wie || "Iedereen", tags: v.waar ? [v.waar] : [], aanmelden: !!v.aanmelden && !v.kaarten, eigen: true };
    if (v.kaarten) a.kaarten = v.kaarten;
    if (j && j !== new Date().getFullYear() && j !== 2027) a.tags.unshift(String(j));
    return a;
  });
  return [...C.agenda, ...eigen].filter(a => !a.datum || a.datum >= vandaag).sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
}

// ---------- Wedstrijden ----------
const U = C.naam;
function wedstrijdKaart(m) {
  const thuis = m.h === U; const eigen = thuis ? m.ht : m.at; const tm = team(eigen);
  const dt = new Date(m.d + "T12:00:00");
  let res = "";
  if (m.s === "Cancelled") res = '<span class="badge res-x">Afgelast</span>';
  else if (m.hs !== null && m.hs !== undefined && m.s === "Final") { const wij = thuis ? m.hs : m.as, zij = thuis ? m.as : m.hs; res = wij > zij ? '<span class="badge res-w">Gewonnen</span>' : wij < zij ? '<span class="badge res-l">Verloren</span>' : '<span class="badge res-d">Gelijk</span>'; }
  const regel = (club, tmn, score) => `<div class="line${club === U ? " u55" : ""}"><span>${esc(club)} <span class="small">${esc(tmn)}</span></span><span class="score">${score === null || score === undefined ? "" : esc(score)}</span></div>`;
  return `<article class="match ${tm.klasse}"><div class="meta"><span style="display:flex;gap:6px;align-items:center"><span class="badge team">${esc(tm.naam)}</span>${DAGEN[dt.getDay()]} ${dt.getDate()} ${MAANDEN[dt.getMonth()]} · ${esc(m.t)}</span><span style="display:flex;gap:6px"><span class="badge ${thuis ? "thuis" : "uit"}">${thuis ? "Thuis" : "Uit"}</span>${res}</span></div>${regel(m.h, m.ht, m.hs)}${regel(m.a, m.at, m.as)}<div class="meta"><span>${esc(m.c)}</span><span>${esc(m.loc || "")}</span></div></article>`;
}

function weekendBlok() {
  const gezien = new Set();
  const alle = [...(wedstrijden?.programma || []), ...(wedstrijden?.uitslagen || [])].filter(m => m.s !== "Cancelled" && !(m.id && gezien.has(m.id)) && (gezien.add(m.id), true));
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
  const za = new Date(vandaag); za.setDate(za.getDate() + ((6 - za.getDay() + 7) % 7));
  if (vandaag.getDay() === 0) za.setDate(vandaag.getDate() - 1); // op zondag: dit weekend is gisteren + vandaag
  const zo = new Date(za); zo.setDate(za.getDate() + 1);
  const wk = alle.filter(m => m.d === iso(za) || m.d === iso(zo)).sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
  const periode = za.getMonth() === zo.getMonth() ? `${za.getDate()} en ${zo.getDate()} ${MAANDEN[zo.getMonth()]}` : `${za.getDate()} ${MAANDEN[za.getMonth()]} en ${zo.getDate()} ${MAANDEN[zo.getMonth()]}`;
  const rij = (m, thuis) => { const dt = new Date(m.d + "T12:00:00"); const tm = team(thuis ? m.ht : m.at); const tegen = thuis ? m.a : m.h;
    return `<div class="rij ${tm.klasse}"><div class="tijd">${esc(m.t)}<span>${DAGEN[dt.getDay()]} ${dt.getDate()} ${MAANDEN[dt.getMonth()]}</span></div>
      <div class="wie"><b><span class="badge team" style="margin-right:6px">${esc(tm.naam)}</span>${thuis ? "tegen" : "bij"} ${esc(tegen)}</b><small>${esc(m.c)}${m.loc ? " · " + esc(m.loc) : ""}</small></div></div>`; };
  const thuis = wk.filter(m => m.h === U), uit = wk.filter(m => m.a === U);
  return `<section class="weekend" aria-label="Thuiswedstrijden dit weekend">
    <div><h2 style="font-size:22px">Thuis dit weekend</h2><div class="sub">Zaterdag en zondag ${periode}</div></div>
    ${thuis.length ? thuis.map(m => rij(m, true)).join("") : '<div class="sub">Dit weekend geen thuiswedstrijden.</div>'}
  </section>
  ${uit.length ? `<section class="weekend uit" aria-label="Uitwedstrijden dit weekend">
    <div><h2 style="font-size:20px">Uit dit weekend</h2><div class="sub">Ga mee als supporter!</div></div>
    ${uit.map(m => rij(m, false)).join("")}
  </section>` : ""}`;
}

// ---------- Beheer (AC en bestuur) ----------
function takenBlok(groep, naam) {
  const vandaag = vandaagIso();
  const lijst = (beheer?.taken || []).filter(x => x.groep === groep).sort((a, b) => (a.klaar - b.klaar) || ((a.deadline || "9999") < (b.deadline || "9999") ? -1 : 1));
  const open = lijst.filter(x => !x.klaar).length;
  return `<article class="news takenlijst ${groep}"><div class="section-head"><h3>Taken ${naam}</h3><span class="small">${open} open</span></div>
    ${groep === "bestuur" ? '<div class="waarschuwing" role="note">⚠️ Let op: de AC ziet deze taken ook. Zet hier geen vertrouwelijke bestuurszaken.</div>' : ""}
    <div class="slots">${lijst.length ? lijst.map(x => {
      const laat = !x.klaar && x.deadline && x.deadline < vandaag;
      const meta = [x.wie ? esc(x.wie) : "", x.deadline ? (laat ? "Te laat: " : "Voor ") + datumKort(x.deadline) : ""].filter(Boolean).join(" · ");
      return `<div class="taak ${x.klaar ? "klaar" : ""}"><input type="checkbox" data-taakklaar="${esc(x.id)}" ${x.klaar ? "checked" : ""} aria-label="Klaar: ${esc(x.titel)}"><div class="wat"><div class="titel">${esc(x.titel)}</div>${meta ? `<div class="meta ${laat ? "laat" : ""}">${meta}</div>` : ""}</div><button class="weg" data-taakweg="${esc(x.id)}" aria-label="Verwijderen">${verwijderKlaar === "t:" + x.id ? "<small>Zeker?</small>" : "×"}</button></div>`;
    }).join("") : '<p class="leeg">Nog geen taken.</p>'}</div>
    <form class="takenform" data-groep="${groep}">
      <input class="vol" name="titel" required maxlength="120" placeholder="Nieuwe taak ${naam}">
      <input name="wie" maxlength="40" placeholder="Wie (optioneel)">
      <input name="deadline" type="date" aria-label="Deadline (optioneel)">
      <button class="primary vol" type="submit">Taak toevoegen</button>
    </form></article>`;
}

async function laadBeheer(stil) {
  if (!beheercode) return;
  try {
    const j = await api(null, { a: "beheer", code: beheercode, actie: "overzicht" });
    beheer = { aanmeldingen: j.aanmeldingen || [], taken: j.taken || [] };
    document.querySelector('nav.tabs button[data-tab="ac"]').hidden = false;
    herteken("ac");
  } catch (e) {
    if (e.code === "code") { beheercode = ""; wis("beheer"); beheer = null; document.querySelector('nav.tabs button[data-tab="ac"]').hidden = true; if (!stil) toast("De beheercode klopt niet meer, log opnieuw in", true); if (huidigeTab === "ac") show("club"); }
    else if (!stil) toast("Het overzicht laden lukt nu niet", true);
  }
}
async function beheerActie(actie, gegevens, gelukt) {
  try { await api(null, { a: "beheer", code: beheercode, actie, ...gegevens }); if (gelukt) toast(gelukt); await Promise.all([laadBeheer(true), laadData()]); }
  catch (e) { toast(e.code === "code" ? "De beheercode klopt niet" : "Dat lukt nu niet, probeer het opnieuw", true); herteken("ac"); }
}

// ---------- Weergaven ----------
const IC = {
  bal: '<circle cx="12" cy="12" r="9"/><path d="M8 4.5c1.5 2 1.5 13 0 15M16 4.5c-1.5 2-1.5 13 0 15"/>',
  klok: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus: '<circle cx="9" cy="8" r="4"/><path d="M2 20c1-4 4-6 7-6s6 2 7 6M19 8v6M16 11h6"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  euro: '<path d="M17 6a6 6 0 1 0 0 12M5 10h9M5 14h9"/>',
  shirt: '<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c-1 2-2 3-4 3s-3-1-4-3z"/>',
  team: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c.5-3.5 3-5 6-5s5.5 1.5 6 5M14 15c3 0 5.5 1.5 6 5"/>',
  kal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  foto: '<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l2-3h4l2 3"/>',
  schild: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  praat: '<path d="M4 5h16v11H9l-5 4z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  tel: '<path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  tas: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  ster: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'
};
const tegel = ([b, s, pad, ic, tk]) => `<a class="tile ${tk || ""}" href="${esc(C.site + pad)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[ic] || ""}</svg><b>${esc(b)}</b><span>${esc(s)}</span></a>`;
function sponsorBlok(groot) {
  const sk = C.sponsorkliks; if (!sk) return "";
  const md = vandaagIso().slice(5);
  const actie = (sk.acties || []).find(x => x.van <= md && md <= x.tot);
  if (groot && !actie) return "";
  const titel = actie ? actie.titel : "Steun de club met SponsorKliks";
  return `<section class="sponsor${actie ? " actie" : ""}" aria-label="SponsorKliks">
    <div class="kicker">SponsorKliks</div><h3>${esc(titel)}</h3><p>${esc(actie ? actie.tekst : sk.tekst)}</p>
    <div class="row"><a class="btn primary" href="${esc(sk.url)}" target="_blank" rel="noopener">Shoppen via SponsorKliks</a>${sk.uitleg ? `<a class="btn" href="${esc(sk.uitleg)}" target="_blank" rel="noopener">Hoe werkt het?</a>` : ""}</div>
  </section>`;
}
const geenKoppeling = () => !C.api ? '<p class="status">Aanmelden en het overzicht werken zodra de app gekoppeld is aan de opslag van de club.</p>' : "";

const views = {
  agenda: () => {
    const lijst = activiteiten();
    return `
    ${sponsorBlok(true)}
    <div class="section-head"><h2>Agenda</h2><span class="small">${esc(C.agendaTitel)}</span></div>
    ${geenKoppeling()}
    <div class="list">${lijst.map(a => `
      <article class="item">
        <div class="date"><b class="${String(a.d).length > 3 ? "lang" : ""}">${esc(a.d)}</b><span>${esc(a.m)}</span></div>
        <div style="min-width:0">
          <h3>${esc(a.titel)}</h3><p>${esc(a.tekst)}</p>
          <div class="tags"><span class="tag wie">${esc(a.wie)}</span>${(a.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
          ${a.kaarten !== undefined ? `<div class="row">${a.kaarten
            ? `<a class="btn primary" href="${esc(a.kaarten)}" target="_blank" rel="noopener">Kaarten kopen via ClubCollect</a>`
            : `<button disabled>Kaarten via ClubCollect, link volgt</button>`}</div>` : a.aanmelden ? `<div class="row">${mijn.activiteiten[a.id]
            ? `<button class="done" data-afmelden="${esc(a.id)}">✓ Aangemeld (${esc(naamLabel(mijn.activiteiten[a.id]))})</button>`
            : `<button class="primary" data-aanmelden="${esc(a.id)}" ${C.api ? "" : "disabled"}>Aanmelden</button>`}</div>` : ""}
        </div>
      </article>`).join("") || '<p class="leeg">Er staan nog geen activiteiten in de agenda.</p>'}
    </div>
    <div id="form"></div>`;
  },
  wedstrijden: () => {
    if (!wedstrijden) return `<h2>Wedstrijden</h2><p class="status">${status.wedstrijden === "laden" ? "Wedstrijden laden..." : "De wedstrijden zijn nu niet bereikbaar. Probeer het later opnieuw."}</p>`;
    const eigenTeam = m => m.h === U ? m.ht : m.at;
    const filter = m => teamFilter === "alle" || eigenTeam(m) === teamFilter;
    const vandaag = vandaagIso();
    const komend = (wedstrijden.programma || []).filter(m => m.d >= vandaag && filter(m)).slice(0, 12);
    const uitslagen = (wedstrijden.uitslagen || []).filter(filter).slice(0, 12);
    const teamCodes = Object.keys(C.teams).filter(code => wedstrijden.standen?.[code] || [...(wedstrijden.programma || []), ...(wedstrijden.uitslagen || [])].some(m => eigenTeam(m) === code));
    const standCodes = (teamFilter === "alle" ? teamCodes : [teamFilter]).filter(code => wedstrijden.standen?.[code]);
    return `
    ${weekendBlok()}
    <div class="chips">${["alle", ...teamCodes].map(code => `<button class="chip ${code === "alle" ? "" : team(code).klasse}" data-team="${esc(code)}" aria-pressed="${teamFilter === code}">${code === "alle" ? "Alle teams" : esc(team(code).naam)}</button>`).join("")}</div>
    ${komend.length ? `<div class="section-head"><h2>Programma</h2><span class="small">Komende wedstrijden</span></div><div class="list">${komend.map(wedstrijdKaart).join("")}</div>` : ""}
    <div class="section-head"><h2>Uitslagen</h2><span class="small">Laatst gespeeld</span></div>
    <div class="list">${uitslagen.map(wedstrijdKaart).join("") || '<p class="leeg">Nog geen uitslagen.</p>'}</div>
    ${standCodes.map(code => { const s = wedstrijden.standen[code]; return `
    <div class="section-head"><h2 style="font-size:20px">Stand ${esc(team(code).naam)}</h2><span class="small">${esc(s.titel)}</span></div>
    <div class="table-wrap ${team(code).klasse}"><table class="stand"><thead><tr><th>#</th><th>Team</th><th>G</th><th>W</th><th>V</th><th>Ptn</th></tr></thead><tbody>${s.r.map(t => `<tr class="${t.u ? "u55" : ""}"><td>${esc(t.p)}</td><td>${esc(t.n)}</td><td>${esc(t.g)}</td><td>${esc(t.w)}</td><td>${esc(t.l)}</td><td>${esc(t.pt)}</td></tr>`).join("")}</tbody></table></div>`; }).join("")}
    <p class="bron">Bron: KNBSB${wedstrijden.bijgewerkt ? `, bijgewerkt ${esc(new Date(wedstrijden.bijgewerkt).toLocaleString("nl-NL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }))}` : ""}${wedstrijden.voorbeeld ? ". Voorbeeldgegevens: de live koppeling is nog niet actief." : "."}</p>`;
  },
  helpen: () => `
    <div class="section-head"><h2>Helpen</h2><span class="small">Vrijwilligersdiensten</span></div>
    ${geenKoppeling()}
    ${status.data === "laden" && !verzoeken.length ? '<p class="status">Laden...</p>' : ""}
    <div class="list">${verzoeken.length ? "" : status.data !== "laden" ? '<p class="leeg">Er staan nu geen vrijwilligersverzoeken open. Dank je wel voor het kijken!</p>' : ""}${verzoeken.map(d => {
      const bezet = d.slots.filter((s, j) => s.bezet || mijn.diensten[d.id + "-" + j]).length;
      return `<article class="news">
        <h3 style="margin-top:0">${esc(d.titel)}</h3>
        ${d.datum ? `<div class="small">${esc(datumKort(d.datum))}</div>` : ""}
        <div class="small">${bezet} van ${d.slots.length} plekken gevuld</div>
        <div class="meter"><i style="width:${d.slots.length ? bezet / d.slots.length * 100 : 0}%"></i></div>
        <div class="slots">${d.slots.map((s, j) => { const k = d.id + "-" + j; return `<div class="slot"><span>${esc(s.taak)}</span>${mijn.diensten[k]
          ? `<button class="done" data-dienstweg="${esc(k)}">✓ Jij (${esc(mijn.diensten[k].naam)})</button>`
          : s.bezet ? '<span class="bezet">Bezet</span>' : `<button class="primary" data-dienst="${esc(k)}">Ik help</button>`}</div>`; }).join("")}</div>
      </article>`; }).join("")}
    </div>`,
  nieuws: () => `
    <h2>Nieuws</h2>
    ${status.nieuws === "laden" && !nieuws.length ? '<p class="status">Nieuws laden...</p>' : ""}
    <div class="list">${nieuws.map(n => `<article class="news">${n.img ? `<img class="newsimg" src="${esc(n.img)}" alt="" loading="lazy" onerror="this.remove()">` : ""}<div class="kicker">Clubnieuws${n.datum ? ` · ${esc(new Date(n.datum).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }))}` : ""}</div><h3>${esc(n.titel)}</h3><p>${esc(n.tekst)}</p>${n.url ? `<a class="newslink" href="${esc(n.url)}" target="_blank" rel="noopener">Lees verder op de clubsite</a>` : ""}</article>`).join("") || (status.nieuws !== "laden" ? `<p class="leeg">Nog geen nieuws dit jaar. Kijk ook op <a href="${esc(C.site)}" target="_blank" rel="noopener">de clubsite</a>.</p>` : "")}</div>`,
  ac: () => {
    if (!beheer) return `<h2>Overzicht</h2><p class="status">Overzicht laden...</p>`;
    const perAct = {}, perDienst = {}, vrijwilligers = new Set();
    beheer.aanmeldingen.forEach(r => {
      if (r.soort === "activiteit") (perAct[r.ref] = perAct[r.ref] || []).push(r);
      else { (perDienst[r.ref] = perDienst[r.ref] || []).push(r.naam); vrijwilligers.add(r.naam.toLowerCase()); }
    });
    const eigen = extraActiviteiten.slice().sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
    return `
    <div class="section-head"><h2>Overzicht</h2><span class="small">Alleen voor AC en bestuur</span></div>
    <div class="section-head"><h2 style="font-size:20px">Taken</h2><span class="small">AC en bestuur apart</span></div>
    <div class="list">${takenBlok("ac", "AC")}${takenBlok("bestuur", "bestuur")}</div>

    <div class="section-head"><h2 style="font-size:20px">Aanmeldingen</h2></div>
    <div class="list">${activiteiten().filter(a => a.aanmelden && a.kaarten === undefined).map(a => {
      const rs = perAct[a.id] || []; const tot = rs.reduce((n, r) => n + (Number(r.aantal) || 1), 0);
      return `<article class="news"><div class="section-head"><h3 style="margin:0">${esc(a.titel)}</h3><span class="small">${esc(a.d)} ${esc(a.m)}</span></div>
        <div class="small">${tot} ${tot === 1 ? "persoon" : "personen"} aangemeld</div>
        ${rs.length ? `<div class="tags">${rs.map(r => `<span class="tag">${esc(naamLabel(r))}</span>`).join("")}</div>` : ""}</article>`;
    }).join("") || '<p class="leeg">Geen activiteiten met aanmelding.</p>'}</div>

    <div class="section-head"><h2 style="font-size:20px">Activiteiten</h2><span class="small">Verschijnt direct in de Agenda</span></div>
    <form class="sheet" id="actform">
      <h3 style="margin:0">Activiteit toevoegen</h3>
      <label for="atitel">Naam<input id="atitel" required maxlength="80" placeholder="Bijv. Kerstborrel"></label>
      <div class="takenform" style="margin:0">
        <label for="adatum">Datum<input id="adatum" type="date" required></label>
        <label for="awie">Voor wie<select id="awie"><option>Iedereen</option><option>Leden</option><option>Jeugd</option><option>Vrijwilligers</option></select></label>
      </div>
      <label for="atekst">Korte omschrijving<textarea id="atekst" rows="3" maxlength="300" placeholder="Wat gaan we doen?"></textarea></label>
      <label for="awaar">Waar en hoe laat (optioneel)<input id="awaar" maxlength="40" placeholder="Bijv. Kantine, 20:00"></label>
      <label style="flex-direction:row;align-items:center;gap:8px;font-weight:500"><input id="aaanmelden" type="checkbox" style="width:20px;height:20px;padding:0;accent-color:var(--red)"> Leden kunnen zich aanmelden via de app</label>
      <label for="akaarten">Of: link naar ClubCollect voor kaarten (optioneel)<input id="akaarten" type="url" placeholder="https://..."></label>
      <div class="row"><button class="primary" type="submit">Activiteit plaatsen</button></div>
      <div class="note">De vaste jaaragenda staat in de app zelf; vraag Kenneth om daar iets in te wijzigen.</div>
    </form>
    ${eigen.length ? `<div class="list">${eigen.map(a => `<article class="news"><div class="section-head"><div><h3 style="margin:0">${esc(a.titel)}</h3><span class="small">${esc(datumKort(a.datum))} ${esc(String(a.datum).slice(0, 4))}</span></div><button data-actweg="${esc(a.id)}">${verwijderKlaar === "a:" + a.id ? "Zeker weten?" : "Verwijderen"}</button></div></article>`).join("")}</div>` : ""}

    <div class="section-head"><h2 style="font-size:20px">Vrijwilligers</h2><span class="small">${vrijwilligers.size} aangemeld</span></div>
    <form class="sheet" id="verzoekform">
      <h3 style="margin:0">Nieuw vrijwilligersverzoek</h3>
      <label for="vtitel">Waarvoor?<input id="vtitel" required maxlength="120" placeholder="Bijv. Bardienst zaterdag 6 december"></label>
      <label for="vdatum">Datum (aanmeldingen worden een maand later verwijderd)<input id="vdatum" type="date" required></label>
      <label for="vtaken">Taken of tijdvakken, één per regel<textarea id="vtaken" required rows="4" placeholder="Opbouw&#10;Bar 14:00 tot 17:00&#10;Afbouw"></textarea></label>
      <div class="row"><button class="primary" type="submit">Verzoek plaatsen</button></div>
      <div class="note">Het verzoek verschijnt direct onder Helpen voor alle leden.</div>
    </form>
    <div class="list">${verzoeken.map(d => `<article class="news"><div class="section-head"><h3 style="margin:0">${esc(d.titel)}</h3><button data-verzoekweg="${esc(d.id)}">${verwijderKlaar === "v:" + d.id ? "Zeker weten?" : "Verwijderen"}</button></div>${d.datum ? `<div class="small">${esc(datumKort(d.datum))}</div>` : ""}<div class="slots">${d.slots.map((s, j) => {
      const ns = perDienst[d.id + "-" + j] || [];
      return `<div class="slot"><span>${esc(s.taak)}</span>${ns.length ? `<strong>${ns.map(esc).join(", ")}</strong>` : '<span class="open">Nog open</span>'}</div>`;
    }).join("")}</div></article>`).join("")}</div>
    <div class="row" style="justify-content:center"><button id="uitloggen">Uitloggen op dit toestel</button></div>`;
  },
  club: () => `
    <h2>Club</h2>
    ${sponsorBlok(false)}
    ${C.clubBlokken.map(g => `<section class="tilegroup"><h3>${esc(g.kop)}</h3><div class="tiles">${g.items.map(tegel).join("")}</div></section>`).join("")}
    <div class="tilefoot">Alle blokken openen de clubsite</div>
    <article class="news"><div class="kicker">Privacy</div><h3>Wat bewaart deze app?</h3><p>${esc(C.privacy)}</p>${C.privacyUrl ? `<a class="newslink" href="${esc(C.privacyUrl)}" target="_blank" rel="noopener">Privacyverklaring van de club</a>` : ""}</article>
    ${C.api && !beheer ? '<div class="login"><button id="inloggen">Inloggen voor AC en bestuur</button></div>' : ""}`
};

function show(tab, behoudScroll) {
  if (tab === "ac" && !beheercode) tab = "club";
  huidigeTab = tab;
  document.querySelectorAll("nav.tabs button").forEach(b => b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  const y = window.scrollY;
  main.innerHTML = `<div class="view" style="display:flex;flex-direction:column;gap:18px">${views[tab]()}</div>`;
  window.scrollTo(0, behoudScroll ? y : 0);
}

// ---------- Formulieren voor leden ----------
function dienstFormulier(knop) {
  const key = knop.dataset.dienst;
  const slot = knop.parentElement;
  const vid = key.slice(0, key.lastIndexOf("-")), j = Number(key.slice(key.lastIndexOf("-") + 1));
  const d = verzoeken.find(x => x.id === vid); if (!d) return;
  slot.innerHTML = `<span>${esc(d.slots[j].taak)}</span><form class="row" style="margin:0" id="dienstform"><input id="dienstnaam" required maxlength="40" autocomplete="given-name" placeholder="Je voornaam" value="${esc(laatsteNaam)}" style="width:9em"><button class="primary" type="submit">Opslaan</button></form>`;
  document.getElementById("dienstnaam").focus();
  document.getElementById("dienstform").onsubmit = async e => {
    e.preventDefault();
    const n = document.getElementById("dienstnaam").value.trim(); if (!n) return;
    e.target.querySelector("button").disabled = true;
    try {
      await api(null, { a: "aanmelden", toestel, soort: "dienst", ref: key, naam: n, aantal: 1, datum: d.datum || "" });
      laatsteNaam = n; schrijf("naam", n); mijn.diensten[key] = { naam: n }; schrijf("mijn", mijn);
      document.activeElement?.blur?.(); show("helpen", true); toast("Bedankt, je staat ingeroosterd"); laadData();
    } catch (err) { toast(err.code === "bezet" ? "Iemand was je net voor, deze plek is al bezet" : "Opslaan lukt nu niet, probeer het opnieuw", true); laadData(); show("helpen", true); }
  };
}

function formulier(id) {
  const a = activiteiten().find(x => x.id === id); if (!a) return;
  const f = document.getElementById("form");
  f.innerHTML = `<form class="sheet" id="aanmeldform">
    <h2 style="font-size:20px">Aanmelden: ${esc(a.titel)}</h2>
    <label for="naam">Je voornaam<input id="naam" required maxlength="40" autocomplete="given-name" placeholder="Bijv. Sanne" value="${esc(laatsteNaam)}"></label>
    <label for="aantal">Met hoeveel personen?<select id="aantal"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option></select></label>
    <div class="row"><button class="primary" type="submit">Aanmelden</button><button type="button" id="annuleer">Annuleren</button></div>
    <div class="note">Alleen de AC en het bestuur zien je aanmelding. Je voornaam wordt uiterlijk een maand na de activiteit verwijderd.</div>
  </form>`;
  f.scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("naam").focus();
  document.getElementById("annuleer").onclick = () => f.innerHTML = "";
  document.getElementById("aanmeldform").onsubmit = async e => {
    e.preventDefault();
    const n = document.getElementById("naam").value.trim(); if (!n) return;
    const p = Number(document.getElementById("aantal").value);
    e.target.querySelector("button[type=submit]").disabled = true;
    try {
      await api(null, { a: "aanmelden", toestel, soort: "activiteit", ref: id, naam: n, aantal: p, datum: a.datum || "" });
      laatsteNaam = n; schrijf("naam", n); mijn.activiteiten[id] = { naam: n, aantal: p }; schrijf("mijn", mijn);
      f.innerHTML = ""; show("agenda", true); toast("Je bent aangemeld");
    } catch (err) { e.target.querySelector("button[type=submit]").disabled = false; toast("Aanmelden lukt nu niet, probeer het opnieuw", true); }
  };
}

async function afmelden(soort, ref, tab) {
  try {
    await api(null, { a: "afmelden", toestel, soort, ref });
    delete mijn[soort === "activiteit" ? "activiteiten" : "diensten"][ref]; schrijf("mijn", mijn);
    show(tab, true); toast(soort === "activiteit" ? "Je bent afgemeld" : "Je bent uitgeschreven"); if (soort === "dienst") laadData();
  } catch (e) { toast("Afmelden lukt nu niet, probeer het opnieuw", true); }
}

// ---------- Klikken en formulieren ----------
document.addEventListener("click", async e => {
  const t = e.target.closest("button"); if (!t || t.disabled) return;
  if (t.dataset.tab) show(t.dataset.tab);
  else if (t.dataset.team) { teamFilter = t.dataset.team; show("wedstrijden", true); }
  else if (t.dataset.aanmelden) formulier(t.dataset.aanmelden);
  else if (t.dataset.afmelden) afmelden("activiteit", t.dataset.afmelden, "agenda");
  else if (t.dataset.dienstweg) afmelden("dienst", t.dataset.dienstweg, "helpen");
  else if (t.dataset.dienst) dienstFormulier(t);
  else if (t.id === "inloggen") {
    const code = (prompt("Beheercode voor AC en bestuur") || "").trim(); if (!code) return;
    try { await api(null, { a: "beheer", code, actie: "check" }); beheercode = code; schrijf("beheer", code); toast("Ingelogd"); await laadBeheer(); show("ac"); }
    catch (err) { toast(err.code === "code" ? "Die code klopt niet" : err.code === "geblokkeerd" ? "Te veel pogingen, probeer het over 10 minuten opnieuw" : "Inloggen lukt nu niet", true); }
  }
  else if (t.id === "uitloggen") { beheercode = ""; beheer = null; wis("beheer"); document.querySelector('nav.tabs button[data-tab="ac"]').hidden = true; show("club"); toast("Uitgelogd"); }
  else if (t.dataset.actweg || t.dataset.taakweg || t.dataset.verzoekweg) {
    const [soort, id] = t.dataset.actweg ? ["a", t.dataset.actweg] : t.dataset.taakweg ? ["t", t.dataset.taakweg] : ["v", t.dataset.verzoekweg];
    if (verwijderKlaar !== soort + ":" + id) { verwijderKlaar = soort + ":" + id; show("ac", true); return; }
    verwijderKlaar = null; t.disabled = true;
    beheerActie({ a: "activiteitWeg", t: "taakWeg", v: "verzoekWeg" }[soort], { id }, { a: "Activiteit verwijderd", t: "", v: "Verzoek verwijderd" }[soort]);
  }
});
document.addEventListener("change", e => {
  const id = e.target.dataset?.taakklaar; if (!id) return;
  beheerActie("taakKlaar", { id, klaar: e.target.checked });
});
document.addEventListener("submit", e => {
  const f = e.target;
  if (f.classList.contains("takenform")) {
    e.preventDefault();
    const titel = f.titel.value.trim(); if (!titel) return;
    f.querySelector("button").disabled = true; document.activeElement?.blur?.();
    beheerActie("taakNieuw", { groep: f.dataset.groep, titel, wie: f.wie.value.trim(), deadline: f.deadline.value || "" }, "Taak toegevoegd");
  } else if (f.id === "actform") {
    e.preventDefault();
    const v = { titel: f.querySelector("#atitel").value.trim(), datum: f.querySelector("#adatum").value, wie: f.querySelector("#awie").value,
      tekst: f.querySelector("#atekst").value.trim(), waar: f.querySelector("#awaar").value.trim(), aanmelden: f.querySelector("#aaanmelden").checked,
      kaarten: f.querySelector("#akaarten").value.trim() };
    if (!v.titel || !v.datum) return;
    if (v.kaarten && !/^https:\/\//.test(v.kaarten)) { toast("De ClubCollect-link moet met https:// beginnen", true); return; }
    f.querySelector("button[type=submit]").disabled = true; document.activeElement?.blur?.();
    beheerActie("activiteitNieuw", v, "Activiteit geplaatst");
  } else if (f.id === "verzoekform") {
    e.preventDefault();
    const titel = f.querySelector("#vtitel").value.trim(), datum = f.querySelector("#vdatum").value;
    const slots = f.querySelector("#vtaken").value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 20);
    if (!titel || !slots.length || !datum) return;
    f.querySelector("button[type=submit]").disabled = true; document.activeElement?.blur?.();
    beheerActie("verzoekNieuw", { titel, datum, slots }, "Verzoek geplaatst");
  }
});

// ---------- Gegevens laden ----------
async function laadData() {
  try {
    const j = await api({ a: "data" });
    extraActiviteiten = j.activiteiten || []; verzoeken = j.verzoeken || [];
    schrijf("cache-activiteiten", extraActiviteiten); schrijf("cache-verzoeken", verzoeken);
    status.data = "klaar";
  } catch (e) { status.data = "fout"; }
  herteken("agenda", "helpen", "ac");
}
async function laadMijn() {
  try {
    const j = await api(null, { a: "mijn", toestel });
    mijn = { activiteiten: j.activiteiten || {}, diensten: j.diensten || {} }; schrijf("mijn", mijn);
    herteken("agenda", "helpen");
  } catch (e) {}
}
async function laadNieuws() {
  try { const j = await api({ a: "nieuws" }); nieuws = j.items || []; schrijf("cache-nieuws", nieuws); status.nieuws = "klaar"; }
  catch (e) { status.nieuws = "fout"; }
  herteken("nieuws");
}
async function laadWedstrijden() {
  try { const j = await api({ a: "wedstrijden" }); wedstrijden = j; schrijf("cache-wedstrijden", j); status.wedstrijden = "klaar"; }
  catch (e) {
    status.wedstrijden = "fout";
    if (!wedstrijden) { try { const r = await fetch("data/wedstrijden-voorbeeld.json"); wedstrijden = { ...(await r.json()), voorbeeld: true }; } catch (e2) {} }
  }
  herteken("wedstrijden");
}

// ---------- Start ----------
(function start() {
  document.title = C.naam;
  document.getElementById("clubnaam").textContent = C.naam;
  document.getElementById("clubsub").textContent = C.sub;
  const SOC = {
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.6V21z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.8 3.5h3l-6.6 7.5 7.8 9.5h-6.1l-4.8-6-5.4 6h-3l7-8L2.4 3.5h6.2l4.3 5.5zm-1 15.2h1.7L7.3 5.2H5.5z"/></svg>'
  };
  document.getElementById("socials").innerHTML = C.socials.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(s.naam)}">${SOC[s.icoon] || esc(s.naam[0])}</a>`).join("");
  if (beheercode) document.querySelector('nav.tabs button[data-tab="ac"]').hidden = false;
  if (!C.api) { status = { data: "fout", nieuws: "fout", wedstrijden: "fout" }; }
  show("agenda");
  if (C.api) { laadData(); laadMijn(); laadNieuws(); laadBeheer(true); }
  laadWedstrijden();
  // Ververs als de app weer op de voorgrond komt (bijv. vanaf het beginscherm geopend)
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && C.api) { laadData(); laadNieuws(); laadWedstrijden(); laadBeheer(true); } });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
