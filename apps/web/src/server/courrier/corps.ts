// L'HYGIÈNE DU CORPS d'un e-mail, la même pour tous les fournisseurs (M5.3,
// M24.3) : le fil cité retiré d'une réponse, le HTML aplati en texte, le HTML
// d'origine gardé seulement quand il apporte quelque chose. Module PUR.

/**
 * Retire le fil cité d'une réponse email. Les clients (Apple Mail, Gmail,
 * Outlook…) recopient l'historique sous une ligne d'attribution — « Le … a
 * écrit : », « On … wrote: », « -----Message d'origine----- » — suivie de lignes
 * préfixées « > ». On ne veut afficher QUE la nouvelle réponse dans Relvo.
 *
 * ⚠️ On ne peut PAS se fier au seul début de ligne : selon le client (et surtout
 * après aplatissement du HTML → texte), l'attribution et les chevrons se
 * retrouvent AU MILIEU d'une ligne (« … tu veux bien. > Le 27 juil. 2026 à
 * 23:15, x@y a écrit : > > Merci… »). On coupe donc INLINE à la première
 * attribution rencontrée (ancrage fiable : un mot déclencheur + une date/heure +
 * « a écrit : »/« wrote: »/« escribió: »), puis on retombe sur le découpage par
 * ligne pour les cas normaux. Best-effort, multilingue.
 */
export function sansFilCite(text: string): string {
  let t = text;

  // 1) Coupe INLINE à la ligne d'attribution (tolère les newlines aplaties).
  //    « Le <…date…> a écrit : » / « On <…date…> wrote: » / « El <…> escribió: ».
  //    ⚠️ Le déclencheur (le/on/el) DOIT être précédé d'un saut de ligne ou d'un
  //    chevron « > » : en français « On » et « Le » sont trop courants pour
  //    ancrer sur une simple espace (« On va faire LE test… » n'est pas une
  //    citation). Le \d exigé entre le déclencheur et le verbe écarte en plus la
  //    prose (« Le rapport que Marie a écrit : » n'a ni chevron ni date).
  const inlineAttribution =
    /(?:\n|>)\s*(?:le|on|el)\s[^\n]*?\d[^\n]*?(?:a\s+écrit|wrote|escribió)\s*:/i;
  const mAttr = inlineAttribution.exec(t);
  if (mAttr) t = t.slice(0, mAttr.index);

  // 2) Séparateurs explicites (transferts, Outlook).
  const separator =
    /(?:^|\n)\s*(?:-{2,}\s*(?:message d'origine|original message|forwarded message)|_{5,})/i;
  const mSep = separator.exec(t);
  if (mSep) t = t.slice(0, mSep.index);

  // 3) Cas normal : lignes citées « > » présentes en début de ligne.
  const kept: string[] = [];
  for (const line of t.split(/\r?\n/)) {
    if (/^\s*>/.test(line)) break;
    kept.push(line);
  }

  return kept
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s*>+\s*$/, "") // chevrons résiduels devant l'attribution coupée
    .trim();
}

/** Corps lisible : on privilégie le texte brut (nettoyé du fil cité), sinon on
 *  dé-balise le HTML après avoir retiré les blocs de citation. */
export function texteLisible(corps: {
  plain: string | null | undefined;
  html: string | null | undefined;
}): string | null {
  if (corps.plain?.trim()) {
    return sansFilCite(corps.plain) || null;
  }
  if (corps.html?.trim()) {
    const text = corps.html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      // Blocs cités Gmail/Outlook retirés AVANT le dé-balisage.
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, " ")
      .replace(/<div[^>]*gmail_quote[\s\S]*?<\/div>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      // Décodage minimal APRÈS retrait des balises : les chevrons cités arrivent
      // souvent en `&gt;` — sans décodage l'ancre « > » du nettoyage ne les voit
      // pas. (Sûr ici : plus aucune balise à ré-introduire.)
      .replace(/&gt;/gi, ">")
      .replace(/&lt;/gi, "<")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();
    // Après aplatissement, l'attribution/les chevrons deviennent inline : la
    // même passe que le texte brut les retire (les blockquotes n'attrapent pas
    // les citations Apple Mail, qui n'en utilisent pas toujours).
    return sansFilCite(text) || null;
  }
  return null;
}

/**
 * Corps HTML d'origine, conservé pour un rendu FIDÈLE (l'iframe isolé s'occupe de
 * l'isolation CSS et bloque le JS). Null si l'e-mail n'a pas de partie HTML.
 *
 * ⚠️ On ne garde le HTML QUE pour les e-mails RICHES (une image embarquée :
 * newsletters, signatures visuelles, marketing). Pour une simple RÉPONSE, le
 * HTML n'apporte rien de plus que le texte — mais il embarque le FIL CITÉ
 * (attribution + chevrons littéraux d'Apple Mail) qu'on ne sait pas retirer
 * proprement d'un HTML « texte déguisé ». Dans ce cas on renvoie null : le rendu
 * retombe sur `texteLisible`, déjà nettoyé du fil cité. C'est ce qui élimine la
 * pollution « > Le 27 juil. … a écrit : > > … » vue dans le fil.
 */
export function htmlFidele(html: string | null | undefined): string | null {
  if (!html?.trim()) return null;
  const propre = html.replace(/<script[\s\S]*?<\/script>/gi, "").trim();
  if (!propre) return null;
  // Pas d'image → réponse « texte déguisé » : on préfère le texte brut nettoyé.
  if (!/<img\b/i.test(propre)) return null;
  // E-mail riche : on garde le HTML, en retirant au passage les blocs de
  // citation faciles (blockquote / conteneur gmail_quote), best-effort.
  const cleaned = propre
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<div[^>]*gmail_quote[\s\S]*?<\/div>/gi, "")
    .trim();
  return cleaned || propre;
}

/** « Karim Benali <karim@sogood.fr> » → l'adresse en minuscules et le nom, s'il y en a un. */
export function adresseEtNom(brut: string | null | undefined): {
  adresse: string | null;
  nom: string | null;
} {
  if (!brut) return { adresse: null, nom: null };
  const t = brut.trim();
  const m = /^(.*?)<([^<>]+)>\s*$/.exec(t);
  if (m) {
    const nom =
      m[1]!
        .trim()
        .replace(/^"(.*)"$/, "$1")
        .trim() || null;
    return { adresse: m[2]!.trim().toLowerCase() || null, nom };
  }
  const adresse = t.replace(/^<|>$/g, "").trim().toLowerCase();
  return { adresse: adresse || null, nom: null };
}

/** Une ligne « To » ou « Cc » → les adresses, dans l'ordre. Les virgules entre guillemets ne séparent pas. */
export function adressesDe(ligne: string | null | undefined): string[] {
  if (!ligne) return [];
  const parts: string[] = [];
  let courant = "";
  let guillemets = false;
  for (const c of ligne) {
    if (c === '"') guillemets = !guillemets;
    if (c === "," && !guillemets) {
      parts.push(courant);
      courant = "";
    } else {
      courant += c;
    }
  }
  parts.push(courant);
  return parts
    .map((p) => adresseEtNom(p).adresse)
    .filter((a): a is string => Boolean(a));
}
