# Honkbalteams-app

Clubapps (installeerbare webapps) voor honk- en softbalverenigingen. Eén app, en elke club een eigen exemplaar met eigen naam, logo, kleuren en gegevens.

| Club | Map | Adres |
| --- | --- | --- |
| Uitsmijters '55, Almelo | [`u55/`](u55/) | https://app.uitsmijters55.nl |

## Een nieuwe club toevoegen (met één knop)

1. Ga in GitHub naar **Actions > Nieuwe club > Run workflow**.
2. Vul het formulier in: code (wordt het adres, bijv. `pioniers`), naam, plaats, website, link naar het logo, twee clubkleuren en eventueel het SponsorKliks-clubnummer, het KNBSB-club-id en het webadres op het domein van de club (bijv. `app.pioniers.nl`).
3. Druk op de groene knop. Na een minuut staat de club klaar: map `<code>/` met `config.js` en iconen, de app zelf, en `backend/<code>/Code.gs` met de gegevens van de club al ingevuld. Een paar minuten later staat de app online.
4. De club maakt een eigen Google Sheet met dat script (uitleg: [`backend/LEESMIJ.md`](backend/LEESMIJ.md)) en geeft het webadres (`.../exec`) door.
5. **Actions > Club koppelen > Run workflow**: code en webadres invullen. Nu werken aanmelden, vrijwilligersdiensten, nieuws en het Overzicht met de eigen beheercode van die club.
6. Verder aanpassen (agenda, socials, teams, blokken in de Club-tab, nieuwsfeed) doe je in `<code>/config.js`. Zie `u55/config.js` als voorbeeld.

Zonder Google Sheet werkt de app al (agenda, Club-tab, SponsorKliks), alleen aanmelden en het Overzicht nog niet. Zonder KNBSB-club-id zegt de Wedstrijden-tab dat die nog gekoppeld wordt.

## Hoe het werkt

Zoals bij de poolteam-app: de app is gedeeld, alleen de instellingen verschillen per club.

- `app/`: de app zelf, gelijk voor alle clubs (`app.js`, `style.css`, sjablonen voor `index.html` en `sw.js`). **Wijzigingen aan de app doe je hier.**
- `<club>/config.js` en `<club>/icons/`: alles wat per club anders is (naam, logo, kleuren, website, KNBSB, Google Agenda, SponsorKliks, agenda, socials, Club-tab).
- `scripts/build.mjs` maakt daaruit per club de complete app (`index.html`, `app.js`, `style.css`, `sw.js`, manifest), het script `backend/<club>/Code.gs` en de startpagina. Dat gebeurt vanzelf in GitHub Actions (**Apps bouwen**) na elke wijziging. Het versienummer voor telefoons verandert daarbij vanzelf.
- `scripts/nieuwe-club.mjs`: wat de knop **Nieuwe club** doet (config en iconen uit het logo maken).
- `backend/Code.gs`: het sjabloon voor de opslag en live gegevens (Google Apps Script bij een Google Sheet van de club). Elke club heeft een eigen Sheet, eigen script en eigen beheercode; gegevens van clubs lopen nooit door elkaar.

## Tabs

Agenda (aanmelden of ClubCollect-link), Wedstrijden (thuis/uit dit weekend, programma, uitslagen, standen per team), Helpen (vrijwilligersdiensten), Nieuws (van de clubsite), Club (links naar de site, privacy) en Overzicht (alleen bestuur/commissie, met beheercode: taken, aanmeldingen, activiteiten en verzoeken toevoegen).

## Eigen webadres van de club

Elke club krijgt de app op haar eigen domein, bijvoorbeeld `app.pioniers.nl`. Dat gaat via Cloudflare Pages (project `clubapps`), net als bij de poolteams:

1. Vul bij de knop **Nieuwe club** het veld *domein* in (of later `domein` in `<club>/config.js`).
2. De Action zet de app op Cloudflare en koppelt het domein. In het overzicht van de Action staat welk DNS-record de club moet maken, meestal: **CNAME** `app` naar `clubapps.pages.dev`.
3. De beheerder van de clubwebsite zet dat record. Binnen een uur werkt `https://app.pioniers.nl`, met een eigen beveiligd certificaat.

Eenmalig nodig in deze repository (**Settings > Secrets and variables > Actions**): `CLOUDFLARE_API_TOKEN` (recht *Cloudflare Pages: Edit*) en `CLOUDFLARE_ACCOUNT_ID`. Zonder die secrets slaat de Action deze stap over.
`scripts/cloudflare.mjs` stelt de site samen en koppelt de domeinen, `cloudflare/_worker.js` stuurt elk domein naar de map van de club.

Uitsmijters '55 blijft op GitHub Pages: de beheerder van het domein heeft een CNAME `app` naar `rijkenk.github.io` gezet en het bestand `CNAME` bevat `app.uitsmijters55.nl`. Dat domein slaat Cloudflare over.

## Lokaal bouwen

`node scripts/build.mjs` (Node 18 of nieuwer). Voor de knop Nieuwe club met de hand: zie de uitleg bovenin `scripts/nieuwe-club.mjs` (heeft ImageMagick nodig).
