"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Badge, Button } from "@/components/ui/brutalist";
import { RefreshCw, Terminal, ShieldCheck, Zap, LogOut, UserCheck } from "lucide-react";

export function BrutalistNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    quota,
    healthStatus,
    isRefreshing,
    refreshIntervalMs,
    setRefreshIntervalMs,
    lastRefreshedAt,
    refreshAll,
    refreshJwtToken,
    instantDummyBuySubscription,
    signOut,
    subscriptionNotice,
    clearSubscriptionNotice,
  } = useAuth();

  const handleInstantUpgrade = async () => {
    const target = user?.tier === "PRO" ? "FREE" : "PRO";
    const ok = await instantDummyBuySubscription(target);
    if (ok && pathname !== "/dashboard") {
      router.push("/dashboard");
    }
  };

  return (
    <header className="border-b-2 border-black bg-white sticky top-0 z-40">
      {/* Top Telemetry Status Strip */}
      <div className="border-b-2 border-black bg-black text-white px-4 py-1.5 text-[11px] font-mono uppercase tracking-wider flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-bold">
            STATUS: {healthStatus?.status === "healthy" ? "ONLINE [200 OK]" : "SYNCING"}
          </span>
          <span className="hidden md:inline">
            ENGINE: {healthStatus?.control_plane || "FIRECRACKER-MICROVM"}
          </span>
          <span className="hidden lg:inline">
            DDB: {healthStatus?.table_name || "EPHEMERALSANDBOXTABLE"}
          </span>
          <span className="hidden lg:inline">
            CACHE: {healthStatus?.redis_host || "REDIS:6379"}
          </span>
        </div>

        {/* Real-time Refresh Manager Controls */}
        <div className="flex items-center gap-2">
          <span className="text-neutral-300 hidden sm:inline">
            SYNC: {lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleTimeString() : "--:--:--"}
          </span>
          <select
            aria-label="Real-time refresh interval"
            value={refreshIntervalMs}
            onChange={(e) => setRefreshIntervalMs(Number(e.target.value))}
            className="bg-black text-white border border-white px-1.5 py-0.5 text-[10px] font-mono uppercase focus:outline-none"
          >
            <option value={2000}>POLL: 2S (REAL-TIME)</option>
            <option value={5000}>POLL: 5S (AUTO)</option>
            <option value={15000}>POLL: 15S</option>
            <option value={0}>POLL: MANUAL</option>
          </select>
          <button
            onClick={() => refreshAll()}
            className="border border-white px-2 py-0.5 text-[10px] font-bold uppercase hover:bg-white hover:text-black flex items-center gap-1"
            title="Force immediate telemetry & cache sync"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
            REFRESH
          </button>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 border-2 border-black bg-black text-white flex items-center justify-center font-bold">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-widest uppercase leading-none">
                AURORA // MICROVM
              </div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-600 mt-0.5">
                EPHEMERAL CODE EXECUTION IAAS
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/"
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-2 ${
                pathname === "/"
                  ? "border-black bg-black text-white"
                  : "border-transparent text-black hover:border-black"
              }`}
            >
              LANDING
            </Link>
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-2 ${
                pathname === "/dashboard"
                  ? "border-black bg-black text-white"
                  : "border-transparent text-black hover:border-black"
              }`}
            >
              CONTROL PLANE & EDITOR
            </Link>
            <Link
              href="/auth"
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-2 ${
                pathname === "/auth"
                  ? "border-black bg-black text-white"
                  : "border-transparent text-black hover:border-black"
              }`}
            >
              AUTH / TENANT
            </Link>
          </nav>
        </div>

        {/* Right Account & Dummy Subscription Buy Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {user ? (
            <>
              <div className="border-2 border-black bg-[#F4F4F0] px-3 py-1 text-xs flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5" />
                <span className="font-bold">{user.email}</span>
                <Badge variant={user.tier === "PRO" ? "inverse" : "outline"}>
                  TIER: {user.tier}
                </Badge>
                {quota && (
                  <span className="text-[11px] font-bold">
                    {user.tier === "PRO"
                      ? `[${quota.accumulated_seconds.toFixed(1)}S / UNLIMITED]`
                      : `[${quota.accumulated_seconds.toFixed(1)}S / 14400S]`}
                  </span>
                )}
              </div>

              <Button
                size="sm"
                variant={user.tier === "PRO" ? "outline" : "default"}
                onClick={handleInstantUpgrade}
                title="Instant dummy subscription toggle — no paywall"
              >
                <Zap className="w-3.5 h-3.5 mr-1.5" />
                {user.tier === "PRO"
                  ? "SWITCH TO FREE TIER"
                  : "DUMMY BUY PRO [0.00 USD / INSTANT]"}
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => refreshJwtToken()}
                title="Rotate & refresh HS256 JWT token"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                ROTATE JWT
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  signOut();
                  router.push("/");
                }}
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                EXIT
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={handleInstantUpgrade}
              >
                <Zap className="w-3.5 h-3.5 mr-1.5" />
                INSTANT DUMMY BUY PRO [0.00 USD]
              </Button>
              <Link href="/auth">
                <Button size="sm" variant="outline">
                  SIGN IN / SIGN UP
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Instant Dummy Subscription Confirmation Banner */}
      {subscriptionNotice && (
        <div className="border-t-2 border-black bg-black text-white px-6 py-2 text-xs font-mono uppercase tracking-wider flex items-center justify-between">
          <span>{subscriptionNotice}</span>
          <button
            onClick={clearSubscriptionNotice}
            className="border border-white px-2 py-0.5 text-[10px] font-bold hover:bg-white hover:text-black"
          >
            DISMISS [X]
          </button>
        </div>
      )}
    </header>
  );
}
