import { beforeEach, describe, expect, it, vi } from "vitest";

// LE PUSH (M12.7, M12.9), sans réseau : la charge utile que le worker lit,
// la clé publique en octets, la disponibilité par navigateur, et l'envoi —
// appareils servis datés, appareils morts retirés, échec passager laissé.

const envoi = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));
vi.mock("web-push", () => {
  class WebPushError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    default: {
      sendNotification: envoi.sendNotification,
      setVapidDetails: envoi.setVapidDetails,
    },
    WebPushError,
  };
});

const domaine = vi.hoisted(() => ({
  listPushSubscriptions: vi.fn(),
  removePushSubscription: vi.fn(),
  recordPushSent: vi.fn(),
}));
vi.mock("@relvo/db", () => ({
  tenantDb: (id: string) => ({ id }),
  listPushSubscriptions: domaine.listPushSubscriptions,
  removePushSubscription: domaine.removePushSubscription,
  recordPushSent: domaine.recordPushSent,
}));

describe("les règles du push", async () => {
  const { chargeUtile, abonnementMort, TTL_SECONDES, BIENVENUE } =
    await import("@/server/push/regles");
  const { cleEnOctets, disponibilitePush } = await import("@/lib/push-client");

  it("la charge utile est ce que le worker lit : titre, corps, url, et le tag seulement s'il existe", () => {
    expect(JSON.parse(chargeUtile(BIENVENUE))).toEqual({
      titre: "Relvo",
      corps: BIENVENUE.corps,
      url: "/preferences",
    });
    expect(
      JSON.parse(
        chargeUtile({
          kind: "question",
          titre: "Une question pour vous",
          corps: "Narbonne ?",
          url: "/relvo?from=%2F",
          tag: "question",
        }),
      ).tag,
    ).toBe("question");
  });

  it("404 et 410 tuent un abonnement ; 429, 500 et l'absence de statut le laissent", () => {
    expect(abonnementMort(404)).toBe(true);
    expect(abonnementMort(410)).toBe(true);
    expect(abonnementMort(429)).toBe(false);
    expect(abonnementMort(500)).toBe(false);
    expect(abonnementMort(undefined)).toBe(false);
  });

  it("un brief a une vie courte, une question tient la journée", () => {
    expect(TTL_SECONDES.brief).toBeLessThan(TTL_SECONDES.question);
    expect(TTL_SECONDES.question).toBe(24 * 3600);
  });

  it("la clé publique VAPID passe du base64 URL aux 65 octets d'une clé P-256", () => {
    const cle =
      "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
    const octets = cleEnOctets(cle);
    expect(octets).toHaveLength(65);
    expect(octets[0]).toBe(4);
  });

  it("sur iPhone sans PushManager, c'est « installez l'application » ; ailleurs, c'est indisponible", () => {
    const iphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
    expect(
      disponibilitePush({
        serviceWorker: true,
        pushManager: false,
        notification: false,
        userAgent: iphone,
      }),
    ).toBe("ios-non-installe");
    expect(
      disponibilitePush({
        serviceWorker: true,
        pushManager: true,
        notification: true,
        userAgent: iphone,
      }),
    ).toBe("disponible");
    expect(
      disponibilitePush({
        serviceWorker: false,
        pushManager: false,
        notification: false,
        userAgent: "Mozilla/5.0 (X11; Linux)",
      }),
    ).toBe("indisponible");
  });
});

