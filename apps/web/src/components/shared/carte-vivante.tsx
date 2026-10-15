import { RelvoBlock, RelvoSentence } from "@/components/shared/relvo-block";

// CarteVivante — l'avancement de Relvo qui lit le courrier d'une boîte (05-ia
// §11.11, « l'avancement est une carte vivante, pas une suite de messages ») :
// UNE carte qui se met à jour — messages lus, sujets ouverts, conversations
// ignorées — et dit dans ses mots où elle en est. Tant que la lecture n'est
// pas finie, le total n'est pas connu et la carte le dit ; « rien trouvé
// encore » est une étape, jamais une impasse.
//
// M19.9 lui donne son rendu et son mouvement — un chiffre qui change SE POSE
// (`.arrive`, la durée d'accompagnement : c'est le seul mouvement qu'on a le
// droit de voir), Relvo qui travaille RESPIRE (`.respire`) — et un premier
// consommateur, la page des canaux. M10.16 la posera dans l'échange ; sa
// logique (le rattrapage, `channel_catchups`) ne vit pas ici.

export type CarteVivanteData = {
  status: string;
  messagesImported: number;
  subjectsOpened: number;
  conversationsIgnored: number;
  /** Le nom de la boîte, quand plusieurs cartes se suivent. */
  channelName?: string | null;
};

function phrase(c: CarteVivanteData): string {
  const ou = c.channelName ? ` de ${c.channelName}` : "";
  switch (c.status) {
    case "pending":
      return `Je lirai le courrier des dernières semaines${ou} cette nuit : vos premières affaires seront là demain matin.`;
    case "running":
      return `Je lis le courrier des dernières semaines${ou}. Je ne connais pas encore le total : les chiffres montent à mesure.`;
    case "done":
      return `J’ai lu le courrier récent${ou}. Le reste arrive au fil de l’eau.`;
    case "capped":
      return `J’ai lu le courrier récent${ou} jusqu’au plafond de la nuit. Le reste se trie au fil de l’eau.`;
    default:
      return `La lecture du courrier${ou} s’est interrompue. Je reprendrai la nuit prochaine.`;
  }
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
  const running = data.status === "running";
  const counting = data.status !== "pending";
  return (
    <RelvoBlock className={className} label="Relvo lit le courrier">
      <RelvoSentence>
        {phrase(data)}
        {running ? (
          <span
            className="respire ml-1 inline-flex items-center gap-[3px] align-middle text-relvo"
            aria-hidden
          >
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-[4px] rounded-full bg-current" />
            ))}
          </span>
        ) : null}
      </RelvoSentence>
      {counting ? (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-(--rayon-sous-carte) border border-(--filet) bg-white px-3.5 py-2.5">
          <Compteur
            n={data.messagesImported}
            label={data.messagesImported > 1 ? "messages lus" : "message lu"}
          />
          <Compteur
            n={data.subjectsOpened}
            label={
              data.subjectsOpened > 1 ? "affaires ouvertes" : "affaire ouverte"
            }
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
