-- M10 (M18.9) — la portée « compte » d'une question de Relvo (02, RelvoQuestion ;
-- 05 §11.11) : une étape de la prise en main ou du rattrapage parle au compte,
-- pas à une fiche.
--
-- ⚠️ Seule dans sa migration : PostgreSQL refuse d'UTILISER une valeur d'énuméré
-- ajoutée dans la même transaction (« unsafe use of new value »). La contrainte
-- qui s'en sert vient dans la migration suivante.
ALTER TYPE "QuestionScope" ADD VALUE 'account';
