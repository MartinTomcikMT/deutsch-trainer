# Deutsch Trainer 1.5 – Duolingo a Vlastný tréning bez zamieňania

## Čo sa zmenilo

**Duolingo režim** sa učí po lekciách. V každej lekcii vyberá základný balík najviac 40 výrazov zo všetkých štyroch kategórií (podstatné mená, slovesá, frázy, ostatné slová). Z voliteľnej časti B učebnice nevyberá do povinného jadra. V režime miešaného učenia sa striedajú nové a preberané položky. Nové slovo sa najprv ukáže s prekladom; potom sa skúša nemecky → slovensky. Opačný smer sa objaví pri opakovaní. Dopĺňačky, členy, množné čísla, Präteritum a Perfekt prichádzajú až po zvládnutí významu oboma smermi aspoň v dvoch dňoch, pri prvom výskyte s vysvetľujúcou kartičkou.

**Postup do ďalšej lekcie:** Odmknutie vyžaduje zvládnutie celého základného balíka predchádzajúcej lekcie. Výraz sa považuje za zvládnutý pri aspoň dvoch správnych odpovediach DE→SK, aspoň jednej správnej SK→DE a úspechoch v aspoň dvoch rozličných dňoch. Aj odomknutá lekcia potrebuje vlastný import. Pokrok je viditeľný v paneli pri výbere lekcie. Pokrok získaný pred aktualizáciou sa počíta, pokiaľ v databáze obsahuje záznamy jednotlivých smerov.

**Vlastný tréning** má všetky naimportované lekcie od začiatku dostupné, nezávisle od postupu v Duolingu. Výber „Slovesá“ znamená predvolene iba preklady slovies, „Frázy“ iba frázy, „Podstatné mená“ iba podstatné mená. Po prepnutí kategórie sa otázky vrátia na jednoduchý preklad DE→SK. Gramatiku možno zapnúť výlučne v rozbalenej časti „Pokročilé možnosti“.

## Aktualizácia (GitHub Pages)

1. Na starej verzii klikni **Import a zálohy → Stiahnuť kompletnú zálohu** a odlož JSON bezpečne (nezverejňuj ho v GitHub repozitári).
2. Obsah ZIP rozbaľ. V repozitári `MartinTomcikMT/deutsch-trainer` nahraď v **hlavnom priečinku vetvy `main`** súbory `index.html`, `app.js`, `spaced.js`, `styles.css`, `sw.js` (ostatné súbory môžu zostať). Nenahrávaj vnorený priečinok `deutsch-trainer-v1.5` ako jediný súbor.
3. Na GitHub Pages zostáva nastavené `main` a `/ (root)`. Po publikovaní otvor `https://martintomcikmt.github.io/deutsch-trainer/?v=1.5` v súkromnom okne a skontroluj štítok **v1.5**.
4. V bežnom Chrome obnov stránku cez **Ctrl + Shift + R** alebo tlačidlom **Obnoviť aplikáciu ↻**. Nevymazávaj IndexedDB ani údaje stránky!

Používa sa pôvodná lokálna databáza IndexedDB `deutsch-trainer-v1`, JSON formát a verzia 1. Existujúce slovíčka a história odpovedí sa nemažú. Údaje sa zatiaľ nesynchronizujú medzi zariadeniami.

## Poznámka

Základný balík je praktický výber z importovaného materiálu, nie celý obsah 758 položiek prvej lekcie. Väčší slovník zostáva dostupný v Môj slovník a vo Vlastnom tréningu. Po pridaní nových záznamov sa môže zmeniť výber základného balíka; preto si pred výraznou úpravou importov odlož zálohu.
