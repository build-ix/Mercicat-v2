import os, io, json, math, struct, base64
from PIL import Image, ImageDraw

OUT='/home/alfr/mercicat-rebuild/packages/client/public/assets/characters'
os.makedirs(OUT, exist_ok=True)

# Create lightweight authored textures (also embedded into the GLB).
def texture(path, base, accents):
    im=Image.new('RGBA',(512,512),base); d=ImageDraw.Draw(im)
    for y in range(0,512,32): d.line((0,y,512,y),fill=accents[0],width=2)
    for x in range(0,512,64): d.line((x,0,x,512),fill=accents[1],width=1)
    im.save(path)
    return im
fur=texture(os.path.join(OUT,'tabby-protagonist-diffuse.png'),(190,83,27,255),[(110,39,17,150),(235,145,61,90)])
normal=Image.new('RGBA',(512,512),(128,128,255,255)); normal.save(os.path.join(OUT,'tabby-protagonist-normal.png'))
ao=Image.new('L',(512,512),210); ao.save(os.path.join(OUT,'tabby-protagonist-ao.png'))

# GLB builder
buf=bytearray(); views=[]; accessors=[]; meshes=[]; nodes=[]; materials=[]; images=[]
def align():
    while len(buf)%4: buf.append(0)
def add_blob(b, target=None):
    align(); off=len(buf); buf.extend(b); align(); views.append({'buffer':0,'byteOffset':off,'byteLength':len(b),**({'target':target} if target else {})}); return len(views)-1
def accessor(view, typ, comp, count, mn=None, mx=None, byteoffset=0):
    a={'bufferView':view,'byteOffset':byteoffset,'componentType':comp,'count':count,'type':typ}
    if mn is not None:a['min']=mn
    if mx is not None:a['max']=mx
    accessors.append(a); return len(accessors)-1

