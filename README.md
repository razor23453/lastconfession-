# Birthday bouquet

An animated ASCII bouquet that spins in 3D, with an envelope that opens a letter.

## Run it

Open `index.html` in a browser. To serve it locally instead:

    python3 -m http.server 8000

then visit http://localhost:8000.

## Customise

Edit `config.js`: the caption, the photo label, the letter (title, paragraphs, signature), spin speed and background colour.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Page, canvas and the letter dialog |
| `config.js` | Text and tuning values |
| `hachiware.jpg` | The photo shown in the bottom-left corner |
| `grid.js` | Math helpers and the character grid with its depth buffer |
| `bouquet.js` | Flowers, leaves and pot: layout, 3D projection and shading |
| `figure.js` | Character, caption and envelope |
| `particles.js` | Floating hearts, sparkles, confetti and tap bursts |
| `letter.js` | The letter dialog |
| `main.js` | Canvas setup, animation loop and input |

The letter's handwriting font loads from Google Fonts and falls back to a system cursive font when offline.
