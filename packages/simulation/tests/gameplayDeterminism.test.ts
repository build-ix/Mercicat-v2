import { describe, expect, it } from "vitest";
import { createInitialState, hashGameState, step } from "../src";
import { SeededRandom } from "@mercicat/shared";
function run(fireOffset=0){let s=createInitialState("gameplay",[1,2]),r=new SeededRandom(s.seed), hashes:string[]=[]; for(let t=0;t<320;t++){const c:any[]=[]; if((t+fireOffset)%8===0)c.push({type:"fire",tick:t,playerId:1,direction:{x:1,y:0}}); if(t%6<3)c.push({type:"move",tick:t,playerId:2,direction:{x:1,y:0}}); const x=step(s,c,{rng:r});s=x.state;hashes.push(x.stateHash);} return {s,hashes};}
describe("gameplay determinism",()=>{it("matches byte-for-byte for identical inputs",()=>{const a=run(),b=run();expect(a.hashes).toEqual(b.hashes);expect(hashGameState(a.s)).toBe(hashGameState(b.s));});it("fire input affects simulation",()=>{expect(run().hashes).not.toEqual(run(1).hashes);});});
