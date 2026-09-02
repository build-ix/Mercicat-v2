import bpy, math, os
from mathutils import Vector

OUTDIR = '/home/alfr/mercicat-rebuild/blender'
BLEND = os.path.join(OUTDIR, 'saltglass_spawn_zone_graybox.blend')
GLB = os.path.join(OUTDIR, 'saltglass_spawn_zone_graybox.glb')
PNG = os.path.join(OUTDIR, 'saltglass_spawn_zone_graybox.png')

# Reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.length_unit = 'METERS'
scene.unit_settings.scale_length = 1.0
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1100
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = PNG
scene.world = bpy.data.worlds.new('World')
scene.world.color = (0.018, 0.025, 0.028)
# 0.5m snap contract
scene['scale_bible'] = 'Saltglass Cannery Phase 3C'
scene['snap_grid_m'] = 0.5
scene['spawn_zone_center'] = '(0,-68,0)'
scene['ceiling_height_m'] = 10.0

for name in ['REF','GRAYBOX','KIT','PROPS','COLLISION','LIGHTING','EXPORT']:
    c=bpy.data.collections.new(name); scene.collection.children.link(c)

def move(obj, colname):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    bpy.data.collections[colname].objects.link(obj)

def mat(name, color, metallic=0.0, rough=0.7, emission=None):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1)
    m.use_nodes=True; bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metallic; bs.inputs['Roughness'].default_value=rough
    if emission:
        bs.inputs['Emission'].default_value=(*emission,1); bs.inputs['Emission Strength'].default_value=2.5
    return m
M_FLOOR=mat('MAT_SGC_DampConcrete',(0.18,0.24,0.24),0,0.88)
M_PAD=mat('MAT_SGC_StagingPad',(0.28,0.34,0.33),0,0.78)
M_COVER=mat('MAT_SGC_CrateSteel',(0.32,0.20,0.12),0.25,0.65)
M_WALL=mat('MAT_SGC_WaistWall',(0.10,0.28,0.29),0.7,0.5)
M_EXIT=mat('MAT_SGC_ExitGuide',(0.85,0.36,0.08),0.15,0.5)
M_CYAN=mat('MAT_SGC_SpawnCyan',(0.0,0.8,0.95),0.0,0.25,emission=(0.0,0.7,1.0))
M_PLAYER=mat('MAT_SGC_PlayerProxy',(0.95,0.9,0.15),0.0,0.35)
M_CEIL=mat('MAT_SGC_Ceiling',(0.08,0.11,0.12),0.2,0.9)

def cube(name, loc, dims, material, collection='GRAYBOX', hide_render=False):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material); move(o,collection); o.hide_render=hide_render
    o['snap_grid_m']=0.5; o['dimensions_m']=tuple(dims)
    return o

def sphere(name, loc, radius, material, collection='REF'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=radius, location=loc)
    o=bpy.context.object; o.name=name; o.data.materials.append(material); move(o,collection)
    bpy.ops.object.shade_smooth(); o['snap_grid_m']=0.5; return o

def text_obj(name, body, loc, scale=1.0, rot=(math.pi/2,0,0)):
    cu=bpy.data.curves.new(name,'FONT'); cu.body=body; cu.align_x='CENTER'; cu.size=scale; cu.extrude=0.01
    o=bpy.data.objects.new(name,cu); bpy.data.collections['GRAYBOX'].objects.link(o); o.location=loc; o.rotation_euler=rot; cu.materials.append(M_EXIT); return o

# Main 30x30 floor at z=0 (top surface z=0)
floor=cube('SGC_Floor_SpawnZone_30x30',(0,-68,0),(30,30,0.2),M_FLOOR,'EXPORT')
# 12x12 central staging pad, top surface z=0.05
pad=cube('SGC_StagingPad_12x12',(0,-68,0),(12,12,0.1),M_PAD,'EXPORT')
# Exit throat: 6m clear width, 8m north of platform edge, floor continuation
throat=cube('SGC_ExitThroat_6x8',(0,-49,0),(6,8,0.2),M_FLOOR,'EXPORT')
# throat side jambs/walls keep 6m clear opening, open to arena at y=-45
cube('SGC_ExitThroatWall_West',(-3.25,-49,1.5),(0.5,8,3.0),M_WALL,'EXPORT')
cube('SGC_ExitThroatWall_East',(3.25,-49,1.5),(0.5,8,3.0),M_WALL,'EXPORT')
# Exit guide stripes outside route, not blocking
cube('SGC_ExitGuide_West',(-2.5,-49,0.0),(0.25,8,0.05),M_EXIT,'GRAYBOX')
cube('SGC_ExitGuide_East',(2.5,-49,0.0),(0.25,8,0.05),M_EXIT,'GRAYBOX')
text_obj('SGC_ExitLabel','NORTH EXIT',(0,-46.0,0.0),0.7)

