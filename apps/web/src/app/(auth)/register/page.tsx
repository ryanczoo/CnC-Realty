"use client";

import { Button } from "@/components/ui/button";
import { PasswordInput, inputClass } from "@/components/ui/PasswordInput";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Registration failed.");
      return;
    }

    router.push("/login?registered=1");
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#1B1B1B] px-4">
      <div className="w-full max-w-md rounded-xl bg-[#F2F0EF] p-8 shadow-md">
        <h1 className="mb-2 text-2xl font-bold text-[#1B1B1B]">Create Account</h1>

        {error && (
          <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
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
            minLength={8}
          />
          <PasswordInput
            placeholder="Re-enter Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            style={{ backgroundColor: "#9E8C61", color: "white" }}
          >
            {loading ? "Creating account…" : "Continue"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[#1B1B1B]/60">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[#1B1B1B] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
