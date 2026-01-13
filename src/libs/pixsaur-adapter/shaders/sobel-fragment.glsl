/**
 * Sobel Edge Detection Fragment Shader
 * 
 * Implements Sobel operator for edge detection:
 * - Converts to grayscale (luminance)
 * - Applies Sobel Gx and Gy kernels
 * - Computes gradient magnitude
 * - Outputs edge intensity
 * 
 * Output: Original RGB blended with edge detection based on strength
 */
precision highp float;

varying vec2 v_texCoord;

uniform sampler2D u_image;
uniform vec2 u_texelSize;     // 1.0 / resolution
uniform float u_strength;     // Edge detection strength: 0 = off, 1 = full edges

// Sobel kernels for X and Y gradients
// Gx = [-1, 0, 1; -2, 0, 2; -1, 0, 1]
// Gy = [-1, -2, -1; 0, 0, 0; 1, 2, 1]

/**
 * Convert RGB to grayscale using luminance formula
 */
float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

/**
 * Sample luminance at offset
 */
float sampleLuminance(vec2 coord, vec2 offset) {
  vec3 color = texture2D(u_image, coord + offset * u_texelSize).rgb;
  return luminance(color);
}

/**
 * Apply Sobel operator and return gradient magnitude
 */
float sobelEdge(vec2 coord) {
  // Sample 3x3 neighborhood
  float tl = sampleLuminance(coord, vec2(-1.0, -1.0));
  float tc = sampleLuminance(coord, vec2( 0.0, -1.0));
  float tr = sampleLuminance(coord, vec2( 1.0, -1.0));
  float ml = sampleLuminance(coord, vec2(-1.0,  0.0));
  float mr = sampleLuminance(coord, vec2( 1.0,  0.0));
  float bl = sampleLuminance(coord, vec2(-1.0,  1.0));
  float bc = sampleLuminance(coord, vec2( 0.0,  1.0));
  float br = sampleLuminance(coord, vec2( 1.0,  1.0));
  
  // Compute Sobel gradients
  // Gx: horizontal gradient (detects vertical edges)
  float gx = -tl + tr - 2.0*ml + 2.0*mr - bl + br;
  
  // Gy: vertical gradient (detects horizontal edges)
  float gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;
  
  // Gradient magnitude (approximation using sum of absolutes for performance)
  // Could use sqrt(gx*gx + gy*gy) for more accuracy
  float magnitude = abs(gx) + abs(gy);
  
  // Normalize and clamp
  return clamp(magnitude, 0.0, 1.0);
}

void main() {
  // Get original color
  vec4 original = texture2D(u_image, v_texCoord);
  
  // Get edge magnitude
  float edge = sobelEdge(v_texCoord);
  
  // Mix original with edge detection
  // At strength 0: original image
  // At strength 1: edges only (white edges on black)
  vec3 edgeColor = vec3(edge);
  vec3 result = mix(original.rgb, edgeColor, u_strength);
  
  gl_FragColor = vec4(result, original.a);
}
