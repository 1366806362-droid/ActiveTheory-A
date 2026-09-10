import json, unittest
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
A=ROOT/'public/textures/hero/earth/hybrid-v1'

class HybridTests(unittest.TestCase):
    def test_depth_png_and_binary_are_identical_high_precision(self):
        m=json.loads((A/'manifest.json').read_text());d=np.asarray(Image.open(A/'earth-hybrid-depth.png'))
        raw=np.fromfile(A/'earth-hybrid-depth-u16.bin',dtype='<u2').reshape(d.shape)
        self.assertEqual(d.shape,(2048,2048));np.testing.assert_array_equal(d,raw)
        self.assertGreater(len(np.unique(d)),20000);self.assertGreater(np.count_nonzero(d==0),1000)
        self.assertLess(m['quantizationMaxWorldError'],.0001)

    def test_camera_and_depth_mesh_share_capture_space(self):
        m=json.loads((A/'manifest.json').read_text());v=np.fromfile(A/'earth-hybrid-body-mesh.bin',dtype='<f4').reshape(-1,5)
        cam=np.array(m['cameraWorld']).reshape(4,4).T;earth=np.array(m['earthWorld']).reshape(4,4).T
        c=(earth@np.c_[v[:,:3],np.ones(len(v))].T).T[:,:3]
        local=(np.linalg.inv(cam)@np.c_[c,np.ones(len(c))].T).T[:,:3]
        tan=np.tan(np.radians(m['cameraFov'])/2)
        projected=(local[:,:2]/(-local[:,2,None]*tan)+1)/2
        np.testing.assert_allclose(projected,v[:,3:],atol=1e-6)
        distance=np.linalg.norm(c-cam[:3,3],axis=1)
        encoded=(distance-m['depthNear'])/(m['depthFar']-m['depthNear'])*65534
        self.assertLess(float(np.abs(encoded-np.round(encoded)).max()),.05)

    def test_exr_magic_and_license(self):
        for role in ['surface','city','cloud']:
            self.assertEqual((A/f'earth-hybrid-{role}.exr').read_bytes()[:4],b'v/1\x01')
        self.assertIn('CC BY 4.0',(A/'ATTRIBUTION.md').read_text(encoding='utf-8'))

if __name__=='__main__':unittest.main()
