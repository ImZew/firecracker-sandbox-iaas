"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { calculateCostAndMetrics } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Progress,
} from "@/components/ui/brutalist";
import {
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  DollarSign,
  HardDrive,
  Play,
  RefreshCw,
  Server,
  ShieldAlert,
  Terminal,
  Zap,
} from "lucide-react";

const CODE_PRESETS: {
  id: string;
  label: string;
  code: string;
  timeout: number;
  memoryMb: number;
}[] = [
  {
    id: "sha256",
    label: "01 // SHA256 & COMPUTE BENCH",
    timeout: 5.0,
    memoryMb: 128,
    code: `# Firecracker MicroVM Python 3.11 Sandbox
import hashlib
import os

vm_id = os.environ.get('FC_VM_ID', 'fc-vm-local')
digest = hashlib.sha256(b'aurora-ephemeral-microvm').hexdigest()
squares = [i * i for i in range(25)]

print(f'MICROVM_ID: {vm_id}')
print(f'SHA256_DIGEST: {digest[:32]}')
print('SUM_OF_SQUARES:', sum(squares))`,
  },
  {
    id: "loop",
    label: "02 // TELEMETRY LOOP & STDERR",
    timeout: 5.0,
    memoryMb: 128,
    code: `import sys

print('--- STARTING EPHEMERAL WORKLOAD ---')
for step in range(4):
    val = (step + 1) * 128
    print(f'STEP_{step}: allocated_blocks={val}')

sys.stderr.write('DIAGNOSTIC: RLIMIT_AS memory guard active\\n')
print('--- WORKLOAD COMPLETED ---')`,
  },
  {
    id: "timeout",
    label: "03 // TIMEOUT & QUOTA CAP TEST",
    timeout: 2.0,
    memoryMb: 128,
    code: `# Tests strict timeout enforcement:
# effective_timeout = min(requested_timeout, remaining_monthly_quota)
import time

print('Sleeping 5.0s inside microVM...')
time.sleep(5.0)
print('Unreachable if timeout < 5.0s')`,
  },
  {
    id: "memory",
    label: "04 // MEMORY LIMIT EXCEEDED (32MB > 16MB)",
    timeout: 5.0,
    memoryMb: 16,
    code: `# Allocates 32MB while memory_limit_mb is set to 16MB
# Triggers RLIMIT_AS / tracemalloc MemoryError (exit_code=137)
data = bytearray(32 * 1024 * 1024)
print(len(data))`,
  },
];

