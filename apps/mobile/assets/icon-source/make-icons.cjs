// Renders ScanBite's icon set (option B, Bitey's face) to PNGs.
// Usage (needs @resvg/resvg-js, e.g. in a scratch folder):
//   node make-icons.cjs ../images
const fs = require("node:fs");
const path = require("node:path");
const { Resvg } = require("@resvg/resvg-js");

const out = process.argv[2];
const BLUE = "#3A6EC4";
const INK = "#1A1523";

// The face, drawn on a 132 x 132 grid, centred on x = 66.
const leaf = (fill) =>
  `<path d="M66 32c0-10 6-17 16-18-1 10-7 17-16 18z" fill="${fill}"/>`;
const eyes = `
  <ellipse cx="48" cy="68" rx="13" ry="15" fill="#FFF"/>
  <ellipse cx="84" cy="68" rx="13" ry="15" fill="#FFF"/>
  <circle cx="51" cy="71" r="6.5" fill="${INK}"/>
  <circle cx="87" cy="71" r="6.5" fill="${INK}"/>
  <circle cx="53.5" cy="67.5" r="2.2" fill="#FFF"/>
  <circle cx="89.5" cy="67.5" r="2.2" fill="#FFF"/>`;
const mouth = `
  <path d="M52 94Q66 112 80 94Z" fill="${INK}"/>
  <path d="M58 101Q66 107 74 101Q66 98 58 101Z" fill="#FF8FA0"/>`;
const corners = `
  <path d="M18 42V30a10 10 0 0 1 10-10h12" stroke="#FFD23F" stroke-width="8" stroke-linecap="round" fill="none"/>
  <path d="M114 42V30a10 10 0 0 0-10-10H92" stroke="#FFD23F" stroke-width="8" stroke-linecap="round" fill="none"/>`;
const face = `${leaf("#3FA66B")}${eyes}${mouth}`;

// One-colour silhouette: eyes and mouth solid, pupils cut out.
const silhouette = (fill) => `
  <path fill="${fill}" fill-rule="evenodd" d="
    M35 68a13 15 0 1 0 26 0a13 15 0 1 0 -26 0z M44.5 71a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0z
    M71 68a13 15 0 1 0 26 0a13 15 0 1 0 -26 0z M80.5 71a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0z"/>
  <path d="M52 94Q66 112 80 94Z" fill="${fill}"/>
  ${leaf(fill)}`;

const svg = (body, { size, bg, scale = 1, viewBox = "0 0 132 132" }) => {
  // Scale the 132 grid about its centre so art can sit inside a safe zone.
  const offset = 66 - 66 * scale;
  const inner = `<g transform="translate(${offset} ${offset}) scale(${scale})">${body}</g>`;
  const fill = bg ? `<rect width="132" height="132" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">${fill}${inner}</svg>`;
};

const files = {
  // iOS: full bleed, no transparency; iOS rounds the corners itself.
  "icon.png": svg(`${corners}${face}`, { size: 1024, bg: BLUE }),
  // Android adaptive layers: the mask can crop to a circle, so only the
  // face (no corners), kept inside the central safe zone.
  "android-icon-foreground.png": svg(face, { size: 1024, scale: 0.84 }),
  "android-icon-background.png": svg("", { size: 1024, bg: BLUE }),
  "android-icon-monochrome.png": svg(silhouette("#FFF"), {
    size: 1024,
    scale: 0.84,
  }),
  // Splash: the face on the brand-blue splash background.
  "splash-icon.png": svg(face, { size: 1024 }),
  // Status bar and notification shade: white silhouette, 96 px (24 dp @4x).
  "notification-icon.png": svg(silhouette("#FFF"), {
    size: 96,
    // Cropped to the face (x 35-97, y 14-103) so it fills the 24 dp slot.
    viewBox: "19 11 94 94",
  }),
};

for (const [name, source] of Object.entries(files)) {
  const png = new Resvg(source).render().asPng();
  fs.writeFileSync(path.join(out, name), png);
  console.log(name, png.length, "bytes");
}
