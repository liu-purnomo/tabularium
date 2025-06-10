import { slugify } from './slugify.js';

export function generateSafeColumns(headers) {
  const seen = new Map();
  const result = [];
  let emptyCounter = 1;

  for (let i = 0; i < headers.length; i++) {
    let raw = headers[i]?.toString().trim() || '';
    let baseName = slugify(raw);

    if (!baseName) {
      baseName = `a${emptyCounter}`;
      emptyCounter++;
    }

    let name = baseName;
    if (seen.has(baseName)) {
      const count = seen.get(baseName) + 1;
      name = `${baseName}_${String.fromCharCode(96 + count)}`;
      seen.set(baseName, count);
    } else {
      seen.set(baseName, 1);
    }

    result.push(name);
  }

  return result;
}
