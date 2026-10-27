// A pelican riding a bicycle, side view, facing right, drawn in film pixels (1920x1080).
// Each moving piece is its own part so the stippled points can follow the pose later.
// Ink darkness is the alpha of a black stroke on white; the density field is that darkness.

export const PART = {
  body: 1,
  frame: 2,
  rearWheel: 3,
  frontWheel: 4,
  crank: 5,
  nearPedal: 6,
  farPedal: 7,
  nearThigh: 8,
  nearShin: 9,
  nearFoot: 10,
  farThigh: 11,
  farShin: 12,
  farFoot: 13,
};
export const PART_COUNT = 14;

export const BIKE = {
  rearHub: { x: 700, y: 820 },
  frontHub: { x: 1240, y: 820 },
  tireRadius: 146,
  rimRadius: 132,
  bottomBracket: { x: 950, y: 836 },
  crankLength: 62,
  chainringRadius: 40,
  cogRadius: 16,
};
// Chainring 40 teeth, rear cog 16 teeth: the wheel turns 2.5 times per crank turn.
export const GEAR_RATIO = 40 / 16;

export const LEG = {
  hip: { x: 936, y: 520 },
  thighLength: 186,
  shinLength: 182,
  ankleAbovePedal: { x: -6, y: -22 },
  restCrankAngle: (20 * Math.PI) / 180,
};

export function pedalPosition(crankAngle) {
  return {
    x: BIKE.bottomBracket.x + BIKE.crankLength * Math.cos(crankAngle),
    y: BIKE.bottomBracket.y + BIKE.crankLength * Math.sin(crankAngle),
  };
}

// Two-bone inverse kinematics with the knee bent forward (towards +x).
export function legJoints(crankAngle) {
  const pedal = pedalPosition(crankAngle);
  const ankle = { x: pedal.x + LEG.ankleAbovePedal.x, y: pedal.y + LEG.ankleAbovePedal.y };
  const hip = LEG.hip;
  const deltaX = ankle.x - hip.x;
  const deltaY = ankle.y - hip.y;
  const reach = Math.min(Math.hypot(deltaX, deltaY), LEG.thighLength + LEG.shinLength - 0.001);
  const towardAnkle = Math.atan2(deltaY, deltaX);
  const cosHipBend =
    (LEG.thighLength ** 2 + reach ** 2 - LEG.shinLength ** 2) / (2 * LEG.thighLength * reach);
  const hipBend = Math.acos(Math.max(-1, Math.min(1, cosHipBend)));
  // In y-down screen space, subtracting the bend swings the knee forward for a leg pointing down.
  const thighAngle = towardAnkle - hipBend;
  const knee = {
    x: hip.x + LEG.thighLength * Math.cos(thighAngle),
    y: hip.y + LEG.thighLength * Math.sin(thighAngle),
  };
  return { hip, knee, ankle, pedal };
}

