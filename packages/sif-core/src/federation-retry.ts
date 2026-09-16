import { FederationProtocolError } from "./federation-envelope.js";

export type FederationDeliveryOutcome =
  | "DELIVERED"
  | "TRANSIENT_DELIVERY_FAILURE"
  | "PEER_UNAVAILABLE"
  | "AUTHENTICATION_FAILURE"
  | "AUTHORIZATION_DENIED"
  | "PROTOCOL_INCOMPATIBLE"
  | "CAPABILITY_INCOMPATIBLE"
  | "INVALID_SIGNATURE"
  | "INTEGRITY_FAILURE"
  | "REPLAY_DETECTED"
  | "RESOURCE_EXHAUSTED"
  | "UNKNOWN_OUTCOME";

export type RetryDecision = "RETRY" | "STOP" | "RECONCILE";

export interface FederationDeliveryAttempt {
  attempt: number;
  idempotencyKey: string;
  outcome: FederationDeliveryOutcome;
  at: string;
  error?: string;
}

export interface FederationRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs?: number;
  retryableOutcomes?: ReadonlySet<FederationDeliveryOutcome>;
}

export interface FederationRetryState {
  idempotencyKey: string;
  attempts: number;
  nextAttemptAt?: string;
  lastOutcome?: FederationDeliveryOutcome;
  decision: RetryDecision;
  history: FederationDeliveryAttempt[];
}

const DEFAULT_RETRYABLE = new Set<FederationDeliveryOutcome>([
  "TRANSIENT_DELIVERY_FAILURE",
  "PEER_UNAVAILABLE",
]);

function assertNonEmpty(name: string, value: string): void {
  if (value.length === 0) throw new TypeError(`${name} must not be empty`);
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
}

function assertNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a finite non-negative number`);
}

function assertIso(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new TypeError(`${name} must be a valid ISO date`);
}

export function classifyFederationRetry(outcome: FederationDeliveryOutcome): RetryDecision {
  if (outcome === "UNKNOWN_OUTCOME") return "RECONCILE";
  if (outcome === "TRANSIENT_DELIVERY_FAILURE" || outcome === "PEER_UNAVAILABLE") return "RETRY";
  return "STOP";
}

export class FederationRetryController {
  private readonly states = new Map<string, FederationRetryState>();
  private readonly retryableOutcomes: ReadonlySet<FederationDeliveryOutcome>;

  constructor(private readonly policy: FederationRetryPolicy) {
    assertPositiveInteger("maxAttempts", policy.maxAttempts);
    assertNonNegative("baseDelayMs", policy.baseDelayMs);
    assertNonNegative("maxDelayMs", policy.maxDelayMs);
    if (policy.maxDelayMs < policy.baseDelayMs) throw new TypeError("maxDelayMs must be >= baseDelayMs");
    assertNonNegative("jitterMs", policy.jitterMs ?? 0);
    this.retryableOutcomes = policy.retryableOutcomes ?? DEFAULT_RETRYABLE;
  }

  begin(idempotencyKey: string): FederationRetryState {
    assertNonEmpty("idempotencyKey", idempotencyKey);
    const existing = this.states.get(idempotencyKey);
    if (existing) return cloneState(existing);
    const state: FederationRetryState = {
      idempotencyKey,
      attempts: 0,
      decision: "RETRY",
      history: [],
    };
    this.states.set(idempotencyKey, state);
    return cloneState(state);
  }

  record(
    idempotencyKey: string,
    outcome: FederationDeliveryOutcome,
    at: string,
    error?: string,
  ): FederationRetryState {
    assertNonEmpty("idempotencyKey", idempotencyKey);
    assertIso("at", at);
    if (error !== undefined && error.length === 0) throw new TypeError("error must not be empty");

    const current = this.states.get(idempotencyKey) ?? this.begin(idempotencyKey);
    if (current.decision !== "RETRY") {
      throw new FederationProtocolError("INTEGRITY_FAILURE", `Retry state is terminal for ${idempotencyKey}: ${current.decision}`);
    }

    const attempt = current.attempts + 1;
    const retryable = this.retryableOutcomes.has(outcome);
    const classified = classifyFederationRetry(outcome);
    let decision: RetryDecision;
    let nextAttemptAt: string | undefined;

    if (outcome === "DELIVERED") {
      decision = "STOP";
    } else if (classified === "RECONCILE") {
      decision = "RECONCILE";
    } else if (!retryable) {
      decision = "STOP";
    } else if (attempt >= this.policy.maxAttempts) {
      decision = "STOP";
    } else {
      decision = "RETRY";
      const exponent = Math.max(0, attempt - 1);
      const delay = Math.min(this.policy.maxDelayMs, this.policy.baseDelayMs * (2 ** exponent));
      const jitter = this.policy.jitterMs ?? 0;
      const deterministicJitter = jitter === 0 ? 0 : this.jitterFor(idempotencyKey, attempt, jitter);
      nextAttemptAt = new Date(Date.parse(at) + delay + deterministicJitter).toISOString();
    }

    const entry: FederationDeliveryAttempt = {
      attempt,
      idempotencyKey,
      outcome,
      at,
      ...(error === undefined ? {} : { error }),
    };
    const updated: FederationRetryState = {
      ...current,
      attempts: attempt,
      lastOutcome: outcome,
      decision,
      history: [...current.history, entry],
      ...(nextAttemptAt === undefined ? {} : { nextAttemptAt }),
    };
    this.states.set(idempotencyKey, updated);
    return cloneState(updated);
  }

  canRetry(idempotencyKey: string, at: string): boolean {
    assertNonEmpty("idempotencyKey", idempotencyKey);
    assertIso("at", at);
    const state = this.states.get(idempotencyKey);
    if (!state || state.decision !== "RETRY") return false;
    return state.nextAttemptAt === undefined || Date.parse(at) >= Date.parse(state.nextAttemptAt);
  }

  get(idempotencyKey: string): FederationRetryState {
    assertNonEmpty("idempotencyKey", idempotencyKey);
    const state = this.states.get(idempotencyKey);
    if (!state) throw new FederationProtocolError("INTEGRITY_FAILURE", `Unknown retry state: ${idempotencyKey}`);
    return cloneState(state);
  }

  private jitterFor(key: string, attempt: number, maxJitter: number): number {
    const seed = [...key].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, attempt);
    return seed % (Math.floor(maxJitter) + 1);
  }
}

function cloneState(state: FederationRetryState): FederationRetryState {
  return { ...state, history: state.history.map((entry) => ({ ...entry })) };
}
