# Deutsch Trainer 1.9.3 – aktualizácia učenia A2+

**Kompletná lokálna verzia aplikácie.** Vychádza z 1.9.2 a obsahuje aj všetky jej funkcie. Nepotrebuje Supabase, Google OAuth ani ďalší účet. Cloudová synchronizácia a prihlásenie sú stále plánované pre **2.0**.

## Novinky 1.9.3

1. **Výraznejšie otázky a celé vety:** Hlavný text na preklad má na desktopoch približne 29–43 px, na mobile najmenej 27 px; sprievodné informácie sú čitateľnejšie. Pri skladaní slov je veľkým písmom slovenská veta, ktorú má študent preložiť.
2. **Vyvážené opakovanie:** Z doterajších slov vyberá zmes problematických, starších/opakovaných aj správne zvládnutých. Chybné výrazy majú vyššiu prioritu, nie však 100 % otázok. Po 10 úvodných úlohách nasleduje 5 záverečných opakovaní; medzi nimi sú pri dostupnosti aj dobre zvládnuté výrazy.
3. **Gramatika už od Levelu 3:** Do úvodných desiatich úloh sa pravidelne vkladajú 2 otázky podľa rotácie Perfekt, Präteritum, články/plurál a určité členy v Akkusatíve/Datíve. Ak je to možné, na záverečnom opakovaní pribudne ešte gramatika. Použité tvary pochádzajú z naimportovaných polí `perfect`, `preterite`, `article` a `plural`. Pred prvým skúšaním neznámeho gramatického tvaru zobrazí náhľad so správnym riešením. **Úplné skloňovanie prídavných mien a všetkých osobných zámen zatiaľ nie je implementované.**
4. **Záverečný test lekcie:** Po dokončení všetkých 30 (alebo viac pri migrácii) levelov nasleduje test s **50 otázkami**. Test vyberá výrazové kategórie a typy cvičení naprieč *celou* prioritnou slovnou zásobou danej lekcie; nepýta sa na všetkých 150 výrazov jednotlivo. Obsahuje **minimálne 13 gramatických úloh** (4 Perfekt, 4 Präteritum, 2 skloňovanie člena, 2 plurál, 1 člen), preklady aj úlohy s vetami, ak sú dostupné. Na postup treba aspoň **40/50** a **6 správnych gramatických odpovedí**. Pri neúspechu sa test dá zopakovať s iným výberom. Až úspešný test odomkne nasledujúcu lekciu.
5. **Achievements 42 odznakov:** Viacstupňové dlhodobé ciele pre počet otázok, správne odpovede, počet rôznych výrazov, dokončené levely, záverečné testy, bezchybné 15/15 kolá, denné série a jednotlivé gramatické oblasti. Napredovanie vidíš na indikátoroch. Dlhodobá séria zostáva započítaná aj po jej prerušení.

## Úplné pokrytie *Begegnungen A2+*?

Prioritný výber má **150 položiek v každej z ôsmich lekcií**, ale **nie je to úplný výpis každej povinnej frázy, každého príkladu alebo gramatického pravidla**. Obsah lekcií sa líši, pevné číslo 150 je praktická priorita, nie pedagogický dôkaz úplnosti. Údaje obsahujú 32–45 slovies na lekciu a pri všetkých prioritných slovesách sú vyplnené `perfect` a `preterite`; zatiaľ sú to prevažne **tvary er/sie/es**, nie cvičenia časovania všetkých osôb. Pri podstatných menách je vyplnený člen a pri väčšine aj plurál. V budúcej verzii má zmysel vykonať samostatný audit povinných úloh častí A/C a záverečných prehľadov D každého kapitolu.

## Zálohy, import a kompatibilita

- Pred aktualizáciou si vždy stiahni **Import a zálohy → Stiahnuť kompletnú zálohu**.
- Ak máš už najnovšiu databázu 1.9.2, **nemusíš nanovo importovať JSON**. Aplikácia pri aktualizácii mení plánovanie cvičení, nie slovník.
- Pre nový začiatok je v ZIP `A2plus-jadro-lekcie-1-8.json` (iba prioritné) a `A2plus-kompletny-slovnik-1-8.json` (prioritné a rozšírené). Importuj len jeden z nich. `ukazkove-slovicka.json` je demonštračný súbor a nemusíš ho importovať.
- História, progres, dokončené levely aj obe resetovacie funkcie zostávajú kompatibilné s 1.9.2; záverečný test sa zavádza až teraz. Ak si mal už všetky levely kapitoly, po aktualizácii sa ti zobrazí záverečný test pred odomknutím ďalšej kapitoly.
- Údaje zostávajú v **IndexedDB tvojho prehliadača**. Automatické cloudové zálohovanie zatiaľ nie je dostupné.

## Nahratie na GitHub Pages

1. Rozbaľ ZIP a nahraj obsah do **koreňa vetvy `main`** existujúceho repo `MartinTomcikMT/deutsch-trainer`.
2. Dôležité sú všetky aplikačné súbory: `index.html`, `app.js`, `duo-game.js`, `spaced.js`, `extras.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `.nojekyll`, priečinok `icons` a `ukazkove-slovicka.json`. Súbory JSON so slovníkmi zostávajú na stiahnutie alebo import, nie sú automaticky načítané pri štarte.
3. Otvor `https://martintomcikmt.github.io/deutsch-trainer/?v=1.9.3` a skontroluj štítok **v1.9.3**. Pri zobrazovaní starej verzie použi **Obnoviť aplikáciu** alebo v prehliadači Ctrl+Shift+R; nevymazávaj údaje stránky.
4. Spusti aspoň jeden level Duolinga a skontroluj úlohy aj Štatistiky → Úspechy a odznaky.

## Plánované vyššie verzie

Pozri `ROADMAP_2.0-3.0.md` v tomto ZIP. Súčasná verzia 1.9.3 **ešte neumožňuje** prihlásenie cez Google ani štúdium ľubovoľných jazykových párov. Importy iných kníh sa v 1.x nemajú miešať do rovnakých čísel lekcií, pretože zatiaľ neexistuje samostatný identifikátor kurzu.

### Overenie

Prešli syntaktické kontroly všetkých JS súborov, testy pre všetkých osem základných importov, výber gramatických úloh, pomer opakovania problémových a zvládnutých výrazov a simulovaný prechod 15-otázkovým levelom a 50-otázkovým testom v prehliadači. Skutočný IndexedDB prehliadača, nasadený GitHub Pages a migráciu na tvojom zariadení treba overiť pri nasadení.
