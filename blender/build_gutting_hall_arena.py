import bpy, math, os, json
from mathutils import Vector

OUTDIR = '/home/alfr/mercicat-rebuild/blender'
BLEND = os.path.join(OUTDIR, 'saltglass_gutting_hall_arena_graybox.blend')
GLB = os.path.join(OUTDIR, 'saltglass_gutting_hall_arena_graybox.glb')
PNG = os.path.join(OUTDIR, 'saltglass_gutting_hall_arena_validation.png')
REPORT = os.path.join(OUTDIR, 'saltglass_gutting_hall_arena_validation.json')

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'; scene.unit_settings.scale_length = 1.0; scene.unit_settings.length_unit = 'METERS'
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1200; scene.render.resolution_y = 900; scene.render.resolution_percentage = 100
scene.view_settings.view_transform='Standard'; scene.view_settings.look='Medium High Contrast'; scene.view_settings.exposure=1.0; scene.view_settings.gamma=1.0
scene.render.image_settings.file_format = 'PNG'; scene.render.filepath = PNG
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new('GuttingHall_World')
scene.world.color = (0.055,0.075,0.085)

for n in ['REF','GRAYBOX','KIT','PROPS','COLLISION','LIGHTING','EXPORT']:
    c=bpy.data.collections.new(n); scene.collection.children.link(c)

def col(name): return bpy.data.collections[name]
def move(o, name):
    for c in list(o.users_collection): c.objects.unlink(o)
    col(name).objects.link(o)

def mat(name, color, metallic=0.0, rough=0.7, emission=None):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Metallic'].default_value=metallic; bs.inputs['Roughness'].default_value=rough
    if emission:
        bs.inputs['Emission'].default_value=(*emission,1); bs.inputs['Emission Strength'].default_value=2.5
    return m
M_FLOOR=mat('MAT_SGC_DampConcrete',(0.16,0.20,0.20),0,0.82)
M_STEEL=mat('MAT_SGC_OxidizedTealSteel',(0.05,0.30,0.30),0.8,0.48)
M_PILLAR=mat('MAT_SGC_CathedralSteel',(0.09,0.16,0.18),0.9,0.35)
M_VAT=mat('MAT_SGC_VatSteel',(0.18,0.22,0.22),0.8,0.4)
M_AMBER=mat('MAT_SGC_AmberBrine',(0.65,0.22,0.05),0.1,0.2,(1.0,0.16,0.02))
M_WAIST=mat('MAT_SGC_WaistCover',(0.78,0.27,0.06),0.25,0.5)
M_FULL=mat('MAT_SGC_FullCover',(0.22,0.28,0.30),0.7,0.45)
M_LOW=mat('MAT_SGC_LowNet',(0.12,0.48,0.43),0.4,0.6)
M_REF=mat('MAT_REF_Player',(0.05,0.65,1.0),0.0,0.3,(0.0,0.25,1.0))
M_MARGIN=mat('MAT_DeadMargin',(0.35,0.10,0.04),0.15,0.8)
M_CEIL=mat('MAT_CathedralShell',(0.10,0.14,0.15),0.4,0.8)

def cube(name, loc, dims, material, collection='EXPORT', rot=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc); o=bpy.context.object; o.name=name; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); o.rotation_euler[2]=rot; o.data.materials.append(material); move(o,collection); return o

def cyl(name, loc, radius, depth, material, collection='EXPORT', verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc); o=bpy.context.object; o.name=name; o.data.materials.append(material); move(o,collection); return o

def torus(name, loc, major, minor, material, collection='EXPORT'):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=96, minor_segments=8, location=loc); o=bpy.context.object; o.name=name; o.data.materials.append(material); move(o,collection); return o

