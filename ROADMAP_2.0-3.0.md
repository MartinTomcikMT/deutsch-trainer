# Ďalší vývoj Deutsch Trainer

## Verzia 2.0 – účty, cloud a bezpečná synchronizácia

- Supabase/PostgreSQL, prihlasovanie Google OAuth.
- Oddelenie dát účtov pomocou Row-Level Security (RLS) a overeného vlastníka záznamov.
- Synchronizácia pokroku offline/online, politika riešenia konfliktov a automatické samostatné zálohovanie.
- Stabilné ID používateľa a ID kurzu pripravené na importy ďalších učebníc.

## Verzia 2.x – vlastný kurz z ľubovoľného JSON

- Každý kurz musí mať jedinečné `courseId` (nemiešať "Lekcia 1" z dvoch kníh).
- Každá kapitola `lessonId`, poradie, tematiku, predpoklady na odomknutie a voliteľné priebežné testy.
- Používateľ importuje JSON učebnice, zobrazí náhľad dát, nastaví náročnosť a spustí vlastný kurz.
- Automaticky určený základ sa musí dať skontrolovať a manuálne upraviť; import nemôže sľúbiť úplnosť učebnice bez auditu.
- Pokročilá gramatika: časovanie v rôznych osobách, nepravidelné zmeny kmeňa, skloňovanie zámen a adjektív, Akkusativ/Dativ/Genitiv, predložkové väzby, súvetia.

## Verzia 3.0 – jazykové mutácie a jazykové kombinácie

Päť jazykov: **angličtina (en), nemčina (de), maďarčina (hu), rumunčina (ro), slovenčina (sk)**.

Dve nezávislé voľby: (1) **jazyk rozhrania**, (2) **jazyk, ktorý sa učím, a jazyk, z ktorého prekladám**. Pri možnosti nemecky zo slovenčiny alebo maďarsky z angličtiny musí mať každá položka skutočné preklady v danom jazykovom páre. Nedostupné preklady sa nesmú vymýšľať ani nahrádzať angličtinou bez upozornenia.

Navrhovaný JSON model (ilustrácia, nie importovateľný do v1.9.3):

```json
{
  "format": "language-trainer-course",
  "schemaVersion": 2,
  "courseId": "unique-course-slug",
  "title": "German A2",
  "learningLanguage": "de",
  "translationLanguage": "sk",
  "lessons": [{"id": "lesson-1", "title": "Prvá lekcia", "order": 1}],
  "entries": [{
    "id": "entry-1", "lessonId": "lesson-1", "type": "verb",
    "translations": {"de": ["gehen"], "sk": ["ísť pešo"]},
    "forms": {"de": {"preterite": "ging", "perfect": "ist gegangen"}}
  }]
}
```

Už vo verzii 2.0 treba pripraviť databázové kľúče `userId`, `courseId`, `lessonId`, `entryId` tak, aby migrácia na 3.0 nevyžadovala vymazanie pokroku.
