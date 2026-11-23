/**
 * The bouquet: flowers and leaves arranged on a dome, sitting in a cone-shaped pot.
 * Everything rotates around the vertical axis and is drawn into a CellGrid.
 */

const FLOWER_PALETTES = {
  blue: ['#bfe3ff', '#6fb4ff', '#3a7bd5'],
  white: ['#ffffff', '#e6edfb', '#b9c7e6'],
  pink: ['#ffd0e2', '#ff86bb', '#e8508f'],
};
const PALETTE_ORDER = ['white', 'blue', 'pink', 'blue', 'white', 'pink', 'blue'];

const LEAF_COLORS = ['#8ff0a0', '#4fc47a', '#2f9460'];
const STEM_COLOR = LEAF_COLORS[1];
const RIBBON_COLOR = '#ff4f9a';
const RIM_COLOR = '#ffe9c8';

const FLOWER_CENTER_COLOR = '#ffc14d';
const FLOWER_RING_COLOR = '#ff9a3c';
const FRONT_PETAL_CHARS = '#%*+=-.';
const BACK_PETAL_CHARS = '#%+=-';
const BACK_PETAL_TIP_COLOR = '#7a5a8a';

// Sizes below are fractions of layout.scale.
const DOME_RADIUS = 0.3;
const LEAF_ORBIT_RADIUS = 0.3808; // leaves hang slightly further out than the flower heads
const LEAF_LENGTH = 0.17;
const LEAF_WIDTH = 0.06;
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
const LEAF_LATITUDE = -22;

const LIGHT_DIRECTION = normalize([-0.5, -0.6, 0.65]);
const POT_SLOPE = 0.34; // how much the pot's sides tilt downwards
const POT_SHADE_CHARS = '.:-=+*#%@';
const POT_PLEATS = 8;
const POT_STRIPES_PER_HALF_TURN = 6;

/** Where things sit on screen. Recomputed whenever the window is resized. */
function computeLayout(width, height) {
  const scale = Math.min(width * 0.95, height * 0.66);
  const potRadius = 0.3 * scale;
  const potRimY = height * 0.49;
  const potRimDepth = potRadius * Math.sin(CONFIG.cameraTilt); // half-height of the rim ellipse

  return {
    width,
    height,
    scale,
    centerX: width / 2,
    headY: height * 0.33,
    potRadius,
    potRimY,
    potRimDepth,
    potTipY: Math.max(height * 0.7, potRimY + potRimDepth + potRadius * 1.1),
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
        bloomDelay: 0.2 + ringIndex * 0.35 + n * 0.05,
      });
    }
  });
  return flowers;
}

