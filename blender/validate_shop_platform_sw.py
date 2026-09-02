import bpy, json, math, os
from mathutils import Vector

errors=[]; checks=[]
def check(label, ok, detail):
    checks.append({'check':label,'ok':bool(ok),'detail':detail})
    if not ok: errors.append(label)

def obj(name): return bpy.data.objects.get(name)
platform=obj('SGC_Platform_Shop_SW_15x15'); counter=obj('SGC_Prop_ShopCounter_Centered'); ramp=obj('SGC_Approach_Ramp_Primary_ChokeC'); player=obj('REF_Player_Proxy_Radius_0p4m')
check('platform_exists', platform is not None, str(platform))
check('platform_dimensions', platform and all(abs(a-b)<1e-6 for a,b in zip(platform.dimensions,(15,15,0.2))), str(tuple(platform.dimensions)))
check('platform_center_xy', platform and tuple(round(v,6) for v in platform.location[:2])==(-42.0,-42.0), str(tuple(platform.location)))
check('platform_top_z_1m', platform and abs(platform.location.z+platform.dimensions.z/2-1.0)<1e-6, str(platform.location.z+platform.dimensions.z/2))
check('counter_dimensions', counter and all(abs(a-b)<1e-6 for a,b in zip(counter.dimensions,(4,1.2,1.1))), str(tuple(counter.dimensions)))
check('counter_centered', counter and tuple(round(v,6) for v in counter.location[:2])==(-42.0,-42.0), str(tuple(counter.location)))
check('counter_on_platform', counter and abs(counter.location.z-counter.dimensions.z/2-1.0)<1e-6, str(counter.location.z-counter.dimensions.z/2))
check('ramp_contract', ramp and ramp.get('width_m')==4.0 and ramp.get('run_m')==5.0 and ramp.get('rise_m')==1.0, str(dict(ramp.items()) if ramp else None))
stairs=[obj('SGC_Approach_Stair_Secondary_ChokeB_%02d'%i) for i in range(1,5)]
check('four_stair_steps', all(stairs), str([bool(s) for s in stairs]))
check('stair_width_2p4', all(abs(s.dimensions.x-2.4)<1e-6 for s in stairs), str([tuple(s.dimensions) for s in stairs]))
ramp_ymax=max((v.co.y for v in ramp.data.vertices), default=0.0) if ramp else 0.0
stair_ymin=min((s.location.y-s.dimensions.y/2 for s in stairs if s), default=0.0)
check('distinct_approach_paths', ramp and all(stairs) and ramp_ymax >= -34.5 and stair_ymin <= -50.0, 'ramp reaches north platform edge; stairs reach south perimeter')
# clearance band: counter footprint must be inside usable 13x13 bounds, not in 1m band
check('counter_inside_usable_floor', counter and -48.0 <= counter.location.x-counter.dimensions.x/2 and counter.location.x+counter.dimensions.x/2 <= -36.0 and -48.0 <= counter.location.y-counter.dimensions.y/2 and counter.location.y+counter.dimensions.y/2 <= -36.0, str(tuple(counter.location)))
check('ceiling_7m', obj('SGC_Ceiling_TierB_7m_N') and abs(obj('SGC_Ceiling_TierB_7m_N').location.z-8.0)<1e-6, str(obj('SGC_Ceiling_TierB_7m_N').location.z if obj('SGC_Ceiling_TierB_7m_N') else None))
check('player_radius_0p4', player and abs(player.dimensions.x-0.8)<1e-6 and player.get('radius_m')==0.4, str(tuple(player.dimensions) if player else None))
primary_meshes=[platform,counter,ramp,player]+[s for s in stairs if s]
check('snap_contract_primary', all(abs(v*2-round(v*2))<1e-6 for o in [platform,counter,player] if o for v in o.location[:2]), 'primary anchors on 0.5m grid; stair/clearance split centers are quarter-grid from exact 2.4m/4m openings')
print(json.dumps({'passed':not errors,'errors':errors,'checks':checks}, indent=2))
