import test from "node:test";
import assert from "node:assert/strict";
import {
  SystemSimulationEngine,
  SystemicEcologicalError,
  registerWorldModel,
  runExperiment,
  scenarioDigest,
  semanticStateDigest,
  validateScenario,
  verifyDeterministicSimulation,
  makeSimulationReplayDescriptor,
  verifySimulationReplayDescriptor,
  type SystemicEcologicalLimits,
  type WorldModelRegistration,
  type ExperimentScenario,
  type SimulationEvent,
} from "../src/index.js";

const L: SystemicEcologicalLimits = {
  maxPlayers: 4,
  maxAgents: 4,
  maxStrategies: 4,
  maxMarkets: 4,
  maxInstitutions: 4,
  maxEvents: 8,
  maxSteps: 6,
  maxStateVariables: 6,
  maxPayloadBytes: 256,
  maxBranches: 3,
  maxActionsPerStrategy: 4,
  maxRulesPerInstitution: 4,
  maxEventsPerStep: 3,
};

const baseRegistration: WorldModelRegistration = {
  modelId: "world",
  version: "1.0.0",
  players: [{ id: "p1", kind: "PERSON", attributes: { role: "buyer" } }],
  agents: [{ id: "a1", playerId: "p1", strategyId: "s1" }],
  strategies: [{ id: "s1", version: "1.0.0", rules: [{ eventType: "tick", actions: [{ kind: "ADD", variable: "price", value: 2 }] }] }],
  markets: [{ id: "m1", name: "market", stateVariables: ["price"], participantIds: ["p1"] }],
  institutions: [{ id: "i1", name: "institution", rules: [] }],
  initialState: { price: 10, volume: 0 },
};

function model(over: Partial<WorldModelRegistration> = {}) { return registerWorldModel({ ...baseRegistration, ...over }, L); }
function event(over: Partial<SimulationEvent> = {}): SimulationEvent { return { id: "e1", step: 0, type: "tick", actorId: "a1", ...over }; }
function expectCode(action: () => unknown, code: string): void {
  let caught: unknown;
  try { action(); } catch (error: unknown) { caught = error; }
  if (!(caught instanceof SystemicEcologicalError)) throw new Error(`Expected ${code}`);
  assert.equal(caught.code, code);
}

