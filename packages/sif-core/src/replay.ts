import type { EventEnvelope, EventStore } from './types.js';
import { IntegrityError, digest } from './core.js';

export interface ProjectionCheckpoint {
  projectionId: string;
  streamId: string;
  streamVersion: number;
  stateDigest: string;
  updatedAt: string;
}

export interface ReplayResult<T> {
  state: T;
  streamId: string;
  applied: number;
  fromVersion: number;
  toVersion: number;
  stateDigest: string;
}

export interface EventApplier<T> {
  initial(): T;
  apply(state: T, event: EventEnvelope): T;
}

export class ReplayEngine {
  constructor(private readonly store: EventStore) {}

  replay<T>(streamId: string, applier: EventApplier<T>, fromVersion = 1, initialState?: T): ReplayResult<T> {
    const events = this.store.read(streamId, fromVersion).sort((a, b) => a.streamVersion - b.streamVersion);
    let state = initialState === undefined ? applier.initial() : structuredClone(initialState);
    let expected = fromVersion;
    for (const event of events) {
      if (event.streamVersion !== expected) throw new IntegrityError(`Replay gap on ${streamId}: expected ${expected}, got ${event.streamVersion}`);
      state = applier.apply(state, event);
      expected += 1;
    }
    return { state, streamId, applied: events.length, fromVersion, toVersion: events.length ? expected - 1 : fromVersion - 1, stateDigest: digest(state) };
  }

  verifyStreamContiguous(streamId: string): void {
    const events = this.store.read(streamId).sort((a, b) => a.streamVersion - b.streamVersion);
    let expected = 1;
    for (const event of events) { if (event.streamVersion !== expected) throw new IntegrityError(`Non-contiguous stream ${streamId}`); expected += 1; }
  }
}
