"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui/brutalist";
import { KeyRound, ShieldCheck, Terminal, UserPlus, Zap } from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const {
    user,
    signIn,
    signUp,
    loginDemoOperator,
    instantDummyBuySubscription,
    refreshJwtToken,
    signOut,
  } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("operator@aurora.microvm");
  const [password, setPassword] = useState("aurora2026");
  const [username, setUsername] = useState("operator");
  const [tier, setTier] = useState<"FREE" | "PRO">("FREE");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const res = await signIn(email, password);
        if (!res.ok) {
          setError(res.error || "Sign in failed");
          return;
        }
        router.push("/dashboard");
      } else {
        const res = await signUp({ email, password, tier, username });
        if (!res.ok) {
          setError(res.error || "Sign up failed");
          return;
        }
        router.push("/dashboard");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const ok = await loginDemoOperator();
      if (ok) {
        router.push("/dashboard");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleInstantPro = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const ok = await instantDummyBuySubscription("PRO");
      if (ok) {
        router.push("/dashboard");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div className="border-b-2 border-black pb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest">
            TENANT AUTHENTICATION &amp; JWT SESSION CONTROL
          </h1>
          <p className="text-xs text-neutral-700 mt-1">
             DynamoDB Single-Table <code>ACCOUNT#&lt;id&gt;</code> + PBKDF2-HMAC-SHA256 + HS256 JWT
          </p>
        </div>
        <Badge variant="inverse">POST /AUTH/REGISTER &amp; /AUTH/LOGIN</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT AUTH FORM */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader className="p-0 bg-white border-b-2 border-black">
              <div className="grid grid-cols-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className={`py-3 text-xs font-bold uppercase tracking-widest border-r-2 border-black ${
                    mode === "signin"
                      ? "bg-black text-white"
                      : "bg-[#F4F4F0] text-black hover:bg-white"
                  }`}
                >
                  01 // SIGN IN (POST /AUTH/LOGIN)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setEmail(`tenant-${Math.floor(100 + Math.random() * 900)}@aurora.microvm`);
                    setError(null);
                  }}
                  className={`py-3 text-xs font-bold uppercase tracking-widest ${
                    mode === "signup"
                      ? "bg-black text-white"
                      : "bg-[#F4F4F0] text-black hover:bg-white"
                  }`}
                >
                  02 // SIGN UP (POST /AUTH/REGISTER)
                </button>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-6">
              {error && (
                <div className="border-2 border-black bg-[#D92626] text-white p-3 text-xs font-bold uppercase">
                  ERROR: {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">TENANT EMAIL ADDRESS</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@aurora.microvm"
                    required
                  />
                </div>

                {mode === "signup" && (
                  <div>
                    <Label htmlFor="username">TENANT HANDLE / USERNAME</Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="operator"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="password">PASSWORD (PBKDF2-HMAC-SHA256)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                {mode === "signup" && (
                  <div>
                    <Label>INITIAL SUBSCRIPTION TIER (DUMMY / NO PAYWALL)</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setTier("FREE")}
                        className={`p-3 border-2 border-black text-left ${
                          tier === "FREE" ? "bg-black text-white" : "bg-white text-black"
                        }`}
                      >
                        <div className="text-xs font-bold uppercase">FREE TIER</div>
                        <div className="text-[10px] opacity-80 mt-0.5">
                          4 HOURS (14,400S) / MONTH CAP
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTier("PRO")}
                        className={`p-3 border-2 border-black text-left ${
                          tier === "PRO" ? "bg-black text-white" : "bg-white text-black"
                        }`}
                      >
                        <div className="text-xs font-bold uppercase">
                          PRO TIER [0.00 USD DUMMY]
                        </div>
                        <div className="text-[10px] opacity-80 mt-0.5">
                          UNLIMITED EXECUTION QUOTA
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {mode === "signin" ? (
                      <>
                        <KeyRound className="w-4 h-4 mr-2" />
                        {submitting ? "AUTHENTICATING..." : "SIGN IN & ISSUE JWT"}
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        {submitting ? "PROVISIONING TENANT..." : `REGISTER ${tier} ACCOUNT`}
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDemoLogin}
                    disabled={submitting}
                  >
                    <Terminal className="w-4 h-4 mr-1.5" />
                    1-CLICK DEMO OPERATOR
                  </Button>
                </div>
              </form>

              <div className="border-t-2 border-black pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs">
                  <div className="font-bold uppercase">WANT UNLIMITED PRO QUOTA IMMEDIATELY?</div>
                  <div className="text-[11px] text-neutral-600">
                    Dummy purchase grants PRO tier automatically without any payment step.
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={handleInstantPro}
                  disabled={submitting}
                >
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  DUMMY BUY PRO [0.00 USD]
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT ACTIVE JWT & SESSION INSPECTOR */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                ACTIVE AUTH CONTEXT STATE
              </CardTitle>
              <Badge variant={user ? "ok" : "outline"}>
                {user ? "AUTHENTICATED" : "ANONYMOUS"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {user ? (
                <>
                  <div className="border-2 border-black bg-[#F4F4F0] p-3 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">SINGLE-TABLE PK:</span>
                      <span className="font-bold">ACCOUNT#{user.account_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">EMAIL:</span>
                      <span className="font-bold">{user.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">SUBSCRIPTION TIER:</span>
                      <Badge variant="inverse">{user.tier}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">METADATA SOURCE:</span>
                      <Badge variant="outline">
                        _fuente: {user._fuente || "cache"}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <div className="font-bold uppercase mb-1">BEARER JWT TOKEN (HS256):</div>
                    <div className="border-2 border-black bg-black text-white p-2.5 text-[10px] break-all font-mono">
                      {user.token}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => refreshJwtToken()}>
                      ROTATE / REFRESH JWT
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => router.push("/dashboard")}
                    >
                      GO TO DASHBOARD
                    </Button>
                    <Button size="sm" variant="danger" onClick={signOut}>
                      SIGN OUT
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-neutral-700">
                    No active Bearer token loaded. Sign in with the pre-seeded Demo Operator
                    credentials or register a new tenant account:
                  </p>
                  <div className="border-2 border-black bg-[#F4F4F0] p-3 space-y-1">
                    <div>
                      <strong>DEMO EMAIL:</strong> operator@aurora.microvm
                    </div>
                    <div>
                      <strong>DEMO PASSWORD:</strong> aurora2026
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
