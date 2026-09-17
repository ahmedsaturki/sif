import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { AuthorityRegistry, CapabilityRegistry, ConcurrencyError, EvidenceRegistry, GovernedExecutor, InMemoryEventStore, IntegrityError, KnowledgeRegistry, LineageRegistry, Projection, ReconstructionVerifier, SemanticRegistry, SifEventWriter, digest, stableStringify } from "../src/index.js";

test("append-only event store enforces optimistic concurrency and replay", () => {
  const store = new InMemoryEventStore(); const writer = new SifEventWriter(store);
  const e1 = writer.write({ streamId: "task:1", eventType: "TaskCreated", actorId: "a", correlationId: "c", payload: { status: "new" } });
  const e2 = writer.write({ streamId: "task:1", eventType: "TaskCompleted", actorId: "a", correlationId: "c", causationId: e1.eventId, payload: { status: "done" } });
  assert.equal(e2.streamVersion, 2); assert.equal(store.read("task:1").length, 2);
  assert.throws(() => store.append({ ...e2, eventId: "bad", streamVersion: 2 }, { expectedStreamVersion: 1 }), ConcurrencyError);
  const projection = new Projection(() => ({ status: "none" as string }), (s, e) => ({ status: String((e.payload as { status?: unknown }).status ?? s.status) }));
  assert.deepEqual(projection.rebuild(store.read("task:1")), { status: "done" });
});

test("evidence and knowledge require qualified provenance", () => {
  const evidence = new EvidenceRegistry(); evidence.register({ evidenceId: "ev1", sourceId: "src1", digest: digest("hello"), capturedAt: new Date().toISOString(), scope: "test", confidence: 0.9 });
  const knowledge = new KnowledgeRegistry();
  assert.throws(() => knowledge.put({ knowledgeId: "k1", kind: "fact", statement: "x", status: "observed", scope: "test", validFrom: new Date().toISOString(), evidence: [], provenance: { provenanceId: "p", sourceIds: [], activity: "test", actorId: "a", capturedAt: new Date().toISOString(), parentIds: [] }, parentKnowledgeIds: [] }), IntegrityError);
  knowledge.put({ knowledgeId: "k1", kind: "fact", statement: "x", status: "observed", scope: "test", validFrom: new Date().toISOString(), evidence: [evidence.get("ev1")!], provenance: { provenanceId: "p", sourceIds: ["src1"], activity: "capture", actorId: "a", capturedAt: new Date().toISOString(), parentIds: [] }, parentKnowledgeIds: [] });
  assert.equal(knowledge.get("k1")?.evidence[0]?.evidenceId, "ev1");
});

test("semantic registry keeps concepts versioned and mappings explicit", () => {
  const semantics = new SemanticRegistry(); semantics.registerConcept({ conceptId: "active", namespace: "sif:test", version: "1.0", label: "active", definition: "eligible for operation" }); semantics.registerConcept({ conceptId: "active", namespace: "sif:test", version: "2.0", label: "active", definition: "accepted but not necessarily executable" }); semantics.registerMapping({ mappingId: "m1", fromConceptId: "active@1", toConceptId: "active@2", relation: "conditional", confidence: 0.7, provenanceId: "p1" });
  assert.equal(semantics.allConcepts().length, 2); assert.equal(semantics.mapping("m1")?.relation, "conditional");
});

test("delegation cannot increase authority and cannot outlive parent", () => {
  const auth = new AuthorityRegistry(); auth.grant({ grantId: "g1", subjectId: "root", scope: "local", capabilities: ["read", "write"], issuedAt: "2026-01-01T00:00:00.000Z", expiresAt: "2026-12-31T00:00:00.000Z", issuerId: "system" }); auth.grant({ grantId: "g2", subjectId: "child", scope: "local", capabilities: ["read"], issuedAt: "2026-02-01T00:00:00.000Z", expiresAt: "2026-11-01T00:00:00.000Z", issuerId: "root", parentGrantId: "g1" });
  assert.equal(auth.can("child", "read", "2026-03-01T00:00:00.000Z"), true); assert.equal(auth.can("child", "write", "2026-03-01T00:00:00.000Z"), false); assert.throws(() => auth.grant({ grantId: "g3", subjectId: "child2", scope: "local", capabilities: ["admin"], issuedAt: "2026-02-01T00:00:00.000Z", issuerId: "root", parentGrantId: "g1" })); assert.throws(() => auth.grant({ grantId: "g4", subjectId: "child3", scope: "local", capabilities: ["read"], issuedAt: "2026-02-01T00:00:00.000Z", issuerId: "root", parentGrantId: "g1" }), /must not outlive its parent/);
});

test("canonical stringify is stable across equivalent insertion order and non-ASCII keys", () => { assert.equal(stableStringify({ z: 1, "ä": 2, a: 3 }), stableStringify({ "ä": 2, a: 3, z: 1 })); });

test("capability is usable only when all gates are healthy", () => { const caps = new CapabilityRegistry(); caps.register({ capabilityId: "browser", name: "Browser", version: "1", available: true, usable: true, verified: true, authorized: true, healthy: true }); caps.register({ capabilityId: "gpu", name: "GPU", version: "1", available: true, usable: true, verified: true, authorized: false, healthy: true }); assert.equal(caps.usable("browser"), true); assert.equal(caps.usable("gpu"), false); });

