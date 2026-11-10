# Honkbalteams-app

Clubapps (installeerbare webapps) voor honk- en softbalverenigingen. Elke club heeft een eigen map.

| Club | Map | Adres |
| --- | --- | --- |
| Uitsmijters '55, Almelo | [`u55/`](u55/) | app.uitsmijters55.nl (na koppeling) |

## Hoe het werkt

- **Webapp** (`u55/`): gewone HTML, CSS en JavaScript, gehost via GitHub Pages. Leden kunnen hem op hun beginscherm zetten.
- **Instellingen** per club staan in `u55/config.js`: naam, socials, vaste jaaragenda, blokken in de Club-tab, teams en het adres van de opslag.
- **Opslag en live gegevens** (`backend/Code.gs`): een Google Apps Script bij een Google Sheet van de club. Bewaart aanmeldingen, activiteiten, vrijwilligersverzoeken en taken, haalt het nieuws van de clubsite en de wedstrijden van de KNBSB op, en ruimt aanmeldingen een maand na de activiteit op. Installatie: [`backend/LEESMIJ.md`](backend/LEESMIJ.md).

## Tabs

Agenda (aanmelden of ClubCollect-link), Wedstrijden (thuis/uit dit weekend, programma, uitslagen, standen per team), Helpen (vrijwilligersdiensten), Nieuws (van de clubsite), Club (links naar de site, privacy) en Overzicht (alleen AC en bestuur, met beheercode: taken, aanmeldingen, activiteiten en verzoeken toevoegen).

## Eigen adres koppelen (app.uitsmijters55.nl)

1. De beheerder van het domein voegt in de DNS-instellingen een **CNAME-record** toe: naam `app`, waarde `rijkenk.github.io`.
2. Daarna komt in de hoofdmap een bestand `CNAME` met `app.uitsmijters55.nl`, en zet je in GitHub bij **Settings > Pages** het vinkje **Enforce HTTPS** aan.
3. Wie `app.uitsmijters55.nl` opent, komt automatisch in de U55-app.

## Een nieuwe versie uitrollen

Pas de bestanden aan en verhoog `VERSIE` in `u55/sw.js`, zodat telefoons de nieuwe versie ophalen. GitHub Pages zet de wijziging binnen een paar minuten online.
