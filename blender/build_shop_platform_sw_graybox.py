import bpy, math, os, json
from mathutils import Vector

ROOT = '/home/alfr/mercicat-rebuild/blender'
BLEND = os.path.join(ROOT, 'saltglass_shop_platform_sw_graybox.blend')
PNG = os.path.join(ROOT, 'saltglass_shop_platform_sw_validation.png')
GLB = os.path.join(ROOT, 'saltglass_shop_platform_sw_graybox.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
scene.unit_settings.length_unit = 'METERS'
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1000
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = PNG
scene.world = bpy.data.worlds.new('World')
scene.world.color = (0.025, 0.035, 0.04)

for n in ['REF','GRAYBOX','KIT','PROPS','COLLISION','LIGHTING','EXPORT']:
    c = bpy.data.collections.new(n); scene.collection.children.link(c)

def move(obj, col):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    bpy.data.collections[col].objects.link(obj)

def mat(name, color, metallic=0.0, rough=0.8, emission=None):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1)
    m.use_nodes=True; bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Metallic'].default_value=metallic; bs.inputs['Roughness'].default_value=rough
    if emission:
        bs.inputs['Emission'].default_value=(*emission,1); bs.inputs['Emission Strength'].default_value=1.5
    return m
M = {
 'floor': mat('MAT_SGC_DampConcrete',(0.18,0.22,0.22),0,0.88),
 'platform': mat('MAT_SGC_OxidizedTealSteel',(0.08,0.32,0.32),0.75,0.5),
 'band': mat('MAT_SGC_ClearanceBand',(0.75,0.28,0.06),0.2,0.5,(1.0,0.12,0.01)),
 'counter': mat('MAT_SGC_CounterSteel',(0.12,0.16,0.18),0.85,0.35),
 'approach': mat('MAT_SGC_ApproachSteel',(0.35,0.40,0.40),0.65,0.55),
 'ceiling': mat('MAT_SGC_Ceiling',(0.22,0.27,0.28),0.6,0.6),
 'player': mat('MAT_REF_Player',(0.05,0.8,0.95),0.1,0.3,(0.02,0.5,0.8)),
 'floor2': mat('MAT_SGC_ArenaFloor',(0.08,0.10,0.11),0,0.95),
}

def cube(name, loc, dims, material, col='GRAYBOX', bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc); o=bpy.context.object; o.name=name; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material); move(o,col)
    if bevel:
        mod=o.modifiers.new('Small edge bevel','BEVEL'); mod.width=bevel; mod.segments=1
    return o

def wedge(name, x0, y0, y1, z0, z1, width, material, col='GRAYBOX'):
    # exact rectangular ramp prism: low end at y0/z0, high end at y1/z1
    xL=x0-width/2; xR=x0+width/2
    verts=[(xL,y0,z0),(xR,y0,z0),(xL,y1,z1),(xR,y1,z1),(xL,y0,z0-0.2),(xR,y0,z0-0.2),(xL,y1,z1-0.2),(xR,y1,z1-0.2)]
    faces=[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
    me=bpy.data.meshes.new(name+'Mesh'); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); bpy.data.collections[col].objects.link(o); o.data.materials.append(material); return o

# Surrounding floor (context only)
cube('SGC_Floor_ArenaContext',(-42,-42,-0.10),(40,40,0.20),M['floor2'],'GRAYBOX')
# 15x15 platform, top exactly +1.0; center XY exactly (-42,-42)
platform=cube('SGC_Platform_Shop_SW_15x15',(-42,-42,0.90),(15,15,0.20),M['platform'],'GRAYBOX',0.03)
platform['contract_dimensions']='15.0 x 15.0 m'; platform['top_elevation_m']=1.0; platform['center_xy']=(-42.0,-42.0)
# Edge band, four 1m perimeter strips, intentionally open at north ramp and south stair
# x edges full y; y strips stop around openings
cube('GB_ClearanceBand_West',(-49,-42,1.015),(1,15,0.03),M['band'],'GRAYBOX')
cube('GB_ClearanceBand_East',(-35,-42,1.015),(1,15,0.03),M['band'],'GRAYBOX')
cube('GB_ClearanceBand_North_Left',(-46.25,-34,1.015),(6.5,1,0.03),M['band'],'GRAYBOX')
cube('GB_ClearanceBand_North_Right',(-37.75,-34,1.015),(6.5,1,0.03),M['band'],'GRAYBOX')
cube('GB_ClearanceBand_South_Left',(-46.8,-50,1.015),(4.4,1,0.03),M['band'],'GRAYBOX')
cube('GB_ClearanceBand_South_Right',(-37.2,-50,1.015),(4.4,1,0.03),M['band'],'GRAYBOX')
# primary ramp: north face toward arena/NE, exact 4 wide x 5 run x 1 rise
ramp=wedge('SGC_Approach_Ramp_Primary_ChokeC',-42,-39.5,-34.5,0.0,1.0,4.0,M['approach'],'GRAYBOX')
ramp['width_m']=4.0; ramp['run_m']=5.0; ramp['rise_m']=1.0; ramp['slope_degrees']=11.309932; ramp['facing']='arena_north'
# secondary south stair faces perimeter: 4 x .5 tread, exact 2.4 wide
for i in range(4):
    # first step low/south, final step meets platform top
    y=-50.0 + (i+0.5)*0.5
    h=0.25*(i+1)
    step=cube('SGC_Approach_Stair_Secondary_ChokeB_%02d'%(i+1),(-42,y,h/2),(2.4,0.5,h),M['approach'],'GRAYBOX')
    step['tread_m']=0.5; step['riser_m']=0.25; step['facing']='perimeter_south'
