// Squelette de chargement de la fiche Sujet (M9.19). Affiché par Next dès le
// clic, le temps que getSubjectDetail réponde. Il a la silhouette du rendu :
// le ciel (flèche, ligne du dessus, titre), la carte d'onglets qui le
// chevauche, puis la carte des lignes — jamais l'ancienne matière.

export default function Loading() {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <div
        className="ciel px-4 pb-10"
        style={{
          paddingTop: "calc(max(env(safe-area-inset-top), 12px) + 14px)",
        }}
      >
        <div className="h-[30px] w-[30px] rounded-(--rayon-bouton-ciel) bg-white/14" />
        <div className="mt-3 mb-1 h-3 w-24 rounded bg-white/25" />
        <div className="h-[30px] w-3/4 rounded-lg bg-white/30" />
      </div>
      <div className="relative z-3 mx-4 -mt-7.5 h-[64px] animate-pulse rounded-(--rayon-carte) border border-(--filet) bg-white shadow-carte" />
      <div className="mx-4 mt-4 h-9 w-2/3 animate-pulse rounded-(--rayon-pilule) bg-(--fond-puce)" />
      <div className="mx-4 mt-6 h-5 w-20 animate-pulse rounded bg-(--fond-puce)" />
      <div className="mx-4 mt-2 animate-pulse overflow-hidden rounded-(--rayon-carte) border border-(--filet) bg-white shadow-carte">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[60px] border-b border-(--filet) last:border-b-0"
          />
        ))}
      </div>
    </main>
  );
}
