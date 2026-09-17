import {
  digest,
  InMemoryProductEvidenceLedger,
  SifProductAdapterRegistry,
  createLaraOsReieAdapter,
  createQadrixAdapter,
  createSovereignLibraryAdapter,
  defaultSifProductAdapterLimits,
  verifySifProductReplay,
  type ProductOperationHandler,
  type SifProductAdapter,
  type SifProductAdapterLimits,
  type SifProductRequest,
  type SifProductResponse,
  type ProductEvidenceRecord,
} from "../../../packages/sif-core/dist/src/index.js";

export interface SifIntegrationEnvelope {
  readonly envelopeVersion: "1.0";
  readonly sourceSystem: string;
  readonly correlationId: string;
  readonly requestedAt: string;
  readonly request: SifProductRequest;
}

export interface SifIntegrationExecution {
  readonly envelopeDigest: string;
  readonly response: SifProductResponse;
  readonly evidence: ProductEvidenceRecord;
  readonly replayVerified: boolean;
}

export interface SifAdoptionLimits extends SifProductAdapterLimits {
  readonly maxProcessedRequests: number;
  readonly maxEnvelopeBytes: number;
}

export class SifAdoptionError extends Error {
  constructor(
    readonly code: "INVALID_ENVELOPE" | "RESOURCE_EXHAUSTED" | "IDEMPOTENCY_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "SifAdoptionError";
  }
}

const DEFAULT_ADOPTION_LIMITS: SifAdoptionLimits = {
  ...defaultSifProductAdapterLimits(),
  maxProcessedRequests: 4096,
  maxEnvelopeBytes: 192 * 1024,
};

function assertText(name: string, value: string): void {
  if (!value.trim()) {
    throw new SifAdoptionError("INVALID_ENVELOPE", `${name} must not be empty`);
  }
}

function assertPositive(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new SifAdoptionError("RESOURCE_EXHAUSTED", `${name} must be positive`);
  }
}

function normalizeEnvelope(
  envelope: SifIntegrationEnvelope,
  limits: SifAdoptionLimits,
): SifIntegrationEnvelope {
  if (envelope.envelopeVersion !== "1.0") {
    throw new SifAdoptionError("INVALID_ENVELOPE", "Unsupported integration envelope version");
  }

  assertText("sourceSystem", envelope.sourceSystem);
  assertText("correlationId", envelope.correlationId);

  if (!Number.isFinite(Date.parse(envelope.requestedAt))) {
    throw new SifAdoptionError("INVALID_ENVELOPE", "requestedAt must be a valid timestamp");
  }

  assertPositive("maxProcessedRequests", limits.maxProcessedRequests);
  assertPositive("maxEnvelopeBytes", limits.maxEnvelopeBytes);

  const normalized: SifIntegrationEnvelope = {
    envelopeVersion: "1.0",
    sourceSystem: envelope.sourceSystem.trim(),
    correlationId: envelope.correlationId.trim(),
    requestedAt: new Date(envelope.requestedAt).toISOString(),
    request: structuredClone(envelope.request),
  };

  const size = new TextEncoder().encode(JSON.stringify(normalized)).byteLength;
  if (size > limits.maxEnvelopeBytes) {
    throw new SifAdoptionError("RESOURCE_EXHAUSTED", "Integration envelope exceeds byte limit");
  }

  return normalized;
}

function validateLimits(limits: SifAdoptionLimits): void {
  for (const [key, value] of Object.entries(limits)) {
    assertPositive(key, value as number);
  }
}

export class SifAdoptionGateway {
  private readonly processed = new Map<string, SifIntegrationExecution>();
  private readonly processing = new Map<string, { envelopeDigest: string; promise: Promise<SifIntegrationExecution> }>();

  constructor(
    readonly registry: SifProductAdapterRegistry = new SifProductAdapterRegistry(),
    readonly evidenceLedger: InMemoryProductEvidenceLedger = new InMemoryProductEvidenceLedger(),
    readonly limits: SifAdoptionLimits = DEFAULT_ADOPTION_LIMITS,
  ) {
    validateLimits(limits);
  }

  register(adapter: SifProductAdapter): void {
    this.registry.register(adapter);
  }

  descriptors() {
    return this.registry.listDescriptors();
  }

  processedRequestCount(): number {
    return this.processed.size;
  }

  async execute(envelopeInput: SifIntegrationEnvelope): Promise<SifIntegrationExecution> {
    const envelope = normalizeEnvelope(envelopeInput, this.limits);
    const envelopeDigest = digest(envelope);
    const key = envelope.request.requestId;

    const previous = this.processed.get(key);
    if (previous) {
      if (previous.envelopeDigest !== envelopeDigest) {
        throw new SifAdoptionError(
          "IDEMPOTENCY_CONFLICT",
          `requestId ${key} was already processed with a different envelope`,
        );
      }
      return structuredClone(previous);
    }

    const inFlight = this.processing.get(key);
    if (inFlight) {
      if (inFlight.envelopeDigest !== envelopeDigest) {
        throw new SifAdoptionError(
          "IDEMPOTENCY_CONFLICT",
          `requestId ${key} is already being processed with a different envelope`,
        );
      }
      return structuredClone(await inFlight.promise);
    }

    if (this.processed.size >= this.limits.maxProcessedRequests) {
      const oldestKey = this.processed.keys().next().value;
      if (oldestKey !== undefined) {
        this.processed.delete(oldestKey);
      }
    }

    const promise = (async (): Promise<SifIntegrationExecution> => {
      const response = await this.registry.dispatch(envelope.request);
      const evidence = this.evidenceLedger.append(response, envelope.requestedAt);
      const replayVerified = response.requestDigest.length > 0;
      if (replayVerified) {
        verifySifProductReplay(envelope.request, response, this.limits);
      }

      const execution: SifIntegrationExecution = {
        envelopeDigest,
        response: structuredClone(response),
        evidence: structuredClone(evidence),
        replayVerified,
      };

      this.processed.set(key, execution);
      return execution;
    })();

    this.processing.set(key, { envelopeDigest, promise });
    try {
      return structuredClone(await promise);
    } finally {
      this.processing.delete(key);
    }
  }
}

export type StandardSifHandlers = Record<string, ProductOperationHandler>;

export function createDefaultSifAdoptionGateway(
  handlers: StandardSifHandlers,
  limits: SifAdoptionLimits = DEFAULT_ADOPTION_LIMITS,
): SifAdoptionGateway {
  const gateway = new SifAdoptionGateway(
    new SifProductAdapterRegistry(limits),
    new InMemoryProductEvidenceLedger(limits.maxLedgerRecords),
    limits,
  );

  gateway.register(createLaraOsReieAdapter(handlers, limits));
  gateway.register(createQadrixAdapter(handlers, limits));
  gateway.register(createSovereignLibraryAdapter(handlers, limits));

  return gateway;
}

export function defaultSifAdoptionLimits(): SifAdoptionLimits {
  return structuredClone(DEFAULT_ADOPTION_LIMITS);
}

export function makeSifIntegrationEnvelope(
  request: SifProductRequest,
  sourceSystem: string,
  correlationId: string,
  requestedAt = request.createdAt,
): SifIntegrationEnvelope {
  return {
    envelopeVersion: "1.0",
    sourceSystem,
    correlationId,
    requestedAt,
    request: structuredClone(request),
  };
}
