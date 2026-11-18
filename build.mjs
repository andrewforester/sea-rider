// Bundles both renderers into one self-contained page: game.html
//   surface    = src/surface (ES modules, bundled with esbuild)
//   underwater = src/underwater (plain scripts sharing one scope, concatenated into one async function)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.dirname(fileURLToPath(import.meta.url));
const minify = process.argv.includes('--min');
const surface = (await esbuild.build({
  entryPoints: [path.join(root, 'src/surface/main.js')], bundle: true, write: false, format: 'esm', target: 'es2022', minify,
})).outputFiles[0].text;

const UW_FILES = ['quality.js', 'math.js', 'shaders.js', 'world.js', 'main.js', 'audio.js'];
let uw = '';
if (!process.argv.includes('--no-uw') && fs.existsSync(path.join(root, 'src/underwater/.integrated'))) {
  uw = UW_FILES.map((f) => fs.readFileSync(path.join(root, 'src/underwater', f), 'utf8')).join('\n');
  uw = `(async()=>{${uw}\n})().catch(e=>{console.error(e);const s=document.getElementById('s');if(s)s.textContent=window.tr('Подводный мир не запустился: ')+e.message;});`;
}
const i18n = fs.readFileSync(path.join(root, 'src/i18n.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'template.html'), 'utf8')
  .replace('<!--I18N-->', () => `<script>\n${i18n}\n</script>`)
  .replace('<!--SURFACE-->', () => `<script type="module">\n${surface}\n</script>`)
  .replace('<!--UNDERWATER-->', () => (uw ? `<script>\n${uw}\n</script>` : ''));
fs.writeFileSync(path.join(root, 'game.html'), page);
console.log('wrote game.html', (page.length / 1024).toFixed(0) + ' KB', uw ? '(with underwater)' : '(surface only)');
