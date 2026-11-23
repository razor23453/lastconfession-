/**
 * Everything you are likely to want to change lives in this file.
 */
const CONFIG = {
  // Small line of text shown under the little character.
  caption: 'a little something for u <3',

  // Small label under the mascot next to the character.
  mascotCaption: 'say cheese!',

  // Shown when the envelope is opened. Each entry in `body` becomes a paragraph.
  // Long letters are fine: the paper scrolls.
  letter: {
    title: 'Happy birthday, you!',
    body: [
      'I wanted to give you flowers that never wilt, so I made you some out of code.',
      'I hope today is full of cake, good people, and all the things you love. You deserve every bit of it.',
      'Thank you for being you. I’m really glad you exist.',
    ],
    signature: 'With love,\n[your name]',
  },

  rotationSpeed: 0.5, // radians per second
  cameraTilt: 0.6, // radians; how far the camera looks down onto the bouquet
  backgroundColor: '#05060d',
};
