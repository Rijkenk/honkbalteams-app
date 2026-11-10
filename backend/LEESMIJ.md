# Opslag koppelen (Google Sheet + Apps Script)

De app slaat aanmeldingen, activiteiten, vrijwilligersverzoeken en taken op in een Google Sheet van de club.
Dit hoef je maar één keer in te stellen, en het kost niets.

## 1. Sheet en script aanmaken

1. Maak in de Google Drive van de club een nieuwe Google Sheet aan, bijvoorbeeld **U55 clubapp**.
   Gebruik bij voorkeur een clubaccount (geen privéaccount): wie eigenaar is, beheert de gegevens.
2. Kies in de Sheet **Extensies > Apps Script**.
3. Verwijder de voorbeeldcode en plak de inhoud van [`Code.gs`](Code.gs). Klik op **Opslaan**.
4. Kies bovenin de functie **setup** en klik op **Uitvoeren**.
   Google vraagt om toestemming. Bij "Google heeft deze app niet geverifieerd" kies je **Geavanceerd > Ga naar ... (onveilig)**: het is je eigen script.
5. Onderin verschijnt het **uitvoeringslogboek** met de **beheercode** voor AC en bestuur. Bewaar die goed.
   Wijzigen kan later bij **Projectinstellingen (tandwiel) > Scripteigenschappen > BEHEERCODE**.

`setup` maakt de tabbladen Aanmeldingen, Activiteiten, Verzoeken en Taken aan en zet een nachtelijke opruiming aan
die aanmeldingen een maand na de activiteit verwijdert.

## 2. Als webadres beschikbaar maken

1. Klik op **Implementeren > Nieuwe implementatie**.
2. Kies bij het tandwiel **Web-app**.
3. Uitvoeren als: **Ik**. Wie heeft toegang: **Iedereen**.
4. Klik op **Implementeren** en kopieer de **URL van de web-app** (eindigt op `/exec`).
5. Die URL komt in `u55/config.js` bij `api`. Daarna werken aanmelden en het overzicht.

Pas je later `Code.gs` aan? Kies dan **Implementeren > Implementaties beheren > bewerken > Nieuwe versie**, anders blijft de oude versie actief.

## Wie ziet wat?

- **Leden en ouders** zien de agenda, de open plekken bij vrijwilligersverzoeken ("bezet" zonder naam), wedstrijden en nieuws.
- **AC en bestuur** loggen in de app in met de beheercode (Club-tab, onderaan) en zien dan het Overzicht met namen en taken.
- **De Sheet zelf** zien alleen mensen met wie je hem deelt. Deel hem alleen met AC en bestuur.
- In de Sheet staat per aanmelding een versleuteld toestelnummer, zodat alleen dat toestel zich kan afmelden. Er worden geen e-mailadressen, telefoonnummers of IP-adressen bewaard.
