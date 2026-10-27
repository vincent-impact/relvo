import { describe, expect, it } from "vitest";
import {
  Actor,
  ContactStatus,
  DICTATION_VOCABULARY_LIMITS,
  getDictationVocabulary,
  prisma,
  SubjectStatus,
  tenantDb,
} from "../src/index";

// LE VOCABULAIRE D'UNE DICTÉE (M22.4) — ce que le domaine projette pour le
// prompt de transcription : les contacts complets avant les automatiques, les
// sujets OUVERTES seulement, les plus actives d'abord, dans les plafonds.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: {
      email,
      firstName: "Mam's",
      lastName: "Crousty",
      sectors: ["food"],
    },
  });
  return { account, db: tenantDb(account.id) };
}

describe("getDictationVocabulary", () => {
  it("projette le dirigeant, les contacts (complets d'abord), les sujets ouverts", async () => {
    const { account, db } = await makeAccount("dictee@test.fr");
    await db.contact.create({
      data: {
        firstName: null,
        lastName: "karim.benali",
        status: ContactStatus.auto,
        sourceActor: Actor.ai,
      },
    });
    await db.contact.create({
      data: {
        firstName: "Sophie",
        lastName: "Blanchard",
        company: "ClimaPro",
        status: ContactStatus.complete,
        sourceActor: Actor.user,
      },
    });
    const ouvert = await db.subject.create({
      data: {
        title: "Panne chambre froide",
        status: SubjectStatus.open,
        reference: "SUB-0001",
        createdByActor: Actor.user,
      },
    });
    await db.subject.create({
      data: {
        title: "Sujet clos",
        status: SubjectStatus.closed,
        reference: "SUB-0002",
        createdByActor: Actor.user,
      },
    });
    const v = await getDictationVocabulary(db, account.id);
    expect(v.dirigeant).toBe("Mam's Crousty");
    expect(v.secteurs).toEqual(["food"]);
    expect(v.contacts).toEqual([
      { prenom: "Sophie", nom: "Blanchard", entreprise: "ClimaPro" },
      { prenom: null, nom: "karim.benali", entreprise: null },
    ]);
    expect(v.sujets).toEqual([ouvert.title]);
  });

  it("borne les listes aux plafonds, les sujets les plus actives d'abord", async () => {
    const { account, db } = await makeAccount("dictee-plafond@test.fr");
    for (let i = 0; i < DICTATION_VOCABULARY_LIMITS.subjects + 5; i += 1) {
      await db.subject.create({
        data: {
          title: `Sujet ${i}`,
          status: SubjectStatus.open,
          reference: `SUB-${String(i).padStart(4, "0")}`,
          createdByActor: Actor.user,
          lastActivityAt: new Date(Date.UTC(2026, 0, 1 + i)),
        },
      });
    }
    for (let i = 0; i < DICTATION_VOCABULARY_LIMITS.contacts + 5; i += 1) {
      await db.contact.create({
        data: {
          lastName: `Contact ${i}`,
          status: ContactStatus.complete,
          sourceActor: Actor.user,
        },
      });
    }
    const v = await getDictationVocabulary(db, account.id);
    expect(v.sujets).toHaveLength(DICTATION_VOCABULARY_LIMITS.subjects);
    expect(v.sujets[0]).toBe(
      `Sujet ${DICTATION_VOCABULARY_LIMITS.subjects + 4}`,
    );
    expect(v.contacts).toHaveLength(DICTATION_VOCABULARY_LIMITS.contacts);
  });
});
