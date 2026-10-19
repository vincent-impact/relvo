"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import {
  Microphone,
  PaperPlaneRight,
  Paperclip,
} from "@/components/shared/picto";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import { useDictee } from "@/hooks/use-dictee";
import {
  ajouterDictee,
  formatDuree,
  PHRASES_DICTEE,
} from "@/lib/dictee-regles";
import { cn } from "@/lib/utils";

// RecipientComposer — le composer signature de la Direction B, VIOLET (cohérence
// avec le chrome de l'app ; Relvo n'est plus un destinataire ici, il vit dans le
// bouton du header). Micro quand vide (voice-first), avion dès qu'on tape. 📎 dans
// le champ. `onSend` est optionnel (coquille sans envoi réel).
//
// LA DICTÉE (M22.2, M22.3) — avec l'option `dictee`, le disque est le MICRO
// tant que le champ est vide : un appui demande le micro et enregistre, le
// champ montre le compteur, un appui finit ; « Relvo écoute… » le temps de la
// transcription, puis le texte S'AJOUTE à ce qui était saisi (tranché) et le
// bandeau dit « Dicté — relisez avant d'envoyer ». Jamais envoyé seul : c'est
// l'avion, comme pour tout texte. L'option n'est ouverte que dans l'échange
// tant que M20.1 n'est pas livrée ; sans micro sur l'appareil, le disque
// reste l'avion — un bouton sans effet se retire.
//
// DEUX DISPOSITIONS (2026-09-15, premiers brouillons réels) :
//   · COMPACTE — une ligne : le champ, le trombone à sa droite, le bouton rond à
//     l'extérieur. C'est la réponse courte de messagerie.
//   · ÉLARGIE — dès que le texte passe sur plusieurs lignes, ou qu'un brouillon
//     de Relvo est en rédaction ou posé : le champ prend TOUTE la largeur, et les
//     boutons (trombone, envoi) descendent sur une rangée sous le texte. Un
//     e-mail se relit sur une largeur d'e-mail, pas dans une colonne rognée par
//     deux boutons. On repasse en compact quand le champ est vide.
//
// PLUS AUCUN CHOIX ENTRE CROCHETS (2026-09-16, troisième essai réel) : ce
// qu'un message demande au dirigeant se décide dans le FORMULAIRE DE DÉCISIONS
// de la conversation (`conversations/decision-sheet.tsx`), avant que Relvo ne
// rédige. Le brouillon arrive donc entier, sans crochet ; le composer ne
// surligne ni ne bloque plus rien. Le champ reste un textarea natif.
//
// ⚠️ 2026-07-23 — le SÉLECTEUR d'interlocuteur (avatar + menu) a été RETIRÉ : les
// conversations sont NOMINATIVES, la conversation courante est déjà choisie par
// le sélecteur de conversation en tête de l'onglet. Le composer répond donc
// simplement à la conversation active (`value`), sans bouton ni menu propre.

/** Le brouillon de Relvo dans le composer (M7.7) : en rédaction, puis posé dans le champ. */
export type ComposerDraft = {
  /** Relvo rédige : le champ attend. */
  loading: boolean;
  /** Le texte à poser dans le champ quand il arrive (une fois par valeur). */
  text: string | null;
  /** « Basé sur : … » — les instructions, documents ou précédents cités par Relvo (05 §10.4). */
  sources?: string[];
  onRegenerate?: () => void;
  onClear?: () => void;
};

export type Recipient = {
  key: string;
  name: string;
  kind: "human" | "relvo" | "all";
  initials?: string;
  sublabel?: string;
};

/** Trois points qui respirent — « Relvo rédige ». */
function ThinkingDots() {
  return (
    <span
      className="respire ml-0.5 inline-flex items-center gap-[3px]"
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-[4px] rounded-full bg-current" />
      ))}
    </span>
  );
}

// Métriques du champ, partagées avec le skeleton de rédaction.
const FIELD_METRICS =
  "py-1.5 text-[14.5px] leading-[1.4] break-words whitespace-pre-wrap";

