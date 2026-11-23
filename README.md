# Deutsch Trainer 1.1 — lekcie a cielené precvičovanie

Aktualizovaná verzia pôvodnej aplikácie Deutsch Trainer 1.0. **Najprv si v starej aplikácii stiahni zálohu** (Import a zálohy → Export celej databázy). Nová verzia zachováva rovnakú databázu IndexedDB: `deutsch-trainer-v1`, jej verziu 1, aj formát importu/exportu JSON verzie 1.

## Čo sa zmenilo vo verzii 1.1

- Pred tréningom si vyberieš **konkrétnu lekciu** alebo všetky lekcie. V menu sa zobrazia len lekcie, ktoré už naozaj máš v slovníku.
- Samostatne môžeš zapnúť/vypnúť 4 druhy učiva: **podstatné mená**, **ostatné slovíčka**, **slovesá** a **frázy/vety**. Môžeš kombinovať viac druhov.
- Vieš obmedziť učivo aj podľa **témy (kategórie)** a **časti A/B/C/D** z učebnice, ak import obsahuje príslušné tagy.
- Vyberieš si typ otázky (preklad, členy, množné číslo, Präteritum, Perfekt alebo mix), odpovedanie (písanie/kartičky), počet otázok (5/10/20/30/50) a plán opakovania.
- Ešte **pred spustením** aplikácia ukáže počet vhodných položiek a otázok. Ak sa nastavenia nedajú precvičiť (napr. Perfekt len z podstatných mien), nedovolí spustiť prázdny tréning.
- **Môj slovník** má filter lekcií aj tém; zobrazuje najprv 45 záznamov a ďalšie načíta po kliknutí. Nemusíš listovať všetkých 758 naraz.
- Pri vytváraní alebo úprave záznamu pribudlo pole **Učebnica / lekcia** s nápovedou už známych lekcií. Pri ďalšom importe sa lekcie ponúknu automaticky.
- Kliknutie na **Spustiť tréning** na domovskej obrazovke už nespúšťa automaticky náhodné otázky: otvorí nastavenie, kde si vyberieš učivo.

## Príklad: lekcia 1 — slovesá — Perfekt — 10 otázok

1. Otvor **Precvičovanie**.
2. V poli **Učebnica / lekcia** vyber **Lekcia 1 · Ausbildung und Tätigkeiten**.
3. Zaškrtni **Slovesá** a odškrtni zvyšné druhy.
4. V poli **Typ otázok** vyber **Perfekt**.
5. Nechaj **Počet otázok: 10** a klikni **Začať precvičovanie**.

Alebo zaškrtni iba **Frázy a vety** a nastav **Preklady do nemčiny**. Z lekcie môžeš vyberať aj menšie témy, napríklad „Škola a vzdelávanie“ alebo „Denný režim“.

## Ako aktualizovať už nainštalovanú webovú aplikáciu

1. V starej aplikácii klikni **Import a zálohy → Stiahnuť kompletnú zálohu JSON** a súbor bezpečne odlož.
2. Na GitHube otvor **ten istý** repozitár, cez ktorý máš zverejnenú starú aplikáciu.
3. Nahraj z rozbaleného ZIP-u súbory **index.html, app.js, styles.css, sw.js, README.md** a potvrď **nahradenie existujúcich súborov**. Ostatné súbory ostávajú rovnaké. Názvy a cesty sú dôležité.
4. Po publikovaní znovu otvor **tú istú URL GitHub Pages**. Ak by sa ti stále zobrazovala verzia 1.0, obnov stránku pomocou `Ctrl + Shift + R`, prípadne aplikáciu zavri a znovu otvor. Service Worker má nové číslo cache.
5. Skontroluj sekciu **Môj slovník**. Existujúce záznamy aj história by sa mali načítať automaticky, pokiaľ používaš **rovnakú adresu, prehliadač a jeho profil**. **Nenahrávaj zálohu na verejný GitHub.**

Ak používaš program lokálne, stačí v tom istom priečinku nahradiť uvedené súbory a spustiť `python -m http.server 8000` (na Windows aj `py -m http.server 8000`). Ak si aplikáciu presunul na inú adresu/origin, databáza sa automaticky neprenesie: vtedy si do novej inštalácie importuj súkromnú zálohu.

**Dôležité:** Ak si už naimportoval 758 záznamov z prvej lekcie, **nemusíš ich importovať znova** — nová verzia ich iba filtruje. Ak ešte nie, použi predchádzajúci JSON súbor (formát sa nemení).

## Pridávanie lekcií cez ChatGPT

Pri novom JSON súbore nechaj každému záznamu vyplniť pole `lesson`, napríklad:

```json
{"format":"deutsch-trainer","version":1,"entries":[
  {"type":"noun","de":"Hobby","sk":"záľuba","article":"das","plural":"die Hobbys","lesson":"Begegnungen A2+ – Lekcia 2","tags":["Voľný čas"]},
  {"type":"verb","de":"lesen","sk":"čítať","preterite":"las","perfect":"hat gelesen","auxiliary":"haben","lesson":"Begegnungen A2+ – Lekcia 2","tags":["Voľný čas"]}
]}
```

Aplikácia rozpozná aj varianty `Begegnungen A2+ (3. vydanie) – Lekcia 1` či `Lekcia 1` a zaradí ich spolu do tej istej lekcie. Záznamy bez priradenej lekcie uvidíš pod **Bez priradenej lekcie**. Odlišné učebnice s rovnakým číslom lekcie zatiaľ neoddeľuje (táto verzia je pripravená primárne pre Begegnungen A2+).

Import: **Import a zálohy → Vybrať súbor → Skontrolovať import → Potvrdiť import**. Import ignoruje duplicitné kombinácie typu a nemeckého základného tvaru a uchováva existujúce výsledky. Ak sa to isté slovo objaví vo viacerých lekciách, verzia 1.1 uloží ďalšie priradenia do voliteľného poľa `lessons` (pole reťazcov). Udržuje jediný slovníkový záznam a existujúci progres. Pri importe ďalšej lekcie ho automaticky zaradí aj do jej výberu. Pri zálohe cez 1.1 sa toto pole exportuje. Import zálohy do staršej 1.0 nie je vhodný, lebo 1.0 pole `lessons` nepozná.

## Technické detaily a obmedzenia

- Statická PWA pre PC/mobil, bez servera, bez plateného API.
- `IndexedDB` drží slovník a pokrok v danom prehliadači. GitHub Pages poskytuje len súbory aplikácie.
- Žiadna synchronizácia PC a mobilu: na presun používaš import/export súkromnej zálohy JSON.
- Tréningový mix môže obsahovať niekoľko druhov úloh z jednej položky; hodnotenie opakovania je stále na úrovni záznamu, nie na úrovni jednotlivých gramatických tvarov.
- Porovnávanie napísaných odpovedí rozlišuje nemecké umlauty a ß. Voľné synonymá musia byť uložené ako alternatívne odpovede.
- `lesson` je nepovinný text a `tags` je pole vlastných kategórií; časti A–D sa vyhodnotia iba pri záznamoch, ktoré takéto tagy obsahujú.
