/**
 * The dialog that shows the letter. The text comes from CONFIG.letter and is
 * inserted as plain text, so it is safe to put any characters in it.
 */

// Must match the opacity transition on .letter-overlay in styles.css.
const CLOSE_DELAY_MS = 250;

class LetterDialog {
  constructor({ overlay, paper, closeButton, openButton }, content) {
    this.overlay = overlay;
    this.paper = paper;
    this.closeButton = closeButton;
    this.openButton = openButton;
    this.content = content;
    this.isBuilt = false;
    this.hideTimer = null;

    openButton.addEventListener('click', () => this.open());
    closeButton.addEventListener('click', () => this.close());
    overlay.addEventListener('pointerdown', (event) => {
      if (event.target === overlay) this.close();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen() {
    return !this.overlay.hidden;
  }

  buildContent() {
    const title = document.createElement('h2');
    title.id = 'letter-title';
    title.textContent = this.content.title;
    this.paper.append(title);

    for (const text of this.content.body) {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      this.paper.append(paragraph);
    }

    const signature = document.createElement('p');
    signature.className = 'letter-signature';
    signature.textContent = this.content.signature;
    this.paper.append(signature);

    this.isBuilt = true;
  }

  open() {
    if (!this.isBuilt) this.buildContent();

    clearTimeout(this.hideTimer);
    this.paper.scrollTop = 0;
    this.overlay.hidden = false;
    // Wait a frame so the transition runs from the hidden state.
    requestAnimationFrame(() => this.overlay.classList.add('is-open'));
    this.closeButton.focus();
  }

  close() {
    this.overlay.classList.remove('is-open');
    this.hideTimer = setTimeout(() => {
      this.overlay.hidden = true;
    }, CLOSE_DELAY_MS);
    this.openButton.focus({ preventScroll: true });
  }
}
