import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MAX_PARTICLES, paletteById, type Settings } from "../lib/settings";

export interface Telemetry {
  fps: number;
  count: number;
  cursor: [number, number, number];
  waves: number;
}

interface CosmosProps {
  settingsRef: React.RefObject<Settings>;
  onTelemetry: (t: Telemetry) => void;
}

export default function Cosmos(props: CosmosProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 3, 16], fov: 55, near: 0.1, far: 400 }}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "fixed", inset: 0, touchAction: "none", zIndex: 0 }}
    >
      <Field {...props} />
      <Dust />
    </Canvas>
  );
}

// Box–Muller gaussian
function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Particles are anchored to "home" points in cylindrical coordinates (r, angle, y) forming a spiral galaxy. */
function buildField() {
  const homeR = new Float32Array(MAX_PARTICLES);
  const homeA = new Float32Array(MAX_PARTICLES);
  const homeY = new Float32Array(MAX_PARTICLES);
  const omega = new Float32Array(MAX_PARTICLES);
  const seed = new Float32Array(MAX_PARTICLES);
  const pos = new Float32Array(MAX_PARTICLES * 3);
  const vel = new Float32Array(MAX_PARTICLES * 3);
  const speed = new Float32Array(MAX_PARTICLES);
  const ARMS = 3;

  for (let i = 0; i < MAX_PARTICLES; i++) {
    const roll = Math.random();
    let r: number;
    let a: number;
    let y: number;
    if (roll < 0.7) {
      // spiral arms
      r = Math.pow(Math.random(), 0.75) * 9 + 0.4;
      const arm = Math.floor(Math.random() * ARMS);
      a = (arm / ARMS) * Math.PI * 2 + r * 0.55 + (gauss() * 0.32) / (0.45 + r * 0.12);
      y = gauss() * (0.18 + (9 - r) * 0.035);
    } else if (roll < 0.88) {
      // halo
      const rr = 2 + Math.random() * 9;
      const theta = Math.random() * Math.PI * 2;
      const cphi = Math.random() * 2 - 1;
      const sphi = Math.sqrt(1 - cphi * cphi);
      r = rr * sphi + 0.2;
      a = theta;
      y = rr * cphi * 0.55;
    } else {
      // core
      r = Math.pow(Math.random(), 2) * 1.6 + 0.05;
      a = Math.random() * Math.PI * 2;
      y = gauss() * 0.35;
    }
    homeR[i] = r;
    homeA[i] = a;
    homeY[i] = y;
    omega[i] = 1.25 / (0.6 + r * 0.33); // differential rotation: inner orbits faster
    seed[i] = Math.random();
    // Big-bang intro: everyone starts near the core and springs outward.
    pos[i * 3] = gauss() * 0.15;
    pos[i * 3 + 1] = gauss() * 0.15;
    pos[i * 3 + 2] = gauss() * 0.15;
  }
  return { homeR, homeA, homeY, omega, seed, pos, vel, speed };
}

const vertexShader = /* glsl */ `
  attribute float aSeed;
  attribute float aSpeed;
  uniform float uSize;
  uniform float uScale;
  uniform float uTime;
  uniform float uDim;
  uniform vec3 uC1;
  uniform vec3 uC2;
  uniform vec3 uC3;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    float heat = clamp(aSpeed, 0.0, 1.5);
    float s = uSize * (0.45 + aSeed * aSeed * 1.4) * (1.0 + heat * 0.7);
    gl_PointSize = min(s * uScale / max(-mv.z, 0.1), 72.0);

    vec3 c = aSeed < 0.5 ? mix(uC1, uC2, aSeed * 2.0) : mix(uC2, uC3, (aSeed - 0.5) * 2.0);
    vColor = mix(c, vec3(1.0), heat * 0.35);
    float twinkle = 0.6 + 0.4 * sin(uTime * (0.6 + aSeed * 2.2) + aSeed * 61.0);
    vAlpha = twinkle * (0.55 + heat * 0.45) * uDim;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float core = smoothstep(0.16, 0.0, d);
    float halo = exp(-d * d * 20.0);
    vec3 col = vColor * halo + vec3(1.0) * core * 0.5;
    gl_FragColor = vec4(col, (halo * 0.7 + core) * vAlpha);
  }
`;

interface Wave {
  x: number;
  y: number;
  z: number;
  t0: number;
}

