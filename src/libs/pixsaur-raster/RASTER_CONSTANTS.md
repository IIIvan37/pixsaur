# Raster Optimization Constants

## Overview

This file contains shared constants that control raster palette optimization across the application. These constants affect how the algorithm balances between:

- **Palette stability** (avoiding banding and flickering between lines)
- **Color accuracy** (representing source image colors faithfully)
- **Gradient smoothness** (smooth transitions in gradients)

## Constants

### `COLOR_FAMILY_THRESHOLD`

**Current value**: `1200` (20² × 3)

Controls when two colors are considered "similar enough" to use the same CPC color.

- **Lower value** → More palette changes, better color accuracy, risk of banding
- **Higher value** → More stability, less banding, but may miss subtle color variations

**Tuning guide**:
- For images with **smooth gradients**: Use lower values (1200-1800)
- For images with **distinct color regions**: Use higher values (2400-3600)

---

### `COVERAGE_RATIO_THRESHOLD`

**Current value**: `0.75` (75%)

When the current palette covers this percentage of pixels or more, keep it unchanged.

- **Lower value** → More palette changes, better adaptation to each line
- **Higher value** → More stability, less palette switching

**Tuning guide**:
- For **photographic images**: Use lower values (0.60-0.75)
- For **pixel art/cartoons**: Use higher values (0.80-0.95)

---

### `MODERATE_COVERAGE_THRESHOLD`

**Current value**: `0.4` (40%)

Threshold for partial palette updates (keep good colors, replace poor ones).

- Below this: Complete palette regeneration
- Between this and COVERAGE_RATIO_THRESHOLD: Hybrid approach

**Tuning guide**:
- Generally keep between `0.3` and `0.5`
- Lower values give more aggressive optimization

---

### `MIN_COLOR_REPLACEMENT_DISTANCE`

**Current value**: `432` (12² × 3)

Minimum distance required to replace a palette color with a new one.

- **Lower value** → More responsive to subtle changes, smoother gradients
- **Higher value** → More stable, less oscillation between similar colors

**Tuning guide**:
- For **smooth gradients**: Use lower values (300-600)
- For **stable palettes**: Use higher values (800-1200)

---

### `MIN_USEFUL_COVERAGE` & `MIN_POOR_SLOT_COVERAGE`

**Current values**: `0.1` (10%) and `0.05` (5%)

Control when palette slots are considered useful or candidates for replacement.

**Tuning guide**:
- Generally keep these relatively low
- Adjust together to maintain reasonable ratio (2:1)

---

## Testing Your Changes

After modifying constants:

1. **Test with gradients**: Look for smooth transitions without banding
2. **Test with detailed images**: Ensure important colors are preserved
3. **Check stability**: Verify no excessive palette flickering
4. **Compare modes**: Test in both Mode 0 and Mode 1

## CPC Hardware Considerations

### CPC Classic (27 colors)
- More aggressive stabilization recommended
- Higher COLOR_FAMILY_THRESHOLD (2400+)
- Higher COVERAGE_RATIO_THRESHOLD (0.85+)

### CPC Plus (4096 colors)
- Can use more sensitive values
- Lower thresholds allow exploiting the larger color space
- Current defaults are optimized for CPC Plus

## Common Issues

**Problem**: Too much banding in gradients
- **Solution**: Lower COLOR_FAMILY_THRESHOLD and MIN_COLOR_REPLACEMENT_DISTANCE

**Problem**: Palette flickering between lines
- **Solution**: Raise COLOR_FAMILY_THRESHOLD and COVERAGE_RATIO_THRESHOLD

**Problem**: Colors look washed out
- **Solution**: Lower COVERAGE_RATIO_THRESHOLD to allow more palette changes

**Problem**: Too much color variation, noisy result
- **Solution**: Raise all thresholds for more stability
