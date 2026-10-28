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

// Les CONDITIONS D'UTILISATION (M24.10) — `relvo.net/conditions`, l'adresse
// déclarée à Google. Un service B2B en bêta : ce qu'il fait, ce qu'il ne
// garantit pas, ce que chacun doit à l'autre, et comment on se quitte.
// ⚠️ Un texte qui se lit comme un contrat : toute modification se date, en pied.

export const metadata: Metadata = {
  title: "Conditions d’utilisation — Relvo",
  description:
    "Les conditions d’utilisation du service Relvo : accès, usage, responsabilités, résiliation.",
  alternates: { canonical: `${SITE_URL}/conditions` },
  robots: { index: true, follow: true },
};

export default function ConditionsPage() {
  return (
    <PagePublique>
      <Ciel>
        <p className={s.surligne} style={{ marginTop: 32 }}>
          Relvo
        </p>
        <h1 className={`${s.titre} ${s.titreLegal}`} style={{ marginTop: 0 }}>
          Conditions d’utilisation
        </h1>
        <p className={s.sousTitre}>
          Ce que Relvo vous rend, ce qu’il ne garantit pas, et ce que chacun
          doit à l’autre.
        </p>
      </Ciel>

      <main className={s.corps}>
        <article className={s.legal}>
          <section>
            <h2>1. L’éditeur et l’objet</h2>
            <p>
              Relvo est un service édité par <strong>VCC Impact</strong>,
              entreprise individuelle, 6 rue des Consuls, appartement 111,
              bâtiment D, 34970 Lattes, France — SIREN 821 331 725 — joignable à{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Il
              s’adresse à des professionnels, dans le cadre de leur activité.
              Les présentes conditions régissent l’accès au service et son usage
              ; en ouvrant un compte, vous les acceptez.
            </p>
          </section>

          <section>
            <h2>2. Ce que fait le service</h2>
            <p>
              Relvo lit les boîtes e-mail et les messageries que vous lui
              reliez, range les messages en sujets, en tire des tâches, des
              rendez-vous et des résumés, prépare des réponses que vous validez,
              et répond à vos demandes dans un échange. Ces propositions sont
              produites par un modèle de langage :{" "}
              <strong>
                elles sont une aide, pas une décision. Vous relisez ce que Relvo
                propose, et vous restez responsable de ce que vous envoyez et de
                ce que vous faites.
              </strong>
            </p>
          </section>

          <section>
            <h2>3. L’accès au service</h2>
            <p>
              Relvo est en version bêta. L’inscription est libre ; l’accès
              s’ouvre lorsque l’éditeur valide la demande, et peut être refusé
              ou retiré sans motif pendant cette phase. Un compte est personnel
              : il correspond à une personne, qui garde ses identifiants pour
              elle et répond de ce qui se fait sous son compte. Vous nous
              signalez sans délai tout usage que vous n’avez pas voulu.
            </p>
            <p>
              Vous ne reliez à Relvo que des boîtes et des messageries que vous
              êtes en droit d’utiliser, et vous répondez des autorisations
              données à cette fin. Vous pouvez retirer une boîte à tout moment.
            </p>
          </section>

          <section>
            <h2>4. Ce qui n’est pas permis</h2>
            <ul>
              <li>
                utiliser Relvo pour envoyer des messages non sollicités, ou
                contraires à la loi ;
              </li>
              <li>
                tenter d’accéder aux données d’un autre compte, ou de contourner
                les protections du service ;
              </li>
              <li>
                soumettre volontairement à Relvo des contenus destinés à
                détourner son fonctionnement ;
              </li>
              <li>revendre ou sous-louer l’accès au service.</li>
            </ul>
            <p>
              Un manquement peut entraîner la suspension du compte, après
              avertissement sauf urgence.
            </p>
          </section>

          <section>
            <h2>5. Le prix</h2>
            <p>
              Les conditions tarifaires sont communiquées lors de la
              souscription et acceptées par écrit avant toute facturation.
              Pendant la bêta, l’accès peut être accordé gratuitement ; rien
              n’est facturé sans votre accord exprès. Le service inclut un
              volume d’usage du modèle de langage par compte ; au-delà, Relvo
              peut ralentir ou suspendre ses propositions automatiques, et vous
              le dit.
            </p>
          </section>

          <section>
            <h2>6. Vos données</h2>
            <p>
              Vos données restent les vôtres. Ce que Relvo en fait, qui y accède
              et combien de temps elles sont gardées est décrit dans la{" "}
              <Link href={`${SITE_URL}/confidentialite`}>
                politique de confidentialité
              </Link>
              , qui fait partie des présentes conditions. L’usage des boîtes
              Gmail respecte les règles de Google relatives aux données des
              utilisateurs.
            </p>
          </section>

          <section>
            <h2>7. Disponibilité et responsabilité</h2>
            <p>
              L’éditeur met tout en œuvre pour que le service soit disponible et
              fiable, sans le garantir : Relvo est en bêta, il évolue, et il
              dépend de services tiers (fournisseurs de messagerie, hébergeur,
              modèle de langage) dont l’éditeur ne répond pas. Le service est
              fourni en l’état. L’éditeur ne saurait être tenu responsable d’un
              message mal rangé, d’une proposition inexacte, d’un retard de
              lecture, ni des pertes indirectes — perte de chiffre d’affaires,
              de clientèle ou de données que vous n’auriez pas conservées par
              ailleurs. Si sa responsabilité était engagée, elle serait limitée
              aux sommes que vous lui avez versées au cours des douze derniers
              mois.
            </p>
          </section>

          <section>
            <h2>8. Mettre fin au service</h2>
            <p>
              Vous pouvez supprimer une boîte, ou demander la suppression de
              votre compte, à tout moment ; la suppression du compte efface
              l’ensemble de vos données, sans retour possible. L’éditeur peut
              fermer le service ou un compte, avec un préavis d’un mois sauf
              manquement grave, et vous laisse le temps de récupérer ce qui vous
              appartient.
            </p>
          </section>

          <section>
            <h2>9. Les évolutions des conditions</h2>
            <p>
              Les présentes conditions peuvent évoluer avec le service. La date
              ci-dessous change alors, et nous vous prévenons dans l’application
              quand un changement vous concerne. Continuer à utiliser Relvo
              après un changement vaut acceptation.
            </p>
          </section>

          <section>
            <h2>10. Le droit applicable</h2>
            <p>
              Les présentes conditions sont soumises au droit français. En cas
              de désaccord, nous cherchons d’abord une solution amiable ; à
              défaut, les tribunaux compétents sont ceux du ressort du siège de
              l’éditeur.
            </p>
            <p className={s.date}>Version du 28 octobre 2026.</p>
          </section>
        </article>
      </main>
      <Pied />
    </PagePublique>
  );
}
