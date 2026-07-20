-- M6bis — Refonte « Conversation » (2026-07-20)
--
-- Introduit la couche de TRANSPORT entre Message et Subject. Trois mouvements :
--   1. nouvelles entités Conversation + SubjectConversation ;
--   2. `messages.conversation_id` NON NULLABLE — d'où le backfill, qui est le
--      vrai contenu de cette migration (première du projet à CRÉER de la donnée
--      plutôt qu'à déplacer des colonnes) ;
--   3. `SubjectStatus` passe de 4 à 3 valeurs (`ignored` migre sur la
--      Conversation, `archived` disparaît).
--
-- Le backfill réimplémente en SQL la normalisation d'objet de
-- `normalizeSubjectLine()` (packages/db/src/domain/messages.ts). Les deux
-- doivent rester d'accord : si l'une change, une réponse cesserait de rejoindre
-- la conversation de son message de départ. Un test verrouille cet accord.

-- ─────────────────────────────────────────────────────────────
-- 1. Enums
-- ─────────────────────────────────────────────────────────────

CREATE TYPE "ConversationType" AS ENUM ('email_subject', 'whatsapp_group', 'whatsapp_direct');
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'ignored');

-- ─────────────────────────────────────────────────────────────
-- 2. Tables
-- ─────────────────────────────────────────────────────────────

CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "type" "ConversationType" NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contact_id" UUID,
    "interlocutor_raw" TEXT,
    "external_thread_id" TEXT,
    "normalized_subject" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'active',
    "last_message_at" TIMESTAMP(3),
    "last_message_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversations_account_id_key_key" ON "conversations"("account_id", "key");
CREATE INDEX "conversations_account_id_idx" ON "conversations"("account_id");
CREATE INDEX "conversations_account_id_status_last_message_at_idx" ON "conversations"("account_id", "status", "last_message_at");
CREATE INDEX "conversations_account_id_channel_id_idx" ON "conversations"("account_id", "channel_id");

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "subject_conversations" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "anchor_message_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subject_conversations_subject_id_conversation_id_key" ON "subject_conversations"("subject_id", "conversation_id");
CREATE INDEX "subject_conversations_account_id_idx" ON "subject_conversations"("account_id");
CREATE INDEX "subject_conversations_conversation_id_idx" ON "subject_conversations"("conversation_id");

