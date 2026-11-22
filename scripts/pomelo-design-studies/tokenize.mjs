// Pull exact authored values into the checked Pomelo token registry, preserving
// selector scope, CSS priority and existing semantic var() references.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const checker = readFileSync(new URL('../check_ssot.py', import.meta.url), 'utf8');
const colorNames = checker.match(/NAMED_COLORS = """([\s\S]+?)"""\.split\(\)/)[1].trim().split(/\s+/);
const colorLiteral = '#[0-9a-f]{3,8}\\b|(?<![\\w-])(?:' + colorNames.join('|') + ')(?![\\w-])';
const colorFunction = '\\b(?:rgba?|hsla?|lab|lch|oklab|oklch|color)\\s*\\(';
const colors = new RegExp(colorLiteral + '|' + colorFunction, 'i');
const mixedParts = new RegExp('var\\(--[a-z0-9-]+\\)|' +
  colorFunction + '[^()]*\\)|' + colorLiteral +
  '|(?<![\\w.-])[+-]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][+-]?\\d+)?(?:[a-zA-Z]+|%)?(?![\\w-])', 'gi');
const declarations = /(\/\*[\s\S]*?\*\/)|((?<![\w-])([\w-]+)\s*:\s*)([^;{}]+)(?=[;}])/g;
const dimensions = new Set(['border-radius', 'box-shadow', 'text-shadow', 'font-size', 'font', 'z-index']);
const vars = /var\(--[a-z0-9-]+\)/gi;

export function tokenizeStyles(input) {
  const values = new Map();
  function reference(value) {
    const key = 'pomelo-study-v-' + createHash('sha256').update(value).digest('hex').slice(0, 16);
    if (values.has(key) && values.get(key) !== value) throw new Error('Pomelo token identity collision');
    values.set(key, value);
    return 'var(--' + key + ')';
  }

  function tokenize(raw) {
    return String(raw).replace(declarations, (whole, comment, prefix, property, expression) => {
      if (comment) return whole;
      const [value, important = ''] = expression.trim().split(/(\s*!important)\s*$/i);
      const withoutVariables = value.replace(vars, '');
      const rawColor = colors.test(value.replace(/--[a-zA-Z0-9-]+/g, ''));
      const rawDimension = (dimensions.has(property) || property.startsWith('--')) && /\d/.test(withoutVariables);
      if (!rawColor && !rawDimension) return whole;
      const replacement = !value.includes('var(') ? reference(value) :
        value.replace(mixedParts, part => {
          if (/^var\(/i.test(part)) return part;
          return colors.test(part) || (rawDimension && /\d/.test(part)) ? reference(part) : part;
        });
      return prefix + replacement + important + (expression.match(/\s+$/)?.[0] || '');
    });
  }

  const styles = Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b))
    .map(([name, css]) => [name, tokenize(css)]));
  return {styles, tokens:Object.fromEntries([...values].sort(([a], [b]) => a.localeCompare(b)))};
}
