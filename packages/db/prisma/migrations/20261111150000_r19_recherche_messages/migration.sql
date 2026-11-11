-- R19 — la recherche de messages de l'échange devient plein texte et classée
-- (05 §11.6). Même mécanisme que les sujets (`subjects_search_vector`) : un
-- vecteur français tenu par TRIGGER, jamais écrit par le code applicatif, et
-- pas de base vectorielle (invariant 29).
--
-- Accents indifférents : le dictionnaire français ne rapproche pas « goûter »
-- de « gouter » ni « réponse » de « reponse » — or un message WhatsApp s'écrit
-- souvent sans accents. Le vecteur porte donc les DEUX formes de chaque texte,
-- telle quelle et sans accents ; la requête fait de même, mot par mot.

-- Sans extension (rien à installer chez l'hébergeur de la base) : les lettres
-- accentuées du français et de ses voisins, et les deux ligatures.
CREATE FUNCTION "sans_accents"(t text) RETURNS text AS $$
  SELECT replace(replace(replace(replace(
    translate(t,
      'àâäáãåéèêëíìîïóòôöõúùûüçñÿÀÂÄÁÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑŸ',
      'aaaaaaeeeeiiiiooooouuuucnyAAAAAAEEEEIIIIOOOOOUUUUCNY'),
    'œ', 'oe'), 'Œ', 'OE'), 'æ', 'ae'), 'Æ', 'AE')
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- Le vecteur d'un message : l'objet, le nom de l'expéditeur et le texte brut.
-- Le texte est borné — un vecteur a une taille maximale, et le début d'un
-- e-mail fleuve suffit à le retrouver.
CREATE FUNCTION "message_search_vector"(objet text, expediteur text, contenu text)
RETURNS tsvector AS $$
  SELECT to_tsvector('french', t) || to_tsvector('french', "sans_accents"(t))
  FROM (SELECT concat_ws(' ', objet, expediteur, left(contenu, 100000)) AS t) s
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

ALTER TABLE "messages" ADD COLUMN "search_vector" tsvector;

-- Un message qu'on ne sait pas indexer ENTRE quand même : la recherche est un
-- service rendu au message, jamais une condition de sa réception.
CREATE FUNCTION "messages_search_vector"() RETURNS trigger AS $$
BEGIN
  BEGIN
    NEW."search_vector" :=
      "message_search_vector"(NEW."subject_line", NEW."sender_name", NEW."content");
  EXCEPTION WHEN OTHERS THEN
    NEW."search_vector" := NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "messages_search_vector"
    BEFORE INSERT OR UPDATE OF "subject_line", "sender_name", "content"
    ON "messages"
    FOR EACH ROW EXECUTE FUNCTION "messages_search_vector"();

-- Remplissage des messages existants (le trigger ne rejoue pas le passé).
UPDATE "messages" SET "search_vector" =
    "message_search_vector"("subject_line", "sender_name", "content");

CREATE INDEX "messages_search_vector_idx" ON "messages" USING GIN ("search_vector");
