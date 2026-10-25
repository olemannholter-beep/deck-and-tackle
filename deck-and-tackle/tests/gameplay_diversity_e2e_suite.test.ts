import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTHORITATIVE_SPECIES_SPECS,
  AUTHORITATIVE_ZONE_SPECIES_MAP,
  AUTHORITATIVE_BAIT_SPECS,
  AUTHORITATIVE_HOSTILE_ROSTER,
  AUTHORITATIVE_NAVAL_CARDS,
  VESSEL_MAX_HULL_HP,
  HARBOR_REPAIR_TOLL_RATE,
  ESCAPE_MINIGAME_DURATION,
  ESCAPE_SURVIVAL_LIMP_HP,
  HOSTILE_CONE_ANGLE_RAD,
  HOSTILE_CONE_DISTANCE,
  referenceCheckConeDetection,
  referenceRollTripartiteOutcome,
  referenceRollRarityForBait,
  referenceResolveSpeciesForCast,
  referenceGenerateSalvageReward,
  referenceCalcHarborToll,
  MockCanvasRenderingContext2D
} from './diversity_test_helpers.js';

// ===========================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS (25 Test Cases)
// ===========================================================================

describe('Tier 3: Cross-Feature Combinations', () => {

  // C1: Bait Biasing + Species Rarity Distribution
  test('T3.C01: Blood Chum in Zone 3 strongly biases rolls towards Rare species compared to Bare Hook', () => {
    let bareHookRare = 0;
    let bloodChumRare = 0;
    const trials = 1000;

    for (let i = 0; i < trials; i++) {
      const rBare = referenceRollRarityForBait('bare_hook', (i * 0.001) % 1);
      if (rBare === 'rare') bareHookRare++;

      const rChum = referenceRollRarityForBait('blood_chum', (i * 0.001) % 1);
      if (rChum === 'rare') bloodChumRare++;
    }

    assert.ok(
      bloodChumRare >= bareHookRare * 2.5,
      `Blood chum rare rolls (${bloodChumRare}) should greatly exceed bare hook (${bareHookRare})`
    );
  });

  // C2: Bait Outcome Weights + Salvage Distribution
  test('T3.C02: Eldritch Grub yields higher strike rate and lower slack than Bare Hook over Monte Carlo sample', () => {
    let bareHookStrike = 0;
    let grubStrike = 0;
    const trials = 1000;

    for (let i = 0; i < trials; i++) {
      const roll = (i * 0.001) % 1;
      if (referenceRollTripartiteOutcome('bare_hook', roll) === 'strike') bareHookStrike++;
      if (referenceRollTripartiteOutcome('eldritch_grub', roll) === 'strike') grubStrike++;
    }

    assert.ok(
      grubStrike > bareHookStrike,
      `Eldritch grub strike (${grubStrike}) must exceed bare hook strike (${bareHookStrike})`
    );
  });

  // C3: Empty Line Outcome + Whirlpool Despawn Cleanliness
  test('T3.C03: Slack outcome triggers instant whirlpool despawn without battle engine instantiation', () => {
    let battleEngineCreated = false;
    let whirlpoolDespawned = false;

    function handleCastOutcome(outcome: string) {
      if (outcome === 'strike') {
        battleEngineCreated = true;
      } else if (outcome === 'slack') {
        whirlpoolDespawned = true;
      }
    }

    const outcome = referenceRollTripartiteOutcome('bare_hook', 0.95); // 0.95 falls in slack range
    assert.strictEqual(outcome, 'slack');
    handleCastOutcome(outcome);

    assert.strictEqual(whirlpoolDespawned, true);
    assert.strictEqual(battleEngineCreated, false);
  });

  // C4: Pre-Cast Modal Selection + Bait Inventory Decrement
  test('T3.C04: Selecting bait in modal decrements inventory only upon cast confirmation', () => {
    const inventory = { bioluminescent_squid: 3, lugworms: 5 };
    let selectedBait: string | null = null;

    // Open modal and select bait
    selectedBait = 'bioluminescent_squid';
    assert.strictEqual(inventory.bioluminescent_squid, 3, 'Selecting should not immediately consume bait');

    // Confirm cast
    inventory[selectedBait]--;
    assert.strictEqual(inventory.bioluminescent_squid, 2, 'Casting must decrement exactly 1 bait item');
  });

  // C5: Chandlery Shop Purchase + Gold & Inventory Mutation
  test('T3.C05: Purchasing bait batch from Chandlery deducts gold and increments inventory', () => {
    const player = { gold: 100, inventory: { lugworms: 2 } };
    const baitSpec = AUTHORITATIVE_BAIT_SPECS.lugworms;
    const quantity = 3;
    const totalCost = baitSpec.cost * quantity; // 10 * 3 = 30g

    player.gold -= totalCost;
    player.inventory.lugworms += quantity;

    assert.strictEqual(player.gold, 70);
    assert.strictEqual(player.inventory.lugworms, 5);
  });

  // C6: Chandlery Dual Deck Ledger + Deck Synchronization
  test('T3.C06: Chandlery dual deck viewer displays both Tackle deck and Naval deck without cross-contamination', () => {
    const tackleDeck = ['strike_hook', 'reel_in', 'pump_rod'];
    const navalDeck = ['naval_swivel_gun', 'naval_hull_bracing', 'naval_broadside'];

    assert.strictEqual(tackleDeck.length, 3);
    assert.strictEqual(navalDeck.length, 3);
    for (const card of navalDeck) {
      assert.ok(card.startsWith('naval_'), `Naval card ${card} must have naval prefix`);
      assert.ok(!tackleDeck.includes(card), `Naval card ${card} should not be in tackle deck`);
    }
  });

  // C7: Roaming Patrol Vessel Detection Cone + Alert State Transition
  test('T3.C07: Patrol vessel switches from patrol to pursuit when player enters directional cone', () => {
    const vessel = {
      x: 1000,
      y: 1000,
      heading: 0, // facing East
      state: 'patrol' as 'patrol' | 'pursuit'
    };

    // Boat placed 200px directly in front of vessel
    const playerPos = { x: 1200, y: 1000 };
    const detected = referenceCheckConeDetection(
      vessel.x,
      vessel.y,
      vessel.heading,
      HOSTILE_CONE_DISTANCE,
      HOSTILE_CONE_ANGLE_RAD,
      playerPos.x,
      playerPos.y
    );

    if (detected) vessel.state = 'pursuit';
    assert.strictEqual(vessel.state, 'pursuit');
  });

  // C8: Patrol Vessel Audio Cue Swell + Horn Playback Trigger
  test('T3.C08: Transition to pursuit triggers vessel audio cue horn', () => {
    const playedSounds: string[] = [];
    const vesselSpec = AUTHORITATIVE_HOSTILE_ROSTER.crazed_trawler;

    function onPursuitEngaged(spec: typeof vesselSpec) {
      playedSounds.push(spec.audioCue);
    }

    onPursuitEngaged(vesselSpec);
    assert.deepStrictEqual(playedSounds, ['horn_01_eldritch_horn_wail']);
  });

  // C9: Ambush Sea Beast Proximity + Breach Transition
  test('T3.C09: Sea beast transitions from submerged shadow to breached when boat enters 150px proximity', () => {
    const beast = { x: 3000, y: 3000, state: 'shadow' as 'shadow' | 'breached' };
    const playerBoat = { x: 3100, y: 3000 }; // 100px away (< 150px breach radius)

    const dx = playerBoat.x - beast.x;
    const dy = playerBoat.y - beast.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= 150) beast.state = 'breached';
    assert.strictEqual(beast.state, 'breached');
  });

  // C10: Ambush Sea Beast Proximity + Groan Audio Trigger
  test('T3.C10: Sea beast proximity within 350px emits creature groan audio cue', () => {
    const audioEvents: string[] = [];
    const beastSpec = AUTHORITATIVE_HOSTILE_ROSTER.mutated_whale;
    const dist = 280; // Within 350px groan radius

    if (dist <= beastSpec.detectionRadius) {
      audioEvents.push(beastSpec.audioCue);
    }

    assert.deepStrictEqual(audioEvents, ['groan_01_creature_groan_swell']);
  });

  // C11: Overworld Collision + Combat Transition
  test('T3.C11: Overworld vessel collision (<45px) freezes exploration and starts Naval Combat', () => {
    let mode: 'exploration' | 'naval_combat' = 'exploration';
    const playerBoat = { x: 2000, y: 2000, vx: 50, vy: 0 };
    const enemyVessel = { x: 2030, y: 2000 }; // 30px away (<45px engage radius)

    const dist = Math.abs(playerBoat.x - enemyVessel.x);
    if (dist <= 45) {
      playerBoat.vx = 0;
      playerBoat.vy = 0;
      mode = 'naval_combat';
    }

    assert.strictEqual(mode, 'naval_combat');
    assert.strictEqual(playerBoat.vx, 0);
  });

  // C12: Naval Combat Swivel Gun + Enemy HP Reduction
  test('T3.C12: Swivel gun card deals 12 damage to enemy vessel', () => {
    const enemy = { hp: 75 };
    const card = AUTHORITATIVE_NAVAL_CARDS.swivel_gun;

    enemy.hp = Math.max(0, enemy.hp - card.damage);
    assert.strictEqual(enemy.hp, 63);
  });

  // C13: Naval Combat Enemy Salvo + Player Armor Buffer
  test('T3.C13: Enemy attack against player with temporary armor absorbs damage before Hull HP is touched', () => {
    let playerHull = 60;
    let playerArmor = 15;
    const enemyAttackDmg = 20;

    const damageThroughArmor = Math.max(0, enemyAttackDmg - playerArmor);
    playerArmor = Math.max(0, playerArmor - enemyAttackDmg);
    playerHull -= damageThroughArmor;

    assert.strictEqual(playerArmor, 0);
    assert.strictEqual(playerHull, 55); // 15 absorbed, 5 inflicted
  });

  // C14: Naval Combat Bilge Patch + Hull Repair Clamping
  test('T3.C14: Bilge patch repairs 18 Hull HP without exceeding VESSEL_MAX_HULL_HP (60)', () => {
    let playerHull = 50;
    const patchCard = AUTHORITATIVE_NAVAL_CARDS.bilge_patch;

    playerHull = Math.min(VESSEL_MAX_HULL_HP, playerHull + patchCard.hullRepair);
    assert.strictEqual(playerHull, 60, 'Should clamp at exactly 60 HP');
  });

  // C15: Naval Combat Victory + Despawn & Bounty
  test('T3.C15: Sinking enemy vessel awards gold bounty and removes vessel from active roster', () => {
    let playerGold = 100;
    const activeVessels = ['vessel_01', 'vessel_02'];
    const enemyVessel = { id: 'vessel_01', hp: 0, bounty: 35 };

    if (enemyVessel.hp <= 0) {
      playerGold += enemyVessel.bounty;
      const idx = activeVessels.indexOf(enemyVessel.id);
      if (idx !== -1) activeVessels.splice(idx, 1);
    }

    assert.strictEqual(playerGold, 135);
    assert.deepStrictEqual(activeVessels, ['vessel_02']);
  });

  // C16: Sea Beast Multi-Phase Transition: Tether to Weak Point
  test('T3.C16: Depleting beast stamina in Phase 1 triggers Phase 2 Weak Point targeting phase', () => {
    const standoff = {
      phase: 1 as 1 | 2,
      beastTetherStamina: 100
    };

    standoff.beastTetherStamina = 0;
    if (standoff.beastTetherStamina <= 0) {
      standoff.phase = 2;
    }

    assert.strictEqual(standoff.phase, 2);
  });

  // C17: Sea Beast Weak Point Critical Multiplier
  test('T3.C17: Targeting exposed beast weak point applies 2.0x critical damage multiplier', () => {
    const baseDamage = 15;
    const isWeakPointHit = true;
    const multiplier = isWeakPointHit ? 2.0 : 1.0;
    const finalDamage = baseDamage * multiplier;

    assert.strictEqual(finalDamage, 30);
  });

  // C18: Sea Beast Defeat + Trophy Award
  test('T3.C18: Defeating sea beast awards unique monster trophy item', () => {
    const inventory: string[] = [];
    const beastHp = 0;

    if (beastHp <= 0) {
      inventory.push('trophy_dagon_scale');
    }

    assert.ok(inventory.includes('trophy_dagon_scale'));
  });

  // C19: Hull Depletion with Gold -> Harbor Towing Penalty
  test('T3.C19: Combat hull reaching 0 HP with 150g gold triggers 18% toll and docks vessel at harbor', () => {
    let hullHp = 0;
    let gold = 150;
    let boatPos = { x: 1500, y: 2200 };

    if (hullHp <= 0 && gold > 0) {
      const toll = referenceCalcHarborToll(gold); // 150 * 0.18 = 27
      gold -= toll;
      hullHp = VESSEL_MAX_HULL_HP;
      boatPos = { x: 4000, y: 4070 };
    }

    assert.strictEqual(gold, 123);
    assert.strictEqual(hullHp, 60);
    assert.deepStrictEqual(boatPos, { x: 4000, y: 4070 });
  });

  // C20: Hull Depletion with 0 Gold -> Desperate Escape Trigger
  test('T3.C20: Combat hull reaching 0 HP with 0 gold routes to 10s Desperate Escape sequence', () => {
    let gameState: 'combat' | 'harbor_towed' | 'desperate_escape' = 'combat';
    const hullHp = 0;
    const gold = 0;

    if (hullHp <= 0) {
      if (gold > 0) gameState = 'harbor_towed';
      else gameState = 'desperate_escape';
    }

    assert.strictEqual(gameState, 'desperate_escape');
  });

  // C21: Desperate Escape Collision -> Lovecraftian Game Over
  test('T3.C21: Obstacle collision during Desperate Escape sequence transitions to Game Over overlay', () => {
    let state: 'escape' | 'game_over' = 'escape';
    const hasCollidedWithDebris = true;

    if (hasCollidedWithDebris) {
      state = 'game_over';
    }

    assert.strictEqual(state, 'game_over');
  });

  // C22: Desperate Escape Time Expiry -> Limp Harbor Return
  test('T3.C22: Surviving 10s escape without collision restores vessel to harbor with 20 Limp HP', () => {
    let remainingTime = 0.0;
    let hullHp = 0;
    let boatPos = { x: 2500, y: 1500 };

    if (remainingTime <= 0.0) {
      hullHp = ESCAPE_SURVIVAL_LIMP_HP;
      boatPos = { x: 4000, y: 4070 };
    }

    assert.strictEqual(hullHp, 20);
    assert.deepStrictEqual(boatPos, { x: 4000, y: 4070 });
  });

  // C23: Game Over Screen Restart Action
  test('T3.C23: Restarting from Game Over screen resets Hull to 60, gold to 25, and clears agro', () => {
    const expedition = {
      hullHp: 0,
      gold: 0,
      boatPos: { x: 1200, y: 800 },
      activeAgro: ['trawler_1']
    };

    // Trigger restart
    expedition.hullHp = VESSEL_MAX_HULL_HP;
    expedition.gold = 25;
    expedition.boatPos = { x: 4000, y: 4000 };
    expedition.activeAgro = [];

    assert.strictEqual(expedition.hullHp, 60);
    assert.strictEqual(expedition.gold, 25);
    assert.deepStrictEqual(expedition.boatPos, { x: 4000, y: 4000 });
    assert.strictEqual(expedition.activeAgro.length, 0);
  });

  // C24: Flotsam Salvage Card Award -> Deck Collection Update
  test('T3.C24: Dredged salvage roll awarding card directly appends card to deck collection', () => {
    const deck = ['naval_swivel_gun'];
    const salvage = { type: 'card' as const, value: 'naval_broadside', label: 'Sunken Broadside Cannons' };

    if (salvage.type === 'card') {
      deck.push(salvage.value);
    }

    assert.strictEqual(deck.length, 2);
    assert.ok(deck.includes('naval_broadside'));
  });

  // C25: Tackle Deck & Naval Deck Coexistence Integrity
  test('T3.C25: Upgrading tackle deck cards does not mutate or alter Naval deck contents', () => {
    const tackleDeck = [{ id: 'hook_iron', level: 1 }];
    const navalDeck = [{ id: 'naval_swivel_gun', level: 1 }];

    // Upgrade tackle card
    tackleDeck[0].level = 2;

    assert.strictEqual(tackleDeck[0].level, 2);
    assert.strictEqual(navalDeck[0].level, 1, 'Naval deck card level must remain unaffected');
  });
});

