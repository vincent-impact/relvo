// Layout centré du tunnel d'authentification (connexion, inscription, reset…).
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-2xl font-bold tracking-tight text-primary">
            Relvo
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