describe("l'envoi d'une notification", async () => {
  const { envoyerNotification, pushDisponible, clePubliquePush } =
    await import("@/server/push/envoyer");
  const { WebPushError } = await import("web-push");
  const { BIENVENUE } = await import("@/server/push/regles");

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "https://relvo.example";
  });

  it("sans clés, le push est indisponible et rien ne part", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    expect(pushDisponible()).toBe(false);
    expect(clePubliquePush()).toBeNull();
    expect(await envoyerNotification("acc", BIENVENUE)).toEqual({
      envoyes: 0,
      retires: 0,
      echecs: 0,
    });
    expect(domaine.listPushSubscriptions).not.toHaveBeenCalled();
  });

  it("chaque appareil reçoit la charge ; un 410 retire l'appareil ; un 500 le laisse ; les servis sont consignés", async () => {
    domaine.listPushSubscriptions.mockResolvedValue([
      { id: "s1", endpoint: "https://push/1", p256dh: "k1", auth: "a1" },
      { id: "s2", endpoint: "https://push/2", p256dh: "k2", auth: "a2" },
      { id: "s3", endpoint: "https://push/3", p256dh: "k3", auth: "a3" },
    ]);
    envoi.sendNotification.mockImplementation(
      async (sub: { endpoint: string }) => {
        if (sub.endpoint.endsWith("/2"))
          throw new WebPushError("gone", 410, {}, "", sub.endpoint);
        if (sub.endpoint.endsWith("/3"))
          throw new WebPushError("busy", 500, {}, "", sub.endpoint);
        return { statusCode: 201 };
      },
    );
    const bilan = await envoyerNotification("acc", {
      kind: "brief",
      titre: "Votre matinée",
      corps: "2 réponses attendues",
      url: "/",
      tag: "brief",
    });
    expect(bilan).toEqual({ envoyes: 1, retires: 1, echecs: 1 });
    expect(envoi.setVapidDetails).toHaveBeenCalledWith(
      "https://relvo.example",
      "pub",
      "priv",
    );
    const [cible, charge, options] = envoi.sendNotification.mock.calls[0]!;
    expect(cible).toEqual({
      endpoint: "https://push/1",
      keys: { p256dh: "k1", auth: "a1" },
    });
    expect(JSON.parse(charge as string)).toMatchObject({
      titre: "Votre matinée",
      tag: "brief",
      url: "/",
    });
    expect(options).toMatchObject({ TTL: 4 * 3600 });
    expect(domaine.removePushSubscription).toHaveBeenCalledWith(
      { id: "acc" },
      "acc",
      "https://push/2",
      "service",
    );
    expect(domaine.recordPushSent).toHaveBeenCalledWith({ id: "acc" }, "acc", {
      kind: "brief",
      subscriptionIds: ["s1"],
      title: "Votre matinée",
    });
  });

  it("sans appareil abonné, rien ne part et rien n'est consigné", async () => {
    domaine.listPushSubscriptions.mockResolvedValue([]);
    expect(await envoyerNotification("acc", BIENVENUE)).toEqual({
      envoyes: 0,
      retires: 0,
      echecs: 0,
    });
    expect(envoi.sendNotification).not.toHaveBeenCalled();
    expect(domaine.recordPushSent).not.toHaveBeenCalled();
  });
});

describe("le brief du matin (M12.7) — une phrase, ou le silence", async () => {
  const { phraseDuMatin, notificationDuMatin } =
    await import("@/server/push/brief");
  const zero = {
    awaitingReplies: 0,
    awaitingDecisions: 0,
    urgentSubjects: 0,
    tasksToday: 0,
    overdueTasks: 0,
    openQuestions: 0,
  };

  it("les zéros se taisent, les pluriels sont justes, l'ordre est celui de l'accueil", () => {
    expect(
      phraseDuMatin({
        ...zero,
        awaitingReplies: 2,
        urgentSubjects: 1,
        tasksToday: 3,
      }),
    ).toBe("2 réponses attendues · 1 urgence · 3 tâches aujourd'hui");
    expect(
      phraseDuMatin({
        ...zero,
        awaitingReplies: 1,
        awaitingDecisions: 2,
        overdueTasks: 1,
        openQuestions: 1,
      }),
    ).toBe(
      "1 réponse attendue · 2 décisions à prendre · 1 en retard · 1 question de Relvo",
    );
  });

  it("quand tout est à zéro, Relvo se tait : pas de notification", () => {
    expect(phraseDuMatin(zero)).toBeNull();
    expect(notificationDuMatin(zero)).toBeNull();
  });

  it("la notification ouvre l'accueil et remplace le brief précédent", () => {
    expect(notificationDuMatin({ ...zero, tasksToday: 1 })).toEqual({
      kind: "brief",
      titre: "Votre matinée",
      corps: "1 tâche aujourd'hui",
      url: "/",
      tag: "brief",
    });
  });
});

describe("une question de Relvo s'ouvre (M12.9)", async () => {
  const { notificationQuestion, TAG_QUESTION } =
    await import("@/server/push/questions");
  it("la notification porte la question, ouvre l'échange, et remplace la précédente", () => {
    expect(
      notificationQuestion({
        id: "q1",
        text: "Narbonne est-il une franchise ?",
      }),
    ).toEqual({
      kind: "question",
      titre: "Une question pour vous",
      corps: "Narbonne est-il une franchise ?",
      url: "/relvo?from=%2F",
      tag: TAG_QUESTION,
    });
  });
});

describe("l'invitation à activer les notifications (recette 2026-10-21)", () => {
  it("se pose sans « plus tard », se tait pendant le délai, revient après, et ignore une date illisible", async () => {
    const { doitReproposer, REPROPOSER_APRES_MS } =
      await import("../src/lib/push-client");
    const now = new Date("2026-10-21T10:00:00Z");
    expect(doitReproposer(null, now)).toBe(true);
    expect(doitReproposer("n'importe quoi", now)).toBe(true);
    expect(doitReproposer(now.toISOString(), now)).toBe(false);
    expect(
      doitReproposer(
        new Date(now.getTime() - REPROPOSER_APRES_MS + 1).toISOString(),
        now,
      ),
    ).toBe(false);
    expect(
      doitReproposer(
        new Date(now.getTime() - REPROPOSER_APRES_MS).toISOString(),
        now,
      ),
    ).toBe(true);
  });
});
