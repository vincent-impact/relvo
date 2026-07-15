import { NextResponse } from "next/server";
import { countPendingFileDeletions, drainFileDeletions } from "@relvo/db";
import { getStorage } from "@relvo/storage";

// Drainage de l'outbox de suppression de fichiers (M4.6).
//
// Déclenché par Vercel Cron (cf. vercel.json). Consomme les clés mises en file
// par le trigger PostgreSQL et supprime les objets correspondants dans R2.
//
// Le report est sans conséquence : un fichier devient INACCESSIBLE dès que sa
// ligne disparaît, puisqu'une URL de lecture n'est signée qu'à partir d'une clé
// résolue en base. Ne reste que la suppression physique, et quelques heures de
// latence n'y changent rien — ni pour la sécurité, ni pour le RGPD.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Vercel Cron signe ses appels avec CRON_SECRET. Sans cette vérification,
  // n'importe qui pourrait déclencher des suppressions.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET non configuré." },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const result = await drainFileDeletions(getStorage());
  const remaining = await countPendingFileDeletions();

  // `remaining` est la sonde à surveiller : une file qui monte d'un drainage à
  // l'autre signale que R2 refuse les suppressions (credentials, quota, panne).
  console.info("[cron] drain-file-deletions", { ...result, remaining });

  return NextResponse.json({ ...result, remaining });
}