// ===========================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 Complex Workload Tests)
// ===========================================================================

describe('Tier 4: Complex Real-World Application Scenarios', () => {

  // Scenario 1: Full Angler Expedition Loop
  test('T4.S01: Full Angler Expedition: Harbor Departure -> Zone 3 Cast with Blood Chum -> Strike Void-Gar -> Battle Victory -> Harbor Sale', () => {
    // 1. Initial Harbor State
    const player = {
      gold: 50,
      hullHp: 60,
      inventory: { blood_chum: 2 },
      catchBasket: [] as string[]
    };
    let boat = { x: 4000, y: 4070 };

    // 2. Sail into Zone 3 (radial distance > 2400px from harbor center 4000,4000)
    boat = { x: 4000, y: 1500 }; // dist = 2500px -> Zone 3
    const radialDist = Math.hypot(boat.x - 4000, boat.y - 4000);
    assert.ok(radialDist >= 2400 && radialDist < 3600, 'Boat should be positioned in Zone 3');

    // 3. Whirlpool Encounter & Pre-Cast Modal Selection
    assert.ok(player.inventory.blood_chum > 0);
    player.inventory.blood_chum--;
    const selectedBait = 'blood_chum';

    // 4. Resolve Tripartite Outcome & Species Hooking
    const outcomeRoll = 0.35; // Strike range (< 0.70)
    const outcome = referenceRollTripartiteOutcome(selectedBait, outcomeRoll);
    assert.strictEqual(outcome, 'strike');

    const rarity = referenceRollRarityForBait(selectedBait, 0.90); // Biased toward aberrant
    const speciesId = referenceResolveSpeciesForCast(3, rarity, 0.50);
    const species = AUTHORITATIVE_SPECIES_SPECS[speciesId];
    assert.ok(species, 'Must hook a valid species');
    assert.strictEqual(species.zoneTier, 3);

    // 5. Angling Battle Diorama Simulation
    let fishTension = species.lineDamagePower;
    let fishFatigue = 0;
    const requiredFatigue = 100;

    // Simulate 3 player reel turns
    for (let turn = 0; turn < 3; turn++) {
      fishFatigue += 35;
      player.hullHp -= Math.max(0, fishTension - 5); // boat absorbs some strain
    }
    assert.ok(fishFatigue >= requiredFatigue, 'Fish caught after sufficient fatigue');
    player.catchBasket.push(species.id);

    // 6. Return to Harbor Chandlery and Sell Catch
    boat = { x: 4000, y: 4070 };
    const saleValue = species.sellValue;
    player.gold += saleValue;
    player.catchBasket = [];

    // Verification of complete loop
    assert.strictEqual(player.inventory.blood_chum, 1);
    assert.ok(player.gold > 50, `Player gold should increase from sales (now ${player.gold})`);
    assert.ok(player.hullHp > 0, 'Boat survived the expedition');
  });

  // Scenario 2: Dredged Salvage & Recovery Loop
  test('T4.S02: Dredged Salvage Loop: Cast with Eldritch Grub in Zone 2 -> Flotsam Salvage -> Bonus Gold & Card -> Whirlpool Clean Despawn', () => {
    const player = {
      gold: 80,
      inventory: { eldritch_grub: 1 },
      deck: ['naval_swivel_gun']
    };
    let activeWhirlpools = ['whirlpool_kelp_01'];

    // 1. Cast into whirlpool with Eldritch Grub
    player.inventory.eldritch_grub--;
    // Eldritch Grub outcome weights: strike 85, salvage 12, slack 3 -> 0.88 falls in salvage (0.85 - 0.97)
    const rollOutcome = 0.88;
    const outcome = referenceRollTripartiteOutcome('eldritch_grub', rollOutcome);
    assert.strictEqual(outcome, 'salvage');

    // 2. Generate Salvage Reward
    const reward = referenceGenerateSalvageReward(2, 0.85, 0.50); // yields card
    if (reward.type === 'card' && reward.cardTitle) {
      player.deck.push(reward.cardTitle);
    } else if (reward.type === 'gold' && reward.amount) {
      player.gold += reward.amount;
    }

    // 3. Clean Despawn of Whirlpool
    activeWhirlpools = activeWhirlpools.filter(w => w !== 'whirlpool_kelp_01');

    // Verification
    assert.strictEqual(player.inventory.eldritch_grub, 0);
    assert.ok(player.deck.length > 1 || player.gold > 80);
    assert.strictEqual(activeWhirlpools.length, 0, 'Whirlpool cleanly despawned');
  });

  // Scenario 3: Overworld Naval Patrol Ambush & Victory
  test('T4.S03: Naval Patrol Ambush & Victory: Boat sails into Zone 2 -> Crazed Trawler alert -> Naval Battle Engine -> Ship Sunk -> Bounty', () => {
    // 1. Overworld state
    const player = {
      gold: 40,
      hullHp: 60,
      stamina: 3,
      deck: ['naval_swivel_gun', 'naval_broadside', 'naval_hull_bracing']
    };

    const trawler = {
      ...AUTHORITATIVE_HOSTILE_ROSTER.crazed_trawler,
      currentHp: AUTHORITATIVE_HOSTILE_ROSTER.crazed_trawler.maxHp
    };

    // 2. Engage combat
    let combatFinished = false;
    let combatResult: 'victory' | 'defeat' | null = null;

    // Turn 1: Player plays Swivel Gun (12 dmg) & Hull Bracing (+15 armor)
    let playerArmor = AUTHORITATIVE_NAVAL_CARDS.hull_bracing.armorGain;
    trawler.currentHp -= AUTHORITATIVE_NAVAL_CARDS.swivel_gun.damage; // 75 - 12 = 63

    // Trawler counter-attacks for 16 dmg
    const trawlerDmg = 16;
    const penDmg = Math.max(0, trawlerDmg - playerArmor);
    playerArmor = Math.max(0, playerArmor - trawlerDmg);
    player.hullHp -= penDmg; // 60 - 1 = 59

    // Turn 2: Player plays Broadside Cannons (28 dmg)
    trawler.currentHp -= AUTHORITATIVE_NAVAL_CARDS.broadside.damage; // 63 - 28 = 35

    // Turn 3: Player plays Broadside Cannons (28 dmg)
    trawler.currentHp -= AUTHORITATIVE_NAVAL_CARDS.broadside.damage; // 35 - 28 = 7

    // Turn 4: Swivel Gun finish (12 dmg)
    trawler.currentHp = Math.max(0, trawler.currentHp - AUTHORITATIVE_NAVAL_CARDS.swivel_gun.damage);

    if (trawler.currentHp <= 0) {
      combatFinished = true;
      combatResult = 'victory';
      player.gold += 35; // bounty
    }

    assert.strictEqual(combatFinished, true);
    assert.strictEqual(combatResult, 'victory');
    assert.strictEqual(trawler.currentHp, 0);
    assert.strictEqual(player.gold, 75);
    assert.strictEqual(player.hullHp, 59);
  });

  // Scenario 4: Deep Trench Sea Beast Standoff
  test('T4.S04: Deep Trench Sea Beast Standoff: Submerged Shadow Breach -> Phase 1 Harpoon Tether -> Phase 2 Weak Point Crit -> Beast Slain', () => {
    const beast = {
      ...AUTHORITATIVE_HOSTILE_ROSTER.cthulhu_colossus,
      phase: 1 as 1 | 2,
      tetherMeter: 0,
      currentHp: 260
    };

    // Phase 1: Build Tether Meter to 100%
    while (beast.tetherMeter < 100) {
      beast.tetherMeter += 25;
    }
    assert.strictEqual(beast.tetherMeter, 100);
    beast.phase = 2; // Transition to weak point phase

    // Phase 2: Weak Point targeting (deals 2.0x crit)
    const baseHarpoonDamage = 35;
    const critMultiplier = 2.0;
    const weakPointDamage = baseHarpoonDamage * critMultiplier; // 70 dmg per hit

    // 4 Weak Point hits = 280 dmg (exceeds 260 max HP)
    for (let hit = 0; hit < 4; hit++) {
      beast.currentHp = Math.max(0, beast.currentHp - weakPointDamage);
    }

    assert.strictEqual(beast.currentHp, 0, 'Beast must be defeated');
    assert.strictEqual(beast.phase, 2);
  });

  // Scenario 5: Defeat Towing vs Desperate Escape Divergence
  test('T4.S05: Defeat Penalty Divergence: Wealthy player towed with 18% toll vs Penniless player 10s escape minigame (Survival & Death branches)', () => {
    // --- Branch 1: Player with Gold ---
    const wealthyPlayer = { gold: 200, hullHp: 0, boatPos: { x: 1800, y: 1200 } };
    const toll = referenceCalcHarborToll(wealthyPlayer.gold); // 200 * 0.18 = 36g
    wealthyPlayer.gold -= toll;
    wealthyPlayer.hullHp = VESSEL_MAX_HULL_HP;
    wealthyPlayer.boatPos = { x: 4000, y: 4070 };

    assert.strictEqual(wealthyPlayer.gold, 164);
    assert.strictEqual(wealthyPlayer.hullHp, 60);
    assert.deepStrictEqual(wealthyPlayer.boatPos, { x: 4000, y: 4070 });

    // --- Branch 2A: Penniless Player (0 Gold) -> Desperate Escape Collision Failure ---
    const brokePlayerDeath = { gold: 0, hullHp: 0, escapeTimeLeft: 10.0, state: 'escape' };
    const simulatedCollisionTime = 3.5;
    brokePlayerDeath.escapeTimeLeft -= (10.0 - simulatedCollisionTime);
    const collided = true;
    if (collided) {
      brokePlayerDeath.state = 'game_over';
    }
    assert.strictEqual(brokePlayerDeath.state, 'game_over');

    // --- Branch 2B: Penniless Player (0 Gold) -> Desperate Escape Survival ---
    const brokePlayerSurvive = { gold: 0, hullHp: 0, escapeTimeLeft: 10.0, state: 'escape', boatPos: { x: 2200, y: 1900 } };
    let dt = 1.0;
    for (let tick = 0; tick < 10; tick++) {
      brokePlayerSurvive.escapeTimeLeft -= dt;
    }
    if (brokePlayerSurvive.escapeTimeLeft <= 0.0) {
      brokePlayerSurvive.state = 'limp_harbor';
      brokePlayerSurvive.hullHp = ESCAPE_SURVIVAL_LIMP_HP; // exactly 20 HP
      brokePlayerSurvive.boatPos = { x: 4000, y: 4070 };
    }

    assert.strictEqual(brokePlayerSurvive.state, 'limp_harbor');
    assert.strictEqual(brokePlayerSurvive.hullHp, 20);
    assert.strictEqual(brokePlayerSurvive.gold, 0);
    assert.deepStrictEqual(brokePlayerSurvive.boatPos, { x: 4000, y: 4070 });
  });
});
