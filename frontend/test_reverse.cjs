const fs = require('fs');
const file = fs.readFileSync('src/app/core/translation.service.ts', 'utf8');
const transMatch = file.match(/private readonly translations: Record<string, string> = Object\.assign\(\s*\{\},\s*([\s\S]*?)\n\s*\);\n\s*private readonly reverseTranslations/);
const dict = eval('Object.assign({}, ' + transMatch[1] + ')');
const reverse = Object.entries(dict).reduce((r, [en, ar]) => {
  r[ar] ??= en;
  return r;
}, {});

function translationFor(original, lang) {
  const map = lang === 'ar' ? dict : reverse;
  let translated = original;
  let changed = false;
  const entries = Object.entries(map).sort(([left], [right]) => right.length - left.length);
  for (const [source, target] of entries) {
    if (/^[A-Za-z0-9_-]+$/.test(source)) {
      const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordPattern = new RegExp(`\\b${escapedSource}\\b`, 'g');
      if (wordPattern.test(translated)) {
        translated = translated.replace(wordPattern, target);
        changed = true;
      }
    } else if (translated.includes(source)) {
      translated = translated.replaceAll(source, target);
      changed = true;
    }
  }

  if (!changed) {
    return undefined;
  }
  return translated;
}

const originalEn = '\n                Master Ambitious Tech.';
const arabic = translationFor(originalEn, 'ar');
console.log('originalEn -> Arabic:', JSON.stringify(arabic));

const backToEn = translationFor(arabic, 'en');
console.log('arabic -> backToEn:', JSON.stringify(backToEn));
