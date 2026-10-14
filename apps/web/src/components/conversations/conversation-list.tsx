"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import {
  type Picto,
  Envelope,
  EyeSlash,
  FolderOpen,
  Trash,
  WhatsappLogo,
} from "@/components/shared/picto";
import { toast } from "sonner";
import {
  ignoreConversationAction,
  loadConversationsAction,
  reactivateConversationAction,
} from "@/server/actions/conversations";
import { SwipeRow } from "@/components/shared/swipe-row";
import { ConversationTriageDialog } from "@/components/conversations/conversation-triage-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CONVERSATION_CHANNEL_SLUGS,
  CONVERSATION_FILTER_SLUGS,
  type ConversationChannelSlug,
  type ConversationFilterSlug,
  type ConversationRowData,
} from "@/lib/conversation-row";
import { initialsFor } from "@/lib/display";
import { guessContactKind } from "@/lib/contact-avatar";
import { ContactAvatarIcon } from "@/components/contacts/contact-avatar-icon";
import {
  ContactCreateDialog,
  type ContactPrefill,
} from "@/components/contacts/contact-create-dialog";
import { cn } from "@/lib/utils";
import { ListPanel } from "@/components/shared/list-panel";
import { RelvoVerdictLine } from "@/components/conversations/relvo-verdict-line";

// Liste /conversations (M6bis.8) — la surface de TRI, hors navigation, atteinte
// par le KPI « Sans sujet » de la page Sujets.
//
// Ne rend QUE les lignes : les filtres vivent dans l'URL et sont rendus par
// `ConversationFilters`, hors du <Suspense> de la liste. Changer de filtre est
// donc une NAVIGATION — la page remonte ce composant (clé), et l'état local
// (scroll infini, retraits optimistes) repart proprement du filtre affiché.
//
// Swipe gauche = Ignorer (rouge) — on écarte la SOURCE, pas le message. Dans le
// filtre « Ignorées », le même geste devient Réactiver (vert) : se dédire doit
// coûter exactement le même effort que faire taire.

const CHANNEL: Record<string, { label: string; icon: Picto }> = {
  email: { label: "Email", icon: Envelope },
  whatsapp: { label: "WhatsApp", icon: WhatsappLogo },
};

// Canal en tête de la ligne méta (icône + nom), suivi de l'aperçu du message.
function ChannelTag({ type }: { type: string }) {
  const c = CHANNEL[type] ?? { label: "Canal", icon: Envelope };
  const Icon = c.icon;
  return (
    <span className="inline-flex flex-none items-center gap-1 text-[12px] font-light text-gris">
      <Icon className="size-3.5" />
      {c.label}
    </span>
  );
}

// Vides HONNÊTES : « rien à trier » (le travail est fait) n'est pas « aucune
// conversation » (il n'y a rien du tout). Confondre les deux ferait croire à une
// perte de données le jour où l'ingestion tombe en panne.
const EMPTY: Record<ConversationFilterSlug, { title: string; hint: string }> = {
  "sans-sujet": {
    title: "Rien à trier ✦",
    hint: "Toutes vos conversations actives sont couvertes par un sujet.",
  },
  suivies: {
    title: "Aucune conversation suivie",
    hint: "Les conversations couvertes par un sujet ouvert apparaîtront ici.",
  },
  ignorees: {
    title: "Aucune conversation ignorée",
    hint: "Les sources que vous faites taire s'accumulent ici, et se réactivent d'un geste.",
  },
};

