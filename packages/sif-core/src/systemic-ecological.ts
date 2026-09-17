import { digest, stableStringify } from "./core.js";

export type SystemAction =
  | { kind: "SET"; variable: string; value: number }
  | { kind: "ADD"; variable: string; value: number }
  | { kind: "MULTIPLY"; variable: string; value: number };
export type SimulationEventStatus = "APPLIED" | "BLOCKED" | "IGNORED";

export interface SystemicEcologicalLimits {
  maxPlayers: number;
  maxAgents: number;
  maxStrategies: number;
  maxMarkets: number;
  maxInstitutions: number;
  maxEvents: number;
  maxSteps: number;
  maxStateVariables: number;
  maxPayloadBytes: number;
  maxBranches: number;
  maxActionsPerStrategy: number;
  maxRulesPerInstitution: number;
  maxEventsPerStep: number;
}

export interface SystemPlayer {
  id: string;
  kind: "PERSON" | "ORGANIZATION" | "COLLECTIVE" | "ENVIRONMENT";
  attributes?: Record<string, string | number | boolean>;
}

export interface SystemAgent {
  id: string;
  playerId: string;
  strategyId: string;
  attributes?: Record<string, string | number | boolean>;
}

export interface StrategyRule {
  eventType: string;
  actions: SystemAction[];
}

export interface SystemStrategy {
  id: string;
  version: string;
  rules: StrategyRule[];
}

export interface SystemMarket {
  id: string;
  name: string;
  stateVariables: string[];
  participantIds: string[];
}

export interface InstitutionRule {
  eventType: string;
  allow: boolean;
}

export interface SystemInstitution {
  id: string;
  name: string;
  rules: InstitutionRule[];
}

export interface SimulationEvent {
  id: string;
  step: number;
  type: string;
  actorId?: string;
  strategyId?: string;
  payload?: Record<string, string | number | boolean | null>;
}

export interface WorldModelRegistration {
  modelId: string;
  version: string;
  players: SystemPlayer[];
  agents: SystemAgent[];
  strategies: SystemStrategy[];
  markets: SystemMarket[];
  institutions: SystemInstitution[];
  initialState: Record<string, number>;
}

export interface WorldModel extends WorldModelRegistration {
  digest: string;
}

export interface SimulationObservation {
  eventId: string;
  step: number;
  status: SimulationEventStatus;
  stateBeforeDigest: string;
  stateAfterDigest: string;
  appliedActionCount: number;
  reason?: string;
}

export interface SimulationFrame {
  step: number;
  state: Record<string, number>;
  stateDigest: string;
  observations: SimulationObservation[];
}

export interface SimulationResult {
  modelId: string;
  modelDigest: string;
  scenarioId: string;
  completedSteps: number;
  finalState: Record<string, number>;
  finalStateDigest: string;
  frames: SimulationFrame[];
  resultDigest: string;
}

export interface ExperimentScenario {
  id: string;
  hypothesis: string;
  events: SimulationEvent[];
  initialStateOverrides?: Record<string, number>;
}

export interface ExperimentResult {
  experimentId: string;
  modelDigest: string;
  branches: SimulationResult[];
  digest: string;
}

export interface SimulationReplayDescriptor {
  modelId: string;
  modelDigest: string;
  scenarioId: string;
  scenarioDigest: string;
  resultDigest: string;
  finalStateDigest: string;
}

export class SystemicEcologicalError extends Error {
  constructor(readonly code:
    | "INVALID_SYSTEM"
    | "RESOURCE_EXHAUSTED"
    | "DUPLICATE_ID"
    | "UNKNOWN_REFERENCE"
    | "INVALID_EVENT"
    | "INSTITUTION_BLOCKED"
    | "REPLAY_MISMATCH"
    | "NON_DETERMINISTIC"
  , message: string) {
    super(message);
    this.name = "SystemicEcologicalError";
  }
}