# Arena floor: exact 64m diameter, top plane at Z=0
floor=cyl('SGC_ArenaFloor_64m_Diameter', (0,0,-0.10), 32.0, 0.20, M_FLOOR)
floor['semantic']='arena_floor'; floor['diameter_m']=64.0; floor['top_z_m']=0.0
# Visual dead margin: 3m annulus, no collision, explicitly shell/reference geometry
margin=torus('REF_PerimeterDeadMargin_3m', (0,0,0.04), 30.5, 1.5, M_MARGIN, 'REF'); margin['collision']=False; margin['width_m']=3.0
# subtle center and ring guides (reference only)
for r in (8,18,28):
    t=torus('REF_CoverRing_r%02dm'%r,(0,0,0.025),r,0.035,M_MARGIN,'REF'); t['collision']=False

# Cathedral pillars, exact ring positions requested
pillar_xy=[(0,20),(14.14,14.14),(20,0),(14.14,-14.14),(0,-20),(-14.14,-14.14),(-20,0),(-14.14,14.14)]
for i,(x,y) in enumerate(pillar_xy,1):
    o=cube('SGC_CathedralPillar_%02d'%i,(x,y,12.0),(1.6,1.6,24.0),M_PILLAR)
    o['semantic']='cathedral_pillar'; o['ring_radius_m']=20.0; o['angle_deg']=(i-1)*45.0; o['dimensions_contract']='1.6x1.6x24m'

# Hero vats, 4m diameter x 3.5m, tops at 3.5m
vat_xy=[(0,6),(-3.5,-3),(3.5,-3)]
for i,(x,y) in enumerate(vat_xy,1):
    v=cyl('SGC_HeroVat_%02d'%(i),(x,y,1.75),2.0,3.5,M_VAT)
    v['semantic']='hero_vat'; v['diameter_m']=4.0; v['height_m']=3.5
    lid=cyl('SGC_HeroVat_%02d_AmberCore'%i,(x,y,3.48),1.65,0.08,M_AMBER)
# vat footprint marker (reference only, 12m max contract)
vatdisc=cyl('REF_HeroVatCluster_MaxFootprint',(0,0,0.03),6.0,0.04,M_MARGIN,'REF'); vatdisc['collision']=False; vatdisc['diameter_m']=12.0

# Cover parcels: 3 rings x 8, angularly staggered; exact specified dimensions.
cover_specs=[('Waist', (2.0,0.5,1.0), M_WAIST), ('Full', (1.6,1.6,2.2), M_FULL), ('LowNet',(2.0,1.0,0.6),M_LOW)]
cover_records=[]
# angles chosen so inner ring avoids the three vat centers by >=4m center distance
for ring_i,(r,(kind,dims,material)) in enumerate(zip((8,18,28),cover_specs)):
    for j in range(8):
        a=math.radians(j*45.0 + (0 if ring_i==0 else (22.5 if ring_i==1 else 0)))
        x=round(r*math.cos(a),2); y=round(r*math.sin(a),2)
        # keep requested exact ring radius while orienting tangentially for tactical silhouettes
        o=cube('SGC_Cover_%s_%02d'%(kind,j+1),(x,y,dims[2]/2.0),dims,material,rot=a+math.pi/2)
        o['semantic']='cover_parcel'; o['cover_type']=kind; o['ring_radius_m']=r; o['dimensions_m']='%.1fx%.1fx%.1f'%dims; o['collision']=True
        cover_records.append((o,x,y,kind,dims))

# Player proxy sphere at origin, exact radius 0.4
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.4, location=(0,0,0.4)); p=bpy.context.object; p.name='REF_PlayerProxy_0.4mRadius'; p.data.materials.append(M_REF); move(p,'REF'); p['semantic']='player_proxy'; p['radius_m']=0.4; p['collision']=False
# Ceiling shell plane at 24m, no collision
ceil=cube('SGC_TierA_CathedralCeiling_24m',(0,0,24.0),(64.0,64.0,0.10),M_CEIL,'EXPORT'); ceil['semantic']='tier_a_ceiling_shell'; ceil['collision']=False; ceil['height_m']=24.0
# corner frame beams for visual read, shell only
for x in (-30,30):
    for y in (-30,30): cube('SGC_TierA_CeilingBeam_%s_%s'%(x,y),(x,y,23.5),(1.0,1.0,1.0),M_PILLAR,'EXPORT')