function ConversationRow({
  data,
  filter,
  onRemove,
  onCreateContact,
}: {
  data: ConversationRowData;
  filter: ConversationFilterSlug;
  onRemove: (id: string) => void;
  /** Avatar d'un interlocuteur NON enregistré → ouvre la pop-up de création. */
  onCreateContact: (prefill: ContactPrefill) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);
  const unread = data.unreadCount > 0;
  // Dans « Ignorées », le geste rend la source au flux ; ailleurs il l'en sort.
  const reviving = filter === "ignorees";
  const isEmail = data.channelType === "email";
  // Un fil ÉCOUTÉ par un ou des sujets ouverts : écarter n'est pas anodin, on
  // NOMME les sujets avant (invariant n°8). Jamais « un ou plusieurs sujets ».
  const listened = !reviving && data.listeningSubjects.length > 0;

  // Avatar de l'interlocuteur : initiales si contact enregistré ; sinon icône
  // selon le type deviné (personne / société / groupe). Tap → fiche (enregistré)
  // ou pop-up de création pré-remplie (non enregistré).
  const isGroup = data.type === "whatsapp_group";
  const registered = data.contactId != null;
  const avatarKind = guessContactKind({
    isGroup,
    name: data.interlocutorName ?? data.title,
    raw: data.interlocutorRaw,
  });
  const rawId = data.interlocutorRaw?.trim() ?? null;
  function tapAvatar() {
    if (registered) {
      // Retour depuis la fiche → cette liste (au bon filtre).
      const from = encodeURIComponent(`/conversations?filtre=${filter}`);
      router.push(`/contacts/${data.contactId}?from=${from}`);
    } else {
      onCreateContact({
        name: data.interlocutorName ?? null,
        email: isEmail ? rawId : null,
        phone: isEmail ? null : (rawId?.split("@")[0] ?? null),
      });
    }
  }

  function swipeLeft() {
    startTransition(async () => {
      const res = reviving
        ? await reactivateConversationAction(data.id)
        : await ignoreConversationAction(data.id);
      if (res.ok) {
        toast.success(
          reviving ? "Conversation réactivée" : "Conversation ignorée",
        );
        // Retrait optimiste : la ligne quitte le filtre courant dans les deux
        // sens (elle n'est plus ignorée / elle l'est devenue).
        onRemove(data.id);
      } else {
        toast.error(res.message);
      }
    });
  }

  // Habillage du swipe gauche par canal : « Supprimer »/rouge (email),
  // « Ignorer »/orange (WhatsApp) — même `ignoreConversation` dessous, AUCUNE
  // donnée supprimée. Réactivation (filtre Ignorées) : vert dans les deux cas.
  // Fil écouté → le geste ouvre d'abord la confirmation (la ligne revient en
  // place, `keepOnAct`) ; sinon il écarte directement.
  // Swipe DROITE = classer (2026-09-07, retour bêta) — rétablit un geste retiré
  // le 2026-07-23 au motif qu'on ne décide pas « à l'aveugle depuis la liste ».
  // L'usage a tranché l'inverse : le tri se fait au pouce, en rafale. La pop-up
  // ne tranche pourtant rien elle-même — elle NAVIGUE vers la conversation avec
  // l'intention en paramètre. Deux bénéfices : on voit le fil avant de confirmer
  // (l'objection de juillet est préservée), et surtout la MESSAGERIE peut y faire
  // désigner le message d'ancrage, impossible depuis une ligne de liste
  // (invariant n°13bis : pas de défaut d'ancre, l'utilisateur désigne toujours).
  function triage(intent: "create" | "link") {
    router.push(`/conversations/${data.id}?classer=${intent}`);
  }

  const onLeft = listened ? () => setConfirmOpen(true) : swipeLeft;
  const leftAction = reviving
    ? {
        onAct: swipeLeft,
        label: "Réactiver",
        icon: RotateCcw,
        tone: "success" as const,
      }
    : isEmail
      ? {
          onAct: onLeft,
          label: "Supprimer",
          icon: Trash,
          tone: "danger" as const,
          keepOnAct: listened,
        }
      : {
          onAct: onLeft,
          label: "Ignorer",
          icon: EyeSlash,
          tone: "warning" as const,
          keepOnAct: listened,
        };

  return (
    <SwipeRow
      onTap={() => router.push(`/conversations/${data.id}`)}
      left={leftAction}
      // Dans « Ignorées », classer n'a pas de sens tant que la source est muette :
      // le seul geste offert reste « Réactiver » (swipe gauche).
      right={
        reviving
          ? undefined
          : {
              onAct: () => setTriageOpen(true),
              label: "Classer",
              icon: FolderOpen,
              tone: "brand" as const,
            }
      }
    >
      <div
        data-list-row
        className={cn(
          "flex items-center gap-3 border-b border-(--filet) px-3.5 py-2.5",
          unread ? "bg-white" : "bg-(--fond-enfonce)",
        )}
      >
        {(() => {
          const avatarClass = cn(
            "chiffre grid size-10 flex-none place-items-center rounded-full text-[14px]",
            unread
              ? "bg-actor-ext-fond text-actor-ext"
              : "bg-(--fond-puce) text-gris",
          );
          const inner = registered ? (
            (initialsFor(data.interlocutorName) ?? "?")
          ) : (
            <ContactAvatarIcon kind={avatarKind} className="size-[18px]" />
          );
          // Un groupe n'est pas un contact : son avatar n'ouvre pas de fiche, le
          // tap retombe sur la ligne (ouverture de la conversation).
          return isGroup ? (
            <span className={avatarClass}>{inner}</span>
          ) : (
            <button
              type="button"
              // Isole le geste de la SwipeRow (sinon le tap ouvrirait aussi la
              // conversation) : on coupe le pointerdown avant qu'elle ne capture.
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                tapAvatar();
              }}
              aria-label={
                registered ? "Voir le contact" : "Enregistrer le contact"
              }
              className={cn(avatarClass, "active:opacity-80")}
            >
              {inner}
            </button>
          );
        })()}

        <div className="min-w-0 flex-1">
          {/* Titre sur 2 lignes max — lisible EN ENTIER (souvent = l'objet d'un
              email) ; l'heure se cale en haut à droite. */}
          <div className="flex items-start gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[14.5px] leading-[18px]",
                unread ? "font-medium text-noir" : "font-normal text-noir",
              )}
            >
              {data.title}
            </span>
            <span
              className={cn(
                "chiffre flex-none text-[13px] leading-[18px]",
                unread ? "text-relvo" : "text-gris",
              )}
            >
              {data.time}
            </span>
          </div>

          {/* Ligne méta : canal (icône + nom) + aperçu (une ligne) + pastille. */}
          <div className="mt-0.5 flex items-center gap-2">
            <ChannelTag type={data.channelType} />
            <p
              className={cn(
                "line-clamp-1 min-w-0 flex-1 text-[12px] leading-4",
                unread ? "font-normal text-gris" : "font-light text-gris",
              )}
            >
              {data.preview}
            </p>
            {/* Pastille de non-lus façon messagerie — le nombre, pas un point :
                sur une SOURCE, savoir « 14 » plutôt que « des messages » change
                la décision de l'ouvrir ou de l'ignorer. */}
            {unread ? (
              <span className="chiffre inline-flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-relvo px-1.5 text-[11px] text-white">
                {data.unreadCount}
              </span>
            ) : null}
          </div>

          {/* L'avis de tri (M7.20) : action, nature et raison, ou « ignorée par
              Relvo ». Rien si Relvo n'a pas encore lu ce fil — ni si un sujet
              le suit : l'avis a servi, la mémoire vivante est dans le sujet. */}
          {data.listeningSubjects.length === 0 || data.ignored ? (
            <RelvoVerdictLine
              relvo={data.relvo}
              ignore={data.ignore}
              className="mt-1"
            />
          ) : null}
        </div>
      </div>

      <ConversationTriageDialog
        open={triageOpen}
        onOpenChange={setTriageOpen}
        isEmail={isEmail}
        onCreate={() => triage("create")}
        onLink={() => triage("link")}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isEmail ? "Supprimer ce fil ?" : "Ignorer ce fil ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {data.listeningSubjects.length === 1 ? (
                <>
                  Le sujet{" "}
                  <span className="font-semibold text-(--text-primary)">
                    « {data.listeningSubjects[0]!.title} »
                  </span>{" "}
                  écoute encore ce fil. Il ne sera plus alimenté par ces
                  messages. Aucune donnée n’est supprimée.
                </>
              ) : (
                <>
                  Ces sujets écoutent encore ce fil et ne seront plus alimentés
                  :
                  <span className="mt-1.5 block font-semibold text-(--text-primary)">
                    {data.listeningSubjects
                      .map((s) => `« ${s.title} »`)
                      .join(", ")}
                  </span>
                  <span className="mt-1.5 block">
                    Aucune donnée n’est supprimée.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                swipeLeft();
              }}
            >
              {isEmail ? "Supprimer" : "Ignorer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SwipeRow>
  );
}

