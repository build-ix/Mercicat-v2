import bpy, math, os
from mathutils import Vector

OUT = '/home/alfr/mercicat-rebuild/blender/saltglass_brine_docks_graybox.blend'
RENDER = '/home/alfr/mercicat-rebuild/blender/saltglass_brine_docks_validation.png'

# Reset scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name != 'Collection': bpy.data.collections.remove(c)
root = bpy.context.scene.collection
if bpy.data.collections.get('Collection'):
    bpy.data.collections.remove(bpy.data.collections['Collection'])

collections = {}
for name in ['REF','GRAYBOX','KIT','PROPS','COLLISION','LIGHTING','EXPORT']:
    c = bpy.data.collections.new(name)
    root.children.link(c)
    collections[name] = c

def link_to(obj, collection):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    collections[collection].objects.link(obj)

def mat(name, color, metallic=0.0, rough=0.8, emission=None):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metallic
    bs.inputs['Roughness'].default_value=rough
    if emission:
        bs.inputs['Emission'].default_value=(*emission,1)
        bs.inputs['Emission Strength'].default_value=1.5
    return m
m_floor=mat('mat_damp_concrete',(0.22,0.28,0.28),0,0.9)
m_wall=mat('mat_oxidized_teal',(0.08,0.30,0.30),0.75,0.55)
m_lane=mat('mat_lane_marker',(0.70,0.38,0.08),0.15,0.65)
m_cover=mat('mat_cover_crate',(0.38,0.20,0.10),0.05,0.9)
m_spawn=mat('mat_spawn_marker',(0.12,0.52,0.80),0.15,0.4, (0.05,0.3,0.8))
m_exit=mat('mat_exit_marker',(0.95,0.55,0.10),0.1,0.4, (0.8,0.2,0.03))
m_player=mat('mat_player_proxy',(0.85,0.85,0.85),0.1,0.35)

def cube(name, loc, dims, material, collection='GRAYBOX', bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material: o.data.materials.append(material)
    if bevel:
        mod=o.modifiers.new('purposeful_edge_bevel','BEVEL'); mod.width=bevel; mod.segments=2
    link_to(o, collection)
    return o

def cyl(name, loc, radius, depth, material, collection='GRAYBOX'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=depth, location=loc)
    o=bpy.context.object; o.name=name
    if material: o.data.materials.append(material)
    link_to(o, collection); return o

def empty(name, loc, display='CIRCLE', size=0.5):
    o=bpy.data.objects.new(name,None); collections['GRAYBOX'].objects.link(o)
    o.location=loc; o.empty_display_type=display; o.empty_display_size=size
    return o

# Metric/snap scene contract
sc=bpy.context.scene
sc.unit_settings.system='METRIC'; sc.unit_settings.length_unit='METERS'; sc.unit_settings.scale_length=1.0
sc['grid_primary_m']=0.5; sc['grid_secondary_m']=0.25; sc['axis_contract']='+X east, +Y north, +Z up'
sc['area_dimensions_m']='20 x 20'; sc['primary_exit']='north / +Y toward Conveyor Spine'

# Main 20x20 floor, top surface z=0
floor=cube('GB_floor_brine_docks',(0,0,-0.1),(20,20,0.2),m_floor,'GRAYBOX',0.03)
floor['dimensions_m']='20 x 20 x 0.20'; floor['snap_grid_m']=0.5
# Perimeter walls: 3m standard, north split around 4m exit opening
cube('GB_wall_west',(-9.9,0,1.5),(0.2,20,3),m_wall,'GRAYBOX',0.03)
cube('GB_wall_east',(9.9,0,1.5),(0.2,20,3),m_wall,'GRAYBOX',0.03)
cube('GB_wall_south',(0,-9.9,1.5),(20,0.2,3),m_wall,'GRAYBOX',0.03)
cube('GB_wall_north_west',(-6,9.9,1.5),(8,0.2,3),m_wall,'GRAYBOX',0.03)
cube('GB_wall_north_east',(6,9.9,1.5),(8,0.2,3),m_wall,'GRAYBOX',0.03)
# Exit threshold and generous route marker toward Conveyor Spine (+Y)
cube('GB_exit_route',(0,7.5,0.025),(4,5,0.05),m_exit,'GRAYBOX',0.01)
exit_zone=empty('GB_zone_exit_conveyor_spine',(0,10,0),'ARROWS',1.0); exit_zone['direction']='+Y'; exit_zone['clear_width_m']=4.0
# Four natural lanes: evenly spaced, oriented north, with subtle start markers
lane_x=[-4.5,-1.5,1.5,4.5]
for i,x in enumerate(lane_x,1):
    sp=empty(f'GB_spawn_{i:02d}',(x,-7.0,0.05),'CIRCLE',0.4)
    sp['lane_assignment']=f'north_lane_{i:02d}'; sp['entry_direction']='+Y'; sp['clearance_m']=1.5
    cyl(f'GB_spawn_marker_{i:02d}',(x,-7.0,0.025),0.55,0.05,m_spawn,'GRAYBOX')
    cube(f'GB_lane_{i:02d}',(x,-3.0,0.03),(0.25,6,0.05),m_lane,'GRAYBOX',0.01)
# Player proxy: exact radius 0.4 sphere at origin
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.4, location=(0,0,0.4))
player=bpy.context.object; player.name='GB_player_proxy'; player.data.materials.append(m_player); link_to(player,'REF')
player['radius_m']=0.4; player['center_at_origin_xy']=True; player['purpose']='scale and tactical readability reference'
# 0.75m clearance guide as wireframe cylinder around origin
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.75, depth=0.03, location=(0,0,0.02))
guide=bpy.context.object; guide.name='GB_player_clearance_075m'; guide.display_type='WIRE'; link_to(guide,'REF')
# Minimal cover, each placed off-lane, leaving all four lanes and retreat route open
cube('GB_cover_crate_west',(-6.5,-1.5,0.75),(2,1.5,1.5),m_cover,'PROPS',0.08)
cube('GB_cover_crate_east',(6.5,1.0,0.75),(2,1.5,1.5),m_cover,'PROPS',0.08)
cube('GB_cover_bollard',(4.5,5.0,0.5),(1,1,1),m_cover,'PROPS',0.06)
# Tactically readable framing: exit arrow fins/markers, no corridor walls
for y in [5.5,7.5,9.0]:
    cube(f'GB_exit_marker_{str(y).replace(".","_")}',(0,y,0.08),(2.0,0.25,0.08),m_exit,'GRAYBOX',0.01)
