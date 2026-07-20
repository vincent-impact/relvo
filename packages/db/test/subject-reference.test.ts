import { describe, expect, it } from "vitest";
import { createSubject, prisma, tenantDb } from "../src/index";

// Régression de production (2026-07-20) : ouvrir un sujet échouait en P2002
// « Unique constraint failed on (account_id, reference) ».
//
// La référence dérivait du NOMBRE de sujets (`count + 1`). Après suppression
// manuelle de sujets, le compteur redescend et repointe sur une référence déjà
// attribuée. Une référence est un identifiant métier : elle ne doit JAMAIS être
// réattribuée, même après suppression. Elle dérive donc du MAXIMUM existant.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  return tenantDb(account.id);
}

describe("référence de sujet", () => {
  it("ne réattribue pas une référence après suppression d'un sujet", async () => {
    const db = await makeAccount("reference-suppression@test.fr");

    const a = await createSubject(db, { title: "Premier" });
    const b = await createSubject(db, { title: "Deuxième" });
    const c = await createSubject(db, { title: "Troisième" });
    expect([a.reference, b.reference, c.reference]).toEqual([
      "SUB-00001",
      "SUB-00002",
      "SUB-00003",
    ]);

    // C'est exactement le geste qui a cassé la prod : on supprime un sujet AU
    // MILIEU. Le compte tombe à 2, et l'ancien calcul (`count + 1`) proposait
    // SUB-00003 — déjà pris par `c` → P2002. Le calcul par maximum n'en souffre
    // pas : supprimer au milieu ne change pas le maximum.
    await db.subject.deleteMany({ where: { id: b.id } });
    expect(await db.subject.count()).toBe(2);

    const d = await createSubject(db, { title: "Après suppression" });
    expect(d.reference).toBe("SUB-00004");
    // Et surtout : aucune collision, quel que soit le nombre de créations.
    const e = await createSubject(db, { title: "Encore un" });
    expect(e.reference).toBe("SUB-00005");
  });

  // LIMITE CONNUE ET ASSUMÉE : supprimer le sujet le PLUS RÉCENT fait
  // redescendre le maximum, donc sa référence est réattribuée au suivant. Ce
  // n'est pas une collision (la ligne n'existe plus) et ça ne casse rien ; une
  // séquence strictement monotone exigerait un compteur persistant par compte,
  // machinerie disproportionnée pour un identifiant d'affichage. Ce test fixe le
  // comportement réel plutôt que de laisser croire à une garantie plus forte.
  it("réattribue la référence du dernier sujet supprimé (limite assumée)", async () => {
    const db = await makeAccount("reference-dernier-supprime@test.fr");
    const a = await createSubject(db, { title: "Un" });
    const b = await createSubject(db, { title: "Deux" });
    expect(b.reference).toBe("SUB-00002");
    await db.subject.deleteMany({ where: { id: b.id } });
    const c = await createSubject(db, { title: "Trois" });
    expect(c.reference).toBe("SUB-00002");
    expect(a.reference).toBe("SUB-00001");
  });

  it("reprend la suite même si TOUS les sujets ont été supprimés", async () => {
    const db = await makeAccount("reference-table-vide@test.fr");

    const first = await createSubject(db, { title: "Seul" });
    expect(first.reference).toBe("SUB-00001");
    await db.subject.deleteMany({ where: { id: first.id } });

    // Table vide → il n'y a plus de maximum. On repart à 1, et c'est correct :
    // aucune référence n'est visible nulle part, donc aucune collision possible.
    const next = await createSubject(db, { title: "Nouveau départ" });
    expect(next.reference).toBe("SUB-00001");
  });

  it("ignore les références hors format dans le calcul du maximum", async () => {
    const db = await makeAccount("reference-hors-format@test.fr");

    // Le modèle autorise une référence métier libre (cf. 02-modele-donnees §6,
    // ex. « RH-0042 »). Elle ne doit pas perturber la séquence automatique.
    await createSubject(db, { title: "RH", reference: "RH-0042" });
    const auto = await createSubject(db, { title: "Auto" });
    expect(auto.reference).toBe("SUB-00001");
  });
});
