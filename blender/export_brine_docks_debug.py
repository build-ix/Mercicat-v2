import bpy, os
path='/home/alfr/mercicat-rebuild/blender/saltglass_brine_docks_graybox.blend'
bpy.ops.wm.open_mainfile(filepath=path)
bpy.ops.object.select_all(action='DESELECT')
for c in ['GRAYBOX','PROPS']:
    col=bpy.data.collections.get(c)
    if col:
        for o in col.objects:
            if o.type=='MESH': o.select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects.get('GB_floor_brine_docks')
bpy.ops.export_scene.gltf(filepath='/home/alfr/mercicat-rebuild/blender/saltglass_brine_docks_debug.glb', export_format='GLB', use_selection=True, export_apply=True, export_cameras=False, export_lights=False)
print('EXPORTED_DEBUG_GLB')
