"use server";

import { revalidatePath } from "next/cache";
import {
  Actor,
  DEMO_ACCOUNT_ID,
  type ActionResult,
  activateAccount,
  deleteAccount,
  err,
  getAccountForAdmin,
  ok,
  setAccountTest,
  setAssistantEnabled,
  tenantDb,
  tryAction,
} from "@relvo/db";
import { sendAccountActivatedEmail } from "@/lib/email";
import { requireAdmin } from "@/server/admin";
import { MESSAGES_REFUS, refusSuppression } from "@/server/admin-regles";
import { deleteUnipileAccount } from "@/server/unipile";

// Les gestes du backoffice (M21.4, M21.6). Chaque action commence par
// `requireAdmin()` — le proxy ne voit pas une Server Action (PITFALLS #30) — et
// appelle LA méthode du domaine que le produit utilise déjà, sur le client
// tenant du compte VISÉ (l'identifiant vient de l'écran d'administration, pas
// d'une session : c'est le seul endroit du produit où c'est légitime, et il
// est gardé par le rôle).

function revalidateAdmin(id?: string) {
  revalidatePath("/admin");
  if (id) revalidatePath(`/admin/comptes/${id}`);
}

/** Couper ou rétablir l'assistant d'un compte, acteur `system`, motif en métadonnée. */
export async function adminSetAssistantAction(
  accountId: string,
  enabled: boolean,
  motif: string,
): Promise<ActionResult<{ assistantEnabled: boolean }>> {
  await requireAdmin();
  const result = await tryAction(() =>
    setAssistantEnabled(tenantDb(accountId), accountId, enabled, Actor.system, {
      motif,
    }),
  );
  if (result.ok) revalidateAdmin(accountId);
  return result;
}

/** Marquer un compte « test », ou retirer la marque. */
export async function adminSetTestAction(
  accountId: string,
  isTest: boolean,
): Promise<ActionResult<{ isTest: boolean }>> {
  await requireAdmin();
  const result = await tryAction(() =>
    setAccountTest(tenantDb(accountId), accountId, isTest),
  );
  if (result.ok) revalidateAdmin(accountId);
  return result;
}

/**
 * Ouvrir l'accès d'un compte en attente (M21.6) : la validation de la demande.
 * La personne reçoit un e-mail — sans lui, elle ne saurait pas revenir.
 */
export async function adminActivateAction(
  accountId: string,
): Promise<ActionResult<{ changed: boolean }>> {
  await requireAdmin();
  const compte = await getAccountForAdmin(accountId);
  if (!compte) return err("NOT_FOUND", "Compte introuvable.");
  const result = await tryAction(() =>
    activateAccount(tenantDb(accountId), accountId),
  );
  if (!result.ok) return result;
  if (result.data.changed) {
    try {
      await sendAccountActivatedEmail(compte.email);
    } catch (e) {
      // L'accès EST ouvert ; l'e-mail est un confort. On le dit dans les logs,
      // l'administrateur peut prévenir autrement.
      console.error("[admin] e-mail d'activation non envoyé", compte.email, e);
    }
  }
  revalidateAdmin(accountId);
  return ok({ changed: result.data.changed });
}

/**
 * Supprimer un compte — définitivement (M21.4). Les refus (soi-même, le compte
 * de démonstration, l'e-mail retapé) sont décidés par la règle pure AVANT tout
 * appel ; puis l'agrégateur est déconnecté canal par canal (best-effort, le
 * bilan est consigné) ; puis le domaine supprime et journalise chez l'admin.
 */
export async function adminDeleteAccountAction(
  accountId: string,
  emailSaisi: string,
): Promise<ActionResult<{ email: string; unipile: { echecs: string[] } }>> {
  const admin = await requireAdmin();
  const compte = await getAccountForAdmin(accountId);
  if (!compte) return err("NOT_FOUND", "Compte introuvable.");

  const refus = refusSuppression({
    cibleId: compte.id,
    cibleEmail: compte.email,
    adminId: admin.id,
    demoId: DEMO_ACCOUNT_ID,
    emailSaisi,
  });
  if (refus) return err("VALIDATION", MESSAGES_REFUS[refus]);

  // L'agrégateur D'ABORD : un compte supprimé en base mais vivant chez Unipile
  // continue d'être facturé et d'envoyer des webhooks pour un tenant mort.
  const deconnectes: string[] = [];
  const echecs: string[] = [];
  for (const canal of compte.channels) {
    if (!canal.externalAccountId) continue;
    const fait = await deleteUnipileAccount(canal.externalAccountId);
    (fait ? deconnectes : echecs).push(canal.externalAccountId);
  }

  let result: ActionResult<{ email: string; channels: number }>;
  try {
    result = await tryAction(() =>
      deleteAccount(tenantDb(admin.id), {
        targetId: compte.id,
        unipile: { deconnectes, echecs },
      }),
    );
  } catch (error) {
    // Un échec en base ne doit pas finir en 500 muet : il se journalise avec
    // le compte visé, et l'écran dit quoi faire — relancer efface le reste,
    // chaque étape étant idempotente (PITFALLS #71).
    console.error("[admin] suppression du compte échouée", {
      accountId: compte.id,
      email: compte.email,
      error,
    });
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : null;
    return err(
      "INVALID_STATE",
      `La suppression a échoué en base${code ? ` (${code})` : ""}. Relancez-la : ce qui est effacé ne revient pas, le reste le sera.`,
    );
  }
  if (!result.ok) return result;
  revalidateAdmin();
  return ok({ email: result.data.email, unipile: { echecs } });
}
