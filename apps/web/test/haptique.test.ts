import { describe, expect, it } from "vitest";
import { vibrer } from "@/lib/haptique";

// Le retour haptique de la dictée (M22.8, R10) : l'API Vibration quand elle
// répond, le détour de l'interrupteur sinon, et jamais rien de cassé.

function documentFactice() {
  const ajoutes: {
    tag: string;
    attrs: Record<string, string>;
    clics: number;
  }[] = [];
  function creer(tag: string) {
    const el = {
      tag,
      attrs: {} as Record<string, string>,
      clics: 0,
      style: {} as Record<string, string>,
      enfants: [] as unknown[],
      type: "",
      setAttribute(k: string, v: string) {
        el.attrs[k] = v;
      },
      appendChild(e: unknown) {
        el.enfants.push(e);
      },
      click() {
        el.clics += 1;
      },
      remove() {
        const i = ajoutes.indexOf(el);
        if (i >= 0) ajoutes.splice(i, 1);
      },
    };
    return el;
  }
  const head = {
    appendChild(e: unknown) {
      ajoutes.push(e as (typeof ajoutes)[number]);
    },
  };
  return {
    doc: { createElement: creer, head } as unknown as Pick<
      Document,
      "createElement" | "head"
    >,
    ajoutes,
    creer,
  };
}

describe("vibrer", () => {
  it("Android : l'API Vibration suffit, pas d'interrupteur", () => {
    const { doc, ajoutes } = documentFactice();
    const appels: number[] = [];
    const voie = vibrer(12, {
      vibrate: (ms) => {
        appels.push(ms);
        return true;
      },
      document: doc,
    });
    expect(voie).toBe("vibration");
    expect(appels).toEqual([12]);
    expect(ajoutes).toHaveLength(0);
  });

  it("iOS : sans API, un interrupteur bascule d'un clic puis disparaît", () => {
    const { doc } = documentFactice();
    const crees: ReturnType<typeof documentFactice>["creer"] extends (
      t: string,
    ) => infer R
      ? R[]
      : never = [];
    const docEspion = {
      ...doc,
      createElement: (tag: string) => {
        const el = doc.createElement(tag) as unknown as (typeof crees)[number];
        crees.push(el);
        return el as unknown as HTMLElement;
      },
    } as Pick<Document, "createElement" | "head">;
    const voie = vibrer(12, { document: docEspion });
    expect(voie).toBe("interrupteur");
    const label = crees.find((e) => e.tag === "label");
    const input = crees.find((e) => e.tag === "input");
    expect(label?.clics).toBe(1);
    expect(input?.type).toBe("checkbox");
    expect(input?.attrs.switch).toBe("");
  });

  it("une API qui refuse passe au détour ; sans document, rien et sans bruit", () => {
    const { doc } = documentFactice();
    expect(
      vibrer(12, {
        vibrate: () => {
          throw new Error("pas de geste");
        },
        document: doc,
      }),
    ).toBe("interrupteur");
    expect(vibrer(12, {})).toBeNull();
  });
});
