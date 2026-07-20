import { Fragment } from "react";
import { cn } from "@/lib/utils";

// LinkifiedText — rend un texte brut (email/WhatsApp) en préservant les sauts de
// ligne, en RENDANT CLIQUABLES les URLs, et surtout en laissant le texte
// s'adapter à la largeur : une URL interminable ne doit jamais élargir l'écran
// (pas de scroll horizontal) — elle se coupe (`overflow-wrap: anywhere`). C'est
// le comportement attendu partout où l'on affiche du contenu de message.

// URLs http(s), et « www. » sans schéma. Volontairement simple (pas de parseur
// complet) : capte le cas courant des liens communiqués dans un email.
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

// Ponctuation de fin fréquemment collée à une URL en prose (« …/page). ») — on la
// rejette hors du lien pour ne pas casser la destination.
function splitTrailing(url: string): [string, string] {
  const match = url.match(/[.,;:!?)\]}'"»]+$/);
  if (!match) return [url, ""];
  // Une parenthèse fermante n'est retirée que si le lien n'ouvre pas de « ( ».
  let trail = match[0];
  if (trail.includes(")") && url.includes("(")) {
    trail = trail.replace(/\)+$/, "");
  }
  return trail ? [url.slice(0, url.length - trail.length), trail] : [url, ""];
}

export function LinkifiedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const [link, trail] = splitTrailing(m[0]);
    const href = link.startsWith("http") ? link : `https://${link}`;
    nodes.push(
      <Fragment key={key++}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="font-medium [overflow-wrap:anywhere] text-relvo underline"
        >
          {link}
        </a>
        {trail}
      </Fragment>,
    );
    last = start + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return (
    <span
      className={cn("[overflow-wrap:anywhere] whitespace-pre-wrap", className)}
    >
      {nodes}
    </span>
  );
}