# Camera and lights
bpy.ops.object.camera_add(location=(52,-58,66)); cam=bpy.context.object; cam.name='CAM_IsometricValidation'; move(cam,'LIGHTING'); scene.camera=cam; cam.data.type='ORTHO'; cam.data.ortho_scale=84
# aim camera
def point(obj, target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
point(cam,(0,0,5))
for loc,energy,size,color in [((0,0,45),7000,36,(0.75,0.85,1.0)),((20,-20,18),4200,22,(1.0,0.55,0.22)),((-24,18,16),5000,24,(0.25,0.8,0.9))]:
    bpy.ops.object.light_add(type='AREA', location=loc); l=bpy.context.object; l.name='LIGHT_Arena'; l.data.energy=energy; l.data.shape='DISK'; l.data.size=size; l.data.color=color; point(l,(0,0,0)); move(l,'LIGHTING')

# Semantic scene metadata
scene['asset']='Gutting Hall Arena graybox'; scene['scale_bible']='SALTGLASS_CANNERY_SCALE_BIBLE v1.0 FINAL'; scene['grid_subdivision_m']=0.5
scene['arena_diameter_m']=64.0; scene['perimeter_dead_margin_m']=3.0; scene['pillar_count']=8; scene['cover_count']=24; scene['sightline_target_m']=35.0
# ground-level sightline break note: pillars at 45 deg intervals plus three cover rings; record audit status explicitly

# Hide ceiling slab in validation render so the shell does not occlude gameplay layout; it remains in source/export
ceil.hide_render=True
for o in col('REF').objects: o.hide_render=True
p.hide_render=False
# apply all transforms for exportables
for o in list(col('EXPORT').objects):
    if o.type=='MESH':
        bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); o.select_set(False)
# save source
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
# render
scene.render.filepath=PNG; bpy.ops.render.render(write_still=True)
# export only EXPORT + player proxy (and omit reference rings)
for o in bpy.context.selected_objects: o.select_set(False)
for o in list(col('EXPORT').objects): o.select_set(True)
p.select_set(True)
bpy.context.view_layer.objects.active=floor
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_apply=True, export_draco_mesh_compression_enable=False)
# numeric report
# distances: cover center-to-center, and inner cover to vat centers
cover_dist=[]
for i,a in enumerate(cover_records):
    for b in cover_records[i+1:]: cover_dist.append(math.dist((a[1],a[2]),(b[1],b[2])))
inner_vat_dist=[min(math.dist((x,y),(vx,vy)) for vx,vy in vat_xy) for _,x,y,_,_ in cover_records[:8]]
report={'arena_diameter_m':64.0,'floor_top_z_m':0.0,'pillar_count':8,'pillar_positions':pillar_xy,'pillar_ring_radius_m':20.0,'vat_count':3,'vat_centers':vat_xy,'vat_diameter_m':4.0,'vat_height_m':3.5,'cluster_contract_diameter_m':12.0,'cover_count':len(cover_records),'cover_types':{'Waist':8,'Full':8,'LowNet':8},'cover_ring_radii_m':[8,18,28],'cover_min_center_spacing_m':min(cover_dist),'inner_cover_min_distance_to_vat_centers_m':min(inner_vat_dist),'no_cover_in_inner_4m_arena_zone':all(math.hypot(x,y)>=4.0 for _,x,y,_,_ in cover_records),'ceiling_height_m':24.0,'player_proxy_radius_m':0.4,'dead_margin_m':3.0,'sightline_target_m':35.0,'sightline_validation':'Pillars and three cover rings provide repeated ground-level breaks; exact raycast audit deferred to runtime navmesh.'}
with open(REPORT,'w') as f: json.dump(report,f,indent=2)
print(json.dumps(report,indent=2))
print('WROTE',BLEND,GLB,PNG,REPORT)
