import { describe, expect, it } from "vitest";
import { SeededRandom } from "@mercicat/shared";
import { createInitialState, hashGameState, step } from "../src";
import { ClientReconciler } from "../../client/src/reconciliation";

describe("delayed snapshot reconciliation", () => {
  it("persists RNG and deterministically replays late inputs", () => {
    const run = () => { let server=createInitialState("delay",[1]), rng=new SeededRandom(server.seed); const client=new ClientReconciler(server,{playerId:1}); const snapshots:any[]=[]; const hashes:string[]=[];
      for(let tick=0;tick<100;tick++){const command={type:"move" as const,tick,playerId:1,direction:{x:tick%2?1:0,y:0}}; client.recordInput({sequence:tick,tick,command}); const result=step(server,[command],{rng}); server=result.state; hashes.push(result.stateHash); if(tick%5===4)snapshots.push({tick:server.tick,state:structuredClone(server),stateHash:result.stateHash,rngState:rng.serialize()}); if(snapshots.length>2)client.reconcile(snapshots[snapshots.length-3],tick-10);}
      return {hashes, final:hashGameState(server), rng:rng.serialize()}; };
    const a=run(),b=run(); expect(a.hashes).toEqual(b.hashes); expect(SeededRandom.deserialize(a.rng).serialize()).toBe(a.rng); expect(a.final).toBe(b.final);
  });
});