ALTER TABLE "subject_conversations" ADD CONSTRAINT "subject_conversations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_conversations" ADD CONSTRAINT "subject_conversations_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_conversations" ADD CONSTRAINT "subject_conversations_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_conversations" ADD CONSTRAINT "subject_conversations_anchor_message_id_fkey" FOREIGN KEY ("anchor_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- 3. messages.conversation_id — ajouté NULLABLE le temps du backfill
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "messages" ADD COLUMN "conversation_id" UUID;

-- ─────────────────────────────────────────────────────────────
-- 4. Backfill — expand / backfill / contract
--
-- `msg_key` calcule, pour CHAQUE message existant, le triplet (type, clé, titre)
-- qu'aurait produit l'ingestion d'aujourd'hui. L'interlocuteur se lit sur
-- `sender_raw` pour un entrant, et sur le contact destinataire pour un sortant
-- (il n'existe pas de `recipient_raw` en base). Un interlocuteur non résolu
-- donne une chaîne vide plutôt qu'un NULL : la clé reste bien formée et le
-- message est rangé, ce qui est tout ce qu'exige la contrainte NOT NULL.
-- ─────────────────────────────────────────────────────────────

-- Table de travail ORDINAIRE, pas TEMP : une table temporaire vit dans la
-- session et `ON COMMIT DROP` la supprimerait dès le premier commit si le
-- moteur de migration ne joue pas le fichier dans une transaction unique. On
-- la supprime explicitement en fin de migration.
CREATE TABLE "_m6bis_msg_key" AS
WITH base AS (
    SELECT
        m.id,
        m.account_id,
        m.channel_id,
        ch.type AS channel_type,
        m.is_group,
        m.external_thread_id,
        m.sender_name,
        COALESCE(m.received_at, m.sent_at, m.created_at) AS occurred_at,
        -- Interlocuteur brut, normalisé en minuscules pour que la clé soit stable
        -- quelle que soit la casse d'écriture de l'adresse ou du numéro.
        COALESCE(
            NULLIF(LOWER(BTRIM(
                CASE WHEN m.direction = 'incoming' THEN m.sender_raw ELSE COALESCE(rc.email, rc.phone) END
            )), ''),
            ''
        ) AS interlocutor,
        COALESCE(m.sender_contact_id, m.recipient_contact_id) AS contact_id,
        -- Réimplémentation SQL de normalizeSubjectLine() : retrait des préfixes
        -- de réponse/transfert (y compris répétés « Re: Re: » et multilingues),
        -- écrasement des espaces, minuscules.
        COALESCE(
            BTRIM(REGEXP_REPLACE(
                REGEXP_REPLACE(
                    LOWER(BTRIM(m.subject_line)),
                    '^((re|ré|rep|rép|répondre|réf|ref|fw|fwd|tr|aw|antw|answer|rv)\s*(\[[0-9]+\])?\s*:\s*)+',
                    '',
                    'i'
                ),
                '\s+', ' ', 'g'
            )),
            ''
        ) AS normalized_subject,
        m.subject_line
    FROM "messages" m
    JOIN "channels" ch ON ch.id = m.channel_id
    LEFT JOIN "contacts" rc ON rc.id = m.recipient_contact_id
)
SELECT
    b.*,
    CASE
        WHEN b.channel_type = 'whatsapp' AND b.is_group THEN 'whatsapp_group'::"ConversationType"
        WHEN b.channel_type = 'whatsapp' THEN 'whatsapp_direct'::"ConversationType"
        ELSE 'email_subject'::"ConversationType"
    END AS conv_type,
    CASE
        -- Groupe : le fil EST l'identité. Sans chat_id (cas théorique), on
        -- retombe sur l'id du message pour ne pas fusionner des groupes distincts.
        WHEN b.channel_type = 'whatsapp' AND b.is_group
            THEN 'wa-group:' || COALESCE(NULLIF(b.external_thread_id, ''), b.id::text)
        -- Direct : l'interlocuteur EST l'identité (une seule conversation directe
        -- par contact, pour toujours). Repli sur le fil si le numéro manque.
        WHEN b.channel_type = 'whatsapp'
            THEN 'wa-direct:' || COALESCE(NULLIF(b.interlocutor, ''), 'thread:' || COALESCE(b.external_thread_id, b.id::text))
        ELSE 'email:' || b.interlocutor || ':' || b.normalized_subject
    END AS conv_key
FROM base b;

-- Une conversation par clé distincte. Le titre et l'interlocuteur sont pris sur
-- le message le PLUS ANCIEN de la clé (l'objet d'origine, pas le « Re: »).
INSERT INTO "conversations" (
    "id", "account_id", "channel_id", "type", "key", "title",
    "contact_id", "interlocutor_raw", "external_thread_id", "normalized_subject",
    "status", "last_message_at", "created_at", "updated_at"
)
SELECT
    gen_random_uuid(),
    f.account_id,
    f.channel_id,
    f.conv_type,
    f.conv_key,
    CASE
        WHEN f.conv_type = 'whatsapp_group'
            -- Titre NEUTRE, jamais le nom de l'expéditeur : le nom du groupe n'a
            -- jamais été stocké avant M6bis, et intituler le groupe « Nordine »
            -- le ferait passer pour une conversation directe avec Nordine —
            -- un placeholder honnête vaut mieux qu'un nom faux. Le vrai nom
            -- arrive par la passe de rattrapage Unipile getChat() (M6bis.7).
            THEN 'Groupe WhatsApp'
        WHEN f.conv_type = 'whatsapp_direct'
            THEN COALESCE(NULLIF(BTRIM(f.sender_name), ''), NULLIF(f.interlocutor, ''), 'Conversation')
        ELSE COALESCE(NULLIF(BTRIM(f.subject_line), ''), '(sans objet)')
    END,
    -- Un groupe n'a JAMAIS de contact : il n'a pas d'interlocuteur unique, il EST
    -- l'interlocuteur.
    CASE WHEN f.conv_type = 'whatsapp_group' THEN NULL ELSE f.contact_id END,
    CASE WHEN f.conv_type = 'whatsapp_group' THEN NULL ELSE NULLIF(f.interlocutor, '') END,
    f.external_thread_id,
    CASE WHEN f.conv_type = 'email_subject' THEN f.normalized_subject ELSE NULL END,
    'active',
    agg.last_message_at,
    NOW(),
    NOW()
FROM (
    SELECT DISTINCT ON (account_id, conv_key) *
    FROM "_m6bis_msg_key"
    ORDER BY account_id, conv_key, occurred_at ASC, id ASC
) f
JOIN (
    SELECT account_id, conv_key, MAX(occurred_at) AS last_message_at
    FROM "_m6bis_msg_key"
    GROUP BY account_id, conv_key
) agg ON agg.account_id = f.account_id AND agg.conv_key = f.conv_key;

UPDATE "messages" m
SET "conversation_id" = c.id
FROM "_m6bis_msg_key" k
JOIN "conversations" c ON c.account_id = k.account_id AND c.key = k.conv_key
WHERE m.id = k.id;

DROP TABLE "_m6bis_msg_key";

-- Dernier message de chaque conversation — support du KPI « Sans sujet »
-- (« le dernier message n'est rattaché à aucun sujet »).
UPDATE "conversations" c
SET "last_message_id" = t.id
FROM (
    SELECT DISTINCT ON (m.conversation_id) m.conversation_id, m.id
    FROM "messages" m
    WHERE m.conversation_id IS NOT NULL
    ORDER BY m.conversation_id, COALESCE(m.received_at, m.sent_at, m.created_at) DESC, m.id DESC
) t
WHERE t.conversation_id = c.id;

-- ─────────────────────────────────────────────────────────────
-- 5. Contract — la colonne devient obligatoire
--
-- Si cette instruction échoue, c'est qu'un message n'a pas trouvé sa
-- conversation : le backfill est incomplet, et la migration doit être rejouée
-- corrigée plutôt que la contrainte relâchée. La contrainte EST la garantie
-- « plus aucun message orphelin ».
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "messages" ALTER COLUMN "conversation_id" SET NOT NULL;

CREATE INDEX "messages_account_id_conversation_id_idx" ON "messages"("account_id", "conversation_id");
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Posé après le backfill : la FK ne peut viser un message qu'une fois les
-- messages rattachés à leur conversation.
CREATE UNIQUE INDEX "conversations_last_message_id_key" ON "conversations"("last_message_id");
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_last_message_id_fkey" FOREIGN KEY ("last_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- 6. Fenêtres rétroactives — un SubjectConversation par (sujet, conversation)
-- déjà matérialisé par les messages. L'ancre est le message le plus ancien du
-- sujet dans cette conversation : c'est bien là que la fenêtre s'est ouverte.
-- ─────────────────────────────────────────────────────────────

INSERT INTO "subject_conversations" ("id", "account_id", "subject_id", "conversation_id", "anchor_message_id", "created_at")
SELECT gen_random_uuid(), t.account_id, t.subject_id, t.conversation_id, t.anchor_message_id, NOW()
FROM (
    SELECT DISTINCT ON (m.subject_id, m.conversation_id)
        m.account_id,
        m.subject_id,
        m.conversation_id,
        m.id AS anchor_message_id
    FROM "messages" m
    WHERE m.subject_id IS NOT NULL
    ORDER BY m.subject_id, m.conversation_id, COALESCE(m.received_at, m.sent_at, m.created_at) ASC, m.id ASC
) t;

-- ─────────────────────────────────────────────────────────────
-- 7. SubjectStatus : 4 valeurs → 3
--   acknowledged → open       (la fenêtre est ouverte)
--   resolved     → validated  (le travail est fait)
--   archived     → closed     (état système supprimé)
--   ignored      → closed     (l'ignorance migre sur la Conversation)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "subjects" ADD COLUMN "closed_at" TIMESTAMP(3);

-- Posé AVANT la conversion, tant que les anciennes valeurs sont encore lisibles.
UPDATE "subjects"
SET "closed_at" = COALESCE("resolved_at", "last_activity_at", "updated_at")
WHERE "status"::text IN ('resolved', 'archived', 'ignored');

ALTER TYPE "SubjectStatus" RENAME TO "SubjectStatus_old";
CREATE TYPE "SubjectStatus" AS ENUM ('open', 'validated', 'closed');

ALTER TABLE "subjects" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "subjects" ALTER COLUMN "status" TYPE "SubjectStatus" USING (
    CASE "status"::text
        WHEN 'acknowledged' THEN 'open'
        WHEN 'resolved' THEN 'validated'
        ELSE 'closed'
    END
)::"SubjectStatus";
ALTER TABLE "subjects" ALTER COLUMN "status" SET DEFAULT 'open';

DROP TYPE "SubjectStatus_old";
