import { readFile, mkdir, writeFile } from 'node:fs/promises';
const html = await readFile('index.html', 'utf8');
const css = await readFile('src/styles.css', 'utf8');
const eventCSS = await readFile('src/event-editor.css', 'utf8');
const energyCSS = await readFile('src/energy-board.css', 'utf8');
const ordering = (await readFile('src/month-order.mjs', 'utf8')).replace(/^export /gm, '');
const guideCSS = await readFile('src/guide.css', 'utf8');
const guide = (await readFile('src/guide.mjs', 'utf8')).replace(/^import .*?;\n/gm, '').replace(/^export /gm, '');
const domain = (await readFile('src/domain.mjs', 'utf8')).replace(/^export /gm, '');
const app = (await readFile('src/app.mjs', 'utf8')).replace(/^import \{[\s\S]*?\} from '\.\/domain\.mjs';\n/, '').replace(/^import .*?;\n/gm, '');
// The distributable has no imports/CDN/fonts/analytics and also opens as a local file.
const safe = text => text.replace(/<\/script/gi, '<\\/script');
const output = html.replace('<link rel="stylesheet" href="./src/styles.css">', () => `<style>${css}</style>`)
  .replace('<link rel="stylesheet" href="./src/event-editor.css?v=rating-1">', () => `<style>${eventCSS}</style>`)
  .replace('<link rel="stylesheet" href="./src/guide.css?v=guide-1">', () => `<style>${guideCSS}</style>`)
  .replace('<link rel="stylesheet" href="./src/energy-board.css?v=energy-2">', () => `<style>${energyCSS}</style>`)
  .replace('<script type="module" src="./src/app.mjs?v=energy-2"></script>', () => `<script type="module">\n${safe(domain)}\n${safe(ordering)}\n${safe(guide)}\n${safe(app)}\n</script>`);
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', output);
await writeFile('dist/.nojekyll', '');
console.log(`Built dist/index.html (${Buffer.byteLength(output).toLocaleString()} bytes), zero runtime dependencies.`);
