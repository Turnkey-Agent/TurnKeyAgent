"use client";

import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    // BetterAuth Google OAuth — wire up once better-auth is configured
    // import { authClient } from "@/lib/auth-client"
    // await authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" })
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 500);
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
            <h2 className="text-base font-semibold text-[#e8e8f0]">Sign in</h2>
            <p className="text-xs text-[#6b7280] mt-0.5">
              For property managers and landlords
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border border-[#2a2a3a] bg-[#1a1a24] hover:bg-[#2a2a3a] text-sm font-medium text-[#e8e8f0] transition-colors disabled:opacity-60"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#2a2a3a]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#111118] px-2 text-[#6b7280]">or</span>
            </div>
          </div>

          {/* Email/password — BetterAuth placeholder */}
          <div className="flex flex-col gap-2">
            <input
              type="email"
              placeholder="Email"
              className="w-full px-3 py-2 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] text-sm text-[#e8e8f0] placeholder:text-[#6b7280] focus:outline-none focus:border-blue-500 transition-colors"
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full px-3 py-2 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] text-sm text-[#e8e8f0] placeholder:text-[#6b7280] focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={() => (window.location.href = "/dashboard")}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white transition-colors"
            >
              Sign in
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-[#6b7280] mt-4">
          Secured by{" "}
          <span className="text-[#9ca3af]">BetterAuth</span>
        </p>
      </div>
    </div>
  );
}
