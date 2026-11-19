# Opslag koppelen (Google Sheet + Apps Script)

De app slaat aanmeldingen, activiteiten, vrijwilligersverzoeken en taken op in een Google Sheet van de club.
Dit hoef je maar één keer in te stellen, en het kost niets.

## 1. Sheet en script aanmaken

1. Maak in de Google Drive van de club een nieuwe Google Sheet aan, bijvoorbeeld **U55 clubapp** of **Pioniers clubapp**.
   Gebruik bij voorkeur een clubaccount (geen privéaccount): wie eigenaar is, beheert de gegevens.
2. Kies in de Sheet **Extensies > Apps Script**.
3. Verwijder de voorbeeldcode en plak de inhoud van `backend/<club>/Code.gs` (voor Uitsmijters '55: [`u55/Code.gs`](u55/Code.gs)). Klik op **Opslaan**.
   Daarin staan de gegevens van die club al ingevuld (naam, clubsite, KNBSB, agenda). Niet `backend/Code.gs` zelf gebruiken: dat is het sjabloon.
4. Kies bovenin de functie **setup** en klik op **Uitvoeren**.
   Google vraagt om toestemming. Bij "Google heeft deze app niet geverifieerd" kies je **Geavanceerd > Ga naar ... (onveilig)**: het is je eigen script.
5. Onderin verschijnt het **uitvoeringslogboek** met de **beheercode** voor AC en bestuur. Bewaar die goed.
   Wijzigen kan later bij **Projectinstellingen (tandwiel) > Scripteigenschappen > BEHEERCODE**.

6. In hetzelfde logboek staat of de **Google Agenda** gekoppeld is ("... komende afspraken gevonden").
   Staat er "Let op", dan kan dit Google-account de agenda niet zien: deel de agenda met dit account
   (**Alle afspraakdetails bekijken**) en voer setup opnieuw uit.

`setup` maakt de tabbladen Aanmeldingen, Activiteiten, Verzoeken en Taken aan en zet een nachtelijke opruiming aan
die aanmeldingen een maand na de activiteit verwijdert.

## 2. Als webadres beschikbaar maken

1. Klik op **Implementeren > Nieuwe implementatie**.
2. Kies bij het tandwiel **Web-app**.
3. Uitvoeren als: **Ik**. Wie heeft toegang: **Iedereen**.
4. Klik op **Implementeren** en kopieer de **URL van de web-app** (eindigt op `/exec`).
5. Die URL komt in `<club>/config.js` bij `api`. Makkelijkst via GitHub: **Actions > Club koppelen > Run workflow**, code van de club en de URL invullen. Daarna werken aanmelden en het overzicht.

Verandert er later iets in `Code.gs`? Kies dan **Implementeren > Implementaties beheren > bewerken > Nieuwe versie**, anders blijft de oude versie actief.

## Google Agenda

De app toont automatisch de komende afspraken uit de Google Agenda **U55 Activiteiten** (agenda-ID staat in `<club>/config.js` bij `googleAgenda`, en daarmee in `backend/<club>/Code.gs`).
Nieuwe of gewijzigde afspraken staan binnen een kwartier in de app. In de beschrijving van een afspraak kun je zetten:

- `#aanmelden`: leden kunnen zich in de app aanmelden (alleen voornaam en aantal).
- `#kaarten https://...`: knop "Kaarten kopen" met die link (bijvoorbeeld ClubCollect).
- `#voor Jeugd`: voor wie de activiteit is (anders "Iedereen").
- `#herhalen`: een terugkerende afspraak toch tonen. Zonder deze tag slaat de app herhalingen over (vaak oude jaarlijkse afspraken).

**Andersom:** een activiteit die AC of bestuur in de app toevoegt (Overzicht), zet het script ook in de Google Agenda,
als het Google-account van het script daar **Wijzigingen aanbrengen in afspraken** mag. Verwijder je hem in de app, dan verdwijnt hij ook uit de agenda.
Zonder dat recht komt de activiteit alleen in de app.

Staat een activiteit zowel in de vaste jaaragenda (`<club>/config.js`) als in de Google Agenda op dezelfde dag, dan toont de app alleen die uit de Google Agenda.

## Wie ziet wat?

- **Leden en ouders** zien de agenda, de open plekken bij vrijwilligersverzoeken ("bezet" zonder naam), wedstrijden en nieuws.
- **AC en bestuur** loggen in de app in met de beheercode (Club-tab, onderaan) en zien dan het Overzicht met namen en taken.
- **De Sheet zelf** zien alleen mensen met wie je hem deelt. Deel hem alleen met AC en bestuur.
- In de Sheet staat per aanmelding een versleuteld toestelnummer, zodat alleen dat toestel zich kan afmelden. Er worden geen e-mailadressen, telefoonnummers of IP-adressen bewaard.
