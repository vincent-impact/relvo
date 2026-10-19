// L'ENREGISTREUR d'une dictée (M22.2) — la machine à trois états du micro,
// SANS navigateur : tout ce qui vient de l'appareil (`getUserMedia`,
// `MediaRecorder`, l'horloge, le minuteur) est injecté, ce qui la rend tenue
// par un test (`test/dictee.test.ts`). Le crochet `useDictee` la branche sur
// le vrai navigateur ; la page d'essai du backoffice et le composer passent
// par lui.
//
// Ce qu'elle garantit :
//   • le micro est demandé SUR LE GESTE (`demarrer`), jamais avant ;
//   • l'enregistrement s'arrête au plafond, à la piste coupée (iOS éteint le
//     micro quand l'écran s'éteint), ou au geste — et dans les trois cas la
//     piste est LIBÉRÉE : le voyant du téléphone doit s'éteindre ;
//   • arrêter deux fois ne produit qu'un résultat ;
//   • sous la durée minimale, rien n'est rendu (`trop-court`).

export type RecorderLike = {
  readonly mimeType: string;
  start(timesliceMs?: number): void;
  stop(): void;
  ondataavailable: ((e: { data: BlobPart }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
};

export type PisteLike = { stop(): void; onended: (() => void) | null };
export type FluxLike = { getTracks(): PisteLike[] };

export type DepsEnregistreur = {
  demanderMicro: () => Promise<FluxLike>;
  creerRecorder: (flux: FluxLike, mimeType: string) => RecorderLike;
  /** Le type MIME retenu pour cet appareil (`typeAudioSupporte`). */
  mimeType: string;
  assembler: (morceaux: BlobPart[], mimeType: string) => Blob;
  maintenant: () => number;
  /** Planifie `fn` dans `ms` ; rend l'annulation. */
  planifier: (fn: () => void, ms: number) => () => void;
  dureeMaxS: number;
  dureeMinS: number;
};

export type RaisonArret = "geste" | "plafond" | "coupe";

export type Enregistrement = {
  audio: Blob;
  mimeType: string;
  dureeS: number;
  raison: RaisonArret;
};

export class ErreurEnregistrement extends Error {
  readonly code: "permission" | "trop-court" | "indisponible";
  constructor(code: ErreurEnregistrement["code"], cause?: unknown) {
    super(code, cause instanceof Error ? { cause } : undefined);
    this.name = "ErreurEnregistrement";
    this.code = code;
  }
}

export class Enregistreur {
  private flux: FluxLike | null = null;
  private recorder: RecorderLike | null = null;
  private morceaux: BlobPart[] = [];
  private debutMs = 0;
  /** L'instant où l'arrêt a été demandé : la durée de la dictée s'arrête là, pas à l'événement `stop`. */
  private finMs: number | null = null;
  private annulerPlafond: (() => void) | null = null;
  private fin: Promise<Enregistrement> | null = null;
  private terminerFin: ((e: Enregistrement) => void) | null = null;
  private echouerFin: ((e: unknown) => void) | null = null;

  constructor(private readonly deps: DepsEnregistreur) {}

  get enCours(): boolean {
    return this.recorder !== null;
  }

  /** Secondes écoulées depuis le début (jusqu'à l'arrêt demandé), 0 au repos. */
  duree(): number {
    if (!this.recorder) return 0;
    return ((this.finMs ?? this.deps.maintenant()) - this.debutMs) / 1000;
  }

  /** Demande le micro et commence à enregistrer. Idempotent en cours. */
  async demarrer(): Promise<void> {
    if (this.recorder) return;
    let flux: FluxLike;
    try {
      flux = await this.deps.demanderMicro();
    } catch (err) {
      throw new ErreurEnregistrement("permission", err);
    }
    let recorder: RecorderLike;
    try {
      recorder = this.deps.creerRecorder(flux, this.deps.mimeType);
    } catch (err) {
      for (const p of flux.getTracks()) p.stop();
      throw new ErreurEnregistrement("indisponible", err);
    }
    this.flux = flux;
    this.recorder = recorder;
    this.morceaux = [];
    this.fin = new Promise<Enregistrement>((resolve, reject) => {
      this.terminerFin = resolve;
      this.echouerFin = reject;
    });
    // Une promesse de fin sans preneur ne doit pas remonter en « unhandled ».
    this.fin.catch(() => undefined);
    recorder.ondataavailable = (e) => {
      this.morceaux.push(e.data);
    };
    recorder.onerror = (e) => {
      this.conclure("coupe", e);
    };
    recorder.onstop = null;
    for (const p of flux.getTracks()) {
      p.onended = () => this.arreter("coupe");
    }
    this.debutMs = this.deps.maintenant();
    this.finMs = null;
    recorder.start(1_000);
    this.annulerPlafond = this.deps.planifier(
      () => this.arreter("plafond"),
      this.deps.dureeMaxS * 1_000,
    );
  }

  /**
   * Arrête et rend l'enregistrement. Un second appel pendant l'arrêt rend la
   * même promesse ; au repos, c'est une erreur de programmation.
   */
  arreter(raison: RaisonArret = "geste"): Promise<Enregistrement> {
    if (!this.recorder || !this.fin) {
      return Promise.reject(new ErreurEnregistrement("indisponible"));
    }
    const fin = this.fin;
    const recorder = this.recorder;
    if (recorder.onstop === null) {
      // La durée est celle du geste : le navigateur peut mettre plus d'une
      // seconde à fermer le conteneur, ce temps n'est pas de la dictée.
      this.finMs = this.deps.maintenant();
      recorder.onstop = () => this.conclure(raison);
      try {
        recorder.stop();
      } catch (err) {
        this.conclure("coupe", err);
      }
    }
    return fin;
  }

  /** Abandonne : rien n'est rendu, la piste est libérée. */
  annuler(): void {
    if (!this.recorder) return;
    const recorder = this.recorder;
    recorder.onstop = () => undefined;
    recorder.ondataavailable = null;
    try {
      recorder.stop();
    } catch {
      // Déjà arrêté.
    }
    const echouer = this.echouerFin;
    this.liberer();
    echouer?.(new ErreurEnregistrement("trop-court"));
  }

  private conclure(raison: RaisonArret, erreur?: unknown): void {
    if (!this.recorder) return;
    const mimeType = this.recorder.mimeType || this.deps.mimeType;
    const dureeS = this.duree();
    const morceaux = this.morceaux;
    const terminer = this.terminerFin;
    const echouer = this.echouerFin;
    this.liberer();
    if (erreur !== undefined && morceaux.length === 0) {
      echouer?.(new ErreurEnregistrement("indisponible", erreur));
      return;
    }
    if (dureeS < this.deps.dureeMinS || morceaux.length === 0) {
      echouer?.(new ErreurEnregistrement("trop-court"));
      return;
    }
    terminer?.({
      audio: this.deps.assembler(morceaux, mimeType),
      mimeType,
      dureeS,
      raison,
    });
  }

  private liberer(): void {
    this.annulerPlafond?.();
    this.annulerPlafond = null;
    if (this.flux) {
      for (const p of this.flux.getTracks()) {
        p.onended = null;
        try {
          p.stop();
        } catch {
          // Piste déjà arrêtée.
        }
      }
    }
    this.flux = null;
    this.recorder = null;
    this.finMs = null;
    this.morceaux = [];
    this.fin = null;
    this.terminerFin = null;
    this.echouerFin = null;
  }
}
