import type { LanguageModel } from "ai";
import { z } from "zod";
import { classify } from "../client";
import { NIVEAU_RETENU } from "../config";
import { nettoyerTitre } from "@/lib/echanges-regles";

// Le TITRE d'un échange (M10.4, 05 §11.4) : un appel de CLASSIFICATION à la
// fin du premier tour — rapide, sans raisonnement, coût négligeable —, consigné
// comme les autres. Le système est constant (cache) ; le tour est dans le
// message utilisateur. Un échec laisse le titre de repli de l'appareil.

const SortieTitre = z.object({
  titre: z.string().min(1).max(80),
});

export const SYSTEME_TITRE = `Tu nommes un échange entre un dirigeant et son assistant Relvo, pour une liste d'historique. Rends un titre court — quatre à huit mots —, en français, sans guillemets, sans point final, qui dit DE QUOI il a été question (« Rendez-vous Karim demain 10h », « Affaires urgentes du jour »), jamais « Question sur… » ni « Échange à propos de… ».`;

export async function titrerEchange(args: {
  question: string;
  reponse: string;
  cacheCle?: string;
  modele?: LanguageModel;
}) {
  const { sortie, mesure } = await classify({
    sollicitation: "titre-echange",
    schema: SortieTitre,
    nomSchema: "titre_echange",
    system: SYSTEME_TITRE,
    prompt: [
      `# Le dirigeant a dit`,
      args.question.slice(0, 1_500),
      `# Relvo a répondu`,
      args.reponse.slice(0, 1_500),
      `# Ton titre`,
    ].join("\n"),
    reasoning: NIVEAU_RETENU.classification,
    maxOutputTokens: 60,
    cacheCle: args.cacheCle,
    modele: args.modele,
  });
  return { titre: nettoyerTitre(sortie.titre), mesure };
}
