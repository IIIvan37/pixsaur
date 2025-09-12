// Basic vertex shader for fullscreen quad
export const vertexShader = `#version 300 es
in vec3 a_position;
in vec2 a_texCoord;

out vec2 vTexCoord;

void main() {
    gl_Position = vec4(a_position, 1.0);
    vTexCoord = a_texCoord;
}
`