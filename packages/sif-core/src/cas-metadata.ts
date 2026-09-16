import type { ISODate } from './types.js';
import { digest } from './core.js';

export interface ArtifactMetadata {
  digest: string;
  mediaType: string;
  size: number;
  createdAt: ISODate;
  source?: string;
  provenanceId?: string;
  labels: Record<string, string>;
}

export class ArtifactMetadataRegistry {
  private readonly entries = new Map<string, ArtifactMetadata>();

  register(input: Omit<ArtifactMetadata, 'digest' | 'createdAt'> & { bytesDigest?: string; createdAt?: ISODate }): ArtifactMetadata {
    const d = input.bytesDigest ?? digest({ mediaType: input.mediaType, size: input.size, source: input.source ?? null, labels: input.labels });
    const metadata: ArtifactMetadata = {
      digest: d,
      mediaType: input.mediaType,
      size: input.size,
      createdAt: input.createdAt ?? new Date().toISOString(),
      ...(input.source === undefined ? {} : { source: input.source }),
      ...(input.provenanceId === undefined ? {} : { provenanceId: input.provenanceId }),
      labels: structuredClone(input.labels)
    };
    this.entries.set(d, metadata);
    return structuredClone(metadata);
  }

  get(d: string): ArtifactMetadata | undefined { const x = this.entries.get(d); return x ? structuredClone(x) : undefined; }
  all(): ArtifactMetadata[] { return [...this.entries.values()].map(x => structuredClone(x)); }
}
