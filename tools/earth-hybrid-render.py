"""Cycles/OptiX Hero passes. Run in Blender 5.2; no old files are overwritten.

--preview renders three HOME candidates; --final B renders full-sphere pass set.
Shared V1.3 helpers are read as definitions only (its render driver is not executed).
"""
import ast, argparse, json, math, sys, time
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[1];ASSETS=ROOT/'public/textures/hero/earth/orbital-v12'
source=ast.parse((ROOT/'tools/earth-v13-ground-truth.py').read_text())
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'<shared-v13-helpers>','exec'))
parser=argparse.ArgumentParser();parser.add_argument('--preview',action='store_true');parser.add_argument('--final',choices=['A','B','C']);parser.add_argument('--size',type=int,default=2048)
opt=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=ROOT/'art/earth-hybrid';OUT.mkdir(parents=True,exist_ok=True)
frame=json.loads((OUT/'input/home-frame.json').read_text())
profiles={
 'A':{'name':'Deep Orbital Night','sunOffset':0,'land':(.19,.27,.40),'sun':1.9,'rough':.26,'fill':.018,'cloud':(.60,.69,.83),'air':1.15},
 'B':{'name':'Balanced Cinematic','sunOffset':0,'land':(.29,.36,.47),'sun':2.0,'rough':.28,'fill':.028,'cloud':(.70,.79,.91),'air':1.0},
 'C':{'name':'Near-Terminator Hero','sunOffset':18,'land':(.26,.33,.45),'sun':2.0,'rough':.23,'fill':.024,'cloud':(.66,.76,.90),'air':1.2}}
scene=bpy.context.scene
for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
scene.render.engine='CYCLES';scene.cycles.device='GPU';scene.cycles.samples=48 if opt.preview else 96
scene.cycles.use_denoising=True;scene.cycles.denoiser='OPTIX';scene.cycles.max_bounces=6;scene.cycles.transparent_max_bounces=12;scene.cycles.volume_bounces=2
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.refresh_devices()
devices=[]
for d in prefs.devices:
 d.use=d.type=='OPTIX' and '5060' in d.name
 if d.use:devices.append(d.name)
if not devices:raise RuntimeError('Required OptiX RTX 5060 Ti unavailable')
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
scene.view_settings.view_transform='AgX';scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.render.resolution_percentage=100
world=bpy.data.worlds.new('Orbital weak fill');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.16,.27,1)

def layer_materials(profile,sun):
 mats=[make_surface(),make_city(sun),make_cloud(),make_air()]
 for n in mats[0].node_tree.nodes:
  if n.bl_idname=='ShaderNodeMixRGB':n.inputs[2].default_value=(*profile['land'],1)
  if n.bl_idname=='ShaderNodeBsdfPrincipled' and n.inputs['IOR'].default_value<1.4:n.inputs['Roughness'].default_value=profile['rough']
 # Cloud texture is real optical thickness, not opaque gray paint. Discard back-facing pass coverage.
 m=mats[2];nodes=m.node_tree.nodes;links=m.node_tree.links
 for n in nodes:
  if n.bl_idname=='ShaderNodeBsdfPrincipled':n.inputs['Base Color'].default_value=(*profile['cloud'],1)
  if n.bl_idname=='ShaderNodeBump':n.inputs['Strength'].default_value=.10;n.inputs['Distance'].default_value=.00045
 mix=next(n for n in nodes if n.bl_idname=='ShaderNodeMixShader')
 alpha=mix.inputs[0].links[0].from_socket;geom=nodes.new('ShaderNodeNewGeometry')
 front=mathn(nodes,links,'SUBTRACT',1,geom.outputs['Backfacing']);links.new(mathn(nodes,links,'MULTIPLY',alpha,front),mix.inputs[0])
 return mats

def save(name,folder):
 scene.render.filepath=str(folder/(name+'.png'));t=time.monotonic();bpy.ops.render.render(write_still=True)
 elapsed=time.monotonic()-t
 # Linear RGBA retains energy, alpha and rollback; PNG is an AgX display preview only.
 scene.render.image_settings.file_format='OPEN_EXR';scene.render.image_settings.color_depth='16';scene.render.image_settings.exr_codec='ZIP'
 bpy.data.images['Render Result'].save_render(str(folder/(name+'.exr')),scene=scene)
 scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_depth='8'
 return {'pass':name,'seconds':elapsed,'samples':scene.cycles.samples}

