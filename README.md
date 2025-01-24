# Citrohaul

Silly game about transporting your lemons. Inspired by Nitrohaul.

## Installation

Download the repository and open `index.html` with a browser.

Depends on [Matter.js](https://github.com/liabru/matter-js). Download
[matter.js build](https://github.com/liabru/matter-js/tree/master/build) and
place it in the `citrohaul/lib` directory. If matter.js is not found, it will
be loaded dynamically from the CDN.

## Controls

Draw objects with the mouse. Change object type by pressing:
- `1`: Wheel, will spin with `ArrowUp` and `ArrowDown`
- `2`: Circle
- `3`: Plank
- `4`: Box
- `5`: Joint between bodies or fixed points
- `6`: Spring, a wobblier joint
- `7`: Lemon, handle with care

Hold `Shift` while drawing an object to make it immovable.

- `ArrowUp` and `ArrowDown` to spin all wheels
- `Space` to start/pause the simulation
- Scroll to zoom

## License

The code is released under Mozilla Public License 2.0.
(c) [Peeze](https://www.github.com/Peeze) 2025

Visual artwork and sounds (c) [@fitz.comic](https://www.instagram.com/fitz.comic) 2025
