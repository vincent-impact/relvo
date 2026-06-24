// Squelette de chargement instantané (groupe (app)). Affiché par Next dès le clic
// sur un onglet, le temps que le Server Component + la DB répondent — supprime la
// latence perçue (~1 s) avant l'affichage. Le dock reste rendu par le layout ;
// seul le corps est remplacé. Reproduit la silhouette : hero violet + lignes.

export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-white">
      <div
        className="rounded-b-(--hero-round) bg-relvo pb-9"
        style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}
      >
        <div className="px-[22px] pt-2">
          <div className="h-7 w-44 rounded-lg bg-white/20" />
          <div className="mt-2.5 h-4 w-28 rounded bg-white/15" />
        </div>
      </div>
      <div className="flex-1 space-y-3 px-4 pt-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[76px] animate-pulse rounded-2xl bg-(--surface)"
          />
        ))}
      </div>
    </div>
  );
}
