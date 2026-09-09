"""Pack exact aligned sphere-ray depth, quantized-depth body mesh and linear EXR assets.

Run with normal Python after rendering. Depth is analytical for the undisplaced
Blender sphere, not a learned estimate. It does not infer terrain displacement.
"""
from pathlib import Path
import json, math, shutil, hashlib
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1];P=ROOT/'art/earth-hybrid/passes';OUT=ROOT/'public/textures/hero/earth/hybrid-v1'
OUT.mkdir(parents=True,exist_ok=True)
m=json.loads((P/'hero-camera.json').read_text());size=m['size']
earth=np.array(m['earthWorld']).reshape(4,4).T
# Use Blender's evaluated camera matrix, including its exact track-quaternion roll.
cam=np.array(m['cameraWorld']).reshape(4,4).T;origin=cam[:3,3];center=np.array(m['earthCenter'])
assert np.dot(-cam[:3,2],(center-origin)/np.linalg.norm(center-origin))>.99999,'Stale / unaligned Blender camera'
m['cameraLocal']=(np.linalg.inv(earth)@cam).T.reshape(-1).tolist()
tan=math.tan(math.radians(m['cameraFov'])/2);rad=m['earthRadiusWorld'];delta=origin-center
def rays(uv):
    v=np.stack([(uv[...,0]*2-1)*tan,(uv[...,1]*2-1)*tan,np.full(uv.shape[:-1],-1.)],axis=-1)
    v=v@cam[:3,:3].T;return v/np.linalg.norm(v,axis=-1,keepdims=True)
def distance(uv,radius=rad):
    ray=rays(uv);b=np.sum(ray*delta,axis=-1);disc=b*b-np.dot(delta,delta)+radius*radius
    return -b-np.sqrt(np.maximum(disc,0)),disc>=0
yy,xx=np.mgrid[0:size,0:size];uv=np.stack([(xx+.5)/size,1-(yy+.5)/size],axis=-1)
depth,valid=distance(uv);near=float(depth[valid].min());far=float(depth[valid].max())
q=np.where(valid,1+np.rint(np.clip((depth-near)/(far-near),0,1)*65534),0).astype('<u2')
Image.fromarray(q).save(P/'EARTH_HYBRID_DEPTH.png');q.tofile(OUT/'earth-hybrid-depth-u16.bin')
Image.fromarray(np.where(valid,255-(q.astype(np.float32)/65535*210),0).astype('uint8')).save(P/'EARTH_HYBRID_DEPTH_DEBUG.png')

# Polar mesh avoids rectangular limb slivers. Every vertex is reconstructed from
# the same 16-bit encoded ray distance as the depth asset, in EarthRoot local space.
segments=384;rings=112;distance_to_center=np.linalg.norm(delta)
disk=math.tan(math.asin(rad/distance_to_center))/tan*.9995
vertices=[[.5,.5]]
for ring in range(1,rings+1):
    r=disk*(ring/rings)
    vertices.extend([[.5+.5*r*math.cos(t*2*math.pi/segments),.5+.5*r*math.sin(t*2*math.pi/segments)] for t in range(segments)])
verts=np.array(vertices);d,v=distance(verts);encoded=np.rint(np.clip((d-near)/(far-near),0,1)*65534);decoded=near+encoded/65534*(far-near)
points=origin+rays(verts)*decoded[:,None]
local=(np.column_stack([points,np.ones(len(points))])@np.linalg.inv(earth).T)[:,:3]
indices=[]
for j in range(segments):indices.extend([0,1+j,1+(j+1)%segments])
for ring in range(1,rings):
    a=1+(ring-1)*segments;b=1+ring*segments
    for j in range(segments):
        k=(j+1)%segments;indices.extend([a+j,b+j,b+k,a+j,b+k,a+k])
np.column_stack([local,verts]).astype('<f4').tofile(OUT/'earth-hybrid-body-mesh.bin')
np.array(indices,dtype='<u4').tofile(OUT/'earth-hybrid-body-index.bin')
m.update({'depthNear':near,'depthFar':far,'depthEncoding':'uint16 little endian, 0 invalid, 1..65535 normalized ray distance',
          'depthMethod':'exact analytic Blender sphere intersection; vertex positions quantized to same 16-bit distance',
          'vertices':len(vertices),'indices':len(indices),'localRadius':1.85,'sunLocal':(np.linalg.inv(earth[:3,:3])@np.array(m['sunWorld'])).tolist(),
          'quantizationMaxWorldError':float(np.max(np.abs(d-decoded))),'candidateStatus':'FEASIBILITY GATE ONLY'})
for role in ['SURFACE','CITY','CLOUD']:
    shutil.copyfile(P/f'EARTH_HYBRID_{role}.exr',OUT/f'earth-hybrid-{role.lower()}.exr')
shutil.copyfile(P/'EARTH_HYBRID_DEPTH.png',OUT/'earth-hybrid-depth.png')
m['license']='CC BY 4.0'
m['sourceManifest']='../orbital-v12/manifest.json'
m['sourceManifestSha256']=hashlib.sha256((ROOT/'public/textures/hero/earth/orbital-v12/manifest.json').read_bytes()).hexdigest()
m['outputs']=[{'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
              for p in sorted(OUT.iterdir()) if p.suffix in ['.exr','.png','.bin']]
(OUT/'manifest.json').write_text(json.dumps(m,indent=2))
print(json.dumps({k:m[k] for k in ['vertices','indices','depthNear','depthFar','quantizationMaxWorldError']},indent=2))
