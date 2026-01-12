/**
 * Convolution Fragment Shader
 * 
 * Generic 3x3 kernel convolution for image filters:
 * - Sharpen (unsharp masking)
 * - Blur (Gaussian approximation)
 * - Edge Enhancement
 * 
 * Architecture: Single-pass convolution with kernel matrix uniform
 * Designed to be composable with adjustment pipeline
 */
precision highp float;

varying vec2 v_texCoord;

uniform sampler2D u_image;
uniform vec2 u_texelSize;     // 1.0 / resolution
uniform mat3 u_kernel;        // 3x3 convolution kernel
uniform float u_strength;     // Blend factor: 0 = original, 1 = full effect

/**
 * Sample texture with kernel offset
 * Handles edge clamping automatically via texture sampling
 */
vec4 sampleOffset(vec2 coord, vec2 offset) {
  return texture2D(u_image, coord + offset * u_texelSize);
}

/**
 * Apply 3x3 convolution kernel
 * Kernel layout:
 *   [0,0] [1,0] [2,0]
 *   [0,1] [1,1] [2,1]
 *   [0,2] [1,2] [2,2]
 */
vec4 convolve3x3(vec2 coord) {
  vec4 result = vec4(0.0);
  
  // Row 0 (top)
  result += sampleOffset(coord, vec2(-1.0, -1.0)) * u_kernel[0][0];
  result += sampleOffset(coord, vec2( 0.0, -1.0)) * u_kernel[1][0];
  result += sampleOffset(coord, vec2( 1.0, -1.0)) * u_kernel[2][0];
  
  // Row 1 (middle)
  result += sampleOffset(coord, vec2(-1.0,  0.0)) * u_kernel[0][1];
  result += sampleOffset(coord, vec2( 0.0,  0.0)) * u_kernel[1][1];
  result += sampleOffset(coord, vec2( 1.0,  0.0)) * u_kernel[2][1];
  
  // Row 2 (bottom)
  result += sampleOffset(coord, vec2(-1.0,  1.0)) * u_kernel[0][2];
  result += sampleOffset(coord, vec2( 0.0,  1.0)) * u_kernel[1][2];
  result += sampleOffset(coord, vec2( 1.0,  1.0)) * u_kernel[2][2];
  
  return result;
}

void main() {
  vec4 original = texture2D(u_image, v_texCoord);
  vec4 convolved = convolve3x3(v_texCoord);
  
  // Clamp to valid range and preserve alpha
  convolved.rgb = clamp(convolved.rgb, 0.0, 1.0);
  convolved.a = original.a;
  
  // Linear blend between original and convolved
  gl_FragColor = mix(original, convolved, u_strength);
}
