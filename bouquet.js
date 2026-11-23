/**
 * The bouquet: flowers and leaves arranged on a dome, standing in a vase.
 * The bouquet drops in from the top of the screen, then everything spins around
 * the vertical axis. Surfaces are lit from one side and drawn with a character
 * ramp, so brighter areas get denser characters.
 */

const FLOWER_PALETTES = {
  blue: ['#bfe3ff', '#6fb4ff', '#3a7bd5'],
  white: ['#ffffff', '#e6edfb', '#b9c7e6'],
  pink: ['#ffd0e2', '#ff86bb', '#e8508f'],
  red: ['#ffc2c2', '#ff6377', '#c42a45'],
  violet: ['#e6d6ff', '#a98cff', '#6e50d6'],
};
const PALETTE_ORDER = ['pink', 'blue', 'white', 'red', 'violet', 'pink', 'white', 'blue', 'red'];

const LEAF_COLORS = ['#8ff0a0', '#4fc47a', '#2f9460'];
const STEM_COLOR = LEAF_COLORS[1];
const RIM_COLOR = '#ffe9c8';

const FLOWER_CENTER_COLOR = '#ffc14d';
const FLOWER_RING_COLOR = '#ff9a3c';
const BACK_PETAL_COLOR = '#5a4a78';

// Characters from dim to dense, so brightness maps to how much ink a cell gets.
const BRIGHTNESS_RAMP = '.\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';
const brightnessChar = (brightness) =>
  BRIGHTNESS_RAMP[Math.floor(clamp(brightness, 0, 0.999) * BRIGHTNESS_RAMP.length)];

// Sizes below are fractions of layout.scale.
const DOME_RADIUS = 0.3;
const LEAF_ORBIT_RADIUS = 0.34; // leaves sit slightly further out than the flower heads
const LEAF_LENGTH = 0.12;
const LEAF_WIDTH = 0.07;
const PERSPECTIVE_STRENGTH = 0.25; // how much nearer objects are enlarged
const MIN_FACING = 0.1; // keeps edge-on shapes from blowing up
const DEPTH_SCALE = 0.6; // how much a shape's own tilt counts towards depth

// Flowers sit on rings around the dome: [latitude in degrees, flower count, flower size].
const FLOWER_RINGS = [
  [90, 1, 0.14],
  [62, 5, 0.12],
  [33, 7, 0.115],
  [5, 7, 0.11],
];
const LEAF_COUNT = 8;
const LEAF_LATITUDE = -8;

// The intro: the bouquet falls in from above the screen, then the flowers open.
const DROP_SECONDS = 2.2;
const DROP_DISTANCE = 0.85; // fraction of the screen height
const BLOOM_START = 0.9; // seconds

const LIGHT_DIRECTION = normalize([-0.5, -0.6, 0.65]);

// The vase is a surface of revolution. Each entry is [fraction of the way down, radius as a
// fraction of POT_RADIUS]: rim, neck, belly, shoulder, base.
const VASE_PROFILE = [[0, 0.62], [0.14, 0.5], [0.5, 1], [0.85, 0.72], [1, 0.52]];
const POT_RADIUS = 0.2; // widest part of the vase
const VASE_HEIGHT = 2.6; // rim to base, in units of POT_RADIUS
const VASE_PLEATS = 8;
const VASE_BODY_HUE = 255;
const VASE_RING_HUE = 26;
const VASE_RING_COUNT = 14;
const VASE_RING_EVERY = 7; // every n-th ring is picked out in the accent colour
// Rows kept free below the vase for the character, mascot and captions.
const FIGURE_ROWS = 13;

/** Radius of the vase, relative to its widest part, at a point `progress` (0 to 1) of the way down. */
function vaseRadius(progress) {
  for (let i = 0; i < VASE_PROFILE.length - 1; i++) {
    const [from, fromRadius] = VASE_PROFILE[i];
    const [to, toRadius] = VASE_PROFILE[i + 1];
    if (progress <= to) {
      const t = (progress - from) / (to - from);
      return lerp(fromRadius, toRadius, t * t * (3 - 2 * t));
    }
  }
  return VASE_PROFILE[VASE_PROFILE.length - 1][1];
}

/** Half-width of the vase at a given screen height, or 0 where there is no vase. */
function vaseHalfWidthAt(layout, y) {
  if (y < layout.potRimY || y > layout.potBaseY) return 0;
  return layout.potRadius * vaseRadius((y - layout.potRimY) / (layout.potBaseY - layout.potRimY));
}

