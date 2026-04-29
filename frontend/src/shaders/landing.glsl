#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform float iMouseActivity;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 6; i++) {
        v += a * noise(p);
        p = rot * p * 2.0;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    vec2 mouse = iMouse / iResolution;

    float t = iTime * 0.15;

    float d = length(uv - mouse);
    float mouseWarp = exp(-d * 4.0) * 0.08;

    vec2 q = vec2(
        fbm(uv * 3.0 + vec2(t, t * 0.7) + mouseWarp),
        fbm(uv * 3.0 + vec2(t * 0.8, t * 1.1) - mouseWarp)
    );

    vec2 r = vec2(
        fbm(uv * 3.0 + 4.0 * q + vec2(1.7, 9.2) + t * 0.3),
        fbm(uv * 3.0 + 4.0 * q + vec2(8.3, 2.8) + t * 0.5)
    );

    float f = fbm(uv * 3.0 + 4.0 * r);

    vec3 darkNavy = vec3(0.09, 0.12, 0.22);
    vec3 deepTeal = vec3(0.04, 0.16, 0.19);
    vec3 emerald = vec3(0.03, 0.3, 0.22);
    vec3 slate = vec3(0.11, 0.14, 0.2);

    vec3 color = mix(darkNavy, deepTeal, clamp(f * f * 2.0, 0.0, 1.0));
    color = mix(color, emerald, clamp(length(q) * 0.5, 0.0, 1.0));
    color = mix(color, slate, clamp(length(r.x) * 0.8, 0.0, 1.0));

    color *= 0.85 + 0.3 * f;

    float mouseDist = length(uv - mouse);
    float mouseField = exp(-mouseDist * mouseDist * 20.0) * iMouseActivity;

    float patternMask = smoothstep(0.3, 0.7, f);
    float edgeMask = smoothstep(0.25, 0.55, abs(dFdx(f))) + smoothstep(0.25, 0.55, abs(dFdy(f)));
    edgeMask = clamp(edgeMask, 0.0, 1.0);

    float glowMask = (patternMask * 0.6 + edgeMask * 0.4) * mouseField;

    vec3 glowColor = vec3(0.06, 0.85, 0.55);
    color += glowColor * glowMask * 0.7;

    float innerGlow = mouseField * f * 0.15;
    color += vec3(0.04, 0.4, 0.3) * innerGlow;

    float grain = (hash(uv * iResolution + fract(iTime * 100.0)) - 0.5) * 0.03;
    color += grain;

    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color, 1.0);
}
