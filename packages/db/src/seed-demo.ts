/**
 * Seed du jeu de démonstration « Tasty Crousty » — source unique.
 *
 * Exposé comme fonction réutilisable `seedDemoAccount()` : appelée par le script
 * CLI (`prisma/seed.ts`, via `pnpm db:seed`) ET par la Server Action de reset du
 * compte démo (bouton « Réinitialiser » des Réglages, pour les béta-testeurs).
 *
 * Idempotent : le compte démo est supprimé (cascade) puis recréé à chaque appel.
 * L'id du compte est FIXE (DEMO_ACCOUNT_ID) afin qu'une session ouverte survive
 * au reset (le JWT pointe toujours vers le même compte).
 *
 * Contexte métier : Mam's Diallo, co-fondateur de Tasty Crousty (chaîne de
 * fast-food — poulet, riz, sauces) et gérant du restaurant d'Épinay-sur-Seine.
 * Jeu de données étoffé (M9.24) : ~26 sujets répartis sur 6 domaines, 120+ tâches
 * datées sur juin-juillet (agenda + planning bien remplis), messages, brouillons,
 * pièces jointes, connaissances, et des cas « fermé » / « validé » / « sans sujet ».
 */
import { Prisma, prisma, tenantDb } from "./index";
import { seedDemoFiles, seedFileKey } from "./seed-files";
import {
  AbsorptionStatus,
  Actor,
  ChannelType,
  ContactStatus,
  Priority,
  SubjectStatus,
  TaskKind,
  TaskStatus,
} from "./index";
import {
  createAttachment,
  createChannel,
  createContact,
  createDraftReply,
  createFolder,
  createMessage,
  createSubject,
  createTask,
  completeTask,
  closeSubject,
  validateSubject,
  setAiLabel,
  suggestResolution,
} from "./index";

/** Email du compte de démonstration (jeu Tasty Crousty). */
export const DEMO_EMAIL = "demo@tastycrousty.fr";

/** Id fixe du compte démo : la session reste valide après un reset. */
export const DEMO_ACCOUNT_ID = "00000000-0000-4000-8000-0000000000de";

/** Date à H:00 décalée de `days` jours par rapport à aujourd'hui (UTC). */
function dayAt(days: number, hour = 9): { date: Date; time: Date } {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
  );
  const time = new Date(date);
  time.setUTCHours(hour, 0, 0, 0);
  return { date, time };
}

/**
 * Crée le compte démo UNIQUEMENT s'il n'existe pas déjà — non destructif.
 * Pensé pour le déploiement (vercel-build) : provisionne le démo au premier push
 * puis ne touche plus à rien (préserve la progression des béta-testeurs). Le
 * reset complet reste accessible via `seedDemoAccount()` (CLI + bouton Réglages).
 */
export async function seedDemoIfMissing(): Promise<{ created: boolean }> {
  const existing = await prisma.account.findFirst({
    where: { OR: [{ id: DEMO_ACCOUNT_ID }, { email: DEMO_EMAIL }] },
    select: { id: true },
  });
  if (existing) return { created: false };
  await seedDemoAccount();
  return { created: true };
}

/**
 * Stockage à alimenter en fixtures (M4.6). Optionnel : sans lui, le seed pose
 * des lignes dont les fichiers n'existent pas — les documents de la démo
 * renverront « introuvable ». Toléré en dev, signalé bruyamment.
 */
type SeedStorage = Parameters<typeof seedDemoFiles>[0];

