# Deutsch Trainer 1.9.41 – náročnejšie míľniky slovnej zásoby

**Kompletná lokálna PWA.** Zachováva všetky funkcie 1.9.3 vrátane 150 prioritných výrazov na lekciu, 15 otázok v levele, záverečného 50-otázkového testu, tolerancie umlautov a tlačidiel na vymazanie progresu/databázy. **Nepotrebuje Supabase ani Google prihlasovanie.**

## Novinka 1.9.41 — zlato 2 000, diamant 2 500

V sekcii **Štatistiky → Achievements** pribudla samostatná karta **Osvojená slovná zásoba** s progressbarom a najbližším cieľom. Slovníkové odznaky sa počítajú zo **skutočne osvojených rôznych výrazov**, nie z množstva kliknutí alebo z počtu odpovedí.

| Osvojených výrazov | Odznak |
| ---: | --- |
| 100 | 🌱 Prvý míľnik |
| 250 | 🥉 Bronz |
| 500 | 🥉 Bronz+ |
| 1 000 | 🥈 Striebro |
| 1 500 | 🥈 Striebro+ |
| **2 000** | **🥇 Zlato** |
| **2 500** | **💎 Diamant** |

**Čo je osvojený výraz:** minimálne dva úspešné **samostatné** preklady z nemčiny do slovenčiny, minimálne jeden opačným smerom, a úspechy minimálne v dvoch rôznych dňoch. Výber z ponúknutých možností nie je písanie. Počítajú sa všetky záznamy v lokálnej databáze (aj rozširujúce), nie iba 150 prioritných na lekciu. Počítadlo **Osvojené** v štatistikách teraz používa to isté prísnejšie kritérium, takže po aktualizácii môže ukázať nižšie číslo; žiadna história sa nevymazala. Diamant s pevným cieľom 2 500 je možné získať len pri slovníku s aspoň 2 500 položkami.

Pôvodný odznak „Rôzne výrazy“ (počet iba raz precvičených položiek) bol nahradený jediným jednoduchým míľnikom „Spoznal som 500 výrazov“, aby sa nemýlil s naozaj osvojenými slovami. Ostatné úspechy (odpovede, série, gramatika, denné úlohy, kategórie, skúšky) zostávajú.

**Ochrana postupu:** žiadna zmena databázovej schémy; achievements sa vypočítajú zo zachovaných údajov. Stačí aktualizovať súbory, nie znovu importovať JSON. Pred aktualizáciou si aj tak exportuj kompletnú zálohu. Rozbehnuté kolo dokonči ešte v starej verzii.

## Inštalácia 1.9.41

Nahraj súbory aplikácie do koreňa repozitára, najmä `index.html`, `app.js`, `extras.js`, `styles.css`, `duo-game.js`, `spaced.js` a `sw.js`, a potom otvor `https://martintomcikmt.github.io/deutsch-trainer/?v=1.9.41`. V ZIP sú tiež oba pôvodné slovníkové JSON súbory; ak ich už máš importované, **znovu ich neimportuj**. Nevymazávaj site data / IndexedDB.

---

## Funkcie prevzaté z 1.9.4

1. **Skladanie viet funguje aj vo vyšších leveloch.** Opravená chyba, keď gramatické otázky odstránili `buildSentence` a `clozeChoice` z desať-otázkovej prvej fázy. Teraz je pre každý dostupný vhodný príklad rezervovaný priestor na skladanie celej vety, doplnenie slova z 3 možností, párovanie 5 dvojíc, nové preklady a gramatiku. Ak v aktuálne preberaných výrazoch nie je vhodná veta, použije sa preberaná alebo iná veta z tej istej importovanej lekcie. Úplne nová pomocná veta sa najprv zobrazí s prekladom.
2. **Dlhodobé míľniky:** prvých 100, 250, 500, 1000 odpovedí; ďalej 2500, 5000, 10000 až 25000. Samostatne sa sledujú správne odpovede, skutočne osvojené výrazy, dokončené levely, bezchybné kolá a gramatika.
3. **Denná séria a rekordy:** aktuálna séria, najdlhšia séria a história predchádzajúcich sérií. Po prestávke sa najdlhší rekord nestráca. Aktuálna séria zostáva aktívna do konca nasledujúceho dňa po poslednom tréningu.
4. **Zvládnutie kategórií:** odznaky za všetky prioritné slovesá, frázy, podstatné mená a ostatné výrazy *v každej lekcii*, aj za ich zvládnutie v celom kurze. Zvládnutie znamená opakované úspešné **samostatné písanie oboma smermi počas aspoň dvoch rôznych dní**, nie iba kliknutie na správnu možnosť.
5. **Špeciálne úspechy:** bezchybné 15/15 kolá, návraty po dvojdňovej pauze, náprava predchádzajúcich chýb a dokončenie denných výziev.
6. **Tri denné úlohy:** 15 odpovedí, z toho 10 správne, a 5 rôznych výrazov. Od levelu 3 je voliteľný bonus 3 správne gramatické otázky. Denné úlohy sa automaticky obnovia o miestnej polnoci; prehľad je na domovskej obrazovke aj v Štatistikách.

## Poznámka o počítaní

Jedna otázka párovania päť dvojíc môže uložiť päť samostatných odpovedí. Míľniky a denné úlohy počítajú uložené odpovede vrátane jednotlivých párov. Skutočne osvojené položky sa počítajú zvlášť podľa pravidiel opakovania.

Rekordy a denné výzvy sa vypočítavajú zo zachovanej histórie odpovedí, takže sa prenesú spolu so zálohou a nevyžadujú novú databázovú schému. Reset pokroku vynuluje aj tieto štatistiky. Pri zmene časovej zóny sa denná aktivita interpretuje podľa miestneho času súčasného zariadenia.

## Poznámky k aktualizácii zo starších verzií 1.9.2 a 1.9.3

1. **Najprv dokonči rozbehnuté kolo.** Potom v aplikácii otvor `Import a zálohy → Stiahnuť kompletnú zálohu`.
2. Rozbaľ ZIP a nahraj obsah aplikácie do koreňa vetvy `main` repozitára `MartinTomcikMT/deutsch-trainer` (nahraď existujúce súbory; z nových je dôležitý aj `extras.js`).
3. Otvor `https://martintomcikmt.github.io/deutsch-trainer/?v=1.9.41`, skontroluj štítok `v1.9.41`. Pri starej verzii použi tlačidlo obnovenia alebo Ctrl+Shift+R. **Nevymazávaj údaje stránky ani IndexedDB.**
4. Nový JSON nemusíš znovu importovať, pokiaľ už máš slovník z 1.9.2/1.9.3. Ak začínaš od nuly, v ZIP máš prioritný a kompletný import; stačí jeden.

Načítanie starých slovíčok, odpovedí a dokončených levelov je zachované; žiadna migračná operácia ani zmena názvu IndexedDB nie je potrebná.

## Ďalšie verzie

Pozri `ROADMAP_2.0-3.0.md`. Jazykové mutácie sú v 2.0, cloud a OAuth v 3.0, viac jazykov a samostatné kurzy v 4.0 a špecializovaná gramatika v 5.0.
