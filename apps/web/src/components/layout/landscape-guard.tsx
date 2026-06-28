import { Smartphone } from "lucide-react";

// Verrou portrait — iOS standalone IGNORE `orientation: "portrait"` du manifest
// (et il n'y a pas d'API de lock JS sur Safari). On masque donc l'app derrière un
// voile plein écran DÈS QUE le téléphone passe en paysage, invitant à revenir en
// portrait. Affichage piloté par `globals.css` (`.landscape-guard`) via une media
// query ciblant les PHONES en paysage (max-height + pointeur grossier) → aucun
// impact sur le navigateur desktop ni les tablettes.
export function LandscapeGuard() {
  return (
    <div
      className="landscape-guard fixed inset-0 z-[100] flex-col items-center justify-center gap-4 bg-relvo px-10 text-center text-white"
      role="alertdialog"
      aria-label="Tournez votre appareil en portrait"
    >
      <div className="grid size-16 place-items-center rounded-2xl bg-white/15">
        <Smartphone className="size-8" strokeWidth={2} />
      </div>
      <p className="font-heading text-[19px] font-extrabold tracking-[-0.3px]">
        Relvo s’utilise en portrait
      </p>
      <p className="max-w-[260px] text-[14px] leading-snug text-white/80">
        Tournez votre téléphone à la verticale pour continuer.
      </p>
    </div>
  );
}
