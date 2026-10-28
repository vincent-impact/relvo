import { RelvoBlock, RelvoSentence } from "@/components/shared/relvo-block";

// CarteVivante — l'avancement de Relvo qui lit le courrier d'une boîte (05-ia
// §11.11, « l'avancement est une carte vivante, pas une suite de messages ») :
// UNE carte qui se met à jour — messages lus, sujets ouverts, conversations
// ignorées — et dit dans ses mots où elle en est. Tant que l'import n'est pas
// fermé, le total n'est pas connu et la carte le dit ; dès qu'il l'est,
// l'avancement se lit en fraction ; « rien trouvé encore » est une étape,
// jamais une impasse.
//
// M19.9 lui donne son rendu et son mouvement — un chiffre qui change SE POSE
// (`.arrive`, la durée d'accompagnement : c'est le seul mouvement qu'on a le
// droit de voir), Relvo qui travaille RESPIRE (`.respire`). Deux consommateurs,
// la page des canaux et l'échange ; sa logique (le rattrapage,
// `channel_catchups`) ne vit pas ici.

export type CarteVivanteData = {
  status: string;
  messagesImported: number;
  messagesTriaged: number;
  subjectsOpened: number;
  conversationsIgnored: number;
  /** Les candidats au tri quand l'import s'est fermé ; null tant qu'on ne les connaît pas. */
  candidatesTotal?: number | null;
  importDone?: boolean;
  stopReason?: string | null;
  /** Le nom de la boîte, quand plusieurs cartes se suivent. */
  channelName?: string | null;
};

/** Ce que Relvo dit de la lecture, selon son état — la même phrase sur l'accueil. */
export function phraseLecture(c: CarteVivanteData): string {
  const ou = c.channelName ? ` de ${c.channelName}` : "";
  switch (c.status) {
    case "pending":
      return `Je commence à lire le courrier des deux dernières semaines${ou}.`;
    case "a-venir":
      return `La boîte${ou} est reliée : je reçois chaque nouveau message. La lecture des deux dernières semaines arrive avec une prochaine mise à jour.`;
    case "running": {
      if (c.messagesImported === 0) {
        return `Je lis le courrier des deux dernières semaines${ou}. Je n’ai rien trouvé encore : la boîte se synchronise.`;
      }
      if (c.importDone && c.candidatesTotal != null && c.candidatesTotal > 0) {
        return `Je lis le courrier des deux dernières semaines${ou} : ${Math.min(c.messagesTriaged, c.candidatesTotal)} fils lus sur ${c.candidatesTotal}.`;
      }
      return `Je lis le courrier des deux dernières semaines${ou}. Je ne connais pas encore le total : les chiffres montent à mesure.`;
    }
    case "done":
      if (c.subjectsOpened === 0) {
        return `J’ai lu le courrier récent${ou} : rien à ouvrir pour l’instant. Je lirai chaque message qui arrive ; reliez une autre adresse si votre courrier arrive ailleurs.`;
      }
      return `J’ai lu le courrier récent${ou}. Le reste arrive au fil de l’eau.`;
    case "capped":
      if (
        c.stopReason === "nuits-epuisees" ||
        c.stopReason === "tranches-epuisees"
      ) {
        return `J’ai lu le courrier récent${ou} jusqu’où je pouvais. Le reste se trie au fil de l’eau.`;
      }
      return `J’ai lu le courrier récent${ou} jusqu’au garde-fou. Je continuerai cette nuit.`;
    default:
      return `La lecture du courrier${ou} s’est interrompue. Je reprends dans quelques minutes.`;
  }
}

/** Relvo travaille : trois points qui respirent, en fin de phrase. */
export function PointsQuiRespirent() {
  return (
    <span
      className="respire ml-1 inline-flex items-center gap-[3px] align-middle text-relvo"
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-[4px] rounded-full bg-current" />
      ))}
    </span>
  );
}

function Compteur({ n, label }: { n: number; label: string }) {
  return (
    <div className="min-w-0">
      {/* La clé change avec le chiffre : il se pose à nouveau (`.arrive`). */}
      <div
        key={n}
        className="chiffre arrive text-[26px] leading-7 text-noir tabular-nums"
      >
        {n}
      </div>
      <div className="truncate text-[12px] leading-4 font-normal text-gris">
        {label}
      </div>
    </div>
  );
}

export function CarteVivante({
  data,
  className,
}: {
  data: CarteVivanteData;
  className?: string;
}) {
  const running = data.status === "running" || data.status === "pending";
  // Rien à compter tant que la lecture n'a pas commencé — ni quand elle est à venir.
  const counting = data.status !== "pending" && data.status !== "a-venir";
  return (
    <RelvoBlock className={className} label="Relvo lit le courrier">
      <RelvoSentence>
        {phraseLecture(data)}
        {running ? <PointsQuiRespirent /> : null}
      </RelvoSentence>
      {counting ? (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-(--rayon-sous-carte) border border-(--filet) bg-white px-3.5 py-2.5">
          <Compteur
            n={data.messagesImported}
            label={data.messagesImported > 1 ? "messages lus" : "message lu"}
          />
          <Compteur
            n={data.subjectsOpened}
            label={data.subjectsOpened > 1 ? "sujets ouverts" : "sujet ouvert"}
          />
          <Compteur
            n={data.conversationsIgnored}
            label={data.conversationsIgnored > 1 ? "ignorées" : "ignorée"}
          />
        </div>
      ) : null}
    </RelvoBlock>
  );
}

/** La projection d'une ligne de rattrapage vers la carte — la même pour l'échange et Canaux. */
export function carteDepuisRattrapage(
  r: {
    status: string;
    messagesImported: number;
    messagesTriaged: number;
    subjectsOpened: number;
    conversationsIgnored: number;
    candidatesTotal: number | null;
    importDone: boolean;
    stopReason: string | null;
  },
  channelName: string | null,
): CarteVivanteData {
  return {
    status: r.status,
    messagesImported: r.messagesImported,
    messagesTriaged: r.messagesTriaged,
    subjectsOpened: r.subjectsOpened,
    conversationsIgnored: r.conversationsIgnored,
    candidatesTotal: r.candidatesTotal,
    importDone: r.importDone,
    stopReason: r.stopReason,
    channelName,
  };
}
