import { sha256 } from "./deterministic.js";
import type { ReieClaim } from "./reie.js";
import type { ReieExtractionCandidate } from "./extraction.js";

export interface ReieClaimSink {
  recordClaim(claim: ReieClaim): ReieClaim | Promise<ReieClaim>;
}

export type ReieReviewDecision = "ACCEPT" | "REJECT";

export interface ReieReviewItem {
  readonly candidate: ReieExtractionCandidate;
  readonly status: "PENDING" | "ACCEPTED" | "REJECTED";
  readonly reviewedAt?: string;
  readonly reviewer?: string;
  readonly claimId?: string;
}

export class ReieReviewError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_INPUT" | "ENTITY_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "ReieReviewError";
  }
}

export class ReieReviewQueue {
  private readonly items = new Map<string, ReieReviewItem>();

  add(candidate: ReieExtractionCandidate): ReieReviewItem {
    const existing = this.items.get(candidate.candidateId);
    if (existing) return structuredClone(existing);
    const item: ReieReviewItem = { candidate: structuredClone(candidate), status: "PENDING" };
    this.items.set(candidate.candidateId, item);
    return structuredClone(item);
  }

  list(status?: ReieReviewItem["status"]): ReieReviewItem[] {
    return [...this.items.values()]
      .filter((item) => !status || item.status === status)
      .sort((a, b) => a.candidate.candidateId.localeCompare(b.candidate.candidateId))
      .map((item) => structuredClone(item));
  }

  async decide(
    candidateId: string,
    decision: ReieReviewDecision,
    reviewer: string,
    sink: ReieClaimSink,
    reviewedAt = new Date().toISOString(),
  ): Promise<ReieReviewItem> {
    const id = candidateId.trim();
    const who = reviewer.trim();
    if (!id || !who) throw new ReieReviewError("INVALID_INPUT", "candidateId and reviewer are required");
    if (!Number.isFinite(Date.parse(reviewedAt))) throw new ReieReviewError("INVALID_INPUT", "reviewedAt must be valid");
    const existing = this.items.get(id);
    if (!existing) throw new ReieReviewError("NOT_FOUND", "Review candidate not found");
    if (existing.status !== "PENDING") {
      if (existing.status === (decision === "ACCEPT" ? "ACCEPTED" : "REJECTED")) return structuredClone(existing);
      throw new ReieReviewError("CONFLICT", "Review item was already finalized");
    }

    if (decision === "REJECT") {
      const rejected: ReieReviewItem = {
        ...existing,
        status: "REJECTED",
        reviewedAt: new Date(Date.parse(reviewedAt)).toISOString(),
        reviewer: who,
      };
      this.items.set(id, rejected);
      return structuredClone(rejected);
    }

    if (!existing.candidate.entityId.trim()) {
      throw new ReieReviewError("ENTITY_REQUIRED", "Accepted text extraction candidates require an explicit entityId");
    }

    const claimId = "claim:" + sha256({
      candidateId: existing.candidate.candidateId,
      sourceId: existing.candidate.sourceId,
      entityId: existing.candidate.entityId,
      field: existing.candidate.field,
      value: existing.candidate.value,
      observedAt: existing.candidate.observedAt,
    });
    await sink.recordClaim({
      claimId,
      entityId: existing.candidate.entityId,
      sourceId: existing.candidate.sourceId,
      field: existing.candidate.field,
      value: structuredClone(existing.candidate.value),
      observedAt: existing.candidate.observedAt,
    });
    const accepted: ReieReviewItem = {
      ...existing,
      status: "ACCEPTED",
      reviewedAt: new Date(Date.parse(reviewedAt)).toISOString(),
      reviewer: who,
      claimId,
    };
    this.items.set(id, accepted);
    return structuredClone(accepted);
  }

  export(): readonly ReieReviewItem[] {
    return this.list();
  }

  restore(items: readonly ReieReviewItem[]): void {
    for (const item of items) {
      if (this.items.has(item.candidate.candidateId)) continue;
      this.items.set(item.candidate.candidateId, structuredClone(item));
    }
  }
}