function strokePath(ctx, darkness, width, build) {
  ctx.beginPath();
  build(ctx);
  ctx.strokeStyle = `rgba(0,0,0,${darkness})`;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function fillPath(ctx, darkness, build) {
  ctx.beginPath();
  build(ctx);
  ctx.fillStyle = `rgba(0,0,0,${darkness})`;
  ctx.fill();
}

function line(ctx, darkness, width, x1, y1, x2, y2) {
  strokePath(ctx, darkness, width, (path) => {
    path.moveTo(x1, y1);
    path.lineTo(x2, y2);
  });
}

function circle(ctx, darkness, width, x, y, radius) {
  strokePath(ctx, darkness, width, (path) => path.arc(x, y, radius, 0, Math.PI * 2));
}

// Deterministic pseudo-random numbers so the drawing is identical on every run.
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function drawWheel(ctx, hub) {
  const { x, y } = hub;
  circle(ctx, 0.92, 11, x, y, BIKE.tireRadius);
  // Tread: short ticks around the outside of the tyre.
  for (let tick = 0; tick < 72; tick += 1) {
    const angle = (tick / 72) * Math.PI * 2;
    const inner = BIKE.tireRadius + 4;
    const outer = BIKE.tireRadius + 9;
    line(ctx, 0.5, 2, x + inner * Math.cos(angle), y + inner * Math.sin(angle),
      x + outer * Math.cos(angle), y + outer * Math.sin(angle));
  }
  circle(ctx, 0.7, 3, x, y, BIKE.rimRadius);
  circle(ctx, 0.35, 2, x, y, BIKE.rimRadius - 7);
  // Crossed (tangent) lacing: each spoke leaves the hub flange and meets the rim offset in angle.
  const spokeCount = 16;
  for (let spoke = 0; spoke < spokeCount; spoke += 1) {
    const hubAngle = (spoke / spokeCount) * Math.PI * 2;
    const rimAngle = hubAngle + (spoke % 2 === 0 ? 0.42 : -0.42);
    line(ctx, 0.55, 2, x + 13 * Math.cos(hubAngle), y + 13 * Math.sin(hubAngle),
      x + (BIKE.rimRadius - 6) * Math.cos(rimAngle), y + (BIKE.rimRadius - 6) * Math.sin(rimAngle));
  }
  circle(ctx, 0.85, 5, x, y, 14);
  fillPath(ctx, 0.9, (path) => path.arc(x, y, 5, 0, Math.PI * 2));
  // Valve stem, so the eye can follow the wheel turning.
  const valveAngle = -1.1;
  line(ctx, 0.85, 4, x + (BIKE.rimRadius - 6) * Math.cos(valveAngle), y + (BIKE.rimRadius - 6) * Math.sin(valveAngle),
    x + (BIKE.rimRadius - 22) * Math.cos(valveAngle), y + (BIKE.rimRadius - 22) * Math.sin(valveAngle));
}

function drawFrame(ctx) {
  const bracket = BIKE.bottomBracket;
  const rear = BIKE.rearHub;
  const front = BIKE.frontHub;
  const seatCluster = { x: 905, y: 596 };
  const headTop = { x: 1150, y: 586 };
  const headBottom = { x: 1168, y: 652 };
  const tube = 0.9;
  line(ctx, tube, 9, bracket.x, bracket.y, seatCluster.x, seatCluster.y);
  line(ctx, tube, 9, seatCluster.x, seatCluster.y, headTop.x, headTop.y + 6);
  line(ctx, tube, 10, headBottom.x - 4, headBottom.y - 10, bracket.x, bracket.y);
  line(ctx, tube, 12, headTop.x, headTop.y, headBottom.x, headBottom.y);
  line(ctx, tube, 7, bracket.x, bracket.y, rear.x, rear.y);
  line(ctx, tube, 6, seatCluster.x, seatCluster.y + 6, rear.x, rear.y);
  // Fork with a little forward rake.
  strokePath(ctx, tube, 8, (path) => {
    path.moveTo(headBottom.x, headBottom.y);
    path.quadraticCurveTo(1196, 770, front.x, front.y);
  });
  // Seat post and saddle with its rails.
  line(ctx, tube, 7, seatCluster.x, seatCluster.y, 896, 556);
  fillPath(ctx, 0.85, (path) => {
    path.moveTo(842, 546);
    path.bezierCurveTo(860, 530, 920, 534, 958, 542);
    path.bezierCurveTo(950, 552, 900, 558, 846, 558);
    path.closePath();
  });
  line(ctx, 0.6, 3, 860, 560, 930, 556);
  // Stem and swept-back cruiser handlebar ending in a grip.
  line(ctx, tube, 8, headTop.x, headTop.y, 1160, 548);
  strokePath(ctx, tube, 7, (path) => {
    path.moveTo(1160, 548);
    path.bezierCurveTo(1185, 538, 1180, 516, 1140, 514);
    path.lineTo(1104, 516);
  });
  line(ctx, 0.95, 14, 1104, 516, 1076, 518);
  // Rear cog and the chain: two runs tangent to chainring and cog, drawn as link plates.
  circle(ctx, 0.8, 4, rear.x, rear.y, BIKE.cogRadius);
  const runs = [
    [bracket.x, bracket.y - BIKE.chainringRadius, rear.x, rear.y - BIKE.cogRadius],
    [bracket.x, bracket.y + BIKE.chainringRadius, rear.x, rear.y + BIKE.cogRadius],
  ];
  for (const [x1, y1, x2, y2] of runs) {
    line(ctx, 0.55, 5, x1, y1, x2, y2);
    const linkCount = 22;
    for (let link = 0; link <= linkCount; link += 1) {
      const fraction = link / linkCount;
      fillPath(ctx, 0.75, (path) => path.arc(x1 + (x2 - x1) * fraction, y1 + (y2 - y1) * fraction, 2.6, 0, Math.PI * 2));
    }
  }
}

function drawCrank(ctx) {
  const { x, y } = BIKE.bottomBracket;
  circle(ctx, 0.8, 4, x, y, BIKE.chainringRadius);
  const teeth = 40;
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const angle = (tooth / teeth) * Math.PI * 2;
    line(ctx, 0.6, 3, x + BIKE.chainringRadius * Math.cos(angle), y + BIKE.chainringRadius * Math.sin(angle),
      x + (BIKE.chainringRadius + 5) * Math.cos(angle), y + (BIKE.chainringRadius + 5) * Math.sin(angle));
  }
  for (let arm = 0; arm < 5; arm += 1) {
    const angle = LEG.restCrankAngle + 0.6 + (arm / 5) * Math.PI * 2;
    line(ctx, 0.6, 4, x, y, x + 34 * Math.cos(angle), y + 34 * Math.sin(angle));
  }
  for (const angle of [LEG.restCrankAngle, LEG.restCrankAngle + Math.PI]) {
    const end = pedalPosition(angle);
    line(ctx, 0.95, 9, x, y, end.x, end.y);
  }
  fillPath(ctx, 0.95, (path) => path.arc(x, y, 9, 0, Math.PI * 2));
}

