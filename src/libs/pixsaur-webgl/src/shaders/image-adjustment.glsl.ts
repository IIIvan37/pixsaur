export const imageAdjustmentShader = /* glsl */ `#version 300 es
precision highp float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform vec3 u_rgbFactors;    // r, g, b multiplicative factors
uniform float u_brightness;  // brightness factor (1.0 = neutral)
uniform float u_contrast;    // contrast factor (1.0 = neutral)  
uniform float u_saturation;  // saturation factor (1.0 = neutral)
uniform float u_posterization; // posterization levels (256.0 = no effect)

// Helper functions for HSL conversion
vec3 rgbToHsl(vec3 rgb) {
    float maxVal = max(max(rgb.r, rgb.g), rgb.b);
    float minVal = min(min(rgb.r, rgb.g), rgb.b);
    float delta = maxVal - minVal;
    
    float h = 0.0;
    float s = 0.0;
    float l = (maxVal + minVal) * 0.5;
    
    if (delta > 0.0) {
        s = l > 0.5 ? delta / (2.0 - maxVal - minVal) : delta / (maxVal + minVal);
        
        if (maxVal == rgb.r) {
            h = (rgb.g - rgb.b) / delta + (rgb.g < rgb.b ? 6.0 : 0.0);
        } else if (maxVal == rgb.g) {
            h = (rgb.b - rgb.r) / delta + 2.0;
        } else {
            h = (rgb.r - rgb.g) / delta + 4.0;
        }
        h /= 6.0;
    }
    
    return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
}

vec3 hslToRgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;
    
    if (s == 0.0) {
        return vec3(l); // achromatic
    }
    
    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;
    
    float r = hue2rgb(p, q, h + 1.0/3.0);
    float g = hue2rgb(p, q, h);
    float b = hue2rgb(p, q, h - 1.0/3.0);
    
    return vec3(r, g, b);
}

void main() {
    vec4 pixel = texture(u_image, vTexCoord);
    vec3 rgb = pixel.rgb;
    
    // Step 1: RGB multiplicative factors
    rgb *= u_rgbFactors;
    
    // Step 2: Brightness adjustment
    rgb *= u_brightness;
    
    // Step 3: Contrast adjustment (centered on 0.5)
    rgb = (rgb - 0.5) * u_contrast + 0.5;
    
    // Step 4: Saturation adjustment via HSL
    if (u_saturation != 1.0) {
        vec3 hsl = rgbToHsl(rgb);
        hsl.y = clamp(hsl.y * u_saturation, 0.0, 1.0);
        rgb = hslToRgb(hsl);
    }
    
    // Step 5: Posterization 
    if (u_posterization < 256.0) {
        float posterizeStep = 1.0 / (u_posterization - 1.0);
        rgb = floor(rgb / posterizeStep) * posterizeStep;
    }
    
    // Final clamping
    rgb = clamp(rgb, 0.0, 1.0);
    
    fragColor = vec4(rgb, pixel.a);
}
`