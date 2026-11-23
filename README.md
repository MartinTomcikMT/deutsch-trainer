# Deutsch Trainer 1.8 – 15 úloh, levely, chytré opakovanie

Webová aplikácia na učenie nemčiny z vlastného slovníka a z učebnice **Begegnungen A2+**. Zachováva voľný Vlastný tréning a prináša výrazne prepracovaný Duolingo režim.

## Čo je nové oproti 1.7

- **Presne 15 úloh na jedno Duolingo kolo**, počet sa už nenastavuje.
- **Úrovne:** Každá knižná lekcia má pri 40 základných výrazoch 8 úrovní po 5 nových výrazov. Pri menšom počte slov sa počet úrovní automaticky upraví.
- **Prvých 10 úloh:** päť úvodných výrazov, striedanie prekladov oboma smermi, párovanie piatich výrazov, dopĺňanie do celej vety z 3 možností a skladanie vety z klikateľných slov (s 2 rušivými slovami). Pre chýbajúcu celú vetu sa doplňovačka alebo skladanie nepoužije.
- **Posledných 5 úloh:** opakovanie prednostne tých výrazov, pri ktorých si urobil chybu; ak ich nie je dosť, aplikácia zopakuje iné aktuálne alebo skôr problematické slová.
- **Pravidlo postupu:** aspoň 12 správnych z 15 úloh. Ak nedosiahneš 12, zostávaš na rovnakej úrovni. Ak dokončíš poslednú úroveň Lekcie 1, odomkne sa Lekcia 2 (ak máš jej obsah naimportovaný).
- **Predchádzajúce lekcie sa vracajú:** staršie problematické slová a slová pripravené na opakovanie sa objavujú aj v neskorších úrovniach.
- **Gramatika prichádza postupne:** ak je sloveso preukázateľne zvládnuté a si vo vyššej úrovni, môže sa objaviť Perfekt; pred prvou takou otázkou sa zobrazí vysvetlenie. Začiatočníci sa najprv učia význam.
- **Vlastný tréning zostáva voľný:** vyberáš si ľubovoľnú naimportovanú lekciu, slovíčka, podstatné mená, slovesá, frázy alebo gramatiku, počet otázok aj smer prekladu.
- Zachované: uznávanie `ss` namiesto `ß`, umlauty bez diakritiky (`Schüler` = `schuler` alebo `schueler`), malé písmená, viac alternatívnych slovenských prekladov, Enter na potvrdenie / ďalšiu otázku.

## Používanie

1. Na úvodnej stránke vyber **Duolingo režim**.
2. Vyber aktuálnu **lekciu**. Zamknuté lekcie sa nedajú v Duolingu spustiť.
3. Pozri si aktuálnu **úroveň z ôsmich** a klikni na **Spustiť Duolingo tréning**.
4. Prvýkrát videné slová sa zobrazia s významom a prípadným príkladom. Prejdi 10 úloh, potom 5 záverečných opakovaní.
5. Ak máš aspoň 12/15 správne, odomkne sa ďalšia úroveň. Po 8 úrovniach pokračuje ďalšia lekcia.

## Technické informácie a bezpečnosť údajov

Aplikácia používa pôvodnú lokálnu IndexedDB databázu s názvom `deutsch-trainer-v1`. Verzia databázovej schémy sa zvyšuje **z 1 na 2**, len kvôli novej dátovej kolekcii `meta` pre postup úrovní. Staré slovíčka, odpovede a história zostávajú v rovnakých kolekciách. Nové úrovne 1.8 sa začnú od prvej úrovne; predchádzajúce správne a nesprávne odpovede sa nemažú a ďalej sa používajú pri opakovaní. Snapshot základného balíka 40 slov sa ukladá po prvom začatí lekcie, aby ďalšie importy nemiešali poradie úrovní.

**Cloudová databáza NIE JE vytvorená.** Toto vydanie neobsahuje Supabase, online prihlásenie ani synchronizáciu medzi zariadeniami. Slovník aj pokrok sú stále iba v prehliadači. Kompletná JSON záloha od 1.8 obsahuje okrem `entries` a `attempts` aj `duoProgress`, takže vie obnoviť aj dokončené úrovne. Aplikácia automaticky nič neodkladá na externý server.

## Aktualizácia GitHub Pages

1. **Najprv** v existujúcej aplikácii otvor **Import a zálohy → Stiahnuť kompletnú zálohu** a odlož súbor.
2. Zatvor ostatné karty s Deutsch Trainer, aby neblokovali aktualizáciu IndexedDB.
3. V repo `MartinTomcikMT/deutsch-trainer`, vetva `main`, priečinok `/ (root)`, nahraď z tohto balíka súbory:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `spaced.js`
   - `sw.js`
   - **`duo-game.js` (nový súbor, musíš pridať!)**
4. Ostatné súbory v ZIP (`manifest.webmanifest`, ikony, demo JSON) môžeš ponechať alebo tiež aktualizovať; hlavne neumiestni aplikáciu do ďalšieho priečinka.
5. Po ukončení GitHub Pages nasadenia otvor `https://martintomcikmt.github.io/deutsch-trainer/?v=1.8` a skontroluj štítok `v1.8`.
6. Ak vidíš starú verziu, použij tlačidlo **Obnoviť aplikáciu**, prípadne `Ctrl + Shift + R`; **nepoužívaj Vymazať údaje stránky**, prišiel by si o lokálnu databázu.

### Testovanie

Overené v testovacom prehliadači s 1617 importovanými záznamami z troch lekcií: 15 úloh, párovanie piatich párov, doplňovačka s tromi možnosťami, skladanie vety vrátane rušivých slov, opakovanie na konci, výsledok 14/15 a odomknutie ďalšej úrovne, nulový postup pri neúspešnom kole, zámok lekcie 2/3, dostupnosť Lekcie 3 vo Vlastnom tréningu, zachovanie tolerantného pravopisu. JavaScript prešiel syntaktickou kontrolou.

**Obmedzenie testov:** testovacie prostredie blokuje otvorenie lokálnej URL, a preto migrácia databázy IndexedDB a nasadenie na GitHub Pages nie sú plne otestované v reálnom pôvodnom prehliadači. Pred aktualizáciou preto urob zálohu.
