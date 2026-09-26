// three-scene.js
// Premium scroll-driven 3D scene.
// A glowing crystal (icosahedron) + wireframe shell + floating particles.
// As the user scrolls through sections, the scene morphs: rotation, color,
// scale, distortion and camera drift interpolate smoothly between per-section states.
// Falls back to a static gradient on small screens / reduced-motion / no WebGL.

(function () {
  "use strict";

  const canvas = document.getElementById("three-canvas");
  if (!canvas) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isSmall = window.matchMedia("(max-width: 820px)").matches;

  // Graceful fallback: no heavy 3D on small screens or reduced-motion users.
  if (prefersReduced || isSmall) {
    canvas.classList.add("three-fallback");
    return;
  }

  // Load Three.js from CDN dynamically so index.html stays clean.
  const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  loadScript(THREE_URL)
    .then(init)
    .catch(() => {
      canvas.classList.add("three-fallback");
    });

  function init() {
    if (!window.THREE) {
      canvas.classList.add("three-fallback");
      return;
    }
    const THREE = window.THREE;

    // Verify WebGL support.
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
      if (!gl) throw new Error("no webgl");
    } catch (e) {
      canvas.classList.add("three-fallback");
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 6);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // ---- Core crystal ----------------------------------------------------
    const baseGeo = new THREE.IcosahedronGeometry(1.5, 1);
    // Store original positions so we can animate a subtle "breathing" distortion.
    const basePositions = baseGeo.attributes.position.array.slice();

    const crystalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x38bdf8),
      emissive: new THREE.Color(0x0b3a4a),
      metalness: 0.6,
      roughness: 0.18,
      flatShading: true,
      transparent: true,
      opacity: 0.92,
    });
    const crystal = new THREE.Mesh(baseGeo, crystalMat);
    scene.add(crystal);

    // ---- Wireframe shell -------------------------------------------------
    const wireGeo = new THREE.IcosahedronGeometry(1.85, 1);
    const wireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x22d3ee),
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const wireShell = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wireShell);

    // ---- Floating particles ---------------------------------------------
    const particleCount = 520;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 22;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 22;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 22;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.045,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // ---- Lights ----------------------------------------------------------
    const ambient = new THREE.AmbientLight(0x404b66, 1.1);
    scene.add(ambient);
    const key = new THREE.PointLight(0x38bdf8, 2.2, 60);
    key.position.set(5, 5, 8);
    scene.add(key);
    const rim = new THREE.PointLight(0xa78bfa, 1.6, 60);
    rim.position.set(-6, -3, 4);
    scene.add(rim);

    // ---- Per-section target states --------------------------------------
    // Each state defines how the scene should look for that scroll section.
    // Values interpolate smoothly between states as you scroll.
    const states = [
      { color: 0x38bdf8, wire: 0x22d3ee, light: 0x38bdf8, scale: 1.0, rotSpeed: 0.05, camX: 0, camY: 0, distort: 0.04 }, // hero
      { color: 0x22d3ee, wire: 0x34d399, light: 0x22d3ee, scale: 1.1, rotSpeed: 0.07, camX: -0.9, camY: 0.2, distort: 0.06 }, // about
      { color: 0x34d399, wire: 0x38bdf8, light: 0x34d399, scale: 0.9, rotSpeed: 0.09, camX: 0.9, camY: -0.15, distort: 0.08 }, // skills
      { color: 0xa78bfa, wire: 0x60a5fa, light: 0xa78bfa, scale: 1.18, rotSpeed: 0.06, camX: -0.6, camY: -0.35, distort: 0.05 }, // projects
      { color: 0xf59e0b, wire: 0xf472b6, light: 0xf59e0b, scale: 0.95, rotSpeed: 0.08, camX: 0.7, camY: 0.4, distort: 0.07 }, // timeline
      { color: 0x60a5fa, wire: 0x22d3ee, light: 0x60a5fa, scale: 1.05, rotSpeed: 0.05, camX: 0, camY: 0, distort: 0.04 }, // footer
    ];

    // Current (smoothed) values.
    const cur = {
      color: new THREE.Color(states[0].color),
      wire: new THREE.Color(states[0].wire),
      light: new THREE.Color(states[0].light),
      scale: states[0].scale,
      rotSpeed: states[0].rotSpeed,
      camX: 0,
      camY: 0,
      distort: states[0].distort,
    };

    // Scroll progress mapped to a floating index across states.
    let scrollTarget = 0; // 0 .. states.length-1
    function computeScroll() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const p = scrollable > 0 ? window.scrollY / scrollable : 0;
      scrollTarget = p * (states.length - 1);
    }
    computeScroll();
    window.addEventListener("scroll", computeScroll, { passive: true });

    // Gentle "breath" whenever a new section becomes active.
    let popEnergy = 0;
    window.addEventListener("section-active", () => {
      popEnergy = 0.5; // subtle; decays over time in the animate loop
    });

    // Mouse parallax.
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener(
      "mousemove",
      (e) => {
        mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      },
      { passive: true }
    );

    // ---- Grab-to-rotate drag controls (with inertia) --------------------
    // The canvas sits behind content, so we listen on the whole window but
    // only start a drag when the pointer is NOT over an interactive element
    // (links, buttons, cards) so normal clicks/scroll still work.
    const drag = {
      active: false,
      lastX: 0,
      lastY: 0,
      velX: 0, // angular velocity applied to crystal each frame
      velY: 0,
      // manual rotation offsets accumulated from dragging
      rotX: 0,
      rotY: 0,
    };

    function isInteractive(target) {
      return !!(
        target.closest &&
        target.closest("a, button, input, textarea, .modal, .nav, .project, .skill, .chip")
      );
    }

    function pointerDown(e) {
      const pt = e.touches ? e.touches[0] : e;
      if (isInteractive(e.target)) return; // let UI handle it
      drag.active = true;
      drag.lastX = pt.clientX;
      drag.lastY = pt.clientY;
      drag.velX = 0;
      drag.velY = 0;
      document.body.classList.add("grabbing");
    }

    function pointerMove(e) {
      if (!drag.active) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - drag.lastX;
      const dy = pt.clientY - drag.lastY;
      drag.lastX = pt.clientX;
      drag.lastY = pt.clientY;
      // Convert pixel movement to rotation (radians). Tunable sensitivity.
      const sens = 0.005;
      drag.rotY += dx * sens;
      drag.rotX += dy * sens;
      // Track velocity for inertia after release.
      drag.velY = dx * sens;
      drag.velX = dy * sens;
      if (e.cancelable && e.touches) e.preventDefault();
    }

    function pointerUp() {
      if (!drag.active) return;
      drag.active = false;
      document.body.classList.remove("grabbing");
    }

    window.addEventListener("mousedown", pointerDown);
    window.addEventListener("mousemove", pointerMove, { passive: true });
    window.addEventListener("mouseup", pointerUp);
    window.addEventListener("touchstart", pointerDown, { passive: true });
    window.addEventListener("touchmove", pointerMove, { passive: false });
    window.addEventListener("touchend", pointerUp);

    // Helpers to blend two state objects by fraction f.
    const tmpA = new THREE.Color();
    const tmpB = new THREE.Color();
    function lerp(a, b, f) {
      return a + (b - a) * f;
    }

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      computeScroll();
    }
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();

    function animate() {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // Determine the two states we are between + blend factor.
      const idx = Math.max(0, Math.min(states.length - 1, scrollTarget));
      const i0 = Math.floor(idx);
      const i1 = Math.min(states.length - 1, i0 + 1);
      const f = idx - i0;
      const s0 = states[i0];
      const s1 = states[i1];

      // Target values from blended state.
      tmpA.set(s0.color);
      tmpB.set(s1.color);
      const targColor = tmpA.clone().lerp(tmpB, f);
      tmpA.set(s0.wire);
      tmpB.set(s1.wire);
      const targWire = tmpA.clone().lerp(tmpB, f);
      tmpA.set(s0.light);
      tmpB.set(s1.light);
      const targLight = tmpA.clone().lerp(tmpB, f);
      const targScale = lerp(s0.scale, s1.scale, f);
      const targRot = lerp(s0.rotSpeed, s1.rotSpeed, f);
      const targCamX = lerp(s0.camX, s1.camX, f);
      const targCamY = lerp(s0.camY, s1.camY, f);
      const targDistort = lerp(s0.distort, s1.distort, f);

      // Smooth (ease) current toward target.
      const ease = 1 - Math.pow(0.0016, dt); // frame-rate independent smoothing
      cur.color.lerp(targColor, ease);
      cur.wire.lerp(targWire, ease);
      cur.light.lerp(targLight, ease);
      cur.scale = lerp(cur.scale, targScale, ease);
      cur.rotSpeed = lerp(cur.rotSpeed, targRot, ease);
      cur.camX = lerp(cur.camX, targCamX, ease);
      cur.camY = lerp(cur.camY, targCamY, ease);
      cur.distort = lerp(cur.distort, targDistort, ease);

      // Apply material colors.
      crystalMat.color.copy(cur.color);
      wireMat.color.copy(cur.wire);
      key.color.copy(cur.light);

      // Rotate crystal + wireframe (counter-rotate for depth).
      // Idle auto-rotation (slow) only when not actively dragging.
      if (!drag.active) {
        crystal.rotation.y += cur.rotSpeed * dt;
        crystal.rotation.x += cur.rotSpeed * 0.4 * dt;
        wireShell.rotation.y -= cur.rotSpeed * 0.6 * dt;
        wireShell.rotation.x += cur.rotSpeed * 0.25 * dt;

        // Inertia: keep spinning from the throw, then decay via friction.
        drag.rotY += drag.velY;
        drag.rotX += drag.velX;
        drag.velX *= 0.94;
        drag.velY *= 0.94;
        if (Math.abs(drag.velX) < 0.00002) drag.velX = 0;
        if (Math.abs(drag.velY) < 0.00002) drag.velY = 0;
      }

      // Apply the per-frame CHANGE in accumulated drag rotation on top of
      // whatever auto-rotation happened. This keeps drag + idle spin additive.
      if (drag._prevY === undefined) { drag._prevY = 0; drag._prevX = 0; }
      const dRotY = drag.rotY - drag._prevY;
      const dRotX = drag.rotX - drag._prevX;
      crystal.rotation.y += dRotY;
      crystal.rotation.x += dRotX;
      wireShell.rotation.y -= dRotY;
      wireShell.rotation.x += dRotX;
      drag._prevY = drag.rotY;
      drag._prevX = drag.rotX;

      // Decay the section-change breath.
      popEnergy = Math.max(0, popEnergy - dt * 1.0);
      const popEase = popEnergy * popEnergy; // smooth ease-out
      // Subtle forward breath when a new section activates.
      crystal.rotation.y += popEase * 0.5 * dt * 6;
      wireShell.rotation.y -= popEase * 0.5 * dt * 6;

      // Scale (with a gentle breathing pulse + subtle section breath).
      const pulse = 1 + Math.sin(t * 1.0) * 0.02 + popEase * 0.08;
      crystal.scale.setScalar(cur.scale * pulse);
      wireShell.scale.setScalar(cur.scale * pulse * 1.02);

      // Softly brighten the wireframe during a breath.
      wireMat.opacity = 0.35 + popEase * 0.2;

      // Vertex distortion "breathing" for the crystal.
      const pos = baseGeo.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        const ox = basePositions[i];
        const oy = basePositions[i + 1];
        const oz = basePositions[i + 2];
        const n = Math.sin(t * 1.5 + ox * 2 + oy * 3 + oz * 1.5);
        const d = 1 + n * cur.distort;
        pos[i] = ox * d;
        pos[i + 1] = oy * d;
        pos[i + 2] = oz * d;
      }
      baseGeo.attributes.position.needsUpdate = true;
      baseGeo.computeVertexNormals();

      // Slowly drift particles.
      particles.rotation.y += 0.02 * dt;
      particles.rotation.x += 0.008 * dt;

      // Mouse parallax on camera + section-based drift.
      mouse.x = lerp(mouse.x, mouse.tx, 0.05);
      mouse.y = lerp(mouse.y, mouse.ty, 0.05);
      camera.position.x = cur.camX + mouse.x * 0.8;
      camera.position.y = cur.camY - mouse.y * 0.6;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    // Reveal canvas once ready.
    canvas.classList.add("three-ready");
    animate();
  }
})();
