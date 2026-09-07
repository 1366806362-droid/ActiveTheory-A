import unittest
import numpy as np
from repair_m3_source import reconstruct

class SourceRepairTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.data=reconstruct()

    def test_locality_and_unchanged_core(self):
        source,repaired,weight,fields,*_=self.data
        self.assertLess(float(np.any(source!=repaired,axis=-1).mean()),.15)
        np.testing.assert_array_equal(source[fields[5]>.05],repaired[fields[5]>.05])

    def test_no_changes_outside_reconstruction(self):
        source,repaired,weight,*_=self.data
        np.testing.assert_array_equal(source[weight==0],repaired[weight==0])
        np.testing.assert_array_equal(source[:,:900],repaired[:,:900])

    def test_gaps_reconstructed_without_whole_frame_exposure(self):
        source,repaired,weight,*_=self.data
        region=(weight>.5)&(source.max(axis=-1)<.015)
        self.assertGreater(float(repaired[region].mean()),float(source[region].mean()))
        self.assertTrue(np.isfinite(repaired).all())

if __name__=='__main__':unittest.main()
