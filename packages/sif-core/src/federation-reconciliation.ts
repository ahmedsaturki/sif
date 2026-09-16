import { FederationProtocolError } from "./federation-envelope.js";

export interface FederatedObservation {
  sourceDomain: string;
  observationId: string;
  cursor: string;
  eventId?: string;
  eventDigest?: string;
  evidenceId?: string;
  evidenceDigest?: string;
  occurredAt: string;
  observedAt: string;
  payload: Record<string, unknown>;
}

export interface ReconciliationConflict {
  conflictId: string;
  sourceDomain: string;
  identityKey: string;
  localDigest?: string;
  remoteDigest?: string;
  observedAt: string;
  reason: "LOCAL_EVENT_DIVERGENCE" | "REMOTE_OBSERVATION_DIVERGENCE";
}

export interface ReconciliationResult {
  accepted: FederatedObservation[];
  duplicates: FederatedObservation[];
  conflicts: ReconciliationConflict[];
  nextCursor: string | null;
}

export interface ReconciliationInput {
  observations: FederatedObservation[];
  localEventDigests?: ReadonlyMap<string, string>;
}

function assertNonEmpty(name: string, value: string): void {
  if (value.length === 0) throw new TypeError(`${name} must not be empty`);
}

function assertDate(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new TypeError(`${name} must be a valid ISO date`);
}

function observationIdentity(observation: FederatedObservation): string {
  return `${observation.sourceDomain}\u0000${observation.observationId}`;
}

function logicalIdentity(observation: FederatedObservation): string {
  if (observation.eventId) return `event\u0000${observation.eventId}`;
  if (observation.evidenceId) return `evidence\u0000${observation.evidenceId}`;
  return observationIdentity(observation);
}

function digestOf(observation: FederatedObservation): string | undefined {
  return observation.eventDigest ?? observation.evidenceDigest;
}

function validateObservation(observation: FederatedObservation): void {
  assertNonEmpty("observation.sourceDomain", observation.sourceDomain);
  assertNonEmpty("observation.observationId", observation.observationId);
  assertNonEmpty("observation.cursor", observation.cursor);
  assertDate("observation.occurredAt", observation.occurredAt);
  assertDate("observation.observedAt", observation.observedAt);
  if (observation.eventId !== undefined) assertNonEmpty("observation.eventId", observation.eventId);
  if (observation.eventDigest !== undefined) assertNonEmpty("observation.eventDigest", observation.eventDigest);
  if (observation.evidenceId !== undefined) assertNonEmpty("observation.evidenceId", observation.evidenceId);
  if (observation.evidenceDigest !== undefined) assertNonEmpty("observation.evidenceDigest", observation.evidenceDigest);
  if (observation.eventId === undefined && observation.evidenceId === undefined) {
    throw new TypeError("observation must identify an event or evidence item");
  }
  if (observation.eventDigest === undefined && observation.evidenceDigest === undefined) {
    throw new TypeError("observation must carry an event or evidence digest");
  }
}

export class InMemoryFederationReconciler {
  private readonly seen = new Map<string, FederatedObservation>();
  private readonly conflicts: ReconciliationConflict[] = [];

  constructor(private readonly maxBatchSize: number) {
    if (!Number.isSafeInteger(maxBatchSize) || maxBatchSize <= 0) {
      throw new TypeError("maxBatchSize must be a positive safe integer");
    }
  }

  reconcile(input: ReconciliationInput): ReconciliationResult {
    if (input.observations.length > this.maxBatchSize) {
      throw new FederationProtocolError("RESOURCE_EXHAUSTED", "Reconciliation batch exceeds configured maximum", "message");
    }

    const ordered = [...input.observations].sort(compareObservations);
    const accepted: FederatedObservation[] = [];
    const duplicates: FederatedObservation[] = [];
    const conflicts: ReconciliationConflict[] = [];

    for (const observation of ordered) {
      validateObservation(observation);
      const identity = observationIdentity(observation);
      const existing = this.seen.get(identity);
      const remoteDigest = digestOf(observation);

      if (existing) {
        if (digestOf(existing) === remoteDigest && logicalIdentity(existing) === logicalIdentity(observation)) {
          duplicates.push(cloneObservation(observation));
          continue;
        }
        conflicts.push(this.recordConflict(observation, digestOf(existing), remoteDigest, "REMOTE_OBSERVATION_DIVERGENCE"));
        continue;
      }

      if (observation.eventId !== undefined) {
        const localDigest = input.localEventDigests?.get(observation.eventId);
        if (localDigest !== undefined && localDigest !== remoteDigest) {
          conflicts.push(this.recordConflict(observation, localDigest, remoteDigest, "LOCAL_EVENT_DIVERGENCE"));
          continue;
        }
      }

      this.seen.set(identity, cloneObservation(observation));
      accepted.push(cloneObservation(observation));
    }

    const last = ordered[ordered.length - 1];
    return {
      accepted,
      duplicates,
      conflicts,
      nextCursor: last?.cursor ?? null,
    };
  }

  listConflicts(): ReconciliationConflict[] {
    return this.conflicts.map((conflict) => ({ ...conflict }));
  }

  listObservations(): FederatedObservation[] {
    return [...this.seen.values()].sort(compareObservations).map(cloneObservation);
  }

  private recordConflict(
    observation: FederatedObservation,
    localDigest: string | undefined,
    remoteDigest: string | undefined,
    reason: ReconciliationConflict["reason"],
  ): ReconciliationConflict {
    const conflict: ReconciliationConflict = {
      conflictId: `${observation.sourceDomain}:${observation.observationId}:${this.conflicts.length + 1}`,
      sourceDomain: observation.sourceDomain,
      identityKey: logicalIdentity(observation),
      ...(localDigest === undefined ? {} : { localDigest }),
      ...(remoteDigest === undefined ? {} : { remoteDigest }),
      observedAt: observation.observedAt,
      reason,
    };
    this.conflicts.push(conflict);
    return { ...conflict };
  }
}

function compareObservations(a: FederatedObservation, b: FederatedObservation): number {
  const byCursor = a.cursor < b.cursor ? -1 : a.cursor > b.cursor ? 1 : 0;
  if (byCursor !== 0) return byCursor;
  const bySource = a.sourceDomain < b.sourceDomain ? -1 : a.sourceDomain > b.sourceDomain ? 1 : 0;
  if (bySource !== 0) return bySource;
  return a.observationId < b.observationId ? -1 : a.observationId > b.observationId ? 1 : 0;
}

function cloneObservation(observation: FederatedObservation): FederatedObservation {
  return {
    ...observation,
    payload: { ...observation.payload },
  };
}
