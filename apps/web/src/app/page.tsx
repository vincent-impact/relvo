import { Button } from "@/components/ui/button";

const stack = [
  { label: "Next.js 16", detail: "App Router · React 19" },
  { label: "Prisma 7", detail: "PostgreSQL · 12 entités" },
  { label: "Tailwind v4", detail: "Shadcn UI" },
  { label: "Worker", detail: "Baileys · BullMQ (M6)" },
];

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-xl">
        <span className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
          Socle technique
        </span>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          Relvo
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Assistant IA de pilotage des sollicitations professionnelles. Le socle
          du monorepo est en place — place aux modules M2+ (auth, modèle,
          écrans).
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-3">
          {stack.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-border bg-card p-4"
            >
              <dt className="text-sm font-medium text-card-foreground">
                {item.label}
              </dt>
              <dd className="mt-0.5 text-xs text-muted-foreground">
                {item.detail}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-8">
          <Button>Commencer</Button>
        </div>
      </div>
    </main>
  );
}