function createLeaves() {
  return Array.from({ length: LEAF_COUNT }, (_, n) => ({
    direction: domeDirection(LEAF_LATITUDE, (n / LEAF_COUNT) * TAU + 0.2),
    bloomDelay: 0.1 + n * 0.08,
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

/**
 * Draws a flat shape lying on a plane. The plane is described by its centre
 * [x, y, depth] on screen and its normal. For every cell the shape covers,
 * `shade(u, v)` is called with the position in the plane (spun by `spin`) and
 * returns { char, color }, or null to leave the cell empty.
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
        grid.writeAtDepth(column, row, cell.char, cell.color, depth);
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

    drawPlanarShape(grid, layout.scale, [position.x, position.y, position.z], normal,
      Math.max(length, width), 0, (u, v) => {
        const edge = (u / width) ** 2 + (v / length) ** 2;
        if (edge > 1) return null;

        const char = Math.abs(u) < width * 0.1 ? '|' : edge < 0.35 ? '=' : edge < 0.75 ? '-' : ':';
        const color = LEAF_COLORS[facesAway ? 2 : edge < 0.5 ? 0 : 1];
        return { char, color };
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

/** Stems run from every second flower down into the pot. */
function drawStems(grid, layout, heads) {
  const { centerX, potRimY, potTipY } = layout;

  heads.forEach((head, index) => {
    if (head.radius < 2 || index % 2) return;

    const slope = (centerX - head.x) / (potTipY - head.y);
    const char = Math.abs(slope) < 0.35 ? '|' : slope > 0 ? '\\' : '/';
    const reachesRim = Math.min(1, (potRimY - head.y) / (potTipY - head.y));

    for (let progress = 0; progress < reachesRim; progress += 0.012) {
      const x = lerp(head.x, centerX, progress);
      const y = lerp(head.y, potTipY, progress);
      grid.writeAtDepth(grid.columnAt(x), grid.rowAt(y), char, STEM_COLOR, lerp(head.z, 0, progress) - 0.05);
    }
  });
}

function drawFlowers(grid, layout, heads, time) {
  for (const head of heads) {
    if (head.radius < 2) continue;

    const { flower, normal, radius } = head;
    const facesViewer = normal[2] > 0;
    const isObliqueView = Math.abs(normal[2]) < 0.3;

    drawPlanarShape(grid, layout.scale, [head.x, head.y, head.z], normal, radius,
      time * flower.spinSpeed, (u, v) => {
        const distance = Math.hypot(u, v);
        const petalEdge = radius * (0.62 + 0.38 * Math.abs(Math.cos((flower.petals / 2) * Math.atan2(v, u))));
        if (distance > petalEdge) return null;

        const t = distance / petalEdge; // 0 at the centre, 1 at the petal tip
        if (!facesViewer) {
          return {
            char: BACK_PETAL_CHARS[Math.min(4, Math.floor(t * 5))],
            color: t > 0.6 ? LEAF_COLORS[2] : BACK_PETAL_TIP_COLOR,
          };
        }
        if (t < 0.15) return { char: '@', color: FLOWER_CENTER_COLOR };
        if (t < 0.3) return { char: 'O', color: FLOWER_RING_COLOR };

        const shade = (t < 0.55 ? 0 : t < 0.8 ? 1 : 2) + (isObliqueView ? 1 : 0);
        return {
          char: FRONT_PETAL_CHARS[Math.min(6, Math.floor((t - 0.3) / 0.1))],
          color: flower.palette[Math.min(2, shade)],
        };
      });
  }
}

/** Inside the opening of the pot: its rim, or the dark inner wall. */
function drawPotOpening(grid, column, row, rimDistance, isFrontHalf) {
  if (rimDistance > 0.8) {
    // The front lip is drawn in front of the flowers, the back lip behind them.
    grid.writeAtDepth(column, row, isFrontHalf ? '=' : '-', RIM_COLOR, isFrontHalf ? 0.5 : -0.9);
  } else {
    grid.writeAtDepth(column, row, ':', `hsl(14, 45%, ${14 + 14 * rimDistance}%)`, -1);
  }
}

/** The outside of the pot: lit from one side, with pleats and stripes that turn with the bouquet. */
function drawPotSurface(grid, column, row, offsetX, halfWidth, taper, angle) {
  const around = Math.asin(clamp(offsetX / Math.max(halfWidth, 1), -1, 1));
  const turned = around + angle;
  const normal = normalize([Math.sin(around) * 0.94, POT_SLOPE, Math.cos(around) * 0.94]);
  const diffuse = Math.max(0, dot(normal, LIGHT_DIRECTION));
  const pleats = Math.sin(turned * POT_PLEATS) * 0.16;
  const brightness = clamp(0.12 + 0.78 * diffuse + 0.25 * diffuse ** 8 + pleats - 0.12 * taper, 0, 1);

  const stripe = Math.floor((turned / Math.PI) * POT_STRIPES_PER_HALF_TURN) & 1;
  const hue = stripe ? 345 : 22;
  const char = POT_SHADE_CHARS[Math.floor(brightness * 8.99)];
  grid.writeAtDepth(column, row, char, `hsl(${hue}, 90%, ${22 + 58 * brightness}%)`, 0.4);
}

function drawPot(grid, layout, angle) {
  const { centerX, potRadius, potRimY, potRimDepth, potTipY } = layout;
  const firstRow = grid.rowAt(potRimY - potRimDepth);
  const lastRow = potTipY / grid.cellHeight;
  const firstColumn = grid.columnAt(centerX - potRadius) - 1;
  const lastColumn = Math.ceil((centerX + potRadius) / grid.cellWidth) + 1;

  for (let row = firstRow; row <= lastRow; row++) {
    const y = (row + 0.5) * grid.cellHeight;
    const taper = clamp((y - potRimY) / (potTipY - potRimY), 0, 1); // 0 at the rim, 1 at the tip
    const halfWidth = y >= potRimY ? potRadius * (1 - taper) : 0;

    for (let column = firstColumn; column <= lastColumn; column++) {
      const offsetX = (column + 0.5) * grid.cellWidth - centerX;
      const rimDistance = (offsetX / potRadius) ** 2 + ((y - potRimY) / potRimDepth) ** 2;

      if (rimDistance <= 1) {
        drawPotOpening(grid, column, row, rimDistance, y > potRimY);
      } else if (y >= potRimY && Math.abs(offsetX) < halfWidth) {
        drawPotSurface(grid, column, row, offsetX, halfWidth, taper, angle);
      }
    }
  }
}

function drawRibbon(grid, layout) {
  const row = grid.rowAt(layout.potTipY);
  const column = grid.columnAt(layout.centerX);
  grid.write(column - 2, row, '<(@)>', RIBBON_COLOR);
  grid.write(column - 1, row + 1, '/ \\', RIBBON_COLOR);
}

class Bouquet {
  constructor() {
    this.flowers = createFlowers();
    this.leaves = createLeaves();
  }

  draw(grid, layout, time) {
    const angle = time * CONFIG.rotationSpeed;
    const heads = projectFlowers(layout, this.flowers, time, angle);

    drawLeaves(grid, layout, this.leaves, time, angle);
    drawStems(grid, layout, heads);
    drawFlowers(grid, layout, heads, time);
    drawPot(grid, layout, angle);
    drawRibbon(grid, layout);
  }
}
