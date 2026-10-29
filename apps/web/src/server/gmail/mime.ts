// LE MESSAGE À ENVOYER, en MIME, à la main (M24.5) : pas de SDK, rien de lourd
// dans le bundle, et testable sans réseau. Texte et HTML côte à côte
// (`multipart/alternative`), l'objet et les noms encodés quand ils portent un
// accent (RFC 2047), le fil par `In-Reply-To` et `References`. Les corps sont
// en base64, lignes de 76 : aucun client ne s'y trompe.

export type MessageAEnvoyer = {
  de: string;
  a: { identifier: string; display_name?: string }[];
  objet: string;
  texte: string;
  html: string;
  /** Le `Message-ID` du message auquel on répond, et ses `References`, s'il y en a. */
  enReponseA?: { messageId: string | null; references: string | null } | null;
  date?: Date;
  /** Pour les tests : une frontière de parties fixe. */
  frontiere?: string;
};

const ASCII = /^[\x20-\x7e]*$/;

/** Un mot encodé (RFC 2047) quand le texte sort de l'ASCII ; tel quel sinon. */
export function motEncode(texte: string): string {
  if (ASCII.test(texte)) return texte;
  return `=?UTF-8?B?${Buffer.from(texte, "utf8").toString("base64")}?=`;
}

/** « Nom <adresse> », le nom entre guillemets ou encodé selon ce qu'il porte. */
export function destinataire(d: {
  identifier: string;
  display_name?: string;
}): string {
  const nom = d.display_name?.trim();
  if (!nom) return d.identifier;
  const propre = ASCII.test(nom)
    ? `"${nom.replace(/["\\]/g, "")}"`
    : motEncode(nom);
  return `${propre} <${d.identifier}>`;
}

function base64Plie(texte: string): string {
  const b = Buffer.from(texte, "utf8").toString("base64");
  return b.replace(/(.{76})/g, "$1\r\n").replace(/\r\n$/, "");
}

export function construireMime(m: MessageAEnvoyer): string {
  const frontiere =
    m.frontiere ??
    `relvo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const entetes: string[] = [
    `From: ${m.de}`,
    // Un destinataire par ligne pliée (RFC 5322) : jamais une ligne trop longue.
    `To: ${m.a.map(destinataire).join(",\r\n ")}`,
    `Subject: ${motEncode(m.objet)}`,
    `Date: ${(m.date ?? new Date()).toUTCString()}`,
    "MIME-Version: 1.0",
  ];
  const r = m.enReponseA;
  if (r?.messageId) {
    entetes.push(`In-Reply-To: ${r.messageId}`);
    const refs = [r.references?.trim(), r.messageId].filter(Boolean).join(" ");
    entetes.push(`References: ${refs}`);
  }
  entetes.push(`Content-Type: multipart/alternative; boundary="${frontiere}"`);
  const partie = (type: string, corps: string) =>
    [
      `--${frontiere}`,
      `Content-Type: ${type}; charset="UTF-8"`,
      "Content-Transfer-Encoding: base64",
      "",
      base64Plie(corps),
    ].join("\r\n");
  return [
    entetes.join("\r\n"),
    "",
    partie("text/plain", m.texte),
    partie("text/html", m.html),
    `--${frontiere}--`,
    "",
  ].join("\r\n");
}

/** Le MIME tel que l'API l'attend : base64url, sans remplissage. */
export function rawPourGmail(mime: string): string {
  return Buffer.from(mime, "utf8").toString("base64url");
}
