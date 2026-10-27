// Injected by record-orbit.mjs before the page's own scripts; nothing in the project loads this file.
// It swaps the frame clock for one the recorder steps, so the prototype's unchanged animation loop runs
// deterministically, points the prototype's own camera along the orbit shot, hides the stats box and
// reads foot, steam and walking events from the public `spiderDebug.state`.
(() => {
  const SIMULATION_STEP_SECONDS = 1 / 60;
  const THREE_MODULE_URL = "/vendor/three/build/three.module.js";
  // The amber lens in the spider's own frame, from the eye light in main.js.
  const HEAD_OFFSET = [0, 1.65, 0.7];
  const WALKING_SPEED = 0.04;
  // The body pauses while stretched feet catch up; only a longer rest counts as having stopped.
  const STOPPED_AFTER_SECONDS = 0.4;
  const AIRBORNE_PHASES = ["lift", "swing", "lower"];

  let virtualMilliseconds = 0;
  let pendingFrameCallbacks = [];
  let randomState = 20261011;

  performance.now = () => virtualMilliseconds;
  window.requestAnimationFrame = (callback) => {
    pendingFrameCallbacks.push(callback);
    return pendingFrameCallbacks.length;
  };
  // Smoke and dust draw from Math.random; a fixed sequence makes two recordings match.
  Math.random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };

  const driver = {
    three: null,
    camera: null,
    cameraPose: null,
    frustumHeight: 0,
    legSpan: 0,
    trackedGround: null,
    latestState: null,
    shotStartMilliseconds: 0,
    events: [],
    feet: new Map(),
    walking: { isWalking: false, slowSince: null },
    ventCount: 0,
    widestFootReach: 0,
  };

  function shotSeconds() {
    return Number(((virtualMilliseconds - driver.shotStartMilliseconds) / 1000).toFixed(4));
  }

  function logEvent(type, details) {
    driver.events.push({ seconds: shotSeconds(), type, ...details });
  }

  // main.js resizes its scene camera first and its stats camera second; that call is the one place
  // from which both can be picked up without touching the file.
  function findPageCameras() {
    const cameraPrototype = driver.three.OrthographicCamera.prototype;
    const originalUpdate = cameraPrototype.updateProjectionMatrix;
    const resizedCameras = [];
    cameraPrototype.updateProjectionMatrix = function () {
      resizedCameras.push(this);
      return originalUpdate.call(this);
    };
    window.dispatchEvent(new Event("resize"));
    cameraPrototype.updateProjectionMatrix = originalUpdate;
    const statsCamera = resizedCameras.find((camera) => camera.top === window.innerHeight);
    const sceneCamera = resizedCameras.find((camera) => camera !== statsCamera);
    if (!statsCamera || !sceneCamera) {
      throw new Error(`expected the scene and stats cameras, found ${resizedCameras.length} cameras`);
    }
    return { sceneCamera, statsCamera };
  }

  function headPosition(state) {
    const head = new driver.three.Vector3(...HEAD_OFFSET);
    head.applyQuaternion(new driver.three.Quaternion(...state.worldRotation));
    return head.add(new driver.three.Vector3(...state.position));
  }

  function placeCamera(camera) {
    const pose = driver.cameraPose;
    if (!pose || !driver.latestState) {
      return;
    }
    const lookPoint = driver.trackedGround.clone();
    lookPoint.y += pose.lookHeightInSpans * driver.legSpan;
    lookPoint.lerp(headPosition(driver.latestState), pose.headWeight);
    camera.position.set(lookPoint.x + pose.offset.x, lookPoint.y + pose.offset.y, lookPoint.z + pose.offset.z);
    camera.zoom = driver.frustumHeight / (pose.visibleHeightInSpans * driver.legSpan);
    camera.updateProjectionMatrix();
    camera.lookAt(lookPoint);
  }

  // The renderer refreshes the camera's world matrix right before drawing the scene, after the page's
  // orbit controls have had their turn, so the pose set here is the one that gets drawn.
  function takeOverCamera(camera) {
    const updateMatrixWorld = camera.updateMatrixWorld;
    camera.updateMatrixWorld = function (force) {
      placeCamera(this);
      updateMatrixWorld.call(this, force);
    };
  }

  // Distance between the outermost left and right resting feet, the unit of the shared storyboard.
  function measureLegSpan(state) {
    const restingFootSides = state.feet.map((foot) => foot.localFoot[0]);
    return Math.max(...restingFootSides) - Math.min(...restingFootSides);
  }

  function observeFoot(foot) {
    const tracked = driver.feet.get(foot.name) ?? { phase: "planted", highestPoint: foot.solved[1] };
    const wasAirborne = AIRBORNE_PHASES.includes(tracked.phase);
    const isAirborne = AIRBORNE_PHASES.includes(foot.phase);
    if (!wasAirborne && isAirborne) {
      tracked.highestPoint = foot.solved[1];
      logEvent("lift", { leg: foot.name });
    }
    if (isAirborne) {
      tracked.highestPoint = Math.max(tracked.highestPoint, foot.solved[1]);
    }
    if (wasAirborne && !isAirborne) {
      logEvent("plant", { leg: foot.name, dropHeight: Number((tracked.highestPoint - foot.solved[1]).toFixed(4)) });
    }
    tracked.phase = foot.phase;
    driver.feet.set(foot.name, tracked);
  }

  function observeWalking(state) {
    const speed = Math.hypot(state.groundVelocity[0], state.groundVelocity[2]);
    const walking = driver.walking;
    if (speed > WALKING_SPEED) {
      walking.slowSince = null;
      if (!walking.isWalking) {
        walking.isWalking = true;
        logEvent("walkStart");
      }
      return;
    }
    walking.slowSince ??= shotSeconds();
    if (walking.isWalking && shotSeconds() - walking.slowSince >= STOPPED_AFTER_SECONDS) {
      walking.isWalking = false;
      driver.events.push({ seconds: walking.slowSince, type: "walkStop" });
    }
  }

  // How far the outermost foot sits from the middle of the frame, where 1 is the frame's edge. Only the
  // wide framing counts; the push-in is meant to leave the feet behind.
  function observeFraming(state) {
    if (driver.cameraPose?.headWeight !== 0) {
      return;
    }
    for (const foot of state.feet) {
      const screenPoint = new driver.three.Vector3(...foot.solved).project(driver.camera);
      driver.widestFootReach = Math.max(driver.widestFootReach, Math.abs(screenPoint.x));
    }
  }

  function observe() {
    const state = window.spiderDebug.state;
    driver.latestState = state;
    const groundUnderBody = new driver.three.Vector3(...state.position);
    driver.trackedGround ??= groundUnderBody.clone();
    const trackingRate = driver.cameraPose?.trackingRate ?? 0;
    driver.trackedGround.lerp(groundUnderBody, 1 - Math.exp(-trackingRate * SIMULATION_STEP_SECONDS));
    state.feet.forEach(observeFoot);
    observeWalking(state);
    if (state.vents > driver.ventCount) {
      driver.ventCount = state.vents;
      logEvent("steam");
    }
    observeFraming(state);
  }

  function runSimulationStep() {
    virtualMilliseconds += SIMULATION_STEP_SECONDS * 1000;
    const frameCallbacks = pendingFrameCallbacks;
    pendingFrameCallbacks = [];
    for (const frameCallback of frameCallbacks) {
      frameCallback(virtualMilliseconds);
    }
    observe();
  }

  function pressCanvasKey(code, key) {
    const canvas = document.querySelector("#world");
    canvas.dispatchEvent(new KeyboardEvent("keydown", { code, key, bubbles: true, cancelable: true }));
  }

  window.orbitDriver = {
    async prepare() {
      driver.three = await import(THREE_MODULE_URL);
      const { sceneCamera, statsCamera } = findPageCameras();
      // The stats sprite lives on layer 0; a camera that sees only layer 31 draws nothing.
      statsCamera.layers.set(31);
      driver.camera = sceneCamera;
      driver.frustumHeight = sceneCamera.top - sceneCamera.bottom;
      // The page solves the feet when it draws; before its first frame they all sit at the origin.
      runSimulationStep();
      const state = driver.latestState;
      driver.legSpan = measureLegSpan(state);
      if (!(driver.legSpan > 0)) {
        throw new Error(`could not measure the leg span, got ${driver.legSpan}`);
      }
      const cameraOffset = new driver.three.Vector3(...state.cameraPosition);
      const cameraDistance = cameraOffset.distanceTo(new driver.three.Vector3(...state.cameraTarget));
      takeOverCamera(sceneCamera);
      return { legSpan: driver.legSpan, frustumHeight: driver.frustumHeight, cameraDistance };
    },

    setCameraPose(cameraPose) {
      driver.cameraPose = cameraPose;
    },

    advance(stepCount) {
      for (let step = 0; step < stepCount; step++) {
        runSimulationStep();
      }
    },

    // Shot time zero is the frame that was just drawn.
    startShot() {
      driver.shotStartMilliseconds = virtualMilliseconds;
      driver.events = [];
      driver.walking.slowSince = null;
      driver.widestFootReach = 0;
    },

    // Read straight after `advance` in the same task, while the drawing buffer still holds the frame.
    captureFrame() {
      return document.querySelector("#world").toDataURL("image/jpeg", 0.95);
    },

    // Leads the spider the way a visitor does: a pointer move over the floor point it should walk to.
    leadSpiderTo(x, z) {
      const screenPoint = new driver.three.Vector3(x, 0, z).project(driver.camera);
      const canvas = document.querySelector("#world");
      const bounds = canvas.getBoundingClientRect();
      const pointerMove = new PointerEvent("pointermove", {
        clientX: bounds.left + ((screenPoint.x + 1) / 2) * bounds.width,
        clientY: bounds.top + ((1 - screenPoint.y) / 2) * bounds.height,
        isPrimary: true,
        bubbles: true,
      });
      canvas.dispatchEvent(pointerMove);
    },

    halt() {
      const position = driver.latestState.position;
      window.orbitDriver.leadSpiderTo(position[0], position[2]);
    },

    ventSteam() {
      pressCanvasKey("Space", " ");
    },

    drainEvents() {
      return driver.events.splice(0);
    },

    telemetry() {
      const state = driver.latestState;
      return {
        position: state.position,
        speed: Math.hypot(state.groundVelocity[0], state.groundVelocity[2]),
        yaw: state.yaw,
        isPixel: state.pixel,
        hasTerrain: state.terrain,
        movingLegs: state.feet.filter((foot) => foot.phase !== "planted").map((foot) => foot.name),
        widestFootReach: driver.widestFootReach,
      };
    },
  };
})();
