import { digest, stableStringify } from "./core.js";

export interface SystemicSimulationLimits {
  maxAgents: number;
  maxStrategies: number;
  maxInstitutions: number;
  maxResourcesPerAgent: number;
  maxOrdersPerTick: number;
  maxEvents: number;
  maxTicks: number;
  maxPayloadBytes: number;
  maxEvidenceRefs: number;
}

export interface SimulationAgent {
  agentId: string;
  kind: "agent" | "player";
  label: string;
  resources: Record<string, number>;
  strategyId: string;
  createdAt: string;
}

export interface SimulationStrategy {
  strategyId: string;
  name: string;
  parameters: Record<string, number | string | boolean>;
}

export interface SimulationStrategyTransition {
  transitionId: string;
  tick: number;
  agentId: string;
  fromStrategyId: string;
  toStrategyId: string;
  reason: string;
}

export interface SimulationInstitution {
  institutionId: string;
  label: string;
  scope: string;
  roleIds: string[];
  policyRefs: string[];
}

export interface SimulationOrder {
  orderId: string;
  agentId: string;
  side: "BUY" | "SELL";
  resource: string;
  quantity: number;
  limitPrice: number;
  submittedTick: number;
}

export interface SimulationTrade {
  tradeId: string;
  buyOrderId: string;
  sellOrderId: string;
  resource: string;
  quantity: number;
  price: number;
  tick: number;
}

export interface SimulationEvent {
  eventId: string;
  sequence: number;
  tick: number;
  type: "AGENT_CREATED" | "STRATEGY_REGISTERED" | "STRATEGY_CHANGED" | "INSTITUTION_REGISTERED" | "RESOURCE_MOVED" | "ORDER_SUBMITTED" | "TRADE_CLEARED" | "SCENARIO_INPUT";
  payload: unknown;
}

export interface SimulationEvidenceRef {
  evidenceId: string;
  source: "KNOWLEDGE" | "POLICY" | "FEDERATION" | "EVALUATION" | "SCENARIO";
  digest: string;
}

export interface SimulationScenario {
  simulationId: string;
  seed: string;
  environment: string;
  initialState: Record<string, unknown>;
  evidenceRefs?: SimulationEvidenceRef[];
}

export interface SimulationSnapshot {
  simulationId: string;
  tick: number;
  agents: SimulationAgent[];
  strategies: SimulationStrategy[];
  institutions: SimulationInstitution[];
  openOrders: SimulationOrder[];
  trades: SimulationTrade[];
  snapshotDigest: string;
}

export class SystemicSimulationError extends Error {
  constructor(readonly code: "INVALID_INPUT" | "RESOURCE_EXHAUSTED" | "STATE_CONFLICT" | "REPLAY_MISMATCH" | "AUTHORITY_BOUNDARY", message: string) {
    super(message);
    this.name = "SystemicSimulationError";
  }
}

const DEFAULT_LIMITS: SystemicSimulationLimits = { maxAgents: 100, maxStrategies: 100, maxInstitutions: 50, maxResourcesPerAgent: 32, maxOrdersPerTick: 1000, maxEvents: 10000, maxTicks: 1000, maxPayloadBytes: 1000000, maxEvidenceRefs: 64 };
const clone=<T>(x:T):T=>structuredClone(x);
const bytes=(x:unknown)=>new TextEncoder().encode(stableStringify(x)).byteLength;
const text=(n:string,v:string)=>{if(!v)throw new SystemicSimulationError("INVALID_INPUT",`${n} must not be empty`)};
const positive=(n:string,v:number)=>{if(!Number.isSafeInteger(v)||v<=0)throw new SystemicSimulationError("RESOURCE_EXHAUSTED",`${n} must be positive`)};
const nonNegative=(n:string,v:number)=>{if(!Number.isFinite(v)||v<0)throw new SystemicSimulationError("STATE_CONFLICT",`${n} must be non-negative`)};

