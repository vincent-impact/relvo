import type { Metadata } from "next";
import Link from "next/link";
import { Ciel, PagePublique, Pied } from "@/components/site/page-publique";
import { APP_URL, SITE_URL } from "@/lib/hotes";
import s from "./site.module.css";

// La PAGE D'ACCUEIL DU SITE (M24.10) — `relvo.net`, réécrite ici depuis `/`
// (next.config). Ce qu'elle dit : ce que Relvo fait, pour qui, ce qu'il fait
// d'une boîte Gmail — c'est la page que Google lit pour vérifier l'application,
// et elle doit dire l'usage des données Gmail en clair —, et comment entrer.
// Aucune image : les mots et la livrée.

export const metadata: Metadata = {
  title: "Relvo — vos e-mails et vos messages, rangés en sujets",
  description:
    "Relvo lit le courrier d’un dirigeant, ouvre un sujet par situation à suivre, en tire les tâches et prépare les réponses. Pour les dirigeants du food et du bâtiment.",
  alternates: { canonical: `${SITE_URL}/` },
  robots: { index: true, follow: true },
};

export default function SitePage() {
  return (
    <PagePublique>
      <Ciel>
        <p className={s.surligne} style={{ marginTop: 40 }}>
          Pour les dirigeants du food et du bâtiment
        </p>
        <h1 className={s.titre} style={{ marginTop: 0 }}>
          Vos e-mails et vos messages, rangés en sujets.
        </h1>
        <p className={s.sousTitre}>
          Relvo lit le courrier que vous lui confiez, ouvre un sujet par
          situation à suivre, en tire les tâches et prépare vos réponses. Vous
          lui parlez comme à un assistant ; il agit.
        </p>
        <div className={s.actions}>
          <a className={s.bouton} href={`${APP_URL}/inscription`}>
            Demander un accès
          </a>
          <a className={s.boutonSecondaire} href={`${APP_URL}/connexion`}>
            Ouvrir Relvo
          </a>
        </div>
      </Ciel>

      <main className={s.corps}>
        <section className={s.carte} aria-labelledby="fait">
          <h2 id="fait">Ce que Relvo fait</h2>
          <div className={s.trois}>
            <div className={s.etape}>
              <h3>Il lit</h3>
              <p>
                Les boîtes e-mail et le WhatsApp que vous lui reliez, au fil de
                l’eau — et les deux dernières semaines dès la connexion.
              </p>
            </div>
            <div className={s.etape}>
              <h3>Il range</h3>
              <p>
                Un sujet par situation : le devis en attente, la livraison en
                retard, le chantier à planifier. Chacun dans son dossier.
              </p>
            </div>
            <div className={s.etape}>
              <h3>Il agit</h3>
              <p>
                Les tâches et les rendez-vous qu’un message implique, la réponse
                préparée — et un échange pour lui demander le reste.
              </p>
            </div>
          </div>
        </section>

        <section className={s.relvoBloc} aria-labelledby="gmail">
          <h2 id="gmail">Ce que Relvo fait de votre boîte Gmail</h2>
          <p>
            Quand vous reliez une boîte Gmail, vous autorisez Relvo, par votre
            compte Google, à :
          </p>
          <ul className={s.liste}>
            <li>
              <strong>lire</strong> les e-mails que vous recevez et ceux que
              vous envoyez, pour les ranger dans vos sujets et en tirer ce qu’il
              y a à faire ;
            </li>
            <li>
              <strong>envoyer</strong> depuis votre adresse les réponses que
              vous écrivez ou validez dans Relvo, dans le fil d’origine.
            </li>
          </ul>
          <p>
            Il ne modifie, ne supprime ni ne déplace aucun e-mail dans votre
            boîte. Il n’utilise ces données que pour vous rendre ce service :
            elles ne servent ni à de la publicité ni à entraîner un modèle, et
            personne d’autre ne les lit. Vous retirez cet accès à tout moment,
            depuis la page Canaux de Relvo ou depuis les paramètres de votre
            compte Google. Le détail est dans la{" "}
            <Link href={`${SITE_URL}/confidentialite`}>
              politique de confidentialité
            </Link>
            .
          </p>
        </section>

        <section className={s.bloc} aria-labelledby="acces">
          <h2 id="acces">Un accès sur demande</h2>
          <p>
            Relvo est en version bêta, avec un petit nombre de dirigeants.
            L’inscription est libre ; l’accès s’ouvre quand nous validons la
            demande, et nous vous écrivons alors. Vous pouvez relier jusqu’à dix
            boîtes e-mail à un compte.
          </p>
          <p className={s.note}>
            Une question ? Écrivez à{" "}
            <a href="mailto:vincent@vccimpact.fr">vincent@vccimpact.fr</a>.
          </p>
        </section>
      </main>
      <Pied />
    </PagePublique>
  );
}
