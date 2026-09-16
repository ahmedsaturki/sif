import { FederationProtocolError } from "./federation-envelope.js";

export interface FederationResourceLimits {
  maxConcurrentSessions: number;
  maxOutstandingInboxWork: number;
  maxReplayEntries: number;
  maxReconciliationBatch: number;
  maxPeerRatePerWindow: number;
  maxGlobalRatePerWindow: number;
  rateWindowMs: number;
}

export interface FederationResourceSnapshot {
  concurrentSessions: number;
  outstandingInboxWork: number;
  replayEntries: number;
  peerWindowStarts: number;
  globalWindowStarts: number;
}

export class FederationResourceGovernor {
  private concurrentSessions = 0;
  private outstandingInboxWork = 0;
  private replayEntries = 0;
  private peerWindowStartedAt = 0;
  private globalWindowStartedAt = 0;
  private readonly peerStarts = new Map<string, number>();
  private globalStarts = 0;

  constructor(private readonly limits: FederationResourceLimits) {
    for (const [name, value] of Object.entries(limits)) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new TypeError(`${name} must be a positive safe integer`);
      }
    }
  }

  openSession(peerId: string, nowMs = Date.now()): void {
    this.assertPeer(peerId);
    this.rollWindows(peerId, nowMs);
    if (this.concurrentSessions >= this.limits.maxConcurrentSessions) throw new FederationProtocolError("RESOURCE_EXHAUSTED", "Maximum concurrent federation sessions exceeded", "peer");
    if ((this.peerStarts.get(peerId) ?? 0) >= this.limits.maxPeerRatePerWindow) throw new FederationProtocolError("RESOURCE_EXHAUSTED", "Per-peer session rate limit exceeded", "peer");
    if (this.globalStarts >= this.limits.maxGlobalRatePerWindow) throw new FederationProtocolError("RESOURCE_EXHAUSTED", "Global federation session rate limit exceeded", "peer");
    this.concurrentSessions += 1;
    this.peerStarts.set(peerId, (this.peerStarts.get(peerId) ?? 0) + 1);
    this.globalStarts += 1;
  }

  closeSession(): void {
    if (this.concurrentSessions > 0) this.concurrentSessions -= 1;
  }

  beginInboxWork(): void {
    if (this.outstandingInboxWork >= this.limits.maxOutstandingInboxWork) throw new FederationProtocolError("RESOURCE_EXHAUSTED", "Maximum outstanding federation inbox work exceeded", "delivery");
    this.outstandingInboxWork += 1;
  }

  endInboxWork(): void {
    if (this.outstandingInboxWork > 0) this.outstandingInboxWork -= 1;
  }

  retainReplayEntry(): void {
    if (this.replayEntries >= this.limits.maxReplayEntries) throw new FederationProtocolError("RESOURCE_EXHAUSTED", "Maximum replay-window entries exceeded", "message");
    this.replayEntries += 1;
  }

  releaseReplayEntry(): void {
    if (this.replayEntries > 0) this.replayEntries -= 1;
  }

  assertReconciliationBatch(size: number): void {
    if (!Number.isSafeInteger(size) || size < 0) throw new TypeError("reconciliation batch size must be a non-negative safe integer");
    if (size > this.limits.maxReconciliationBatch) throw new FederationProtocolError("RESOURCE_EXHAUSTED", "Reconciliation batch exceeds resource limit", "message");
  }

  snapshot(): FederationResourceSnapshot {
    return {
      concurrentSessions: this.concurrentSessions,
      outstandingInboxWork: this.outstandingInboxWork,
      replayEntries: this.replayEntries,
      peerWindowStarts: [...this.peerStarts.values()].reduce((sum, value) => sum + value, 0),
      globalWindowStarts: this.globalStarts,
    };
  }

  private assertPeer(peerId: string): void {
    if (peerId.length === 0) throw new TypeError("peerId must not be empty");
  }

  private rollWindows(peerId: string, nowMs: number): void {
    if (!Number.isFinite(nowMs)) throw new TypeError("nowMs must be finite");
    if (this.peerWindowStartedAt === 0 || nowMs - this.peerWindowStartedAt >= this.limits.rateWindowMs) {
      this.peerWindowStartedAt = nowMs;
      this.peerStarts.clear();
    }
    if (this.globalWindowStartedAt === 0 || nowMs - this.globalWindowStartedAt >= this.limits.rateWindowMs) {
      this.globalWindowStartedAt = nowMs;
      this.globalStarts = 0;
    }
    if (!this.peerStarts.has(peerId)) this.peerStarts.set(peerId, 0);
  }
}
