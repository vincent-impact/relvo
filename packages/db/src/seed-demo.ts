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
 * Données cohérentes avec les maquettes et les « données de référence » du
 * CLAUDE.md ; s'appuie sur la couche domaine (génère aussi les EventLog).
 */
import { Prisma, prisma, tenantDb } from "./index";
import {
  AbsorptionStatus,
  Actor,
  ChannelType,
  ContactStatus,
  Priority,
  SubjectStatus,
  TaskKind,
} from "./index";
import {
  createAction,
  createAttachment,
  createChannel,
  createContact,
  createDraftReply,
  createFolder,
  createMessage,
  createSubject,
  createTask,
  completeTask,
  setAiLabel,
  suggestResolution,
} from "./index";

/** Email du compte de démonstration (jeu Tasty Crousty). */
export const DEMO_EMAIL = "demo@tastycrousty.fr";

/** Id fixe du compte démo : la session reste valide après un reset. */
export const DEMO_ACCOUNT_ID = "00000000-0000-4000-8000-0000000000de";

/** Date à H:00 décalée de `days` jours par rapport à aujourd'hui (UTC midi). */
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

export async function seedDemoAccount() {
  // 1. Reset idempotent : supprime le compte démo (cascade sur tout le reste).
  // On supprime par id ET par email (couvre l'ancien compte à id aléatoire).
  await prisma.account.deleteMany({
    where: { OR: [{ id: DEMO_ACCOUNT_ID }, { email: DEMO_EMAIL }] },
  });

  // 2. Account + Folder « Général » (is_default) + EventLog (cf. createAccount).
  const account = await prisma.account.create({
    data: {
      id: DEMO_ACCOUNT_ID,
      email: DEMO_EMAIL,
      firstName: "Youssef",
      lastName: "Tasty",
      emailVerified: new Date(),
      // Mot de passe de démo : « demo1234 » (bcrypt, 12 tours). Hash en clair
      // ici pour éviter d'ajouter bcryptjs aux deps de packages/db — usage seed
      // uniquement. Connexion : demo@tastycrousty.fr / demo1234.
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

  // 3. Dossiers métier.
  const rh = await createFolder(db, { name: "RH" });
  const juridique = await createFolder(db, { name: "Juridique" });
  const fournisseurs = await createFolder(db, { name: "Fournisseurs" });
  const business = await createFolder(db, { name: "Business" });
  const production = await createFolder(db, { name: "Production" });

  // 4. Canaux (boîtes email + WhatsApp).
  const emailRh = await createChannel(db, {
    name: "Boîte RH",
    type: ChannelType.email,
    identifier: "rh@tastycrousty.fr",
    folderIds: [rh.id],
  });
  const emailSupport = await createChannel(db, {
    name: "Boîte Support",
    type: ChannelType.email,
    identifier: "support@tastycrousty.fr",
    folderIds: [fournisseurs.id, production.id],
  });
  await createChannel(db, {
    name: "WhatsApp CEO",
    type: ChannelType.whatsapp,
    identifier: "+33600000000",
  });

  // 5. Contacts (données de référence).
  const karim = await createContact(db, {
    name: "Karim Benali",
    email: "karim@sogood-distribution.fr",
    company: "SoGood Distribution",
    jobTitle: "Responsable commercial",
    defaultFolderId: fournisseurs.id,
    sourceActor: Actor.user,
  });
  const sophie = await createContact(db, {
    name: "Sophie Blanchard",
    email: "sophie.blanchard@tastycrousty.fr",
    jobTitle: "Assistante RH",
    defaultFolderId: rh.id,
    sourceActor: Actor.user,
  });
  const climapro = await createContact(db, {
    name: "ClimaPro Services",
    email: "contact@climapro.fr",
    company: "ClimaPro Services",
    defaultFolderId: juridique.id,
    sourceActor: Actor.ai,
    status: ContactStatus.auto,
  });
  const palais = await createContact(db, {
    name: "Restaurant Le Palais",
    email: "compta@lepalais.fr",
    company: "Le Palais",
    defaultFolderId: business.id,
    sourceActor: Actor.user,
  });
  const packplus = await createContact(db, {
    name: "PackPlus SARL",
    email: "ventes@packplus.fr",
    company: "PackPlus SARL",
    defaultFolderId: fournisseurs.id,
    sourceActor: Actor.ai,
    status: ContactStatus.auto,
  });
  const froidexpert = await createContact(db, {
    name: "FroidExpert SA",
    email: "sav@froidexpert.fr",
    company: "FroidExpert SA",
    defaultFolderId: production.id,
    sourceActor: Actor.user,
  });

  // 6. Sujets (références fidèles aux maquettes) + message déclencheur + tâches.
  // SUB-0142 — Sauce blanche (Fournisseurs / Karim) — critical (seul urgent),
  // acknowledged. Marqueur « À faire » dérivé des tâches ouvertes ci-dessous.
  const sub142 = await createSubject(db, {
    reference: "SUB-0142",
    title: "Remplacement sauce blanche",
    summary:
      "Karim signale une rupture sur la sauce blanche habituelle et propose la sauce algérienne en substitution.",
    folderId: fournisseurs.id,
    contactIds: [karim.id],
    status: SubjectStatus.acknowledged,
    priority: Priority.critical,
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
      "Bonjour, rupture sur la sauce blanche réf. SB-200 jusqu'à fin de semaine. Je peux vous livrer la réf. SB-210 (même recette, conditionnement identique) en remplacement, ça vous va ?",
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "outgoing",
    subjectId: sub142.id,
    recipientContactId: karim.id,
    content: "Merci Karim, je regarde ça et je reviens vers vous rapidement.",
  });
  const msg142Bl = await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub142.id,
    senderContactId: karim.id,
    content:
      "Parfait. Je vous joins le bon de livraison prévisionnel pour validation.",
  });
  const bl142 = await createAttachment(db, {
    messageId: msg142Bl.id,
    subjectId: sub142.id,
    name: "bon-livraison-SB210.pdf",
    mimeType: "application/pdf",
    fileUrl: "https://placeholder.relvo.local/bon-livraison-SB210.pdf",
    fileSize: 86_000,
  });
  await setAiLabel(db, bl142.id, "Bon de livraison");
  const due142 = dayAt(1, 10);
  await createTask(db, {
    subjectId: sub142.id,
    title: "Confirmer ou refuser le remplacement par la sauce algérienne",
    sourceActor: Actor.ai,
    kind: TaskKind.decision,
    startDate: due142.date,
    startTime: due142.time,
  });
  await createTask(db, {
    subjectId: sub142.id,
    title: "Appeler le shop de Montpellier pour vérifier la demande",
    sourceActor: Actor.user,
    kind: TaskKind.call,
  });
  await createDraftReply(db, {
    subjectId: sub142.id,
    to: karim.email!,
    channel: "email",
    content:
      "Bonjour Karim, c'est noté pour la rupture. La sauce algérienne nous convient en dépannage cette semaine. Merci de confirmer les quantités.",
  });

  // SUB-0148 — Congé maternité (RH / Sophie) — high, new (badge « Nouveau »).
  const sub148 = await createSubject(db, {
    reference: "SUB-0148",
    title: "Congé maternité — organisation du remplacement",
    summary:
      "Sophie informe de son départ en congé maternité et demande l'organisation de son remplacement.",
    folderId: rh.id,
    contactIds: [sophie.id],
    status: SubjectStatus.new,
    priority: Priority.high,
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
      "Bonjour, je vous confirme mon congé maternité à partir du mois prochain. Comment organise-t-on le remplacement ?",
  });
  const due148 = dayAt(5);
  await createTask(db, {
    subjectId: sub148.id,
    title: "Préparer la fiche de poste pour le remplacement",
    sourceActor: Actor.user,
    kind: TaskKind.check,
    startDate: due148.date,
  });

  // SUB-0082 — Contrat climatisation (Juridique / ClimaPro) — low, acknowledged.
  // Marqueur « À faire » dérivé de la tâche ouverte ci-dessous.
  const sub82 = await createSubject(db, {
    reference: "SUB-0082",
    title: "Renouvellement contrat climatisation",
    summary:
      "ClimaPro annonce un renouvellement tacite du contrat de maintenance ; échéance imminente à arbitrer.",
    folderId: juridique.id,
    contactIds: [climapro.id],
    status: SubjectStatus.acknowledged,
    priority: Priority.low,
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
      "Votre contrat de maintenance climatisation sera reconduit tacitement au 30 avril sauf opposition avant le 31 mars.",
  });
  const due82 = dayAt(0, 17);
  await createTask(db, {
    subjectId: sub82.id,
    title: "Décider de la reconduction avant la date butoir",
    sourceActor: Actor.ai,
    kind: TaskKind.decision,
    startDate: due82.date,
    startTime: due82.time,
  });

  // SUB-0131 — Virement client (Business / Le Palais) — low, acknowledged.
  const sub131 = await createSubject(db, {
    reference: "SUB-0131",
    title: "Virement client à rapprocher",
    summary:
      "Le Palais signale un virement effectué à rapprocher d'une facture.",
    folderId: business.id,
    contactIds: [palais.id],
    status: SubjectStatus.acknowledged,
    priority: Priority.low,
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
      "Bonjour, nous avons procédé au virement de la facture de février. Pouvez-vous confirmer la bonne réception ?",
  });

  // SUB-0103 — Papier emballage (Fournisseurs / PackPlus). VRAI cas « En attente » :
  // PackPlus propose un réassort → on a répondu (message sortant) et on attend
  // leur confirmation. La tâche de réponse est faite → marqueur « En attente » seul.
  const sub103 = await createSubject(db, {
    reference: "SUB-0103",
    title: "Réassort papier d'emballage",
    summary:
      "PackPlus propose un réassort de papier kraft. Commande validée de notre côté ; on attend leur confirmation de livraison.",
    folderId: fournisseurs.id,
    contactIds: [packplus.id],
    status: SubjectStatus.acknowledged,
    priority: Priority.low,
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
      "Stock bientôt épuisé côté papier kraft. On vous remet une commande standard ?",
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "outgoing",
    subjectId: sub103.id,
    recipientContactId: packplus.id,
    content:
      "Oui, lancez la commande standard de papier kraft. Merci de me confirmer la date de livraison.",
  });
  const task103 = await createTask(db, {
    subjectId: sub103.id,
    title: "Valider la commande de réassort",
    sourceActor: Actor.ai,
    kind: TaskKind.reply,
  });
  await completeTask(db, task103.id); // répondu → tâche faite, reste « En attente »

  // SUB-0117 — Congélateur Narbonne (Production / FroidExpert) — high, acknowledged.
  // C'est FroidExpert qui attend NOTRE confirmation du créneau → marqueur « À faire »
  // (tâche ouverte), surtout PAS « En attente ».
  const sub117 = await createSubject(db, {
    reference: "SUB-0117",
    title: "Panne congélateur Narbonne",
    summary:
      "FroidExpert propose une intervention sur le congélateur en panne du site de Narbonne ; créneau à confirmer.",
    folderId: production.id,
    contactIds: [froidexpert.id],
    status: SubjectStatus.acknowledged,
    priority: Priority.high,
    sourceChannelId: emailSupport.id,
    createdByActor: Actor.ai,
  });
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    subjectId: sub117.id,
    senderContactId: froidexpert.id,
    subjectLine: "Intervention congélateur Narbonne",
    content:
      "Suite à votre signalement, un technicien peut passer demain matin. Confirmez-vous le créneau 8h-10h ?",
  });
  const slot117 = dayAt(1, 8);
  const slot117End = dayAt(1, 10);
  await createTask(db, {
    subjectId: sub117.id,
    title: "Intervention technicien FroidExpert (Narbonne)",
    sourceActor: Actor.user,
    kind: TaskKind.check,
    startDate: slot117.date,
    startTime: slot117.time,
    endTime: slot117End.time,
  });

  // 7. Messages « Sans sujet » (expéditeurs inconnus / ambigus).
  await createMessage(db, {
    channelId: emailSupport.id,
    direction: "incoming",
    senderRaw: "j.morel@email.com",
    subjectLine: "Proposition de partenariat",
    content:
      "Bonjour, je me permets de vous contacter pour vous présenter nos services de référencement…",
    triageHint: "prospection",
  });
  await createMessage(db, {
    channelId: emailRh.id,
    direction: "incoming",
    senderRaw: "Marie Campos",
    content: "Ok merci, c'est noté.",
    triageHint: "too_short",
  });

  // 8. Une suggestion de résolution de Relvo (sujet stabilisé).
  await suggestResolution(db, sub131.id);

  // 9. Connaissances (notes Markdown) — Général + Fournisseurs.
  await db.knowledgeDocument.create({
    data: {
      folderId: (
        await db.folder.findFirstOrThrow({ where: { isDefault: true } })
      ).id,
      kind: "note",
      name: "Ton et style des réponses",
      content:
        "# Ton\n\nRéponses brèves, cordiales, tutoiement avec les fournisseurs réguliers. Toujours confirmer les quantités et les délais.",
      createdByActor: Actor.user,
    } as Prisma.KnowledgeDocumentUncheckedCreateInput,
  });
  await db.knowledgeDocument.create({
    data: {
      folderId: fournisseurs.id,
      kind: "note",
      name: "Nos fournisseurs clés",
      content:
        "# Fournisseurs\n\n- SoGood Distribution (Karim Benali) — sauces, livraison hebdo.\n- PackPlus SARL — emballages kraft.",
      createdByActor: Actor.user,
    } as Prisma.KnowledgeDocumentUncheckedCreateInput,
  });

  // 9 bis. Documents (kind=file) avec état d'absorption (✦ lu / écarté).
  // fileUrl = placeholder tant que M4 (Vercel Blob) n'est pas livré.
  await db.knowledgeDocument.create({
    data: {
      folderId: fournisseurs.id,
      kind: "file",
      name: "catalogue-sogood-2026.pdf",
      mimeType: "application/pdf",
      fileUrl: "https://placeholder.relvo.local/catalogue-sogood-2026.pdf",
      fileSize: 248_000,
      aiLabel: "catalogue",
      absorptionStatus: AbsorptionStatus.read,
      createdByActor: Actor.user,
    } as Prisma.KnowledgeDocumentUncheckedCreateInput,
  });
  await db.knowledgeDocument.create({
    data: {
      folderId: fournisseurs.id,
      kind: "file",
      name: "ancien-tarif-2024.pdf",
      mimeType: "application/pdf",
      fileUrl: "https://placeholder.relvo.local/ancien-tarif-2024.pdf",
      fileSize: 112_000,
      aiLabel: "tarif",
      absorptionStatus: AbsorptionStatus.ignored,
      createdByActor: Actor.user,
    } as Prisma.KnowledgeDocumentUncheckedCreateInput,
  });

  // Évite un warning « variable inutilisée » sur l'action générique de démo.
  await createAction(db, {
    subjectId: sub82.id,
    title: "Relire les clauses du contrat",
  });

  const counts = {
    folders: await db.folder.count(),
    contacts: await db.contact.count(),
    channels: await db.channel.count(),
    subjects: await db.subject.count(),
    messages: await db.message.count(),
    tasks: await db.task.count(),
    eventLogs: await db.eventLog.count(),
  };
  return counts;
}
