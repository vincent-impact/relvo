// LE RETOUR HAPTIQUE (M22.8, recette R10 — retour du dirigeant) : le téléphone
// VIBRE quand l'écoute s'ouvre et quand elle se ferme, au mieux de ce que le
// navigateur donne. Un enrichissement progressif : rien n'en dépend, et un
// appareil qui ne peut pas ne dit rien.
//
// Android : l'API Vibration. iOS n'en a pas, dans Safari comme en PWA : le
// détour connu passe par un INTERRUPTEUR (`<input type="checkbox" switch>`,
// Safari 17.4) qu'un clic programmé fait basculer — c'est le système qui vibre,
// pas la page. Il ne tient que depuis un geste de l'utilisateur, et les
// versions récentes d'iOS le ferment ; on l'essaie, sans y compter.

type Environnement = {
  vibrate?: (ms: number) => boolean;
  document?: Pick<Document, "createElement" | "head">;
};

/** Une impulsion brève — ou rien, sans bruit. */
export function vibrer(
  ms = 12,
  env: Environnement = environnementNavigateur(),
): "vibration" | "interrupteur" | null {
  try {
    if (env.vibrate && env.vibrate(ms)) return "vibration";
  } catch {
    // L'API refuse (pas de geste, pas de matériel) : on passe au détour.
  }
  if (!env.document) return null;
  try {
    const label = env.document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.display = "none";
    const input = env.document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.appendChild(input);
    env.document.head.appendChild(label);
    label.click();
    label.remove();
    return "interrupteur";
  } catch {
    return null;
  }
}

function environnementNavigateur(): Environnement {
  if (typeof navigator === "undefined" || typeof document === "undefined") {
    return {};
  }
  return {
    vibrate:
      typeof navigator.vibrate === "function"
        ? (ms) => navigator.vibrate(ms)
        : undefined,
    document,
  };
}
