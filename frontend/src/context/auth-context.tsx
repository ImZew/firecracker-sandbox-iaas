"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ExecutionRecord, QuotaStatus } from "@/lib/utils";

export interface AuthUser {
  account_id: string;
  email: string;
  username?: string;
  tier: "FREE" | "PRO";
  token: string;
  _fuente?: "cache" | "dynamodb";
}

export interface DispatchResult {
  ok: boolean;
  status: number;
  execution?: ExecutionRecord;
  error?: string;
  message?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  quota: QuotaStatus | null;
  executions: ExecutionRecord[];
  selectedExecution: ExecutionRecord | null;
  healthStatus: {
    status: string;
    control_plane: string;
    runtime: string;
    table_name: string;
    redis_host: string;
    timestamp: string;
  } | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refreshIntervalMs: number;
  setRefreshIntervalMs: (ms: number) => void;
  lastRefreshedAt: string | null;
  localstackUrl: string;
  setLocalstackUrl: (url: string) => void;
  cacheStats: {
    cacheHits: number;
    dynamodbReads: number;
    lastFuente: "cache" | "dynamodb";
    lastTtl: number;
  };
  subscriptionNotice: string | null;
  clearSubscriptionNotice: () => void;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (params: {
    email: string;
    password: string;
    tier: "FREE" | "PRO";
    username?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  loginDemoOperator: () => Promise<boolean>;
  signOut: () => void;
  refreshAll: () => Promise<void>;
  refreshJwtToken: () => Promise<void>;
  instantDummyBuySubscription: (tier?: "PRO" | "FREE") => Promise<boolean>;
  dispatchCodeExecution: (params: {
    code: string;
    timeout: number;
    memory_limit_mb: number;
  }) => Promise<DispatchResult>;
  fetchExecutionById: (executionId: string) => Promise<ExecutionRecord | null>;
  simulateQuotaSeconds: (seconds: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "aurora_microvm_auth_v1";
const LOCALSTACK_URL_KEY = "aurora_localstack_url_v1";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null);
  const [healthStatus, setHealthStatus] = useState<AuthContextValue["healthStatus"]>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number>(5000);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [localstackUrl, setLocalstackUrlState] = useState<string>("");
  const [subscriptionNotice, setSubscriptionNotice] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState({
    cacheHits: 0,
    dynamodbReads: 0,
    lastFuente: "dynamodb" as "cache" | "dynamodb",
    lastTtl: 300,
  });

  const userRef = useRef<AuthUser | null>(null);
  userRef.current = user;

  const localstackRef = useRef<string>("");
  localstackRef.current = localstackUrl;

  const recordCacheRead = useCallback((fuente?: "cache" | "dynamodb", ttl?: number) => {
    if (!fuente) return;
    setCacheStats((prev) => ({
      cacheHits: fuente === "cache" ? prev.cacheHits + 1 : prev.cacheHits,
      dynamodbReads: fuente === "dynamodb" ? prev.dynamodbReads + 1 : prev.dynamodbReads,
      lastFuente: fuente,
      lastTtl: ttl ?? prev.lastTtl,
    }));
  }, []);

  const buildHeaders = useCallback((token?: string) => {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const activeToken = token || userRef.current?.token;
    if (activeToken) {
      h["Authorization"] = `Bearer ${activeToken}`;
    }
    if (localstackRef.current.trim()) {
      h["x-localstack-url"] = localstackRef.current.trim();
    }
    return h;
  }, []);

  const persistUser = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
    userRef.current = nextUser;
    if (typeof window !== "undefined") {
      if (nextUser) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const setLocalstackUrl = useCallback((url: string) => {
    setLocalstackUrlState(url);
    localstackRef.current = url;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALSTACK_URL_KEY, url);
    }
  }, []);

  const refreshAll = useCallback(async (overrideToken?: string) => {
    setIsRefreshing(true);
    try {
      const healthResp = await fetch("/api/v1/health", {
        headers: buildHeaders(overrideToken),
        cache: "no-store",
      });
      if (healthResp.ok) {
        const hData = await healthResp.json();
        setHealthStatus(hData);
      }

      const activeToken = overrideToken || userRef.current?.token;
      if (!activeToken) {
        setLastRefreshedAt(new Date().toISOString());
        return;
      }

      const [quotaResp, execsResp] = await Promise.all([
        fetch("/api/v1/quota", {
          headers: buildHeaders(activeToken),
          cache: "no-store",
        }),
        fetch("/api/v1/executions", {
          headers: buildHeaders(activeToken),
          cache: "no-store",
        }),
      ]);

      if (quotaResp.ok) {
        const qData = await quotaResp.json();
        setQuota(qData);
        recordCacheRead(qData._fuente, qData._ttl);
        if (userRef.current && qData.tier && qData.tier !== userRef.current.tier) {
          persistUser({ ...userRef.current, tier: qData.tier });
        }
      }

      if (execsResp.ok) {
        const eData = await execsResp.json();
        if (Array.isArray(eData.executions)) {
          setExecutions(eData.executions);
          setSelectedExecution((prev) => prev || eData.executions[0] || null);
        }
      }

      setLastRefreshedAt(new Date().toISOString());
    } catch {
      // Keep existing state on transient errors
    } finally {
      setIsRefreshing(false);
    }
  }, [buildHeaders, persistUser, recordCacheRead]);

  const refreshJwtToken = useCallback(async () => {
    if (!userRef.current?.token) return;
    setIsRefreshing(true);
    try {
      const resp = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: buildHeaders(userRef.current.token),
      });
      if (resp.ok) {
        const data = await resp.json();
        recordCacheRead(data._fuente);
        const updatedUser: AuthUser = {
          account_id: data.account_id,
          email: data.email,
          username: userRef.current.username,
          tier: data.tier,
          token: data.token,
          _fuente: data._fuente,
        };
        persistUser(updatedUser);
        await refreshAll(data.token);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [buildHeaders, persistUser, recordCacheRead, refreshAll]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const resp = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return { ok: false, error: data.error || "Authentication failed" };
      }
      const loggedUser: AuthUser = {
        account_id: data.account_id,
        email: data.email,
        username: data.username || email.split("@")[0],
        tier: data.tier,
        token: data.token,
        _fuente: data._fuente,
      };
      persistUser(loggedUser);
      recordCacheRead(data._fuente);
      await refreshAll(data.token);
      return { ok: true };
    },
    [buildHeaders, persistUser, recordCacheRead, refreshAll]
  );

