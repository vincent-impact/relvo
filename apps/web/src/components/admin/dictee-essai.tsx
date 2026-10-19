"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ListPanel } from "@/components/shared/list-panel";
import { Microphone } from "@/components/shared/picto";
import { ZoneHeading } from "@/components/shared/zone-heading";
import { useDictee } from "@/hooks/use-dictee";
import { extensionAudio, formatDuree } from "@/lib/dictee-regles";
import { cn } from "@/lib/utils";
import { eur } from "./format";

// L'ESSAI DE DICTÉE du backoffice (M22.1) — l'éprouvette du micro en PWA
// installée, avec le crochet et la route du composer : on maintient, on
// parle, on relâche, le texte revient, la mesure avec lui ; « Partager l'enregistrement » ouvre la
// feuille de partage du téléphone (AirDrop vers le Mac) pour que les dictées
// du benchmark sortent de l'iPhone sans jamais passer par le serveur. Rien
// n'est conservé : l'audio vit dans la page, et meurt avec elle.

export function DicteeEssai() {
  const [texte, setTexte] = useState("");
  const d = useDictee({ onTexte: (t) => setTexte(t) });
  const [partage, setPartage] = useState<string | null>(null);

  async function partager() {
    const e = d.dernierAudio;
    if (!e) return;
    const fichier = new File(
      [e.audio],
      `dictee-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${extensionAudio(e.mimeType)}`,
      { type: e.mimeType },
    );
    try {
      if (navigator.canShare?.({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: "Dictée Relvo" });
        setPartage("Partagé.");
      } else {
        const url = URL.createObjectURL(fichier);
        const a = document.createElement("a");
        a.href = url;
        a.download = fichier.name;
        a.click();
        URL.revokeObjectURL(url);
        setPartage("Téléchargé.");
      }
    } catch {
      setPartage(null);
    }
  }

  if (!d.disponible) {
    return (
      <p className="px-4 text-[14px] font-light text-gris">
        Cet appareil n&apos;offre pas d&apos;enregistrement audio dans le
        navigateur : la dictée n&apos;y est pas proposée.
      </p>
    );
  }

  const enregistre = d.etat === "enregistre";
  const transcrit = d.etat === "transcrit";

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col items-center gap-3 px-4">
        <button
          type="button"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            void d.appuyer();
          }}
          onPointerUp={() => d.relacher()}
          onPointerCancel={() => d.relacher()}
          onContextMenu={(e) => e.preventDefault()}
          disabled={transcrit || !d.pret}
          aria-label={
            enregistre ? "Relâchez pour finir" : "Maintenir pour parler"
          }
          className={cn(
            "grid size-20 touch-none place-items-center rounded-full text-white shadow-disque transition-transform duration-(--dur-presse) select-none [-webkit-touch-callout:none] disabled:opacity-60",
            enregistre && "respire scale-110",
          )}
          style={{ background: "var(--degrade-disque)" }}
        >
          <Microphone className="size-9" />
        </button>
        <p
          className={cn(
            "chiffre text-[22px] font-medium text-noir",
            enregistre &&
              d.dureeS >= d.dureeMaxS - 10 &&
              "text-(--attente-texte)",
          )}
        >
          {formatDuree(d.dureeS)}
          <span className="font-light text-gris">
            {" "}
            / {formatDuree(d.dureeMaxS)}
          </span>
        </p>
        <p
          className="min-h-5 text-center text-[14px] font-light text-gris"
          aria-live="polite"
        >
          {enregistre
            ? "Appuyez pour finir"
            : (d.phrase ??
              "Appuyez pour parler. Le micro est demandé à cet appui.")}
        </p>
        <p className="text-[12px] font-light text-gris">
          {d.mimeType ? `format ${d.mimeType}` : "\u00a0"}
        </p>
      </section>

      <section>
        <ZoneHeading label="Texte transcrit" hint="relisez, corrigez" />
        <div className="px-4">
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={5}
            placeholder="Le texte de votre dictée s'affiche ici."
            className="w-full resize-none rounded-(--rayon-carte) border border-(--filet) bg-white px-3 py-2 text-[14.5px] font-light text-noir outline-none placeholder:text-gris"
          />
        </div>
      </section>

      {d.mesure ? (
        <section>
          <ZoneHeading label="Mesure" hint="ce que le journal consigne" />
          <ListPanel>
            {[
              ["Audio", `${d.mesure.audioSecondes.toFixed(1)} s`],
              ["Latence", `${d.mesure.dureeMs} ms`],
              ["Coût", eur(d.mesure.coutEur)],
              ["Modèle", d.mesure.modele],
            ].map(([k, v]) => (
              <div
                key={k}
                data-list-row
                className="flex items-baseline justify-between gap-3 border-b border-(--filet) px-4 py-2.5 text-[13px]"
              >
                <span className="font-normal text-noir">{k}</span>
                <span className="chiffre text-gris">{v}</span>
              </div>
            ))}
          </ListPanel>
        </section>
      ) : null}

      {d.dernierAudio ? (
        <section className="flex items-center gap-3 px-4">
          <Button type="button" variant="outline" onClick={partager}>
            Partager l&apos;enregistrement
          </Button>
          <span className="text-[13px] font-light text-gris">
            {partage ??
              `${d.dernierAudio.dureeS.toFixed(1)} s · ${Math.round(d.dernierAudio.audio.size / 1024)} Ko`}
          </span>
        </section>
      ) : null}
    </div>
  );
}
