-- M7 tranche 2 — tout ce que `conception/02-modele-donnees.md` porte de nouveau
-- pour le pipeline IA, en UNE migration, avant le pipeline qui l'écrit.
--
--  - Account : secteurs (tableau), préférences observées.
--  - Contact : rôle et note de Relvo.
--  - Conversation : raison et note d'ignorance ; verdict, catégorie de bruit,
--    confiance, raison et horodatage du tri.
--  - Subject : situation structurée (4 champs + horodatage), étiquettes,
--    domaine proposé, vecteur plein texte tenu par TRIGGER.
--  - Message : origine du contenu (saisi / transcrit).
--  - KnowledgeDocument : RENOMMAGE anthropic_file_id → provider_file_id (jamais
--    un DROP + ADD : la colonne porte des données) ; sujet d'origine.
--  - Nouvelles tables labels et relvo_questions.
--  - Deux contraintes de vérification et un trigger, écrits à la main (02,
--    « Les contraintes que l'ORM ne sait pas exprimer ») et tenus par le test
--    `test/schema-catalogue.test.ts`.

-- CreateEnum
CREATE TYPE "Sector" AS ENUM ('food', 'construction', 'other');

-- CreateEnum
CREATE TYPE "ContactRole" AS ENUM ('supplier', 'customer', 'employee', 'administration', 'partner', 'other');

-- CreateEnum
CREATE TYPE "IgnoreReason" AS ENUM ('advertising', 'prospecting', 'automatic', 'personal', 'not_my_role', 'handled_elsewhere', 'other');

-- CreateEnum
CREATE TYPE "TriageVerdict" AS ENUM ('noise', 'matter', 'uncertain');

-- CreateEnum
CREATE TYPE "TriageConfidence" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "ContentOrigin" AS ENUM ('typed', 'transcribed');

-- CreateEnum
CREATE TYPE "LabelOrigin" AS ENUM ('sector', 'relvo');

-- CreateEnum
CREATE TYPE "LabelStatus" AS ENUM ('candidate', 'active');

-- CreateEnum
CREATE TYPE "QuestionScope" AS ENUM ('contact', 'folder', 'subject');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('open', 'answered', 'dismissed');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "observed_preferences" TEXT,
ADD COLUMN     "observed_preferences_at" TIMESTAMP(3),
ADD COLUMN     "sectors" "Sector"[] DEFAULT ARRAY[]::"Sector"[];

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "relvo_note" TEXT,
ADD COLUMN     "role" "ContactRole";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "ignore_note" TEXT,
ADD COLUMN     "ignore_reason" "IgnoreReason",
ADD COLUMN     "triage_confidence" "TriageConfidence",
ADD COLUMN     "triage_noise_reason" "IgnoreReason",
ADD COLUMN     "triage_reason" TEXT,
ADD COLUMN     "triage_verdict" "TriageVerdict",
ADD COLUMN     "triaged_at" TIMESTAMP(3);

-- AlterTable — renommage, pas de perte : la copie d'inférence reste référencée.
ALTER TABLE "knowledge_documents" RENAME COLUMN "anthropic_file_id" TO "provider_file_id";
ALTER TABLE "knowledge_documents" ADD COLUMN "origin_subject_id" UUID;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "content_origin" "ContentOrigin" NOT NULL DEFAULT 'typed';

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "proposed_folder" TEXT,
ADD COLUMN     "search_vector" tsvector,
ADD COLUMN     "situation_deadline" DATE,
ADD COLUMN     "situation_next_step" TEXT,
ADD COLUMN     "situation_updated_at" TIMESTAMP(3),
ADD COLUMN     "situation_waiting_for" TEXT,
ADD COLUMN     "situation_where" TEXT;

-- CreateTable
CREATE TABLE "labels" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "origin" "LabelOrigin" NOT NULL,
    "status" "LabelStatus" NOT NULL DEFAULT 'candidate',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relvo_questions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "scope" "QuestionScope" NOT NULL,
    "contact_id" UUID,
    "folder_id" UUID,
    "subject_id" UUID,
    "text" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'open',
    "answer" TEXT,
    "origin_subject_id" UUID,
    "asked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relvo_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "labels_account_id_status_idx" ON "labels"("account_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "labels_account_id_key_key" ON "labels"("account_id", "key");

-- CreateIndex
CREATE INDEX "relvo_questions_account_id_status_idx" ON "relvo_questions"("account_id", "status");

-- CreateIndex
CREATE INDEX "relvo_questions_account_id_contact_id_idx" ON "relvo_questions"("account_id", "contact_id");

-- CreateIndex
CREATE INDEX "relvo_questions_account_id_folder_id_idx" ON "relvo_questions"("account_id", "folder_id");

-- CreateIndex
CREATE INDEX "relvo_questions_account_id_subject_id_idx" ON "relvo_questions"("account_id", "subject_id");

-- CreateIndex
CREATE INDEX "subjects_search_vector_idx" ON "subjects" USING GIN ("search_vector");

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_origin_subject_id_fkey" FOREIGN KEY ("origin_subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relvo_questions" ADD CONSTRAINT "relvo_questions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relvo_questions" ADD CONSTRAINT "relvo_questions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relvo_questions" ADD CONSTRAINT "relvo_questions_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relvo_questions" ADD CONSTRAINT "relvo_questions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relvo_questions" ADD CONSTRAINT "relvo_questions_origin_subject_id_fkey" FOREIGN KEY ("origin_subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Contraintes que l'ORM ne sait pas exprimer (02). Chacune est citée dans
-- `conception/02-modele-donnees.md` et vérifiée dans les deux sens par
-- `packages/db/test/schema-catalogue.test.ts`.
-- ─────────────────────────────────────────────────────────────────────────

-- La catégorie d'un verdict n'existe que pour un verdict « bruit », et le tri ne
-- pose jamais « pas mon rôle » ni « déjà traité ailleurs » : seul l'utilisateur
-- les connaît.
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_triage_noise_reason_check"
    CHECK (
      "triage_noise_reason" IS NULL
      OR (
        "triage_verdict" = 'noise'
        AND "triage_noise_reason" IN ('advertising', 'prospecting', 'automatic', 'personal', 'other')
      )
    );

-- Une question de Relvo a EXACTEMENT une cible, celle de sa portée.
ALTER TABLE "relvo_questions" ADD CONSTRAINT "relvo_questions_scope_target_check"
    CHECK (
      ("scope" = 'contact' AND "contact_id" IS NOT NULL AND "folder_id" IS NULL AND "subject_id" IS NULL)
      OR ("scope" = 'folder' AND "folder_id" IS NOT NULL AND "contact_id" IS NULL AND "subject_id" IS NULL)
      OR ("scope" = 'subject' AND "subject_id" IS NOT NULL AND "contact_id" IS NULL AND "folder_id" IS NULL)
    );

-- Vecteur plein texte des sujets (titre + situation structurée), en français,
-- tenu par trigger : le code applicatif n'écrit jamais `search_vector`. Sert à
-- retrouver les précédents par proximité de titre (05 §10.1), sans base
-- vectorielle. Le titre pèse plus (A) que la situation (B).
CREATE FUNCTION "subjects_search_vector"() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('french', coalesce(NEW."title", '')), 'A')
    || setweight(to_tsvector('french', concat_ws(' ',
         NEW."situation_where", NEW."situation_next_step", NEW."situation_waiting_for")), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "subjects_search_vector"
    BEFORE INSERT OR UPDATE OF "title", "situation_where", "situation_next_step", "situation_waiting_for"
    ON "subjects"
    FOR EACH ROW EXECUTE FUNCTION "subjects_search_vector"();

-- Remplissage des sujets existants (le trigger ne rejoue pas le passé).
UPDATE "subjects" SET "search_vector" =
    setweight(to_tsvector('french', coalesce("title", '')), 'A')
    || setweight(to_tsvector('french', concat_ws(' ',
         "situation_where", "situation_next_step", "situation_waiting_for")), 'B');