# Four exact spawn points, 4m radius ring, all facing +Y (rotation 0)
spawn_data=[('N',(0,-72)),('S',(0,-64)),('W',(-4,-68)),('E',(4,-68))]
for label,(x,y) in spawn_data:
    o=sphere('ZONE_SPAWN_'+label,(x,y,0.5),0.5,M_CYAN,'EXPORT')
    o.rotation_euler=(0,0,0); o['facing']='+Y'; o['ring_radius_m']=4.0; o['spawn_anchor']=(x,y,0)
# Spawn ring marker as torus for validation/readability, center on floor
bpy.ops.mesh.primitive_torus_add(major_radius=4.0, minor_radius=0.035, major_segments=64, minor_segments=8, location=(0,-68,0.0))
ring=bpy.context.object; ring.name='SGC_SpawnRing_4m'; ring.data.materials.append(M_CYAN); move(ring,'GRAYBOX')

# Six 1m cubes in north half (y > -68), deliberately outside 6m throat and central escape route
crate_xy=[(-8,-63),(-5,-60),(8,-63),(5,-60),(-10,-56),(10,-56)]
for i,(x,y) in enumerate(crate_xy,1): cube('SGC_Crate_LowCover_%02d'%i,(x,y,0.5),(1,1,1),M_COVER,'EXPORT')
# Two 3x0.5x1 waist walls in north half, lateral cover vocabulary, outside route
cube('SGC_WaistWall_West',(-8,-66,0.5),(3,0.5,1),M_WALL,'EXPORT')
cube('SGC_WaistWall_East',(8,-66,0.5),(3,0.5,1),M_WALL,'EXPORT')

# Tier B 10m ceiling slabs covering spawn platform and throat; hidden only from validation render
cube('SGC_Ceiling_SpawnZone_30x30',(0,-68,10.0),(30,30,0.2),M_CEIL,'EXPORT',True)
cube('SGC_Ceiling_ExitThroat_6x8',(0,-49,10.0),(6,8,0.2),M_CEIL,'EXPORT',True)
# Player proxy: 0.4m radius, placed beside pad for clear scale reference
player=sphere('REF_Player_Proxy',(12,-68,0.5),0.4,M_PLAYER,'REF')
player['radius_m']=0.4; player['purpose']='scale reference'; player.rotation_euler=(0,0,0)
# Direction indicator on player: arrow-like thin cube along +Y
cube('REF_Player_Proxy_Facing',(12,-67.5,0.5),(0.12,0.5,0.12),M_PLAYER,'REF')

# Camera isometric from south-east, looking at route and staging pad
def look_at(obj, target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(28,-96,34))
cam=bpy.context.object; cam.name='CAM_Isometric_Validation'; cam.data.type='ORTHO'; cam.data.ortho_scale=43; look_at(cam,(0,-64,0)); scene.camera=cam; move(cam,'LIGHTING')
# Area lights
bpy.ops.object.light_add(type='AREA', location=(0,-68,18)); key=bpy.context.object; key.name='LIGHT_Key'; key.data.energy=1800; key.data.shape='DISK'; key.data.size=24; look_at(key,(0,-64,0)); move(key,'LIGHTING')
bpy.ops.object.light_add(type='AREA', location=(-18,-50,8)); fill=bpy.context.object; fill.name='LIGHT_Exit'; fill.data.energy=900; fill.data.size=12; look_at(fill,(0,-52,0)); move(fill,'LIGHTING')

# Select only export meshes for GLB (excluding REF, guides, camera/lights, ceiling still included)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.collections['EXPORT'].objects: o.select_set(True)
# save source
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
# render validation
bpy.ops.render.render(write_still=True)
# export uncompressed GLB
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.collections['EXPORT'].objects: o.select_set(True)
bpy.context.view_layer.objects.active=floor
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_apply=True, export_texcoords=False, export_normals=False, export_materials='EXPORT', export_cameras=False, export_lights=False)
# re-save after export
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print('SPAWN_ZONE_BUILD_OK')
print('BLEND',BLEND); print('GLB',GLB); print('PNG',PNG)
