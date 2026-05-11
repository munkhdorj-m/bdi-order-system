import { createClient } from "@/lib/supabase/server";

type Category = {
  id: string;
  name: string;
  sort_order: number;
};

export default async function Home() {
  const supabase = await createClient();
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true });

  const connected = !error;

  return (
    <main className="flex-1 px-6 py-12 max-w-2xl mx-auto w-full">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">BDI Захиалга</h1>
        <p className="text-zinc-500 mt-1">B2B ordering system — Phase 0 scaffold</p>
      </header>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 mb-8">
        <h2 className="font-medium mb-3">Connection check</h2>
        {connected ? (
          <p className="text-emerald-700 dark:text-emerald-400">
            ✅ Connected to Supabase. Loaded {categories?.length ?? 0} categories.
          </p>
        ) : (
          <div className="text-red-700 dark:text-red-400">
            <p className="font-medium mb-1">❌ Could not query the database.</p>
            <p className="text-sm mb-2">
              This usually means <code>schema.sql</code> hasn&apos;t been run in the Supabase SQL editor yet.
            </p>
            <pre className="text-xs bg-red-50 dark:bg-red-950/30 p-3 rounded overflow-auto">
              {error?.message}
            </pre>
          </div>
        )}
      </section>

      {connected && categories && categories.length > 0 && (
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="font-medium mb-3">Ангилалууд (seeded)</h2>
          <ol className="space-y-1 text-sm">
            {(categories as Category[]).map((c) => (
              <li key={c.id} className="flex gap-3">
                <span className="text-zinc-400 w-6">{c.sort_order}.</span>
                <span>{c.name}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="mt-12 text-xs text-zinc-400">
        Next phase: auth (email magic link) + role-based routing.
      </footer>
    </main>
  );
}
