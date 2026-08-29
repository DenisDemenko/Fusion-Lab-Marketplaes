"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

// Port of the lab's hero light-rays effect (site/assets/js/light-rays.js) to
// a React component using ogl directly, instead of vendoring its 300+ file
// local copy — the shader and WebGL setup are otherwise unchanged.
// docs/migration-plan.md Phase C2.
//
// Idea (from the original): the light source sits top-center, over the
// header, and the rays sweep softly across the portrait behind it.
const RAYS_COLOR = "#e9c3c3";
const RAYS_SPEED = 1;
const LIGHT_SPREAD = 1.1;
const RAY_LENGTH = 3;
const MOUSE_INFLUENCE = 0.1;

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? [
        parseInt(match[1], 16) / 255,
        parseInt(match[2], 16) / 255,
        parseInt(match[3], 16) / 255,
      ]
    : [1, 1, 1];
}

// top-center only — the original supports 7 origins, but the hero only
// ever uses this one, so the other 6 branches would be dead code here.
function topCenterAnchorAndDir(w: number, h: number) {
  const outside = 0.2;
  return { anchor: [0.5 * w, -outside * h] as [number, number], dir: [0, 1] as [number, number] };
}

const VERT = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float fadeDistance;
uniform vec2  mousePos;
uniform float mouseInfluence;

varying vec2 vUv;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float spreadFactor = pow(max(cosAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);

  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);

  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);

  fragColor = rays1 * 0.5 + rays2 * 0.4;

  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;

  fragColor.rgb *= raysColor;
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}`;

export function LightRays() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Same accessibility rule as the rest of this codebase's motion
    // (catalog-filters, etc.): no animated canvas for a visitor who asked
    // for less motion.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let renderer: Renderer;
    try {
      renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), alpha: true });
    } catch {
      return;
    }

    const gl = renderer.gl;
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    container.appendChild(gl.canvas);

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] as [number, number] },
      rayPos: { value: [0, 0] as [number, number] },
      rayDir: { value: [0, 1] as [number, number] },
      raysColor: { value: hexToRgb(RAYS_COLOR) },
      raysSpeed: { value: RAYS_SPEED },
      lightSpread: { value: LIGHT_SPREAD },
      rayLength: { value: RAY_LENGTH },
      fadeDistance: { value: 1 },
      mousePos: { value: [0.5, 0.5] as [number, number] },
      mouseInfluence: { value: MOUSE_INFLUENCE },
    };

    const geometry = new Triangle(gl);
    const program = new Program(gl, { vertex: VERT, fragment: FRAG, uniforms });
    const mesh = new Mesh(gl, { geometry, program });

    const mouse = { x: 0.5, y: 0.5 };
    const smoothMouse = { x: 0.5, y: 0.5 };
    let rafId = 0;

    function updatePlacement() {
      const wCSS = container!.clientWidth;
      const hCSS = container!.clientHeight;
      renderer.setSize(wCSS, hCSS);

      const dpr = renderer.dpr;
      const w = wCSS * dpr;
      const h = hCSS * dpr;

      uniforms.iResolution.value = [w, h];
      const { anchor, dir } = topCenterAnchorAndDir(w, h);
      uniforms.rayPos.value = anchor;
      uniforms.rayDir.value = dir;
    }

    function loop(t: number) {
      uniforms.iTime.value = t * 0.001;

      const smoothing = 0.92;
      smoothMouse.x = smoothMouse.x * smoothing + mouse.x * (1 - smoothing);
      smoothMouse.y = smoothMouse.y * smoothing + mouse.y * (1 - smoothing);
      uniforms.mousePos.value = [smoothMouse.x, smoothMouse.y];

      try {
        renderer.render({ scene: mesh });
        rafId = requestAnimationFrame(loop);
      } catch {
        // A lost WebGL context stops the loop rather than throwing on
        // every remaining frame.
      }
    }

    function onMouseMove(event: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      mouse.x = (event.clientX - rect.left) / rect.width;
      mouse.y = (event.clientY - rect.top) / rect.height;
    }

    window.addEventListener("resize", updatePlacement);
    window.addEventListener("mousemove", onMouseMove);
    updatePlacement();
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("mousemove", onMouseMove);
      const loseContext = gl.getExtension("WEBGL_lose_context");
      loseContext?.loseContext();
      gl.canvas.parentNode?.removeChild(gl.canvas);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden [&_canvas]:block [&_canvas]:mix-blend-screen"
      aria-hidden="true"
    />
  );
}
