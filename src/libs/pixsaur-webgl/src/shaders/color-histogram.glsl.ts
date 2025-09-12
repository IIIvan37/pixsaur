// Shader pour créer un histogramme des couleurs sur GPU
export const colorHistogramShader = `#version 300 es
precision highp float;

uniform sampler2D uSourceTexture;
uniform int uBinSize; // Taille des bins pour regrouper les couleurs similaires

in vec2 vTexCoord;
out vec4 fragColor;

// Quantifie une couleur vers un bin d'histogramme
vec3 quantizeForHistogram(vec3 color) {
    float binSize = float(uBinSize);
    return floor(color * binSize) / binSize;
}

void main() {
    vec3 color = texture(uSourceTexture, vTexCoord).rgb;
    vec3 quantizedColor = quantizeForHistogram(color);
    
    // Sortir la couleur quantifiée pour l'histogramme
    fragColor = vec4(quantizedColor, 1.0);
}
`