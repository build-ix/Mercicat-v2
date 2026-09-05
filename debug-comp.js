const { calculateThreatBudget, ENEMY_ROLES } = require('@mercicat/content');
const { SeededRandom } = require('@mercicat/shared');

// Manual simulation of the algorithm
const wave = 20, playerCount = 2, difficulty = 2;
let remaining = Math.max(1, Math.round(calculateThreatBudget(wave, playerCount, difficulty) * 1));
const allRoles = Object.keys(ENEMY_ROLES).filter((role) => ENEMY_ROLES[role].unlockWave <= wave).sort();

console.log('Initial budget:', remaining);
console.log('Available roles:', allRoles);

const composition = {};
const rng = new SeededRandom('test-wave-20');

for (let groupNum = 0; groupNum < 3; groupNum++) {
  console.log('\n--- Group', (groupNum + 1), '---');
  if (remaining <= 0) break;
  
  const groupRoles = [...allRoles];
  for (let i = groupRoles.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [groupRoles[i], groupRoles[j]] = [groupRoles[j], groupRoles[i]];
  }
  console.log('Shuffled:', groupRoles.join(', '));
  
  const groupComposition = {};
  const affordablePairs = [];
  
  for (let i = 0; i < groupRoles.length; i++) {
    for (let j = i + 1; j < groupRoles.length; j++) {
      if (ENEMY_ROLES[groupRoles[i]].threatCost + ENEMY_ROLES[groupRoles[j]].threatCost <= remaining) {
        affordablePairs.push([groupRoles[i], groupRoles[j]]);
      }
    }
  }
  
  console.log('Affordable pairs:', affordablePairs.length);
  
  let groupRemaining = remaining;
  if (affordablePairs.length > 0) {
    const idx = rng.nextInt(0, affordablePairs.length - 1);
    const [first, second] = affordablePairs[idx];
    groupComposition[first] = 1;
    groupComposition[second] = 1;
    groupRemaining -= ENEMY_ROLES[first].threatCost + ENEMY_ROLES[second].threatCost;
    console.log('Pair:', first, '+', second, 'cost:', ENEMY_ROLES[first].threatCost + ENEMY_ROLES[second].threatCost);
    console.log('Remaining after pair:', groupRemaining);
  }
  
  let fillCount = 0;
  while (groupRemaining > 0 && fillCount < 20) {
    const affordable = groupRoles.filter(
      (role) => ENEMY_ROLES[role].threatCost <= groupRemaining && (groupComposition[role] ?? 0) < 2
    );
    if (!affordable.length) {
      console.log('No more affordable roles at', fillCount, 'fills, groupRemaining:', groupRemaining);
      break;
    }
    
    const totalWeight = affordable.reduce((sum, role) => sum + ENEMY_ROLES[role].spawnWeight, 0);
    let roll = rng.nextFloat() * totalWeight;
    let selected = affordable[affordable.length - 1];
    for (const role of affordable) {
      roll -= ENEMY_ROLES[role].spawnWeight;
      if (roll < 0) { selected = role; break; }
    }
    
    groupRemaining -= ENEMY_ROLES[selected].threatCost;
    groupComposition[selected] = (groupComposition[selected] ?? 0) + 1;
    fillCount++;
  }
  
  const groupSpent = Object.entries(groupComposition).reduce(
    (sum, [role, count]) => sum + ENEMY_ROLES[role].threatCost * count, 0
  );
  console.log('Group composition:', groupComposition);
  console.log('Group spent:', groupSpent);
  remaining -= groupSpent;
  console.log('Total remaining:', remaining);
  
  for (const role of allRoles) {
    if (groupComposition[role]) {
      composition[role] = (composition[role] ?? 0) + groupComposition[role];
    }
  }
  
  if (groupSpent === 0) {
    console.log('Group spent 0 - stopping');
    break;
  }
}

console.log('\nFinal:', composition);
const totalSpent = Object.entries(composition).reduce((sum, [role, count]) => sum + ENEMY_ROLES[role].threatCost * count, 0);
console.log('Total spent:', totalSpent);
console.log('Budget was:', calculateThreatBudget(wave, playerCount, difficulty));
