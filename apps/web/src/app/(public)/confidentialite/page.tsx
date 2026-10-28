import type { Metadata } from "next";
import Link from "next/link";
import {
  CONTACT_EMAIL,
  Ciel,
  PagePublique,
  Pied,
} from "@/components/site/page-publique";
import { SITE_URL } from "@/lib/hotes";
import s from "../site/site.module.css";

// La POLITIQUE DE CONFIDENTIALITÉ (M24.10) — `relvo.net/confidentialite`. C'est
// l'adresse déclarée à Google sur l'écran de consentement : la page doit dire,
// en clair, ce que Relvo fait des données Gmail et porter la clause d'usage
// limité des API Google. Le reste est le RGPD ordinaire d'un service B2B.
// ⚠️ Un texte qui se lit comme un contrat : toute modification se date, en pied.

export const metadata: Metadata = {
  title: "Politique de confidentialité — Relvo",
  description:
    "Ce que Relvo collecte, pourquoi, qui y accède, combien de temps, et vos droits.",
  alternates: { canonical: `${SITE_URL}/confidentialite` },
  robots: { index: true, follow: true },
};

export default function ConfidentialitePage() {
  return (
    <PagePublique>
      <Ciel>
        <p className={s.surligne} style={{ marginTop: 32 }}>
          Relvo
        </p>
        <h1 className={`${s.titre} ${s.titreLegal}`} style={{ marginTop: 0 }}>
          Politique de confidentialité
        </h1>
        <p className={s.sousTitre}>
          Ce que Relvo collecte, pourquoi, qui y accède, combien de temps, et ce
          que vous pouvez en faire.
        </p>
      </Ciel>

      <main className={s.corps}>
        <article className={s.legal}>
          <section>
            <h2>1. Qui est responsable</h2>
            <p>
              Le service Relvo est édité par <strong>VCC Impact</strong>,
              entreprise individuelle, 6 rue des Consuls, appartement 111,
              bâtiment D, 34970 Lattes, France — SIREN 821 331 725. VCC Impact
              est responsable du traitement des données décrites ici. Pour toute
              question : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              .
            </p>
          </section>

          <section>
            <h2>2. Ce que Relvo traite</h2>
            <h3>Votre compte</h3>
            <p>
              Votre nom, votre adresse e-mail, votre mot de passe (conservé
              haché, jamais en clair) ou l’identifiant de votre compte Google si
              vous vous connectez par lui, votre secteur d’activité et vos
              préférences.
            </p>
            <h3>Les boîtes et messageries que vous confiez à Relvo</h3>
            <p>
              Lorsque vous reliez une boîte e-mail ou un compte WhatsApp, Relvo
              reçoit les messages de cette boîte — reçus et envoyés —, leurs
              pièces jointes, et les coordonnées des personnes qui y écrivent.
              Il conserve les jetons d’accès que le fournisseur de la boîte lui
              remet, chiffrés.
            </p>
            <h3>Ce que Relvo en produit</h3>
            <p>
              Les sujets, les tâches, les rendez-vous, les résumés, les
              brouillons de réponse, les fiches de contact, les dossiers et les
              instructions que vous lui donnez, ainsi que le journal des actions
              faites sur votre compte.
            </p>
            <h3>Vos appareils et votre usage</h3>
            <p>
              L’abonnement aux notifications de chaque appareil où vous
              l’activez ; le journal technique des appels faits au modèle de
              langage pour votre compte (volume, coût, date), sans le contenu de
              vos messages.
            </p>
          </section>

          <section>
            <h2>3. Pourquoi, et sur quelle base</h2>
            <ul>
              <li>
                <strong>Pour rendre le service</strong> que vous avez demandé —
                lire votre courrier, le ranger en sujets, préparer vos réponses,
                vous rappeler ce qu’il y a à faire : l’exécution du contrat qui
                nous lie.
              </li>
              <li>
                <strong>Pour sécuriser le service</strong> et en garder la trace
                — journal des actions, détection d’un usage anormal, maîtrise
                des coûts : notre intérêt légitime.
              </li>
              <li>
                <strong>Avec votre accord</strong> — l’accès à votre compte
                Google, que vous donnez sur l’écran de consentement de Google et
                retirez quand vous voulez ; les notifications, que vous activez
                sur chaque appareil.
              </li>
            </ul>
            <p>
              Relvo n’utilise jamais vos données pour de la publicité, ne les
              vend à personne, et ne les cède à aucun tiers pour son propre
              usage.
            </p>
          </section>

          <section>
            <h2>4. Comment Relvo utilise votre boîte Gmail</h2>
            <p>
              Si vous reliez une boîte Gmail, Relvo demande à Google, par le
              protocole OAuth, les autorisations suivantes, et seulement
              celles-là :
            </p>
            <ul>
              <li>
                <strong>Lire vos e-mails</strong> (<code>gmail.readonly</code>)
                : pour recevoir les messages qui arrivent, relire les deux
                dernières semaines à la connexion, et ranger chacun dans le bon
                sujet avec ses pièces jointes.
              </li>
              <li>
                <strong>Envoyer des e-mails en votre nom</strong> (
                <code>gmail.send</code>) : pour que les réponses que vous
                écrivez ou validez dans Relvo partent de votre adresse, dans le
                fil d’origine.
              </li>
              <li>
                <strong>Connaître votre adresse e-mail</strong> : pour nommer la
                boîte et reconnaître vos propres messages.
              </li>
            </ul>
            <p>
              Relvo ne modifie, ne supprime, n’archive ni ne déplace aucun
              e-mail dans votre boîte Gmail. Les données lues ne sont utilisées
              que pour vous rendre le service décrit ici, dans votre compte ;
              elles ne sont pas lues par des personnes, hormis quand vous nous
              le demandez pour un dépannage ou quand la loi l’exige ; elles ne
              servent ni à de la publicité, ni à entraîner ou améliorer un
              modèle d’intelligence artificielle, le nôtre ou celui d’un tiers.
            </p>
            <div className={s.encadre}>
              <p>
                L’utilisation par Relvo des informations reçues des API Google,
                et leur transfert à toute autre application, respectent les{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  rel="noreferrer"
                >
                  règles relatives aux données utilisateur des services API
                  Google
                </a>
                , y compris leurs exigences d’utilisation limitée.
              </p>
              <p className={s.en}>
                Relvo’s use and transfer to any other app of information
                received from Google APIs will adhere to the Google API Services
                User Data Policy, including the Limited Use requirements.
              </p>
            </div>
            <p>
              Vous retirez cet accès à tout moment : en supprimant la boîte
              depuis la page Canaux de Relvo, ou depuis les{" "}
              <a
                href="https://myaccount.google.com/permissions"
                rel="noreferrer"
              >
                autorisations de votre compte Google
              </a>
              . Relvo cesse alors de lire la boîte ; les messages déjà rangés
              restent dans votre compte jusqu’à ce que vous les supprimiez.
            </p>
          </section>

          <section>
            <h2>5. Qui y accède</h2>
            <p>
              Vos données sont lues par le service, pour votre compte, et par
              personne d’autre. Pour fonctionner, Relvo s’appuie sur des
              prestataires qui les traitent pour notre compte, sous contrat et
              sans droit d’en faire un autre usage :
            </p>
            <table>
              <thead>
                <tr>
                  <th>Prestataire</th>
                  <th>Pour quoi</th>
                  <th>Où</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Vercel</td>
                  <td>Hébergement de l’application</td>
                  <td>Union européenne (Francfort)</td>
                </tr>
                <tr>
                  <td>Neon</td>
                  <td>Base de données</td>
                  <td>Union européenne (Francfort)</td>
                </tr>
                <tr>
                  <td>Cloudflare</td>
                  <td>Stockage des pièces jointes et des documents</td>
                  <td>Union européenne</td>
                </tr>
                <tr>
                  <td>Google</td>
                  <td>Accès aux boîtes Gmail que vous reliez</td>
                  <td>Selon votre compte Google</td>
                </tr>
                <tr>
                  <td>Unipile</td>
                  <td>
                    Connexion des messageries (WhatsApp) et des boîtes e-mail
                    autres que Gmail
                  </td>
                  <td>Union européenne</td>
                </tr>
                <tr>
                  <td>OpenAI</td>
                  <td>
                    Le modèle de langage qui lit vos messages pour les ranger,
                    les résumer et préparer vos réponses
                  </td>
                  <td>
                    États-Unis, sous clauses contractuelles types ; vos données
                    ne servent pas à entraîner ses modèles
                  </td>
                </tr>
                <tr>
                  <td>Resend</td>
                  <td>
                    E-mails du service (vérification d’adresse, mot de passe
                    oublié)
                  </td>
                  <td>Union européenne et États-Unis</td>
                </tr>
              </tbody>
            </table>
            <p>
              Relvo peut aussi communiquer des données quand la loi l’exige, à
              une autorité qui en fait la demande légitime.
            </p>
          </section>

          <section>
            <h2>6. Combien de temps</h2>
            <p>
              Tant que votre compte existe. Relvo ne supprime rien de lui-même :
              un sujet fermé reste consultable, un message rangé reste rangé.
              Quand vous supprimez une boîte, les messages qui en venaient et
              leurs pièces jointes sont effacés. Quand vous demandez la
              suppression de votre compte, ou que nous le fermons à la fin de
              votre abonnement, l’ensemble de vos données — compte, messages,
              fichiers, sujets, journal — est effacé définitivement, et les
              copies techniques de sauvegarde disparaissent sous trente jours.
            </p>
          </section>

          <section>
            <h2>7. Vos droits</h2>
            <p>
              Vous pouvez accéder à vos données, les faire rectifier, les faire
              effacer, en demander une copie dans un format lisible, vous
              opposer à un traitement ou en demander la limitation. Il suffit
              d’écrire à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{" "}
              ; nous répondons sous un mois. Si vous estimez que vos droits ne
              sont pas respectés, vous pouvez saisir la CNIL (
              <a href="https://www.cnil.fr" rel="noreferrer">
                cnil.fr
              </a>
              ).
            </p>
          </section>

          <section>
            <h2>8. Comment vos données sont protégées</h2>
            <p>
              Tous les échanges avec Relvo sont chiffrés en transit. Les jetons
              d’accès aux boîtes sont chiffrés au repos. Chaque compte ne voit
              que ses propres données, et chaque action sur un compte est
              journalisée. L’accès administrateur est réservé à l’éditeur, pour
              l’exploitation du service, et chaque geste administratif est
              tracé.
            </p>
          </section>

          <section>
            <h2>9. Les évolutions de cette politique</h2>
            <p>
              Si elle change, la date ci-dessous change, et nous vous prévenons
              dans l’application quand le changement vous concerne.
            </p>
            <p className={s.date}>Dernière mise à jour : 28 octobre 2026.</p>
            <p className={s.note}>
              Voir aussi les{" "}
              <Link href={`${SITE_URL}/conditions`}>
                conditions d’utilisation
              </Link>
              .
            </p>
          </section>
        </article>
      </main>
      <Pied />
    </PagePublique>
  );
}
