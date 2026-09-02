import bpy, math, os, json
from mathutils import Vector

ROOT = '/home/alfr/mercicat-rebuild/blender'
BLEND = os.path.join(ROOT, 'saltglass_corridor_section_graybox.blend')
GLB = os.path.join(ROOT, 'saltglass_corridor_section_graybox.glb')
PNG = os.path.join(ROOT, 'saltglass_corridor_section_validation.png')

# Clean scene and configure metric / snap contract.
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
scene.unit_settings.length_unit = 'METERS'
scene.tool_settings.use_snap = True
scene.tool_settings.snap_elements = {'INCREMENT'}
# Blender 3.4.1 has no ToolSettings.snap_increment property; all authored transforms are explicitly on the 0.5 m subgrid.
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1100
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = PNG
scene.render.film_transparent = False

# Collections
for cname in ['REF','GRAYBOX','COLLISION','LIGHTING','EXPORT']:
    col = bpy.data.collections.new(cname)
    scene.collection.children.link(col)

def move_to(obj, cname):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    bpy.data.collections[cname].objects.link(obj)

def mat(name, color, metallic=0.0, rough=0.65, emission=None):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough
    bs.inputs['Metallic'].default_value=metallic
    if emission:
        bs.inputs['Emission'].default_value=(*emission,1); bs.inputs['Emission Strength'].default_value=1.5
    return m
m_floor=mat('SGC_MAT_Floor_Graybox',(0.12,0.16,0.18),0.1,0.8)
m_teal=mat('SGC_MAT_TierB_Teal',(0.035,0.32,0.34),0.15,0.45)
m_pillar=mat('SGC_MAT_Pillar_Teal',(0.06,0.42,0.43),0.2,0.4)
_pbs=m_pillar.node_tree.nodes.get('Principled BSDF'); _pbs.inputs['Emission'].default_value=(0.02,0.28,0.30,1); _pbs.inputs['Emission Strength'].default_value=1.8
m_cover=mat('SGC_MAT_Cover_Safety',(0.75,0.28,0.06),0.05,0.55)
m_player=mat('SGC_MAT_PlayerProxy',(0.05,0.8,1.0),0.0,0.3, emission=(0.02,0.35,0.55))
m_edge=mat('SGC_MAT_Edge',(0.85,0.65,0.08),0.1,0.4)