test("lineage requires valid parents and reconstruction is evidence-gated", () => {
  const lineage = new LineageRegistry(); lineage.add({ nodeId: "n1", identityId: "sif", kind: "birth", createdAt: new Date().toISOString(), evidenceIds: ["ev"] }); lineage.add({ nodeId: "n2", identityId: "sif", parentNodeId: "n1", kind: "reconstruction", createdAt: new Date().toISOString(), evidenceIds: ["ev2"] }); assert.equal(lineage.childrenOf("n1").length, 1);
  const store = new InMemoryEventStore(); new SifEventWriter(store).write({ streamId: "sif", eventType: "Bootstrapped", actorId: "root", correlationId: "c", payload: { ok: true } });
  const semantics = new SemanticRegistry(); semantics.registerConcept({ conceptId: "health", namespace: "sif", version: "1", label: "health", definition: "runtime health state" }); const auth = new AuthorityRegistry(); auth.grant({ grantId: "root", subjectId: "sif", scope: "local", capabilities: ["recover"], issuedAt: "2026-01-01T00:00:00.000Z", issuerId: "system" });
  const result = new ReconstructionVerifier().verify({ identityId: "sif", artifactDigests: ["a"], eventStreams: ["sif"], trustAnchors: ["t"], policyVersion: "p1", semanticRegistryVersion: "s1" }, store, semantics, auth); assert.equal(result.passed, true);
});

test("governed execution requires both capability health and scoped authority", () => { const caps = new CapabilityRegistry(); caps.register({ capabilityId: "write", name: "Write", version: "1", available: true, usable: true, verified: true, authorized: true, healthy: true }); const auth = new AuthorityRegistry(); auth.grant({ grantId: "g", subjectId: "agent", scope: "workspace/tasks", capabilities: ["write"], issuedAt: "2026-01-01T00:00:00.000Z", issuerId: "root" }); const exec = new GovernedExecutor(auth, caps); assert.equal(exec.execute({ subjectId: "agent", capabilityId: "write", scope: "workspace/tasks/1", action: () => 42, at: "2026-03-01T00:00:00.000Z" }), 42); assert.throws(() => exec.execute({ subjectId: "agent", capabilityId: "write", scope: "admin", action: () => 1, at: "2026-03-01T00:00:00.000Z" }), /lacks authority/); });

test("persistent JSONL store reloads and preserves event order", async () => { const path = "/tmp/sif-core-test/events.jsonl"; try { rmSync("/tmp/sif-core-test", { recursive: true, force: true }); } catch {} mkdirSync("/tmp/sif-core-test", { recursive: true }); const { PersistentJsonlEventStore } = await import("../src/persistence.js"); const first = new PersistentJsonlEventStore(path); const writer = new SifEventWriter(first); writer.write({ streamId: "s", eventType: "A", actorId: "a", correlationId: "c", payload: { n: 1 } }); writer.write({ streamId: "s", eventType: "B", actorId: "a", correlationId: "c", payload: { n: 2 } }); const second = new PersistentJsonlEventStore(path); assert.equal(second.streamVersion("s"), 2); assert.equal((second.read("s")[1]?.payload as { n: number }).n, 2); });

test("federation admission is local-policy gated", async () => { const { FederationAdmission } = await import("../src/federation.js"); const admission = new FederationAdmission({ localDomain: "A", trustedRemoteDomains: new Set(["B"]), allowedCapabilities: new Set(["read"]) }); const message = admission.makeMessage({ targetDomain: "A", originDomain: "B", protocol: "sif/federation", schemaVersion: "1", payloadDigest: "x", expiresAt: new Date(Date.now() + 60000).toISOString(), correlationId: "c", requestedCapability: "read" }); assert.doesNotThrow(() => admission.admit(message)); assert.throws(() => admission.admit({ ...message, originDomain: "C" }), /not trusted/); });

test("self-model verifier detects drift from actual capabilities", async () => { const { StaticSelfModelVerifier } = await import("../src/self-model.js"); const actual = new Map([["browser", { capabilityId: "browser", name: "Browser", version: "1", available: true, usable: true, verified: true, authorized: true, healthy: true }]]); const verifier = new StaticSelfModelVerifier(actual); const result = verifier.verify({ identityId: "sif", version: "1", updatedAt: new Date().toISOString(), declaredAuthorityScopes: [], knownLimitations: [], capabilities: [{ capabilityId: "browser", name: "Browser", version: "1", available: true, usable: true, verified: true, authorized: true, healthy: false }] }); assert.equal(result.ok, false); assert.deepEqual(result.mismatches, ["healthy:browser"]); });


test("filesystem CAS writes and verifies immutable content", async () => { const { FileCas } = await import("../src/cas.js"); const { mkdirSync, rmSync } = await import("node:fs"); const root = `.ci/sif-cas-${Date.now()}-${Math.random().toString(16).slice(2)}`; mkdirSync(root, { recursive: true }); try { const cas = new FileCas(root); const bytes = new TextEncoder().encode("sif-cas-test"); const digest = cas.putBytes(bytes); assert.equal(cas.has(digest), true); assert.equal(new TextDecoder().decode(cas.getBytes(digest)), "sif-cas-test"); assert.doesNotThrow(() => cas.verify(digest)); } finally { rmSync(root, { recursive: true, force: true }); } });