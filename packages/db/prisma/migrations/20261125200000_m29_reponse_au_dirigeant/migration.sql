-- M29.7 — la réponse qui cite un message du dirigeant vaut mention : l'extrait
-- du message cité, gardé sur le message qui y répond.
ALTER TABLE "messages" ADD COLUMN "quoted_self_text" TEXT;
