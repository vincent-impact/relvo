import { Resend } from "resend";

// Emails transactionnels via Resend (M2.7). Dégradation propre : sans
// RESEND_API_KEY (dev), on n'envoie rien et on logue le lien dans la console
// pour pouvoir tester les flux vérif/reset sans configurer Resend.

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM ?? "Relvo <onboarding@resend.dev>";

function baseUrl(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000"
  );
}

async function send(
  to: string,
  subject: string,
  html: string,
  devLink?: string,
) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY absente — email non envoyé à ${to} : « ${subject} »`,
    );
    if (devLink) console.warn(`[email] Lien (dev) : ${devLink}`);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, html });
}

// Gabarit minimal V1, aligné sur la palette navy/blue.
function layout(
  title: string,
  body: string,
  cta: { label: string; url: string },
) {
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0A1128">
    <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
    <p style="font-size:15px;line-height:1.5;color:#3a3f55;margin:0 0 24px">${body}</p>
    <a href="${cta.url}" style="display:inline-block;background:#2B6FE0;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600">${cta.label}</a>
    <p style="font-size:13px;color:#8a90a6;margin:24px 0 0">Si le bouton ne fonctionne pas, copiez ce lien :<br><span style="color:#2B6FE0;word-break:break-all">${cta.url}</span></p>
  </div>`;
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${baseUrl()}/verifier-email?token=${token}`;
  await send(
    email,
    "Vérifiez votre adresse email — Relvo",
    layout(
      "Bienvenue sur Relvo",
      "Confirmez votre adresse email pour activer votre compte. Ce lien expire dans 24 heures.",
      { label: "Vérifier mon email", url },
    ),
    url,
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${baseUrl()}/reinitialiser-mot-de-passe?token=${token}`;
  await send(
    email,
    "Réinitialisation de votre mot de passe — Relvo",
    layout(
      "Réinitialiser votre mot de passe",
      "Vous avez demandé à réinitialiser votre mot de passe. Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
      { label: "Choisir un nouveau mot de passe", url },
    ),
    url,
  );
}
