# Galaxy V3.0 Arms Alpha and Edge Rework QA

- Source WIP Commit: `1a84b711d54ec5f9ff5162fed943b62d2543d252`
- Only Arms Alpha and Edge were rebuilt.
- Haze, Dust, Core and Stars were read from the WIP Commit without modification.

## Metrics

- Arms outer coverage: 65.14%
- Arms maximum continuous arc: 51.50 degrees
- Arms missing regions: 4
- Arms Alpha effective area: 16.752%
- Arms Alpha > 0.05 area: 15.162%
- Arms centroid: (1077.21, 1025.07)
- Edge designed regions: 4
- Edge large connected components at 512px: 3
- Edge outer coverage: 47.50%
- Edge maximum continuous arc: 66.50 degrees
- Edge Alpha effective area: 4.316%
- Edge Alpha > 0.05 area: 2.910%
- Edge centroid: (1083.25, 1025.52)
- Reconstruction premultiplied RGB MAE: 3.968%
- Reconstruction Alpha MAE: 0.163587
- Reconstruction Alpha effective area: 25.532%
- ACES preview core near-white clipping: 0.0000%

## Checks

- PASS — Arms outer angular coverage below 68%
- PASS — Arms outer angular coverage at least 55%
- PASS — Edge outer angular coverage below 50%
- PASS — Edge outer angular coverage at least 30%
- PASS — Edge maximum continuous arc no more than 75 degrees
- PASS — Edge uses 3 to 5 designed local regions
- PASS — Both textures keep transparent corners
- PASS — Both textures keep the outer 1% transparent
- PASS — RGB MAE does not exceed 5%
- PASS — ACES preview core near-white clipping does not exceed 0.10%

## Conclusion

PASS

The reworked Arms preserves the original RGB and middle-arm identity while removing four asymmetric outer sectors. The reworked Edge is generated from the official E2 outer structure and is limited to four separated directional gates. No files under src/ or public/ were modified by this script.
