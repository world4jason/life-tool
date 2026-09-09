import { readFile, mkdir, writeFile } from 'node:fs/promises';
let html = (await readFile('index.html', 'utf8')).replace(/<script type="importmap">[\s\S]*?<\/script>/g, '');
for (const match of [...html.matchAll(/<link rel="stylesheet" href="(\.\/src\/[^"?]+)(?:\?[^\"]*)?">/g)]) {
  const css = await readFile(match[1], 'utf8');
  html = html.replace(match[0], () => `<style>${css}</style>`);
}
// Each source module retains its own scope. Export destructuring replaces only
// static local imports; the offline build makes no network requests.
const modules = ['domain', 'complete-example', 'example-view', 'month-order', 'guide', 'discovery-model', 'canvas-model', 'canvas', 'discovery', 'app'];
let bundle = '';
for (const name of modules) {
  const code = await readFile(`src/${name}.mjs`, 'utf8');
  const exports = [...code.matchAll(/^export (?:function|const|class) (\w+)/gm)].map(m => m[1]);
  const transformed = code.replace(/^import\s+\{([\s\S]*?)\}\s+from\s+'\.\/([^'?]+)\.mjs(?:\?[^']*)?';\n/gm,
    (_, imported, dependency) => `const {${imported}} = __modules[${JSON.stringify(dependency)}];\n`).replace(/^export /gm, '');
  bundle += `__modules[${JSON.stringify(name)}] = (() => {\n${transformed}\nreturn {${exports.join(',')}};\n})();\n`;
}
const safe = value => value.replace(/<\/script/gi, '<\\/script');
html = html.replace(/<script type="module" src="\.\/src\/app\.mjs[^\"]*"><\/script>/,
  () => `<script type="module">\nconst __modules = {};\n${safe(bundle)}\n</script>`);
if (/<(?:script[^>]+src|link[^>]+stylesheet)/.test(html)) throw new Error('Unbundled runtime resource');
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html);
await writeFile('dist/.nojekyll', '');
console.log(`Built dist/index.html (${Buffer.byteLength(html).toLocaleString()} bytes), no external runtime resources.`);