results=[]
for key in (['A','B','C'] if opt.preview else [opt.final or 'B']):
 p=profiles[key]
 for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
 camWorld=matrix(frame['camera']['matrix']);sun=Vector(frame['sun'])
 if p['sunOffset']:
  # Explicit candidate light relation, recorded; never mutates the Web sun or camera.
  sun=Matrix.Rotation(math.radians(p['sunOffset']),3,camWorld.to_3x3()@Vector((0,1,0)))@sun
 mats=layer_materials(p,sun);objects=[import_mesh(data,m) for data,m in zip(frame['meshes'],mats)]
 camera_data=bpy.data.cameras.new('Aligned Hero Camera');camera=bpy.data.objects.new('Camera',camera_data);scene.collection.objects.link(camera)
 camera.matrix_world=camWorld;camera_data.sensor_fit='HORIZONTAL';scene.camera=camera
 if opt.preview:
  scene.render.resolution_x=1280;scene.render.resolution_y=720
  camera_data.angle=2*math.atan(math.tan(math.radians(frame['camera']['fov'])/2)*frame['camera']['aspect'])
 else:
  # Re-aim only the offline overscan camera; optical origin and actual Earth stay fixed.
  center=Vector(frame['earth']['position']);direction=center-camera.location
  camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
  radius=1.85*frame['earth']['scale'][0]
  camera_data.angle=2*math.asin(radius/direction.length)*1.12
  scene.render.resolution_x=opt.size;scene.render.resolution_y=opt.size
 sun_data=bpy.data.lights.new('Orbital Sun','SUN');sun_data.energy=p['sun'];sun_data.angle=math.radians(.53)
 sun_obj=bpy.data.objects.new('Orbital Sun',sun_data);scene.collection.objects.link(sun_obj);sun_obj.rotation_euler=sun.to_track_quat('Z','Y').to_euler()
 world.node_tree.nodes['Background'].inputs[1].default_value=p['fill']
 folder=OUT/('blender-preview' if opt.preview else 'passes');folder.mkdir(parents=True,exist_ok=True)
 if opt.preview:
  results.append({'candidate':key,'profile':p,**save('EARTH_HYBRID_GT_'+key,folder)})
 else:
  bpy.context.view_layer.update()
  meta={'candidate':key,'profile':p,'size':opt.size,'cameraWorld':[camera.matrix_world[r][c] for c in range(4) for r in range(4)],
    'cameraFov':math.degrees(camera_data.angle),'earthWorld':frame['earth']['matrix'],'earthCenter':frame['earth']['position'],
    'earthRadiusWorld':1.85*frame['earth']['scale'][0],'sunWorld':list(sun),'color':'linear EXR; AgX PNG reference'}
  results.append(save('EARTH_HYBRID_BEAUTY',folder))
  for role,visible in [('SURFACE',[0]),('CITY',[1]),('BODY',[0,1]),('CLOUD',[2]),('ATMOSPHERE',[3])]:
   for i,o in enumerate(objects):
    o.visible_camera=i in visible
    # Surface receives shadow from weather even when clouds are hidden to the camera.
    o.hide_render=(role=='CITY' and i!=1) or (role=='CLOUD' and i!=2) or (role=='ATMOSPHERE' and i in [1,2])
   if role=='ATMOSPHERE':
    # Surface is an occluder; use holdout so no black backing is baked into this RGBA reference.
    m,n,l=material('Ground Holdout');output=node(n,'ShaderNodeOutputMaterial');h=node(n,'ShaderNodeHoldout');l.new(h.outputs[0],output.inputs[0]);objects[0].data.materials[0]=m;objects[0].visible_camera=True
   results.append(save('EARTH_HYBRID_'+role,folder))
  for i,o in enumerate(objects):o.hide_render=False;o.visible_camera=True;o.data.materials[0]=mats[i]
  bpy.ops.wm.save_as_mainfile(filepath=str(folder/'EARTH_HYBRID_HERO.blend'))
  (folder/'hero-camera.json').write_text(json.dumps(meta,indent=2))
(OUT/('preview-report.json' if opt.preview else 'render-report.json')).write_text(json.dumps({'device':'OPTIX','gpu':devices,'blender':bpy.app.version_string,'results':results},indent=2))
print(json.dumps(results))