def mesh(name, verts, norms, uvs, inds, mat):
    vb=struct.pack('<'+'f'*len(verts),*verts); nb=struct.pack('<'+'f'*len(norms),*norms); ub=struct.pack('<'+'f'*len(uvs),*uvs); ib=struct.pack('<'+'H'*len(inds),*inds)
    vp=add_blob(vb,34962); np=add_blob(nb,34962); uvp=add_blob(ub,34962); ip=add_blob(ib,34963)
    v=[verts[i:i+3] for i in range(0,len(verts),3)]
    prim={'attributes':{'POSITION':accessor(vp,'VEC3',5126,len(v),[min(x[j] for x in v) for j in range(3)],[max(x[j] for x in v) for j in range(3)]),'NORMAL':accessor(np,'VEC3',5126,len(v)),'TEXCOORD_0':accessor(uvp,'VEC2',5126,len(uvs)//2)},'indices':accessor(ip,'SCALAR',5123,len(inds)),'material':mat}
    meshes.append({'name':name,'primitives':[prim]}); return len(meshes)-1

def mat(name, color, texidx=0, metallic=0.0, rough=.7):
    p={'baseColorFactor':[*color,1],'metallicFactor':metallic,'roughnessFactor':rough}
    if texidx is not None:p['baseColorTexture']={'index':texidx}
    materials.append({'name':name,'pbrMetallicRoughness':p}); return len(materials)-1
# Image URI buffer views added later; texture slots use indices.
furmat=mat('Warm orange fur with tabby stripes',(0.8,.25,.07),0,0,.9)
blackmat=mat('Black tactical fabric and armor',(.018,.022,.025),0,.35,.55)
metalmat=mat('Blued steel pistol',(.035,.04,.05),0,.8,.25)
leathermat=mat('Holster leather',(.04,.018,.01),0,.1,.8)

# primitive generators
def cube(sx,sy,sz,material):
    x,y,z=sx/2,sy/2,sz/2; vs=[]; ns=[]; uv=[]
    faces=[((-1,0,0),(-x,0,0)),((1,0,0),(x,0,0)),((0,-1,0),(0,-y,0)),((0,1,0),(0,y,0)),((0,0,-1),(0,0,-z)),((0,0,1),(0,0,z))]
    for n,c in faces:
        a=[(c[0]-x,c[1]-y,c[2]-z),(c[0]+x,c[1]-y,c[2]-z),(c[0]+x,c[1]+y,c[2]+z),(c[0]-x,c[1]+y,c[2]+z)]
        base=len(vs)//3
        for q in a:vs += list(q); ns += list(n); uv += [0,0,1,0,1,1,0,1]
    inds=[]
    for b in range(0,24,4):inds += [b,b+1,b+2,b,b+2,b+3]
    return mesh('cube',vs,ns,uv,inds,material)
def uv_sphere(rx,ry,rz,material, seg=16, rings=8):
    vs=[];ns=[];uv=[]
    for j in range(rings+1):
        v=j/rings; ph=math.pi*v
        for i in range(seg):
            u=i/seg; th=2*math.pi*u; nx=math.sin(ph)*math.cos(th); ny=math.sin(ph)*math.sin(th); nz=math.cos(ph)
            vs += [rx*nx,ry*ny,rz*nz]; ns += [nx,ny,nz]; uv += [u,v]
    inds=[]
    for j in range(rings):
        for i in range(seg):
            a=j*seg+i;b=j*seg+(i+1)%seg;c=(j+1)*seg+(i+1)%seg;d=(j+1)*seg+i;inds += [a,b,c,a,c,d]
    return mesh('sphere',vs,ns,uv,inds,material)
def cyl(r,depth,material, seg=12):
    vs=[];ns=[];uv=[]
    for z in (-depth/2,depth/2):
        for i in range(seg):
            a=2*math.pi*i/seg; vs += [r*math.cos(a),r*math.sin(a),z]; ns += [math.cos(a),math.sin(a),0];uv += [i/seg,z/depth+.5]
    inds=[]
    for i in range(seg): a=i;b=(i+1)%seg;inds += [a,b,seg+b,a,seg+b,seg+a]
    return mesh('cylinder',vs,ns,uv,inds,material)

def node(name, trans=(0,0,0), meshidx=None, parent=None):
    n={'name':name,'translation':list(trans)}
    if meshidx is not None:n['mesh']=meshidx
    nodes.append(n); idx=len(nodes)-1
    if parent is not None:nodes[parent].setdefault('children',[]).append(idx)
    return idx

# Skeleton, +Z up, +Y forward. Geometry is parented to logical bones; distinct pistol nodes remain independent.
bones={}
def bone(name,t,parent=None): bones[name]=node(name,t,parent=parent); return bones[name]
root=bone('Root',(0,0,1.0)); spine=bone('Spine',(0,0,1.0),root); upper=bone('SpineUpper',(0,0,.65),spine); chest=bone('Chest',(0,0,.55),upper); hips=bone('Hips',(0,0,-.35),spine)
neck=bone('Neck',(0,0,.62),chest); head=bone('Head',(0,.05,.36),neck); bone('LeftEar',(-.18,0,.2),head); bone('RightEar',(.18,0,.2),head)
for side,x in [('Left',-.24),('Right',.24)]:
    sh=bone(side+'Shoulder',(x,0,.32),chest); arm=bone(side+'Arm',(x*1.3,0,-.22),sh); fore=bone(side+'Forearm',(x*1.15,.02,-.28),arm); bone(side+'Hand',(x*1.0,.10,-.18),fore)
    hip=bone(side+'Hip',(x*.8,0,-.18),hips); leg=bone(side+'Leg',(x*.9,.02,-.45),hip); bone(side+'Foot',(x,.18,-.42),leg)
tail=bone('Tail',(0,-.5,-.1),hips); tail2=bone('Tail_02',(0,-.38,-.10),tail); bone('Tail_03',(0,-.32,-.08),tail2)
# body/gear meshes
node('FurBody',(0,0,1.35),uv_sphere(.55,.95,.7,furmat),chest); node('HeadFur',(0,.06,.35),uv_sphere(.48,.48,.46,furmat),head)
# muzzle and ears
node('Muzzle',(0,.43,.23),uv_sphere(.25,.20,.18,furmat),head)
node('LeftEar',(-.25,.02,.48),cube(.18,.18,.4,furmat),head);node('RightEar',(.25,.02,.48),cube(.18,.18,.4,furmat),head)
node('ArmorVest',(0,.1,.04),uv_sphere(.60,.72,.48,blackmat),chest); node('TacticalBelt',(0,.05,-.38),cube(1.05,.72,.16,blackmat),hips)
# webbing strips
for x in (-.34,0,.34): node('MOLLE_Webbing',(x,.48,.0),cube(.08,.05,.55,blackmat),chest)
for side,x in [('Left',-.38),('Right',.38)]:
    node(side+'JacketArm',(x,0,.0),cyl(.13,.75,blackmat),bones[side+'Arm']); node(side+'CombatBoot',(x,.16,-.62),cube(.25,.4,.18,blackmat),bones[side+'Foot'])
    node(side+'Holster',(x,.08,-.42),cube(.22,.28,.5,leathermat),hips)
    # independent pistol geometry, not parented to hands
    node(side+'9mm_Pistol',(x,.20,-.30),cube(.12,.36,.16,metalmat),hips); node(side+'PistolGrip',(x,.20,-.48),cube(.11,.12,.30,metalmat),hips)
node('TailFur',(0,-.85,.35),cyl(.16,.9,furmat),tail)
# nose/eyes
node('Nose',(0,.55,.28),uv_sphere(.08,.06,.06,leathermat),head); node('Eyes',(-.17,.40,.38),uv_sphere(.06,.04,.06,metalmat),head); node('Eyes',(.17,.40,.38),uv_sphere(.06,.04,.06,metalmat),head)

# animations: authored keyframes on logical bones; sufficient baked animation channels.
def quat(axis, angle):
    s=math.sin(angle/2); c=math.cos(angle/2); return [axis[0]*s,axis[1]*s,axis[2]*s,c]
def anim(name,dur,keys):
    times=[]; tblob=bytearray(); channels=[]
    for bone_name, vals in keys.items():
        # vals list (time, quaternion)
        start=len(times); times.extend([x[0] for x in vals]); data=[]
        for _,q in vals:data.extend(q)
        tv=add_blob(struct.pack('<'+'f'*len(times[start:]),*times[start:])); qv=add_blob(struct.pack('<'+'f'*len(data),*data))
        ti=accessor(tv,'SCALAR',5126,len(vals),[0],[dur]); qi=accessor(qv,'VEC4',5126,len(vals))
        si=len(channels); channels.append({'sampler':si,'target':{'node':bones[bone_name],'path':'rotation'}})
        if len(channels)==1: samplers=[]
    # reconstruct samplers based on accessors from channel order
    samplers=[]; base=len(accessors)-2*len(keys)
    for i in range(len(keys)):samplers.append({'input':base+i*2,'output':base+i*2+1,'interpolation':'LINEAR'})
    animations.append({'name':name,'samplers':samplers,'channels':channels})
animations=[]
def qbone(a): return quat((1,0,0),a)
anim('Idle',2.0,{'Spine':[(0,qbone(0)),(1,qbone(.03)),(2,qbone(0))],'Tail_03':[(0,qbone(0)),(1,qbone(.15)),(2,qbone(0))]})
anim('Walk',1.2,{'LeftLeg':[(0,qbone(.25)),(.6,qbone(-.25)),(1.2,qbone(.25))],'RightLeg':[(0,qbone(-.25)),(.6,qbone(.25)),(1.2,qbone(-.25))],'Tail':[(0,qbone(.1)),(.6,qbone(-.1)),(1.2,qbone(.1))]})
anim('Run',.8,{'LeftLeg':[(0,qbone(.5)),(.4,qbone(-.5)),(.8,qbone(.5))],'RightLeg':[(0,qbone(-.5)),(.4,qbone(.5)),(.8,qbone(-.5))],'Spine':[(0,qbone(-.08)),(.4,qbone(.08)),(.8,qbone(-.08))]})
anim('Aim',.5,{'LeftArm':[(0,qbone(0)),(.5,qbone(-1.0))],'RightArm':[(0,qbone(0)),(.5,qbone(-1.0))],'Head':[(0,qbone(0)),(.5,qbone(.12))]})
anim('Fire',.3,{'LeftArm':[(0,qbone(-1)),(.1,qbone(-.85)),(.3,qbone(-1))],'RightArm':[(0,qbone(-1)),(.1,qbone(-.85)),(.3,qbone(-1))]})
anim('Reload',.8,{'LeftArm':[(0,qbone(-1)),(.4,qbone(-.4)),(.8,qbone(-1))],'RightArm':[(0,qbone(-1)),(.4,qbone(-.4)),(.8,qbone(-1))]})
anim('Hurt',.6,{'Spine':[(0,qbone(0)),(.2,qbone(.3)),(.6,qbone(0))]})
anim('Death',2.0,{'Spine':[(0,qbone(0)),(1,qbone(1.2)),(2,qbone(1.2))],'Head':[(0,qbone(0)),(1,qbone(-.8)),(2,qbone(-.8))]})
anim('Victory',2.0,{'Tail':[(0,qbone(0)),(1,qbone(.8)),(2,qbone(0))],'LeftArm':[(0,qbone(0)),(1,qbone(-.8)),(2,qbone(0))]})

# Embedded PNGs: use same authored diffuse/normal/AO bytes as three glTF images.
for p in [os.path.join(OUT,'tabby-protagonist-diffuse.png'),os.path.join(OUT,'tabby-protagonist-normal.png'),os.path.join(OUT,'tabby-protagonist-ao.png')]:
    b=open(p,'rb').read(); v=add_blob(b); images.append({'bufferView':v,'mimeType':'image/png','name':os.path.basename(p)})
# Bind image 0 to texture 0; materials intentionally use a shared atlas for compactness.
textures=[{'source':0,'name':'tabby-protagonist-atlas'}]
scene_nodes=[root]
asset={'version':'2.0','generator':'Mercicat procedural fallback (Higgsfield MCP unavailable)','extras':{'orientation':'+Z up, +X right, +Y forward','scale':'1 unit = 1 inch','heightUnits':11,'provenance':'procedural local generation; not Higgsfield output'}}
gltf={'asset':asset,'scene':0,'scenes':[{'nodes':scene_nodes}],'nodes':nodes,'meshes':meshes,'materials':materials,'textures':textures,'images':images,'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],'bufferViews':views,'accessors':accessors,'buffers':[{'byteLength':len(buf)}],'animations':animations}
# Put JSON then binary, with JSON buffer references already relative to BIN (bufferViews offsets begin at zero).
j=json.dumps(gltf,separators=(',',':')).encode(); jp=j+b' ' *((4-len(j)%4)%4); bp=bytes(buf); total=12+8+len(jp)+8+len(bp)
out=struct.pack('<4sII',b'glTF',2,total)+struct.pack('<II',len(jp),0x4E4F534A)+jp+struct.pack('<II',len(bp),0x004E4942)+bp
open(os.path.join(OUT,'tabby-protagonist.glb'),'wb').write(out)
print('wrote',os.path.join(OUT,'tabby-protagonist.glb'),len(out),'bytes')
print('bones',len(bones),sorted(bones)); print('animations',[a['name'] for a in animations])
