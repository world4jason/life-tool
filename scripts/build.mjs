import { readFile, mkdir, writeFile } from 'node:fs/promises';
const html = await readFile('index.html', 'utf8');
const css = await readFile('src/styles.css', 'utf8');
const domain = (await readFile('src/domain.mjs', 'utf8')).replace(/^export /gm, '');
const app = (await readFile('src/app.mjs', 'utf8')).replace(/^import \{[\s\S]*?\} from '\.\/domain\.mjs';\n/, '');
// The distributable has no imports/CDN/fonts/analytics and also opens as a local file.
const safe = text => text.replace(/<\/script/gi, '<\\/script');
const output = html.replace('<link rel="stylesheet" href="./src/styles.css">', () => `<style>${css}</style>`)
  .replace('<script type="module" src="./src/app.mjs"></script>', () => `<script type="module">\n${safe(domain)}\n${safe(app)}\n</script>`);
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', output);
await writeFile('dist/.nojekyll', '');
console.log(`Built dist/index.html (${Buffer.byteLength(output).toLocaleString()} bytes), zero runtime dependencies.`);
