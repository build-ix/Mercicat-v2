import { SeededRandom } from "@mercicat/shared";
export class DeterministicScheduler { readonly rng: SeededRandom; constructor(seed = 1) { this.rng = new SeededRandom(seed); } }
