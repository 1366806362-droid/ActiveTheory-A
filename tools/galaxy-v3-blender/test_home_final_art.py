import unittest
import numpy as np
from build_home_final_art import polish

class HomeFinalArtTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.data=polish()

    def test_core_and_outside_footprint_are_identical(self):
        before,after,_,fields,window=self.data
        np.testing.assert_array_equal(before[fields[5]>.05],after[fields[5]>.05])
        np.testing.assert_array_equal(before[window==0],after[window==0])

    def test_local_low_energy_support_never_replaces_arms(self):
        before,after,*_=self.data
        self.assertLess(float(np.any(before!=after,axis=-1).mean()),.05)
        # RGB8 rounds the bounded .014 addition by at most half a code value.
        self.assertLessEqual(float(np.max(after-before)),.014+.5/255+1e-7)
        self.assertTrue(np.all(after>=before))

if __name__=='__main__':unittest.main()
