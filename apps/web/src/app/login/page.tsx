"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-lore-border bg-lore-surface p-8">
        <h1 className="font-display text-2xl font-semibold">Loreforge</h1>
        <p className="mt-2 text-sm text-lore-muted">
          Sign in to reach your Home dashboard (P0).
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="text-lore-muted">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-lore-border bg-lore-bg px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-lore-muted">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-lore-border bg-lore-bg px-3 py-2"
            />
          </label>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-lore-accent py-2 font-medium text-lore-bg hover:bg-lore-accent-dim disabled:opacity-50"
          >
            {loading
              ? "…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
        <button
          type="button"
          className="mt-4 w-full text-sm text-lore-muted hover:text-lore-text"
          onClick={() =>
            setMode((m) => (m === "signin" ? "signup" : "signin"))
          }
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