# Simple collision proxies, hidden from render
for name,loc,dims in [
 ('COL_brine_docks_floor',(0,0,-0.1),(20,20,0.2)),
 ('COL_brine_docks_west',(-9.9,0,1.5),(0.2,20,3)),
 ('COL_brine_docks_east',(9.9,0,1.5),(0.2,20,3)),
 ('COL_brine_docks_south',(0,-9.9,1.5),(20,0.2,3)),
 ('COL_brine_docks_north_west',(-6,9.9,1.5),(8,0.2,3)),
 ('COL_brine_docks_north_east',(6,9.9,1.5),(8,0.2,3))]:
    o=cube(name,loc,dims,None,'COLLISION'); o.hide_render=True; o.hide_viewport=True
# Camera: 45-degree isometric-ish, north exit visible
bpy.ops.object.camera_add(location=(22,-22,22))
cam=bpy.context.object; cam.name='GB_camera_isometric_45'; link_to(cam,'LIGHTING')
def track(obj, target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
track(cam,(0,1.5,0)); cam.data.type='ORTHO'; cam.data.ortho_scale=27; cam.data.lens=50
sc.camera=cam
# Sun + area light for readable graybox
bpy.ops.object.light_add(type='AREA', location=(0,-2,18)); light=bpy.context.object; light.name='GB_light_readability'; light.data.energy=1800; light.data.shape='DISK'; light.data.size=15; track(light,(0,1,0)); link_to(light,'LIGHTING')
# World and render
sc.world.color=(0.035,0.045,0.05)
sc.render.engine='BLENDER_EEVEE'; sc.render.resolution_x=900; sc.render.resolution_y=900; sc.render.resolution_percentage=100
sc.render.filepath=RENDER
sc.render.image_settings.file_format='PNG'; sc.render.film_transparent=False
# Save and render validation
bpy.ops.wm.save_as_mainfile(filepath=OUT)
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('VALIDATION: saved', OUT)
print('VALIDATION: rendered', RENDER)
print('VALIDATION: objects', len(bpy.data.objects))
print('VALIDATION: lanes', [bpy.data.objects[f'GB_spawn_{i:02d}'].location[:2] for i in range(1,5)])
