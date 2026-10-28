import { after, NextResponse } from "next/server";
import { recevoirNotification } from "@/server/gmail/reception";
import {
  adresseDuWebhook,
  notificationDepuis,
  verifierJetonPush,
} from "@/server/gmail/verification";

// LE WEBHOOK GMAIL (M24.3) : Pub/Sub pousse ici chaque notification de
// changement d'une boîte abonnée. Authentifié par le jeton OIDC du compte de
// service de l'abonnement. On répond AUSSITÔT — Pub/Sub attend un 2xx sous
// dix secondes, sinon il réessaie — et on travaille après la réponse
// (`after`, comme la route de tranche). Un corps illisible ou une boîte
// inconnue valent 200 : rien à rejouer.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const compteDeService = process.env.GMAIL_PUSH_SERVICE_ACCOUNT;
  if (!compteDeService) {
    return NextResponse.json(
      { error: "GMAIL_PUSH_SERVICE_ACCOUNT non configuré." },
      { status: 503 },
    );
  }
  const jeton = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (
    !jeton ||
    !(await verifierJetonPush(jeton, {
      audience: adresseDuWebhook(),
      compteDeService,
    }))
  ) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const corps = await req.json().catch(() => null);
  const notification = notificationDepuis(corps);
  if (!notification) {
    return NextResponse.json({ ok: true, ignored: "payload" });
  }
  after(async () => {
    try {
      const bilan = await recevoirNotification(notification);
      console.info("[gmail] notification", {
        adresse: notification.emailAddress,
        messageId: notification.messageId,
        ...bilan,
      });
    } catch (err) {
      console.error(
        "[gmail] notification en échec",
        {
          adresse: notification.emailAddress,
          messageId: notification.messageId,
        },
        err,
      );
    }
  });
  return NextResponse.json({ ok: true });
}
