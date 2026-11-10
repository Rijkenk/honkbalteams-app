// Instellingen voor de clubapp van Uitsmijters '55.
// Een andere club krijgt een eigen map (bijv. /clubnaam) met een eigen config.js; app.js en style.css blijven gelijk.
window.CLUB = {
  id: "u55",
  naam: "Uitsmijters '55",
  sub: "Honk- en softbalvereniging Almelo · sinds 1955",
  site: "https://www.uitsmijters55.nl",

  // Webadres van de Google Apps Script-koppeling (zie backend/LEESMIJ.md). Leeg = alleen-lezen modus met voorbeeldgegevens.
  api: "",

  // KNBSB/FOYS: openbare competitiegegevens (opgehaald via de koppeling hierboven)
  foys: { federationId: "d82c5610-66b2-4939-9897-8dac34becfc5", clubId: "0b84a685-dbef-4a60-b965-49b2a7df7f6d" },
  teams: {
    "MH-1": { naam: "Heren", klasse: "t-heren" },
    "MHU15-1": { naam: "U15", klasse: "t-u15" },
    "MHU12-1": { naam: "U12", klasse: "t-u12" },
    "MBeeBallU12-1": { naam: "BeeBall", klasse: "t-bee" }
  },

  socials: [
    { naam: "Facebook", url: "https://www.facebook.com/hsvuitsmijters55", icoon: "facebook" },
    { naam: "Instagram", url: "https://www.instagram.com/uitsmijters55/", icoon: "instagram" },
    { naam: "X (Twitter)", url: "https://twitter.com/uitsmijters55", icoon: "x" }
  ],

  // Vaste jaaragenda (concept 2027). "datum" bepaalt de volgorde en wanneer aanmeldingen worden opgeruimd (1 maand erna).
  // d en m zijn wat er in het datumblokje staat. Activiteiten die AC en bestuur in de app toevoegen komen hier automatisch bij.
  agendaTitel: "Jaaragenda 2027: concept, data onder voorbehoud",
  agenda: [
    { id: "nieuwjaar", datum: "2027-01-09", d: "9", m: "jan", titel: "Nieuwjaarsborrel", tekst: "Proosten op 2027 met loten, sjoelen, muziekbingo en ballen slaan.", wie: "Iedereen", tags: ["Of za 16 jan", "Kantine"], aanmelden: true },
    { id: "valentijn", datum: "2027-02-13", d: "13", m: "feb", titel: "Valentijnsbingo", tekst: "Bingo met mooie prijzen van onze sponsors. Kaartverkoop vanaf half januari.", wie: "Iedereen", tags: ["Kantine"], kaarten: "" },
    { id: "alv", datum: "2027-03-31", d: "mrt", m: "2027", titel: "ALV en klusdag", tekst: "De jaarvergadering, waar de AC ook de jaarkalender presenteert. En samen de club klaarmaken voor het seizoen.", wie: "Leden", tags: ["Datum volgt"] },
    { id: "pasen", datum: "2027-03-28", d: "28", m: "mrt", titel: "Paasontbijt", tekst: "Samen ontbijten op de club.", wie: "Iedereen", tags: ["Of ma 29 mrt"], aanmelden: true },
    { id: "opening", datum: "2027-04-10", d: "10-11", m: "apr", titel: "Openingsweekend", tekst: "Aftrap van seizoen 2027 met hamburgers en hotdogs.", wie: "Iedereen", tags: ["Club"] },
    { id: "jeugd", datum: "2027-06-30", d: "jun", m: "2027", titel: "Jeugdweekend", tekst: "Kamperen op de club met een kinderbingo.", wie: "Jeugd", tags: ["Datum volgt"], aanmelden: true },
    { id: "toernooi", datum: "2027-07-31", d: "jul", m: "2027", titel: "Toernooiweekend Heren 1", tekst: "Een weekend vol honkbal rond de zomerstop. Kom kijken en aanmoedigen!", wie: "Iedereen", tags: ["Proef", "Datum volgt"] },
    { id: "driekamp", datum: "2027-09-05", d: "aug", m: "2027", titel: "Driekamptoernooi", tekst: "Ouders tegen kids en oud-leden tegen Heren 1, met bbq en pubquiz.", wie: "Iedereen", tags: ["Proef", "Eind aug of begin sep"], aanmelden: true },
    { id: "clubactie", datum: "2027-09-30", d: "sep", m: "2027", titel: "Grote Clubactie", tekst: "Onze jeugd verkoopt loten voor de club. Koop er eentje!", wie: "Jeugd", tags: ["Sep en okt"] },
    { id: "halloween", datum: "2027-10-30", d: "30", m: "okt", titel: "Halloweenbingo", tekst: "Griezelen met bingo en misschien een dropping of spookhuizen in tenten.", wie: "Iedereen", tags: ["Kantine"], kaarten: "" },
    { id: "choco", datum: "2027-11-07", d: "nov", m: "2027", titel: "Chocoladeletters", tekst: "Steun de club en bestel je chocoladeletters.", wie: "Iedereen", tags: ["Begin november"] },
    { id: "sint", datum: "2027-11-27", d: "27", m: "nov", titel: "Sinterklaasfeest", tekst: "Sinterklaas komt op bezoek bij de BeeBall en de pupillen.", wie: "Jeugd", tags: ["Of zo 28 nov"], aanmelden: true }
  ],

  // Blokken in de Club-tab: [titel, ondertitel, pad op de clubsite, icoon, teamklasse]
  clubBlokken: [
    { kop: "Meedoen", items: [
      ["Gratis proefles", "Kom een keer meetrainen", "/index.php/proeflessen", "bal"],
      ["Trainingstijden", "Wanneer en waar", "/index.php/training", "klok"],
      ["Lid worden", "Alles over het lidmaatschap", "/index.php/lid-worden/informatie-lidmaatschap", "plus"],
      ["Inschrijven", "Direct het formulier invullen", "/index.php/lid-worden/inschrijfformulier", "pen"],
      ["Contributie", "Bedragen en betalen", "/index.php/lid-worden/informatie-contributiebetaling", "euro"],
      ["Clubtenue", "Wat heb je nodig", "/index.php/lid-worden/honkbal-tenue-uitsmijters-55", "shirt"] ] },
    { kop: "Teams", items: [
      ["Heren 1", "Senioren honkbal", "/index.php/teams/senioren-honkbal/h1-team", "team", "t-heren"],
      ["U15", "Aspiranten honkbal", "/index.php/teams/aspiranten-honkbal/u15-team", "team", "t-u15"],
      ["U12", "Pupillen honkbal", "/index.php/teams/pupillen-honkbal/u12-team", "team", "t-u12"],
      ["Beeball", "De jongste spelers", "/index.php/teams/beeball/bml-team", "team", "t-bee"],
      ["Recreanten", "Softbal voor iedereen", "/index.php/teams/recreanten-softbal", "team"] ] },
    { kop: "Clubinfo", items: [
      ["Agenda op de site", "Alle clubdata", "/index.php/nieuws/u55-agenda", "kal"],
      ["Nieuwsbrief", "Lees de laatste editie", "/index.php/nieuws/u55-nieuwsbrief", "mail"],
      ["Foto's", "Fotogalerij", "/index.php/info/foto-gallery", "foto"],
      ["Sponsoring", "Steun de club", "/index.php/sponsoring/sponsor-informatie-acties-sponsors", "ster"],
      ["Veilig sporten", "Gedragscodes", "/index.php/info/gedragscodes-en-een-veilige-sportomgeving", "schild"],
      ["Vertrouwenspersoon", "Voor als iets niet goed voelt", "/index.php/info/vertrouwenspersoon", "praat"],
      ["Over ons", "De club sinds 1955", "/index.php/info/over-ons", "info"],
      ["Contact", "Bestuur en adres", "/index.php/contact", "tel"] ] }
  ],

  privacy: "Alleen je voornaam als je je aanmeldt voor een activiteit of dienst. Die zien alleen de AC en het bestuur. We verwijderen hem uiterlijk een maand na de activiteit. Geen adressen, telefoonnummers of geboortedata.",
  privacyUrl: "https://www.uitsmijters55.nl/index.php/info/disclaimer-privacy-statement"
};
