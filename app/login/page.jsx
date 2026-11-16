// SAVE AS: pharmacy-pos/app/login/page.jsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Icon } from "@/components/ui.jsx";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message || "Login failed. Check email and password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
      <div className="card w-full max-w-sm border-t-4 border-brand-600 p-6">
        <div className="flex items-center gap-3">
          <span className="icon-chip">
            <Icon name="pill" className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-bold text-slate-900">Pharmacy POS</h1>
        </div>
        <p className="mt-3 text-sm text-slate-500">Sign in to the counter.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="owner@pharmacy.pk"
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p className="form-error">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-block"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          First time here?{" "}
          <Link href="/signup" className="link">
            Create the first account
          </Link>{" "}
          — it becomes Admin automatically.
        </p>
      </div>
    </main>
  );
}
