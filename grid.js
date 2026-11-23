/**
 * Math helpers and the character grid everything is drawn into.
 * Vectors are plain [x, y, z] arrays with x to the right, y down and z towards the viewer.
 */

const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (from, to, amount) => from + (to - from) * amount;
const randomBetween = (min, max) => min + Math.random() * (max - min);
const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function normalize(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((component) => component / length);
}

/** Ease that overshoots slightly before settling at 1. Used for the blooming animation. */
function easeOutBack(progress) {
  const overshoot = 1.70158;
  const shifted = progress - 1;
  return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2;
}

const EMPTY_DEPTH = -9;
const BASELINE_OFFSET = 0.82; // where text sits inside a cell, as a fraction of its height

/**
 * A grid of coloured characters with a depth buffer. Anything drawn with
 * writeAtDepth() only shows if it is closer to the viewer than what is already there.
 */
class CellGrid {
  constructor(context) {
    this.context = context;
    this.width = 0;
    this.height = 0;
    this.columns = 0;
    this.rows = 0;
    this.cellWidth = 0;
    this.cellHeight = 0;
    this.fontSize = 0;
  }

  get font() {
    return `${this.fontSize}px "Courier New", monospace`;
  }

  /** Fits the grid to a pixel area. The canvas must already be sized and scaled. */
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.fontSize = clamp(Math.min(width / 62, height / 50), 8, 18);

    this.context.font = this.font;
    this.cellWidth = this.context.measureText('M').width;
    this.cellHeight = this.fontSize * 1.12;
    this.columns = Math.floor(width / this.cellWidth);
    this.rows = Math.floor(height / this.cellHeight);

    const cellCount = this.columns * this.rows;
    this.chars = new Array(cellCount).fill('');
    this.colors = new Array(cellCount).fill('');
    this.depths = new Float32Array(cellCount);
  }

  clear() {
    this.chars.fill('');
    this.depths.fill(EMPTY_DEPTH);
  }

  columnAt(x) {
    return Math.floor(x / this.cellWidth);
  }

  rowAt(y) {
    return Math.floor(y / this.cellHeight);
  }

  contains(column, row) {
    return column >= 0 && row >= 0 && column < this.columns && row < this.rows;
  }

  isEmpty(column, row) {
    return this.contains(column, row) && !this.chars[row * this.columns + column];
  }

  /** Writes a string left to right, ignoring depth. */
  write(column, row, text, color) {
    for (let offset = 0; offset < text.length; offset++) {
      if (!this.contains(column + offset, row)) continue;
      const index = row * this.columns + column + offset;
      this.chars[index] = text[offset];
      this.colors[index] = color;
    }
  }

  /** Writes one character if it is closer to the viewer than the current contents. */
  writeAtDepth(column, row, char, color, depth) {
    if (!this.contains(column, row)) return;
    const index = row * this.columns + column;
    if (depth <= this.depths[index]) return;
    this.depths[index] = depth;
    this.chars[index] = char;
    this.colors[index] = color;
  }

  render(backgroundColor) {
    const context = this.context;
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, this.width, this.height);
    context.font = this.font;
    context.textBaseline = 'alphabetic';

    for (let row = 0; row < this.rows; row++) {
      for (let column = 0; column < this.columns; column++) {
        const index = row * this.columns + column;
        if (!this.chars[index]) continue;
        context.fillStyle = this.colors[index];
        context.fillText(
          this.chars[index],
          column * this.cellWidth,
          (row + BASELINE_OFFSET) * this.cellHeight,
        );
      }
    }
  }
}
