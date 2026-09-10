"""Cycles/OptiX orbital reference from an exported real Three.js frame.

blender --background --factory-startup --python tools/earth-v13-ground-truth.py -- --input art/earth-v13/ground-truth-1
This is an offline material reference, never a runtime plate or texture replacement.
"""
import argparse, json, math, time
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

args=argparse.ArgumentParser();args.add_argument('--input',default='art/earth-v13/ground-truth-1');args.add_argument('--samples',type=int,default=64)
import sys
opt=args.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/opt.input
ASSETS=ROOT/'public/textures/hero/earth/orbital-v12'

def matrix(values):return Matrix([values[i:i+4] for i in range(0,16,4)]).transposed()
def material(name):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.node_tree.nodes.clear()
    return m,m.node_tree.nodes,m.node_tree.links
def node(nodes,kind):return nodes.new(kind)
def image(nodes,file,data=False):
    n=node(nodes,'ShaderNodeTexImage');n.image=bpy.data.images.load(str(ASSETS/file),check_existing=True)
    n.image.colorspace_settings.name='Non-Color' if data else 'sRGB';n.interpolation='Linear'
    return n
def mathn(nodes,links,operation,a,b=None):
    n=node(nodes,'ShaderNodeMath');n.operation=operation
    for i,value in enumerate([a,b]):
        if value is None:continue
        if hasattr(value,'node'):links.new(value,n.inputs[i])
        else:n.inputs[i].default_value=value
    return n.outputs[0]
def vector(nodes,links,operation,a,b):
    n=node(nodes,'ShaderNodeVectorMath');n.operation=operation
    for i,value in enumerate([a,b]):
        if hasattr(value,'node'):links.new(value,n.inputs[i])
        else:n.inputs[i].default_value=value
    return n.outputs['Value'] if operation=='DOT_PRODUCT' else n.outputs['Vector']

def make_surface():
    m,n,l=material('GT_Land_Ocean');out=node(n,'ShaderNodeOutputMaterial')
    day=image(n,'earth-orbital-surface.webp');packed=image(n,'earth-orbital-normal-land.webp',True)
    normal=node(n,'ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.16;l.new(packed.outputs['Color'],normal.inputs['Color'])
    land=node(n,'ShaderNodeBsdfPrincipled');land.inputs['Roughness'].default_value=.82
    tint=node(n,'ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1;tint.inputs[2].default_value=(.40,.49,.64,1)
    l.new(day.outputs['Color'],tint.inputs[1]);l.new(tint.outputs[0],land.inputs['Base Color']);l.new(normal.outputs[0],land.inputs['Normal'])
    water=node(n,'ShaderNodeBsdfPrincipled');water.inputs['Base Color'].default_value=(.0018,.005,.012,1)
    water.inputs['Roughness'].default_value=.24;water.inputs['IOR'].default_value=1.333
    mix=node(n,'ShaderNodeMixShader');l.new(packed.outputs['Alpha'],mix.inputs[0]);l.new(water.outputs[0],mix.inputs[1]);l.new(land.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],out.inputs['Surface'])
    return m
def make_city(sun):
    m,n,l=material('GT_Geographic_Cities');out=node(n,'ShaderNodeOutputMaterial')
    tex=image(n,'earth-orbital-city.webp',True);separate=node(n,'ShaderNodeSeparateColor');l.new(tex.outputs[0],separate.inputs[0])
    a=mathn(n,l,'MULTIPLY',separate.outputs['Red'],.16);b=mathn(n,l,'MULTIPLY',separate.outputs['Green'],1.25);c=mathn(n,l,'MULTIPLY',separate.outputs['Blue'],3.6)
    energy=mathn(n,l,'ADD',mathn(n,l,'ADD',a,b),c)
    geom=node(n,'ShaderNodeNewGeometry');dot=vector(n,l,'DOT_PRODUCT',geom.outputs['Normal'],sun)
    night=mathn(n,l,'SUBTRACT',.35,mathn(n,l,'MULTIPLY',dot,2.5));night=mathn(n,l,'MAXIMUM',0,mathn(n,l,'MINIMUM',night,1))
    emit=node(n,'ShaderNodeEmission');emit.inputs['Color'].default_value=(1,.78,.48,1);l.new(mathn(n,l,'MULTIPLY',energy,night),emit.inputs['Strength'])
    trans=node(n,'ShaderNodeBsdfTransparent');add=node(n,'ShaderNodeAddShader');l.new(trans.outputs[0],add.inputs[0]);l.new(emit.outputs[0],add.inputs[1]);l.new(add.outputs[0],out.inputs['Surface'])
    return m
def make_cloud():
    m,n,l=material('GT_Weather_Clouds');out=node(n,'ShaderNodeOutputMaterial');tex=image(n,'earth-orbital-cloud.webp',True)
    rgb=node(n,'ShaderNodeSeparateColor');l.new(tex.outputs[0],rgb.inputs[0]);density=rgb.outputs['Red']
    tau=mathn(n,l,'MULTIPLY',density,-2.8);alpha=mathn(n,l,'SUBTRACT',1,mathn(n,l,'EXPONENT',tau))
    cloud=node(n,'ShaderNodeBsdfPrincipled');cloud.inputs['Base Color'].default_value=(.65,.72,.82,1);cloud.inputs['Roughness'].default_value=.9
    bump=node(n,'ShaderNodeBump');bump.inputs['Strength'].default_value=.14;bump.inputs['Distance'].default_value=.0007;l.new(rgb.outputs['Green'],bump.inputs['Height']);l.new(bump.outputs[0],cloud.inputs['Normal'])
    trans=node(n,'ShaderNodeBsdfTransparent');mix=node(n,'ShaderNodeMixShader');l.new(alpha,mix.inputs[0]);l.new(trans.outputs[0],mix.inputs[1]);l.new(cloud.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],out.inputs['Surface'])
    return m
