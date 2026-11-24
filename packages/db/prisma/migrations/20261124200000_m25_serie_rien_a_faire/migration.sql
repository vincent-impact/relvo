-- M25.11 — la série de « rien à faire » sûrs d'une conversation : combien
-- d'avis consécutifs disent qu'il n'y a rien à faire, en confiance haute.
-- Relvo n'ignore un interlocuteur de messagerie qu'au bout de plusieurs.
ALTER TABLE "conversations"
  ADD COLUMN "noise_streak" INTEGER NOT NULL DEFAULT 0;
