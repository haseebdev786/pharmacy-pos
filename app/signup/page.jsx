// SAVE AS: pharmacy-pos/app/signup/page.jsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Icon } from "@/components/ui.jsx";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message || "Sign-up failed. Try a different email.");
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
          <p className="text-lg font-bold text-slate-900">Pharmacy POS</p>
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Create account</h1>
        <p className="mt-1 text-sm text-slate-500">
          The first account in a fresh database becomes Admin. Later accounts
          start as Cashier until an Admin promotes them.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="label">
              Full name
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Haseeb Maqsood"
            />
          </div>

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
              Password (min 6 characters)
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
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
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="link">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
