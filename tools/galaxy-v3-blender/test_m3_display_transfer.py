import unittest
import numpy as np
from m3_display_transfer import decode,encode,aces,inverse_aces,encode_split,LINEAR_TEXTURE_GAIN

class DisplayTransferTests(unittest.TestCase):
    def test_roundtrip_preserves_display_color(self):
        source=np.array([[[.03,.04,.06],[.2,.3,.45],[.8,.65,.4],[.96,.9,.8]]],np.float32)
        np.testing.assert_allclose(encode(aces(inverse_aces(decode(source)))),source,atol=1e-5)

    def test_black_does_not_create_halo_content(self):
        np.testing.assert_array_equal(inverse_aces(np.zeros((2,3,3),np.float32)),0)

    def test_quantized_five_layer_display_conservation(self):
        rng=np.random.default_rng(32)
        alpha=rng.uniform(.15,.98,(12,16)).astype(np.float32)
        source=rng.uniform(.01,.75,(12,16,3)).astype(np.float32)*alpha[...,None]
        weights=rng.uniform(.1,1,(5,12,16)).astype(np.float32)
        weights/=weights.sum(axis=0)
        rgb,alphas=encode_split(source,1-(1-alpha[None])**weights)
        composite=np.zeros_like(source)
        for a in alphas/255:
            composite=decode(rgb/255)*LINEAR_TEXTURE_GAIN*a[...,None]+composite*(1-a[...,None])
        self.assertLess(float(np.abs(encode(aces(composite))-source).mean()),.003)
        self.assertLess(float(np.abs((1-np.prod(1-alphas/255,axis=0))-alpha).mean()),.002)

    def test_source_alpha_holes_remain_empty(self):
        rgb,alpha=encode_split(np.zeros((2,3,3)),np.zeros((5,2,3)))
        self.assertEqual(int(rgb.sum()+alpha.sum()),0)

if __name__=='__main__':unittest.main()
