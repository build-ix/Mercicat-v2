import bpy, math, struct, json, os
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath='/home/alfr/mercicat-rebuild/blender/saltglass_spawn_zone_graybox.blend')
fail=[]
def near(a,b,t=1e-4): return abs(a-b)<t
# exact objects
def dims(n): return tuple(round(v,4) for v in bpy.data.objects[n].dimensions)
checks={
'floor_dims': dims('SGC_Floor_SpawnZone_30x30') == (30,30,0.2),
'floor_origin_z0': near(bpy.data.objects['SGC_Floor_SpawnZone_30x30'].location.z,0),
'pad_dims': dims('SGC_StagingPad_12x12') == (12,12,0.1),
'ceiling_z10': near(bpy.data.objects['SGC_Ceiling_SpawnZone_30x30'].location.z,10),
'throat_dims': dims('SGC_ExitThroat_6x8') == (6,8,0.2),
'player_radius': near(bpy.data.objects['REF_Player_Proxy'].dimensions.x,0.8),
'crate_count': len([o for o in bpy.data.objects if o.name.startswith('SGC_Crate_LowCover_')])==6,
'waist_wall_count': len([o for o in bpy.data.objects if o.name.startswith('SGC_WaistWall_')])==2,
'spawn_count': len([o for o in bpy.data.objects if o.name.startswith('ZONE_SPAWN_')])==4,
}
pts=[]
for n in ['N','S','W','E']:
 o=bpy.data.objects['ZONE_SPAWN_'+n]; pts.append(o.location.copy()); checks['facing_'+n]=all(near(v,0) for v in o.rotation_euler) and o.get('facing')=='+Y'
checks['ring_4m']=all(near(math.hypot(p.x,p.y+68),4) for p in pts)
ordered=[bpy.data.objects['ZONE_SPAWN_'+n].location.copy() for n in ['N','E','S','W']]
checks['90deg_spacing']=all(abs(math.dist((ordered[i].x,ordered[i].y),(ordered[(i+1)%4].x,ordered[(i+1)%4].y))-4*math.sqrt(2)) < 1e-5 for i in range(4))
# throat clear: no exported cover/walls intrude into x [-3,3], y [-53,-45], excluding side walls
blockers=[]
for o in bpy.data.collections['EXPORT'].objects:
 if any(k in o.name for k in ['Crate','WaistWall']):
  xmin=o.location.x-o.dimensions.x/2; xmax=o.location.x+o.dimensions.x/2
  ymin=o.location.y-o.dimensions.y/2; ymax=o.location.y+o.dimensions.y/2
  if xmax>-3 and xmin<3 and ymax>-53 and ymin<-45: blockers.append(o.name)
checks['clear_escape_route']=not blockers
checks['no_enemy_objects']=not any('enemy' in o.name.lower() for o in bpy.data.objects)
for k,v in checks.items():
 print(k, 'PASS' if v else 'FAIL');
 if not v: fail.append(k)
print('blockers',blockers)
print('RESULT', 'PASS' if not fail else 'FAIL '+str(fail))
# GLB JSON chunk validation
glb='/home/alfr/mercicat-rebuild/blender/saltglass_spawn_zone_graybox.glb'
with open(glb,'rb') as f:
 h=f.read(12); magic,version,total=struct.unpack('<4sII',h); c_len,c_type=struct.unpack('<II',f.read(8)); raw=f.read(c_len)
 j=json.loads(raw.decode('utf-8').rstrip(' '))
print('glb_header',magic,version,'bytes',os.path.getsize(glb),'nodes',len(j.get('nodes',[])))
print('glb_spawn_nodes',sum(1 for n in j.get('nodes',[]) if str(n.get('name','')).startswith('ZONE_SPAWN_')))
print('glb_required_named_nodes', [n.get('name') for n in j.get('nodes',[]) if n.get('name') in ['SGC_Floor_SpawnZone_30x30','SGC_StagingPad_12x12','SGC_ExitThroat_6x8']])
raise SystemExit(1 if fail else 0)
