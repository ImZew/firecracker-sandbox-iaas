import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ExecutionTelemetry {
  vm_id: string;
  isolation_engine: string;
  host_executor: string;
  vcpu_count: number;
  memory_limit_mb: number;
  boot_time_ms: number;
  execution_time_ms: number;
  teardown_time_ms: number;
  total_lifecycle_ms: number;
  state_transitions: string[];
  teardown_status: string;
  boot_timestamp: string;
  teardown_timestamp: string;
}

export interface ExecutionRecord {
  PK: string;
  SK: string;
  execution_id: string;
  account_id: string;
  tier: "FREE" | "PRO";
  code: string;
  runtime: string;
  duration: number;
  timeout_enforced: number;
  memory_limit_mb: number;
  status: "COMPLETED" | "TIMEOUT" | "FAILED" | "MEMORY_LIMIT_EXCEEDED";
  exit_code: number;
  stdout: string;
  stderr: string;
  telemetry: ExecutionTelemetry;
  created_at: string;
  _fuente?: "cache" | "dynamodb";
  account_fuente?: "cache" | "dynamodb";
}

export interface QuotaStatus {
  PK: string;
  SK: string;
  account_id: string;
  period: string;
  tier: "FREE" | "PRO";
  accumulated_seconds: number;
  limit_seconds: number | null;
  remaining_seconds: number | null;
  unlimited: boolean;
  quota_exceeded: boolean;
  execution_count: number;
  _fuente?: "cache" | "dynamodb";
}

export interface CostHorizonMetric {
  label: string;
  seconds: number;
  gbSeconds: number;
  invocations: number;
  computeCostUsd: number;
  requestCostUsd: number;
  platformFeeUsd: number;
  totalCostUsd: number;
}

export interface CostAndUsageSummary {
  daily: CostHorizonMetric;
  weekly: CostHorizonMetric;
  monthly: CostHorizonMetric;
  projected: CostHorizonMetric;
  avgBootTimeMs: number;
  avgDurationSec: number;
  avgTeardownMs: number;
  cacheHitRatioPct: number;
}

// Firecracker / AWS Lambda microVM unit pricing constants
const PRICE_PER_GB_SECOND_USD = 0.0000166667;
const PRICE_PER_INVOCATION_USD = 0.0000002;
const PRO_BASE_SUBSCRIPTION_DUMMY_USD = 29.0;

export function calculateCostAndMetrics(
  executions: ExecutionRecord[],
  quota: QuotaStatus | null,
  cacheHitsCount: number,
  totalReadsCount: number
): CostAndUsageSummary {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const dailyExecs = executions.filter((e) => new Date(e.created_at) >= oneDayAgo);
  const weeklyExecs = executions.filter((e) => new Date(e.created_at) >= sevenDaysAgo);

  const sumSeconds = (list: ExecutionRecord[]) =>
    list.reduce((acc, item) => acc + Number(item.duration || 0), 0);

  const sumGbSeconds = (list: ExecutionRecord[]) =>
    list.reduce(
      (acc, item) =>
        acc + Number(item.duration || 0) * (Number(item.memory_limit_mb || 128) / 1024),
      0
    );

  const dailySec = Math.max(sumSeconds(dailyExecs), quota ? Math.min(quota.accumulated_seconds, sumSeconds(executions)) : 0);
  const weeklySec = Math.max(sumSeconds(weeklyExecs), dailySec);
  const monthlySec = quota ? Number(quota.accumulated_seconds || 0) : sumSeconds(executions);

  const dailyGbSec = Math.max(sumGbSeconds(dailyExecs), dailySec * (128 / 1024));
  const weeklyGbSec = Math.max(sumGbSeconds(weeklyExecs), weeklySec * (128 / 1024));
  const monthlyGbSec = Math.max(sumGbSeconds(executions), monthlySec * (128 / 1024));

  const dailyInv = Math.max(dailyExecs.length, executions.length > 0 ? 1 : 0);
  const weeklyInv = Math.max(weeklyExecs.length, dailyInv);
  const monthlyInv = quota ? Math.max(quota.execution_count, executions.length) : executions.length;

  const dayOfMonth = Math.max(1, now.getUTCDate());
  const daysInMonth = 30;
  const burnMultiplier = Math.max(1.25, daysInMonth / Math.max(1, Math.min(dayOfMonth, 10)));

  const projectedSec = monthlySec > 0 ? monthlySec * burnMultiplier : dailySec * 30;
  const projectedGbSec = monthlyGbSec > 0 ? monthlyGbSec * burnMultiplier : dailyGbSec * 30;
  const projectedInv = Math.round(monthlyInv > 0 ? monthlyInv * burnMultiplier : dailyInv * 30);

  const isPro = quota?.tier === "PRO";

  const buildMetric = (
    label: string,
    seconds: number,
    gbSeconds: number,
    invocations: number,
    feeMultiplier: number
  ): CostHorizonMetric => {
    const computeCostUsd = gbSeconds * PRICE_PER_GB_SECOND_USD;
    const requestCostUsd = invocations * PRICE_PER_INVOCATION_USD;
    const platformFeeUsd = isPro ? PRO_BASE_SUBSCRIPTION_DUMMY_USD * feeMultiplier : 0;
    return {
      label,
      seconds: Number(seconds.toFixed(4)),
      gbSeconds: Number(gbSeconds.toFixed(4)),
      invocations,
      computeCostUsd: Number(computeCostUsd.toFixed(6)),
      requestCostUsd: Number(requestCostUsd.toFixed(6)),
      platformFeeUsd: Number(platformFeeUsd.toFixed(2)),
      totalCostUsd: Number((computeCostUsd + requestCostUsd + platformFeeUsd).toFixed(4)),
    };
  };

  const avgBootTimeMs =
    executions.length > 0
      ? Number(
          (
            executions.reduce((acc, e) => acc + Number(e.telemetry?.boot_time_ms || 1.5), 0) /
            executions.length
          ).toFixed(2)
        )
      : 1.42;

  const avgDurationSec =
    executions.length > 0
      ? Number((sumSeconds(executions) / executions.length).toFixed(4))
      : 0;

  const avgTeardownMs =
    executions.length > 0
      ? Number(
          (
            executions.reduce((acc, e) => acc + Number(e.telemetry?.teardown_time_ms || 0.5), 0) /
            executions.length
          ).toFixed(2)
        )
      : 0.48;

  const cacheHitRatioPct =
    totalReadsCount > 0 ? Math.round((cacheHitsCount / totalReadsCount) * 100) : 0;

  return {
    daily: buildMetric("DAILY (24H)", dailySec, dailyGbSec, dailyInv, 1 / 30),
    weekly: buildMetric("WEEKLY (7D)", weeklySec, weeklyGbSec, weeklyInv, 7 / 30),
    monthly: buildMetric("MONTHLY (MTD)", monthlySec, monthlyGbSec, monthlyInv, 1),
    projected: buildMetric("PROJECTED (EOM)", projectedSec, projectedGbSec, projectedInv, 1),
    avgBootTimeMs,
    avgDurationSec,
    avgTeardownMs,
    cacheHitRatioPct,
  };
}