def make_air():
    m,n,l=material('GT_Thin_Atmosphere');out=node(n,'ShaderNodeOutputMaterial');coords=node(n,'ShaderNodeTexCoord')
    centered=vector(n,l,'SUBTRACT',coords.outputs['Generated'],(.5,.5,.5));norm=node(n,'ShaderNodeVectorMath');norm.operation='LENGTH';l.new(centered,norm.inputs[0])
    h=mathn(n,l,'SUBTRACT',mathn(n,l,'MULTIPLY',norm.outputs['Value'],3.78),1.85)
    rho=mathn(n,l,'MULTIPLY',mathn(n,l,'EXPONENT',mathn(n,l,'MULTIPLY',mathn(n,l,'MAXIMUM',h,0),-1/.006)),.72)
    scatter=node(n,'ShaderNodeVolumeScatter');scatter.inputs['Color'].default_value=(.18,.43,.95,1);scatter.inputs['Anisotropy'].default_value=.30;l.new(rho,scatter.inputs['Density']);l.new(scatter.outputs[0],out.inputs['Volume'])
    return m
def import_mesh(data,mat):
    mesh=bpy.data.meshes.new(data['name']);p=data['positions'];idx=data['indices'];uv=data['uv']
    mesh.from_pydata([p[i:i+3] for i in range(0,len(p),3)],[],[idx[i:i+3] for i in range(0,len(idx),3)]);mesh.update()
    layer=mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        poly.use_smooth=True
        for loop_index in poly.loop_indices:
            v=mesh.loops[loop_index].vertex_index;layer.data[loop_index].uv=uv[2*v:2*v+2]
    obj=bpy.data.objects.new(data['name'],mesh);bpy.context.collection.objects.link(obj);obj.matrix_world=matrix(data['matrix']);obj.data.materials.append(mat)
    return obj

scene=bpy.context.scene
for obj in list(scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
scene.render.engine='CYCLES';scene.cycles.device='GPU';scene.cycles.samples=opt.samples;scene.cycles.use_denoising=True
scene.cycles.max_bounces=6;scene.cycles.transparent_max_bounces=8;scene.cycles.volume_bounces=2
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.refresh_devices()
devices=[]
for device in prefs.devices:
    device.use=device.type=='OPTIX' and '5060' in device.name
    if device.use:devices.append(device.name)
if not devices:raise RuntimeError('RTX 5060 OptiX unavailable; no silent CPU render')
scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.color_depth='8'
scene.view_settings.view_transform='AgX';scene.view_settings.exposure=0;scene.view_settings.gamma=1
world=bpy.data.worlds.new('Black Space / Weak Orbital Fill');scene.world=world;world.use_nodes=True
wn=world.node_tree.nodes;wl=world.node_tree.links;wn.clear();output=node(wn,'ShaderNodeOutputWorld');bg=node(wn,'ShaderNodeBackground');bg.inputs[0].default_value=(.12,.18,.28,1);bg.inputs[1].default_value=.035
black=node(wn,'ShaderNodeBackground');black.inputs[1].default_value=0;lp=node(wn,'ShaderNodeLightPath');mix=node(wn,'ShaderNodeMixShader');wl.new(lp.outputs['Is Camera Ray'],mix.inputs[0]);wl.new(bg.outputs[0],mix.inputs[1]);wl.new(black.outputs[0],mix.inputs[2]);wl.new(mix.outputs[0],output.inputs[0])
results=[]
for mode in ['CLOSEUP','HOME']:
    data=json.loads((OUT/(mode.lower()+'-frame.json')).read_text())
    for obj in list(scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
    materials=[make_surface(),make_city(data['sun']),make_cloud(),make_air()]
    for source,mat in zip(data['meshes'],materials):import_mesh(source,mat)
    camera_data=bpy.data.cameras.new('Actual Web Camera');camera=bpy.data.objects.new('Camera',camera_data);scene.collection.objects.link(camera)
    camera.matrix_world=matrix(data['camera']['matrix']);camera_data.type='PERSP';camera_data.sensor_fit='HORIZONTAL';camera_data.angle=2*math.atan(math.tan(math.radians(data['camera']['fov'])/2)*data['camera']['aspect']);scene.camera=camera
    sun_data=bpy.data.lights.new('Orbital Sun','SUN');sun_data.energy=2.4;sun_data.angle=math.radians(.53)
    sun_obj=bpy.data.objects.new('Orbital Sun',sun_data);scene.collection.objects.link(sun_obj);sun_obj.rotation_euler=Vector(data['sun']).to_track_quat('Z','Y').to_euler()
    destination=OUT/('EARTH_GT_CLOSEUP.png' if mode=='CLOSEUP' else 'EARTH_GT_HOME_CROP.png')
    scene.render.filepath=str(destination);start=time.monotonic();bpy.ops.render.render(write_still=True)
    results.append({'view':mode,'seconds':time.monotonic()-start,'image':str(destination),'samples':opt.samples})
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'earth-gt-{mode.lower()}.blend'))
(OUT/'ground-truth-report.json').write_text(json.dumps({'blender':bpy.app.version_string,'device':'OPTIX','gpu':devices,'viewTransform':'AgX','referenceOnly':True,'results':results},indent=2))
print(json.dumps(results))