/** Where things sit on screen. Recomputed whenever the window is resized. */
function computeLayout(width, height, cellHeight) {
  const tilt = Math.sin(CONFIG.cameraTilt);
  const potRimY = height * 0.46;
  const baseRadiusRatio = VASE_PROFILE[VASE_PROFILE.length - 1][1];

  // On short, wide windows the bouquet shrinks so the figure below it still fits.
  const reach = POT_RADIUS * (VASE_HEIGHT + baseRadiusRatio * tilt);
  const roomBelowRim = height - FIGURE_ROWS * cellHeight - potRimY;
  const scale = Math.max(120, Math.min(width * 0.95, height * 0.66, roomBelowRim / reach));

  const potRadius = POT_RADIUS * scale;
  const potRimRadius = potRadius * VASE_PROFILE[0][1];
  const potBaseRadius = potRadius * baseRadiusRatio;
  const potBaseY = potRimY + potRadius * VASE_HEIGHT;

  return {
    width,
    height,
    scale,
    centerX: width / 2,
    headY: height * 0.33,
    potRadius,
    potRimY,
    potRimRadius,
    potRimDepth: potRimRadius * tilt, // half-height of the rim ellipse
    potBaseY,
    potBaseRadius,
    potBaseDepth: potBaseRadius * tilt,
    potBottomY: potBaseY + potBaseRadius * tilt,
  };
}

/** Unit vector pointing outwards from the dome centre. */
function domeDirection(latitudeDegrees, longitude) {
  const latitude = (latitudeDegrees * Math.PI) / 180;
  return [
    Math.cos(latitude) * Math.cos(longitude),
    -Math.sin(latitude),
    Math.cos(latitude) * Math.sin(longitude),
  ];
}

function createFlowers() {
  const flowers = [];
  FLOWER_RINGS.forEach(([latitude, count, size], ringIndex) => {
    for (let n = 0; n < count; n++) {
      const index = flowers.length;
      flowers.push({
        direction: domeDirection(latitude, (n / count) * TAU + ringIndex * 0.5),
        size,
        palette: FLOWER_PALETTES[PALETTE_ORDER[index % PALETTE_ORDER.length]],
        petals: 5 + (index % 2),
        spinSpeed: index % 2 ? 0.5 : -0.5,
        bloomDelay: BLOOM_START + ringIndex * 0.35 + n * 0.05,
      });
    }
  });
  return flowers;
}

function createLeaves() {
  return Array.from({ length: LEAF_COUNT }, (_, n) => ({
    direction: domeDirection(LEAF_LATITUDE, (n / LEAF_COUNT) * TAU + 0.2),
    bloomDelay: BLOOM_START - 0.1 + n * 0.08,
  }));
}

/** Spins a vector around the vertical axis, then tilts it towards the camera. */
function rotateAndTilt(vector, angle) {
  const [x, y, z] = vector;
  const tilt = CONFIG.cameraTilt;
  const spunX = x * Math.cos(angle) + z * Math.sin(angle);
  const spunZ = -x * Math.sin(angle) + z * Math.cos(angle);
  return [
    spunX,
    y * Math.cos(tilt) + spunZ * Math.sin(tilt),
    -y * Math.sin(tilt) + spunZ * Math.cos(tilt),
  ];
}

/** Screen position of a point on the dome, with a little perspective applied. */
function projectToScreen(layout, direction, radius, angle) {
  const [x, y, z] = rotateAndTilt(direction.map((component) => component * radius), angle);
  const perspective = 1 + PERSPECTIVE_STRENGTH * z;
  return {
    x: layout.centerX + x * layout.scale * perspective,
    y: layout.headY + y * layout.scale * perspective,
    z,
    perspective,
  };
}

function bloomProgress(time, delay, duration) {
  return easeOutBack(clamp((time - delay) / duration, 0, 1));
}

/** How far the bouquet is still above its resting place, in pixels (0 once it has landed). */
function dropOffset(time, height) {
  const progress = clamp(time / DROP_SECONDS, 0, 1);
  return -(1 - easeOutBack(progress, 0.6)) * height * DROP_DISTANCE;
}

/**
 * Draws a flat shape lying on a plane. The plane is described by its centre
 * [x, y, depth] on screen and its normal. For every cell the shape covers,
 * `shade(u, v)` is called with the position in the plane (spun by `spin`) and
 * returns { char, color, fill }, or null to leave the cell empty.
 */
