# Deutsch Trainer 1.9.2 – kompletná lokálna verzia

**Google prihlásenie a Supabase sú zámerne odložené na 2.0.** Táto verzia nevyžaduje žiadne prihlasovanie, cloudovú konfiguráciu ani externý JavaScript a funguje na GitHub Pages aj offline.

## Novinky v sérii 1.9

- **Duolingo podľa Begegnungen A2+** – základ približne 150 výrazov na lekciu vrátane dôležitých slovies, 30 úrovní po 5 výrazoch (pri migrácii starých dokončených úrovní ich môže byť viac), 15 otázok v každom kole, 5 záverečných opakovaní a návrat k chybným slovám. Úspech v kole vyžaduje najmenej 12 správnych odpovedí. Výber používa tagy `Jadro A2+ L1` až `L8` z aktualizovaného JSON.
- **Opravené odpovede** – `seit` uzná ako `od`; vysvetlenia v zátvorkách a gramatické poznámky nie sú povinné. Zachované alternatívne preklady, `ß ↔ ss`, umlauty a veľké písmená.
- **Odznaky** – desať úspechov v štatistikách za odpovede, počet precvičených slov, levely, perfektné kolá a denné série.
- **Časový pozdrav** – automaticky sa mení medzi Guten Morgen / Guten Tag / Guten Abend / Gute Nacht podľa hodín zariadenia, aj keď stránka zostane otvorená.
- **Reset priamo v aplikácii** – Import a zálohy → Správa uložených údajov.

## Dva typy resetu

1. **Vynulovať iba progres** – zmaže históriu odpovedí, rozložené opakovanie, úspechy, štatistiky a uložené Duolingo levely, pričom **všetky slovíčka, preklady a lekcie zostanú**. Po dokončení začneš od Levelu 1.
2. **Vymazať celú databázu** – zmaže slovíčka, lekcie, výsledky, štatistiky aj odznaky. Na stránke Import môžeš následne vložiť nový JSON a začať od prvého levelu. **Kód aplikácie zostane zachovaný**.

Obe operácie sú atomické transakcie v IndexedDB: pri zlyhaní sa transakcia neuloží napoly. Obe operácie majú potvrdzovací dialóg s ručným prepísaním slova `RESET` alebo `VYMAZAT`. Nemusíš otvárať vývojárske nástroje prehliadača.

**Pred resetom si odporúčame stiahnuť kompletnú JSON zálohu.** Len záloha s `backup: true` obnovuje tiež predchádzajúci progres. Bežný učebný import JSON progres nevráti.

## Inštalácia na GitHub Pages

1. Pred aktualizáciou vytvor v starej aplikácii **Import a zálohy → Stiahnuť kompletnú zálohu**. Nemaž IndexedDB, cache prehliadača ani údaje stránky.
2. Nahraj **rozbalený obsah ZIP do rootu `main`** svojho GitHub repozitára: `index.html`, `app.js`, `spaced.js`, `duo-game.js`, `extras.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `ukazkove-slovicka.json`, priečinok `icons` a `.nojekyll`. Súbory Supabase (`cloud.js`, `cloud-features.js`, `cloud-config.js` ani `cloud-schema.sql`) verzia 1.9.2 nepotrebuje. Ak v repozitári už existujú, môžu ostať ako nepoužívané, ale nie sú súčasťou balíka.
3. Otvor `https://martintomcikmt.github.io/deutsch-trainer/?v=1.9.2` a over štítok verzie `v1.9.2`.
4. Po aktualizácii importuj **jeden** z pripravených JSON: `A2plus-jadro-lekcie-1-8.json` (učivo na približne 150 výrazov v každej lekcii) alebo `A2plus-kompletny-slovnik-1-8.json` (celý slovník s rozšírením). Nový import doplní existujúce záznamy a nevymaže tvoje odpovede.
5. Ak chceš začať s nulovým progresom ale rovnakým slovníkom, použi **Vynulovať iba progres**. Ak chceš odstrániť aj staré importy a mať výlučne najnovší slovník, použi **Vymazať celú databázu** a potom naimportuj jeden z nových JSON.

### Súbory v ZIP

- `A2plus-jadro-lekcie-1-8.json`: prioritné učivo, vrátane slovies z prehľadov kapitol, vhodné na nový začiatok.
- `A2plus-kompletny-slovnik-1-8.json`: rozšírená databáza na vyhľadávanie a vlastný tréning.
- Ostatné: kompletná webová aplikácia, PWA ikony a offline servisný worker.

**Upozornenie:** Obe JSON databázy vznikli ako študijné materiály odvodené z učebnice; nie sú oficiálnym úplným slovníkom vydavateľa a preklady neboli všetky individuálne pedagogicky overené.

## Ochrana dát a ďalšie smerovanie

Údaje v 1.9.2 zostávajú **výlučne v IndexedDB aktuálneho prehliadača**. Nie sú prístupné na druhom zariadení. Ak vymažeš údaje stránky, stratíš aj databázu. Cloudová synchronizácia, Google prihlásenie a oddelenie používateľských účtov sú plánované až pre verziu **2.0**. Synchronizácia ani cloud samy osebe nenahrádzajú samostatné zálohovanie.
