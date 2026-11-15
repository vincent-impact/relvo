import { describe, expect, it } from "vitest";
import {
  FRAICHEUR_JOURS,
  aBouge,
  createSubject,
  createTask,
  enrichSubjects,
  listSubjectsByStatus,
  openSubject,
  prisma,
  tenantDb,
  updateTask,
} from "../src/index";

// « NOUVEAU » ET « A BOUGÉ » (M28.1) — les deux marqueurs de la page Sujets.
// Nouveau : jamais ouvert ET frais. A bougé : nouveau, ou ses tâches ont été
// touchées par un AUTRE que le dirigeant depuis qu'il a ouvert le sujet. Un
// message reçu n'allume rien ; une tâche que le dirigeant touche lui-même non
// plus ; ouvrir la fiche éteint. Et la page montre TOUS les sujets.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Mam's", lastName: "Crousty", sectors: ["food"] },
  });
  await prisma.folder.create({
    data: {
      accountId: account.id,
      name: "Général",
      slug: "general",
      isDefault: true,
    },
  });
  return { account, db: tenantDb(account.id) };
}

const JOUR = 24 * 60 * 60 * 1000;

describe("la règle, pure", () => {
  const now = new Date("2026-11-15T10:00:00Z");
  const ilYA = (jours: number) => new Date(now.getTime() - jours * JOUR);
  const sujet = (createdAt: Date, lastOpenedAt: Date | null = null) => ({
    status: "open" as const,
    createdAt,
    lastOpenedAt,
  });

  it("un sujet jamais ouvert est nouveau pendant le délai de fraîcheur, puis plus", () => {
    expect(aBouge(sujet(ilYA(FRAICHEUR_JOURS - 1)), null, now)).toBe(true);
    expect(aBouge(sujet(ilYA(FRAICHEUR_JOURS + 1)), null, now)).toBe(false);
  });

  it("une tâche touchée après la dernière ouverture allume, avant non", () => {
    const s = sujet(ilYA(30), ilYA(3));
    expect(aBouge(s, ilYA(1), now)).toBe(true);
    expect(aBouge(s, ilYA(5), now)).toBe(false);
  });

  it("jamais ouvert et plus frais : seule une tâche touchée récemment allume", () => {
    const s = sujet(ilYA(30));
    expect(aBouge(s, ilYA(2), now)).toBe(true);
    expect(aBouge(s, ilYA(20), now)).toBe(false);
  });

  it("un sujet validé ou fermé ne bouge plus", () => {
    expect(
      aBouge({ ...sujet(ilYA(1)), status: "validated" }, ilYA(0), now),
    ).toBe(false);
  });
});

describe("sur un compte", () => {
  it("une tâche de Relvo allume le sujet, celle du dirigeant non, ouvrir éteint", async () => {
    const { db } = await makeAccount("bouge@relvo.test");
    const s = await createSubject(db, { title: "Devis de la friteuse" });
    const enrichi = async () =>
      (await enrichSubjects(db, await listSubjectsByStatus(db, "open")))[0];

    // Tout juste créé : nouveau, donc il a bougé.
    expect(await enrichi()).toMatchObject({ isNew: true, moved: true });

    // Le dirigeant l'ouvre : plus nouveau, éteint.
    await openSubject(db, s.id);
    expect(await enrichi()).toMatchObject({ isNew: false, moved: false });

    // Il ajoute puis modifie une tâche lui-même : rien ne s'allume.
    const mienne = await createTask(db, {
      subjectId: s.id,
      title: "Rappeler le fournisseur",
      sourceActor: "user",
    });
    await updateTask(db, mienne.id, { title: "Rappeler Kiloutou" });
    expect((await enrichi()).moved).toBe(false);

    // Relvo en ajoute une en son absence : le sujet a bougé.
    await createTask(db, {
      subjectId: s.id,
      title: "Comparer les deux devis",
      sourceActor: "ai",
    });
    expect((await enrichi()).moved).toBe(true);

    // Il rouvre la fiche : éteint.
    await openSubject(db, s.id);
    expect((await enrichi()).moved).toBe(false);
  });

  it("la liste rend tous les sujets d'un état, sans coupe", async () => {
    const { db } = await makeAccount("tous@relvo.test");
    for (let i = 0; i < 45; i++) {
      await createSubject(db, { title: `Sujet ${i}` });
    }
    expect(await listSubjectsByStatus(db, "open")).toHaveLength(45);
    expect(await listSubjectsByStatus(db, "validated")).toHaveLength(0);
  });
});