function drawPlanarShape(grid, scale, center, normal, extent, spin, shade) {
  const facing = Math.abs(normal[2]) < MIN_FACING ? Math.sign(normal[2] || 1) * MIN_FACING : normal[2];
  const axisU = normalize(cross(Math.abs(normal[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], normal));
  const axisV = cross(normal, axisU);
  const cosSpin = Math.cos(spin);
  const sinSpin = Math.sin(spin);
  const [centerX, centerY, centerDepth] = center;

  const firstRow = grid.rowAt(centerY - extent);
  const lastRow = (centerY + extent) / grid.cellHeight;
  const firstColumn = grid.columnAt(centerX - extent);
  const lastColumn = (centerX + extent) / grid.cellWidth;

  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      const dx = (column + 0.5) * grid.cellWidth - centerX;
      const dy = (row + 0.5) * grid.cellHeight - centerY;
      const dz = -(normal[0] * dx + normal[1] * dy) / facing; // height of the plane above this cell
      const point = [dx, dy, dz];
      const u = dot(point, axisU);
      const v = dot(point, axisV);

      const cell = shade(u * cosSpin - v * sinSpin, u * sinSpin + v * cosSpin);
      if (cell) {
        const depth = centerDepth + (dz / scale) * DEPTH_SCALE;
        grid.writeAtDepth(column, row, cell.char, cell.color, depth, cell.fill);
      }
    }
  }
}

function drawLeaves(grid, layout, leaves, time, angle) {
  for (const leaf of leaves) {
    const bloom = bloomProgress(time, leaf.bloomDelay, 1.4);
    if (bloom < 0.05) continue;

    const position = projectToScreen(layout, leaf.direction, LEAF_ORBIT_RADIUS, angle);
    const normal = normalize(rotateAndTilt(leaf.direction, angle));
    const length = LEAF_LENGTH * layout.scale * position.perspective * bloom;
    const width = LEAF_WIDTH * layout.scale * position.perspective * bloom;
    const facesAway = normal[2] < 0;
    const lighting = Math.max(0, dot(facesAway ? normal.map((c) => -c) : normal, LIGHT_DIRECTION));

    drawPlanarShape(grid, layout.scale, [position.x, position.y, position.z], normal,
      Math.max(length, width), 0, (u, v) => {
        const edge = (u / width) ** 2 + (v / length) ** 2;
        if (edge > 1) return null;

        const vein = Math.abs(u) < width * 0.12 ? 0.2 : 0;
        const brightness = (facesAway ? 0.15 : 0.3) + 0.45 * lighting + 0.2 * (1 - edge) + vein;
        const color = LEAF_COLORS[brightness > 0.62 ? 0 : brightness > 0.4 ? 1 : 2];
        return { char: brightnessChar(brightness), color, fill: true };
      });
  }
}

/** Where each flower head currently is on screen, and how large. */
function projectFlowers(layout, flowers, time, angle) {
  return flowers.map((flower, index) => {
    const position = projectToScreen(layout, flower.direction, DOME_RADIUS, angle);
    const bloom = bloomProgress(time, flower.bloomDelay, 1.6);
    const breathing = 1 + 0.03 * Math.sin(time * 1.5 + index);
    return {
      flower,
      normal: normalize(rotateAndTilt(flower.direction, angle)),
      x: position.x,
      y: position.y,
      z: position.z,
      radius: flower.size * layout.scale * position.perspective * bloom * breathing,
    };
  });
}

/** Stems run from every second flower down into the neck of the vase. */
function drawStems(grid, layout, heads) {
  const { centerX, potRimY } = layout;

  heads.forEach((head, index) => {
    if (head.radius < 2 || index % 2) return;

    const slope = (centerX - head.x) / (potRimY - head.y);
    const char = Math.abs(slope) < 0.35 ? '|' : slope > 0 ? '\\' : '/';

    for (let progress = 0; progress < 1; progress += 0.012) {
      const x = lerp(head.x, centerX, progress);
      const y = lerp(head.y, potRimY, progress);
      grid.writeAtDepth(grid.columnAt(x), grid.rowAt(y), char, STEM_COLOR, lerp(head.z, 0, progress) - 0.05);
    }
  });
}

function drawFlowers(grid, layout, heads, time) {
  for (const head of heads) {
    if (head.radius < 2) continue;

    const { flower, normal, radius } = head;
    const facesViewer = normal[2] > 0;
    const lighting = Math.max(0, dot(facesViewer ? normal : normal.map((c) => -c), LIGHT_DIRECTION));

    drawPlanarShape(grid, layout.scale, [head.x, head.y, head.z], normal, radius,
      time * flower.spinSpeed, (u, v) => {
        const angle = Math.atan2(v, u);
        const distance = Math.hypot(u, v);
        const petalEdge = radius * (0.62 + 0.38 * Math.abs(Math.cos((flower.petals / 2) * angle)));
        if (distance > petalEdge) return null;

        const t = distance / petalEdge; // 0 at the centre, 1 at the petal tip
        if (!facesViewer) {
          const brightness = 0.15 + 0.35 * lighting + 0.1 * (1 - t);
          return { char: brightnessChar(brightness), color: t > 0.6 ? LEAF_COLORS[2] : BACK_PETAL_COLOR, fill: true };
        }
        if (t < 0.15) return { char: '@', color: FLOWER_CENTER_COLOR, fill: true };
        if (t < 0.3) return { char: 'O', color: FLOWER_RING_COLOR, fill: true };

        const ridge = 0.5 + 0.5 * Math.cos(flower.petals * angle); // brighter along the middle of each petal
        const brightness = 0.25 + 0.6 * lighting + 0.18 * (ridge - 0.5) + 0.15 * (0.5 - t);
        const color = flower.palette[brightness > 0.62 ? 0 : brightness > 0.4 ? 1 : 2];
        return { char: brightnessChar(brightness), color, fill: true };
      });
  }
}

