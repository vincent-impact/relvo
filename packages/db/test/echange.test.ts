import { describe, expect, it } from "vitest";
import {
  createContact,
  createSubject,
  createTask,
  getEchangeProjection,
  prisma,
  resolveSubject,
  tenantDb,
  updateSubjectPriority,
} from "../src/index";

// Ce que l'échange avec Relvo LIT en base (M10) : le compte et le brief depuis
// n'importe quelle page, la fiche de l'affaire ou du contact ouvert, et la
// résolution d'une affaire désignée par sa référence ou son titre — jamais
// une approximation silencieuse.

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

describe("projection de l'échange", () => {
  it("hors d'une fiche : le compte, le brief calculé, ni affaire ni domaine", async () => {
    const { account, db } = await makeAccount("echange-brief@test.fr");
    const urgent = await createSubject(db, { title: "Panne four" });
    await updateSubjectPriority(db, urgent.id, "urgent");
    await createSubject(db, { title: "Devis ClimaPro" });
    await createTask(db, {
      subjectId: urgent.id,
      title: "Rappeler le réparateur",
      startDate: new Date("2026-10-10T00:00:00.000Z"),
    });

    const p = await getEchangeProjection(db, {
      accountId: account.id,
      now: new Date("2026-10-15T10:00:00.000Z"),
    });
    expect(p.compte.dirigeant).toBe("Mam's Crousty");
    expect(p.compte.secteurs).toEqual(["food"]);
    expect(p.sujet).toBeNull();
    expect(p.domaine).toBeNull();
    expect(p.contact).toBeNull();
    expect(p.brief.sujetsOuverts).toBe(2);
    expect(p.brief.sujetsUrgents.map((s) => s.titre)).toEqual(["Panne four"]);
    expect(p.brief.tachesEnRetard).toBe(1);
  });

  it("sur une affaire : sa fiche, son domaine, son contact ; sur un contact : sa fiche", async () => {
    const { account, db } = await makeAccount("echange-fiche@test.fr");
    const contact = await createContact(db, {
      firstName: "Karim",
      lastName: "Benali",
      company: "ClimaPro",
    });
    const sujet = await createSubject(db, {
      title: "Retard livraison sauce blanche",
      contactIds: [contact.id],
    });

    const surAffaire = await getEchangeProjection(db, {
      accountId: account.id,
      subjectId: sujet.id,
    });
    expect(surAffaire.sujet?.reference).toBe(sujet.reference);
    expect(surAffaire.sujet?.id).toBe(sujet.id);
    expect(surAffaire.contact?.nom).toBe("Karim Benali");
    expect(surAffaire.brief.sujetsOuverts).toBe(1);

    const surContact = await getEchangeProjection(db, {
      accountId: account.id,
      contactId: contact.id,
    });
    expect(surContact.sujet).toBeNull();
    expect(surContact.contact?.entreprise).toBe("ClimaPro");
    expect(surContact.contact?.nom).toBe("Karim Benali");
    expect(surAffaire.sujet?.contacts.map((c) => c.nom)).toEqual([
      "Karim Benali",
    ]);
  });
});

describe("l'affaire que le dirigeant désigne", () => {
  it("par sa référence, entière ou en numéro ; par son titre, les ouvertes d'abord ; sinon rien", async () => {
    const { db } = await makeAccount("echange-resolve@test.fr");
    const a = await createSubject(db, { title: "Devis isolation Narbonne" });
    const b = await createSubject(db, { title: "Devis isolation Béziers" });
    await prisma.subject.update({
      where: { id: b.id },
      data: { status: "validated" },
    });

    expect((await resolveSubject(db, { reference: a.reference }))?.id).toBe(
      a.id,
    );
    expect((await resolveSubject(db, { reference: "sub-0002" }))?.id).toBe(
      b.id,
    );
    expect((await resolveSubject(db, { reference: "2" }))?.id).toBe(b.id);
    expect((await resolveSubject(db, { titre: "isolation" }))?.id).toBe(a.id);
    expect((await resolveSubject(db, { titre: "béziers" }))?.id).toBe(b.id);
    expect(await resolveSubject(db, { titre: "plomberie" })).toBeNull();
    expect(await resolveSubject(db, { reference: "SUB-9999" })).toBeNull();
    expect(await resolveSubject(db, {})).toBeNull();
  });
});
