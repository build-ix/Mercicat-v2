/**
 * MERCICAT CHARACTER CONTRACT: Orange Tabby Protagonist
 * 
 * Defines the stable gameplay-facing API for the protagonist character.
 * Implementation-specific skeleton details from Higgsfield are mapped to this contract via adapters.
 * 
 * IDENTITY
 * - Species: Orange tabby cat (Felis catus, warm orange fur with darker stripes)
 * - Proportions: Realistic cat body (8-12in body length), NOT anthropomorphic human proportions
 * - Gear: Black tactical jacket, body armor vest, tactical webbing, combat boots
 * - Weapons: Dual 9mm semi-automatic pistols (thigh-holstered)
 * 
 * SKELETON REQUIREMENTS
 * Export format: glTF 2.0 with embedded animations
 * Scale: 1 unit = 1 inch (character ~10-12 units tall in top-down view)
 * Orientation: +Z up, +X right, +Y forward (standard game engine)
 * Armature hierarchy: Spine → Chest → Shoulders → Arms; Spine → Hips → Legs; Spine → Neck → Head
 * 
 * Required joint names (adapter maps actual skeleton to these logical names):
 * - Root (center of mass, hip area)
 * - Spine, SpineUpper, Chest
 * - LeftShoulder, LeftArm, LeftForearm, LeftHand
 * - RightShoulder, RightArm, RightForearm, RightHand
 * - LeftHip, LeftLeg, LeftFoot
 * - RightHip, RightLeg, RightFoot
 * - Neck, Head
 * - Tail (base to tip, segmented or single joint acceptable)
 * - LeftEar, RightEar
 * 
 * IK CHAINS (optional, but recommended for foot stability):
 * - LeftLeg chain: LeftHip → LeftLeg → LeftFoot (pole target below foot)
 * - RightLeg chain: RightHip → RightLeg → RightFoot (pole target below foot)
 * - LeftArm chain: LeftShoulder → LeftArm → LeftForearm → LeftHand
 * - RightArm chain: RightShoulder → RightArm → RightForearm → RightHand
 * 
 * ANIMATION STATE MACHINE
 */

export enum AnimationState {
  Idle = "idle",           // Standing still, breathing/tail idle
  Walk = "walk",           // Movement in any direction
  Run = "run",             // Sprint (high speed movement)
  Aim = "aim",             // Aiming pistols (no movement)
  Fire = "fire",           // Gun discharge (short 0.3s clip)
  Reload = "reload",       // Reloading (0.8s clip)
  Hurt = "hurt",           // Taking damage, knockback
  Death = "death",         // Death animation, ragdoll fallback
  Victory = "victory",     // Round victory pose
}

export enum WeaponType {
  Pistol = "pistol_9mm",
  Shotgun = "shotgun_combat",
  SMG = "smg_tactical",
  Rifle = "rifle_assault",
  Sniper = "sniper_precision",
  Launcher = "launcher_rocket",
}

export interface CharacterAnimationClip {
  name: string;
  state: AnimationState;
  duration: number;         // seconds
  loopable: boolean;
  blendInTime: number;      // fade in duration (0.1-0.3s typical)
  blendOutTime: number;     // fade out duration
  rootMotion: boolean;      // whether animation drives character position
  notes?: string;
}

export interface SkeletonMapping {
  /**
   * Maps Higgsfield-generated bone names to logical joint names.
   * Example: { "Armature|Spine.001": "Spine", "Armature|Hand.L": "LeftHand" }
   */
  boneMap: Record<string, string>;
  
  /**
   * Inverse mapping for setting animation targets
   * Example: { "Spine": "Armature|Spine.001" }
   */
  inverseBoneMap: Record<string, string>;
  
  /**
   * Scale factor from model units to game units
   * If Higgsfield exports at 100cm scale and game unit = 1 inch, scaleUnitConversion = 0.3937
   */
  scaleUnitConversion: number;
  
