/**
 * Seed de développement — jeu « Tasty Crousty » (M3.2).
 *
 * Données fictives mais réalistes, cohérentes avec les maquettes et les
 * « données de référence » du CLAUDE.md. Le seed s'appuie sur la couche domaine
 * (packages/db/src/domain) via le client tenant : il génère donc aussi les
 * EventLog et exerce au passage le CRUD de M3.
 *
 * Idempotent : le compte démo est supprimé (cascade) puis recréé à chaque run.
 */
// Charge packages/db/.env avant l'import du singleton Prisma (qui lit
// DATABASE_URL à l'évaluation du module). Les imports s'exécutent dans l'ordre.
import "dotenv/config";
import { Prisma, prisma, tenantDb } from "../src/index";
import {
  Actor,
  ChannelType,
  ContactStatus,
  Priority,
  SubjectStatus,
  TaskKind,
} from "../src/index";
import {
  createAction,
  createChannel,
  createContact,
  createDraftReply,
  createFolder,
  createMessage,
  createSubject,
  createTask,
  suggestResolution,
} from "../src/index";

const DEMO_EMAIL = "demo@tastycrousty.fr";

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

async function main() {
  // 1. Reset idempotent : supprime le compte démo (cascade sur tout le reste).
  await prisma.account.deleteMany({ where: { email: DEMO_EMAIL } });

  // 2. Account + Folder « Général » (is_default) + EventLog (cf. createAccount).
  const account = await prisma.account.create({
    data: {
      email: DEMO_EMAIL,
      firstName: "Youssef",
      lastName: "Tasty",
      emailVerified: new Date(),
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
  // SUB-0142 — Sauce blanche (Fournisseurs / Karim) — high, to_do.
  const sub142 = await createSubject(db, {
    reference: "SUB-0142",
    title: "Remplacement sauce blanche",
    summary:
      "Karim signale une rupture sur la sauce blanche habituelle et propose la sauce algérienne en substitution.",
    folderId: fournisseurs.id,
    contactIds: [karim.id],
    status: SubjectStatus.to_do,
    priority: Priority.high,
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
      "Bonjour, rupture sur la sauce blanche jusqu'à fin de semaine. Je peux vous livrer de la sauce algérienne en remplacement, ça vous va ?",
  });
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

  // SUB-0148 — Congé maternité (RH / Sophie) — medium, waiting.
  const sub148 = await createSubject(db, {
    reference: "SUB-0148",
    title: "Congé maternité — organisation du remplacement",
    summary:
      "Sophie informe de son départ en congé maternité et demande l'organisation de son remplacement.",
    folderId: rh.id,
    contactIds: [sophie.id],
    status: SubjectStatus.waiting,
    priority: Priority.medium,
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

  // SUB-0082 — Contrat climatisation (Juridique / ClimaPro) — critical (urgent).
  const sub82 = await createSubject(db, {
    reference: "SUB-0082",
    title: "Renouvellement contrat climatisation",
    summary:
      "ClimaPro annonce un renouvellement tacite du contrat de maintenance ; échéance imminente à arbitrer.",
    folderId: juridique.id,
    contactIds: [climapro.id],
    status: SubjectStatus.new,
    priority: Priority.critical,
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

  // SUB-0131 — Virement client (Business / Le Palais) — medium, unread.
  const sub131 = await createSubject(db, {
    reference: "SUB-0131",
    title: "Virement client à rapprocher",
    summary:
      "Le Palais signale un virement effectué à rapprocher d'une facture.",
    folderId: business.id,
    contactIds: [palais.id],
    status: SubjectStatus.unread,
    priority: Priority.medium,
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

  // SUB-0103 — Papier emballage (Fournisseurs / PackPlus) — high, to_do.
  const sub103 = await createSubject(db, {
    reference: "SUB-0103",
    title: "Réassort papier d'emballage",
    summary:
      "PackPlus propose un réassort de papier d'emballage avant rupture.",
    folderId: fournisseurs.id,
    contactIds: [packplus.id],
    status: SubjectStatus.to_do,
    priority: Priority.high,
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
  const due103 = dayAt(2);
  await createTask(db, {
    subjectId: sub103.id,
    title: "Valider la commande de réassort",
    sourceActor: Actor.ai,
    kind: TaskKind.reply,
    startDate: due103.date,
  });

  // SUB-0117 — Congélateur Narbonne (Production / FroidExpert) — critical (urgent).
  const sub117 = await createSubject(db, {
    reference: "SUB-0117",
    title: "Panne congélateur Narbonne",
    summary:
      "FroidExpert intervient sur le congélateur du site de Narbonne, en panne ; planification de l'intervention.",
    folderId: production.id,
    contactIds: [froidexpert.id],
    status: SubjectStatus.to_do,
    priority: Priority.critical,
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
  console.info("[seed] Tasty Crousty créé :", counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