  const signUp = useCallback(
    async (params: {
      email: string;
      password: string;
      tier: "FREE" | "PRO";
      username?: string;
    }) => {
      const resp = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(params),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return { ok: false, error: data.error || "Registration failed" };
      }
      const newUser: AuthUser = {
        account_id: data.account_id,
        email: data.email,
        username: data.username || params.email.split("@")[0],
        tier: data.tier,
        token: data.token,
        _fuente: data._fuente,
      };
      persistUser(newUser);
      recordCacheRead(data._fuente);
      await refreshAll(data.token);
      return { ok: true };
    },
    [buildHeaders, persistUser, recordCacheRead, refreshAll]
  );

  const loginDemoOperator = useCallback(async () => {
    const res = await signIn("operator@aurora.microvm", "aurora2026");
    return res.ok;
  }, [signIn]);

  const signOut = useCallback(() => {
    persistUser(null);
    setQuota(null);
    setExecutions([]);
    setSelectedExecution(null);
  }, [persistUser]);

  const instantDummyBuySubscription = useCallback(
    async (targetTier: "PRO" | "FREE" = "PRO") => {
      // If user is not signed in yet, auto-sign in as demo operator first so 1-click buy works anywhere without paywall!
      let currentToken = userRef.current?.token;
      if (!currentToken) {
        const loginResp = await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify({
            email: "operator@aurora.microvm",
            password: "aurora2026",
          }),
        });
        if (loginResp.ok) {
          const loginData = await loginResp.json();
          currentToken = loginData.token;
          persistUser({
            account_id: loginData.account_id,
            email: loginData.email,
            username: "operator",
            tier: loginData.tier,
            token: loginData.token,
          });
        }
      }

      if (!currentToken) return false;

      const resp = await fetch("/api/v1/subscription/upgrade", {
        method: "POST",
        headers: buildHeaders(currentToken),
        body: JSON.stringify({ tier: targetTier }),
      });

      if (!resp.ok) return false;
      const data = await resp.json();
      const upgradedUser: AuthUser = {
        account_id: data.account_id,
        email: data.email,
        username: userRef.current?.username || "operator",
        tier: data.tier,
        token: data.token,
        _fuente: data._fuente,
      };
      persistUser(upgradedUser);
      if (data.quota) {
        setQuota(data.quota);
      }
      setSubscriptionNotice(
        `DUMMY PURCHASE CONFIRMED [0.00 USD]: ACCOUNT ${data.account_id} SET TO ${data.tier} TIER (${
          data.tier === "PRO" ? "UNLIMITED MONTHLY QUOTA" : "14,400S MONTHLY CAP"
        }).`
      );
      await refreshAll(data.token);
      return true;
    },
    [buildHeaders, persistUser, refreshAll]
  );

  const dispatchCodeExecution = useCallback(
    async (params: {
      code: string;
      timeout: number;
      memory_limit_mb: number;
    }): Promise<DispatchResult> => {
      if (!userRef.current?.token) {
        return { ok: false, status: 401, error: "Not authenticated" };
      }
      const resp = await fetch("/api/v1/execute", {
        method: "POST",
        headers: buildHeaders(userRef.current.token),
        body: JSON.stringify({
          code: params.code,
          runtime: "python3.11",
          timeout: params.timeout,
          memory_limit_mb: params.memory_limit_mb,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (data.quota) setQuota(data.quota);
        return {
          ok: false,
          status: resp.status,
          error: data.error || "Execution failed",
          message: data.message,
        };
      }

      recordCacheRead(data.account_fuente || "cache");
      recordCacheRead(data._fuente || "dynamodb");
      if (data.quota) {
        setQuota(data.quota);
      }
      setSelectedExecution(data);
      await refreshAll(userRef.current.token);
      return {
        ok: true,
        status: resp.status,
        execution: data,
      };
    },
    [buildHeaders, recordCacheRead, refreshAll]
  );

  const fetchExecutionById = useCallback(
    async (executionId: string): Promise<ExecutionRecord | null> => {
      const resp = await fetch(`/api/v1/executions/${executionId}`, {
        headers: buildHeaders(),
        cache: "no-store",
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      recordCacheRead(data._fuente, data._ttl);
      setSelectedExecution(data);
      setExecutions((prev) =>
        prev.map((item) =>
          item.execution_id === executionId ? { ...item, _fuente: data._fuente } : item
        )
      );
      return data;
    },
    [buildHeaders, recordCacheRead]
  );

  const simulateQuotaSeconds = useCallback(
    async (seconds: number) => {
      if (!userRef.current?.token) return;
      const resp = await fetch("/api/v1/quota/simulate", {
        method: "POST",
        headers: buildHeaders(userRef.current.token),
        body: JSON.stringify({ accumulated_seconds: seconds }),
      });
      if (resp.ok) {
        const q = await resp.json();
        setQuota(q);
        setLastRefreshedAt(new Date().toISOString());
      }
    },
    [buildHeaders]
  );

  // Restore persisted user on initial mount or auto-initialize demo session
  useEffect(() => {
    const init = async () => {
      if (typeof window !== "undefined") {
        const savedUrl = window.localStorage.getItem(LOCALSTACK_URL_KEY);
        if (savedUrl) {
          setLocalstackUrlState(savedUrl);
          localstackRef.current = savedUrl;
        }
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as AuthUser;
            setUser(parsed);
            userRef.current = parsed;
            await refreshAll(parsed.token);
            setIsLoading(false);
            return;
          } catch {
            window.localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
      await refreshAll();
      setIsLoading(false);
    };
    init();
  }, [refreshAll]);

  // Real-time polling ticker
  useEffect(() => {
    if (!refreshIntervalMs || refreshIntervalMs <= 0) return;
    const id = setInterval(() => {
      refreshAll();
    }, refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs, refreshAll]);

  return (
    <AuthContext.Provider
      value={{
        user,
        quota,
        executions,
        selectedExecution,
        healthStatus,
        isLoading,
        isRefreshing,
        refreshIntervalMs,
        setRefreshIntervalMs,
        lastRefreshedAt,
        localstackUrl,
        setLocalstackUrl,
        cacheStats,
        subscriptionNotice,
        clearSubscriptionNotice: () => setSubscriptionNotice(null),
        signIn,
        signUp,
        loginDemoOperator,
        signOut,
        refreshAll: () => refreshAll(),
        refreshJwtToken,
        instantDummyBuySubscription,
        dispatchCodeExecution,
        fetchExecutionById,
        simulateQuotaSeconds,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