function text(name: string, value: string): void {
  if (value.length === 0) throw new SystemicEcologicalError("INVALID_SYSTEM", `${name} must not be empty`);
}
function positive(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", `${name} must be positive`);
}
function nonNegativeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new SystemicEcologicalError("INVALID_EVENT", `${name} must be a non-negative integer`);
}
function finiteNumber(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new SystemicEcologicalError("INVALID_SYSTEM", `${name} must be finite`);
}
function bytes(value: unknown): number {
  return new TextEncoder().encode(stableStringify(value)).byteLength;
}
function clone<T>(value: T): T {
  return structuredClone(value);
}
function unique(ids: string[], label: string): void {
  const set = new Set(ids);
  if (set.size !== ids.length) throw new SystemicEcologicalError("DUPLICATE_ID", `${label} identifiers must be unique`);
}
function mapById<T extends { id: string }>(items: T[], label: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    text(`${label}.id`, item.id);
    if (result.has(item.id)) throw new SystemicEcologicalError("DUPLICATE_ID", `Duplicate ${label} id`);
    result.set(item.id, item);
  }
  return result;
}

export function registerWorldModel(registration: WorldModelRegistration, limits: SystemicEcologicalLimits): WorldModel {
  text("modelId", registration.modelId);
  text("version", registration.version);
  if (registration.players.length > limits.maxPlayers) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", "Player limit exceeded");
  if (registration.agents.length > limits.maxAgents) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", "Agent limit exceeded");
  if (registration.strategies.length > limits.maxStrategies) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", "Strategy limit exceeded");
  if (registration.markets.length > limits.maxMarkets) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", "Market limit exceeded");
  if (registration.institutions.length > limits.maxInstitutions) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", "Institution limit exceeded");
  const players = clone(registration.players);
  const agents = clone(registration.agents);
  const strategies = clone(registration.strategies);
  const markets = clone(registration.markets);
  const institutions = clone(registration.institutions);
  unique(players.map((x) => x.id), "player");
  unique(agents.map((x) => x.id), "agent");
  unique(strategies.map((x) => x.id), "strategy");
  unique(markets.map((x) => x.id), "market");
  unique(institutions.map((x) => x.id), "institution");
  if (Object.keys(registration.initialState).length > limits.maxStateVariables) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", "State variable limit exceeded");
  const playerMap = mapById(players, "player");
  const strategyMap = mapById(strategies, "strategy");
  for (const agent of agents) {
    if (!playerMap.has(agent.playerId)) throw new SystemicEcologicalError("UNKNOWN_REFERENCE", `Unknown agent player ${agent.playerId}`);
    if (!strategyMap.has(agent.strategyId)) throw new SystemicEcologicalError("UNKNOWN_REFERENCE", `Unknown agent strategy ${agent.strategyId}`);
    text("agent.id", agent.id);
  }
  for (const strategy of strategies) {
    text("strategy.version", strategy.version);
    if (strategy.rules.some((rule) => rule.actions.length > limits.maxActionsPerStrategy)) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", "Strategy action limit exceeded");
    for (const rule of strategy.rules) {
      text("strategy.eventType", rule.eventType);
      for (const action of rule.actions) validateAction(action);
    }
  }
  for (const market of markets) {
    text("market.name", market.name);
    for (const participantId of market.participantIds) if (!playerMap.has(participantId) && !agents.some((x) => x.id === participantId)) throw new SystemicEcologicalError("UNKNOWN_REFERENCE", `Unknown market participant ${participantId}`);
  }
  for (const institution of institutions) {
    if (institution.rules.length > limits.maxRulesPerInstitution) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", "Institution rule limit exceeded");
    for (const rule of institution.rules) text("institution.eventType", rule.eventType);
  }
  const initialState = clone(registration.initialState);
  for (const [key, value] of Object.entries(initialState)) {
    text("state variable", key);
    finiteNumber(`state.${key}`, value);
  }
  const identity = { modelId: registration.modelId, version: registration.version, players, agents, strategies, markets, institutions, initialState };
  return { ...identity, digest: digest(identity) };
}

function validateAction(action: SystemAction): void {
  text("action.variable", action.variable);
  finiteNumber("action.value", action.value);
  if (action.kind !== "SET" && action.kind !== "ADD" && action.kind !== "MULTIPLY") throw new SystemicEcologicalError("INVALID_SYSTEM", "Unknown system action");
}