export async function seedDemoAccount(storage?: SeedStorage) {
  // 1. Reset idempotent : supprime le compte démo (cascade sur tout le reste).
  //
  // ⚠️ La cascade s'exécute dans PostgreSQL : les clés des `attachments` et
  // `knowledge_documents` effacés ne passent jamais par le code, leurs objets R2
  // ne peuvent donc pas être supprimés ici. C'est `seedDemoFiles()` qui purge le
  // préfixe du compte plus bas — d'où l'ordre : DB d'abord, fichiers ensuite.
  await prisma.account.deleteMany({
    where: { OR: [{ id: DEMO_ACCOUNT_ID }, { email: DEMO_EMAIL }] },
  });

  // 2. Account + Folder « Général » (is_default).
  const account = await prisma.account.create({
    data: {
      id: DEMO_ACCOUNT_ID,
      email: DEMO_EMAIL,
      firstName: "Mam's",
      lastName: "Diallo",
      emailVerified: new Date(),
      // Mot de passe de démo : « demo1234 » (bcrypt, 12 tours). Connexion :
      // demo@tastycrousty.fr / demo1234.
      passwordHash:
        "$2b$12$I1MQwaKyGH7BTJY30LdBnegFL5lECVtWGDV6RqHZI/6qRxkg5bI.C",
    },
  });
  await prisma.folder.create({
    data: {
      accountId: account.id,
      name: "Général",
      slug: "general",
      description:
        "Connaissances transversales chargées dans le contexte de tous les sujets.",
      isDefault: true,
    },
  });

  const db = tenantDb(account.id);

  // Clés des fichiers de démo (M4.6). Déterministes : les fixtures de
  // `prisma/fixtures/` sont poussées sur ces mêmes clés par `seedDemoFiles()`,
  // donc un reset écrase en place au lieu d'accumuler des copies.
  const seedKey = (scope: "knowledge" | "attachments", filename: string) =>
    seedFileKey(account.id, scope, filename);

  // 3. Dossiers métier (domaines de la mémoire de Relvo).
  const rh = await createFolder(db, { name: "RH" });
  const juridique = await createFolder(db, { name: "Juridique" });
  const fournisseurs = await createFolder(db, { name: "Fournisseurs" });
  const business = await createFolder(db, { name: "Business" });
  const production = await createFolder(db, { name: "Production" });
  const communication = await createFolder(db, { name: "Communication" });

  // 4. Canaux (boîtes email + WhatsApp).
  const emailRh = await createChannel(db, {
    name: "Boîte RH",
    type: ChannelType.email,
    identifier: "rh@tastycrousty.fr",
    folderIds: [rh.id],
  });
  const emailSupport = await createChannel(db, {
    name: "Boîte Restaurant",
    type: ChannelType.email,
    identifier: "epinay@tastycrousty.fr",
    folderIds: [fournisseurs.id, production.id, business.id],
  });
  const emailCom = await createChannel(db, {
    name: "Boîte Partenariats",
    type: ChannelType.email,
    identifier: "partenariats@tastycrousty.fr",
    folderIds: [communication.id],
  });
  const wa = await createChannel(db, {
    name: "WhatsApp Gérant",
    type: ChannelType.whatsapp,
    identifier: "+33600000000",
  });

  // 5. Contacts.
  // — Fournisseurs —
  const karim = await createContact(db, {
    firstName: "Karim",
    lastName: "Benali",
    email: "karim@sogood-distribution.fr",
    company: "SoGood Distribution",
    jobTitle: "Responsable commercial",
    defaultFolderId: fournisseurs.id,
    sourceActor: Actor.user,
  });
  const packplus = await createContact(db, {
    lastName: "PackPlus SARL",
    email: "ventes@packplus.fr",
    company: "PackPlus SARL",
    defaultFolderId: fournisseurs.id,
    sourceActor: Actor.ai,
    status: ContactStatus.auto,
  });
  const avipro = await createContact(db, {
    firstName: "Léa",
    lastName: "Fontaine",
    email: "l.fontaine@avipro.fr",
    company: "Avipro Volailles",
    jobTitle: "Commerciale",
    defaultFolderId: fournisseurs.id,
    sourceActor: Actor.user,
  });
  const moulins = await createContact(db, {
    firstName: "Hassan",
    lastName: "Cherif",
    email: "h.cherif@grandsmoulins.fr",
    company: "Grands Moulins (riz & céréales)",
    jobTitle: "Chargé de compte",
    defaultFolderId: fournisseurs.id,
    sourceActor: Actor.user,
  });
  const boissons = await createContact(db, {
    lastName: "France Boissons",
    email: "idf@france-boissons.fr",
    company: "France Boissons",
    defaultFolderId: fournisseurs.id,
    sourceActor: Actor.ai,
    status: ContactStatus.auto,
  });
  // — RH —
  const sophie = await createContact(db, {
    firstName: "Sophie",
    lastName: "Blanchard",
    email: "sophie.blanchard@tastycrousty.fr",
    jobTitle: "Assistante RH",
    defaultFolderId: rh.id,
    sourceActor: Actor.user,
  });
  const yacine = await createContact(db, {
    firstName: "Yacine",
    lastName: "Traoré",
    email: "yacine.traore@tastycrousty.fr",
    jobTitle: "Équipier polyvalent",
    defaultFolderId: rh.id,
    sourceActor: Actor.user,
  });
  const aicha = await createContact(db, {
    firstName: "Aïcha",
    lastName: "Ndiaye",
    email: "aicha.ndiaye@email.com",
    jobTitle: "Candidate — équipier",
    defaultFolderId: rh.id,
    sourceActor: Actor.ai,
    status: ContactStatus.auto,
  });
  // — Juridique —
  const climapro = await createContact(db, {
    lastName: "ClimaPro Services",
    email: "contact@climapro.fr",
    company: "ClimaPro Services",
    defaultFolderId: juridique.id,
    sourceActor: Actor.ai,
    status: ContactStatus.auto,
  });
  const ddpp = await createContact(db, {
    lastName: "DDPP 93",
    email: "ddpp@seine-saint-denis.gouv.fr",
    company: "Direction de la protection des populations",
    jobTitle: "Service inspection",
    defaultFolderId: juridique.id,
    sourceActor: Actor.user,
  });
  const bailleur = await createContact(db, {
    firstName: "Gérard",
    lastName: "Petit",
    email: "gerant@sci-lestilleuls.fr",
    company: "SCI Les Tilleuls",
    jobTitle: "Bailleur",
    defaultFolderId: juridique.id,
    sourceActor: Actor.user,
  });
  const siege = await createContact(db, {
    firstName: "Nadia",
    lastName: "Sow",
    email: "n.sow@tastycrousty.fr",
    company: "Tasty Crousty — Siège",
    jobTitle: "Animatrice réseau",
    defaultFolderId: business.id,
    sourceActor: Actor.user,
  });
  // — Business —
  const palais = await createContact(db, {
    lastName: "Restaurant Le Palais",
    email: "compta@lepalais.fr",
    company: "Le Palais (traiteur événementiel)",
    defaultFolderId: business.id,
    sourceActor: Actor.user,
  });
  const ubereats = await createContact(db, {
    lastName: "Uber Eats France",
    email: "partners-fr@uber.com",
    company: "Uber Eats",
    jobTitle: "Account Manager",
    defaultFolderId: business.id,
    sourceActor: Actor.ai,
    status: ContactStatus.auto,
  });
  // — Production —
  const froidexpert = await createContact(db, {
    lastName: "FroidExpert SA",
    email: "sav@froidexpert.fr",
    company: "FroidExpert SA",
    defaultFolderId: production.id,
    sourceActor: Actor.user,
  });
  const cuisinepro = await createContact(db, {
    lastName: "CuisinePro SAV",
    email: "sav@cuisinepro.fr",
    company: "CuisinePro (friteuses & équipements)",
    defaultFolderId: production.id,
    sourceActor: Actor.user,
  });
  // — Communication —
  const influenceur = await createContact(db, {
    firstName: "Camille",
    lastName: "Roy",
    email: "camille@parisfoodguide.fr",
    company: "ParisFoodGuide",
    jobTitle: "Créatrice de contenu food",
    defaultFolderId: communication.id,
    sourceActor: Actor.ai,
    status: ContactStatus.auto,
  });
  const club = await createContact(db, {
    lastName: "AS Épinay Football",
    email: "partenariats@as-epinay.fr",
    company: "AS Épinay Football",
    jobTitle: "Responsable partenariats",
    defaultFolderId: communication.id,
    sourceActor: Actor.user,
  });

  // ── Helper : crée plusieurs tâches pour un sujet ─────────────────────────────
  type TaskSpec = {
    title: string;
    kind?: TaskKind;
    actor?: Actor;
    off?: number; // offset en jours vs aujourd'hui (date d'échéance)
    hour?: number; // si défini → tâche horodatée (rendez-vous)
    endHour?: number; // fin (même jour) pour les créneaux
  };
  async function addTasks(subjectId: string, specs: TaskSpec[]) {
    for (const s of specs) {
      const dated = s.off !== undefined;
      const d = dated ? dayAt(s.off as number, s.hour ?? 9) : null;
      await createTask(db, {
        subjectId,
        title: s.title,
        sourceActor: s.actor ?? Actor.user,
        kind: s.kind,
        ...(d ? { startDate: d.date } : {}),
        ...(d && s.hour !== undefined ? { startTime: d.time } : {}),
        ...(d && s.endHour !== undefined
          ? { endTime: dayAt(s.off as number, s.endHour).time }
          : {}),
      });
    }
  }

  // ── 6. SUJETS ────────────────────────────────────────────────────────────────

  // ===== FOURNISSEURS =====

  // SUB-0142 — Rupture sauce blanche (Karim / SoGood) — URGENT, open.
  const sub142 = await createSubject(db, {
    reference: "SUB-0142",
    title: "Rupture sauce blanche",
    summary:
      "Karim (SoGood) signale une rupture sur la sauce blanche réf. SB-200 jusqu'à fin de semaine et propose la réf. SB-210 (même recette) en remplacement.",
    folderId: fournisseurs.id,
    contactIds: [karim.id],
    status: SubjectStatus.open,
    priority: Priority.urgent,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub142.id,
    senderContactId: karim.id,
    subjectLine: "Rupture sauce blanche",
    content:
      "Bonjour Mam's, rupture sur la sauce blanche réf. SB-200 jusqu'à fin de semaine. Je peux vous livrer la réf. SB-210 (même recette, conditionnement identique) en remplacement, ça vous va ?",
  });
  const msg142Bl = await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub142.id,
    senderContactId: karim.id,
    content:
      "Je vous joins le bon de livraison prévisionnel pour la SB-210 pour validation.",
  });
  const bl142 = await createAttachment(db, {
    messageId: msg142Bl.id,
    subjectId: sub142.id,
    name: "bon-livraison-SB210.pdf",
    mimeType: "application/pdf",
    storageKey: seedKey("attachments", "bon-livraison-SB210.pdf"),
    fileSize: 86_000,
  });
  await setAiLabel(db, bl142.id, "Bon de livraison");
  await addTasks(sub142.id, [
    {
      title: "Valider le remplacement par la sauce SB-210",
      kind: TaskKind.decision,
      actor: Actor.ai,
      off: 0,
      hour: 11,
    },
    {
      title: "Vérifier le stock de sauce blanche en réserve",
      kind: TaskKind.check,
      off: 0,
    },
  ]);
  await createDraftReply(db, {
    subjectId: sub142.id,
    to: karim.email!,
    channel: "email",
    content:
      "Bonjour Karim, c'est noté pour la rupture. La SB-210 nous convient en dépannage cette semaine. Confirmez-moi les quantités et la date de livraison. Merci !",
  });

  // SUB-0103 — Réassort papier emballage (PackPlus) — EN ATTENTE.
  const sub103 = await createSubject(db, {
    reference: "SUB-0103",
    title: "Réassort papier d'emballage",
    summary:
      "PackPlus propose un réassort de papier kraft. Commande validée de notre côté ; on attend leur confirmation de livraison.",
    folderId: fournisseurs.id,
    contactIds: [packplus.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    waitingForReply: true,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub103.id,
    senderContactId: packplus.id,
    subjectLine: "Réassort emballages",
    content:
      "Stock bientôt épuisé côté papier kraft et boîtes menu. On vous remet une commande standard ?",
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "outgoing",
    subjectId: sub103.id,
    recipientContactId: packplus.id,
    content:
      "Oui, lancez la commande standard de papier kraft et boîtes menu. Merci de me confirmer la date de livraison.",
  });
  const task103 = await createTask(db, {
    subjectId: sub103.id,
    title: "Valider la commande de réassort",
    sourceActor: Actor.ai,
    kind: TaskKind.reply,
  });
  await completeTask(db, task103.id); // répondu → reste « En attente »

  // SUB-0205 — Hausse tarif poulet (Avipro) — open, décision.
  const sub205 = await createSubject(db, {
    reference: "SUB-0205",
    title: "Hausse de tarif sur le poulet",
    summary:
      "Avipro annonce +6 % sur les filets de poulet à compter du 1er juillet. Impact direct sur la marge du menu signature — arbitrage à faire (absorber / ajuster prix / négocier volume).",
    folderId: fournisseurs.id,
    contactIds: [avipro.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub205.id,
    senderContactId: avipro.id,
    subjectLine: "Évolution tarifaire poulet — juillet",
    content:
      "Bonjour, suite à la hausse des cours, nos filets de poulet augmentent de 6 % au 1er juillet. Nous restons ouverts à une remise sur volume si vous engagez vos commandes au trimestre.",
  });
  await addTasks(sub205.id, [
    {
      title: "Calculer l'impact de la hausse sur la marge du menu poulet",
      kind: TaskKind.check,
      actor: Actor.ai,
      off: 2,
    },
    {
      title: "Négocier une remise volume avec Avipro",
      kind: TaskKind.call,
      off: 4,
      hour: 14,
    },
    {
      title: "Décider d'un ajustement de prix du menu signature",
      kind: TaskKind.decision,
      off: 6,
    },
  ]);

  // SUB-0211 — Livraison riz retardée (Grands Moulins) — new.
  const sub211 = await createSubject(db, {
    reference: "SUB-0211",
    title: "Retard de livraison riz",
    summary:
      "Grands Moulins annonce un retard de 2 jours sur la livraison de riz basmati. Risque de tension sur le stock pour le week-end.",
    folderId: fournisseurs.id,
    contactIds: [moulins.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub211.id,
    senderContactId: moulins.id,
    subjectLine: "Report livraison riz basmati",
    content:
      "Bonjour, votre livraison de riz basmati prévue jeudi est décalée à samedi (incident transporteur). Désolé pour la gêne.",
  });
  await addTasks(sub211.id, [
    {
      title: "Vérifier le stock de riz pour tenir jusqu'à samedi",
      kind: TaskKind.check,
      actor: Actor.ai,
      off: 0,
    },
    {
      title: "Prévoir un dépannage riz si rupture (cash & carry)",
      kind: TaskKind.follow_up,
      off: 1,
    },
  ]);

  // SUB-0219 — Contrat boissons (France Boissons) — open.
  const sub219 = await createSubject(db, {
    reference: "SUB-0219",
    title: "Nouveau contrat boissons",
    summary:
      "France Boissons propose un contrat annuel avec tarifs dégressifs et installation d'une fontaine. À comparer avec le fournisseur actuel.",
    folderId: fournisseurs.id,
    contactIds: [boissons.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub219.id,
    senderContactId: boissons.id,
    subjectLine: "Proposition contrat annuel boissons",
    content:
      "Bonjour, je vous propose notre contrat annuel : tarifs dégressifs, fontaine offerte et livraison hebdomadaire. Quand pouvons-nous en discuter ?",
  });
  await addTasks(sub219.id, [
    {
      title: "Comparer l'offre France Boissons au fournisseur actuel",
      kind: TaskKind.check,
      off: 8,
    },
    {
      title: "Rendez-vous commercial France Boissons",
      kind: TaskKind.call,
      off: 9,
      hour: 15,
      endHour: 16,
    },
  ]);

  // SUB-0188 — Qualité frites (résolu).
  const sub188 = await createSubject(db, {
    reference: "SUB-0188",
    title: "Problème qualité sur les frites",
    summary:
      "Lot de frites trop pâles signalé par l'équipe. Échange avec le fournisseur, lot remplacé, problème clos.",
    folderId: fournisseurs.id,
    contactIds: [karim.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub188.id,
    senderContactId: karim.id,
    subjectLine: "Lot frites — remplacement",
    content:
      "On vous remplace le lot de frites concerné sans frais, livraison avec la prochaine commande. Désolé pour la gêne.",
  });
  await addTasks(sub188.id, [
    { title: "Contrôler le nouveau lot de frites à réception", off: -3 },
  ]);
  await validateSubject(db, sub188.id);

  // ===== RH =====

  // SUB-0148 — Congé maternité Sophie — new.
  const sub148 = await createSubject(db, {
    reference: "SUB-0148",
    title: "Congé maternité — organisation du remplacement",
    summary:
      "Sophie informe de son départ en congé maternité le mois prochain et demande l'organisation de son remplacement.",
    folderId: rh.id,
    contactIds: [sophie.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailRh.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailRh.id,
    direction: "incoming",
    subjectId: sub148.id,
    senderContactId: sophie.id,
    subjectLine: "Congé maternité",
    content:
      "Bonjour Mam's, je vous confirme mon congé maternité à partir du mois prochain. Comment organise-t-on le remplacement ?",
  });
  await addTasks(sub148.id, [
    {
      title: "Préparer la fiche de poste pour le remplacement",
      kind: TaskKind.check,
      off: 5,
    },
    {
      title: "Lancer une annonce de recrutement",
      kind: TaskKind.follow_up,
      off: 7,
    },
  ]);

  // SUB-0221 — Recrutement équipier (Aïcha) — open.
  const sub221 = await createSubject(db, {
    reference: "SUB-0221",
    title: "Recrutement équipier polyvalent",
    summary:
      "Candidature d'Aïcha Ndiaye pour un poste d'équipier polyvalent. Entretien à planifier ; bon profil pour le service du midi.",
    folderId: rh.id,
    contactIds: [aicha.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailRh.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailRh.id,
    direction: "incoming",
    subjectId: sub221.id,
    senderContactId: aicha.id,
    subjectLine: "Candidature équipier",
    content:
      "Bonjour, je vous envoie ma candidature pour le poste d'équipier polyvalent. Je suis disponible immédiatement, y compris le week-end.",
  });
  await addTasks(sub221.id, [
    {
      title: "Entretien Aïcha Ndiaye",
      kind: TaskKind.call,
      off: 3,
      hour: 10,
      endHour: 11,
    },
    {
      title: "Vérifier les disponibilités et références",
      kind: TaskKind.check,
      off: 3,
    },
  ]);

  // SUB-0224 — Arrêt maladie équipier (Yacine) — open.
  const sub224 = await createSubject(db, {
    reference: "SUB-0224",
    title: "Arrêt maladie — réorganisation des shifts",
    summary:
      "Yacine est en arrêt 5 jours. Shifts du service du soir à recouvrir cette semaine.",
    folderId: rh.id,
    contactIds: [yacine.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: wa.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: wa.id,
    direction: "incoming",
    subjectId: sub224.id,
    senderContactId: yacine.id,
    content:
      "Bonjour chef, je suis en arrêt 5 jours (certificat envoyé). Désolé pour le service de ce soir.",
  });
  await addTasks(sub224.id, [
    {
      title: "Recouvrir les shifts du soir de Yacine",
      kind: TaskKind.decision,
      off: 0,
      hour: 16,
    },
    {
      title: "Confirmer le remplacement à l'équipe",
      kind: TaskKind.inform,
      off: 1,
    },
  ]);

  // SUB-0226 — Demande d'augmentation — new.
  const sub226 = await createSubject(db, {
    reference: "SUB-0226",
    title: "Demande d'augmentation",
    summary:
      "Un équipier ancien demande une revalorisation salariale. À cadrer avec la grille du réseau et le budget du restaurant.",
    folderId: rh.id,
    contactIds: [yacine.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: wa.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: wa.id,
    direction: "incoming",
    subjectId: sub226.id,
    senderContactId: yacine.id,
    content:
      "Chef, est-ce qu'on pourrait se voir cette semaine pour parler de mon salaire ? Ça fait 2 ans maintenant.",
  });
  await addTasks(sub226.id, [
    {
      title: "Revoir la grille de salaires du réseau",
      kind: TaskKind.check,
      off: 6,
    },
    {
      title: "Fixer un entretien individuel",
      kind: TaskKind.call,
      off: 8,
      hour: 11,
    },
  ]);

  // SUB-0190 — Formation HACCP (résolu).
  const sub190 = await createSubject(db, {
    reference: "SUB-0190",
    title: "Formation hygiène HACCP de l'équipe",
    summary:
      "Session de formation hygiène HACCP organisée pour l'équipe. Attestations reçues, dossier clos.",
    folderId: rh.id,
    contactIds: [sophie.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailRh.id,
    createdByActor: Actor.ai,
  });
  await addTasks(sub190.id, [
    { title: "Classer les attestations HACCP", off: -8 },
  ]);
  await validateSubject(db, sub190.id);

  // ===== JURIDIQUE =====

  // SUB-0082 — Renouvellement contrat clim (ClimaPro) — open.
  const sub82 = await createSubject(db, {
    reference: "SUB-0082",
    title: "Renouvellement contrat climatisation",
    summary:
      "ClimaPro annonce une reconduction tacite du contrat de maintenance ; échéance d'opposition à arbitrer.",
    folderId: juridique.id,
    contactIds: [climapro.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub82.id,
    senderContactId: climapro.id,
    subjectLine: "Renouvellement contrat maintenance",
    content:
      "Votre contrat de maintenance climatisation sera reconduit tacitement sauf opposition avant le 15 juillet.",
  });
  await addTasks(sub82.id, [
    {
      title: "Décider de la reconduction du contrat clim",
      kind: TaskKind.decision,
      actor: Actor.ai,
      off: 10,
    },
    {
      title: "Comparer 1 ou 2 devis concurrents",
      kind: TaskKind.check,
      off: 7,
    },
  ]);

  // SUB-0214 — Contrôle DDPP / hygiène — URGENT, open.
  const sub214 = await createSubject(db, {
    reference: "SUB-0214",
    title: "Contrôle hygiène DDPP annoncé",
    summary:
      "La DDPP 93 annonce un contrôle d'hygiène inopiné dans les prochains jours. Préparer le plan de maîtrise sanitaire et les relevés de températures.",
    folderId: juridique.id,
    contactIds: [ddpp.id],
    status: SubjectStatus.open,
    priority: Priority.urgent,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub214.id,
    senderContactId: ddpp.id,
    subjectLine: "Contrôle à venir",
    content:
      "Madame, Monsieur, un contrôle des services d'hygiène est susceptible d'intervenir prochainement dans votre établissement. Merci de tenir à disposition votre plan de maîtrise sanitaire.",
  });
  await addTasks(sub214.id, [
    {
      title: "Mettre à jour le plan de maîtrise sanitaire (PMS)",
      kind: TaskKind.check,
      actor: Actor.ai,
      off: 0,
    },
    {
      title: "Vérifier les relevés de températures des dernières semaines",
      kind: TaskKind.check,
      off: 1,
    },
    {
      title: "Briefer l'équipe sur les bonnes pratiques d'hygiène",
      kind: TaskKind.inform,
      off: 1,
      hour: 17,
    },
  ]);

  // SUB-0216 — Renouvellement bail commercial — open.
  const sub216 = await createSubject(db, {
    reference: "SUB-0216",
    title: "Renouvellement du bail commercial",
    summary:
      "Le bailleur (SCI Les Tilleuls) propose un renouvellement de bail avec révision du loyer. À étudier et négocier.",
    folderId: juridique.id,
    contactIds: [bailleur.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub216.id,
    senderContactId: bailleur.id,
    subjectLine: "Renouvellement de bail",
    content:
      "Bonjour, votre bail arrive à échéance. Je vous propose un renouvellement de 9 ans avec une révision de loyer à +4 %. Pouvons-nous en discuter ?",
  });
  await addTasks(sub216.id, [
    { title: "Faire relire le projet de bail", kind: TaskKind.check, off: 14 },
    {
      title: "Préparer la négociation du loyer",
      kind: TaskKind.follow_up,
      off: 16,
    },
  ]);

  // SUB-0192 — Affichage allergènes (résolu).
  const sub192 = await createSubject(db, {
    reference: "SUB-0192",
    title: "Mise en conformité affichage allergènes",
    summary:
      "Mise à jour des fiches allergènes et de l'affichage en salle. Conforme, dossier clos.",
    folderId: juridique.id,
    contactIds: [siege.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await addTasks(sub192.id, [
    { title: "Imprimer et afficher les nouvelles fiches allergènes", off: -10 },
  ]);
  await validateSubject(db, sub192.id);

  // ===== BUSINESS =====

  // SUB-0131 — Virement client Le Palais — open (+ suggestion de résolution).
  const sub131 = await createSubject(db, {
    reference: "SUB-0131",
    title: "Virement client à rapprocher",
    summary:
      "Le Palais signale un virement effectué (prestation traiteur) à rapprocher d'une facture.",
    folderId: business.id,
    contactIds: [palais.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub131.id,
    senderContactId: palais.id,
    subjectLine: "Virement effectué",
    content:
      "Bonjour, nous avons procédé au virement de la facture de la prestation traiteur. Pouvez-vous confirmer la bonne réception ?",
  });
  await addTasks(sub131.id, [
    {
      title: "Rapprocher le virement de la facture",
      kind: TaskKind.check,
      off: -1,
    },
  ]);

  // SUB-0222 — Renégociation commission Uber Eats — open.
  const sub222 = await createSubject(db, {
    reference: "SUB-0222",
    title: "Renégociation commission Uber Eats",
    summary:
      "La commission Uber Eats pèse sur la marge des commandes en livraison. Tenter une renégociation ou ajuster les prix sur la plateforme.",
    folderId: business.id,
    contactIds: [ubereats.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub222.id,
    senderContactId: ubereats.id,
    subjectLine: "Votre performance sur Uber Eats",
    content:
      "Bonjour, votre restaurant performe bien ce trimestre. Souhaitez-vous rejoindre notre offre marketing « Top Resto » pour gagner en visibilité ?",
  });
  await addTasks(sub222.id, [
    {
      title: "Analyser la marge réelle des commandes Uber Eats",
      kind: TaskKind.check,
      off: 12,
    },
    {
      title: "Demander une renégociation de la commission",
      kind: TaskKind.call,
      off: 15,
      hour: 14,
    },
  ]);

  // SUB-0225 — Baisse de fréquentation / promo — new.
  const sub225 = await createSubject(db, {
    reference: "SUB-0225",
    title: "Baisse de fréquentation en semaine",
    summary:
      "Recul du midi en semaine constaté par le siège. Lancer une opération (menu étudiant, offre midi) pour relancer le trafic.",
    folderId: business.id,
    contactIds: [siege.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub225.id,
    senderContactId: siege.id,
    subjectLine: "Trafic midi en baisse",
    content:
      "Bonjour Mam's, on observe un léger recul du midi en semaine sur ton resto. On peut te proposer un kit promo « menu étudiant ». Tu veux qu'on cale un point ?",
  });
  await addTasks(sub225.id, [
    {
      title: "Définir une offre midi semaine (menu étudiant)",
      kind: TaskKind.decision,
      off: 9,
    },
    {
      title: "Brief équipe sur la nouvelle offre",
      kind: TaskKind.inform,
      off: 11,
      hour: 16,
    },
  ]);

  // ===== PRODUCTION =====

  // SUB-0117 — Panne congélateur (FroidExpert) — open, créneau confirmé.
  const sub117 = await createSubject(db, {
    reference: "SUB-0117",
    title: "Panne congélateur — réserve",
    summary:
      "Congélateur de la réserve en défaut. FroidExpert propose une intervention ; créneau confirmé pour demain matin.",
    folderId: production.id,
    contactIds: [froidexpert.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub117.id,
    senderContactId: froidexpert.id,
    subjectLine: "Intervention congélateur",
    content:
      "Suite à votre signalement, un technicien peut passer demain matin. Confirmez-vous le créneau 8h-10h ?",
  });
  await addTasks(sub117.id, [
    {
      title: "Intervention technicien FroidExpert (congélateur)",
      kind: TaskKind.check,
      off: 1,
      hour: 8,
      endHour: 10,
    },
    {
      title: "Transférer les surgelés vers le congélateur de secours",
      kind: TaskKind.follow_up,
      off: 0,
    },
  ]);

  // SUB-0227 — Friteuse en panne — URGENT? non, open mais bloquant.
  const sub227 = await createSubject(db, {
    reference: "SUB-0227",
    title: "Friteuse n°2 hors service",
    summary:
      "La friteuse n°2 ne chauffe plus — capacité de production réduite aux heures de pointe. SAV CuisinePro à mobiliser en urgence.",
    folderId: production.id,
    contactIds: [cuisinepro.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: wa.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: wa.id,
    direction: "incoming",
    subjectId: sub227.id,
    senderRaw: "Équipe cuisine",
    content:
      "Chef, la friteuse 2 ne chauffe plus depuis ce matin. On tourne sur une seule, ça va être chaud ce midi.",
  });
  await addTasks(sub227.id, [
    {
      title: "Appeler le SAV CuisinePro en urgence",
      kind: TaskKind.call,
      actor: Actor.ai,
      off: 0,
      hour: 10,
    },
    {
      title: "Adapter la mise en place pour le service du midi",
      kind: TaskKind.follow_up,
      off: 0,
    },
  ]);

  // SUB-0194 — Maintenance hotte (résolu).
  const sub194 = await createSubject(db, {
    reference: "SUB-0194",
    title: "Nettoyage et maintenance de la hotte",
    summary:
      "Dégraissage annuel de la hotte aspirante réalisé par un prestataire. Certificat reçu, dossier clos.",
    folderId: production.id,
    contactIds: [cuisinepro.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await addTasks(sub194.id, [
    { title: "Récupérer le certificat de dégraissage", off: -6 },
  ]);
  await validateSubject(db, sub194.id);

  // ===== COMMUNICATION =====

  // SUB-0230 — Partenariat influenceur (@ParisFoodGuide) — open.
  const sub230 = await createSubject(db, {
    reference: "SUB-0230",
    title: "Partenariat @ParisFoodGuide",
    summary:
      "Camille Roy (@ParisFoodGuide, 120k abonnés) propose une vidéo de découverte du resto d'Épinay en échange d'un menu offert + un cachet. Bon levier de visibilité locale.",
    folderId: communication.id,
    contactIds: [influenceur.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailCom.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailCom.id,
    direction: "incoming",
    subjectId: sub230.id,
    senderContactId: influenceur.id,
    subjectLine: "Collab' contenu food — Tasty Crousty Épinay",
    content:
      "Hello ! J'adore le concept Tasty Crousty 🍗 Je vous propose une vidéo Reels + TikTok de découverte de votre resto d'Épinay. Format habituel : menu offert pour le tournage + un petit cachet. On en parle ?",
  });
  await addTasks(sub230.id, [
    {
      title: "Décider du partenariat ParisFoodGuide",
      kind: TaskKind.decision,
      actor: Actor.ai,
      off: 4,
    },
    {
      title: "Caler une date de tournage",
      kind: TaskKind.call,
      off: 6,
      hour: 11,
    },
  ]);
  await createDraftReply(db, {
    subjectId: sub230.id,
    to: influenceur.email!,
    channel: "email",
    content:
      "Bonjour Camille, merci pour votre message, votre contenu est top ! Le principe nous intéresse. Pouvez-vous m'envoyer vos statistiques d'audience et vos disponibilités de tournage en juillet ? Au plaisir, Mam's.",
  });

  // SUB-0231 — Demande de tournage TikTok — new.
  const sub231 = await createSubject(db, {
    reference: "SUB-0231",
    title: "Demande de tournage TikTok",
    summary:
      "Un créateur TikTok local souhaite tourner un challenge « le plus gros menu poulet ». Visibilité intéressante mais à cadrer (hygiène, affluence).",
    folderId: communication.id,
    contactIds: [],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailCom.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailCom.id,
    direction: "incoming",
    subjectId: sub231.id,
    senderRaw: "creator93.tiktok@email.com",
    subjectLine: "Challenge menu poulet 🍗",
    content:
      "Salut ! Je fais des défis bouffe sur TikTok (80k abonnés). Je peux venir tourner un challenge « plus gros menu poulet » chez vous ? Ça vous ferait de la pub locale.",
  });
  await addTasks(sub231.id, [
    {
      title: "Cadrer les conditions du tournage TikTok",
      kind: TaskKind.check,
      off: 10,
    },
  ]);

  // SUB-0232 — Sponsoring club de foot Épinay — open.
  const sub232 = await createSubject(db, {
    reference: "SUB-0232",
    title: "Sponsoring AS Épinay Football",
    summary:
      "L'AS Épinay propose un partenariat (panneau au stade + logo sur les maillots des U15) pour la saison. Ancrage local fort pour la marque.",
    folderId: communication.id,
    contactIds: [club.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailCom.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailCom.id,
    direction: "incoming",
    subjectId: sub232.id,
    senderContactId: club.id,
    subjectLine: "Proposition de partenariat saison 2026-2027",
    content:
      "Bonjour Mam's, l'AS Épinay serait ravie de compter Tasty Crousty parmi ses partenaires : panneau au stade et logo sur les maillots U15. On peut vous présenter les formules ?",
  });
  await addTasks(sub232.id, [
    {
      title: "Étudier les formules de sponsoring",
      kind: TaskKind.check,
      off: 13,
    },
    {
      title: "Rencontrer le responsable partenariats du club",
      kind: TaskKind.call,
      off: 18,
      hour: 18,
    },
  ]);

  // SUB-0196 — Jeu concours Instagram (résolu).
  const sub196 = await createSubject(db, {
    reference: "SUB-0196",
    title: "Jeu concours Instagram « 1 mois de menus »",
    summary:
      "Opération Instagram réalisée : tirage au sort effectué, gagnant contacté. Bon engagement, dossier clos.",
    folderId: communication.id,
    contactIds: [],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailCom.id,
    createdByActor: Actor.ai,
  });
  await addTasks(sub196.id, [
    { title: "Effectuer le tirage au sort et contacter le gagnant", off: -5 },
  ]);
  await validateSubject(db, sub196.id);

  // ===== SUJETS « OPÉRATIONS » (hôtes des tâches récurrentes — agenda dense) =====
  const subOpsLiv = await createSubject(db, {
    reference: "SUB-0240",
    title: "Réceptions & livraisons fournisseurs",
    summary:
      "Suivi des livraisons récurrentes du restaurant (poulet, riz & sauces, boissons, emballages) — réceptions et contrôles à quai.",
    folderId: fournisseurs.id,
    contactIds: [karim.id, avipro.id, moulins.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.user,
  });
  const subOpsHyg = await createSubject(db, {
    reference: "SUB-0241",
    title: "Hygiène & maintenance quotidiennes",
    summary:
      "Routines d'exploitation : relevés de températures, nettoyages, inventaires et contrôles de l'équipement.",
    folderId: production.id,
    contactIds: [],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.user,
  });
  const subOpsEquipe = await createSubject(db, {
    reference: "SUB-0242",
    title: "Plannings & briefings équipe",
    summary:
      "Organisation des services (midi/soir), briefings et points d'équipe du restaurant d'Épinay.",
    folderId: rh.id,
    contactIds: [sophie.id],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: emailRh.id,
    createdByActor: Actor.user,
  });

  // Génération des tâches récurrentes sur juin → juillet (offsets -24 à +36).
  // Réparties par jour de semaine pour remplir l'agenda et le planning.
  for (let off = -24; off <= 36; off++) {
    const dow = dayAt(off).date.getUTCDay(); // 0=dim … 6=sam
    // Lundi : réception poulet + inventaire
    if (dow === 1) {
      await createTask(db, {
        subjectId: subOpsLiv.id,
        title: "Réception livraison poulet (Avipro)",
        sourceActor: Actor.user,
        kind: TaskKind.check,
        startDate: dayAt(off, 8).date,
        startTime: dayAt(off, 8).time,
        endTime: dayAt(off, 9).time,
      });
      await createTask(db, {
        subjectId: subOpsHyg.id,
        title: "Inventaire matières premières",
        sourceActor: Actor.user,
        kind: TaskKind.check,
        startDate: dayAt(off, 15).date,
      });
    }
    // Mardi : relevé températures
    if (dow === 2) {
      await createTask(db, {
        subjectId: subOpsHyg.id,
        title: "Relevé des températures (chambres froides)",
        sourceActor: Actor.user,
        kind: TaskKind.check,
        startDate: dayAt(off).date,
      });
    }
    // Jeudi : réception riz & sauces + boissons
    if (dow === 4) {
      await createTask(db, {
        subjectId: subOpsLiv.id,
        title: "Réception riz & sauces (Grands Moulins / SoGood)",
        sourceActor: Actor.user,
        kind: TaskKind.check,
        startDate: dayAt(off, 8).date,
        startTime: dayAt(off, 8).time,
        endTime: dayAt(off, 9).time,
      });
      await createTask(db, {
        subjectId: subOpsLiv.id,
        title: "Réception boissons (France Boissons)",
        sourceActor: Actor.user,
        kind: TaskKind.check,
        startDate: dayAt(off, 14).date,
      });
    }
    // Vendredi : briefing équipe week-end + nettoyage approfondi
    if (dow === 5) {
      await createTask(db, {
        subjectId: subOpsEquipe.id,
        title: "Briefing équipe avant le week-end",
        sourceActor: Actor.user,
        kind: TaskKind.inform,
        startDate: dayAt(off, 17).date,
        startTime: dayAt(off, 17).time,
      });
      await createTask(db, {
        subjectId: subOpsHyg.id,
        title: "Nettoyage approfondi cuisine & friteuses",
        sourceActor: Actor.user,
        kind: TaskKind.check,
        startDate: dayAt(off, 22).date,
      });
    }
    // Dimanche : clôture de caisse hebdo
    if (dow === 0) {
      await createTask(db, {
        subjectId: subOpsEquipe.id,
        title: "Clôture de caisse hebdomadaire",
        sourceActor: Actor.user,
        kind: TaskKind.check,
        startDate: dayAt(off, 21).date,
      });
    }
  }

  // ===== SUJET FERMÉ (groupe WhatsApp bavard) =====
  const sub156 = await createSubject(db, {
    reference: "SUB-0156",
    title: "Groupe « Commerçants quartier »",
    summary:
      "Fil du groupe WhatsApp des commerçants du quartier — animations, voirie, tour de rôle des poubelles. Volume élevé, peu prioritaire.",
    folderId: undefined,
    contactIds: [],
    status: SubjectStatus.open,
    priority: Priority.normal,
    sourceChannelId: wa.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: wa.id,
    direction: "incoming",
    subjectId: sub156.id,
    senderRaw: "Groupe Commerçants Épinay",
    content:
      "Rappel : la réunion de quartier est décalée à jeudi 18h. Pensez à sortir les poubelles ce soir 🗑️",
  });
  await closeSubject(db, sub156.id);

  // ===== 7. Messages « Sans sujet » =====
  await createMessage(db, {
    channelId: emailCom.id,
    direction: "incoming",
    senderRaw: "contact@boost-referencement.fr",
    subjectLine: "Boostez votre visibilité Google",
    content:
      "Bonjour, je me permets de vous contacter pour vous présenter nos services de référencement local…",
  });
  await createMessage(db, {
    channelId: emailRh.id,
    direction: "incoming",
    senderRaw: "Marie Campos",
    content: "Ok merci, c'est noté.",
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    senderRaw: "newsletter@metro.fr",
    subjectLine: "Vos promos de la semaine",
    content:
      "Découvrez nos offres de la semaine sur les produits frais et l'épicerie…",
  });
  await createMessage(db, {
    channelId: wa.id,
    direction: "incoming",
    senderRaw: "+33 6 12 34 56 78",
    content: "Bonjour, vous êtes bien le Tasty Crousty d'Épinay ? 😊",
  });

  // ===== 8. Suggestion de résolution (sujet stabilisé) =====
  await suggestResolution(db, sub131.id);

  // ===== 9. Connaissances =====
  const generalFolder = await db.folder.findFirstOrThrow({
    where: { isDefault: true },
  });
  await db.knowledgeDocument.create({
    data: {
      folderId: generalFolder.id,
      kind: "note",
      name: "Tasty Crousty Épinay — l'essentiel",
      content:
        "# Tasty Crousty — Épinay-sur-Seine\n\nFast-food de la chaîne Tasty Crousty. Spécialités : poulet, riz, sauces maison. Gérant : Mam's Diallo (co-fondateur de la marque).\n\n- Service midi et soir, 7j/7.\n- Livraison via Uber Eats / Deliveroo.\n- Forte clientèle locale (familles, étudiants).",
      createdByActor: Actor.user,
    } as Prisma.KnowledgeDocumentUncheckedCreateInput,
  });
  await db.knowledgeDocument.create({
    data: {
      folderId: generalFolder.id,
      kind: "note",
      name: "Ton et style des réponses",
      content:
        "# Ton\n\nRéponses brèves, cordiales, tutoiement avec les fournisseurs réguliers et l'équipe. Toujours confirmer les quantités, les créneaux et les délais.",
      createdByActor: Actor.user,
    } as Prisma.KnowledgeDocumentUncheckedCreateInput,
  });
  await db.knowledgeDocument.create({
    data: {
      folderId: fournisseurs.id,
      kind: "note",
      name: "Nos fournisseurs clés",
      content:
        "# Fournisseurs\n\n- Avipro Volailles (Léa Fontaine) — poulet, livraison lundi.\n- Grands Moulins (Hassan Cherif) — riz basmati, livraison jeudi.\n- SoGood Distribution (Karim Benali) — sauces, livraison jeudi.\n- France Boissons — boissons.\n- PackPlus — emballages kraft.",
      createdByActor: Actor.user,
    } as Prisma.KnowledgeDocumentUncheckedCreateInput,
  });
  await db.knowledgeDocument.create({
    data: {
      folderId: communication.id,
      kind: "note",
      name: "Charte partenariats & influence",
      content:
        "# Partenariats\n\nL'influence est un vrai levier de business local. Privilégier les créateurs food ancrés en Île-de-France. Toujours demander les statistiques d'audience. Menu offert OK pour le tournage ; cachet à arbitrer selon l'audience.",
      createdByActor: Actor.user,
    } as Prisma.KnowledgeDocumentUncheckedCreateInput,
  });

  // ── Instructions « action » réalistes (consignes que Relvo applique) ─────────
  const addNote = (
    folderId: string,
    name: string,
    content: string,
    active = true,
  ) =>
    db.knowledgeDocument.create({
      data: {
        folderId,
        kind: "note",
        name,
        content,
        absorptionStatus: active
          ? AbsorptionStatus.read
          : AbsorptionStatus.ignored,
        createdByActor: Actor.user,
      } as Prisma.KnowledgeDocumentUncheckedCreateInput,
    });

  await addNote(
    communication.id,
    "Demandes de partenariat influenceur",
    "Quand tu reçois un message de demande de partenariat avec un influenceur, réponds automatiquement en demandant : le numéro de SIRET de son entreprise, ses tarifs, et ses 3 dernières collaborations. Précise ensuite que je reviendrai vers lui d'ici 15 jours maximum.",
  );
  await addNote(
    communication.id,
    "Sponsorings sportifs",
    "Décline poliment toute demande de sponsoring sportif au-delà de 500 € tant que je ne l'ai pas validée. En dessous, propose un menu offert pour l'équipe plutôt qu'un cachet.",
  );
  await addNote(
    fournisseurs.id,
    "Fournisseurs non agréés",
    "Tu refuses automatiquement toutes les propositions de fournisseurs qui ne sont pas déjà dans mes fournisseurs agréés. Réponse courtoise, sans engagement, et ne crée pas de sujet pour ces démarchages.",
  );
  await addNote(
    fournisseurs.id,
    "Rupture chez un fournisseur agréé",
    "Si un fournisseur agréé annonce une rupture, demande-lui systématiquement une référence de remplacement équivalente et le délai de retour à la normale, puis crée une tâche pour que je valide le remplacement.",
  );
  await addNote(
    generalFolder.id,
    "Briefing du matin",
    "Dans le briefing du matin, fais-moi un résumé des actions que tu as réalisées automatiquement durant la veille (réponses envoyées, contacts créés, sujets classés).",
  );
  await addNote(
    generalFolder.id,
    "Factures entrantes",
    "Quand un message contient une facture, classe-la dans le domaine du fournisseur concerné et signale-moi le montant et la date d'échéance.",
  );
  await addNote(
    rh.id,
    "Candidatures spontanées",
    "Pour toute candidature spontanée, réponds que nous conservons le CV et que nous recontacterons sous 30 jours en cas de besoin. Range l'expéditeur comme contact du pôle RH.",
  );
  await addNote(
    juridique.id,
    "Contrôle d'hygiène annoncé",
    "Si un contrôle d'hygiène (DDPP) est annoncé, crée une tâche urgente « Préparer le plan de maîtrise sanitaire » et rappelle-moi de sortir les relevés de température des 30 derniers jours.",
  );
  await addNote(
    production.id,
    "Panne d'équipement froid",
    "En cas de panne d'un équipement froid (congélateur, chambre froide), réponds au SAV en demandant une intervention sous 24 h et préviens-moi immédiatement.",
  );
  await addNote(
    business.id,
    "Demandes de devis traiteur",
    "Pour toute demande de devis traiteur ou événementiel, demande le nombre de couverts, la date, le lieu et le budget avant de me transmettre le dossier.",
    false, // désactivée — illustre l'interrupteur d'activation
  );

  // Documents (kind=file) avec état d'absorption (✦ lu / écarté).
  await db.knowledgeDocument.create({
    data: {
      folderId: fournisseurs.id,
      kind: "file",
      name: "catalogue-avipro-2026.pdf",
      mimeType: "application/pdf",
      storageKey: seedKey("knowledge", "catalogue-avipro-2026.pdf"),
      fileSize: 248_000,
      aiLabel: "catalogue",
      absorptionStatus: AbsorptionStatus.read,
      createdByActor: Actor.user,
    } as Prisma.KnowledgeDocumentUncheckedCreateInput,
  });
  await db.knowledgeDocument.create({
    data: {
      folderId: juridique.id,
      kind: "file",
      name: "plan-maitrise-sanitaire.pdf",
      mimeType: "application/pdf",
      storageKey: seedKey("knowledge", "plan-maitrise-sanitaire.pdf"),
      fileSize: 320_000,
      aiLabel: "procédure",
      absorptionStatus: AbsorptionStatus.read,
      createdByActor: Actor.user,
    } as Prisma.KnowledgeDocumentUncheckedCreateInput,
  });
  await db.knowledgeDocument.create({
    data: {
      folderId: communication.id,
      kind: "file",
      name: "media-kit-parisfoodguide.pdf",
      mimeType: "application/pdf",
      storageKey: seedKey("knowledge", "media-kit-parisfoodguide.pdf"),
      fileSize: 540_000,
      aiLabel: "autre",
      absorptionStatus: AbsorptionStatus.ignored,
      createdByActor: Actor.user,
    } as Prisma.KnowledgeDocumentUncheckedCreateInput,
  });

  // ===== 10. Domaine des messages classés (aligné sur le sujet) =====
  const classified = await db.message.findMany({
    where: { subjectId: { not: null } },
    select: { id: true, subject: { select: { folderId: true } } },
  });
  for (const m of classified) {
    if (m.subject?.folderId) {
      await db.message.updateMany({
        where: { id: m.id },
        data: { folderId: m.subject.folderId },
      });
    }
  }

  // ===== 11. Tâches passées → marquées « faites » (historique crédible) =====
  // Une seule requête : toutes les tâches ouvertes échues avant aujourd'hui
  // passent en « done » (agenda passé rempli, barres de progression des sujets).
  const today = dayAt(0).date;
  await db.task.updateMany({
    where: { status: TaskStatus.open, startDate: { lt: today } },
    data: { status: TaskStatus.done, completedAt: new Date() },
  });

  // ===== 12. Marqueur « Nouveau » (dérivé de lastOpenedAt) =====
  // « Nouveau » = sujet jamais ouvert (lastOpenedAt null). On pose donc
  // lastOpenedAt sur TOUS les sujets SAUF les quelques-uns qu'on veut afficher
  // « Nouveaux » dans la démo. Puis les messages des sujets « vus » passent en lus
  // (ouvrir un sujet vaut lecture). Les « Nouveaux » gardent leurs non-lus.
  const NEW_SUBJECT_REFS = [
    "SUB-0211",
    "SUB-0148",
    "SUB-0226",
    "SUB-0225",
    "SUB-0231",
  ];
  await db.subject.updateMany({
    where: { reference: { notIn: NEW_SUBJECT_REFS } },
    data: { lastOpenedAt: new Date() },
  });
  await db.message.updateMany({
    where: {
      direction: "incoming",
      readAt: null,
      subject: { is: { lastOpenedAt: { not: null } } },
    },
    data: { readAt: new Date() },
  });

  // ===== 13. Plan d'action de l'Accueil : tâches « en retard » et « à trier » ====
  // Créées APRÈS le sweep (§11) pour rester OUVERTES : sinon une tâche datée
  // passée serait marquée « done ». Alimente les onglets En retard / À faire.
  // En retard (échéance passée, ouvertes) :
  await addTasks(sub142.id, [
    { title: "Relancer Karim sur le délai de la sauce SB-210", off: -2 },
  ]);
  await addTasks(sub82.id, [
    { title: "Renvoyer le bon de commande clim signé", off: -4, hour: 10 },
  ]);
  await addTasks(sub214.id, [
    { title: "Transmettre le plan de maîtrise sanitaire à la DDPP", off: -1 },
  ]);
  // En retard plus anciens → alimentent les plages « 30 derniers jours » / « + 30 j ».
  await addTasks(sub205.id, [
    { title: "Répondre à la hausse de tarif poulet (Avipro)", off: -15 },
  ]);
  await addTasks(sub103.id, [
    { title: "Relancer le devis papier d'emballage", off: -42 },
  ]);
  // À trier (sans date — « Relvo n'a pas su placer » / accusés de réception) :
  await addTasks(sub103.id, [
    { title: "Répondre : merci, bien cordialement", actor: Actor.ai },
  ]);
  await addTasks(sub219.id, [
    { title: "Comparer les deux devis boissons reçus", actor: Actor.ai },
  ]);
  await addTasks(sub190.id, [{ title: "Classer la facture reçue" }]);
  // Une tâche SANS sujet rattaché (créée « à la volée » depuis l'Accueil).
  await createTask(db, {
    title: "Rappeler le comptable",
    sourceActor: Actor.user,
  });

  // Fichiers : purge du préfixe du compte (ce que la cascade PostgreSQL a laissé
  // derrière elle) puis (ré)upload des fixtures sur des clés déterministes.
  let files: { uploaded: number } | null = null;
  if (storage) {
    files = await seedDemoFiles(storage, account.id);
  } else {
    console.warn(
      "[seed] Aucun stockage fourni : les documents de la démo pointeront vers " +
        "des fichiers inexistants (téléchargement → introuvable). " +
        "Renseignez les variables R2_* pour un jeu de démo complet.",
    );
  }

  const counts = {
    folders: await db.folder.count(),
    contacts: await db.contact.count(),
    channels: await db.channel.count(),
    subjects: await db.subject.count(),
    messages: await db.message.count(),
    tasks: await db.task.count(),
    eventLogs: await db.eventLog.count(),
    files,
  };
  return counts;
}
