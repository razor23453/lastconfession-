/**
 * Draws a small pixel sprite as coloured characters, the same way the flowers
 * are drawn: it lies on a plane that gently swings in 3D.
 */

const SPRITE_SYMBOLS = '0123456789abcdefghijklmnopqrstuvwxyz';
const SPRITE_TRANSPARENT = '.';
const SPRITE_CHARS = '.:-=+*#%@'; // from dim to bright
const DARK_CUTOFF = 0.3; // pixels darker than this are left empty, so eyes and outlines show as gaps
const DARK_COLOR_LIFT = 0.2; // slightly brightens the darker remaining colours
const SPRITE_DEPTH = 0.6; // in front of the pot
const SPRITE_MAX_YAW = 0.5; // radians either side of facing the viewer
const SPRITE_SWING_SPEED = 0.9;

const toRgb = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

/** The character and screen colour used for one sprite pixel, or null for a dark pixel. */
function spriteCell(hex) {
  const [red, green, blue] = toRgb(hex);
  const brightness = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  if (brightness < DARK_CUTOFF) return null;
  const lift = (1 - brightness) * DARK_COLOR_LIFT;
  const [r, g, b] = [red, green, blue].map((channel) => Math.round(channel + (255 - channel) * lift));
  return {
    char: SPRITE_CHARS[Math.min(SPRITE_CHARS.length - 1, Math.floor(brightness * SPRITE_CHARS.length))],
    color: `rgb(${r}, ${g}, ${b})`,
  };
}

class PixelSprite {
  /** `data` is { palette: ['#rrggbb', ...], rows: ['..0a1..', ...] } with square dimensions. */
  constructor(data) {
    const cells = data.palette.map(spriteCell);
    this.size = data.rows.length;
    this.rows = data.rows.map((row) =>
      [...row].map((symbol) => (symbol === SPRITE_TRANSPARENT ? null : cells[SPRITE_SYMBOLS.indexOf(symbol)])),
    );
  }

  /** `placement` is { x, y, size }: the sprite's centre and its side length in pixels. */
  draw(grid, scale, placement, time) {
    const yaw = Math.sin(time * SPRITE_SWING_SPEED) * SPRITE_MAX_YAW;
    const normal = [Math.sin(yaw), 0, Math.cos(yaw)];
    const extent = (placement.size / 2) * 1.05;

    drawPlanarShape(grid, scale, [placement.x, placement.y, SPRITE_DEPTH], normal, extent, 0, (u, v) => {
      const column = Math.floor((u / placement.size + 0.5) * this.size);
      const row = Math.floor((v / placement.size + 0.5) * this.size);
      return this.rows[row]?.[column] ?? null;
    });
  }
}
