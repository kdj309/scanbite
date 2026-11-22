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

// Bitey whole (as in the app, 120 x 130 grid), for the splash. Android 12+
// shows the splash image inside a circle two-thirds of its width, so he's
// sized to fit inside it.
const BITEY = `
  <path d="M60 22c0-9 5-15 14-16-1 9-6 15-14 16z" fill="#127A4E"/>
  <path d="M60 22c0-7-4-11-10-12 1 7 4 11 10 12z" fill="#3FA66B"/>
  <rect x="14" y="22" width="92" height="88" rx="34" fill="#3A6EC4"/>
  <ellipse cx="60" cy="98" rx="24" ry="9" fill="#5B8BDB"/>
  <path d="M6 38V24a10 10 0 0 1 10-10h12" stroke="#FFD23F" stroke-width="6" stroke-linecap="round" fill="none"/>
  <path d="M114 38V24a10 10 0 0 0-10-10H92" stroke="#FFD23F" stroke-width="6" stroke-linecap="round" fill="none"/>
  <ellipse cx="45" cy="57" rx="10" ry="12" fill="#FFF"/>
  <ellipse cx="75" cy="57" rx="10" ry="12" fill="#FFF"/>
  <circle cx="47" cy="59" r="5.2" fill="${INK}"/>
  <circle cx="77" cy="59" r="5.2" fill="${INK}"/>
  <circle cx="49" cy="56.5" r="1.8" fill="#FFF"/>
  <circle cx="79" cy="56.5" r="1.8" fill="#FFF"/>
  <path d="M50 75Q60 89 70 75Z" fill="${INK}"/>
  <path d="M55 81.5Q60 86.5 65 81.5Q60 79 55 81.5Z" fill="#FF8FA0"/>
  <ellipse cx="42" cy="114" rx="13" ry="7" fill="#2D5BA8"/>
  <ellipse cx="78" cy="114" rx="13" ry="7" fill="#2D5BA8"/>`;
const splash = () => {
  const s = 4; // his 114 x 115 box: diagonal 162 x 4 = 648 < 683 (2/3 of 1024)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><g transform="translate(${512 - 60 * s} ${512 - 63.5 * s}) scale(${s})">${BITEY}</g></svg>`;
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
  // Splash: Bitey whole, on the app's cream background (decided 11-22:
  // the bare face on blue had no outline).
  "splash-icon.png": splash(),
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
