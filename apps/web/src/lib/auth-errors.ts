import { CredentialsSignin } from "next-auth";

// L'erreur de connexion qui n'est pas une erreur d'identifiants (M21.6) : le
// compte existe, le mot de passe est bon, mais l'accès n'a pas encore été
// ouvert par un administrateur. Auth.js remonte le `code` jusqu'à l'action de
// connexion, qui affiche la phrase juste au lieu de « Email ou mot de passe
// incorrect » — une phrase fausse ferait réessayer vingt fois.

export const CODE_ACCES_EN_ATTENTE = "acces_en_attente";

export class AccesEnAttente extends CredentialsSignin {
  code = CODE_ACCES_EN_ATTENTE;
}

export const MESSAGE_ACCES_EN_ATTENTE =
  "Votre accès n'est pas encore ouvert. Vous recevrez un e-mail dès qu'il le sera.";
