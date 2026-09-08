"""M3 display-reference transport through the existing HOME ACES OutputPass.

This is an inverse display transform, NOT a new galaxy grade. It is specific
to HOME's reference exposure (.76). The renderer and other assets are untouched.
Eight is an RGB storage scale decoded in linear space, not a brightness boost.
"""
import numpy as np

LINEAR_TEXTURE_GAIN = 8.0
REFERENCE_EXPOSURE = .76
INPUT_MAT = np.array([[.59719,.35458,.04823],[.076,.90834,.01566],[.02840,.13383,.83777]],np.float32)
OUTPUT_MAT = np.array([[1.60475,-.53108,-.07367],[-.10208,1.10813,-.00605],[-.00327,-.07276,1.07602]],np.float32)

def decode(x):
    return np.where(x <= .04045, x / 12.92, ((x + .055) / 1.055) ** 2.4)

def encode(x):
    x = np.maximum(x, 0)
    return np.where(x <= .0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - .055)

def aces(x, exposure=REFERENCE_EXPOSURE):
    v = (x * (exposure / .6)) @ INPUT_MAT.T
    v = (v * (v + .0245786) - .000090537) / (v * (.983729 * v + .432951) + .238081)
    return np.clip(v @ OUTPUT_MAT.T, 0, 1)

def inverse_aces(x, exposure=REFERENCE_EXPOSURE):
    y = x @ np.linalg.inv(OUTPUT_MAT).T
    a = 1 - .983729 * y
    b = .0245786 - .432951 * y
    c = -.000090537 - .238081 * y
    v = (-b + np.sqrt(np.maximum(b*b - 4*a*c,0))) / (2*a)
    result = np.maximum(v @ np.linalg.inv(INPUT_MAT).T * (.6 / exposure), 0)
    # ACES has a black toe: its non-zero inverse at zero is not galaxy content.
    result[np.max(x,axis=-1)==0] = 0
    return result

def encode_split(source_display, layer_alphas):
    """Quantize coverage first, then conserve the source's displayed energy."""
    alphas = np.round(np.clip(layer_alphas,0,1)*255)/255
    coverage = 1-np.prod(1-alphas,axis=0)
    linear = inverse_aces(decode(source_display))
    straight = linear / np.maximum(coverage[...,None],1e-8)
    if float(straight.max()) > LINEAR_TEXTURE_GAIN:
        raise ValueError('M3 exceeds fixed transport range; stop instead of clipping highlights')
    texture = encode(straight / LINEAR_TEXTURE_GAIN)
    texture[coverage==0] = 0
    return np.round(np.clip(texture,0,1)*255).astype(np.uint8), np.round(alphas*255).astype(np.uint8)
