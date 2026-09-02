import bpy
from mathutils import Vector

BLEND='/home/alfr/mercicat-rebuild/blender/saltglass_brine_docks_refined.blend'
RENDER='/home/alfr/mercicat-rebuild/blender/saltglass_brine_docks_final.png'
GLB='/home/alfr/mercicat-rebuild/blender/saltglass_brine_docks_final.glb'

def link_to(obj, collection_name):
    target=bpy.data.collections.get(collection_name)
    if target:
        for c in list(obj.users_collection): c.objects.unlink(obj)
        target.objects.link(obj)

def mat(name, color, metallic=0.0, rough=0.8, emission=None, strength=1.5):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metallic
    bs.inputs['Roughness'].default_value=rough
    if emission:
        bs.inputs['Emission'].default_value=(*emission,1)
        bs.inputs['Emission Strength'].default_value=strength
    return m

def cube(name, loc, dims, material, collection='GRAYBOX', bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        mod=o.modifiers.new('purposeful_edge_bevel','BEVEL'); mod.width=bevel; mod.segments=2
    link_to(o,collection)
    return o

bpy.ops.wm.open_mainfile(filepath=BLEND)
# Remove any previous spawn marker geometry (obsolete or from an earlier refinement pass).
for o in list(bpy.data.objects):
    if o.name.startswith('GB_spawn_marker_'):
        bpy.data.objects.remove(o, do_unlink=True)
# Remove the white proxy/clearance guide seen as false spawn cues.
for name in ('GB_player_proxy','GB_player_clearance_075m'):
    o=bpy.data.objects.get(name)
    if o: bpy.data.objects.remove(o, do_unlink=True)
# Remove the noisy four-lane fan/stripe geometry and any prior clean lane pass.
for o in list(bpy.data.objects):
    if o.name.startswith('GB_lane_'):
        bpy.data.objects.remove(o, do_unlink=True)
# Final balanced four-corner spawn distribution.  Absolute positions make this pass idempotent.
spawn_targets={1:(-5.0,-6.0), 2:(-2.2,-1.8), 3:(2.6,-1.2), 4:(5.2,4.2)}
for i,(x,y) in spawn_targets.items():
    anchor=bpy.data.objects.get(f'GB_spawn_{i:02d}')
    if not anchor: raise RuntimeError(f'Missing spawn anchor {i}')
    anchor.location=(x,y,0.05)
spawn_mat=mat('mat_spawn_marker_electric_cyan',(0.005,0.55,0.95),0.1,0.25,(0.0,0.75,1.0),4.0)
spawn_locs=[]
for i in range(1,5):
    anchor=bpy.data.objects.get(f'GB_spawn_{i:02d}')
    x,y,_=anchor.location
    spawn_locs.append((x,y))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.5, location=(x,y,0.5))
    o=bpy.context.object; o.name=f'GB_spawn_marker_{i:02d}_electric_sphere'; o.data.materials.append(spawn_mat); link_to(o,'GRAYBOX')
    o['marker_type']='spawn'; o['radius_m']=0.5; o['anchor_xy']=(float(x),float(y)); o['standardized']=True
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
# Clear, minimal directional lane language: central gold line plus two restrained side guides.
lane=mat('mat_lane_marker_clean',(0.85,0.48,0.08),0.15,0.6,(0.35,0.12,0.01),1.0)
guide=mat('mat_lane_guide_subtle',(0.38,0.22,0.06),0.1,0.72)
central=cube('GB_lane_flow_central',(0,0.45,0.045),(0.50,12.0,0.09),lane,'GRAYBOX',0.015)
central['flow_direction']='+Y'; central['pattern']='clean_central_line_two_subtle_side_guides'
for i,x in enumerate((-2.0,2.0),1):
    g=cube(f'GB_lane_guide_{i:02d}',(x,0.45,0.032),(0.10,12.0,0.05),guide,'GRAYBOX',0.008)
    g['flow_direction']='+Y'; g['pattern']='subtle_side_guide'
# Move center cover 5.0 m left, completely clear of the golden central lane.
crate=bpy.data.objects.get('GB_cover_crate_center')
if not crate: raise RuntimeError('Missing center crate')
crate.location.x = -4.5
crate['reposition_note']='shifted 5.0m left off golden lane for full passability'
# One right-side medium defensive cover, deliberately sized to the requested contract.
east=bpy.data.objects.get('GB_cover_crate_east')
if east:
    east.location=(6.0,1.8,0.75)
    east.dimensions=(2.0,2.0,1.5)
    bpy.context.view_layer.objects.active=east
    east.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    east.select_set(False)
    east['reposition_note']='final right-side balanced defensive cover'
else:
    east=cube('GB_cover_crate_east',(6.0,1.8,0.75),(2.0,2.0,1.5),bpy.data.materials.get('mat_crate_brown') or mat('mat_crate_brown',(0.28,0.10,0.035),0.0,0.8),'GRAYBOX',0.08)
    east['cover_role']='right-side spawn defense'
# Ensure scene render path and save.
sc=bpy.context.scene
sc.render.filepath=RENDER
sc.render.image_settings.file_format='PNG'
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
# Export visible graybox/props meshes; exclude collision, refs, camera, lights.
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type=='MESH' and not o.name.startswith('COL_') and o.name not in {'GB_player_clearance_075m'}:
        o.select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects.get('GB_floor_brine_docks')
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_apply=True, export_cameras=False, export_lights=False)
print('REFINEMENT_DONE')
print('SPAWNS', [(f'GB_spawn_marker_{i:02d}_electric_sphere', tuple(round(v,3) for v in bpy.data.objects[f'GB_spawn_marker_{i:02d}_electric_sphere'].location), tuple(round(v,3) for v in bpy.data.objects[f'GB_spawn_marker_{i:02d}_electric_sphere'].dimensions)) for i in range(1,5)])
print('LANES', [(o.name, tuple(round(v,3) for v in o.dimensions), tuple(round(v,3) for v in o.location)) for o in bpy.data.objects if o.name.startswith('GB_lane_')])
print('CENTER_CRATE', tuple(round(v,3) for v in crate.location), tuple(round(v,3) for v in crate.dimensions))
print('RENDER',RENDER)
print('GLB',GLB)
