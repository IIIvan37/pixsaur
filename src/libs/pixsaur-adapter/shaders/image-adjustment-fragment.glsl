// Fragment shader pour les ajustements d'image (brightness, contrast, saturation, etc.)
precision mediump float;

uniform sampler2D u_image;
uniform vec3 u_rgbFactors;      // RGB multiplicatifs
uniform float u_brightness;     // Facteur brightness
uniform float u_contrast;       // Facteur contrast
uniform float u_saturation;     // Facteur saturation
uniform float u_hue;            // Rotation de teinte (normalized)
uniform float u_vibrance;       // Saturation intelligente
uniform float u_temperature;    // Balance bleu/orange
uniform float u_tint;           // Balance vert/magenta
uniform float u_gamma;          // Correction gamma
uniform float u_exposure;       // Exposition (stops)
uniform float u_highlights;     // Ajustement hautes lumières
uniform float u_shadows;        // Ajustement ombres
uniform float u_posterization;  // Niveaux posterization

varying vec2 v_texCoord;

// Conversion RGB vers HSL
vec3 rgb2hsl(vec3 c) {
  float max_val = max(max(c.r, c.g), c.b);
  float min_val = min(min(c.r, c.g), c.b);
  float delta = max_val - min_val;

  float h = 0.0;
  float s = 0.0;
  float l = (max_val + min_val) * 0.5;

  if (delta > 0.0001) {
    s = l > 0.5 ? delta / (2.0 - max_val - min_val) : delta / (max_val + min_val);

    if (max_val == c.r) {
      h = (c.g - c.b) / delta + (c.g < c.b ? 6.0 : 0.0);
    } else if (max_val == c.g) {
      h = (c.b - c.r) / delta + 2.0;
    } else {
      h = (c.r - c.g) / delta + 4.0;
    }
    h /= 6.0;
  }

  return vec3(h, s, l);
}

// Conversion HSL vers RGB
vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;

  if (s == 0.0) {
    return vec3(l, l, l);
  }

  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;

  // Fonction hue2rgb inline
  float r, g, b;

  // Pour r
  float t_r = h + 1.0/3.0;
  if (t_r < 0.0) t_r += 1.0;
  if (t_r > 1.0) t_r -= 1.0;
  if (t_r < 1.0/6.0) r = p + (q - p) * 6.0 * t_r;
  else if (t_r < 1.0/2.0) r = q;
  else if (t_r < 2.0/3.0) r = p + (q - p) * (2.0/3.0 - t_r) * 6.0;
  else r = p;

  // Pour g
  float t_g = h;
  if (t_g < 0.0) t_g += 1.0;
  if (t_g > 1.0) t_g -= 1.0;
  if (t_g < 1.0/6.0) g = p + (q - p) * 6.0 * t_g;
  else if (t_g < 1.0/2.0) g = q;
  else if (t_g < 2.0/3.0) g = p + (q - p) * (2.0/3.0 - t_g) * 6.0;
  else g = p;

  // Pour b
  float t_b = h - 1.0/3.0;
  if (t_b < 0.0) t_b += 1.0;
  if (t_b > 1.0) t_b -= 1.0;
  if (t_b < 1.0/6.0) b = p + (q - p) * 6.0 * t_b;
  else if (t_b < 1.0/2.0) b = q;
  else if (t_b < 2.0/3.0) b = p + (q - p) * (2.0/3.0 - t_b) * 6.0;
  else b = p;

  return vec3(r, g, b);
}

// Luminance (ITU-R BT.601)
float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec4 pixel = texture2D(u_image, v_texCoord);
  vec3 color = pixel.rgb;

  // Étape 1: RGB multiplicatif
  color *= u_rgbFactors;

  // Étape 2: Temperature (-100/+100 → bleu/orange)
  if (u_temperature != 0.0) {
    float temp = u_temperature / 100.0;
    color.r *= 1.0 + temp * 0.3;
    color.b *= 1.0 - temp * 0.3;
  }

  // Étape 3: Tint (-100/+100 → vert/magenta)
  if (u_tint != 0.0) {
    float tintVal = u_tint / 100.0;
    color.g *= 1.0 + tintVal * 0.3;
    color.r *= 1.0 - tintVal * 0.15;
    color.b *= 1.0 - tintVal * 0.15;
  }

  // Étape 4: Exposure (stops: -3 à +3)
  if (u_exposure != 0.0) {
    color *= pow(2.0, u_exposure);
  }

  // Étape 5: Highlights/Shadows
  if (u_highlights != 0.0 || u_shadows != 0.0) {
    float lum = luminance(color);

    // Highlights: affecte les zones claires (lum > 0.5)
    if (u_highlights != 0.0 && lum > 0.5) {
      float highlightMask = (lum - 0.5) * 2.0; // 0 à 1
      float highlightFactor = 1.0 + (u_highlights / 100.0) * highlightMask;
      color *= highlightFactor;
    }

    // Shadows: affecte les zones sombres (lum < 0.5)
    if (u_shadows != 0.0 && lum < 0.5) {
      float shadowMask = (0.5 - lum) * 2.0; // 0 à 1
      float shadowFactor = 1.0 + (u_shadows / 100.0) * shadowMask;
      color *= shadowFactor;
    }
  }

  // Étape 6: Brightness
  color *= u_brightness;

  // Étape 7: Gamma correction
  if (u_gamma != 1.0) {
    color = pow(color, vec3(1.0 / u_gamma));
  }

  // Étape 8: Contrast (pivot autour de 0.5)
  color = (color - 0.5) * u_contrast + 0.5;

  // Étape 9: Saturation + Hue + Vibrance via HSL
  vec3 hsl = rgb2hsl(color);

  // Hue rotation
  if (u_hue != 0.0) {
    hsl.x = mod(hsl.x + u_hue, 1.0);
  }

  // Saturation
  hsl.y = clamp(hsl.y * u_saturation, 0.0, 1.0);

  // Vibrance (saturation intelligente: booste couleurs ternes, préserve saturées)
  if (u_vibrance != 0.0) {
    float vibranceFactor = u_vibrance / 100.0;
    // Plus la saturation actuelle est faible, plus vibrance a d'effet
    float vibranceBoost = vibranceFactor * (1.0 - hsl.y);
    hsl.y = clamp(hsl.y + vibranceBoost, 0.0, 1.0);
  }

  color = hsl2rgb(hsl);

  // Étape 10: Posterization
  if (u_posterization < 255.0) {
    float step = 255.0 / (u_posterization - 1.0);
    color = floor(color * 255.0 / step + 0.5) * step / 255.0;
  }

  // Clamp final
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, pixel.a);
}