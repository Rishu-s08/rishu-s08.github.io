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
    .then(() => loadScript("https://unpkg.com/three@0.128.0/examples/js/renderers/CSS3DRenderer.js").catch(() => {}))
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
        target.closest("a, button, input, textarea, .modal, .nav, .project, .skill, .chip, .globe-panel, .scene-focus-exit")
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

    // ---- Focus mode -----------------------------------------------------
    // Double-click (or double-tap) empty background => enlarge the crystal,
    // fade the page content away, and give a clean stage to freely rotate it.
    // Tap the "exit" button, click empty space, or press Esc to leave.
    const focus = { on: false, zoom: 0 }; // zoom eases 0 -> 1

    function enterFocus() {
      if (focus.on) return;
      focus.on = true;
      document.body.classList.add("scene-focus");
      document.body.style.overflow = "hidden"; // freeze the page as a stage
    }
    function exitFocus() {
      if (!focus.on) return;
      focus.on = false;
      document.body.classList.remove("scene-focus");
      document.body.style.overflow = ""; // restore scrolling
    }
    function toggleFocus() {
      focus.on ? exitFocus() : enterFocus();
    }

    // Enter on double-click over empty background.
    window.addEventListener("dblclick", (e) => {
      if (isInteractive(e.target)) return;
      enterFocus();
    });

    // Exit affordances.
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && focus.on) exitFocus();
    });

    // A single click on empty background while in focus mode exits it
    // (but not if the user was dragging to rotate).
    let downX = 0, downY = 0, downTime = 0;
    window.addEventListener("mousedown", (e) => { downX = e.clientX; downY = e.clientY; downTime = Date.now(); });
    window.addEventListener("click", (e) => {
      if (!focus.on) return;
      if (isInteractive(e.target)) return;
      const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
      const quick = Date.now() - downTime < 250;
      if (moved < 6 && quick) exitFocus(); // a clean tap, not a drag
    });

    // Optional exit button injected into the page.
    const exitBtn = document.createElement("button");
    exitBtn.className = "scene-focus-exit";
    exitBtn.type = "button";
    exitBtn.setAttribute("aria-label", "Exit 3D focus");
    exitBtn.innerHTML = "&#10005; Exit 3D";
    exitBtn.addEventListener("click", exitFocus);
    document.body.appendChild(exitBtn);

    // Hint injected into the page.
    const focusHint = document.createElement("div");
    focusHint.className = "scene-focus-hint";
    focusHint.textContent = "Drag to rotate · tap a tile to open · Esc to exit";
    document.body.appendChild(focusHint);

    // ---- Navigation GLOBE (true CSS3D panels on a sphere) ---------------
    // Uses THREE.CSS3DRenderer so each HTML panel is a real 3D object mapped
    // onto the sphere surface. Panels orient with the curvature (lookAt) and
    // reorient naturally as the globe rotates. Only shown in focus mode.
    const navTiles = [
      { label: "About", type: "section", target: "#about" },
      { label: "Skills", type: "section", target: "#skills" },
      { label: "Projects", type: "section", target: "#projects" },
      { label: "Timeline", type: "section", target: "#timeline" },
      { label: "Contact", type: "section", target: "#footer" },
      { label: "Montra", type: "link", target: "https://play.google.com/store/apps/details?id=com.threefourthdecade.montra" },
      { label: "Cartelle", type: "section", target: "#projects" },
      { label: "AppBack", type: "section", target: "#projects" },
      { label: "LMS", type: "section", target: "#projects" },
      { label: "QA Agent", type: "section", target: "#projects" },
      { label: "Blog App", type: "section", target: "#projects" },
      { label: "Reddit Clone", type: "section", target: "#projects" },
      { label: "GitHub", type: "link", target: "https://github.com/Rishu-s08" },
      { label: "LinkedIn", type: "link", target: "https://www.linkedin.com/in/rishu-s08/" },
      { label: "Instagram", type: "link", target: "https://www.instagram.com/" },
      { label: "YouTube", type: "link", target: "https://www.youtube.com/" },
      { label: "Twitter / X", type: "link", target: "https://twitter.com/" },
      { label: "Email", type: "link", target: "mailto:rishi.2030s@gmail.com" },
      { label: "Resume", type: "section", target: "#about" },
      { label: "Hire Me", type: "section", target: "#footer" },
    ];

    let cssRenderer = null;
    let cssScene = null;
    let cssCamera = null;
    let globeGroup = null;
    let globeObjects = [];
    // Reusable temporaries for per-frame backface culling.
    const _wPos = new THREE.Vector3();
    const _wQuat = new THREE.Quaternion();
    const _wNormal = new THREE.Vector3();
    const _camDir = new THREE.Vector3();
    const _billboardQuat = new THREE.Quaternion();
    const hasCSS3D = typeof THREE.CSS3DRenderer === "function" && typeof THREE.CSS3DObject === "function";

    function activateTile(t) {
      exitFocus();
      if (t.type === "link") {
        window.open(t.target, "_blank", "noopener");
        return;
      }
      setTimeout(() => {
        const el = document.querySelector(t.target);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }

    if (hasCSS3D) {
      cssScene = new THREE.Scene();
      globeGroup = new THREE.Group();
      cssScene.add(globeGroup);

      cssCamera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        1,
        5000
      );
      cssCamera.position.z = 1600; // far enough to see the whole globe

      cssRenderer = new THREE.CSS3DRenderer();
      cssRenderer.setSize(window.innerWidth, window.innerHeight);
      const cssDom = cssRenderer.domElement;
      cssDom.className = "css3d-layer";
      document.body.appendChild(cssDom);

      // Glowing orb backdrop for a cohesive "globe" impression.
      const orb = document.createElement("div");
      orb.className = "globe-orb";
      document.body.appendChild(orb);

      const GLOBE_R = 300; // sphere radius in CSS px
      const N = navTiles.length;
      const vTmp = new THREE.Vector3();
      navTiles.forEach((t, i) => {
        const el = document.createElement("div");
        el.className = "globe-panel";
        el.textContent = t.label;
        el.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          activateTile(t);
        });

        const obj = new THREE.CSS3DObject(el);
        // Even distribution on a sphere (periodic-table method).
        const phi = Math.acos(-1 + (2 * i) / N);
        const theta = Math.sqrt(N * Math.PI) * phi;
        obj.position.setFromSphericalCoords(GLOBE_R, phi, theta);
        // Orient the panel to face outward along the surface normal.
        vTmp.copy(obj.position).multiplyScalar(2);
        obj.lookAt(vTmp);
        obj.userData.el = el;
        globeGroup.add(obj);
        globeObjects.push(obj);
      });
    }

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
      if (cssRenderer && cssCamera) {
        cssCamera.aspect = window.innerWidth / window.innerHeight;
        cssCamera.updateProjectionMatrix();
        cssRenderer.setSize(window.innerWidth, window.innerHeight);
      }
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

      // Drive the CSS3D navigation GLOBE. It rotates with the same drag
      // rotation as the crystal, so grabbing spins the whole globe and the
      // panels reorient with the sphere curvature. Rendered only in focus.
      if (cssRenderer && globeGroup) {
        if (focus.zoom > 0.01) {
          globeGroup.rotation.y = crystal.rotation.y;
          globeGroup.rotation.x = crystal.rotation.x;
          cssCamera.position.z = lerp(2000, 1150, focus.zoom);
          cssCamera.lookAt(0, 0, 0);
          globeGroup.updateMatrixWorld(true);
          // Local rotation that cancels the group's world rotation, so a panel
          // ends up facing the camera upright (billboard).
          globeGroup.getWorldQuaternion(_wQuat);
          _billboardQuat.copy(_wQuat).invert();

          // Backface culling + billboard: show only panels on the front cap,
          // and make each visible panel face the camera so its text stays
          // upright & readable (no more sideways/tilted labels).
          for (const obj of globeObjects) {
            obj.updateWorldMatrix(true, false);
            obj.getWorldPosition(_wPos);
            // Outward normal of this panel's position on the (rotated) sphere.
            _wNormal.copy(_wPos).normalize();
            _camDir.copy(cssCamera.position).sub(_wPos).normalize();
            const facing = _wNormal.dot(_camDir); // 1 = front, -1 = back
            const el = obj.userData.el;
            if (facing <= 0.3) {
              el.style.opacity = "0";
              el.style.pointerEvents = "none";
            } else {
              const vis = (facing - 0.3) / 0.7;
              el.style.opacity = Math.min(1, 0.35 + vis).toFixed(2);
              el.style.pointerEvents = facing > 0.5 ? "auto" : "none";
              // Billboard: cancel the group's rotation so the panel stays
              // upright and facing forward regardless of globe spin.
              obj.rotation.set(0, 0, 0);
              obj.quaternion.copy(_billboardQuat);
            }
          }

          cssRenderer.render(cssScene, cssCamera);
        }
      }

      // Decay the section-change breath.
      popEnergy = Math.max(0, popEnergy - dt * 1.0);
      const popEase = popEnergy * popEnergy; // smooth ease-out
      // Subtle forward breath when a new section activates.
      crystal.rotation.y += popEase * 0.5 * dt * 6;
      wireShell.rotation.y -= popEase * 0.5 * dt * 6;

      // Scale (with a gentle breathing pulse + subtle section breath).
      const pulse = 1 + Math.sin(t * 1.0) * 0.02 + popEase * 0.08;
      // In focus mode the crystal becomes a smaller glowing CORE so the
      // tile ring around it is the focus, not a giant blob.
      const focusScale = 1 - focus.zoom * 0.68;
      crystal.scale.setScalar(cur.scale * pulse * focusScale);
      wireShell.scale.setScalar(cur.scale * pulse * 1.02 * focusScale);

      // Softly brighten the wireframe during a breath; fully fade both the
      // crystal and cage in focus mode so the CSS3D panel globe is the show.
      wireMat.opacity = (0.35 + popEase * 0.2) * (1 - focus.zoom);
      crystalMat.opacity = 0.92 * (1 - focus.zoom);
      crystal.visible = focus.zoom < 0.98;
      wireShell.visible = focus.zoom < 0.98;

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

      // Ease the focus zoom toward its target (1 when on, 0 when off).
      const zoomTarget = focus.on ? 1 : 0;
      focus.zoom = lerp(focus.zoom, zoomTarget, 1 - Math.pow(0.004, dt));

      // Mouse parallax on camera + section-based drift.
      mouse.x = lerp(mouse.x, mouse.tx, 0.05);
      mouse.y = lerp(mouse.y, mouse.ty, 0.05);

      // Base camera position from scroll/section + gentle parallax.
      const normalX = cur.camX + mouse.x * 0.8;
      const normalY = cur.camY - mouse.y * 0.6;
      // In focus mode: recenter (ignore section offset) and damp parallax so
      // the crystal stays centered and stable while you rotate it.
      const focusX = mouse.x * 0.15;
      const focusY = -mouse.y * 0.12;
      camera.position.x = lerp(normalX, focusX, focus.zoom);
      camera.position.y = lerp(normalY, focusY, focus.zoom);
      camera.position.z = lerp(6, 5.2, focus.zoom); // slight pull-in only
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    // Reveal canvas once ready.
    canvas.classList.add("three-ready");
    animate();
  }
})();
