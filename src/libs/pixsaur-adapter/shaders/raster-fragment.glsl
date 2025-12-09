// Fragment shader for per-line raster palette lookup
precision mediump float;

uniform sampler2D u_indexTex;    // index texture (ALPHA or R channel used)
uniform sampler2D u_paletteTex;  // palette LUT texture (size: 16 x H)
uniform float u_height;          // image height in pixels

varying vec2 v_texCoord;         // 0..1

void main() {
  // Pixel row
  float y = floor(v_texCoord.y * u_height);

  // Read ink index from alpha channel (0..1) and convert to 0..255 then 0..15
  float indexNorm = texture2D(u_indexTex, v_texCoord).a; // [0..1]
  float index = floor(indexNorm * 255.0 + 0.5);

  // Palette UV: 16 columns (indices 0..15), H rows (one palette per line)
  float u = (index + 0.5) / 16.0;
  float v = (y + 0.5) / u_height;

  gl_FragColor = texture2D(u_paletteTex, vec2(u, v));
}
