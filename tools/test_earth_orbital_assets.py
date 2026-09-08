import hashlib
import json
from pathlib import Path
import unittest
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'public/textures/hero/earth/orbital-v12'

class OrbitalAssetTests(unittest.TestCase):
    def test_manifest_dimensions_hashes_and_license(self):
        manifest=json.loads((ASSETS/'manifest.json').read_text())
        self.assertEqual(manifest['license'],'CC BY 4.0')
        self.assertEqual(len(manifest['outputs']),4)
        for entry in manifest['outputs']:
            path=ASSETS/entry['file']
            with Image.open(path) as image:self.assertEqual(image.size,(4096,2048))
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),entry['sha256'])

    def test_cities_have_dark_ocean_and_sparse_highlights(self):
        normal=np.asarray(Image.open(ASSETS/'earth-orbital-normal-land.webp'))
        land=normal[...,3]/255
        self.assertGreater(float(normal[...,2][land==0].mean()),200.)
        city=np.asarray(Image.open(ASSETS/'earth-orbital-city.webp'))/255
        self.assertEqual(float(city[land<.64].max()),0.)
        self.assertLess(float((city[...,2]>.25).mean()),.005)
        self.assertGreater(float((city[...,0]==0).mean()),.80)
        self.assertGreater(float(city[...,1].max()),.2)

    def test_clouds_retain_continuous_weather_not_binary_alpha(self):
        cloud=np.asarray(Image.open(ASSETS/'earth-orbital-cloud.webp'))/255
        for channel in range(3):self.assertGreater(len(np.unique(cloud[...,channel])),100)
        self.assertGreater(float(np.std(cloud[...,0])),float(np.std(cloud[...,2])))
        self.assertGreater(float((cloud[...,0]<.03).mean()),.05)

if __name__=='__main__':unittest.main()