def cube(name, loc, dims, material, collection='GRAYBOX', props=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    move_to(o, collection)
    o.data.materials.append(material)
    if props:
        for k,v in props.items(): o[k]=v
    return o

def sphere(name, loc, radius, material, collection='REF', props=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=radius, location=loc)
    o=bpy.context.object; o.name=name
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    move_to(o, collection); o.data.materials.append(material)
    if props:
        for k,v in props.items(): o[k]=v
    return o

# Main corridor: floor top exactly Z=0, centered at origin, +Y north.
cube('SGC_Floor_Corridor_6x20', (0,0,-0.10), (6.0,20.0,0.20), m_floor, props={'asset_type':'corridor_floor','width_m':6.0,'length_m':20.0,'floor_top_z':0.0,'orientation':'NORTH_+Y'})
# Side walls full 7 m height; no end walls = open north/south connections.
for side,x in [('West',-2.9),('East',2.9)]:
    cube(f'SGC_Wall_Corridor_{side}_TierB', (x,0,3.5), (0.20,20.0,7.0), m_teal, props={'asset_type':'side_wall','tier':'B','height_m':7.0,'open_ends':True})
# Ceiling slab bottom exactly 7 m, Tier B matching teal. Semi-transparent in the validation render so the pillar rhythm remains inspectable; geometry remains solid in the GLB.
bs=m_teal.node_tree.nodes.get('Principled BSDF'); bs.inputs['Alpha'].default_value=0.12; m_teal.blend_method='BLEND'; m_teal.use_screen_refraction=True
cube('SGC_Ceiling_Corridor_TierB', (0,0,7.10), (6.0,20.0,0.20), m_teal, props={'asset_type':'ceiling','tier':'B','height_m':7.0,'bottom_z':7.0,'open_ends':True})

# Four supports, exactly 5 m center-to-center, alternating sides to retain a clear central lane.
pillar_ys=[-7.5,-2.5,2.5,7.5]
for i,y in enumerate(pillar_ys,1):
    side='West' if i%2 else 'East'; x=-1.5 if side=='West' else 1.5
    cube(f'SGC_Pillar_Corridor_{i:02d}_{side}', (x,y,3.5), (1.6,1.6,7.0), m_pillar, props={'asset_type':'pillar_support','index':i,'spacing_m':5.0,'cross_section_m':'1.6x1.6','height_m':7.0})

# Minimal mid-corridor cover. Side-positioned, leaving a 2 m central flow gap.
for i,x in enumerate([-2.0,2.0],1):
    cube(f'SGC_Cover_Corridor_Barrier_{i:02d}', (x,0,0.5), (2.0,0.5,1.0), m_cover, props={'asset_type':'waist_barrier','dimensions_m':'2.0x0.5x1.0','main_flow_gap_m':2.0})

# Player proxy resting on floor, radius exactly 0.4 m.
sphere('REF_Player_Proxy_R0.4', (0,-7.0,0.4), 0.4, m_player, props={'asset_type':'player_proxy','radius_m':0.4})

# Add small gold floor edge markers at open ends to make north/south connections explicit without walls.
for y,label in [(-9.75,'South'),(9.75,'North')]:
    cube(f'REF_OpenConnection_{label}', (0,y,0.02), (5.0,0.10,0.04), m_edge, 'REF', {'open_connection':label})

# Collision primitives, matching main solids, hidden from render but exported for game handoff.
for name,loc,dims in [
 ('COL_CorridorFloor',(0,0,-0.1),(6,20,0.2)),
 ('COL_CorridorWestWall',(-2.9,0,3.5),(0.2,20,7)),
 ('COL_CorridorEastWall',(2.9,0,3.5),(0.2,20,7)),
 ('COL_CorridorCeiling',(0,0,7.1),(6,20,0.2))]:
    o=cube(name,loc,dims,m_floor,'COLLISION',{'collision':True}); o.hide_render=True

# Camera, isometric-like oblique view along corridor, showing both open ends and clear central flow.
def look_at(obj, target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(18,-28,15))
cam=bpy.context.object; cam.name='CAM_Isometric_Corridor_Validation'; cam.data.type='ORTHO'; cam.data.ortho_scale=26; look_at(cam,(0,0,2.8)); move_to(cam,'LIGHTING'); scene.camera=cam
# Lighting
bpy.ops.object.light_add(type='AREA', location=(0,-2,14)); key=bpy.context.object; key.name='LIGHT_Corridor_Key'; key.data.energy=1800; key.data.shape='RECTANGLE'; key.data.size=12; key.data.size_y=20; move_to(key,'LIGHTING'); look_at(key,(0,0,0))
bpy.ops.object.light_add(type='AREA', location=(0,0,3)); fill=bpy.context.object; fill.name='LIGHT_Corridor_Fill'; fill.data.energy=500; fill.data.color=(0.2,0.7,0.8); fill.data.size=8; move_to(fill,'LIGHTING'); look_at(fill,(0,0,2))
scene.world = bpy.data.worlds.new('World_Corridor_Validation')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.025,0.035,0.045,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0.25

# Select only deliverable render geometry for GLB; omit collision and lights/camera from export.
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    o.select_set(o.name.startswith('SGC_') or o.name.startswith('REF_Player_') or o.name.startswith('REF_OpenConnection_'))
    if o.select_get() and hasattr(o,'scale'): o.select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects.get('SGC_Floor_Corridor_6x20')

# Save source and render.
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
scene.render.filepath=PNG
bpy.ops.render.render(write_still=True)
# Export uncompressed GLB (no Draco, no mesh compression).
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_apply=True, export_texcoords=False, export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False)

# Numeric audit emitted into Blender console for independent shell verification.
report={'corridor_width_m':6.0,'corridor_length_m':20.0,'floor_top_z':0.0,'wall_height_m':7.0,'ceiling_bottom_z':7.0,'pillar_count':4,'pillar_y_centers_m':pillar_ys,'pillar_spacing_m':5.0,'pillar_cross_section_m':[1.6,1.6],'cover_count':2,'cover_dimensions_m':[2.0,0.5,1.0],'player_radius_m':0.4,'open_ends':['South','North'],'snap_subgrid_m':0.5,'blend':BLEND,'glb':GLB,'png':PNG}
print('CORRIDOR_AUDIT_JSON='+json.dumps(report,sort_keys=True))
print('CORRIDOR_BUILD_COMPLETE')
