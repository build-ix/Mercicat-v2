# STRIDE 7 — Higgsfield Output / Tabby Protagonist

## Delivery status

The requested Higgsfield MCP endpoint was **not available in the agent tool surface for this run** (and Blender was not installed). To keep the integration path testable, this deliverable was generated locally by `tools/generate_tabby_glb.py` as a deterministic glTF 2.0 fallback. It is structurally valid and contains the requested logical skeleton, separate gear/weapon geometry, embedded PNG images, and all nine animation clips, but it is **not an AAA/Higgsfield scan-quality asset** and is not skinned/deformation-tested like a production Higgsfield export. Replace it with the MCP export when that endpoint is available.

## Files delivered

- `packages/client/public/assets/characters/tabby-protagonist.glb`
- `packages/client/public/assets/characters/tabby-protagonist-diffuse.png`
- `packages/client/public/assets/characters/tabby-protagonist-normal.png`
- `packages/client/public/assets/characters/tabby-protagonist-ao.png`
- Generator: `tools/generate_tabby_glb.py`

The GLB contains the three PNG images as embedded buffer views. The external PNGs are also present because the locked contract references them by URL.

## Coordinate system and scale

- Declared asset orientation: `+Z up, +X right, +Y forward`.
- Declared scale: `1 unit = 1 inch`.
- Authored target height: approximately 11 units.
- GLB asset metadata includes these declarations and generator provenance.

## Actual logical bone names and mapping

The fallback exporter uses the contract's logical names directly, so the adapter mapping is identity:

```json
{
  "Root": "Root",
  "Spine": "Spine",
  "SpineUpper": "SpineUpper",
  "Chest": "Chest",
  "Hips": "Hips",
  "Neck": "Neck",
  "Head": "Head",
  "LeftShoulder": "LeftShoulder",
  "LeftArm": "LeftArm",
  "LeftForearm": "LeftForearm",
  "LeftHand": "LeftHand",
  "RightShoulder": "RightShoulder",
  "RightArm": "RightArm",
  "RightForearm": "RightForearm",
  "RightHand": "RightHand",
  "LeftHip": "LeftHip",
  "LeftLeg": "LeftLeg",
  "LeftFoot": "LeftFoot",
  "RightHip": "RightHip",
  "RightLeg": "RightLeg",
  "RightFoot": "RightFoot",
  "LeftEar": "LeftEar",
  "RightEar": "RightEar",
  "Tail": "Tail",
  "Tail_02": "Tail_02",
  "Tail_03": "Tail_03"
}
```

Recommended contract adapter values:

```ts
boneMap: {
  Root: "Root", Spine: "Spine", SpineUpper: "SpineUpper", Chest: "Chest", Hips: "Hips",
  Neck: "Neck", Head: "Head", LeftShoulder: "LeftShoulder", LeftArm: "LeftArm",
  LeftForearm: "LeftForearm", LeftHand: "LeftHand", RightShoulder: "RightShoulder",
  RightArm: "RightArm", RightForearm: "RightForearm", RightHand: "RightHand",
  LeftHip: "LeftHip", LeftLeg: "LeftLeg", LeftFoot: "LeftFoot", RightHip: "RightHip",
  RightLeg: "RightLeg", RightFoot: "RightFoot", LeftEar: "LeftEar", RightEar: "RightEar",
  Tail: "Tail", Tail_02: "Tail_02", Tail_03: "Tail_03"
},
rootBone: "Root",
groundContactBones: ["LeftFoot", "RightFoot"],
aimBone: "Head",
muzzleAttachments: { left: "LeftHand", right: "RightHand" }
```

`inverseBoneMap` is the same identity object. `scaleUnitConversion` is `1`.

## Animation verification

The GLB animation names are exactly:

`Idle`, `Walk`, `Run`, `Aim`, `Fire`, `Reload`, `Hurt`, `Death`, `Victory`.

Durations authored to match the contract: `2.0, 1.2, 0.8, 0.5, 0.3, 0.8, 0.6, 2.0, 2.0` seconds respectively. Idle/Walk/Run use cyclic keyframes; the other clips are non-looping state clips. Animation channels target logical bone nodes by name.

## Mapping / integration quirks

1. This fallback has a named bone hierarchy and animation channels but does not include a `skins` block; geometry is parented to logical bone nodes rather than smooth-skinned. Treat this as an integration fixture, not a final deformation asset.
2. Tail joints are named `Tail`, `Tail_02`, and `Tail_03` to make the required three segments explicit.
3. `LeftEar` and `RightEar` occur once as logical bone nodes; the visible ear meshes have the same names under those nodes in the fallback scene and may need disambiguation by node index in engines that flatten names.
4. Pistols are separate `Left9mm_Pistol` / `Right9mm_Pistol` and grip nodes parented to hips/holsters, deliberately not fused to hand nodes. Muzzle sockets are therefore still represented by the contract's `LeftHand` / `RightHand` logical attachment targets until a production weapon socket pass is done.
5. Materials share a compact authored texture atlas; normal/AO PNGs are delivered and embedded but are not wired as normal/occlusion material slots by the fallback writer.
6. On receipt of the real Higgsfield MCP asset, rerun bone/clip verification and update this mapping if Higgsfield prefixes names (for example `Armature|Spine`).

## Verification command/result

A custom binary GLB inspection verified the GLB header/chunks, embedded PNG buffer views, 26 required logical nodes, and all 9 required animation names. The file was generated at 103,664 bytes.