export function normalizeSystemicSimulationLimits(overrides:Partial<SystemicSimulationLimits>={}):SystemicSimulationLimits {
  const x={...DEFAULT_LIMITS,...overrides};
  positive("maxAgents",x.maxAgents);positive("maxStrategies",x.maxStrategies);positive("maxInstitutions",x.maxInstitutions);positive("maxResourcesPerAgent",x.maxResourcesPerAgent);positive("maxOrdersPerTick",x.maxOrdersPerTick);positive("maxEvents",x.maxEvents);positive("maxTicks",x.maxTicks);positive("maxPayloadBytes",x.maxPayloadBytes);positive("maxEvidenceRefs",x.maxEvidenceRefs);return x;
}

export class DeterministicSystemicSimulation {
  private tickValue=0;
  private readonly agents=new Map<string,SimulationAgent>();
  private readonly strategies=new Map<string,SimulationStrategy>();
  private readonly institutions=new Map<string,SimulationInstitution>();
  private readonly orders=new Map<string,SimulationOrder>();
  private readonly trades=new Map<string,SimulationTrade>();
  private readonly events:SimulationEvent[]=[];
  private orderCountThisTick=0;
  private readonly scenario:SimulationScenario;
  constructor(scenario:SimulationScenario,private readonly limits:SystemicSimulationLimits=normalizeSystemicSimulationLimits()){
    text("simulationId",scenario.simulationId);text("seed",scenario.seed);text("environment",scenario.environment);
    if((scenario.evidenceRefs?.length??0)>limits.maxEvidenceRefs)throw new SystemicSimulationError("RESOURCE_EXHAUSTED","Evidence reference limit exceeded");
    if(bytes(scenario)>limits.maxPayloadBytes)throw new SystemicSimulationError("RESOURCE_EXHAUSTED","Scenario exceeds payload limit");
    this.scenario=clone(scenario);
  }
  get tick():number{return this.tickValue}
  private append(type:SimulationEvent["type"],payload:unknown,tick=this.tickValue):SimulationEvent{
    if(this.events.length>=this.limits.maxEvents)throw new SystemicSimulationError("RESOURCE_EXHAUSTED","Simulation event limit exceeded");
    const canonical={sequence:this.events.length+1,tick,type,payload:clone(payload)};
    if(bytes(canonical)>this.limits.maxPayloadBytes)throw new SystemicSimulationError("RESOURCE_EXHAUSTED","Simulation event exceeds payload limit");
    const event={eventId:digest({simulationId:this.scenario.simulationId,previous:this.events.at(-1)?.eventId??null,canonical}),...canonical};this.events.push(clone(event));return clone(event);
  }
  registerStrategy(strategy:SimulationStrategy):SimulationStrategy{
    text("strategyId",strategy.strategyId);text("name",strategy.name);if(this.strategies.size>=this.limits.maxStrategies&&!this.strategies.has(strategy.strategyId))throw new SystemicSimulationError("RESOURCE_EXHAUSTED","Strategy limit exceeded");
    const existing=this.strategies.get(strategy.strategyId);if(existing){if(digest(existing)!==digest(strategy))throw new SystemicSimulationError("STATE_CONFLICT","Strategy identity is immutable");return clone(existing)}
    this.strategies.set(strategy.strategyId,clone(strategy));this.append("STRATEGY_REGISTERED",strategy);return clone(strategy);
  }
  createAgent(agent:SimulationAgent):SimulationAgent{
    text("agentId",agent.agentId);text("label",agent.label);text("strategyId",agent.strategyId);if(!this.strategies.has(agent.strategyId))throw new SystemicSimulationError("INVALID_INPUT","Agent strategy is not registered");
    if(Object.keys(agent.resources).length>this.limits.maxResourcesPerAgent)throw new SystemicSimulationError("RESOURCE_EXHAUSTED","Agent resource bound exceeded");for(const v of Object.values(agent.resources))nonNegative("resource",v);
    if(this.agents.has(agent.agentId))throw new SystemicSimulationError("STATE_CONFLICT","Agent identity already exists");if(this.agents.size>=this.limits.maxAgents)throw new SystemicSimulationError("RESOURCE_EXHAUSTED","Agent population limit exceeded");
    const x=clone(agent);this.agents.set(x.agentId,x);this.append("AGENT_CREATED",x);return clone(x);
  }
  registerInstitution(institution:SimulationInstitution):SimulationInstitution{
    text("institutionId",institution.institutionId);text("label",institution.label);text("scope",institution.scope);if(this.institutions.has(institution.institutionId))throw new SystemicSimulationError("STATE_CONFLICT","Institution identity already exists");if(this.institutions.size>=this.limits.maxInstitutions)throw new SystemicSimulationError("RESOURCE_EXHAUSTED","Institution limit exceeded");
    const x=clone(institution);x.roleIds=[...new Set(x.roleIds)].sort();x.policyRefs=[...new Set(x.policyRefs)].sort();this.institutions.set(x.institutionId,x);this.append("INSTITUTION_REGISTERED",x);return clone(x);
  }
  changeStrategy(agentId:string,toStrategyId:string,reason:string):SimulationStrategyTransition{
    text("agentId",agentId);text("toStrategyId",toStrategyId);text("reason",reason);const agent=this.agents.get(agentId);if(!agent)throw new SystemicSimulationError("INVALID_INPUT","Agent not found");if(!this.strategies.has(toStrategyId))throw new SystemicSimulationError("INVALID_INPUT","Target strategy not registered");
    const from=agent.strategyId;if(from===toStrategyId)throw new SystemicSimulationError("STATE_CONFLICT","Strategy transition does not change state");agent.strategyId=toStrategyId;const transition={transitionId:digest({tick:this.tickValue,agentId,fromStrategyId:from,toStrategyId,reason}),tick:this.tickValue,agentId,fromStrategyId:from,toStrategyId,reason};this.append("STRATEGY_CHANGED",transition);return clone(transition);
  }
  moveResource(agentId:string,resource:string,delta:number):void{
    text("agentId",agentId);text("resource",resource);if(!Number.isFinite(delta)||delta===0)throw new SystemicSimulationError("INVALID_INPUT","delta must be finite and non-zero");const agent=this.agents.get(agentId);if(!agent)throw new SystemicSimulationError("INVALID_INPUT","Agent not found");const next=(agent.resources[resource]??0)+delta;if(next<0)throw new SystemicSimulationError("STATE_CONFLICT","Insufficient resource");if(agent.resources[resource]===undefined&&Object.keys(agent.resources).length>=this.limits.maxResourcesPerAgent)throw new SystemicSimulationError("RESOURCE_EXHAUSTED","Agent resource bound exceeded");agent.resources[resource]=next;this.append("RESOURCE_MOVED",{agentId,resource,delta});
  }
  submitOrder(order:SimulationOrder):SimulationOrder{
    text("orderId",order.orderId);text("agentId",order.agentId);text("resource",order.resource);nonNegative("quantity",order.quantity);if(order.quantity<=0)throw new SystemicSimulationError("INVALID_INPUT","quantity must be positive");if(!Number.isFinite(order.limitPrice)||order.limitPrice<=0)throw new SystemicSimulationError("INVALID_INPUT","limitPrice must be positive");if(!this.agents.has(order.agentId))throw new SystemicSimulationError("INVALID_INPUT","Order agent not found");if(this.orderCountThisTick>=this.limits.maxOrdersPerTick)throw new SystemicSimulationError("RESOURCE_EXHAUSTED","Order-per-tick limit exceeded");if(this.orders.has(order.orderId))throw new SystemicSimulationError("STATE_CONFLICT","Order identity already exists");
    const x={...clone(order),submittedTick:this.tickValue};this.orders.set(x.orderId,x);this.orderCountThisTick+=1;this.append("ORDER_SUBMITTED",x);return clone(x);
  }
  clearMarket(resource:string):SimulationTrade[]{
    text("resource",resource);const buys=[...this.orders.values()].filter(o=>o.resource===resource&&o.side==="BUY").sort((a,b)=>b.limitPrice-a.limitPrice||a.submittedTick-b.submittedTick||a.orderId.localeCompare(b.orderId));const sells=[...this.orders.values()].filter(o=>o.resource===resource&&o.side==="SELL").sort((a,b)=>a.limitPrice-b.limitPrice||a.submittedTick-b.submittedTick||a.orderId.localeCompare(b.orderId));const trades:SimulationTrade[]=[];let i=0,j=0;
    while(i<buys.length&&j<sells.length){const buy=buys[i]!,sell=sells[j]!;if(buy.limitPrice<sell.limitPrice)break;const quantity=Math.min(buy.quantity,sell.quantity);const price=(buy.limitPrice+sell.limitPrice)/2;const trade={tradeId:digest({tick:this.tickValue,buyOrderId:buy.orderId,sellOrderId:sell.orderId,resource,quantity,price}),buyOrderId:buy.orderId,sellOrderId:sell.orderId,resource,quantity,price,tick:this.tickValue};this.trades.set(trade.tradeId,trade);trades.push(clone(trade));this.append("TRADE_CLEARED",trade);buy.quantity-=quantity;sell.quantity-=quantity;if(buy.quantity===0){this.orders.delete(buy.orderId);i+=1}if(sell.quantity===0){this.orders.delete(sell.orderId);j+=1}}
    return trades;
  }
  scenarioInput(payload:unknown):SimulationEvent{return this.append("SCENARIO_INPUT",payload)}
  advanceTick():SimulationSnapshot{if(this.tickValue>=this.limits.maxTicks)throw new SystemicSimulationError("RESOURCE_EXHAUSTED","Tick limit exceeded");this.tickValue+=1;this.orderCountThisTick=0;return this.snapshot()}
  snapshot():SimulationSnapshot{const base={simulationId:this.scenario.simulationId,tick:this.tickValue,agents:[...this.agents.values()].sort((a,b)=>a.agentId.localeCompare(b.agentId)),strategies:[...this.strategies.values()].sort((a,b)=>a.strategyId.localeCompare(b.strategyId)),institutions:[...this.institutions.values()].sort((a,b)=>a.institutionId.localeCompare(b.institutionId)),openOrders:[...this.orders.values()].sort((a,b)=>a.orderId.localeCompare(b.orderId)),trades:[...this.trades.values()].sort((a,b)=>a.tradeId.localeCompare(b.tradeId))};return {...clone(base),snapshotDigest:digest(base)}}
  eventsAll():SimulationEvent[]{return this.events.map(clone)}
  evidence():SimulationEvidenceRef[]{return clone(this.scenario.evidenceRefs??[])}
  assertNoAuthorityWidening():never{throw new SystemicSimulationError("AUTHORITY_BOUNDARY","Simulation state never grants or widens SIF authority")}
  replay():SimulationSnapshot{const cloneSim=new DeterministicSystemicSimulation(this.scenario,this.limits);for(const event of this.events){switch(event.type){case "STRATEGY_REGISTERED":cloneSim.registerStrategy(event.payload as SimulationStrategy);break;case "AGENT_CREATED":cloneSim.createAgent(event.payload as SimulationAgent);break;case "INSTITUTION_REGISTERED":cloneSim.registerInstitution(event.payload as SimulationInstitution);break;case "STRATEGY_CHANGED":{const p=event.payload as SimulationStrategyTransition;cloneSim.changeStrategy(p.agentId,p.toStrategyId,p.reason);break}case "RESOURCE_MOVED":{const p=event.payload as {agentId:string;resource:string;delta:number};cloneSim.moveResource(p.agentId,p.resource,p.delta);break}case "ORDER_SUBMITTED":cloneSim.submitOrder(event.payload as SimulationOrder);break;case "TRADE_CLEARED":break;case "SCENARIO_INPUT":cloneSim.scenarioInput(event.payload);break;case "AGENT_CREATED":break;}}for(const _ of Array.from({length:this.tickValue},()=>0))cloneSim.advanceTick();const snap=cloneSim.snapshot();if(stableStringify(snap)!==stableStringify(this.snapshot()))throw new SystemicSimulationError("REPLAY_MISMATCH","Simulation replay diverged");return snap}
}