export function RecipientComposer({
  recipients = [{ key: "relvo", name: "Relvo", kind: "relvo" }],
  defaultRecipient,
  value,
  placeholder,
  defaultValue = "",
  // Le trombone ne revient qu'avec l'envoi de pièces jointes (backlog) : un
  // bouton sans effet se retire.
  attach = false,
  dictee = false,
  onSend,
  draft,
}: {
  recipients?: Recipient[];
  defaultRecipient?: string;
  /** Conversation active (synchronisée avec le sélecteur de conversation). */
  value?: string;
  placeholder?: string;
  defaultValue?: string;
  attach?: boolean;
  /** Le disque de dictée (M22) — ouvert dans l'échange seulement. */
  dictee?: boolean;
  /** Retourner `false` (ou une promesse de `false`) préserve le texte saisi. */
  onSend?: (
    text: string,
    recipientKey: string,
  ) => void | boolean | Promise<void | boolean>;
  /** Brouillon de Relvo (M7.7) — jamais envoyé seul : il se pose dans le champ, l'utilisateur envoie. */
  draft?: ComposerDraft | null;
}) {
  const cur = value ?? defaultRecipient ?? recipients[0]?.key ?? "relvo";
  const [text, setText] = useState(defaultValue);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Le brouillon se pose dans le champ à son arrivée, une seule fois par
  // texte (`seen`) : l'utilisateur reste libre de le retoucher ensuite. `posed`
  // dit qu'un brouillon est DANS le champ — levé à l'envoi et à l'effacement,
  // avec la barre qui l'accompagne.
  const [seen, setSeen] = useState<string | null>(null);
  const [posed, setPosed] = useState(false);
  const draftText = draft?.text ?? null;
  if (draftText !== null && draftText !== seen) {
    setSeen(draftText);
    setPosed(true);
    setText(draftText);
  }
  const loading = Boolean(draft?.loading);
  const showDraftBar = loading || posed;
  const r = recipients.find((x) => x.key === cur) || recipients[0];
  const typing = text.trim().length > 0;

  // La dictée : le texte transcrit s'AJOUTE au champ ; s'il passe sur
  // plusieurs lignes, la disposition s'élargit comme à la frappe.
  const d = useDictee({
    onTexte: (t) => {
      setText((prev) => ajouterDictee(prev, t));
      requestAnimationFrame(() => {
        const el = taRef.current;
        if (!el) return;
        if (el.scrollHeight > 40) setMultiline(true);
        // Le curseur en fin de champ : on relit, on corrige, on continue.
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
    },
  });
  const micro = dictee && d.disponible;
  const enregistre = d.etat === "enregistre";
  const ecoute = d.etat === "transcrit";
  // Le bandeau de la dictée (phrase d'échec, « Dicté — … ») se masque d'un ×,
  // à la frappe ou à l'envoi ; une phrase nouvelle le rouvre.
  const [phraseMasquee, setPhraseMasquee] = useState<string | null>(null);
  const phraseDictee = d.phrase && d.phrase !== phraseMasquee ? d.phrase : null;

  // Nom du destinataire tronqué pour tenir le placeholder sur UNE ligne.
  const recipientLabel =
    r && r.name.length > 16 ? `${r.name.slice(0, 15).trimEnd()}…` : r?.name;
  const ph =
    placeholder ||
    (r?.kind === "relvo"
      ? "Demander à Relvo…"
      : r?.kind === "all"
        ? "Répondre à tous…"
        : `Répondre à ${recipientLabel ?? ""}${recipientLabel?.endsWith("…") ? "" : "…"}`);

  // Disposition élargie : à verrou — on y entre dès que le texte dépasse une
  // ligne (mesuré à la frappe) ou qu'un brouillon est là, on n'en sort que le
  // champ vidé, pour ne pas osciller quand le texte, plus large, retiendrait
  // sur une ligne.
  const [multiline, setMultiline] = useState(false);
  const expanded = showDraftBar || multiline;
  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setText(next);
    if (d.phrase === PHRASES_DICTEE.pose) setPhraseMasquee(d.phrase);
    if (!next.trim()) setMultiline(false);
    else if (e.currentTarget.scrollHeight > 40) setMultiline(true);
  }

  // Textarea auto-croissante : un email fait plusieurs lignes, on agrandit le
  // champ jusqu'à un plafond (puis scroll interne) plutôt qu'une ligne unique.
  const maxHeight = expanded ? 240 : 168;
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [text, maxHeight, loading]);

  const [sending, setSending] = useState(false);
  const blocked = sending || loading || enregistre || ecoute;
  const send = async () => {
    if (!typing || blocked) return;
    d.effacerPhrase();
    if (!onSend) {
      setText("");
      return;
    }
    setSending(true);
    try {
      const result = await onSend(text, cur);
      // On ne vide le champ que si l'envoi n'a pas explicitement échoué.
      if (result !== false) {
        setText("");
        setPosed(false);
        setMultiline(false);
      }
    } finally {
      setSending(false);
    }
  };

  // « Brouillon de Relvo » suffit : le champ est visiblement éditable, le
  // curseur y est.
  const barLabel = loading ? (
    <>
      Relvo rédige votre réponse
      <ThinkingDots />
    </>
  ) : (
    "Brouillon de Relvo"
  );
  // Les citations du brouillon (05 §10.4) : un encart minimal, une ligne,
  // sous l'étiquette — l'utilisateur sait d'où vient ce qu'il va envoyer.
  const sources = !loading && posed ? (draft?.sources ?? []) : [];

  // Avec du texte dans le champ, le disque est l'avion — et le micro reste à
  // portée, DANS le champ, à la place du trombone : la dictée s'ajoute à ce
  // qui est saisi (tranché), on ne force personne à effacer pour parler.
  const microDansLeChamp =
    micro && typing && !enregistre && !ecoute ? (
      <button
        type="button"
        onClick={d.basculer}
        disabled={!d.pret || sending || loading}
        aria-label="Dicter"
        className="relative grid size-7 flex-none place-items-center self-end rounded-full text-relvo before:absolute before:-inset-2 before:content-[''] active:bg-relvo-filet disabled:opacity-60"
      >
        <Microphone className="size-5" />
      </button>
    ) : null;

  const attachButton = attach ? (
    <button
      type="button"
      aria-label="Joindre un fichier"
      className="grid flex-none place-items-center py-1.5 text-gris"
    >
      <Paperclip className="size-5" />
    </button>
  ) : null;

  // Le disque dit la vérité : il envoie, et il attend qu'il y ait quoi envoyer.
  // Avec la dictée, il est le MICRO tant qu'il n'y a rien à envoyer — et il
  // reste la dictée (« Finir ») tant qu'elle est en cours.
  const disqueDictee = micro && (enregistre || ecoute || !typing);
  const discClass = cn(
    "grid flex-none place-items-center rounded-full text-white shadow-disque transition-transform duration-(--dur-presse) active:scale-[0.97] disabled:opacity-60",
    expanded ? "size-9" : "size-11",
  );
  const sendButton = disqueDictee ? (
    <button
      type="button"
      onClick={d.basculer}
      disabled={ecoute || !d.pret || sending || loading}
      aria-label={enregistre ? "Finir la dictée" : "Dicter"}
      className={cn(discClass, enregistre && "respire")}
      style={{ background: "var(--degrade-disque)" }}
    >
      {enregistre ? (
        <span
          className={cn(
            "block rounded-[4px] bg-white",
            expanded ? "size-3.5" : "size-4",
          )}
          aria-hidden
        />
      ) : (
        <Microphone className={expanded ? "size-[17px]" : "size-[20px]"} />
      )}
    </button>
  ) : (
    <button
      type="button"
      onClick={send}
      disabled={blocked || !typing}
      aria-label="Envoyer"
      className={discClass}
      style={{ background: "var(--degrade-disque)" }}
    >
      <PaperPlaneRight className={expanded ? "size-[17px]" : "size-[19px]"} />
    </button>
  );

  return (
    <div
      className="relative flex flex-col gap-2 bg-white px-4 pt-2.5 shadow-haut"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
      }}
    >
      {/* La dictée (M22.3) : « Relvo écoute… », « Dicté — relisez avant
          d'envoyer », ou la phrase d'un échec — jamais une erreur technique. */}
      {phraseDictee && !showDraftBar ? (
        <div
          className="flex items-center gap-2 rounded-(--rayon-option) bg-relvo-pale px-3 py-1.5 text-[12.5px] font-medium text-relvo"
          aria-live="polite"
        >
          <RelvoLogo
            size={14}
            variant="full"
            title=""
            className={cn("flex-none", ecoute && "animate-pulse")}
          />
          <span className="flex min-w-0 flex-1 items-center truncate">
            {phraseDictee}
            {ecoute ? <ThinkingDots /> : null}
          </span>
          {!ecoute ? (
            <button
              type="button"
              onClick={() => setPhraseMasquee(d.phrase)}
              aria-label="Masquer"
              className="relative grid size-7 flex-none place-items-center rounded-full text-relvo before:absolute before:-inset-2 before:content-[''] active:bg-relvo-filet"
            >
              <X className="size-[16px]" strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Brouillon de Relvo (M7.7) — étiqueté comme une suggestion modifiable,
          régénérable, effaçable ; jamais envoyé seul (05 §3.1). */}
      {showDraftBar ? (
        <div
          className="flex items-center gap-2 rounded-(--rayon-option) bg-relvo-pale px-3 py-1.5 text-[12.5px] font-medium text-relvo"
          aria-live="polite"
        >
          {/* Le signe de Relvo, le même partout où il parle. */}
          <RelvoLogo
            size={14}
            variant="full"
            title=""
            className={cn("flex-none", loading && "animate-pulse")}
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center truncate">{barLabel}</span>
            {sources.length ? (
              <span
                className="truncate text-[11.5px] font-normal text-gris"
                title={`Basé sur : ${sources.join(", ")}`}
              >
                Basé sur : {sources.join(", ")}
              </span>
            ) : null}
          </span>
          {/* Deux boutons de 28 px, 44 px de frappe par le pseudo-élément. */}
          {!loading && draft?.onRegenerate ? (
            <button
              type="button"
              onClick={draft.onRegenerate}
              aria-label="Régénérer le brouillon"
              className="relative grid size-7 flex-none place-items-center rounded-full text-relvo before:absolute before:-inset-2 before:content-[''] active:bg-relvo-filet"
            >
              <RefreshCw className="size-[15px]" strokeWidth={2.2} />
            </button>
          ) : null}
          {!loading && draft?.onClear ? (
            <button
              type="button"
              onClick={() => {
                setText("");
                setPosed(false);
                setMultiline(false);
                draft.onClear?.();
              }}
              aria-label="Effacer le brouillon"
              className="relative grid size-7 flex-none place-items-center rounded-full text-relvo before:absolute before:-inset-2 before:content-[''] active:bg-relvo-filet"
            >
              <X className="size-[16px]" strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <div
          className={cn(
            "flex min-w-0 flex-1 rounded-[22px]",
            expanded
              ? "flex-col px-[15px] pt-[5px] pb-[7px]"
              : "items-end gap-[7px] py-[5px] pr-1.5 pl-[15px]",
          )}
          style={{ background: "var(--fond-puce)" }}
        >
          {enregistre ? (
            // On enregistre : le compteur, et le geste pour finir.
            <div
              className={cn("min-w-0 flex-1 text-noir", FIELD_METRICS)}
              role="status"
              aria-label="Enregistrement en cours"
            >
              <span
                className={cn(
                  "chiffre",
                  d.dureeS >= d.dureeMaxS - 10 && "text-(--attente-texte)",
                )}
              >
                {formatDuree(d.dureeS)}
              </span>
              <span className="font-light text-gris">
                {" "}
                · {PHRASES_DICTEE.enregistre}
              </span>
            </div>
          ) : loading || ecoute ? (
            // Relvo rédige, ou écoute : le champ montre des lignes qui
            // respirent, pas un vide figé — le texte arrive en quelques secondes.
            <div
              className="min-w-0 flex-1 space-y-2.5 py-2.5"
              role="status"
              aria-label={
                ecoute
                  ? "Relvo écoute votre dictée"
                  : "Relvo rédige votre réponse"
              }
            >
              {["88%", "72%", "52%"].map((w) => (
                <span
                  key={w}
                  className="block h-[11px] animate-pulse rounded-full bg-(--gris-clair)/50"
                  style={{ width: w }}
                />
              ))}
            </div>
          ) : (
            <div className="relative min-w-0 flex-1">
              <textarea
                ref={taRef}
                value={text}
                rows={1}
                onChange={onChange}
                onKeyDown={(e) => {
                  // Email multi-ligne : Entrée = saut de ligne ; ⌘/Ctrl+Entrée = envoi.
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={ph}
                className={cn(
                  "relative block w-full min-w-0 resize-none border-none bg-transparent font-light text-noir outline-none placeholder:text-gris",
                  FIELD_METRICS,
                )}
                style={{ maxHeight }}
              />
            </div>
          )}

          {expanded ? (
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="flex items-center gap-2">
                {attachButton}
                {microDansLeChamp}
              </span>
              {sendButton}
            </div>
          ) : (
            <>
              {attachButton}
              {microDansLeChamp}
            </>
          )}
        </div>

        {expanded ? null : sendButton}
      </div>
    </div>
  );
}