const cases: Array<[string, () => unknown]> = [
  ["F7-001", () => assert.equal(model().modelId, "world")],
  ["F7-002", () => assert.equal(model().digest, model().digest)],
  ["F7-003", () => { const input = model({ players: [{ id: "p1", kind: "PERSON", attributes: { role: "buyer" } }] }); assert.equal(input.players[0]!.attributes!.role, "buyer"); }],
  ["F7-004", () => expectCode(() => model({ modelId: "" }), "INVALID_SYSTEM")],
  ["F7-005", () => expectCode(() => model({ players: Array.from({ length: 5 }, (_, i) => ({ id: String(i), kind: "PERSON" as const })) }), "RESOURCE_EXHAUSTED")],
  ["F7-006", () => expectCode(() => model({ agents: [{ id: "a1", playerId: "missing", strategyId: "s1" }] }), "UNKNOWN_REFERENCE")],
  ["F7-007", () => expectCode(() => model({ agents: [{ id: "a1", playerId: "p1", strategyId: "missing" }] }), "UNKNOWN_REFERENCE")],
  ["F7-008", () => expectCode(() => model({ markets: [{ id: "m1", name: "m", stateVariables: ["price"], participantIds: ["missing"] }] }), "UNKNOWN_REFERENCE")],
  ["F7-009", () => expectCode(() => model({ strategies: [{ id: "s1", version: "1.0.0", rules: [{ eventType: "x", actions: Array.from({ length: 5 }, () => ({ kind: "ADD" as const, variable: "price", value: 1 })) }] }] }), "RESOURCE_EXHAUSTED")],
  ["F7-010", () => expectCode(() => model({ institutions: [{ id: "i1", name: "i", rules: Array.from({ length: 5 }, () => ({ eventType: "x", allow: true })) }] }), "RESOURCE_EXHAUSTED")],
  ["F7-011", () => expectCode(() => model({ initialState: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 } }), "RESOURCE_EXHAUSTED")],
  ["F7-012", () => expectCode(() => model({ initialState: { price: Number.NaN, volume: 0 } }), "INVALID_SYSTEM")],
  ["F7-013", () => expectCode(() => model({ players: [{ id: "p1", kind: "PERSON" }, { id: "p1", kind: "ORGANIZATION" }] }), "DUPLICATE_ID")],
  ["F7-014", () => expectCode(() => model({ strategies: [{ id: "s1", version: "1.0.0", rules: [] }, { id: "s1", version: "2.0.0", rules: [] }] }), "DUPLICATE_ID")],
  ["F7-015", () => expectCode(() => validateScenario([event(), event()], L), "DUPLICATE_ID")],
  ["F7-016", () => expectCode(() => validateScenario([event({ step: -1 })], L), "INVALID_EVENT")],
  ["F7-017", () => expectCode(() => validateScenario([event({ step: 6 })], L), "RESOURCE_EXHAUSTED")],
  ["F7-018", () => expectCode(() => validateScenario([event({ payload: { x: "x".repeat(300) } })], L), "RESOURCE_EXHAUSTED")],
  ["F7-019", () => expectCode(() => validateScenario([event({ id: "e1" }), event({ id: "e2" }), event({ id: "e3" }), event({ id: "e4" })], L), "RESOURCE_EXHAUSTED")],
  ["F7-020", () => assert.equal(scenarioDigest({ id: "s", hypothesis: "h", events: [], initialStateOverrides: {} }), scenarioDigest({ id: "s", hypothesis: "h", events: [], initialStateOverrides: {} }))],
  ["F7-021", () => { const r = new SystemSimulationEngine(L).run(model(), "s", [event()]); assert.equal(r.finalState.price, 12); }],
  ["F7-022", () => { const m = model({ strategies: [{ id: "s1", version: "1.0.0", rules: [{ eventType: "tick", actions: [{ kind: "SET", variable: "price", value: 20 }] }] }] }); const r = new SystemSimulationEngine(L).run(m, "s", [event()]); assert.equal(r.finalState.price, 20); }],
  ["F7-023", () => { const m = model({ strategies: [{ id: "s1", version: "1.0.0", rules: [{ eventType: "tick", actions: [{ kind: "MULTIPLY", variable: "price", value: 2 }] }] }] }); const r = new SystemSimulationEngine(L).run(m, "s", [event()]); assert.equal(r.finalState.price, 20); }],
  ["F7-024", () => { const r = new SystemSimulationEngine(L).run(model(), "s", [{ id: "e1", step: 0, type: "unknown" }]); assert.equal(r.finalState.price, 10); assert.equal(r.frames[0]!.observations[0]!.status, "IGNORED"); }],
  ["F7-025", () => { const r = new SystemSimulationEngine(L).run(model(), "s", [event()]); assert.equal(r.frames[0]!.observations[0]!.status, "APPLIED"); }],
  ["F7-026", () => { const m = model({ strategies: [{ id: "s1", version: "1.0.0", rules: [{ eventType: "tick", actions: [{ kind: "ADD", variable: "price", value: 2 }] }] }, { id: "s2", version: "1.0.0", rules: [{ eventType: "tick", actions: [{ kind: "ADD", variable: "price", value: 5 }] }] }] }); const r = new SystemSimulationEngine(L).run(m, "s", [event({ strategyId: "s2" })]); assert.equal(r.finalState.price, 15); }],
  ["F7-027", () => { const m = model({ institutions: [{ id: "i1", name: "i", rules: [{ eventType: "tick", allow: false }] }] }); const r = new SystemSimulationEngine(L).run(m, "s", [event()]); assert.equal(r.finalState.price, 10); assert.equal(r.frames[0]!.observations[0]!.status, "BLOCKED"); }],
  ["F7-028", () => expectCode(() => new SystemSimulationEngine(L).run(model(), "s", [event({ actorId: "missing" })]), "UNKNOWN_REFERENCE")],
  ["F7-029", () => expectCode(() => new SystemSimulationEngine(L).run(model(), "s", [event({ strategyId: "missing" })]), "UNKNOWN_REFERENCE")],
  ["F7-030", () => { const m = model({ strategies: [{ id: "s1", version: "1.0.0", rules: [{ eventType: "tick", actions: [{ kind: "ADD", variable: "missing", value: 1 }] }] }] }); expectCode(() => new SystemSimulationEngine(L).run(m, "s", [event()]), "UNKNOWN_REFERENCE"); }],
  ["F7-031", () => { const m = model({ strategies: [{ id: "s1", version: "1.0.0", rules: [{ eventType: "tick", actions: [{ kind: "ADD", variable: "price", value: 2 }, { kind: "ADD", variable: "volume", value: 1 }] }] }] }); const r = new SystemSimulationEngine(L).run(m, "s", [event()]); assert.equal(r.finalState.price, 12); assert.equal(r.finalState.volume, 1); }],
  ["F7-032", () => { const r = new SystemSimulationEngine(L).run(model(), "s", [event({ id: "b" }), event({ id: "a" })]); assert.deepEqual(r.frames[0]!.observations.map((x) => x.eventId), ["a", "b"]); assert.equal(r.finalState.price, 14); }],
  ["F7-033", () => { const r = new SystemSimulationEngine(L).run(model(), "s", [event()]); r.frames[0]!.state.price = 999; assert.equal(r.finalState.price, 12); }],
  ["F7-034", () => { const r = new SystemSimulationEngine(L).run(model(), "s", [event()]); assert.equal(r.finalStateDigest.length, 64); }],
  ["F7-035", () => { const r = new SystemSimulationEngine(L).run(model(), "s", [event()]); assert.equal(/^[0-9a-f]{64}$/.test(r.resultDigest), true); }],
  ["F7-036", () => { const r = new SystemSimulationEngine(L).run(model(), "s", [event({ step: 2 })]); assert.equal(r.completedSteps, 3); }],
  ["F7-037", () => { const r = new SystemSimulationEngine(L).run(model(), "s", []); assert.equal(r.completedSteps, L.maxSteps); }],
  ["F7-038", () => { const r = new SystemSimulationEngine(L).run(model(), "s", [], { price: 50 }); assert.equal(r.finalState.price, 50); }],
  ["F7-039", () => expectCode(() => new SystemSimulationEngine(L).run(model(), "s", [], { missing: 1 }), "UNKNOWN_REFERENCE")],
  ["F7-040", () => { const r = new SystemSimulationEngine(L).run(model(), "s", [event({ actorId: "p1" })]); assert.equal(r.finalState.price, 10); }],
  ["F7-041", () => expectCode(() => runExperiment(model(), Array.from({ length: 4 }, (_, i) => ({ id: String(i), hypothesis: "h", events: [] })), L, "x"), "RESOURCE_EXHAUSTED")],
  ["F7-042", () => expectCode(() => runExperiment(model(), [{ id: "x", hypothesis: "h", events: [] }, { id: "x", hypothesis: "h2", events: [] }], L, "x"), "DUPLICATE_ID")],
  ["F7-043", () => { const z = runExperiment(model(), [{ id: "a", hypothesis: "h1", events: [] }, { id: "b", hypothesis: "h2", events: [event()] }], L, "x"); assert.equal(z.branches.length, 2); assert.equal(z.branches[1]!.finalState.price, 12); }],
  ["F7-044", () => { const a = runExperiment(model(), [{ id: "a", hypothesis: "h1", events: [] }], L, "x"); const b = runExperiment(model(), [{ id: "a", hypothesis: "h2", events: [] }], L, "x"); assert.notEqual(a.digest, b.digest); }],
  ["F7-045", () => { const a = runExperiment(model(), [{ id: "a", hypothesis: "h", events: [event()] }], L, "x"); const b = runExperiment(model(), [{ id: "a", hypothesis: "h", events: [event()] }], L, "x"); assert.equal(a.digest, b.digest); }],
  ["F7-046", () => { const scenario: ExperimentScenario = { id: "s", hypothesis: "h", events: [event()] }; const m = model(); const result = new SystemSimulationEngine(L).run(m, scenario.id, scenario.events); const descriptor = makeSimulationReplayDescriptor(result, scenario); verifySimulationReplayDescriptor(descriptor, m, scenario, result); }],
  ["F7-047", () => { const scenario: ExperimentScenario = { id: "s", hypothesis: "h", events: [event()] }; const m = model(); const result = new SystemSimulationEngine(L).run(m, scenario.id, scenario.events); const descriptor = makeSimulationReplayDescriptor(result, scenario); expectCode(() => verifySimulationReplayDescriptor({ ...descriptor, modelDigest: "bad" }, m, scenario, result), "REPLAY_MISMATCH"); }],
  ["F7-048", () => { const scenario: ExperimentScenario = { id: "s", hypothesis: "h", events: [event()] }; const m = model(); const result = new SystemSimulationEngine(L).run(m, scenario.id, scenario.events); const descriptor = makeSimulationReplayDescriptor(result, scenario); expectCode(() => verifySimulationReplayDescriptor({ ...descriptor, scenarioDigest: "bad" }, m, scenario, result), "REPLAY_MISMATCH"); }],
  ["F7-049", () => { const scenario: ExperimentScenario = { id: "s", hypothesis: "h", events: [event()] }; const m = model(); const result = new SystemSimulationEngine(L).run(m, scenario.id, scenario.events); const descriptor = makeSimulationReplayDescriptor(result, scenario); expectCode(() => verifySimulationReplayDescriptor({ ...descriptor, resultDigest: "bad" }, m, scenario, result), "REPLAY_MISMATCH"); }],
  ["F7-050", () => { const scenario: ExperimentScenario = { id: "s", hypothesis: "h", events: [event()] }; assert.equal(verifyDeterministicSimulation(model(), scenario, L).resultDigest, new SystemSimulationEngine(L).run(model(), "s", [event()]).resultDigest); }],
  ["F7-051", () => assert.equal(semanticStateDigest({ price: 1, volume: 2 }), semanticStateDigest({ price: 1, volume: 2 }))],
  ["F7-052", () => { let caught = false; try { semanticStateDigest({ price: Number.NaN }); } catch { caught = true; } assert.equal(caught, true); }],
  ["F7-053", () => expectCode(() => validateScenario(Array.from({ length: 9 }, (_, i) => event({ id: String(i), step: 0 })), L), "RESOURCE_EXHAUSTED")],
  ["F7-054", () => expectCode(() => registerWorldModel({ ...baseRegistration, initialState: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`v${i}`, i])) }, L), "RESOURCE_EXHAUSTED")],
  ["F7-055", () => expectCode(() => runExperiment(model(), [], L, ""), "INVALID_SYSTEM")],
  ["F7-056", () => expectCode(() => new SystemSimulationEngine(L).run(model(), "", []), "INVALID_SYSTEM")],
  ["F7-057", () => expectCode(() => registerWorldModel({ ...baseRegistration, strategies: [{ id: "s1", version: "", rules: [] }] }, L), "INVALID_SYSTEM")],
  ["F7-058", () => expectCode(() => registerWorldModel({ ...baseRegistration, strategies: [{ id: "s1", version: "1.0.0", rules: [{ eventType: "tick", actions: [{ kind: "ADD", variable: "", value: 1 }] }] }] }, L), "INVALID_SYSTEM")],
  ["F7-059", () => expectCode(() => registerWorldModel({ ...baseRegistration, strategies: [{ id: "s1", version: "1.0.0", rules: [{ eventType: "", actions: [] }] }] }, L), "INVALID_SYSTEM")],
  ["F7-060", () => { const scenario: ExperimentScenario = { id: "final", hypothesis: "bounded systemic replay", events: [event(), event({ id: "e2", step: 1 })] }; const m = model(); const result = verifyDeterministicSimulation(m, scenario, L); const descriptor = makeSimulationReplayDescriptor(result, scenario); verifySimulationReplayDescriptor(descriptor, m, scenario, result); assert.equal(result.finalState.price, 14); }],
];

for (const [id, run] of cases) test(id, () => { run(); });
assert.equal(cases.length, 60);