export function validateScenario(events: SimulationEvent[], limits: SystemicEcologicalLimits): void {
  if (events.length > limits.maxEvents) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", "Event limit exceeded");
  unique(events.map((x) => x.id), "event");
  const perStep = new Map<number, number>();
  for (const event of events) {
    text("event.id", event.id);
    nonNegativeInteger("event.step", event.step);
    if (event.step >= limits.maxSteps) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", "Event step exceeds simulation limit");
    text("event.type", event.type);
    const count = (perStep.get(event.step) ?? 0) + 1;
    perStep.set(event.step, count);
    if (count > limits.maxEventsPerStep) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", "Events-per-step limit exceeded");
  }
  if (events.some((x) => x.payload !== undefined && bytes(x.payload) > limits.maxPayloadBytes)) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", "Event payload limit exceeded");
}

export function scenarioDigest(scenario: ExperimentScenario): string {
  return digest({ id: scenario.id, hypothesis: scenario.hypothesis, events: scenario.events, initialStateOverrides: scenario.initialStateOverrides ?? {} });
}

export class SystemSimulationEngine {
  constructor(private readonly limits: SystemicEcologicalLimits) {
    positive("maxSteps", limits.maxSteps);
    positive("maxEvents", limits.maxEvents);
    positive("maxEventsPerStep", limits.maxEventsPerStep);
  }

  run(model: WorldModel, scenarioId: string, events: SimulationEvent[], initialStateOverrides: Record<string, number> = {}): SimulationResult {
    text("scenarioId", scenarioId);
    validateScenario(events, this.limits);
    for (const [key, value] of Object.entries(initialStateOverrides)) {
      finiteNumber(`override.${key}`, value);
      if (!(key in model.initialState)) throw new SystemicEcologicalError("UNKNOWN_REFERENCE", `Unknown state variable ${key}`);
    }
    const strategyMap = new Map(model.strategies.map((x) => [x.id, x]));
    const agentMap = new Map(model.agents.map((x) => [x.id, x]));
    const institutionMap = model.institutions;
    const state = clone(model.initialState);
    Object.assign(state, clone(initialStateOverrides));
    const ordered = [...events].sort((a, b) => a.step - b.step || a.id.localeCompare(b.id));
    const eventsByStep = new Map<number, SimulationEvent[]>();
    for (const event of ordered) {
      const bucket = eventsByStep.get(event.step) ?? [];
      bucket.push(event);
      eventsByStep.set(event.step, bucket);
    }
    const frames: SimulationFrame[] = [];
    for (let step = 0; step < this.limits.maxSteps; step += 1) {
      const observations: SimulationObservation[] = [];
      for (const event of eventsByStep.get(step) ?? []) {
        const before = digest(state);
        const actorAgent = event.actorId === undefined ? undefined : agentMap.get(event.actorId);
        const strategyId = event.strategyId ?? actorAgent?.strategyId;
        const strategy = strategyId === undefined ? undefined : strategyMap.get(strategyId);
        if (strategyId !== undefined && strategy === undefined) throw new SystemicEcologicalError("UNKNOWN_REFERENCE", `Unknown strategy ${strategyId}`);
        if (event.actorId !== undefined && actorAgent === undefined && !model.players.some((x) => x.id === event.actorId)) throw new SystemicEcologicalError("UNKNOWN_REFERENCE", `Unknown event actor ${event.actorId}`);
        const blockedBy = institutionMap.find((institution) => institution.rules.some((rule) => rule.eventType === event.type && !rule.allow));
        if (blockedBy) {
          observations.push({ eventId: event.id, step, status: "BLOCKED", stateBeforeDigest: before, stateAfterDigest: before, appliedActionCount: 0, reason: `Institution ${blockedBy.id} blocked event` });
          continue;
        }
        const matchingRules = strategy?.rules.filter((rule) => rule.eventType === event.type) ?? [];
        const actions = matchingRules.flatMap((rule) => rule.actions);
        if (actions.length === 0) {
          observations.push({ eventId: event.id, step, status: "IGNORED", stateBeforeDigest: before, stateAfterDigest: before, appliedActionCount: 0, reason: "No matching strategy action" });
          continue;
        }
        for (const action of actions) applyAction(state, action);
        const after = digest(state);
        observations.push({ eventId: event.id, step, status: "APPLIED", stateBeforeDigest: before, stateAfterDigest: after, appliedActionCount: actions.length });
      }
      frames.push({ step, state: clone(state), stateDigest: digest(state), observations });
      if (eventsByStep.size > 0 && step >= Math.max(...eventsByStep.keys())) {
        return finish(model, scenarioId, frames, state);
      }
    }
    return finish(model, scenarioId, frames, state);
  }
}