function drawPedal(ctx, crankAngle, darkness) {
  const pedal = pedalPosition(crankAngle);
  strokePath(ctx, darkness, 4, (path) => path.rect(pedal.x - 19, pedal.y - 5, 38, 10));
  line(ctx, darkness * 0.7, 2, pedal.x - 12, pedal.y, pedal.x + 12, pedal.y);
}

// A tapered limb segment: a quadrilateral from width startWidth to endWidth.
function taperedSegment(ctx, start, end, startWidth, endWidth, fillDarkness, edgeDarkness) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const normalX = -Math.sin(angle);
  const normalY = Math.cos(angle);
  const build = (path) => {
    path.moveTo(start.x + normalX * startWidth / 2, start.y + normalY * startWidth / 2);
    path.lineTo(end.x + normalX * endWidth / 2, end.y + normalY * endWidth / 2);
    path.arc(end.x, end.y, endWidth / 2, angle + Math.PI / 2, angle - Math.PI / 2, true);
    path.lineTo(start.x - normalX * startWidth / 2, start.y - normalY * startWidth / 2);
    path.arc(start.x, start.y, startWidth / 2, angle - Math.PI / 2, angle + Math.PI / 2, true);
    path.closePath();
  };
  fillPath(ctx, fillDarkness, build);
  strokePath(ctx, edgeDarkness, 4, build);
}

function drawThigh(ctx, joints, scale) {
  taperedSegment(ctx, joints.hip, joints.knee, 34, 20, 0.14 * scale, 0.85 * scale);
  // Feathered "trousers": short feather strokes on the upper thigh.
  for (let feather = 0; feather < 6; feather += 1) {
    const fraction = 0.12 + feather * 0.07;
    const x = joints.hip.x + (joints.knee.x - joints.hip.x) * fraction;
    const y = joints.hip.y + (joints.knee.y - joints.hip.y) * fraction;
    line(ctx, 0.5 * scale, 2.5, x - 10, y - 4, x + 6, y + 6);
  }
}

function drawShin(ctx, joints, scale) {
  taperedSegment(ctx, joints.knee, joints.ankle, 18, 13, 0.2 * scale, 0.85 * scale);
  // Scales on the tarsus: small cross ticks.
  for (let tick = 1; tick < 9; tick += 1) {
    const fraction = tick / 9;
    const x = joints.knee.x + (joints.ankle.x - joints.knee.x) * fraction;
    const y = joints.knee.y + (joints.ankle.y - joints.knee.y) * fraction;
    line(ctx, 0.45 * scale, 2, x - 6, y, x + 6, y);
  }
}

// Webbed foot spread over the pedal: three forward toes joined by webbing, a small hind toe.
function drawFoot(ctx, joints, scale) {
  const { ankle } = joints;
  const toes = [
    { x: ankle.x + 46, y: ankle.y + 10 },
    { x: ankle.x + 52, y: ankle.y + 22 },
    { x: ankle.x + 40, y: ankle.y + 30 },
  ];
  fillPath(ctx, 0.28 * scale, (path) => {
    path.moveTo(ankle.x, ankle.y);
    path.lineTo(toes[0].x, toes[0].y);
    path.quadraticCurveTo(ankle.x + 40, ankle.y + 18, toes[1].x, toes[1].y);
    path.quadraticCurveTo(ankle.x + 36, ankle.y + 24, toes[2].x, toes[2].y);
    path.closePath();
  });
  for (const toe of toes) {
    line(ctx, 0.9 * scale, 4, ankle.x, ankle.y, toe.x, toe.y);
    line(ctx, 0.95 * scale, 3, toe.x, toe.y, toe.x + 6, toe.y + 3);
  }
  line(ctx, 0.85 * scale, 4, ankle.x, ankle.y, ankle.x - 16, ankle.y + 8);
}