  /**
   * Root bone for character positioning
   */
  rootBone: string;
  
  /**
   * Foot bones for ground contact detection and IK
   */
  groundContactBones: string[];
  
  /**
   * Bone used for aiming direction (typically head or chest)
   */
  aimBone: string;
  
  /**
   * Muzzle attachment points (left and right pistol muzzles for raycast/VFX)
   */
  muzzleAttachments: {
    left: string;    // e.g., "LeftHand"
    right: string;   // e.g., "RightHand"
  };
}

export interface CharacterContract {
  id: "tabby_protagonist";
  displayName: "Orange Tabby";
  description: "Tactical cat mercenary with dual pistols";
  
  // Visual/physical properties
  species: "orange_tabby_cat";
  scale: number;              // Game units (1 unit = 1 inch)
  
  // Model assets
  modelUrl: string;           // Path to glTF model file
  textureUrl: string;         // Diffuse/albedo texture
  normalMapUrl?: string;      // Normal map for detail
  aoMapUrl?: string;          // Ambient occlusion
  
  // Skeletal setup
  skeleton: SkeletonMapping;
  
  // Animation library
  animations: CharacterAnimationClip[];
  
  // Gameplay state defaults
  maxHealth: number;
  armor: number;              // Damage reduction percentage
  speed: {
    idle: 0,
    walk: 5,                   // units/second
    run: 12,                   // units/second
    aim: 2,                    // reduced speed while aiming
  };
  
  // Weapon system
  primaryWeapon: WeaponType;
  secondaryWeapon?: WeaponType;
  weaponHardpoints: {
    leftHand: WeaponType;
    rightHand: WeaponType;
  };
  
  // Animation blending parameters
  transitionBlendTime: number; // seconds (0.15-0.3 typical)
  
  // IK constraints
  footIkEnabled: boolean;
  footIkBlendTime: number;
  
  // Tail animation
  tailIkEnabled: boolean;
  tailSegments: number;        // number of joints in tail
  
  // Audio cues (state → sound mapping, handled by audio system)
  audioMap?: {
    stateEnter?: Record<AnimationState, string>;   // Audio event on state entry
    stateExit?: Record<AnimationState, string>;    // Audio event on state exit
  };
}

/**
 * PROTOTYPE CONTRACT
 * This is the minimum viable definition. Implementation-specific details
 * (exact bone names, animation frame counts, etc.) are populated after Higgsfield generation.
 */
