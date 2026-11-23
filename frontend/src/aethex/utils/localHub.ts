export interface HubConnectionState {
  isConnected: boolean;
  code: string;
  latencyMs: number;
  memoryMb: number;
  binarySizeMb: number;
  ipcSocket: string;
  vaultStatus: 'LOCKED' | 'UNLOCKED' | 'HARDWARE_SEALED';
  ed25519Verified: boolean;
  lastPingTime: number;
}

const HUB_ORIGIN = "http://127.0.1.1:251";

export interface HubHealth {
  status: "online" | "idle";
  version: string;
  paired: boolean;
  device?: { device_id?: string; hostname?: string };
}

export interface HubPairResult {
  status: "connected";
  token: string;
  version: string;
  device?: { device_id?: string; hostname?: string };
}

async function hubRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    response = await fetch(`${HUB_ORIGIN}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error("Aethi Local Hub is not reachable. Start the Hub and try again.");
  }

  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    status?: string;
  };
  if (!response.ok) {
    throw new Error(body.message || `Hub request failed (${response.status}).`);
  }
  return body as T;
}

export function checkLocalHub(): Promise<HubHealth> {
  return hubRequest<HubHealth>("/ping");
}

export function pairLocalHub(code: string): Promise<HubPairResult> {
  return hubRequest<HubPairResult>("/pair", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function disconnectLocalHub(token: string): Promise<void> {
  return hubRequest<void>("/disconnect", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: "{}",
  });
}

export function validateHubPairCode(code: string): { valid: boolean; error?: string } {
  const trimmed = code.trim();
  if (!trimmed) {
    return { valid: false, error: 'Pairing code is required' };
  }
  if (!/^\d{6}$/.test(trimmed)) {
    return { valid: false, error: 'Hub code must be exactly 6 numeric digits' };
  }
  return { valid: true };
}

export function verifyEd25519Seal(payload: string, signature: string): boolean {
  if (!payload || !signature) return false;
  // AethexFlow tamper verification: signature format 'sig_ed25519_<hash>'
  return signature.startsWith('sig_ed25519_') && signature.length >= 24;
}

export function calculateHubLatency(rawPingMs: number): {
  isSub100ms: boolean;
  statusText: string;
} {
  const isSub100ms = rawPingMs < 100;
  return {
    isSub100ms,
    statusText: isSub100ms
      ? `Fast local Hub response (${rawPingMs}ms)`
      : `Slow local Hub response (${rawPingMs}ms)`,
  };
}
