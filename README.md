# Deutsch Trainer 1.0

Osobný webový slovník a tréner nemčiny – bez plateného API a bez povinného používateľského účtu.

## Funkcie
- Slovník: slovesá, podstatné mená, frázy, ostatné výrazy; vyhľadávanie, úprava a mazanie.
- Slovné druhy: pri podstatných menách člen a plurál; pri slovesách Präteritum (er/sie/es) a Perfekt (er/sie/es).
- Precvičovanie: preklad do nemčiny, členy, množné číslo, Präteritum, Perfekt, mix; písané odpovede alebo kartičky.
- Jednoduchý plán opakovania (nie plný FSRS): po chybe o 10 minút, po správnej odpovedi v rastúcich intervaloch.
- Štatistiky úspešnosti, počet záznamov a obsah na opakovanie.
- Import JSON pripraveného v ChatGPT, kontrola duplicít, dopĺňanie chýbajúcich polí.
- Kompletná záloha/obnovenie JSON vrátane histórie odpovedí.
- PWA: po prvom otvorení cez HTTPS možno použiť aj offline, ak prehliadač podporuje Service Worker.

## Ako spustiť NA WEBE: GitHub Pages (bez lokálneho Gitu)
1. Na github.com vytvor repozitár, napr. `deutsch-trainer`.
2. Nahraj **obsah tohto priečinka**, vrátane adresára `icons`, priamo do koreňa repozitára pomocou **Add file → Upload files**.
3. V **Settings → Pages** nastav **Build and deployment → Deploy from a branch → main / (root)** a ulož.
4. Po zverejnení otvor adresu uvedenú v **Settings → Pages**. Spravidla má tvar `https://TVOJE_MENO.github.io/deutsch-trainer/`.
5. V Chrome alebo Edge môžeš aplikáciu nainštalovať z menu prehliadača ako webovú aplikáciu.

Poznámka: Na GitHub dávaš len kód aplikácie, **nie súkromný export databázy**. GitHub Pages môže vyžadovať verejný repozitár podľa typu účtu.

## Ako spustiť lokálne
Projekt je statický, bez kompilácie a bez npm. V termináli v priečinku so súbormi spusti:

```sh
python -m http.server 8000
```

Potom otvor `http://localhost:8000/`. Na Windows môže fungovať aj `py -m http.server 8000`.

Nespúšťaj program dvojklikom na `index.html` cez `file://`, pretože IndexedDB a Service Worker sa môžu v tomto režime správať odlišne.

## Ako pridať učivo cez ChatGPT
1. Klikni **Import a zálohy → Skopírovať prompt pre ChatGPT**.
2. Vlož prompt do ChatGPT a pod neho dopíš nové slovíčka.
3. Skopíruj odpoveď vo formáte JSON a vlož do poľa pre import (alebo nahraj JSON súbor).
4. Klikni na **Skontrolovať import**, skontroluj počty a až potom **Potvrdiť import**.
5. Aplikácia nepridá duplicitné slovíčka s rovnakou dvojicou typ + nemecký základný tvar. Pri existujúcich doplní len prázdne údaje a prípadné nové kategórie.

Ukážka schémy:

```json
{
  "format": "deutsch-trainer",
  "version": 1,
  "entries": [
    {
      "type": "verb", "de": "gehen", "sk": "ísť pešo",
      "preterite": "ging", "perfect": "ist gegangen", "auxiliary": "sein",
      "exampleDe": "Ich gehe nach Hause.", "exampleSk": "Idem domov.",
      "level": "A1", "tags": ["Pohyb"]
    },
    {
      "type": "noun", "de": "Arzt", "sk": "lekár", "article": "der",
      "plural": "die Ärzte", "level": "A1", "tags": ["Zdravie"]
    }
  ]
}
```

`de` pri podstatnom mene neobsahuje člen. `preterite` a `perfect` sú tvary pre er/sie/es. `tags` je voliteľné pole kategórií. `alternatives` je voliteľné pole iných uznávaných prekladov.

## Aktualizácia programu
Nahraj novú verziu `index.html`, `app.js`, `styles.css`, prípadne ďalších súborov do toho istého GitHub repozitára. Prehliadač si načíta novú verziu webu. Lokálna databáza IndexedDB ostáva oddelená; pri budúcich zmenách jej štruktúry musí kód obsahovať migračné kroky. Pred väčšou aktualizáciou vždy stiahni JSON zálohu.

## Obmedzenia 1.0
- Bez cloudovej synchronizácie. PC a mobil majú svoje vlastné údaje; na presun slúži JSON export/import.
- Porovnávanie napísanej odpovede ignoruje veľkosť písmen, okrajovú interpunkciu a nadbytočné medzery, ale **rozlišuje umlauty a ß**.
- Štatistika opakovania je po jednotlivých záznamoch, nie po každom časovanom tvare zvlášť.
- Automatická kontrola voľnej odpovede nehodnotí synonymá alebo voľný slovosled bez vopred zadaných alternatív.
- Pre plnú obnovu histórie importuj zálohu do prázdnej databázy. Pri zlučovaní s už existujúcimi položkami zostane aktuálny progres existujúcich záznamov zachovaný.
- Webové fonty sú voliteľné a pri offline prevádzke sa používa systémové písmo, keď nie sú dostupné.