function Field({ settingsRef, onTelemetry }: CosmosProps) {
  const { gl, camera } = useThree();
  const data = useMemo(buildField, []);
  const telemetryRef = useRef(onTelemetry);
  telemetryRef.current = onTelemetry;

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new THREE.BufferAttribute(data.pos, 3);
    p.setUsage(THREE.DynamicDrawUsage);
    const s = new THREE.BufferAttribute(data.speed, 1);
    s.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", p);
    g.setAttribute("aSpeed", s);
    g.setAttribute("aSeed", new THREE.BufferAttribute(data.seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
    return g;
  }, [data]);

  const material = useMemo(() => {
    const pal = paletteById(settingsRef.current.palette).colors;
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSize: { value: 0.16 },
        uScale: { value: 400 },
        uTime: { value: 0 },
        uDim: { value: 1 },
        uC1: { value: new THREE.Color(pal[0]) },
        uC2: { value: new THREE.Color(pal[1]) },
        uC3: { value: new THREE.Color(pal[2]) },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  // ---- mutable simulation state ----
  const sim = useRef({
    sm: { ...settingsRef.current, count: 0 },
    orbit: 0,
    turb: 0,
    time: 0,
    waves: [] as Wave[],
    // pointer
    ndc: new THREE.Vector2(),
    inside: false,
    strength: 0,
    cursor: new THREE.Vector3(),
    cursorVel: new THREE.Vector3(),
    cursorTarget: new THREE.Vector3(),
    // camera (spherical, with inertia)
    theta: 0,
    phi: 1.36,
    radius: 22,
    targetRadius: 16,
    vTheta: 0,
    vPhi: 0,
    vRadius: 0,
    parX: 0,
    parY: 0,
    // telemetry
    frames: 0,
    acc: 0,
  });

  const targetColors = useMemo(() => [new THREE.Color(), new THREE.Color(), new THREE.Color()], []);
  const tmp = useMemo(
    () => ({
      raycaster: new THREE.Raycaster(),
      plane: new THREE.Plane(),
      dir: new THREE.Vector3(),
      hit: new THREE.Vector3(),
    }),
    [],
  );

  const projectToField = (ndc: THREE.Vector2, out: THREE.Vector3) => {
    tmp.raycaster.setFromCamera(ndc, camera);
    camera.getWorldDirection(tmp.dir);
    tmp.plane.setFromNormalAndCoplanarPoint(tmp.dir, new THREE.Vector3(0, 0, 0));
    return tmp.raycaster.ray.intersectPlane(tmp.plane, out);
  };

  // ---- pointer + gesture input ----
  useEffect(() => {
    const el = gl.domElement;
    const s = sim.current;
    const active = new Map<number, { x: number; y: number }>();
    let downAt = 0;
    let downX = 0;
    let downY = 0;
    let travel = 0;
    let pinchDist = 0;

    const setNdc = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      s.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    };

    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      setNdc(e);
      s.inside = true;
      if (active.size === 1) {
        downAt = performance.now();
        downX = e.clientX;
        downY = e.clientY;
        travel = 0;
      } else if (active.size === 2) {
        const [a, b] = [...active.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        travel = 999; // a pinch is never a click
      }
    };

    const onMove = (e: PointerEvent) => {
      setNdc(e);
      if (e.pointerType === "mouse") s.inside = true;
      const prev = active.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      prev.x = e.clientX;
      prev.y = e.clientY;
      travel += Math.abs(dx) + Math.abs(dy);
      if (active.size === 1) {
        // impulses feed velocity; integration + damping happens per-frame for inertia
        s.vTheta -= dx * 0.011;
        s.vPhi -= dy * 0.008;
      } else if (active.size === 2) {
        const [a, b] = [...active.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) s.targetRadius = THREE.MathUtils.clamp(s.targetRadius * (pinchDist / d), 6, 34);
        pinchDist = d;
      }
    };

    const onUp = (e: PointerEvent) => {
      const wasSingle = active.size === 1;
      active.delete(e.pointerId);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (wasSingle && travel < 10 && moved < 8 && performance.now() - downAt < 450) {
        setNdc(e);
        const hit = projectToField(s.ndc, tmp.hit);
        if (hit) {
          s.waves.push({ x: hit.x, y: hit.y, z: hit.z, t0: s.time });
          if (s.waves.length > 6) s.waves.shift();
        }
      }
      if (e.pointerType !== "mouse" && active.size === 0) s.inside = false;
    };

    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && active.size === 0) s.inside = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      s.targetRadius = THREE.MathUtils.clamp(s.targetRadius * Math.exp(e.deltaY * 0.0012), 6, 34);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const s = sim.current;
    const target = settingsRef.current;
    s.time += dt;

    // --- heavy, eased parameter response ---
    const ease = 1 - Math.exp(-dt * 2.4);
    const sm = s.sm;
    sm.velocity += (target.velocity - sm.velocity) * ease;
    sm.turbulence += (target.turbulence - sm.turbulence) * ease;
    sm.gravity += (target.gravity - sm.gravity) * ease;
    sm.attraction += (target.attraction - sm.attraction) * ease;
    sm.size += (target.size - sm.size) * ease;
    sm.count += (target.density * 1000 - sm.count) * (1 - Math.exp(-dt * 1.6));
    const count = Math.min(MAX_PARTICLES, Math.max(0, Math.round(sm.count)));

    const pal = paletteById(target.palette).colors;
    const cEase = 1 - Math.exp(-dt * 1.8);
    const u = material.uniforms;
    for (let k = 0; k < 3; k++) {
      targetColors[k].set(pal[k]);
      (u[`uC${k + 1}`].value as THREE.Color).lerp(targetColors[k], cEase);
    }
    u.uTime.value = s.time;
    // Additive blending saturates at high counts — dim each particle as the field gets denser.
    u.uDim.value = Math.min(1, Math.max(0.32, Math.sqrt(12000 / Math.max(sm.count, 1))));
    u.uSize.value = 0.16 * sm.size;
    u.uScale.value = state.size.height * state.viewport.dpr * 0.5;

    // --- camera: spherical coords integrated with damping ---
    const camDamp = Math.exp(-dt * 3.0);
    s.theta += (s.vTheta + 0.035) * dt;
    s.phi += s.vPhi * dt;
    s.vTheta *= camDamp;
    s.vPhi *= camDamp;
    // soft limits: spring back instead of hard clamp
    if (s.phi < 0.35) s.vPhi += (0.35 - s.phi) * 14 * dt;
    if (s.phi > 2.5) s.vPhi += (2.5 - s.phi) * 14 * dt;
    s.vRadius += ((s.targetRadius - s.radius) * 16 - s.vRadius * 8) * dt;
    s.radius += s.vRadius * dt;
    const pEase = 1 - Math.exp(-dt * 1.4);
    s.parX += (s.ndc.x - s.parX) * pEase;
    s.parY += (s.ndc.y - s.parY) * pEase;
    const th = s.theta + s.parX * 0.09;
    const ph = s.phi - s.parY * 0.06;
    camera.position.set(
      s.radius * Math.sin(ph) * Math.sin(th),
      s.radius * Math.cos(ph),
      s.radius * Math.sin(ph) * Math.cos(th),
    );
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    // --- cursor: critically-damped follower for organic drag ---
    s.strength += ((s.inside ? 1 : 0) - s.strength) * (1 - Math.exp(-dt * 3));
    if (projectToField(s.ndc, s.cursorTarget)) {
      const cv = s.cursorVel;
      const c = s.cursor;
      cv.x += ((s.cursorTarget.x - c.x) * 60 - cv.x * 14) * dt;
      cv.y += ((s.cursorTarget.y - c.y) * 60 - cv.y * 14) * dt;
      cv.z += ((s.cursorTarget.z - c.z) * 60 - cv.z * 14) * dt;
      c.addScaledVector(cv, dt);
    }

    // --- waves ---
    s.waves = s.waves.filter((w) => s.time - w.t0 < 3.2);

    // --- particle integration ---
    s.orbit += dt * sm.velocity * 0.22;
    s.turb += dt * sm.turbulence * 0.85;
    const orbit = s.orbit;
    const pt = s.turb;
    const k = 1.7 * sm.gravity;
    const damp = Math.exp(-dt * 1.9);
    const turbAmp = 0.28 + sm.turbulence * 0.12;
    const pull = sm.attraction * s.strength * 16;
    const R2 = 4.2 * 4.2;
    const cx = s.cursor.x;
    const cy = s.cursor.y;
    const cz = s.cursor.z;
    const stir = 2.2 * s.strength;
    const svx = s.cursorVel.x * stir;
    const svy = s.cursorVel.y * stir;
    const svz = s.cursorVel.z * stir;
    // view direction for swirl
    camera.getWorldDirection(tmp.dir);
    const vx0 = tmp.dir.x;
    const vy0 = tmp.dir.y;
    const vz0 = tmp.dir.z;

    const waves = s.waves;
    const nW = waves.length;
    const wR = new Float32Array(nW);
    const wA = new Float32Array(nW);
    for (let w = 0; w < nW; w++) {
      const age = s.time - waves[w].t0;
      wR[w] = age * 9.5 * (1 - age * 0.12);
      wA[w] = 85 * Math.exp(-age * 1.5);
    }

    const { pos, vel, speed, homeR, homeA, homeY, omega, seed } = data;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = homeR[i];
      const ang = homeA[i] + orbit * omega[i];
      const hx = r * Math.cos(ang);
      const hz = r * Math.sin(ang);
      const hy = homeY[i];
      const sd = seed[i] * 6.2832;

      // layered sine "curl" turbulence
      const tx = hx + (Math.sin(hy * 0.9 + pt * 1.3 + sd) + Math.sin(hz * 0.35 + pt * 0.7) * 0.6) * turbAmp;
      const ty = hy + Math.sin(hx * 0.4 + pt * 1.1 + sd * 1.7) * turbAmp * 0.8;
      const tz = hz + (Math.cos(hx * 0.5 - pt * 0.9 + sd) + Math.cos(hy * 0.7 + pt * 1.5) * 0.5) * turbAmp;

      const px = pos[i3];
      const py = pos[i3 + 1];
      const pz = pos[i3 + 2];

      // spring toward the field
      let ax = (tx - px) * k;
      let ay = (ty - py) * k;
      let az = (tz - pz) * k;

      // cursor attraction / repulsion with swirl + stir
      if (pull !== 0 || stir > 0.001) {
        const dx = cx - px;
        const dy = cy - py;
        const dz = cz - pz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < R2) {
          const fall = 1 - d2 / R2;
          const f2 = fall * fall;
          const inv = 1 / Math.sqrt(d2 + 1e-4);
          const f = (pull * f2) / (d2 + 0.4);
          ax += dx * inv * f;
          ay += dy * inv * f;
          az += dz * inv * f;
          // tangential swirl around the view axis
          const sw = f * 0.35;
          ax += (vy0 * dz - vz0 * dy) * inv * sw;
          ay += (vz0 * dx - vx0 * dz) * inv * sw;
          az += (vx0 * dy - vy0 * dx) * inv * sw;
          ax += svx * f2;
          ay += svy * f2;
          az += svz * f2;
        }
      }

      // radial shockwaves
      for (let w = 0; w < nW; w++) {
        const W = waves[w];
        const dx = px - W.x;
        const dy = py - W.y;
        const dz = pz - W.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-4;
        const band = d - wR[w];
        if (band > -2.4 && band < 2.4) {
          const g = (wA[w] * Math.exp(-band * band * 1.1)) / d;
          ax += dx * g;
          ay += dy * g;
          az += dz * g;
        }
      }

      const vx = (vel[i3] + ax * dt) * damp;
      const vy = (vel[i3 + 1] + ay * dt) * damp;
      const vz = (vel[i3 + 2] + az * dt) * damp;
      vel[i3] = vx;
      vel[i3 + 1] = vy;
      vel[i3 + 2] = vz;
      pos[i3] = px + vx * dt;
      pos[i3 + 1] = py + vy * dt;
      pos[i3 + 2] = pz + vz * dt;

      const spd = Math.sqrt(vx * vx + vy * vy + vz * vz) * 0.13;
      speed[i] += (spd - speed[i]) * 0.18;
    }

    geometry.setDrawRange(0, count);
    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    const spdAttr = geometry.attributes.aSpeed as THREE.BufferAttribute;
    posAttr.clearUpdateRanges();
    posAttr.addUpdateRange(0, count * 3);
    posAttr.needsUpdate = true;
    spdAttr.clearUpdateRanges();
    spdAttr.addUpdateRange(0, count);
    spdAttr.needsUpdate = true;

    // --- telemetry (twice per second, keeps React out of the frame loop) ---
    s.frames++;
    s.acc += rawDt;
    if (s.acc >= 0.5) {
      telemetryRef.current({
        fps: Math.round(s.frames / s.acc),
        count,
        cursor: [s.cursor.x, s.cursor.y, s.cursor.z],
        waves: nW,
      });
      s.frames = 0;
      s.acc = 0;
    }
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/** Distant static starfield for depth. */
function Dust() {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const n = 1600;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 60 + Math.random() * 120;
      const t = Math.random() * Math.PI * 2;
      const c = Math.random() * 2 - 1;
      const sn = Math.sqrt(1 - c * c);
      p[i * 3] = r * sn * Math.cos(t);
      p[i * 3 + 1] = r * c;
      p[i * 3 + 2] = r * sn * Math.sin(t);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: "#c8cbe0",
        size: 1.4,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    [],
  );
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.004;
  });
  return <points ref={ref} geometry={geometry} material={material} />;
}