function applyAction(state: Record<string, number>, action: SystemAction): void {
  if (!(action.variable in state)) throw new SystemicEcologicalError("UNKNOWN_REFERENCE", `Unknown state variable ${action.variable}`);
  const current = state[action.variable]!;
  const value = action.kind === "SET" ? action.value : action.kind === "ADD" ? current + action.value : current * action.value;
  finiteNumber(`state.${action.variable}`, value);
  state[action.variable] = value;
}

function finish(model: WorldModel, scenarioId: string, frames: SimulationFrame[], state: Record<string, number>): SimulationResult {
  const finalState = clone(state);
  const finalStateDigest = digest(finalState);
  const completedSteps = frames.length;
  const resultBase = { modelId: model.modelId, modelDigest: model.digest, scenarioId, completedSteps, finalStateDigest, frameDigests: frames.map((x) => x.stateDigest) };
  return { modelId: model.modelId, modelDigest: model.digest, scenarioId, completedSteps, finalState, finalStateDigest, frames: clone(frames), resultDigest: digest(resultBase) };
}

export function runExperiment(model: WorldModel, scenarios: ExperimentScenario[], limits: SystemicEcologicalLimits, experimentId: string): ExperimentResult {
  text("experimentId", experimentId);
  if (scenarios.length > limits.maxBranches) throw new SystemicEcologicalError("RESOURCE_EXHAUSTED", "Experiment branch limit exceeded");
  unique(scenarios.map((x) => x.id), "scenario");
  const engine = new SystemSimulationEngine(limits);
  const branches = scenarios.map((scenario) => engine.run(model, scenario.id, scenario.events, scenario.initialStateOverrides ?? {}));
  const branchEvidence = scenarios.map((scenario, index) => ({ scenarioDigest: scenarioDigest(scenario), resultDigest: branches[index]!.resultDigest }));
  return { experimentId, modelDigest: model.digest, branches, digest: digest({ experimentId, modelDigest: model.digest, branchEvidence }) };
}

export function makeSimulationReplayDescriptor(result: SimulationResult, scenario: ExperimentScenario): SimulationReplayDescriptor {
  text("scenario.id", scenario.id);
  return { modelId: result.modelId, modelDigest: result.modelDigest, scenarioId: result.scenarioId, scenarioDigest: scenarioDigest(scenario), resultDigest: result.resultDigest, finalStateDigest: result.finalStateDigest };
}

export function verifySimulationReplayDescriptor(descriptor: SimulationReplayDescriptor, model: WorldModel, scenario: ExperimentScenario, result: SimulationResult): void {
  if (descriptor.modelId !== model.modelId || descriptor.modelDigest !== model.digest || descriptor.scenarioId !== scenario.id || descriptor.scenarioDigest !== scenarioDigest(scenario) || descriptor.resultDigest !== result.resultDigest || descriptor.finalStateDigest !== result.finalStateDigest) throw new SystemicEcologicalError("REPLAY_MISMATCH", "Simulation replay descriptor mismatch");
}

export function verifyDeterministicSimulation(model: WorldModel, scenario: ExperimentScenario, limits: SystemicEcologicalLimits): SimulationResult {
  const engine = new SystemSimulationEngine(limits);
  const first = engine.run(model, scenario.id, scenario.events, scenario.initialStateOverrides ?? {});
  const second = engine.run(model, scenario.id, scenario.events, scenario.initialStateOverrides ?? {});
  if (first.resultDigest !== second.resultDigest || stableStringify(first.finalState) !== stableStringify(second.finalState)) throw new SystemicEcologicalError("NON_DETERMINISTIC", "Repeated simulation produced different results");
  return first;
}

export function semanticStateDigest(state: Record<string, number>): string {
  for (const value of Object.values(state)) finiteNumber("semantic state", value);
  return digest(state);
}
