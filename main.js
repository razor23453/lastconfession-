/**
 * Entry point: sets up the canvas, runs the animation loop and handles input.
 */

const canvas = document.getElementById('scene');
const context = canvas.getContext('2d');
const grid = new CellGrid(context);
const bouquet = new Bouquet();
const particles = new ParticleField();
const mascot = new PixelSprite(MASCOT_SPRITE);
const letter = new LetterDialog(
  {
    overlay: document.getElementById('letter'),
    paper: document.getElementById('letter-paper'),
    closeButton: document.getElementById('letter-close'),
    openButton: document.getElementById('letter-open'),
  },
  CONFIG.letter,
);

const RESIZE_DEBOUNCE_MS = 150;
const MAX_FRAME_SECONDS = 0.05; // stops particles jumping after the tab was in the background
const MAX_PIXEL_RATIO = 2;

let layout = null;
let envelopeArea = null;
let startTime = performance.now();
let lastFrameTime = startTime;

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  grid.resize(width, height);
  layout = computeLayout(width, height, grid.cellHeight);
  particles.reset(grid);
}

function frame(now) {
  const time = (now - startTime) / 1000;
  const deltaSeconds = Math.min(MAX_FRAME_SECONDS, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  grid.clear();
  bouquet.draw(grid, layout, time);
  envelopeArea = drawFigure(grid, layout, time, mascot);
  particles.update(deltaSeconds, time);
  particles.draw(grid, time);
  grid.render(CONFIG.backgroundColor);

  requestAnimationFrame(frame);
}

function isOverEnvelope(x, y) {
  return (
    envelopeArea !== null &&
    x >= envelopeArea.left && x <= envelopeArea.right &&
    y >= envelopeArea.top && y <= envelopeArea.bottom
  );
}

canvas.addEventListener('pointerdown', (event) => {
  if (isOverEnvelope(event.clientX, event.clientY)) {
    particles.burst(event.clientX, event.clientY, 20);
    letter.open();
  } else {
    particles.burst(event.clientX, event.clientY, 16);
  }
});

canvas.addEventListener('pointermove', (event) => {
  canvas.style.cursor = isOverEnvelope(event.clientX, event.clientY) ? 'pointer' : 'default';
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, RESIZE_DEBOUNCE_MS);
});

resize();
requestAnimationFrame(frame);