export function ConversationList({
  filter,
  channel,
  initialItems,
  initialCursor,
}: {
  filter: ConversationFilterSlug;
  channel: ConversationChannelSlug;
  initialItems: ConversationRowData[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  // Pop-up de création de contact (avatar d'un interlocuteur non enregistré) —
  // une seule pour toute la liste, pré-remplie par la ligne cliquée.
  const [contactPrefill, setContactPrefill] = useState<ContactPrefill | null>(
    null,
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  // Une page suivante a-t-elle été chargée ? (cf. resynchronisation ci-dessous)
  const paged = useRef(false);

  // Le polling 30 s (PollRefresh) rejoue le rendu serveur : sans cela, un
  // message ARRIVÉ pendant qu'on trie n'apparaîtrait jamais, ce qui est
  // rédhibitoire sur une surface de tri. On ne resynchronise QUE tant qu'aucune
  // page suivante n'a été chargée — sinon le poll écraserait le scroll infini
  // et ferait « remonter » l'utilisateur sans qu'il ait rien demandé.
  useEffect(() => {
    if (paged.current) return;
    setItems(initialItems);
    setCursor(initialCursor);
  }, [initialItems, initialCursor]);

  const remove = useCallback(
    (id: string) => setItems((prev) => prev.filter((c) => c.id !== id)),
    [],
  );

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoading(true);
    const res = await loadConversationsAction(
      CONVERSATION_FILTER_SLUGS[filter],
      CONVERSATION_CHANNEL_SLUGS[channel],
      cursor,
    );
    if (res.ok) {
      paged.current = true;
      setItems((prev) => [...prev, ...res.data.items]);
      setCursor(res.data.nextCursor);
    } else {
      toast.error(res.message);
    }
    setLoading(false);
    loadingRef.current = false;
  }, [cursor, filter, channel]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "240px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loadMore]);

  const empty = EMPTY[filter];

  return (
    <div>
      {items.length === 0 ? (
        <div className="px-[22px] py-12 text-center">
          <p className="text-[14.5px] font-bold text-(--text-secondary)">
            {empty.title}
          </p>
          <p className="mt-1.5 text-[13px] text-(--text-tertiary)">
            {empty.hint}
          </p>
        </div>
      ) : (
        <ListPanel className="mt-2">
          {items.map((c) => (
            <ConversationRow
              key={c.id}
              data={c}
              filter={filter}
              onRemove={remove}
              onCreateContact={setContactPrefill}
            />
          ))}
        </ListPanel>
      )}

      {cursor ? (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-5 text-(--text-tertiary)"
        >
          {loading ? (
            <Loader2 className="size-5 animate-spin" strokeWidth={2} />
          ) : null}
        </div>
      ) : null}

      <ContactCreateDialog
        open={contactPrefill != null}
        onOpenChange={(o) => {
          if (!o) setContactPrefill(null);
        }}
        prefill={contactPrefill ?? {}}
      />
    </div>
  );
}
