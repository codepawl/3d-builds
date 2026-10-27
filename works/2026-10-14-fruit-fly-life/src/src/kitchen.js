// The kitchen counter from above, for the adult's flight. World units are the aerial shot's pixels (the cut orange
// there is about 8 cm across, so 1 cm is about 84 units); the counter spans about 1.2 x 1 m. The striped towel under
// the oranges continues the aerial layer's stripes exactly, so the zoom from the kitchen into the aerial shot is seamless.
"use strict";

const Kitchen = (() => {
  const { hash } = Ink;
  const NAVY = "#1d1f33";
  // The world box the texture covers, and the texture's resolution (one texture pixel per 3.3 world units).
  const BOX = { left: -6000, top: -4600, right: 7000, bottom: 6000 };
  const TEXTURE_SCALE = 0.3;
  // Places the flight passes, in world units.
  const PLACES = {
    sink: { x: -2900, y: -1300, width: 2700, height: 1900 },
    mug: { x: -2700, y: 2500, radius: 420 },
    wine: { x: 2700, y: 2500, radius: 380 },
    bowl: { x: 3100, y: -1500, radius: 1250 },
    towel: { left: -900, top: -700, right: 2000, bottom: 1900 },
  };

  function outline(context, width = 14) {
    context.strokeStyle = NAVY;
    context.lineWidth = width;
    context.stroke();
  }

  function circle(context, x, y, radius) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
  }

  // A pale stone counter with flecks, a back wall strip of tiles, and a patch of window light.
  function counter(context) {
    context.fillStyle = "#e9e2d2";
    context.fillRect(BOX.left, BOX.top, BOX.right - BOX.left, BOX.bottom - BOX.top);
    for (let fleck = 0; fleck < 2600; fleck += 1) {
      const x = BOX.left + hash(fleck, 1) * (BOX.right - BOX.left);
      const y = BOX.top + hash(fleck, 2) * (BOX.bottom - BOX.top);
      context.fillStyle = hash(fleck, 3) > 0.5 ? "rgba(150,140,120,0.35)" : "rgba(255,255,255,0.5)";
      context.beginPath();
      context.arc(x, y, 6 + hash(fleck, 4) * 10, 0, Math.PI * 2);
      context.fill();
    }
    // Backsplash tiles along the wall at the top.
    context.fillStyle = "#cfe0e3";
    context.fillRect(BOX.left, BOX.top, BOX.right - BOX.left, 700);
    context.strokeStyle = "rgba(29,31,51,0.35)";
    context.lineWidth = 8;
    for (let column = 0; column * 500 < BOX.right - BOX.left; column += 1) {
      context.beginPath();
      context.moveTo(BOX.left + column * 500, BOX.top);
      context.lineTo(BOX.left + column * 500, BOX.top + 700);
      context.stroke();
    }
    context.beginPath();
    context.moveTo(BOX.left, BOX.top + 350);
    context.lineTo(BOX.right, BOX.top + 350);
    context.moveTo(BOX.left, BOX.top + 700);
    context.lineTo(BOX.right, BOX.top + 700);
    context.stroke();
    // Window light falling across the counter.
    context.fillStyle = "rgba(255,248,220,0.45)";
    context.beginPath();
    context.moveTo(-1500, BOX.top + 700);
    context.lineTo(1900, BOX.top + 700);
    context.lineTo(3600, BOX.bottom);
    context.lineTo(200, BOX.bottom);
    context.closePath();
    context.fill();
  }

  function sink(context) {
    const { x, y, width, height } = PLACES.sink;
    const radius = 320;
    const rounded = (inset) => {
      context.beginPath();
      context.roundRect(x - width / 2 + inset, y - height / 2 + inset, width - inset * 2, height - inset * 2, radius - inset);
    };
    rounded(-120);
    context.fillStyle = "#c9ced3";
    context.fill();
    outline(context);
    rounded(60);
    context.fillStyle = "#a9b1b8";
    context.fill();
    outline(context, 10);
    // Brushed steel: long strokes along the basin.
    context.save();
    rounded(60);
    context.clip();
    Fly.sketchShade(context, [x - width / 2, y - height / 2, x + width / 2, y + height / 2], {
      darkness: () => 0.5, clusters: 140, color: "#7c8690", alpha: 0.5, baseAngle: 0, spread: 0.2, seed: 61, width: 6,
    });
    context.restore();
    circle(context, x + 300, y + 200, 150);
    context.fillStyle = "#6f7880";
    context.fill();
    outline(context, 10);
    for (let slot = 0; slot < 6; slot += 1) {
      const turn = (slot / 6) * Math.PI;
      context.beginPath();
      context.moveTo(x + 300 + Math.cos(turn) * 110, y + 200 + Math.sin(turn) * 110);
      context.lineTo(x + 300 - Math.cos(turn) * 110, y + 200 - Math.sin(turn) * 110);
      outline(context, 8);
    }
    // Tap on the far edge.
    context.beginPath();
    context.roundRect(x - 110, y - height / 2 - 260, 220, 520, 90);
    context.fillStyle = "#dfe3e6";
    context.fill();
    outline(context, 10);
    // A few drops of water.
    [[-500, -300], [-200, 380], [650, -420]].forEach(([dropX, dropY]) => {
      circle(context, x + dropX, y + dropY, 45);
      context.fillStyle = "rgba(240,248,255,0.85)";
      context.fill();
      outline(context, 6);
    });
  }

  function mug(context) {
    const { x, y, radius } = PLACES.mug;
    context.save();
    context.filter = "blur(40px)";
    context.fillStyle = "rgba(60,40,30,0.25)";
    circle(context, x + 120, y + 140, radius * 1.05);
    context.fill();
    context.restore();
    // Handle, then the cup and the coffee.
    context.beginPath();
    context.roundRect(x + radius - 60, y - 110, 300, 220, 100);
    context.fillStyle = "#e6604a";
    context.fill();
    outline(context);
    circle(context, x, y, radius);
    context.fillStyle = "#e6604a";
    context.fill();
    outline(context);
    circle(context, x, y, radius * 0.8);
    context.fillStyle = "#5a3522";
    context.fill();
    outline(context, 10);
    context.strokeStyle = "rgba(255,240,220,0.6)";
    context.lineWidth = 16;
    context.beginPath();
    context.arc(x - 60, y - 60, radius * 0.5, Math.PI * 1.1, Math.PI * 1.5);
    context.stroke();
  }

  // A wine glass from above: the foot's rim, the bowl's rim, and a disc of red wine (flies love it).
  function wine(context) {
    const { x, y, radius } = PLACES.wine;
    context.save();
    context.filter = "blur(30px)";
    context.fillStyle = "rgba(150,30,50,0.15)";
    circle(context, x + 160, y + 160, radius * 1.1);
    context.fill();
    context.restore();
    circle(context, x, y, radius * 1.15);
    context.fillStyle = "rgba(235,245,250,0.5)";
    context.fill();
    outline(context, 8);
    circle(context, x, y, radius);
    context.fillStyle = "rgba(240,248,252,0.6)";
    context.fill();
    outline(context, 10);
    circle(context, x, y, radius * 0.72);
    context.fillStyle = "#8e1b34";
    context.fill();
    outline(context, 8);
    context.strokeStyle = "rgba(255,255,255,0.85)";
    context.lineWidth = 18;
    context.beginPath();
    context.arc(x, y, radius * 0.88, Math.PI * 1.05, Math.PI * 1.45);
    context.stroke();
  }

  // A bowl of fruit: apples, a banana bunch, an orange, a lemon.
  function bowl(context) {
    const { x, y, radius } = PLACES.bowl;
    context.save();
    context.filter = "blur(50px)";
    context.fillStyle = "rgba(60,40,30,0.25)";
    circle(context, x + 160, y + 180, radius * 1.02);
    context.fill();
    context.restore();
    circle(context, x, y, radius);
    context.fillStyle = "#f1ece0";
    context.fill();
    outline(context);
    circle(context, x, y, radius * 0.86);
    context.fillStyle = "#e3dccb";
    context.fill();
    outline(context, 8);
    // Fills the current path, shades its lower right in pencil, outlines it. The light comes from the top left.
    const shadedShape = (makePath, color, [centerX, centerY, reach], seed) => {
      makePath();
      context.fillStyle = color;
      context.fill();
      context.save();
      makePath();
      context.clip();
      Fly.sketchShade(context, [centerX - reach, centerY - reach, centerX + reach, centerY + reach], {
        darkness: (pointX, pointY) => Math.max(0, ((pointX - centerX) + (pointY - centerY)) / (reach * 1.6)) ** 1.5,
        clusters: 50, color: "rgba(60,20,20,0.9)", alpha: 0.45, baseAngle: 0.6, spread: 1, seed, width: 7,
      });
      context.restore();
      makePath();
      outline(context, 12);
    };
    const glint = (glintX, glintY, glintRadius) => {
      context.fillStyle = "rgba(255,255,255,0.75)";
      circle(context, glintX, glintY, glintRadius);
      context.fill();
    };

    // A bunch of three bananas fanned from one stalk: crescents with a ridge, a green stalk and dark tips.
    const stalk = [x - 860, y + 380];
    [0.12, 0.3, 0.48].forEach((turn, index) => {
      context.save();
      context.translate(stalk[0], stalk[1]);
      context.rotate(turn);
      context.scale(0.8, 0.8);
      const fingerPath = () => {
        context.beginPath();
        context.moveTo(0, 0);
        context.quadraticCurveTo(560, -430, 1120, 0);
        context.quadraticCurveTo(560, -140, 0, 0);
        context.closePath();
      };
      shadedShape(fingerPath, "#f3d14e", [560, -150, 560], 80 + index);
      context.strokeStyle = "rgba(170,120,30,0.6)";
      context.lineWidth = 8;
      context.beginPath();
      context.moveTo(60, -20);
      context.quadraticCurveTo(560, -300, 1060, -10);
      context.stroke();
      circle(context, 1110, -4, 34);
      context.fillStyle = "#3b2a1c";
      context.fill();
      context.restore();
    });
    context.beginPath();
    context.roundRect(stalk[0] - 90, stalk[1] - 60, 160, 120, 40);
    context.fillStyle = "#8aa04a";
    context.fill();
    outline(context, 10);

    // A red apple: the stem in its dimple and a leaf.
    const apple = [x - 380, y - 400, 330];
    shadedShape(() => circle(context, apple[0], apple[1], apple[2]), "#c9343a", apple, 71);
    context.strokeStyle = "rgba(110,20,25,0.55)";
    context.lineWidth = 10;
    circle(context, apple[0] + 10, apple[1] + 10, 70);
    context.stroke();
    glint(apple[0] - 150, apple[1] - 140, 42);
    context.strokeStyle = "#4a2e1c";
    context.lineWidth = 22;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(apple[0] + 10, apple[1] + 10);
    context.lineTo(apple[0] + 70, apple[1] - 70);
    context.stroke();
    context.lineCap = "butt";
    context.save();
    context.translate(apple[0] + 80, apple[1] - 80);
    context.rotate(-0.5);
    context.beginPath();
    context.ellipse(110, 0, 120, 52, 0, 0, Math.PI * 2);
    context.fillStyle = "#5f9a3a";
    context.fill();
    outline(context, 10);
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(220, 0);
    context.strokeStyle = "rgba(29,31,51,0.6)";
    context.lineWidth = 6;
    context.stroke();
    context.restore();

    // An orange: pitted peel and the navel at the top.
    const orange = [x + 360, y - 280, 340];
    shadedShape(() => circle(context, orange[0], orange[1], orange[2]), "#ef8f32", orange, 72);
    for (let pore = 0; pore < 70; pore += 1) {
      const angle = hash(pore, 11) * Math.PI * 2;
      const distance = Math.sqrt(hash(pore, 12)) * orange[2] * 0.9;
      context.fillStyle = "rgba(170,80,20,0.45)";
      circle(context, orange[0] + Math.cos(angle) * distance, orange[1] + Math.sin(angle) * distance, 9);
      context.fill();
    }
    glint(orange[0] - 140, orange[1] - 150, 40);
    context.strokeStyle = "rgba(120,60,20,0.8)";
    context.lineWidth = 8;
    for (let ray = 0; ray < 5; ray += 1) {
      const angle = (ray / 5) * Math.PI * 2;
      context.beginPath();
      context.moveTo(orange[0] + 10, orange[1] + 10);
      context.lineTo(orange[0] + 10 + Math.cos(angle) * 34, orange[1] + 10 + Math.sin(angle) * 34);
      context.stroke();
    }

    // A bunch of purple grapes on a stem.
    const grapes = [x + 330, y + 430];
    const berries = [
      [0, -230], [-110, -170], [110, -170], [-160, -50], [0, -60], [160, -50],
      [-110, 60], [110, 60], [-40, 170], [80, 170], [20, 280],
    ];
    context.strokeStyle = "#4a2e1c";
    context.lineWidth = 18;
    context.beginPath();
    context.moveTo(grapes[0], grapes[1] - 230);
    context.quadraticCurveTo(grapes[0] + 40, grapes[1] - 360, grapes[0] + 130, grapes[1] - 400);
    context.stroke();
    berries.forEach(([berryX, berryY], index) => {
      const berry = [grapes[0] + berryX, grapes[1] + berryY, 92];
      shadedShape(() => circle(context, berry[0], berry[1], berry[2]), "#7a3f86", berry, 90 + index);
      glint(berry[0] - 34, berry[1] - 34, 16);
    });

    // A lemon: an oval with a nub at each end.
    context.save();
    context.translate(x - 640, y + 40);
    context.rotate(0.9);
    const lemonPath = () => {
      context.beginPath();
      context.moveTo(-300, 0);
      context.quadraticCurveTo(-270, -20, -240, -60);
      context.bezierCurveTo(-170, -220, 170, -220, 240, -60);
      context.quadraticCurveTo(270, -20, 300, 0);
      context.quadraticCurveTo(270, 20, 240, 60);
      context.bezierCurveTo(170, 220, -170, 220, -240, 60);
      context.quadraticCurveTo(-270, 20, -300, 0);
      context.closePath();
    };
    shadedShape(lemonPath, "#f3dc5a", [0, 0, 260], 74);
    glint(-90, -80, 30);
    context.restore();
  }

  // The striped towel the oranges sit on: the aerial layer's own stripes, carried on past its edges.
  function towel(context) {
    const { left, top, right, bottom } = PLACES.towel;
    context.save();
    context.beginPath();
    context.roundRect(left, top, right - left, bottom - top, 60);
    context.fillStyle = "#ece6d8";
    context.fill();
    context.clip();
    context.translate(540, 540);
    context.rotate(-0.62);
    for (let band = -12; band < 14; band += 1) {
      const offset = band * 330 + 120;
      context.fillStyle = "rgba(240,214,150,0.45)";
      context.fillRect(-6000, offset - 70, 12000, 120);
    }
    context.restore();
    context.beginPath();
    context.roundRect(left, top, right - left, bottom - top, 60);
    outline(context, 10);
  }

  const WHOLE_ORANGE = { x: -430, y: 1430, radius: 300 };
  let texture = null;
  function build() {
    texture = document.createElement("canvas");
    texture.width = Math.round((BOX.right - BOX.left) * TEXTURE_SCALE);
    texture.height = Math.round((BOX.bottom - BOX.top) * TEXTURE_SCALE);
    const layer = texture.getContext("2d");
    layer.scale(TEXTURE_SCALE, TEXTURE_SCALE);
    layer.translate(-BOX.left, -BOX.top);
    counter(layer);
    sink(layer);
    mug(layer);
    wine(layer);
    bowl(layer);
    towel(layer);
    // The whole orange he left, on the towel beside the cut one (drawn centred on the orange's own shading box).
    layer.save();
    layer.translate(WHOLE_ORANGE.x - 540, WHOLE_ORANGE.y - 540);
    Fly.orange(layer, 540, 540, WHOLE_ORANGE.radius);
    layer.restore();
  }

  // Draws the kitchen in world coordinates on a context already transformed to world units.
  function draw(context) {
    if (!texture) {
      build();
    }
    context.drawImage(texture, BOX.left, BOX.top, BOX.right - BOX.left, BOX.bottom - BOX.top);
  }

  function getTexture() {
    if (!texture) {
      build();
    }
    return texture;
  }

  return { draw, towel, getTexture, BOX, TEXTURE_SCALE, PLACES };
})();
