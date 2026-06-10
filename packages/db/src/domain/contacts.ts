import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { Actor, ContactStatus } from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { ensureAffected } from "./helpers";
import { cursorArgs, paginationSchema, toPage } from "./pagination";

// Domaine Contacts (M3.5). Statut auto (créé par Relvo, partiel) → complete
// (vérifié/complété par l'utilisateur). Un contact n'est jamais créé sans sujet
// par le pipeline (invariant) ; cette couche n'expose que la création explicite.

const actorEnum = z.enum(Actor);

export const createContactSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(120),
  email: z.email().optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  company: z.string().trim().max(120).optional().nullable(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  defaultFolderId: z.uuid().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  /** `ai` = auto-créé par Relvo, `user` = créé manuellement. */
  sourceActor: actorEnum.default(Actor.user),
  status: z.enum(ContactStatus).optional(),
});

export const updateContactSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.email().optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  company: z.string().trim().max(120).optional().nullable(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  defaultFolderId: z.uuid().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type CreateContactInput = z.input<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export async function listContacts(
  db: TenantDb,
  opts: { status?: ContactStatus; cursor?: string; limit?: number } = {},
) {
  const { limit } = paginationSchema.parse(opts);
  const { _limit, ...args } = cursorArgs(opts);
  const rows = await db.contact.findMany({
    ...args,
    where: opts.status ? { status: opts.status } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return toPage(rows, limit);
}

export async function getContact(db: TenantDb, id: string) {
  return assertFound(await db.contact.findFirst({ where: { id } }), "Contact");
}

export async function createContact(db: TenantDb, input: CreateContactInput) {
  const data = createContactSchema.parse(input);
  // Statut par défaut cohérent avec la source : Relvo → auto, utilisateur → complete.
  const status =
    data.status ??
    (data.sourceActor === Actor.ai
      ? ContactStatus.auto
      : ContactStatus.complete);

  return db.$transaction(async (tx) => {
    const contact = await tx.contact.create({
      data: {
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        company: data.company ?? null,
        jobTitle: data.jobTitle ?? null,
        defaultFolderId: data.defaultFolderId ?? null,
        notes: data.notes ?? null,
        sourceActor: data.sourceActor,
        status,
      } as Prisma.ContactUncheckedCreateInput,
    });
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: contact.id,
      contactId: data.sourceActor === Actor.contact ? contact.id : null,
      eventType: EVENT_TYPES.contactCreated,
      title: `Contact « ${contact.name} » créé`,
      actor: data.sourceActor,
    });
    return contact;
  });
}

export async function updateContact(
  db: TenantDb,
  id: string,
  input: UpdateContactInput,
) {
  const data = updateContactSchema.parse(input);
  return db.$transaction(async (tx) => {
    const { count } = await tx.contact.updateMany({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.company !== undefined ? { company: data.company } : {}),
        ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
        ...(data.defaultFolderId !== undefined
          ? { defaultFolderId: data.defaultFolderId }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
    ensureAffected(count, "Contact");
    const contact = assertFound(
      await tx.contact.findFirst({ where: { id } }),
      "Contact",
    );
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: contact.id,
      eventType: EVENT_TYPES.contactUpdated,
      title: `Contact « ${contact.name} » modifié`,
      actor: "user",
    });
    return contact;
  });
}

/**
 * Passe une fiche contact de `auto` à `complete` (cas P) : l'utilisateur l'a
 * vérifiée. Accepte des champs à mettre à jour au passage.
 */
export async function completeContact(
  db: TenantDb,
  id: string,
  input: UpdateContactInput = {},
) {
  const data = updateContactSchema.parse(input);
  return db.$transaction(async (tx) => {
    const { count } = await tx.contact.updateMany({
      where: { id },
      data: {
        status: ContactStatus.complete,
        sourceActor: Actor.user,
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.company !== undefined ? { company: data.company } : {}),
        ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
        ...(data.defaultFolderId !== undefined
          ? { defaultFolderId: data.defaultFolderId }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
    ensureAffected(count, "Contact");
    const contact = assertFound(
      await tx.contact.findFirst({ where: { id } }),
      "Contact",
    );
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: contact.id,
      eventType: EVENT_TYPES.contactCompleted,
      title: `Fiche contact « ${contact.name} » complétée`,
      actor: "user",
    });
    return contact;
  });
}

export async function deleteContact(db: TenantDb, id: string) {
  const { count } = await db.contact.deleteMany({ where: { id } });
  ensureAffected(count, "Contact");
  return { id };
}
