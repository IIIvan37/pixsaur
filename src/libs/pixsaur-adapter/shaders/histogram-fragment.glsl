// Fragment shader pour l'histogramme - RGB uniquement
precision highp float;

uniform sampler2D u_image;
uniform sampler2D u_palette;
uniform vec2 u_imageSize;
uniform int u_distanceMetric;

varying vec2 v_texCoord;

// Distance RGB pondérée perceptuelle (ITU-R BT.601)
// Reflète la sensibilité de l'œil humain: Green (0.587) > Red (0.299) > Blue (0.114)
float colorDistanceRGB(vec3 color1, vec3 color2) {
  vec3 diff = color1 - color2;
  vec3 weights = vec3(0.299, 0.587, 0.114);
  vec3 weightedDiff = diff * diff * weights;
  return sqrt(weightedDiff.r + weightedDiff.g + weightedDiff.b);
}

void main() {
  vec2 imageCoord = v_texCoord;
  vec4 pixelColor = texture2D(u_image, imageCoord);

  // Find closest color in palette
  float minDistance = 99999.0;
  int closestIndex = 0;

  for (int i = 0; i < 27; i++) { // CPC palette has 27 colors
    vec2 paletteCoord = vec2(float(i) / 27.0, 0.5);
    vec4 paletteColor = texture2D(u_palette, paletteCoord);

    float distance = colorDistanceRGB(pixelColor.rgb, paletteColor.rgb);

    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }

  // Output histogram bin
  float binValue = float(closestIndex) / 27.0;
  gl_FragColor = vec4(binValue, minDistance, 0.0, 1.0);
}