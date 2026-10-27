import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// A shareable, self-contained build for classroom machines without a dev server.
const directory = resolve('dist');
let html = await readFile(resolve(directory, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
for (const [tag, path] of scripts) {
  const code = await readFile(resolve(directory, path.replace(/^\//, '')), 'utf8');
  html = html.replace(tag, () => `<script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script>`);
}
const styles = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)];
for (const [tag] of styles) {
  const path = tag.match(/href="([^"]+)"/)?.[1];
  if (!path) throw new Error('Missing CSS build path');
  const css = await readFile(resolve(directory, path.replace(/^\//, '')), 'utf8');
  html = html.replace(tag, () => `<style>${css}</style>`);
}
await writeFile(resolve(directory, 'play.html'), html);
await mkdir(resolve('release'), { recursive: true });
await writeFile(resolve('release/play.html'), html);
console.log('Created dist/play.html and release/play.html — self-contained game.');
