// Construit un seul fichier HTML autonome (dist/index.html) : CSS et JS inclus en ligne.
import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'fs';

const watch = process.argv.includes('--watch');
const opts = {
  entryPoints: ['src/main.tsx'], bundle: true, minify: !watch, format: 'iife', target: 'es2019',
  outdir: 'dist/assets', write: false, jsx: 'automatic', loader: { '.css': 'css', '.woff2': 'dataurl' },
  // GOATCOUNTER_CODE : code du site GoatCounter (ex. « poptocrack »). Vide = aucune statistique envoyée.
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"', 'process.env.GOATCOUNTER': JSON.stringify(process.env.GOATCOUNTER_CODE || '') }, legalComments: 'none',
};
function emit(result) {
  const js = result.outputFiles.find(f => f.path.endsWith('.js')).text;
  const css = result.outputFiles.find(f => f.path.endsWith('.css'))?.text || '';
  const html = readFileSync('index.html', 'utf8')
    .replace('<!--STYLE-->', () => `<style>${css}</style>`)
    .replace('<!--SCRIPT-->', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', html);
  // Fichiers servis tels quels à côté du jeu (ex. vérification incrementaldb).
  if (existsSync('public')) cpSync('public', 'dist', { recursive: true });
  console.log(`dist/index.html (${(html.length / 1024).toFixed(0)} ko)`);
}
if (watch) {
  const ctx = await context({ ...opts, plugins: [{ name: 'emit', setup(b) { b.onEnd(r => { if (!r.errors.length) emit(r); }); } }] });
  await ctx.watch(); console.log('Surveillance des fichiers… ouvre dist/index.html');
} else emit(await build(opts));
