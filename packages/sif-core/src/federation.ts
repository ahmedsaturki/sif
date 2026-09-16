import type { AuthorityGrant } from "./types.js";
import { AuthorizationError, cryptoRandomId, now } from "./core.js";
export interface FederatedMessage{messageId:string;originDomain:string;targetDomain:string;protocol:string;schemaVersion:string;payloadDigest:string;createdAt:string;expiresAt:string;correlationId:string;requestedCapability?:string;}
export interface FederationPolicy{localDomain:string;trustedRemoteDomains:Set<string>;allowedCapabilities:Set<string>;}

/**
 * @deprecated Legacy compatibility admission helper.
 *
 * This API predates the Phase 3 Secure Federation boundary and is intentionally
 * retained for source compatibility only. It must not be used as proof of
 * authenticated transport identity, signed-message validity, negotiated
 * capability scope, durable replay safety, or production federation trust.
 * Use the Phase 3 federation envelope/trust/capability/admission APIs instead.
 */
export class FederationAdmission{constructor(private readonly policy:FederationPolicy){}admit(message:FederatedMessage,authority?:AuthorityGrant):void{if(message.targetDomain!==this.policy.localDomain)throw new AuthorizationError("Message target is not this local domain");if(!this.policy.trustedRemoteDomains.has(message.originDomain))throw new AuthorizationError("Origin domain is not trusted");if(Date.parse(message.expiresAt)<=Date.parse(message.createdAt))throw new AuthorizationError("Federated message expiry must be after creation");if(Date.parse(message.expiresAt)<Date.now())throw new AuthorizationError("Federated message has expired");if(message.requestedCapability&&!this.policy.allowedCapabilities.has(message.requestedCapability))throw new AuthorizationError("Requested capability is not admitted by local federation policy");if(authority&&message.requestedCapability&&!authority.capabilities.includes(message.requestedCapability))throw new AuthorizationError("Delegated authority does not cover requested capability");}makeMessage(args:Omit<FederatedMessage,"messageId"|"createdAt">):FederatedMessage{return{...args,messageId:cryptoRandomId(),createdAt:now()};}}
