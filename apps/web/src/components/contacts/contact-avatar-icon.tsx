import { Building2, User, Users } from "lucide-react";
import type { AvatarKind } from "@/lib/contact-avatar";

// Icône d'avatar d'un interlocuteur NON enregistré, rendue par TYPE deviné.
//
// Pourquoi un composant plutôt qu'un `avatarIconFor(kind)` renvoyant le
// composant à monter : `const Icon = avatarIconFor(...)` fabrique une référence
// de composant PENDANT le rendu du parent. Ici la référence est stable (une des
// trois constantes du module), donc rien ne remontait à tort — mais React ne
// peut pas le savoir, et la règle `react-hooks/static-components` la refuse à
// juste titre : le jour où la fabrique deviendrait un peu moins triviale, la
// nouvelle identité à chaque rendu démonterait puis remonterait le sous-arbre.
//
// On ne nomme donc aucune variable de composant : chaque branche rend son icône
// directement, ce qui rend le problème inexprimable au lieu de le contourner.

export function ContactAvatarIcon({
  kind,
  className,
  strokeWidth,
}: {
  kind: AvatarKind;
  className?: string;
  strokeWidth?: number;
}) {
  if (kind === "group")
    return <Users className={className} strokeWidth={strokeWidth} />;
  if (kind === "company")
    return <Building2 className={className} strokeWidth={strokeWidth} />;
  return <User className={className} strokeWidth={strokeWidth} />;
}
