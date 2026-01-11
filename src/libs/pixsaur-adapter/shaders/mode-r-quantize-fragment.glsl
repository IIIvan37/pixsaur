// Fragment shader for Mode R quantization - finds best blend pair for each pixel
// Supports ordered dithering (Bayer, Blue Noise)
precision highp float;

uniform sampler2D u_image;           // Source image (doubled resolution)
uniform sampler2D u_blendLUT;        // 256 blends as 16x16 texture (RGB = blended color)
uniform sampler2D u_flickerLUT;      // 16x16 texture with flicker scores in R channel
uniform sampler2D u_bayerMatrix;     // Bayer dithering matrix texture (optional)
uniform sampler2D u_blueNoise;       // Blue noise texture 64x64 (optional)
uniform vec2 u_imageSize;            // Source image dimensions
uniform vec2 u_outputSize;           // Output dimensions (half width)
uniform float u_flickerWeight;       // Anti-flicker weight (0-1)
uniform float u_maxLuminanceDelta;   // Maximum luminance delta for flicker
uniform int u_ditheringMode;         // 0=none, 1=bayer, 2=blueNoise
uniform float u_ditheringIntensity;  // Dithering intensity (0-1)
uniform float u_bayerSize;           // Bayer matrix size (2, 4, or 8)

varying vec2 v_texCoord;

// Luminance calculation (ITU-R BT.601)
float getLuminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

// Color distance (Manhattan for speed, good enough for quantization)
float colorDistance(vec3 a, vec3 b) {
  vec3 diff = abs(a - b);
  return diff.r + diff.g + diff.b;
}

// Get Bayer dithering threshold
float getBayerThreshold(vec2 pos, float matrixSize) {
  vec2 matrixPos = mod(pos, matrixSize);
  vec2 uv = (matrixPos + 0.5) / matrixSize;
  float bayerVal = texture2D(u_bayerMatrix, uv).r;
  // Normalize to -0.5 to 0.5 range, then scale
  return (bayerVal - 0.5) * u_ditheringIntensity * 255.0;
}

// Get Blue Noise thresholds (decorrelated per channel)
vec3 getBlueNoiseThresholds(vec2 pos) {
  vec2 uv = mod(pos, 64.0) / 64.0;
  vec3 noise = texture2D(u_blueNoise, uv).rgb;
  return (noise - 0.5) * u_ditheringIntensity * 255.0;
}

void main() {
  // Output pixel position
  vec2 outPos = floor(v_texCoord * u_outputSize);
  float y = outPos.y;
  
  // Determine source pixel positions based on line parity
  // Even lines: A gets even pixels (2x), B gets odd pixels (2x+1)
  // Odd lines: A gets odd pixels (2x+1), B gets even pixels (2x)
  float isEvenLine = 1.0 - mod(y, 2.0);
  
  float srcXA = outPos.x * 2.0 + (1.0 - isEvenLine);
  float srcXB = outPos.x * 2.0 + isEvenLine;
  
  // Sample source colors
  vec2 uvA = (vec2(srcXA, y) + 0.5) / u_imageSize;
  vec2 uvB = (vec2(srcXB, y) + 0.5) / u_imageSize;
  
  vec3 colorA = texture2D(u_image, uvA).rgb * 255.0;
  vec3 colorB = texture2D(u_image, uvB).rgb * 255.0;
  
  // Apply dithering
  if (u_ditheringMode == 1) {
    // Bayer dithering - same threshold for all channels
    float threshold = getBayerThreshold(outPos, u_bayerSize);
    colorA = clamp(colorA + threshold, 0.0, 255.0);
    colorB = clamp(colorB + threshold, 0.0, 255.0);
  } else if (u_ditheringMode == 2) {
    // Blue Noise - decorrelated per channel
    vec3 thresholds = getBlueNoiseThresholds(outPos);
    colorA = clamp(colorA + thresholds, 0.0, 255.0);
    colorB = clamp(colorB + thresholds, 0.0, 255.0);
  }
  
  // Normalize back to 0-1 for comparison
  colorA /= 255.0;
  colorB /= 255.0;
  
  // Target color is the perceived blend
  vec3 targetColor = (colorA + colorB) * 0.5;
  
  // Search all 256 blends to find best match
  float bestCost = 99999.0;
  float bestIndexA = 0.0;
  float bestIndexB = 0.0;
  
  for (int a = 0; a < 16; a++) {
    for (int b = 0; b < 16; b++) {
      // Sample blend LUT (16x16 texture)
      vec2 lutUV = (vec2(float(a), float(b)) + 0.5) / 16.0;
      vec3 blendColor = texture2D(u_blendLUT, lutUV).rgb;
      
      // Color matching error
      float colorError = colorDistance(targetColor, blendColor);
      
      // Flicker score from LUT
      float flickerScore = texture2D(u_flickerLUT, lutUV).r * 255.0;
      
      // Flicker penalty
      float deltaPenalty = flickerScore > u_maxLuminanceDelta 
        ? (flickerScore - u_maxLuminanceDelta) * 5.0 
        : 0.0;
      float flickerCost = flickerScore * u_flickerWeight;
      
      float totalCost = colorError + flickerCost + deltaPenalty;
      
      if (totalCost < bestCost) {
        bestCost = totalCost;
        bestIndexA = float(a);
        bestIndexB = float(b);
      }
    }
  }
  
  // Output: encode indices in RG channels (0-15 -> 0-1)
  // R = indexA, G = indexB, B = error (for debugging), A = 1
  gl_FragColor = vec4(
    bestIndexA / 15.0,
    bestIndexB / 15.0,
    min(bestCost / 255.0, 1.0),
    1.0
  );
}