function drawPelican(ctx) {
  const random = seededRandom(7);
  const outline = 0.95;
  // Body: a heavy teardrop sitting on the saddle.
  const body = (path) => {
    path.moveTo(770, 470);
    path.bezierCurveTo(790, 380, 900, 340, 985, 360);
    path.bezierCurveTo(1030, 372, 1060, 410, 1056, 456);
    path.bezierCurveTo(1050, 510, 990, 545, 920, 548);
    path.bezierCurveTo(850, 550, 790, 525, 770, 470);
    path.closePath();
  };
  fillPath(ctx, 0.08, body);
  strokePath(ctx, outline, 5, body);
  // Breast feathers: short strokes following the curve of the chest.
  for (let feather = 0; feather < 70; feather += 1) {
    const angle = -0.3 + random() * 1.9;
    const radius = 40 + random() * 70;
    const x = 960 + radius * Math.cos(angle) * 0.9;
    const y = 450 + radius * Math.sin(angle) * 0.75;
    line(ctx, 0.32, 2, x, y, x - 7 + random() * 3, y + 9);
  }
  // Short stiff tail feathers behind the rump.
  for (let feather = 0; feather < 5; feather += 1) {
    const baseY = 462 + feather * 9;
    strokePath(ctx, 0.85, 3.5, (path) => {
      path.moveTo(780, baseY);
      path.quadraticCurveTo(740, baseY - 4 + feather * 2, 706, baseY - 10 + feather * 6);
    });
  }
  // Long S-shaped neck.
  const neck = (path) => {
    path.moveTo(990, 365);
    path.bezierCurveTo(960, 320, 990, 270, 1010, 236);
    path.lineTo(1062, 252);
    path.bezierCurveTo(1050, 300, 1030, 330, 1052, 430);
    path.closePath();
  };
  fillPath(ctx, 0.08, neck);
  strokePath(ctx, outline, 5, (path) => {
    path.moveTo(990, 365);
    path.bezierCurveTo(960, 320, 990, 270, 1010, 236);
  });
  strokePath(ctx, outline, 5, (path) => {
    path.moveTo(1062, 252);
    path.bezierCurveTo(1050, 300, 1030, 330, 1052, 430);
  });
  for (let feather = 0; feather < 14; feather += 1) {
    const y = 270 + feather * 10;
    const x = 1000 + Math.sin(feather * 0.5) * 12;
    line(ctx, 0.3, 2, x, y, x + 14, y + 6);
  }
  // Head, crest tuft and the pale skin ring around the eye.
  const head = (path) => path.ellipse(1040, 214, 42, 36, -0.2, 0, Math.PI * 2);
  fillPath(ctx, 0.08, head);
  strokePath(ctx, outline, 5, head);
  for (let tuft = 0; tuft < 6; tuft += 1) {
    strokePath(ctx, 0.8, 3, (path) => {
      path.moveTo(1004 + tuft * 4, 192 + tuft * 3);
      path.quadraticCurveTo(985 - tuft * 2, 186 + tuft * 4, 970 - tuft * 2, 196 + tuft * 6);
    });
  }
  circle(ctx, 0.75, 3, 1054, 205, 14);
  fillPath(ctx, 1, (path) => path.arc(1056, 205, 7.5, 0, Math.PI * 2));
  fillPath(ctx, 0, (path) => path.arc(1058, 202, 2.4, 0, Math.PI * 2));
  line(ctx, 0.7, 3, 1036, 188, 1070, 192);
  // Upper mandible: long and flat with a ridge and a hooked nail at the tip.
  const upperBill = (path) => {
    path.moveTo(1066, 196);
    path.bezierCurveTo(1150, 220, 1260, 262, 1328, 290);
    path.quadraticCurveTo(1346, 300, 1334, 314);
    path.quadraticCurveTo(1326, 304, 1312, 302);
    path.bezierCurveTo(1240, 284, 1140, 254, 1064, 236);
    path.closePath();
  };
  fillPath(ctx, 0.2, upperBill);
  strokePath(ctx, outline, 5, upperBill);
  strokePath(ctx, 0.55, 2.5, (path) => {
    path.moveTo(1080, 210);
    path.bezierCurveTo(1160, 236, 1250, 270, 1318, 294);
  });
  // Throat pouch hanging under the lower mandible, with soft fold lines.
  const pouch = (path) => {
    path.moveTo(1064, 238);
    path.bezierCurveTo(1150, 258, 1240, 288, 1310, 304);
    path.bezierCurveTo(1270, 330, 1190, 352, 1130, 344);
    path.bezierCurveTo(1090, 338, 1066, 300, 1058, 262);
    path.closePath();
  };
  fillPath(ctx, 0.14, pouch);
  strokePath(ctx, outline, 4.5, pouch);
  for (let fold = 0; fold < 5; fold += 1) {
    strokePath(ctx, 0.35, 2, (path) => {
      path.moveTo(1090 + fold * 30, 262 + fold * 8);
      path.quadraticCurveTo(1110 + fold * 28, 300 + fold * 4, 1100 + fold * 34, 330 + fold * 2);
    });
  }
  // Folded far-side wing along the back: outline, rows of covert scallops, long primaries.
  const foldedWing = (path) => {
    path.moveTo(980, 372);
    path.bezierCurveTo(920, 360, 830, 390, 760, 440);
    path.lineTo(700, 474);
    path.bezierCurveTo(780, 470, 860, 470, 930, 440);
    path.closePath();
  };
  fillPath(ctx, 0.12, foldedWing);
  strokePath(ctx, outline, 4.5, foldedWing);
  for (let row = 0; row < 3; row += 1) {
    for (let scallop = 0; scallop < 7; scallop += 1) {
      const x = 930 - scallop * 24 - row * 10;
      const y = 384 + row * 16 + scallop * 6;
      strokePath(ctx, 0.5, 2.5, (path) => path.arc(x, y, 10, 0.2, Math.PI - 0.2));
    }
  }
  for (let primary = 0; primary < 5; primary += 1) {
    strokePath(ctx, 0.75, 3, (path) => {
      path.moveTo(860 - primary * 6, 430 + primary * 6);
      path.quadraticCurveTo(780, 450 + primary * 4, 704 + primary * 4, 474 - primary * 1);
    });
  }
  // Near wing reaching forward and down to hold the handlebar grip.
  const nearWing = (path) => {
    path.moveTo(972, 384);
    path.bezierCurveTo(1030, 400, 1070, 450, 1100, 508);
    path.lineTo(1074, 530);
    path.bezierCurveTo(1040, 500, 990, 470, 940, 448);
    path.closePath();
  };
  fillPath(ctx, 0.16, nearWing);
  strokePath(ctx, outline, 5, nearWing);
  for (let covert = 0; covert < 6; covert += 1) {
    const x = 975 + covert * 18;
    const y = 418 + covert * 15;
    strokePath(ctx, 0.5, 2.5, (path) => path.arc(x, y, 11, 0.4, Math.PI + 0.4));
  }
  // Primary feathers wrapping round the grip like fingers.
  for (let primary = 0; primary < 4; primary += 1) {
    strokePath(ctx, 0.85, 3.5, (path) => {
      path.moveTo(1066 + primary * 8, 500 + primary * 4);
      path.quadraticCurveTo(1100 + primary * 4, 520 + primary * 3, 1080 + primary * 8, 534 + primary * 2);
    });
  }
}

// Draw one part at the rest pose. Used to build the density field and the part labels.
export function drawPart(ctx, part) {
  const near = legJoints(LEG.restCrankAngle);
  const far = legJoints(LEG.restCrankAngle + Math.PI);
  const farScale = 0.7;
  switch (part) {
    case PART.body: return drawPelican(ctx);
    case PART.frame: return drawFrame(ctx);
    case PART.rearWheel: return drawWheel(ctx, BIKE.rearHub);
    case PART.frontWheel: return drawWheel(ctx, BIKE.frontHub);
    case PART.crank: return drawCrank(ctx);
    case PART.nearPedal: return drawPedal(ctx, LEG.restCrankAngle, 0.9);
    case PART.farPedal: return drawPedal(ctx, LEG.restCrankAngle + Math.PI, 0.7);
    case PART.nearThigh: return drawThigh(ctx, near, 1);
    case PART.nearShin: return drawShin(ctx, near, 1);
    case PART.nearFoot: return drawFoot(ctx, near, 1);
    case PART.farThigh: return drawThigh(ctx, far, farScale);
    case PART.farShin: return drawShin(ctx, far, farScale);
    case PART.farFoot: return drawFoot(ctx, far, farScale);
    default: return undefined;
  }
}