/** Inside the opening of the vase: its rim, or the dark inner wall. */
function drawVaseOpening(grid, column, row, rimDistance, isFrontHalf) {
  if (rimDistance > 0.8) {
    // The front lip is drawn in front of the flowers, the back lip behind them.
    grid.writeAtDepth(column, row, isFrontHalf ? '=' : '-', RIM_COLOR, isFrontHalf ? 0.5 : -0.9);
  } else {
    grid.writeAtDepth(column, row, ':', `hsl(14, 45%, ${14 + 14 * rimDistance}%)`, -1);
  }
}

/** The outside of the vase: lit from one side, with pleats and rings that turn with the bouquet. */
function drawVaseSurface(grid, column, row, offsetX, halfWidth, progress, slope, angle) {
  const around = Math.asin(clamp(offsetX / Math.max(halfWidth, 1), -1, 1));
  const turned = around + angle;
  const normal = normalize([Math.sin(around), -slope, Math.cos(around)]);
  const diffuse = Math.max(0, dot(normal, LIGHT_DIRECTION));
  const pleats = Math.sin(turned * VASE_PLEATS) * 0.12;
  const brightness = clamp(0.15 + 0.75 * diffuse + 0.25 * diffuse ** 8 + pleats, 0, 1);

  const isRing = Math.floor(progress * VASE_RING_COUNT) % VASE_RING_EVERY === 0;
  const hue = isRing ? VASE_RING_HUE : VASE_BODY_HUE;
  const color = `hsl(${hue}, 60%, ${20 + 55 * brightness}%)`;
  grid.writeAtDepth(column, row, brightnessChar(brightness), color, 0.4, true);
}

function drawVase(grid, layout, angle) {
  const { centerX, potRadius, potRimRadius, potRimY, potRimDepth, potBaseY, potBaseDepth } = layout;
  const height = potBaseY - potRimY;
  const firstRow = grid.rowAt(potRimY - potRimDepth);
  const lastRow = (potBaseY + potBaseDepth) / grid.cellHeight;
  const firstColumn = grid.columnAt(centerX - potRadius) - 1;
  const lastColumn = Math.ceil((centerX + potRadius) / grid.cellWidth) + 1;

  for (let row = firstRow; row <= lastRow; row++) {
    const y = (row + 0.5) * grid.cellHeight;
    const progress = clamp((y - potRimY) / height, 0, 1); // 0 at the rim, 1 at the base
    const halfWidth = y >= potRimY ? potRadius * vaseRadius(progress) : 0;
    const slope = (potRadius * (vaseRadius(Math.min(1, progress + 0.01)) - vaseRadius(Math.max(0, progress - 0.01)))) / (0.02 * height);

    for (let column = firstColumn; column <= lastColumn; column++) {
      const offsetX = (column + 0.5) * grid.cellWidth - centerX;
      const rimDistance = (offsetX / potRimRadius) ** 2 + ((y - potRimY) / potRimDepth) ** 2;

      if (rimDistance <= 1) {
        drawVaseOpening(grid, column, row, rimDistance, y > potRimY);
      } else if (y >= potRimY && Math.abs(offsetX) < halfWidth) {
        // The bottom edge curves like the rim does, because we look down on the vase.
        const curve = Math.sqrt(Math.max(0, 1 - (offsetX / halfWidth) ** 2));
        if (y <= potBaseY + potBaseDepth * curve) {
          drawVaseSurface(grid, column, row, offsetX, halfWidth, progress, slope, angle);
        }
      }
    }
  }
}

class Bouquet {
  constructor() {
    this.flowers = createFlowers();
    this.leaves = createLeaves();
  }

  draw(grid, layout, time) {
    const angle = time * CONFIG.rotationSpeed;
    const drop = dropOffset(time, layout.height);
    const falling = {
      ...layout,
      headY: layout.headY + drop,
      potRimY: layout.potRimY + drop,
      potBaseY: layout.potBaseY + drop,
    };
    const heads = projectFlowers(falling, this.flowers, time, angle);

    drawLeaves(grid, falling, this.leaves, time, angle);
    drawStems(grid, falling, heads);
    drawFlowers(grid, falling, heads, time);
    drawVase(grid, falling, angle);
  }
}
