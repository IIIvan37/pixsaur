// Floyd-Steinberg Dithering Fragment Shader
export const floydSteinbergDitheringShader = `#version 300 es
precision highp float;

in vec2 vTexCoord;
out vec4 FragColor;

uniform sampler2D uSourceTexture;
uniform sampler2D uPaletteTexture; // CPC palette as texture
uniform vec2 uTextureSize; // Source texture dimensions
uniform float uIntensity; // Dithering intensity
uniform int uPaletteSize; // Number of colors in palette

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
    vec3 quantizedColor = findClosestPaletteColor(originalColor.rgb);
    
    // Floyd-Steinberg error diffusion
    // Note: This is a simplified version. Full Floyd-Steinberg requires multiple passes
    // or compute shaders for proper error propagation
    vec3 error = (originalColor.rgb - quantizedColor) * uIntensity;
    
    // We can only approximate the error diffusion in a fragment shader
    // For true Floyd-Steinberg, we'd need a compute shader or multi-pass approach
    
    FragColor = vec4(quantizedColor, originalColor.a);
}
`