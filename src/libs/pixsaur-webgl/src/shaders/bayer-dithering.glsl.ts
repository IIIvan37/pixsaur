// Bayer Dithering Fragment Shader
export const bayerDitheringShader = `#version 300 es
precision highp float;

in vec2 vTexCoord;
out vec4 FragColor;

uniform sampler2D uSourceTexture;
uniform sampler2D uPaletteTexture; // CPC palette as texture
uniform vec2 uTextureSize; // Source texture dimensions
uniform float uIntensity; // Dithering intensity
uniform int uPaletteSize; // Number of colors in palette
uniform int uBayerSize; // 2, 4, or 8

// Bayer matrices
const float bayer2x2[4] = float[](
    0.0/4.0, 2.0/4.0,
    3.0/4.0, 1.0/4.0
);

const float bayer4x4[16] = float[](
    0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
   12.0/16.0,  4.0/16.0, 14.0/16.0,  6.0/16.0,
    3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
   15.0/16.0,  7.0/16.0, 13.0/16.0,  5.0/16.0
);

const float bayer8x8[64] = float[](
     0.0/64.0, 32.0/64.0,  8.0/64.0, 40.0/64.0,  2.0/64.0, 34.0/64.0, 10.0/64.0, 42.0/64.0,
    48.0/64.0, 16.0/64.0, 56.0/64.0, 24.0/64.0, 50.0/64.0, 18.0/64.0, 58.0/64.0, 26.0/64.0,
    12.0/64.0, 44.0/64.0,  4.0/64.0, 36.0/64.0, 14.0/64.0, 46.0/64.0,  6.0/64.0, 38.0/64.0,
    60.0/64.0, 28.0/64.0, 52.0/64.0, 20.0/64.0, 62.0/64.0, 30.0/64.0, 54.0/64.0, 22.0/64.0,
     3.0/64.0, 35.0/64.0, 11.0/64.0, 43.0/64.0,  1.0/64.0, 33.0/64.0,  9.0/64.0, 41.0/64.0,
    51.0/64.0, 19.0/64.0, 59.0/64.0, 27.0/64.0, 49.0/64.0, 17.0/64.0, 57.0/64.0, 25.0/64.0,
    15.0/64.0, 47.0/64.0,  7.0/64.0, 39.0/64.0, 13.0/64.0, 45.0/64.0,  5.0/64.0, 37.0/64.0,
    63.0/64.0, 31.0/64.0, 55.0/64.0, 23.0/64.0, 61.0/64.0, 29.0/64.0, 53.0/64.0, 21.0/64.0
);

float getBayerValue(ivec2 pos) {
    if (uBayerSize == 2) {
        int x = pos.x % 2;
        int y = pos.y % 2;
        return bayer2x2[y * 2 + x];
    } else if (uBayerSize == 4) {
        int x = pos.x % 4;
        int y = pos.y % 4;
        return bayer4x4[y * 4 + x];
    } else { // 8x8
        int x = pos.x % 8;
        int y = pos.y % 8;
        return bayer8x8[y * 8 + x];
    }
}

// Find closest palette color
vec3 findClosestPaletteColor(vec3 color) {
    vec3 bestColor = vec3(0.0);
    float bestDistance = 999999.0;
    
    for (int i = 0; i < uPaletteSize; i++) {
        vec3 paletteColor = texelFetch(uPaletteTexture, ivec2(i, 0), 0).rgb;
        vec3 diff = color - paletteColor;
        float distance = dot(diff, diff); // squared distance
        
        if (distance < bestDistance) {
            bestDistance = distance;
            bestColor = paletteColor;
        }
    }
    
    return bestColor;
}

void main() {
    vec2 pixelCoord = vTexCoord * uTextureSize;
    ivec2 iPixelCoord = ivec2(pixelCoord);
    
    vec4 originalColor = texture(uSourceTexture, vTexCoord);
    
    // Apply Bayer dithering
    float bayerValue = getBayerValue(iPixelCoord);
    float threshold = (bayerValue - 0.5) * uIntensity;
    
    vec3 ditheredColor = originalColor.rgb + threshold;
    ditheredColor = clamp(ditheredColor, 0.0, 1.0);
    
    vec3 quantizedColor = findClosestPaletteColor(ditheredColor);
    
    FragColor = vec4(quantizedColor, originalColor.a);
}
`