export default function DashboardPage() {
  const {
    user,
    quota,
    executions,
    selectedExecution,
    isLoading,
    loginDemoOperator,
    dispatchCodeExecution,
    fetchExecutionById,
    instantDummyBuySubscription,
    simulateQuotaSeconds,
    cacheStats,
    localstackUrl,
    setLocalstackUrl,
    refreshAll,
  } = useAuth();

  const [code, setCode] = useState<string>(CODE_PRESETS[0].code);
  const [timeoutSec, setTimeoutSec] = useState<number>(5.0);
  const [memoryMb, setMemoryMb] = useState<number>(128);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [vmPhase, setVmPhase] = useState<string>("IDLE");
  const [dispatchError, setDispatchError] = useState<{
    status: number;
    error: string;
    message?: string;
  } | null>(null);
  const [activeCostTab, setActiveCostTab] = useState<
    "daily" | "weekly" | "monthly" | "projected"
  >("monthly");
  const [endpointInput, setEndpointInput] = useState<string>(localstackUrl);

  useEffect(() => {
    setEndpointInput(localstackUrl);
  }, [localstackUrl]);

  // Auto-authenticate with Demo Operator if visiting dashboard anonymously
  useEffect(() => {
    if (!isLoading && !user) {
      loginDemoOperator();
    }
  }, [isLoading, user, loginDemoOperator]);

  const metrics = useMemo(
    () =>
      calculateCostAndMetrics(
        executions,
        quota,
        cacheStats.cacheHits,
        cacheStats.cacheHits + cacheStats.dynamodbReads
      ),
    [executions, quota, cacheStats]
  );

  const effectiveTimeoutPreview = useMemo(() => {
    if (!quota || quota.tier === "PRO" || quota.unlimited) {
      return timeoutSec;
    }
    const rem = quota.remaining_seconds ?? 14400;
    return Number(Math.max(0, Math.min(timeoutSec, rem)).toFixed(4));
  }, [quota, timeoutSec]);

  const codeLineCount = useMemo(() => Math.max(12, code.split(/\r?\n/).length), [code]);

  const handleSelectPreset = (preset: (typeof CODE_PRESETS)[number]) => {
    setCode(preset.code);
    setTimeoutSec(preset.timeout);
    setMemoryMb(preset.memoryMb);
    setDispatchError(null);
  };

  const handleDispatch = async () => {
    setDispatchError(null);
    setIsDispatching(true);
    setVmPhase("CREATING -> BOOTING MICROVM");
    const phaseTimer = setTimeout(() => setVmPhase("RUNNING ISOLATED PYTHON 3.11"), 120);

    try {
      const res = await dispatchCodeExecution({
        code,
        timeout: timeoutSec,
        memory_limit_mb: memoryMb,
      });
      clearTimeout(phaseTimer);
      if (!res.ok) {
        setVmPhase(`REJECTED [HTTP ${res.status}]`);
        setDispatchError({
          status: res.status,
          error: res.error || "Execution failed",
          message: res.message,
        });
      } else {
        setVmPhase("TEARING_DOWN -> DESTROYED");
      }
    } finally {
      setIsDispatching(false);
    }
  };

  const selectedHorizon = metrics[activeCostTab];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* TOP CONTROL PLANE HEADER */}
      <div className="border-2 border-black bg-white p-5 shadow-brutal flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="inverse">FIRECRACKER MICROVM CONTROL PLANE</Badge>
            <Badge variant="outline">
              ACCOUNT: {user ? `ACCOUNT#${user.account_id}` : "PROVISIONING..."}
            </Badge>
            <Badge variant={user?.tier === "PRO" ? "ok" : "default"}>
              TIER: {user?.tier || "FREE"}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold uppercase tracking-widest mt-2">
            EPHEMERAL SANDBOX DISPATCHER, QUOTA &amp; COST TELEMETRY
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={user?.tier === "PRO" ? "outline" : "default"}
            onClick={() =>
              instantDummyBuySubscription(user?.tier === "PRO" ? "FREE" : "PRO")
            }
          >
            <Zap className="w-4 h-4 mr-1.5" />
            {user?.tier === "PRO"
              ? "DOWNGRADE TO FREE (14,400S CAP)"
              : "DUMMY BUY PRO [0.00 USD / UNLIMITED QUOTA]"}
          </Button>
          <Button variant="secondary" onClick={() => refreshAll()}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            SYNC TELEMETRY
          </Button>
        </div>
      </div>

      {/* SECTION 1: COSTS & METRICS (DAILY, WEEKLY, MONTHLY, PROJECTED) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
          <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            01 // COST &amp; COMPUTE TELEMETRY — DAILY / WEEKLY / MONTHLY / PROJECTED
          </h2>
          <div className="flex items-center gap-2">
            {(["daily", "weekly", "monthly", "projected"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveCostTab(tab)}
                className={`px-3 py-1 text-xs font-bold uppercase border-2 border-black ${
                  activeCostTab === tab
                    ? "bg-black text-white"
                    : "bg-white text-black hover:bg-[#E5E5E0]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* 4 HORIZON CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {(["daily", "weekly", "monthly", "projected"] as const).map((key) => {
            const item = metrics[key];
            const isSelected = activeCostTab === key;
            return (
              <div
                key={key}
                onClick={() => setActiveCostTab(key)}
                className={`cursor-pointer border-2 border-black p-4 shadow-brutal transition-transform ${
                  isSelected ? "bg-black text-white" : "bg-white text-black hover:bg-[#F4F4F0]"
                }`}
              >
                <div className="flex items-center justify-between border-b border-current pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {item.label}
                  </span>
                  <span className="text-[10px] font-bold uppercase border border-current px-1.5 py-0.5">
                    {item.invocations} VM RUNS
                  </span>
                </div>

                <div className="mt-3">
                  <div className="text-[10px] uppercase opacity-75">ESTIMATED COMPUTE COST</div>
                  <div className="text-2xl font-bold mt-0.5">
                    ${item.totalCostUsd.toFixed(4)} USD
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-current grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <div className="opacity-70">DURATION:</div>
                    <div className="font-bold">{item.seconds.toFixed(2)} SEC</div>
                  </div>
                  <div>
                    <div className="opacity-70">GB-SECONDS:</div>
                    <div className="font-bold">{item.gbSeconds.toFixed(3)} GB-S</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* DETAILED HORIZON BREAKDOWN + BAR CHART + QUOTA STATUS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cost Breakdown & Bar Chart */}
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                HORIZON COST BREAKDOWN // {selectedHorizon.label}
              </CardTitle>
              <Badge variant="inverse">UNIT: $0.00001667 / GB-S</Badge>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="border-2 border-black bg-[#F4F4F0] p-2.5">
                  <div className="text-[10px] text-neutral-600">MICROVM BOOT AVG</div>
                  <div className="text-base font-bold mt-0.5">{metrics.avgBootTimeMs} MS</div>
                </div>
                <div className="border-2 border-black bg-[#F4F4F0] p-2.5">
                  <div className="text-[10px] text-neutral-600">TEARDOWN AVG</div>
                  <div className="text-base font-bold mt-0.5">{metrics.avgTeardownMs} MS</div>
                </div>
                <div className="border-2 border-black bg-[#F4F4F0] p-2.5">
                  <div className="text-[10px] text-neutral-600">REDIS CACHE HIT</div>
                  <div className="text-base font-bold mt-0.5">{metrics.cacheHitRatioPct}%</div>
                </div>
                <div className="border-2 border-black bg-[#F4F4F0] p-2.5">
                  <div className="text-[10px] text-neutral-600">LAST _FUENTE</div>
                  <div className="text-base font-bold uppercase mt-0.5">
                    {cacheStats.lastFuente}
                  </div>
                </div>
              </div>

              {/* Solid Brutalist Bar Comparison */}
              <div className="border-2 border-black p-3 space-y-2.5 bg-white">
                <div className="font-bold uppercase text-[11px]">
                  COMPUTE DURATION HORIZON COMPARISON (SECONDS)
                </div>
                {(["daily", "weekly", "monthly", "projected"] as const).map((k) => {
                  const m = metrics[k];
                  const maxSec = Math.max(10, metrics.projected.seconds, metrics.monthly.seconds);
                  const widthPct = Math.min(100, Math.max(4, (m.seconds / maxSec) * 100));
                  return (
                    <div key={k} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-bold">{m.label}</span>
                        <span>
                          {m.seconds.toFixed(2)}s | {m.gbSeconds.toFixed(2)} GB-s | $
                          {m.totalCostUsd.toFixed(4)}
                        </span>
                      </div>
                      <div className="h-3 w-full border border-black bg-[#F4F4F0]">
                        <div
                          className="h-full bg-black"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Quota Enforcement & Simulator Card */}
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                MONTHLY QUOTA ENFORCEMENT (DDB)
              </CardTitle>
              <Badge variant={quota?.quota_exceeded ? "alert" : "inverse"}>
                {quota?.unlimited
                  ? "PRO // UNLIMITED"
                  : quota?.quota_exceeded
                  ? "HTTP 429 BLOCKED"
                  : "FREE // 14,400S CAP"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="border-2 border-black bg-[#F4F4F0] p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-neutral-600">PARTITION KEY (PK):</span>
                  <span className="font-bold">
                    {quota?.PK || `QUOTA#${user?.account_id}#2026-11`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">ACCUMULATED SECONDS:</span>
                  <span className="font-bold">
                    {quota ? `${quota.accumulated_seconds.toFixed(3)} SEC` : "0.000 SEC"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">MONTHLY LIMIT:</span>
                  <span className="font-bold">
                    {quota?.unlimited ? "UNLIMITED (PRO)" : "14,400 SEC (4 HOURS)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">REMAINING QUOTA:</span>
                  <span className="font-bold">
                    {quota?.unlimited
                      ? "INFINITE"
                      : `${(quota?.remaining_seconds ?? 14400).toFixed(3)} SEC`}
                  </span>
                </div>
              </div>

              {!quota?.unlimited && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span>QUOTA CONSUMPTION</span>
                    <span>
                      {(
                        ((quota?.accumulated_seconds || 0) / 14400) *
                        100
                      ).toFixed(2)}
                      %
                    </span>
                  </div>
                  <Progress value={quota?.accumulated_seconds || 0} max={14400} />
                </div>
              )}

              {/* Quota Simulator Controls for instant verification */}
              <div className="border-t-2 border-black pt-3 space-y-2">
                <div className="font-bold uppercase text-[11px]">
                  QUOTA STATE SIMULATOR (TEST 429 &amp; STRICT TIMEOUT CAP):
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => simulateQuotaSeconds(0)}
                  >
                    RESET (0S)
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => simulateQuotaSeconds(14399.5)}
                    title="Sets remaining quota to 0.5s to verify strict timeout capping"
                  >
                    14,399.5S (0.5S LEFT)
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => simulateQuotaSeconds(14400)}
                    title="Exhausts 14,400s FREE quota so next POST /execute returns HTTP 429"
                  >
                    14,400S (HTTP 429)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SECTION 2: MANUAL PYTHON 3.11 CODE EDITOR & EPHEMERAL MICROVM DISPATCHER */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
          <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            02 // MANUAL PYTHON 3.11 CODE EDITOR &amp; EPHEMERAL MICROVM DISPATCHER (POST /EXECUTE)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {CODE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="border-2 border-black bg-white px-2.5 py-1 text-[11px] font-bold uppercase hover:bg-black hover:text-white"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: CODE EDITOR */}
          <Card className="lg:col-span-7">
            <CardHeader className="bg-black text-white">
              <div className="flex items-center gap-3">
                <CardTitle className="text-white">
                  /TMP/FC-MICROVM/SNIPPET.PY [PYTHON 3.11]
                </CardTitle>
              </div>
              <Badge variant="outline">ISOLATED ROOTFS</Badge>
            </CardHeader>

            <CardContent className="p-0">
              {/* Brutalist Line-Numbered Code Editor */}
              <div className="flex border-b-2 border-black bg-[#111111] text-white font-mono text-xs">
                <div
                  aria-hidden="true"
                  className="select-none border-r-2 border-black bg-black text-neutral-500 px-3 py-4 text-right leading-6"
                >
                  {Array.from({ length: codeLineCount }).map((_, i) => (
                    <div key={i}>{String(i + 1).padStart(2, "0")}</div>
                  ))}
                </div>
                <textarea
                  aria-label="Python 3.11 code editor"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={12}
                  spellCheck={false}
                  className="w-full bg-[#111111] text-white p-4 font-mono text-xs leading-6 focus:outline-none resize-y"
                />
              </div>

              {/* Execution Parameters & Dispatch Trigger */}
              <div className="p-4 bg-[#F4F4F0] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="timeout-input">REQUESTED TIMEOUT (SEC)</Label>
                    <Input
                      id="timeout-input"
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="120"
                      value={timeoutSec}
                      onChange={(e) => setTimeoutSec(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="mem-select">MEMORY CEILING (RLIMIT_AS)</Label>
                    <select
                      id="mem-select"
                      value={memoryMb}
                      onChange={(e) => setMemoryMb(Number(e.target.value))}
                      className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm font-bold"
                    >
                      <option value={16}>16 MB (STRICT TEST)</option>
                      <option value={64}>64 MB</option>
                      <option value={128}>128 MB (DEFAULT)</option>
                      <option value={256}>256 MB</option>
                      <option value={512}>512 MB (MAX)</option>
                    </select>
                  </div>

                  <div>
                    <Label>ENFORCED TIMEOUT CAP</Label>
                    <div className="border-2 border-black bg-white px-3 py-2 text-sm font-bold flex items-center justify-between">
                      <span>{effectiveTimeoutPreview} SEC</span>
                      <Badge variant="inverse">
                        {quota?.tier === "PRO" ? "PRO" : "CAPPED"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="text-xs font-bold uppercase">
                    MICROVM STATE: <span className="underline">{vmPhase}</span>
                  </div>

                  <Button
                    size="lg"
                    variant="default"
                    onClick={handleDispatch}
                    disabled={isDispatching}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {isDispatching
                      ? "DISPATCHING TO FIRECRACKER..."
                      : "DISPATCH MICROVM (POST /EXECUTE)"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* RIGHT: LIVE EXECUTION OUTPUT & FIRECRACKER TELEMETRY */}
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                MICROVM STDOUT / STDERR &amp; TELEMETRY
              </CardTitle>
              {selectedExecution && (
                <Badge
                  variant={
                    selectedExecution.status === "COMPLETED"
                      ? "ok"
                      : selectedExecution.status === "TIMEOUT" ||
                        selectedExecution.status === "MEMORY_LIMIT_EXCEEDED"
                      ? "alert"
                      : "inverse"
                  }
                >
                  {selectedExecution.status}
                </Badge>
              )}
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              {/* HTTP 429 Quota Rejected Banner */}
              {dispatchError && (
                <div className="border-2 border-black bg-[#D92626] text-white p-4 space-y-3">
                  <div className="flex items-center justify-between font-bold uppercase">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" />
                      HTTP {dispatchError.status} // {dispatchError.error}
                    </span>
                  </div>
                  {dispatchError.message && (
                    <p className="text-[11px] leading-relaxed">{dispatchError.message}</p>
                  )}
                  {dispatchError.status === 429 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDispatchError(null);
                        instantDummyBuySubscription("PRO");
                      }}
                      className="w-full"
                    >
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                      DUMMY BUY PRO TIER NOW [UNLOCK UNLIMITED QUOTA / 0.00 USD]
                    </Button>
                  )}
                </div>
              )}

              {selectedExecution ? (
                <>
                  {/* Telemetry Metadata Grid */}
                  <div className="border-2 border-black bg-[#F4F4F0] p-3 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">SINGLE-TABLE PK:</span>
                      <span className="font-bold">{selectedExecution.PK}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">MICROVM ID:</span>
                      <span className="font-bold">
                        {selectedExecution.telemetry?.vm_id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">BOOT / EXEC / TEARDOWN:</span>
                      <span className="font-bold">
                        {selectedExecution.telemetry?.boot_time_ms}ms /{" "}
                        {selectedExecution.duration}s /{" "}
                        {selectedExecution.telemetry?.teardown_time_ms}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">TIMEOUT ENFORCED / MEM:</span>
                      <span className="font-bold">
                        {selectedExecution.timeout_enforced}s /{" "}
                        {selectedExecution.memory_limit_mb}MB
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-600">DATA SOURCE (_FUENTE):</span>
                      <Badge
                        variant={
                          selectedExecution._fuente === "cache" ? "ok" : "inverse"
                        }
                      >
                        _fuente: {selectedExecution._fuente || "dynamodb"}
                      </Badge>
                    </div>
                  </div>

                  {/* Lifecycle State Transitions */}
                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      selectedExecution.telemetry?.state_transitions || [
                        "CREATING",
                        "BOOTING",
                        "RUNNING",
                        "TEARING_DOWN",
                        "DESTROYED",
                      ]
                    ).map((st, idx) => (
                      <span
                        key={st}
                        className="border border-black bg-white px-2 py-0.5 text-[10px] font-bold"
                      >
                        {idx + 1}.{st}
                      </span>
                    ))}
                  </div>

                  {/* Captured STDOUT */}
                  <div>
                    <div className="font-bold uppercase mb-1 flex justify-between">
                      <span>CAPTURED STDOUT</span>
                      <span>EXIT CODE: {selectedExecution.exit_code}</span>
                    </div>
                    <pre className="border-2 border-black bg-black text-white p-3 text-[11px] overflow-x-auto min-h-[84px] whitespace-pre-wrap">
                      {selectedExecution.stdout || "(empty stdout)"}
                    </pre>
                  </div>

                  {/* Captured STDERR */}
                  {selectedExecution.stderr && (
                    <div>
                      <div className="font-bold uppercase mb-1 text-[#D92626] flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        CAPTURED STDERR
                      </div>
                      <pre className="border-2 border-black bg-[#D92626] text-white p-3 text-[11px] overflow-x-auto whitespace-pre-wrap">
                        {selectedExecution.stderr}
                      </pre>
                    </div>
                  )}

                  {/* Cache-Aside Verification Button */}
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-neutral-600">
                      Test Redis Cache-Aside on <code>GET /executions/{selectedExecution.execution_id}</code>:
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fetchExecutionById(selectedExecution.execution_id)}
                    >
                      <HardDrive className="w-3.5 h-3.5 mr-1.5" />
                      QUERY CACHE-ASIDE
                    </Button>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-neutral-600 border-2 border-dashed border-black">
                  Dispatch a Python snippet to inspect microVM output and telemetry.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SECTION 3: EXECUTION LEDGER & REDIS CACHE-ASIDE INSPECTOR */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
          <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Database className="w-4 h-4" />
            03 // DYNAMODB SINGLE-TABLE EXECUTION LEDGER (EXEC#&lt;ID&gt;) &amp; REDIS CACHE-ASIDE
          </h2>
          <span className="text-xs text-neutral-700">
            Click <strong>GET /EXECUTIONS/&#123;ID&#125;</strong> once for DynamoDB miss (
            <code>_fuente: &quot;dynamodb&quot;</code>) and a second time for Redis hit (
            <code>_fuente: &quot;cache&quot;</code>).
          </span>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b-2 border-black bg-[#F4F4F0] uppercase text-[11px]">
                  <th className="p-3 border-r-2 border-black">PK (EXEC#&lt;ID&gt;)</th>
                  <th className="p-3 border-r-2 border-black">MICROVM ID</th>
                  <th className="p-3 border-r-2 border-black">STATUS</th>
                  <th className="p-3 border-r-2 border-black">DURATION / BOOT</th>
                  <th className="p-3 border-r-2 border-black">MEM</th>
                  <th className="p-3 border-r-2 border-black">_FUENTE</th>
                  <th className="p-3">ACTION (CACHE-ASIDE)</th>
                </tr>
              </thead>
              <tbody>
                {executions.map((ex) => {
                  const isCurrent =
                    selectedExecution?.execution_id === ex.execution_id;
                  return (
                    <tr
                      key={ex.execution_id}
                      className={`border-b border-black ${
                        isCurrent ? "bg-[#E5E5E0]" : "bg-white hover:bg-[#F4F4F0]"
                      }`}
                    >
                      <td className="p-3 border-r-2 border-black font-bold">
                        EXEC#{ex.execution_id}
                      </td>
                      <td className="p-3 border-r-2 border-black">
                        {ex.telemetry?.vm_id || "fc-vm"}
                      </td>
                      <td className="p-3 border-r-2 border-black">
                        <Badge
                          variant={
                            ex.status === "COMPLETED"
                              ? "ok"
                              : ex.status === "TIMEOUT" ||
                                ex.status === "MEMORY_LIMIT_EXCEEDED"
                              ? "alert"
                              : "inverse"
                          }
                        >
                          {ex.status}
                        </Badge>
                      </td>
                      <td className="p-3 border-r-2 border-black">
                        {Number(ex.duration).toFixed(3)}s /{" "}
                        {ex.telemetry?.boot_time_ms}ms
                      </td>
                      <td className="p-3 border-r-2 border-black">
                        {ex.memory_limit_mb} MB
                      </td>
                      <td className="p-3 border-r-2 border-black">
                        <Badge
                          variant={ex._fuente === "cache" ? "ok" : "outline"}
                        >
                          {ex._fuente || "dynamodb"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fetchExecutionById(ex.execution_id)}
                        >
                          GET /EXECUTIONS/{ex.execution_id.slice(0, 9)}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* SECTION 4: OPTIONAL LOCALSTACK API GATEWAY ENDPOINT CONNECTOR */}
      <section className="border-2 border-black bg-white p-4 shadow-brutal-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
        <div>
          <div className="font-bold uppercase">
            LOCALSTACK / MINISTACK API GATEWAY BRIDGE (OPTIONAL)
          </div>
          <div className="text-neutral-600 mt-0.5">
            Leave empty to use the built-in real-time Single-Table &amp; Redis engine, or paste your{" "}
            <code>cdklocal deploy</code> ApiUrl (e.g.{" "}
            <code>http://localhost:4566/restapis/&lt;api-id&gt;/prod/_user_request_</code>).
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Input
            value={endpointInput}
            onChange={(e) => setEndpointInput(e.target.value)}
            placeholder="http://localhost:4566/restapis/<id>/prod/_user_request_"
            className="md:w-96 text-xs"
          />
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              setLocalstackUrl(endpointInput);
              refreshAll();
            }}
          >
            APPLY
          </Button>
        </div>
      </section>
    </div>
  );
}
