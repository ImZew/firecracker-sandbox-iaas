"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/brutalist";
import {
  ArrowRight,
  Cpu,
  Database,
  HardDrive,
  Layers,
  Lock,
  Terminal,
  Zap,
  Check,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const {
    user,
    quota,
    loginDemoOperator,
    instantDummyBuySubscription,
  } = useAuth();
  const [busyTier, setBusyTier] = useState<string | null>(null);

  const handleDummyPurchase = async (tier: "FREE" | "PRO") => {
    setBusyTier(tier);
    try {
      const ok = await instantDummyBuySubscription(tier);
      if (ok) {
        router.push("/dashboard");
      }
    } finally {
      setBusyTier(null);
    }
  };

  const handleQuickLaunch = async () => {
    if (!user) {
      await loginDemoOperator();
    }
    router.push("/dashboard");
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">
      {/* HERO SECTION */}
      <section className="border-2 border-black bg-white p-8 shadow-brutal">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-4 mb-6">
          <div className="flex items-center gap-2">
            <Badge variant="inverse">CONTROL PLANE V1.0</Badge>
            <Badge variant="outline">LOCALSTACK 4.14 + REDIS 7 + PYTHON 3.11</Badge>
            <Badge variant="default">ZERO PAYWALL // DUMMY SUBSCRIPTION</Badge>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">
            ISOLATION: FIRECRACKER MICROVM
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-3xl sm:text-5xl font-bold uppercase tracking-tight leading-none">
              EPHEMERAL CODE EXECUTION IAAS.
            </h1>
            <p className="text-sm sm:text-base leading-relaxed text-neutral-800 max-w-2xl">
              Multi-tenant serverless control plane for isolated Python 3.11 microVM sandboxes.
              Backed by a DynamoDB Single-Table architecture, Redis Cache-Aside with strict TTL
              expiration, HS256 JWT authentication, and real-time monthly quota enforcement.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button size="lg" variant="default" onClick={handleQuickLaunch}>
                <Terminal className="w-4 h-4 mr-2" />
                OPEN PYTHON DISPATCHER & DASHBOARD
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={() => handleDummyPurchase("PRO")}
                disabled={busyTier !== null}
              >
                <Zap className="w-4 h-4 mr-2" />
                {busyTier === "PRO"
                  ? "ACTIVATING PRO..."
                  : "DUMMY BUY PRO TIER [0.00 USD / INSTANT]"}
              </Button>

              <Link href="/auth">
                <Button size="lg" variant="secondary">
                  SIGN IN / SIGN UP
                </Button>
              </Link>
            </div>

            {user && (
              <div className="border-2 border-black bg-[#F4F4F0] p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                <div>
                  ACTIVE SESSION: <span className="font-bold">{user.email}</span> (
                  <span className="font-bold">{user.account_id}</span>)
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="inverse">CURRENT TIER: {user.tier}</Badge>
                  {quota && (
                    <Badge variant="outline">
                      USED: {quota.accumulated_seconds}S /{" "}
                      {quota.unlimited ? "UNLIMITED" : `${quota.limit_seconds}S`}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT ARCHITECTURE SPEC BOX */}
          <div className="lg:col-span-5 border-2 border-black bg-[#F4F4F0] p-5 space-y-4">
            <div className="border-b-2 border-black pb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest">
                MICROVM TELEMETRY SPEC
              </span>
              <Badge variant="inverse">LIVE</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="border-2 border-black bg-white p-3">
                <div className="text-[10px] text-neutral-600 uppercase">COLD BOOT LATENCY</div>
                <div className="text-lg font-bold mt-1">~1.42 MS</div>
              </div>
              <div className="border-2 border-black bg-white p-3">
                <div className="text-[10px] text-neutral-600 uppercase">REDIS CACHE TTL</div>
                <div className="text-lg font-bold mt-1">300 SEC</div>
              </div>
              <div className="border-2 border-black bg-white p-3">
                <div className="text-[10px] text-neutral-600 uppercase">FREE QUOTA CAP</div>
                <div className="text-lg font-bold mt-1">14,400 SEC</div>
              </div>
              <div className="border-2 border-black bg-white p-3">
                <div className="text-[10px] text-neutral-600 uppercase">PRO QUOTA CAP</div>
                <div className="text-lg font-bold mt-1">UNLIMITED</div>
              </div>
            </div>
            <pre className="border-2 border-black bg-black text-white p-3 text-[11px] overflow-x-auto leading-snug">
{`POST /execute HTTP/1.1
Authorization: Bearer <HS256_JWT>
Content-Type: application/json

{
  "code": "print('Firecracker MicroVM OK')",
  "runtime": "python3.11",
  "timeout": 5.0,
  "memory_limit_mb": 128
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* ARCHITECTURE & SINGLE-TABLE DESIGN GRID */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-2">
          <h2 className="text-lg font-bold uppercase tracking-widest">
            01 // THREE-CONTAINER STACK & DYNAMODB SINGLE-TABLE SCHEMA
          </h2>
          <Badge variant="outline">CDKLOCAL DEPLOY</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                DYNAMODB SINGLE-TABLE
              </CardTitle>
              <Badge variant="inverse">PAY_PER_REQUEST</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p>
                Unified storage inside <strong>EphemeralSandboxTable</strong> partitioned by{" "}
                <code>PK (STRING)</code> and <code>SK (STRING)</code>:
              </p>
              <div className="border-2 border-black bg-[#F4F4F0] p-2.5 space-y-1.5 font-mono text-[11px]">
                <div>
                  <strong>ACCOUNT#&lt;id&gt;</strong> | SK: METADATA
                  <div className="text-neutral-600">tier (FREE|PRO), password_hash, email</div>
                </div>
                <div className="border-t border-black pt-1.5">
                  <strong>QUOTA#&lt;id&gt;#&lt;YYYY-MM&gt;</strong> | SK: SUMMARY
                  <div className="text-neutral-600">accumulated_seconds, limit_seconds</div>
                </div>
                <div className="border-t border-black pt-1.5">
                  <strong>EXEC#&lt;exec_id&gt;</strong> | SK: METADATA
                  <div className="text-neutral-600">code, duration, status, stdout, telemetry</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                REDIS 7 CACHE-ASIDE + TTL
              </CardTitle>
              <Badge variant="outline">PORT 6379</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p>
                Every account and execution lookup checks Redis first and tags the response payload
                with <code>_fuente: &quot;cache&quot; | &quot;dynamodb&quot;</code>.
              </p>
              <div className="border-2 border-black bg-[#F4F4F0] p-2.5 space-y-1.5 font-mono text-[11px]">
                <div>1. GET exec:&lt;id&gt; -&gt; HIT: _fuente=&quot;cache&quot;</div>
                <div>2. MISS -&gt; DynamoDB GetItem(PK=&quot;EXEC#&lt;id&gt;&quot;)</div>
                <div>3. SETEX exec:&lt;id&gt; 300 &lt;json_payload&gt;</div>
                <div>4. RETURN _fuente=&quot;dynamodb&quot;</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                EPHEMERAL SANDBOX RUNNER
              </CardTitle>
              <Badge variant="inverse">PYTHON 3.11</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p>
                Executes untrusted Python snippets with strict timeout capping against remaining
                monthly quota and memory ceilings (<code>RLIMIT_AS</code> +{" "}
                <code>tracemalloc</code>).
              </p>
              <div className="border-2 border-black bg-[#F4F4F0] p-2.5 space-y-1.5 font-mono text-[11px]">
                <div>effective_timeout = min(req_timeout, remaining_quota)</div>
                <div>STATES: CREATING -&gt; BOOTING -&gt; RUNNING -&gt; DESTROYED</div>
                <div>HTTP 429 rejected when FREE &gt;= 14,400s</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* DUMMY SUBSCRIPTION PLANS (NO PAYWALL) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-widest">
              02 // SUBSCRIPTION TIERS — INSTANT DUMMY PURCHASE (NO PAYWALL)
            </h2>
            <p className="text-xs text-neutral-700 mt-0.5">
              Clicking any plan button below immediately updates your tenant record in DynamoDB and
              Redis and issues a new JWT with zero payment wall.
            </p>
          </div>
          <Badge variant="inverse">INSTANT ACTIVATION</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* FREE PLAN */}
          <Card className="flex flex-col justify-between">
            <div>
              <CardHeader>
                <div>
                  <CardTitle className="text-sm">TIER 01 // FREE SANDBOX</CardTitle>
                  <div className="text-[11px] text-neutral-600 mt-0.5">
                    CAPPED AT 4 HOURS (14,400 SECONDS) PER MONTH
                  </div>
                </div>
                <Badge variant={user?.tier === "FREE" ? "inverse" : "outline"}>
                  {user?.tier === "FREE" ? "ACTIVE TIER" : "STANDARD"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-b-2 border-black pb-4 flex items-baseline justify-between">
                  <span className="text-3xl font-bold">0.00 USD</span>
                  <span className="text-xs uppercase font-bold">14,400 SEC / MONTH CAP</span>
                </div>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>14,400 execution seconds per month (4 hours)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>
                      Strict timeout capped at remaining monthly quota (
                      <code>min(timeout, remaining)</code>)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>HTTP 429 Too Many Requests enforcement when quota is exhausted</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Python 3.11 Ephemeral MicroVM Runner + Redis Cache-Aside</span>
                  </li>
                </ul>
              </CardContent>
            </div>
            <div className="p-4 pt-0">
              <Button
                className="w-full"
                variant={user?.tier === "FREE" ? "secondary" : "outline"}
                onClick={() => handleDummyPurchase("FREE")}
                disabled={busyTier !== null}
              >
                {busyTier === "FREE"
                  ? "APPLYING FREE TIER..."
                  : user?.tier === "FREE"
                  ? "CURRENTLY ON FREE TIER — OPEN DASHBOARD"
                  : "ACTIVATE FREE TIER (DUMMY / INSTANT)"}
              </Button>
            </div>
          </Card>

          {/* PRO PLAN */}
          <Card className="flex flex-col justify-between bg-white">
            <div>
              <CardHeader className="bg-black text-white">
                <div>
                  <CardTitle className="text-sm text-white">
                    TIER 02 // PRO ENTERPRISE MICROVM
                  </CardTitle>
                  <div className="text-[11px] text-neutral-300 mt-0.5">
                    UNLIMITED MONTHLY EXECUTION TIME — ZERO QUOTA REJECTIONS
                  </div>
                </div>
                <Badge variant="outline">
                  {user?.tier === "PRO" ? "ACTIVE TIER" : "UNLIMITED"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-b-2 border-black pb-4 flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-bold">0.00 USD</span>
                    <span className="text-xs text-neutral-600 ml-2 line-through">29.00 USD/MO</span>
                  </div>
                  <span className="text-xs uppercase font-bold">DUMMY BUY // NO PAYWALL</span>
                </div>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>
                      <strong>UNLIMITED</strong> monthly execution seconds (no 14,400s ceiling)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Up to 512 MB isolated microVM memory ceiling per execution</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>
                      Instant dummy activation: updates <code>ACCOUNT#&lt;id&gt;</code> &amp;{" "}
                      <code>QUOTA#&lt;id&gt;#&lt;YYYY-MM&gt;</code> immediately
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Full Daily, Weekly, Monthly &amp; Projected Cost Telemetry</span>
                  </li>
                </ul>
              </CardContent>
            </div>
            <div className="p-4 pt-0">
              <Button
                className="w-full"
                variant="default"
                onClick={() => handleDummyPurchase("PRO")}
                disabled={busyTier !== null}
              >
                <Zap className="w-4 h-4 mr-2" />
                {busyTier === "PRO"
                  ? "ACTIVATING PRO SUBSCRIPTION..."
                  : user?.tier === "PRO"
                  ? "PRO TIER ACTIVE — GO TO DASHBOARD"
                  : "DUMMY BUY PRO SUBSCRIPTION NOW [INSTANT / NO PAYWALL]"}
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
