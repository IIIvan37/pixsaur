// CPC Quantization Fragment Shader
export const cpcQuantizationShader = `#version 300 es
precision highp float;

in vec2 vTexCoord;
out vec4 FragColor;

uniform sampler2D uSourceTexture;

// CPC quantization function - converts any RGB value to CPC levels (0, 128, 255)
vec3 quantizeCPC(vec3 color) {
    vec3 levels = vec3(0.0, 128.0/255.0, 1.0);
    vec3 quantized;
    
    for (int i = 0; i < 3; i++) {
        float value = color[i];
        float best = levels[0];
        float bestDist = abs(value - best);
        
        for (int j = 1; j < 3; j++) {
            float dist = abs(value - levels[j]);
            if (dist < bestDist) {
                bestDist = dist;
                best = levels[j];
            }
        }
        quantized[i] = best;
    }
    
    return quantized;
}

void main() {
    vec4 color = texture(uSourceTexture, vTexCoord);
    vec3 quantized = quantizeCPC(color.rgb);
    FragColor = vec4(quantized, color.a);
}
`