export const TabbyCatProtagonist: CharacterContract = {
  id: "tabby_protagonist",
  displayName: "Orange Tabby",
  description: "Tactical cat mercenary with dual pistols",
  
  species: "orange_tabby_cat",
  scale: 11,  // ~11 inches (realistic cat body length)
  
  modelUrl: "/assets/characters/tabby-protagonist.glb",
  textureUrl: "/assets/characters/tabby-protagonist-diffuse.png",
  normalMapUrl: "/assets/characters/tabby-protagonist-normal.png",
  aoMapUrl: "/assets/characters/tabby-protagonist-ao.png",
  
  // Skeleton mapping TBD after Higgsfield generation
  skeleton: {
    boneMap: {},          // Populated after model generation
    inverseBoneMap: {},
    scaleUnitConversion: 1,
    rootBone: "Root",
    groundContactBones: ["LeftFoot", "RightFoot"],
    aimBone: "Head",
    muzzleAttachments: {
      left: "LeftHand",
      right: "RightHand",
    },
  },
  
  animations: [
    {
      name: "Idle",
      state: AnimationState.Idle,
      duration: 2.0,
      loopable: true,
      blendInTime: 0.2,
      blendOutTime: 0.2,
      rootMotion: false,
      notes: "Idle breathing animation with occasional tail twitch",
    },
    {
      name: "Walk",
      state: AnimationState.Walk,
      duration: 1.2,
      loopable: true,
      blendInTime: 0.15,
      blendOutTime: 0.15,
      rootMotion: true,
      notes: "Realistic 4-legged walk cycle, foot plants sync with audio",
    },
    {
      name: "Run",
      state: AnimationState.Run,
      duration: 0.8,
      loopable: true,
      blendInTime: 0.1,
      blendOutTime: 0.1,
      rootMotion: true,
      notes: "Sprint/gallop cycle, increased stride length",
    },
    {
      name: "Aim",
      state: AnimationState.Aim,
      duration: 0.5,
      loopable: false,
      blendInTime: 0.2,
      blendOutTime: 0.2,
      rootMotion: false,
      notes: "Transition to aiming stance, arms raised, body slight lean",
    },
    {
      name: "Fire",
      state: AnimationState.Fire,
      duration: 0.3,
      loopable: false,
      blendInTime: 0.0,
      blendOutTime: 0.1,
      rootMotion: false,
      notes: "Recoil animation, 0.3s clip, synced to audio discharge",
    },
    {
      name: "Reload",
      state: AnimationState.Reload,
      duration: 0.8,
      loopable: false,
      blendInTime: 0.1,
      blendOutTime: 0.2,
      rootMotion: false,
      notes: "Magazine exchange, hands move to holsters",
    },
    {
      name: "Hurt",
      state: AnimationState.Hurt,
      duration: 0.6,
      loopable: false,
      blendInTime: 0.05,
      blendOutTime: 0.15,
      rootMotion: false,
      notes: "Knockback/flinch reaction, body recoil",
    },
    {
      name: "Death",
      state: AnimationState.Death,
      duration: 2.0,
      loopable: false,
      blendInTime: 0.1,
      blendOutTime: 0.0,
      rootMotion: false,
      notes: "Collapse/ragdoll transition, then hold pose",
    },
    {
      name: "Victory",
      state: AnimationState.Victory,
      duration: 2.0,
      loopable: false,
      blendInTime: 0.2,
      blendOutTime: 0.0,
      rootMotion: false,
      notes: "Fist bump or tail celebration pose",
    },
  ],
  
  maxHealth: 100,
  armor: 15,  // 15% damage reduction from tactical gear
  
  speed: {
    idle: 0,
    walk: 5,      // units/second (~5 inches/sec = realistic cat walk)
    run: 12,      // units/second (~12 inches/sec = realistic cat run/gallop)
    aim: 2,       // reduced speed while aiming
  },
  
  primaryWeapon: WeaponType.Pistol,
  weaponHardpoints: {
    leftHand: WeaponType.Pistol,
    rightHand: WeaponType.Pistol,
  },
  
  transitionBlendTime: 0.2,
  
  footIkEnabled: true,
  footIkBlendTime: 0.15,
  
  tailIkEnabled: true,
  tailSegments: 3,
};

/**
 * NEXT STEPS (Stride 7)
 * 
 * 1. Submit this contract to Higgsfield with explicit requirements:
 *    - glTF 2.0 export with armature bones
 *    - Scale: 1 unit = 1 inch, final height ~10-12 units
 *    - Orientation: +Z up
 *    - Include required animations (Idle, Walk, Run, Aim, Fire, Reload, Hurt, Death, Victory)
 *    - Bone naming: use logical names (Root, Spine, Head, LeftHand, RightHand, etc.)
 * 
 * 2. Upon receiving generated model:
 *    - Extract actual bone names and populate skeleton.boneMap
 *    - Verify animation clip names and durations
 *    - Test IK chains and foot plant timing
 *    - Reconcile any mismatch via adapter, do NOT rewrite this contract
 * 
 * 3. Integration gates:
 *    - All bone names must resolve via boneMap (no unmapped bones in gameplay code)
 *    - All animation states must have a corresponding AnimationClip entry
 *    - All muzzle attachments must exist as child bones/sockets
 */
