"use client";

import { Button } from "@/components/ui/button";
import { PasswordInput, inputClass } from "@/components/ui/PasswordInput";
import { signIn, getSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }

    const session = await getSession();
    router.push(session?.user?.role === "BUYER" ? "/account" : "/dashboard");
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#1B1B1B] px-4">
      <div className="w-full max-w-md rounded-xl bg-[#F2F0EF] p-8 shadow-md">
        <h1 className="mb-2 text-2xl font-bold text-[#1B1B1B]">Sign In</h1>
        <p className="mb-6 text-sm text-[#1B1B1B]/60">Access your agent dashboard or client account.</p>

        {error && (
          <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <PasswordInput
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-[#1B1B1B]/60 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            style={{ backgroundColor: "#9E8C61", color: "white" }}
          >
            {loading ? "Signing in…" : "Continue"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#1B1B1B]/20" />
          <span className="text-xs text-[#1B1B1B]/40">or</span>
          <div className="h-px flex-1 bg-[#1B1B1B]/20" />
        </div>

        <Button
          variant="outline"
          className="w-full border-0"
          style={{ backgroundColor: "#1B1B1B", color: "white" }}
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        >
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-[#1B1B1B]/60">
          New to CnC?{" "}
          <Link href="/register" className="font-medium text-[#9E8C61] hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
