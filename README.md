# Deutsch Trainer 1.3 – učenie opakovaním, vlastný tréning a štatistiky

## Čo je nové

- **Učenie opakovaním**: voľba lekcie, typov slovíčok a dĺžky tréningu (5/10/15/20). Strieda sa DE→SK, SK→DE, dopĺňanie chýbajúceho slova do frázy a občasné slovesné časy. Pri chybe sa otázka vráti ešte počas toho istého kola.
- **Rozložené opakovanie**: úspechy sa ukladajú podľa slova **aj smeru/typu otázky**. Úspešné odpovede plánujeme znovu približne o 1, 3, 7, 14, 30 a 60 dní. Chybné odpovede plánujeme na skoršie opakovanie; pri najbližšom učení sa uprednostnia otázky, ktorým práve uplynul termín. Toto je vlastný jednoduchý algoritmus, nie oficiálny algoritmus Duolingo.
- **Vlastný tréning** zostáva zachovaný: lekcia, typ učiva, smer, počet otázok aj gramatické režimy.
- **Štatistiky**: dnes, posledných 7 dní, úspešnosť, nové slová, séria dní, osvojené slová, opakovanie a problematické slová. „Nové“ znamená prvýkrát precvičené položky; „osvojené“ znamená aspoň 3 po sebe správne odpovede z určitého typu otázky a úspechy aspoň počas 2 rôznych dní.
- Nové tlačidlo **Obnoviť aplikáciu ↻** aktualizuje súbory webu, neodstraňuje lokálnu databázu.

## Ako bezpečne aktualizovať z verzie 1.0 / 1.1 / 1.2

1. V tvojej starej stránke otvor **Import a zálohy → Stiahnuť kompletnú zálohu JSON**. Odlož súbor mimo verejného GitHubu.
2. Rozbaľ celý ZIP **Deutsch Trainer 1.3**.
3. Otvor správny GitHub repozitár a **NAHRAĎ VŠETKY SÚBORY V KORENI PUBLIKOVANÉHO PRIEČINKA**, nie do podpriečinka `deutsch-trainer-v1.3`. Nahraj: `index.html`, `styles.css`, `app.js`, **`spaced.js` (nový)**, `sw.js`, `manifest.webmanifest`, `ukazkove-slovicka.json`, `.nojekyll` a priečinok `icons` (ikonky zvyčajne môžeš ponechať). Ak GitHub Pages používa vetvu `main` a `/ (root)`, v repozitári musí byť `index.html` priamo pri koreni, nie napríklad v `deutsch-trainer-v1.3/index.html`.
4. Otvor v GitHube **Settings → Pages** a skontroluj, z ktorej vetvy a priečinka sa stránka publikuje. Pri nasadení cez Actions pozri **Actions**, či posledné nasadenie prešlo.
5. Otvor svoju adresu s `?test=130` pripojeným za koniec cesty pred `#` (napr. `https://pouzivatel.github.io/deutsch-trainer/?test=130`). Zobrazená verzia v hornej časti musí byť **v1.3**.
6. Ak vidíš starú verziu, obnov stránku `Ctrl+Shift+R` alebo v Chrome/Edge: F12 → Application → Service Workers → **Unregister** (len Service Worker), a v Cache Storage odstráň iba `deutsch-trainer-static-*` cache, potom obnov. **NIKDY neklikaj na Clear site data / Vymazať údaje stránky, ak nemáš zálohu.** Môže to vymazať IndexedDB vrátane slovíčok.
7. Pri nezmenenej URL, rovnakom prehliadači a profile sa používajú tie isté údaje v IndexedDB `deutsch-trainer-v1`. Návrat k staršej verzii aplikácie nie je potrebný.

**Dôležité:** `DB_VERSION = 1` vo vnútri zdrojového kódu je *verzia databázovej schémy*, nie verzia aplikácie. Nápis v záhlaví `v1.3` patrí verzii používateľského rozhrania.

## Príklad učenia

**Učenie opakovaním → Lekcia 1 → Slovesá + Podstatné mená + Frázy → 10 otázok.** Aplikácia vyberie najskôr slová na opakovanie, potom zopár nových; nasledujú otázky `der Beruf` → `povolanie`, `povolanie` → `der Beruf` a prípadne veta s chýbajúcim slovom. Po zlej odpovedi sa rovnaká otázka zaradí ešte do aktuálneho kola a znovu na neskoršie opakovanie.

## Údaje, offline a obmedzenia

- Slovník aj história odpovedí zostávajú **len v tomto prehliadači**. PC a telefón sa bez synchronizačného servera neprepoja.
- JSON formát je stále `{"format":"deutsch-trainer","version":1,"entries":[...]}` a je kompatibilný s predchádzajúcimi verziami. Zálohy z 1.0–1.2 sa importujú. História odpovedí a už uložené jednoduché opakovanie sa zachovajú; nové plánovanie osobitne pre každý smer sa buduje z nových odpovedí verzie 1.3.
- Textové hodnotenie uznáva uvedené preklady a základné alternatívy, nie všetky možné synonymá alebo gramaticky prípustné formulácie. V prípade chybného vyhodnotenia doplň `alternatives` do JSON pri importe.
- Nie sú tu push notifikácie ani umelá inteligencia hodnotiaca voľný text. Termíny opakovania sa prejavia pri najbližšom spustení aplikácie.
- Pri zmene domény, protokolu alebo profilu prehliadača treba obnoviť dáta z exportovanej zálohy.
