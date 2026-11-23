/**
 * The small character under the bouquet, its caption, and the envelope
 * that opens the letter.
 */

const CHARACTER_ART = [
  ' .-"""""-. ',
  '/ ^     ^ \\',
  '|    w    |',
  '\\   <3    /',
  " '-.___.-' ",
  '  /|   |\\  ',
];
const ENVELOPE_ART = [
  ' ___________ ',
  '|\\         /|',
  '| \\   <3  / |',
  '|  \\_____/  |',
  '|___________|',
];
const ENVELOPE_WIDTH = ENVELOPE_ART[0].length;
const ENVELOPE_HEART_OFFSET = 6;
const ENVELOPE_HINT = 'tap to open';

const MASCOT_SIZE = 0.42; // side length as a fraction of layout.scale
const MASCOT_APPEARS_AT = 1.5; // seconds
const MASCOT_BOB = 0.012; // fraction of layout.scale
const MASCOT_CAPTION_COLOR = '#ffd0e2';

const CHARACTER_COLOR = '#f2f2ff';
const CHARACTER_HEART_COLOR = '#ffb3d1';
const CAPTION_COLOR = '#ffd0e2';
const ENVELOPE_COLORS = ['#ffd0e2', '#ffffff'];
const ENVELOPE_HEART_COLOR = '#ff4f9a';
const HINT_COLORS = ['#ffd0e2', '#7d6f86'];

function drawCharacter(grid, potBottomRow, time) {
  const width = CHARACTER_ART[0].length;
  const column = Math.floor((grid.columns - width) / 2);
  const row = Math.max(potBottomRow + 2, Math.floor(grid.rows * 0.75));
  const isBlinking = time % 4 < 0.15;

  CHARACTER_ART.forEach((line, index) => {
    const text = isBlinking ? line.replace(/\^/g, '-') : line;
    const color = line.includes('<3') ? CHARACTER_HEART_COLOR : CHARACTER_COLOR;
    grid.write(column, row + index, text, color);
  });

  const captionRow = Math.min(grid.rows - 2, row + CHARACTER_ART.length + 2);
  grid.write(Math.floor((grid.columns - CONFIG.caption.length) / 2), captionRow, CONFIG.caption, CAPTION_COLOR);

  return { column, row };
}

/** Draws the envelope and returns its clickable area in pixels. */
function drawEnvelope(grid, character, time) {
  const column = clamp(character.column + 16, 0, grid.columns - ENVELOPE_WIDTH - 1);
  const bob = Math.sin(time * 3) > 0.6 ? -1 : 0;
  const row = character.row + 1 + bob;
  const color = ENVELOPE_COLORS[Math.sin(time * 2.5) > 0 ? 0 : 1];

  ENVELOPE_ART.forEach((line, index) => grid.write(column, row + index, line, color));
  grid.write(column + ENVELOPE_HEART_OFFSET, row + 2, '<3', ENVELOPE_HEART_COLOR);
  grid.write(column + 1, character.row - 1, ENVELOPE_HINT, HINT_COLORS[time % 2 < 1.3 ? 0 : 1]);

  return {
    left: (column - 1) * grid.cellWidth,
    top: (character.row - 2) * grid.cellHeight,
    right: (column + ENVELOPE_WIDTH + 1) * grid.cellWidth,
    bottom: (row + 6) * grid.cellHeight,
  };
}

/** The mascot stands to the left of the character, with its caption underneath. */
function drawMascot(grid, layout, character, mascot, time) {
  const bottom = (character.row + 5) * grid.cellHeight;
  const beside = (character.column - 2) * grid.cellWidth; // keeps clear of the character
  let size = Math.min(MASCOT_SIZE * layout.scale, beside - 8);

  // Also keep clear of the vase, which is wider higher up.
  let widestVase = 0;
  for (let y = bottom - size; y <= bottom; y += grid.cellHeight) {
    widestVase = Math.max(widestVase, vaseHalfWidthAt(layout, y));
  }
  const rightEdge = Math.min(beside, layout.centerX - widestVase - 6);
  size = Math.min(size, rightEdge - 8);
  const bloom = bloomProgress(time, MASCOT_APPEARS_AT, 1.2);
  const bob = Math.sin(time * 2.2) * MASCOT_BOB * layout.scale;
  const centerX = rightEdge - size / 2;

  mascot.draw(grid, layout.scale, { x: centerX, y: bottom - size / 2 + bob, size: size * bloom }, time);

  if (bloom > 0.9) {
    const caption = CONFIG.mascotCaption;
    grid.write(grid.columnAt(centerX) - Math.floor(caption.length / 2), character.row + 5, caption, MASCOT_CAPTION_COLOR);
  }
}

/** Draws the character, mascot, caption and envelope. Returns the envelope's clickable area. */
function drawFigure(grid, layout, time, mascot) {
  const character = drawCharacter(grid, grid.rowAt(layout.potBottomY), time);
  drawMascot(grid, layout, character, mascot, time);
  return drawEnvelope(grid, character, time);
}