# Counter centered on platform usable floor; base on top surface
counter=cube('SGC_Prop_ShopCounter_Centered',(-42,-42,1.55),(4.0,1.2,1.1),M['counter'],'GRAYBOX',0.04)
counter['width_m']=4.0; counter['depth_m']=1.2; counter['height_m']=1.1; counter['center_xy']=(-42.0,-42.0)
# counter collision
cube('COL_ShopCounter',(-42,-42,1.55),(4.0,1.2,1.1),M['counter'],'COLLISION')
# 7m Tier B ceiling frame + semantic center marker (open frame keeps render readable)
for name,loc,dims in [
 ('SGC_Ceiling_TierB_7m_N',(-42,-34.0,8.0),(15.0,0.2,0.2)),('SGC_Ceiling_TierB_7m_S',(-42,-50.0,8.0),(15.0,0.2,0.2)),
 ('SGC_Ceiling_TierB_7m_W',(-49,-42,8.0),(0.2,15.0,0.2)),('SGC_Ceiling_TierB_7m_E',(-35,-42,8.0),(0.2,15.0,0.2))]: cube(name,loc,dims,M['ceiling'],'GRAYBOX')
ceiling=cube('SGC_Ceiling_TierB_7m_Clearance',(-42,-42,8.0),(0.2,0.2,0.2),M['ceiling'],'REF'); ceiling['height_above_platform_m']=7.0
# player proxy sphere at ramp approach, radius exactly .4
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.4, location=(-42,-37,0.4)); p=bpy.context.object; p.name='REF_Player_Proxy_Radius_0p4m'; p.data.materials.append(M['player']); move(p,'REF'); p['radius_m']=0.4
# labels as empties
for name,loc,text in [('ZONE_USABLE_FLOOR_13x13',(-42,-42,1.02),'13x13 usable floor'),('ZONE_PRIMARY_RAMP',(-42,-34.5,1.1),'RAMP Choke-C 4x5'),('ZONE_SECONDARY_STAIR',(-42,-49.5,1.0),'STAIR Choke-B 2.4W')]:
    e=bpy.data.objects.new(name,None); bpy.data.collections['REF'].objects.link(e); e.location=loc; e.empty_display_type='PLAIN_AXES'; e['label']=text
# camera
bpy.ops.object.camera_add(location=(-63,-66,48)); cam=bpy.context.object; cam.name='CAM_Isometric_Validation'; move(cam,'LIGHTING'); scene.camera=cam; cam.data.type='ORTHO'; cam.data.ortho_scale=34
# point camera at platform
q=(Vector((-42,-42,1.2))-cam.location).to_track_quat('-Z','Y'); cam.rotation_euler=q.to_euler()
# lights
bpy.ops.object.light_add(type='AREA', location=(-42,-42,28)); key=bpy.context.object; key.name='LGT_Isometric_Key'; key.data.energy=1800; key.data.shape='DISK'; key.data.size=20; move(key,'LIGHTING')
bpy.ops.object.light_add(type='AREA', location=(-55,-35,10)); fill=bpy.context.object; fill.name='LGT_Isometric_Fill'; fill.data.energy=900; fill.data.size=12; q=(Vector((-42,-42,1))-fill.location).to_track_quat('-Z','Y'); fill.rotation_euler=q.to_euler(); move(fill,'LIGHTING')
# export collection gets approved visible geometry only, exclude context/ref/collision/lighting
export_names=['SGC_Platform_Shop_SW_15x15','SGC_Prop_ShopCounter_Centered','SGC_Approach_Ramp_Primary_ChokeC']+[f'SGC_Approach_Stair_Secondary_ChokeB_{i:02d}' for i in range(1,5)] + [f'SGC_Ceiling_TierB_7m_{s}' for s in ['N','S','W','E']] + ['REF_Player_Proxy_Radius_0p4m']
for n in export_names:
    o=bpy.data.objects.get(n)
    if o: move(o,'EXPORT')
# render approved visible scene
for o in bpy.data.objects:
    if o.type=='MESH': o.hide_render=False
scene.render.filepath=PNG
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.render.render(write_still=True)
# select export only and export uncompressed GLB
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.collections['EXPORT'].objects: o.select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects['SGC_Platform_Shop_SW_15x15']
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_apply=True, export_cameras=False, export_lights=False, export_materials='EXPORT', export_draco_mesh_compression_enable=False)
# save after export state
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print('SHOP_BUILD_DONE', BLEND, PNG, GLB)
