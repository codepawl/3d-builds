// The kit's page runtime, the same for every machine. The build inlines it after the kit, the machine's
// modules and CONFIG, then the machine's live.js (which defines createMachineHooks) and a call to
// startFigure. It owns the clock, the one zoom frame and its birth, the exploded view, the badges, the
// trace and steps, the readout, the sounds, the theme and style switches and the film hooks; the machine's
// hooks own its state, its drawing and its controls. Adapted from the Edison figure's live.js and apart.js.

function startFigure(createHooks) {
  const P = CONFIG.projection;
  const EX = CONFIG.explode;
  const Motion = Kit.Motion;
  const Explode = Kit.Explode.createExplodeKit(CONFIG.explodeSpec);
  const RESUME_AFTER = 4200;
  const STILL_SECONDS = 4;
  // The zoom frame's birth, in seconds from the moment it starts (references/film.md).
  const BIRTH = { mark: 0.25, grow: 0.7, linger: 1, fade: 1.2 };
  const ZOOM_FADE_SECONDS = 0.35;
  const ZOOM_LINE_GAIN = 1.3;

  const stage = document.querySelector(".iso-stage");
  const readout = document.querySelector("[data-readout]");
  const announcer = document.querySelector("[data-announce]");
  const apartButton = document.querySelector("[data-apart]");
  const soundButton = document.querySelector("[data-sound]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const query = new URLSearchParams(location.search);
  const manual = query.get("clock") === "manual";
  // ?tour=off keeps the machine still until the reader acts: for tests and for embedding.
  const tourAllowed = query.get("tour") !== "off";

  function setLook(theme, style) {
    if (theme) document.body.setAttribute("data-theme", theme);
    if (style) document.body.setAttribute("data-style", style);
  }
  setLook(query.get("theme"), query.get("style") ?? CONFIG.style);

  function one(name) {
    return document.querySelector(`[data-dyn="${name}"]`);
  }

  function keyed(name, attribute) {
    const found = {};
    for (const element of document.querySelectorAll(`[data-dyn="${name}"]`)) found[element.getAttribute(attribute)] = element;
    return found;
  }

  const written = new WeakMap();
  const STYLE_PROPERTIES = { glow: "--glow", hot: "--hot", weight: "--anatomy-weight" };

  function write(element, name, value) {
    if (!element) return;
    let seen = written.get(element);
    if (!seen) {
      seen = {};
      written.set(element, seen);
    }
    if (seen[name] === value) return;
    seen[name] = value;
    if (STYLE_PROPERTIES[name]) element.style.setProperty(STYLE_PROPERTIES[name], value);
    else if (name === "stroke") element.style.stroke = value;
    else if (name === "text") element.textContent = value;
    else if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  function setGlow(element, value) {
    write(element, "glow", String(Math.round(value * 100) / 100));
  }

  const trace = (points, closed = false) => pathOf(points.map((point) => iso(point, P)), closed);

  const parts = {
    zoom: one("zoom"),
    zoomSource: one("zoom-source"),
    zoomTies: one("zoom-ties"),
    zoomUse: one("zoom-use"),
    zoomRects: [one("zoom-clip"), one("zoom-paper"), one("zoom-edge")],
    chips: Array.from(document.querySelectorAll("[data-trace]")),
    stepItems: Array.from(document.querySelectorAll("[data-step-item]")),
    stepMarks: Array.from(document.querySelectorAll("[data-stepmark]")),
  };

  const clock = { speed: 1, touring: false, held: false, visible: manual, frame: 0, last: 0, resumeTimer: 0, elapsed: 0, tourTime: 0 };
  // `age` is seconds since the zoom frame was born (below zero: not yet); `shown` fades it for the
  // take-apart; `held` keeps it unborn, which only the film uses, for its opening seconds.
  const zoom = { age: -1, shown: 1, held: false };
  const steps = { shown: 0 };
  const explode = Explode.createExplode();
  const world = one("world");
  const lens = one("lens");
  const itemNodes = Array.from(world.children);
  const badges = Array.from(document.querySelectorAll("[data-badge]"));
  const worldZero = iso([0, 0, 0], P);
  const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => {
    const tip = iso(axis, P);
    return [tip[0] - worldZero[0], tip[1] - worldZero[1]];
  });
  const apartState = { armed: false, painted: itemNodes.map((_, index) => index) };
  const eventLog = [];
  const FLIGHT_SECONDS = Explode.SPRING.stagger * Explode.LEAVE_ORDER.length + 0.5;
  const sound = { on: false, context: null, master: null, bus: null, noise: null };

  function say(text) {
    if (announcer) announcer.textContent = text;
  }

  const kit = { P, CONFIG, Motion, Effects: Kit.Effects, Explode, explode, clock, manual, still, one, keyed, write, setGlow, trace, emit, say, afterAction, apartBusy, run };
  const hooks = createHooks(kit);
  const disabledWhileApart = (hooks.disabledWhileApart ?? []).map((selector) => document.querySelector(selector)).filter(Boolean);

  // ---- clock and zoom --------------------------------------------------------------------------------------

  function wantsTour() {
    return clock.touring && !clock.held && !still.matches && !apartBusy() && Boolean(hooks.tour);
  }

  function stepTour(seconds) {
    if (!wantsTour() || (hooks.tourPaused && hooks.tourPaused())) return;
    const before = clock.tourTime;
    clock.tourTime += seconds;
    for (const [at, action, value] of hooks.tour.steps) {
      if (before < at && clock.tourTime >= at) hooks.actions[action](value);
    }
    if (clock.tourTime >= hooks.tour.seconds) clock.tourTime = 0;
  }

  function stepZoom(seconds) {
    if (zoom.age < 0 && !zoom.held && hooks.zoomReady()) zoom.age = still.matches ? 100 : 0;
    else if (zoom.age >= 0) zoom.age += seconds;
    const target = apartWanted() || Explode.maxShare(explode) > 0.001 ? 0 : 1;
    const reach = seconds / ZOOM_FADE_SECONDS;
    zoom.shown = Math.abs(target - zoom.shown) <= reach ? target : zoom.shown + Math.sign(target - zoom.shown) * reach;
  }

  // Plays `seconds` of the figure's clock. The machine's own clock runs at `clock.speed` times that.
  function advance(seconds) {
    clock.elapsed += seconds;
    stepTour(seconds);
    hooks.advance(seconds, clock.speed);
    stepZoom(seconds);
  }

  function busy() {
    const born = zoom.age >= 0 && zoom.age < BIRTH.mark + BIRTH.grow + BIRTH.linger + BIRTH.fade;
    return hooks.busy() || born || (zoom.shown > 0 && zoom.shown < 1);
  }

  // ---- drawing ---------------------------------------------------------------------------------------------

  function drawLevels() {
    const traceLevels = hooks.traceLevels();
    parts.chips.forEach((chip, index) => setGlow(chip, traceLevels[index] ?? 0));
    const stepLevels = hooks.stepLevels();
    parts.stepItems.forEach((item, index) => setGlow(item, stepLevels[index] ?? 0));
  }

  // The zoom frame is born from the model: a thin rectangle appears round the part, the frame grows out
  // of it to its place with four dashed lines joining the corners, and then rectangle and lines fade.
  function drawZoom(view) {
    const source = CONFIG.zoom.source;
    const frame = CONFIG.zoom.frame;
    const age = zoom.age;
    const born = age >= BIRTH.mark;
    const grown = born ? Motion.easeOutCubic((age - BIRTH.mark) / BIRTH.grow) : 0;
    const fading = 1 - Motion.smoothstep(0, BIRTH.fade, age - BIRTH.mark - BIRTH.grow - BIRTH.linger);
    const onScreen = (x, y) => [EX.width / 2 + (x - view.x) * view.zoom, EX.height / 2 + (y - view.y) * view.zoom];
    const startCentre = onScreen(source.x, source.y);
    const start = { x: startCentre[0] - (source.width * view.zoom) / 2, y: startCentre[1] - (source.height * view.zoom) / 2, width: source.width * view.zoom, height: source.height * view.zoom };
    const now = {};
    for (const name of ["x", "y", "width", "height"]) now[name] = start[name] + (frame[name] - start[name]) * grown;
    const scale = now.width / source.width;
    const corner = (frame.corner * scale) / source.scale;
    for (const rect of parts.zoomRects) {
      write(rect, "x", now.x.toFixed(1));
      write(rect, "y", now.y.toFixed(1));
      write(rect, "width", now.width.toFixed(1));
      write(rect, "height", now.height.toFixed(1));
      write(rect, "rx", corner.toFixed(1));
    }
    write(parts.zoomUse, "transform", `translate(${(now.x + now.width / 2).toFixed(2)} ${(now.y + now.height / 2).toFixed(2)}) scale(${scale.toFixed(4)}) translate(${(-source.x).toFixed(2)} ${(-source.y).toFixed(2)})`);
    const weight = parseFloat(getComputedStyle(document.body).getPropertyValue("--anatomy-weight")) || 1;
    write(parts.zoomUse, "weight", `${((weight * ZOOM_LINE_GAIN) / Math.max(1, scale)).toFixed(3)}px`);
    const ties = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([right, down]) => `M${(start.x + start.width * right).toFixed(1)} ${(start.y + start.height * down).toFixed(1)}L${(now.x + now.width * right).toFixed(1)} ${(now.y + now.height * down).toFixed(1)}`);
    write(parts.zoomTies, "d", ties.join(""));
    setGlow(parts.zoomSource, age < 0 ? 0 : Motion.smoothstep(0, BIRTH.mark, age) * fading * zoom.shown);
    setGlow(parts.zoomTies, born ? Motion.smoothstep(0, 0.12, age - BIRTH.mark) * fading * zoom.shown : 0);
    setGlow(parts.zoom, born ? Motion.smoothstep(0, 0.1, age - BIRTH.mark) * zoom.shown : 0);
  }

  function draw() {
    const assembled = 1 - Math.min(1, Math.max(0, Explode.maxShare(explode)));
    hooks.draw(assembled);
    drawLevels();
    const text = apartReadout() ?? hooks.readout();
    if (readout.textContent !== text) readout.textContent = text;
    write(stage, "data-stage", hooks.stageName ? hooks.stageName() : null);
    drawApart();
  }

  // ---- the exploded view -----------------------------------------------------------------------------------

  function apartWanted() {
    return explode.apart || apartState.armed;
  }

  function apartBusy() {
    return apartState.armed || explode.apart || !Explode.isResting(explode);
  }

  function apartReadout() {
    if (apartState.armed) return hooks.armedText ?? "stopping · then apart";
    if (explode.apart) return Explode.isResting(explode) ? `apart · ${CONFIG.apartWords.many} assemblies` : "coming apart";
    if (!Explode.isResting(explode) && Explode.maxShare(explode) > 0.01) return "going back together";
    return null;
  }

  function openApart(calm) {
    apartState.armed = false;
    Explode.setApart(explode, true, calm);
    emit("apart-open", { duration: FLIGHT_SECONDS });
    if (calm) emit("apart-hold", {});
    say(`Apart in ${CONFIG.apartWords.many} numbered assemblies.`);
  }

  function closeApart(calm) {
    apartState.armed = false;
    Explode.setApart(explode, false, calm);
    emit("apart-close", { duration: FLIGHT_SECONDS });
    if (calm) emit("apart-seated", {});
    say("Going back together.");
  }

  // Arming: the machine only comes apart at rest and with the zoom frame gone, so it is stopped first.
  function setApartWanted(wanted) {
    if (wanted === apartWanted()) return;
    if (!wanted && apartState.armed) apartState.armed = false;
    else if (!wanted) closeApart(still.matches);
    else {
      hooks.prepareApart();
      if (still.matches) {
        hooks.settleStill(STILL_SECONDS);
        zoom.shown = 0;
        openApart(true);
      } else apartState.armed = true;
    }
    draw();
    run();
  }

  function toggleApart() {
    setApartWanted(!apartWanted());
  }

  function everyShare(test) {
    return Explode.LEAVE_ORDER.every((name) => test(explode.shares[name]));
  }

  function stepApart(seconds) {
    if (apartState.armed && hooks.readyToOpen() && zoom.shown < 0.01) openApart(false);
    if (Explode.isResting(explode)) return apartState.armed;
    for (const event of Explode.stepExplode(explode, seconds)) {
      emit(`piece-${event.name}`, { piece: event.piece, number: Explode.PIECES[event.piece].number }, event.at);
      const arrived = (share) => !share.pending && (share.landed || share.crossed);
      if (event.name === "arrive" && everyShare((share) => share.spring.target === 1 && arrived(share))) emit("apart-hold", {}, event.at);
      if (event.name === "land" && everyShare((share) => share.spring.target === 0 && arrived(share))) emit("apart-seated", {}, event.at);
    }
    if (Explode.isResting(explode) && !explode.apart && !manual) quietTour();
    return true;
  }

  function sameList(first, second) {
    for (let index = 0; index < first.length; index++) {
      if (first[index] !== second[index]) return false;
    }
    return true;
  }

  // Re-appends the items only when the painter's order really changed.
  function paintItems(shifts) {
    const assembled = Explode.isResting(explode) && !explode.apart;
    const order = assembled ? itemNodes.map((_, index) => index) : Explode.paintOrder(EX.items, shifts, AXES).order;
    if (sameList(order, apartState.painted)) return;
    const fragment = document.createDocumentFragment();
    for (const index of order) fragment.appendChild(itemNodes[index]);
    world.appendChild(fragment);
    apartState.painted = order;
  }

  // The view pulls back just far enough to keep the apart pose inside the card. A machine may run its own
  // camera (`hooks.camera()` gives { x, y, zoom }: the rest-frame point to centre and the magnification);
  // the apart view blends from it, and badges, step marks and the zoom birth all follow it.
  function worldView(open) {
    const centre = [EX.width / 2, EX.height / 2];
    const base = hooks.camera ? hooks.camera() : { x: centre[0], y: centre[1], zoom: 1 };
    const fit = Math.min(1, (EX.width - EX.margin.x) / EX.apart.width, (EX.height - EX.margin.y) / EX.apart.height);
    const share = Motion.smoothstep(0, 1, open);
    const apartY = EX.apart.y + EX.margin.lift / fit;
    return { x: base.x + (EX.apart.x - base.x) * share, y: base.y + (apartY - base.y) * share, zoom: base.zoom + (fit - base.zoom) * share };
  }

  function placeOnStage(node, point, view, opacity) {
    const spot = iso(point, P);
    const left = `${(((EX.width / 2 + (spot[0] - view.x) * view.zoom) / EX.width) * 100).toFixed(2)}%`;
    const top = `${(((EX.height / 2 + (spot[1] - view.y) * view.zoom) / EX.height) * 100).toFixed(2)}%`;
    if (node.style.left !== left) node.style.left = left;
    if (node.style.top !== top) node.style.top = top;
    if (node.style.opacity !== opacity) node.style.opacity = opacity;
  }

  function placeBadges(shifts, view) {
    for (const badge of badges) {
      const name = badge.getAttribute("data-badge");
      const anchor = EX.anchors[name];
      const shift = shifts[name];
      const share = Explode.isFixed(name) ? Explode.maxShare(explode) : Explode.shareOf(explode, name);
      placeOnStage(badge, [anchor[0] + shift[0], anchor[1] + shift[1], anchor[2] + shift[2]], view, Motion.smoothstep(0.5, 0.95, share).toFixed(2));
    }
  }

  function placeStepMarks(view, open) {
    if (!parts.stepMarks.length) return;
    const levels = hooks.stepLevels();
    parts.stepMarks.forEach((mark, index) => placeOnStage(mark, CONFIG.stepPoints[index], view, ((levels[index] ?? 0) * steps.shown * (1 - open)).toFixed(2)));
  }

  function drawApart() {
    const shifts = Explode.shiftsOf(explode);
    const open = Math.min(1, Math.max(0, Explode.maxShare(explode)));
    itemNodes.forEach((node, index) => {
      const shift = shifts[EX.items[index].piece];
      const moved = Math.abs(shift[0]) + Math.abs(shift[1]) + Math.abs(shift[2]) > 1e-6;
      write(node, "transform", moved ? translateAlong(P, shift) : null);
    });
    paintItems(shifts);
    const view = worldView(open);
    const centredAtRest = view.zoom === 1 && view.x === EX.width / 2 && view.y === EX.height / 2;
    const centred = `translate(${EX.width / 2} ${EX.height / 2}) scale(${view.zoom.toFixed(4)}) translate(${(-view.x).toFixed(2)} ${(-view.y).toFixed(2)})`;
    write(lens, "transform", centredAtRest ? null : centred);
    placeBadges(shifts, view);
    placeStepMarks(view, open);
    drawZoom(view);
    const legend = Motion.smoothstep(0.55, 0.95, Explode.leastShare(explode)).toFixed(2);
    if (document.body.style.getPropertyValue("--ma-apart") !== legend) document.body.style.setProperty("--ma-apart", legend);
    write(stage, "data-open", open > 0.005 ? "" : null);
    write(apartButton, "aria-pressed", String(apartWanted()));
    write(apartButton, "text", apartWanted() ? "Put together" : "Take apart");
    for (const button of disabledWhileApart) write(button, "disabled", apartBusy() ? "" : null);
  }

  // ---- sound -----------------------------------------------------------------------------------------------
  // The figure reports what happens as named events with a time on its own clock. The page plays them
  // through Web Audio when the reader turns sound on; the recorder takes the log and renders the film's
  // track offline (kit/sound.mjs) with the same voices.

  const MASTER_GAIN = 0.16;
  const HIGH_PASS = 110;
  const LOW_PASS = 3500;
  const MODE_GAIN = 3;
  const TAP_SECONDS = 0.07;
  const SWELL_LOW_PASS = 650;
  const decibels = (value) => 10 ** (value / 20);

  function emit(name, detail, at = null) {
    if (manual) eventLog.push({ name, at: Math.round((at ?? clock.elapsed) * 10000) / 10000, ...detail });
    if (sound.on && sound.context) playVoice(name, detail);
  }

  function audioReady() {
    if (sound.context) return sound.context;
    const context = new AudioContext();
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
    sound.context = context;
    sound.noise = buffer;
    sound.master = context.createGain();
    sound.master.gain.value = MASTER_GAIN;
    sound.master.connect(context.destination);
    const dull = context.createBiquadFilter();
    dull.type = "lowpass";
    dull.frequency.value = LOW_PASS;
    dull.Q.value = 0.5;
    dull.connect(sound.master);
    sound.bus = context.createBiquadFilter();
    sound.bus.type = "highpass";
    sound.bus.frequency.value = HIGH_PASS;
    sound.bus.Q.value = 0.5;
    sound.bus.connect(dull);
    return context;
  }

  function variationOf() {
    const spread = () => Math.random() * 2 - 1;
    return { pitch: 1 + spread() * 0.07, level: decibels(spread() * 2), late: Math.random() * 0.004 };
  }

  // One tap: the noise of the blow fades in over a few milliseconds and dies away through two low-Q
  // resonances that are silent again within about 35 ms.
  function tap(body, level) {
    const context = sound.context;
    const variation = variationOf();
    const start = context.currentTime + variation.late;
    const source = context.createBufferSource();
    const blow = context.createGain();
    source.buffer = sound.noise;
    source.loop = true;
    blow.gain.setValueAtTime(0, start);
    blow.gain.linearRampToValueAtTime(1, start + body.attack);
    blow.gain.setTargetAtTime(0, start + body.attack, body.blow);
    source.connect(blow);
    for (const [frequency, ringTime, share] of body.modes) {
      const mode = context.createBiquadFilter();
      const out = context.createGain();
      mode.type = "bandpass";
      mode.frequency.value = frequency * variation.pitch;
      mode.Q.value = Math.max(1, Math.PI * frequency * ringTime);
      out.gain.value = share * level * variation.level * MODE_GAIN;
      blow.connect(mode).connect(out).connect(sound.bus);
    }
    source.start(start, Math.random() * 0.5);
    source.stop(start + TAP_SECONDS);
  }

  function swell(level, detail) {
    const context = sound.context;
    const start = context.currentTime;
    const duration = detail.duration ?? 1;
    const source = context.createBufferSource();
    const dull = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = sound.noise;
    source.loop = true;
    dull.type = "lowpass";
    dull.frequency.value = SWELL_LOW_PASS;
    dull.Q.value = 0.5;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level * (detail.level ?? 1), start + duration * 0.45);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    source.connect(dull).connect(gain).connect(sound.bus);
    source.start(start, Math.random());
    source.stop(start + duration + 0.05);
  }

  function playVoice(name, detail) {
    const voice = CONFIG.sound.voices[name];
    if (!voice) return;
    const level = decibels(voice.level ?? 0);
    if (voice.swell) swell(level, detail);
    else tap(CONFIG.sound.bodies[voice.tap], level);
  }

  function toggleSound() {
    sound.on = !sound.on;
    if (sound.on) audioReady().resume();
    soundButton.setAttribute("aria-pressed", String(sound.on));
    soundButton.textContent = sound.on ? "Sound on" : "Sound";
  }

  // ---- loop, pointer, keyboard -----------------------------------------------------------------------------

  function tick(now) {
    const dt = clock.last ? Math.min((now - clock.last) / 1000, 1 / 30) : 1 / 60;
    clock.last = now;
    const flying = stepApart(dt);
    if (!still.matches) advance(dt);
    draw();
    const active = flying || (!still.matches && (busy() || wantsTour()));
    clock.frame = clock.visible && active ? requestAnimationFrame(tick) : 0;
  }

  function run() {
    if (manual || clock.frame || !clock.visible) return;
    clock.last = 0;
    clock.frame = requestAnimationFrame(tick);
  }

  function quietTour() {
    clock.touring = false;
    clearTimeout(clock.resumeTimer);
    if (manual) return;
    clock.resumeTimer = setTimeout(() => {
      clock.touring = tourAllowed && !still.matches;
      clock.tourTime = hooks.tourResumeAt ? hooks.tourResumeAt() : 0;
      run();
    }, RESUME_AFTER);
  }

  // Reduced motion: no travel; the machine jumps to where it settles.
  function afterAction() {
    quietTour();
    if (still.matches) {
      hooks.settleStill(STILL_SECONDS);
      stepZoom(0);
    }
    draw();
    run();
  }

  function hold(value) {
    clock.held = value;
    if (!value) quietTour();
    run();
  }

  function onKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.shiftKey && event.key.toUpperCase() === "E") {
      event.preventDefault();
      toggleApart();
      return;
    }
    const keyName = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const action = (hooks.keys ?? {})[keyName];
    if (!action) return;
    event.preventDefault();
    action();
  }

  if (!manual) {
    stage.addEventListener("pointerenter", () => hold(true));
    stage.addEventListener("pointerleave", () => hold(false));
    stage.addEventListener("focusin", () => hold(true));
    stage.addEventListener("focusout", () => hold(false));
    if (hooks.onStageClick) stage.addEventListener("click", hooks.onStageClick);
    stage.addEventListener("keydown", onKey);
    apartButton.addEventListener("click", toggleApart);
    soundButton.addEventListener("click", toggleSound);
    if (hooks.wire) hooks.wire();
    new IntersectionObserver(
      (entries) => {
        clock.visible = entries[entries.length - 1].isIntersecting;
        if (clock.visible) run();
      },
      { rootMargin: "120px 0px" },
    ).observe(stage);
    still.addEventListener("change", () => {
      clock.touring = tourAllowed && !still.matches;
      draw();
      run();
    });
  }

  clock.touring = !manual && tourAllowed && !still.matches;
  if (query.get("apart") === "1") {
    zoom.shown = 0;
    Explode.setApart(explode, true, true);
  }
  draw();

  // A deterministic clock for frame-by-frame capture: open the page with ?clock=manual and drive it from
  // here. Every call advances the figure's own clock, so the event log carries exact film times.
  const kitActions = {
    holdZoom(held) {
      zoom.held = held;
    },
    setSpeed(speed) {
      clock.speed = speed;
    },
    setApart(apart) {
      explode.time = clock.elapsed;
      setApartWanted(apart);
    },
    steps(opacity) {
      steps.shown = opacity;
      document.body.style.setProperty("--ma-steps", String(opacity));
    },
  };

  window.__anatomy = {
    pieces: CONFIG.explodeSpec.pieces,
    advance(seconds) {
      explode.time = clock.elapsed;
      stepApart(seconds);
      advance(seconds);
      draw();
    },
    act(name, value) {
      const action = kitActions[name] ?? hooks.actions[name];
      if (!action) throw new Error(`no action "${name}"`);
      action(value);
    },
    look(theme, style) {
      setLook(theme, style);
    },
    project(point) {
      return iso(point, P);
    },
    takeEvents() {
      return eventLog.splice(0);
    },
    state() {
      const round = (value) => Math.round(value * 10000) / 10000;
      return {
        ...hooks.snapshot(),
        working: hooks.working(),
        zoomAge: round(zoom.age),
        zoomShown: round(zoom.shown),
        apart: explode.apart,
        open: round(Explode.maxShare(explode)),
        resting: Explode.isResting(explode),
        time: round(clock.elapsed),
        readout: readout.textContent,
      };
    },
  };
}
