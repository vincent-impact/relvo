-- Corps HTML des e-mails (2026-07-22)
--
-- On captait déjà le HTML entrant (`mail.body` d'Unipile) mais on le JETAIT :
-- seul le texte dé-balisé était stocké dans `content`, d'où un rendu illisible
-- (pavé sans mise en forme). On ajoute une colonne pour conserver le HTML
-- d'origine, rendu ensuite dans un iframe isolé.
--
-- Purement additive, nullable, sans backfill : les e-mails déjà reçus n'ont pas
-- de HTML stocké et continuent de s'afficher en texte (repli). Les nouveaux
-- e-mails porteront leur HTML.

ALTER TABLE "messages" ADD COLUMN "content_html" TEXT;
