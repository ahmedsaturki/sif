import type { EventEnvelope, EventStore } from "./types.js";
import { digest, IntegrityError, now } from "./core.js";
import { ReplayEngine, type ProjectionCheckpoint } from "./replay.js";

export interface CheckpointStore {
  save(checkpoint: ProjectionCheckpoint): Promise<void>;
  get(projectionId: string, streamId: string): Promise<ProjectionCheckpoint | undefined>;
}

export interface ProjectionRunner<TState> {
  run(streamId: string): Promise<{ state: TState; checkpoint: ProjectionCheckpoint; applied: number }>;
}

export class ResumableProjection<TState> implements ProjectionRunner<TState> {
  private readonly replay: ReplayEngine;
  constructor(
    private readonly store: EventStore,
    private readonly checkpoints: CheckpointStore,
    private readonly projectionId: string,
    private readonly initial: () => TState,
    private readonly apply: (state: TState, event: EventEnvelope) => TState
  ) { this.replay = new ReplayEngine(store); }

  async run(streamId: string): Promise<{ state: TState; checkpoint: ProjectionCheckpoint; applied: number }> {
    const existing = await this.checkpoints.get(this.projectionId, streamId);
    const fromVersion = existing ? existing.streamVersion + 1 : 1;
    let state = existing ? this.replay.replay(streamId, { initial: this.initial, apply: this.apply }, 1).state : this.initial();
    const events = this.store.read(streamId, fromVersion).sort((a, b) => a.streamVersion - b.streamVersion);
    let expected = fromVersion;
    for (const event of events) {
      if (event.streamVersion !== expected) throw new IntegrityError(`Projection gap on ${streamId}: expected ${expected}, got ${event.streamVersion}`);
      state = this.apply(state, event);
      expected += 1;
    }
    const applied = events.length;
    const version = existing?.streamVersion ?? 0;
    const finalVersion = applied ? expected - 1 : version;
    const checkpoint: ProjectionCheckpoint = { projectionId: this.projectionId, streamId, streamVersion: finalVersion, stateDigest: digest(state), updatedAt: now() };
    if (applied || !existing) await this.checkpoints.save(checkpoint);
    return { state, checkpoint, applied };
  }
}
