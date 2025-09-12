// Shader pour extraire les couleurs dominantes via downsampling intelligent
export const dominantColorsShader = `#version 300 es
precision highp float;

uniform sampler2D uSourceTexture;
uniform vec2 uTextureSize;
uniform int uSampleStep; // Pas d'échantillonnage pour éviter de traiter tous les pixels

in vec2 vTexCoord;
out vec4 fragColor;

// Fonction de distance couleur simple
float colorDistance(vec3 a, vec3 b) {
    vec3 diff = a - b;
    return dot(diff, diff); // Distance euclidienne au carré
}

// Sélectionne la couleur la plus représentative dans une zone
vec3 findRepresentativeColor(vec2 center) {
    vec3 dominantColor = vec3(0.0);
    float maxWeight = 0.0;
    
    int sampleRange = uSampleStep;
    float sampleCount = 0.0;
    
    for (int x = -sampleRange; x <= sampleRange; x++) {
        for (int y = -sampleRange; y <= sampleRange; y++) {
            vec2 offset = vec2(float(x), float(y)) / uTextureSize;
            vec2 samplePos = center + offset;
            
            // Vérifier les limites
            if (samplePos.x >= 0.0 && samplePos.x <= 1.0 && 
                samplePos.y >= 0.0 && samplePos.y <= 1.0) {
                
                vec3 sampleColor = texture(uSourceTexture, samplePos).rgb;
                float weight = 1.0; // Poids uniforme pour simplifier
                
                dominantColor += sampleColor * weight;
                maxWeight += weight;
                sampleCount += 1.0;
            }
        }
    }
    
    if (maxWeight > 0.0) {
        dominantColor /= maxWeight;
    }
    
    return dominantColor;
}

void main() {
    vec3 representativeColor = findRepresentativeColor(vTexCoord);
    fragColor = vec4(representativeColor, 1.0);
}
`