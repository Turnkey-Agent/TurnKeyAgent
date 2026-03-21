"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const handleEmailLogin = async () => {
    setLoading(true);
    setError("");
    try {
      if (isSignUp) {
        const { error: signUpError } = await authClient.signUp.email({
          email,
          password,
          name: email.split("@")[0],
        });
        if (signUpError) {
          setError(signUpError.message || "Sign up failed");
          setLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email,
          password,
        });
        if (signInError) {
          setError(signInError.message || "Invalid credentials");
          setLoading(false);
          return;
        }
      }
      window.location.href = "/dashboard";
    } catch (err) {
      setError("Authentication failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-xl font-bold text-white mx-auto mb-4">
            TK
          </div>
          <h1 className="text-xl font-semibold text-[#e8e8f0]">Turnkey Agent</h1>
          <p className="text-sm text-[#6b7280] mt-1">Property Operations Dashboard</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#2a2a3a] bg-[#111118] p-8 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#e8e8f0]">
              {isSignUp ? "Create account" : "Sign in"}
            </h2>
            <p className="text-xs text-[#6b7280] mt-0.5">
              For property managers and landlords
            </p>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] text-sm text-[#e8e8f0] placeholder:text-[#6b7280] focus:outline-none focus:border-blue-500 transition-colors"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
              className="w-full px-3 py-2 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] text-sm text-[#e8e8f0] placeholder:text-[#6b7280] focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleEmailLogin}
              disabled={loading || !email || !password}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white transition-colors disabled:opacity-60"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
              ) : isSignUp ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </button>
          </div>

          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Need an account? Sign up"}
          </button>
        </div>

        <p className="text-center text-[10px] text-[#6b7280] mt-4">
          Secured by{" "}
          <span className="text-[#9ca3af]">BetterAuth</span>
        </p>
      </div>
    </div>
  );
}
