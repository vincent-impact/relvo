-- La nature « indésirable » (spam, arnaque, tentative de fraude) — une
-- cinquième nature de l'avis de tri, et la raison d'ignorance qui en dérive
-- quand c'est Relvo qui fait taire.
ALTER TYPE "TriageNature" ADD VALUE 'unwanted';
ALTER TYPE "IgnoreReason" ADD VALUE 'unwanted';
