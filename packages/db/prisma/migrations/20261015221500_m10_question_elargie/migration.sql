-- M10 (M18.9) — la question de Relvo élargie (02, RelvoQuestion) :
--  - les réponses proposées, quand elle se pose en formulaire (05 §11.11) ;
--  - l'étape de script qui l'a fait naître ;
--  - la contrainte « exactement une cible » apprend la portée « compte », qui
--    n'en a aucune. Récrite à la main (02, « Les contraintes que l'ORM ne sait
--    pas exprimer »), même nom : le catalogue tenu par le test ne bouge pas.

ALTER TABLE "relvo_questions"
    ADD COLUMN "proposed_answers" JSONB,
    ADD COLUMN "origin_step" TEXT;

ALTER TABLE "relvo_questions" DROP CONSTRAINT "relvo_questions_scope_target_check";
ALTER TABLE "relvo_questions" ADD CONSTRAINT "relvo_questions_scope_target_check"
    CHECK (
      ("scope" = 'contact' AND "contact_id" IS NOT NULL AND "folder_id" IS NULL AND "subject_id" IS NULL)
      OR ("scope" = 'folder' AND "folder_id" IS NOT NULL AND "contact_id" IS NULL AND "subject_id" IS NULL)
      OR ("scope" = 'subject' AND "subject_id" IS NOT NULL AND "contact_id" IS NULL AND "folder_id" IS NULL)
      OR ("scope" = 'account' AND "contact_id" IS NULL AND "folder_id" IS NULL AND "subject_id" IS NULL)
    );
