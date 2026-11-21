'use strict';

const MAX_REQUEST_LENGTH = 4096;
const PAGE = /\b(?:site|website|home page|homepage|landing page|landing)\b/;
const QUESTION = /^(?:what|where|when|who|why|is|are|does)\b/;
const OTHER_FORMAT = /\b(?:dashboard|checkout flow|shopping cart|online store|e commerce (?:site|store)|portfolio (?:site|website)|mobile app|web app|blog|pricing page|product landing page|signup|sign up|log ?in|api)\b/;
const UNSPECIFIED_BRAND = /^(?:(?:a|an|the|my|our|your|this|that) )?(?:(?:fictional|sample|generic|demo|existing|new) )?(?:company|firm|business|brand|corporation)(?: |$)/;

function normalize(text) {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function containsPhrase(text, phrase) {
  return text.includes(` ${normalize(phrase)} `);
}

function route(text, { recipes, brands } = {}) {
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_REQUEST_LENGTH || !recipes || !brands) return null;
  const request = normalize(text);
  if (QUESTION.test(request) || OTHER_FORMAT.test(request)) return null;
  const padded = ` ${request} `;
  const matchedBrands = Object.values(brands).filter(brand =>
    [brand.id, brand.name, ...brand.aliases].some(alias => containsPhrase(padded, alias)));
  if (matchedBrands.length > 1) return null;

  const namedBrand = matchedBrands[0];
  const subject = /\b(?:for|called|named) (.+)$/.exec(request)?.[1];
  if (!namedBrand && subject && !UNSPECIFIED_BRAND.test(subject)) return null;

  const candidates = Object.values(recipes).flatMap(recipe => {
    const brand = namedBrand ?? brands[recipe.defaultBrand];
    if (!brand || !recipe.brands.includes(brand.id)) return [];
    const specific = recipe.keywords.some(keyword => containsPhrase(padded, keyword));
    if (!specific && !(namedBrand && PAGE.test(request))) return [];
    return [{ recipe: recipe.id, brand: brand.id, confidence: specific ? (namedBrand ? 1 : 0.86) : 0.9,
      reason: namedBrand ? 'Matched a page request and a supported brand name.' : 'Matched a corporate page request and selected its default brand.' }];
  }).sort((first, second) => second.confidence - first.confidence);

  const [best, next] = candidates;
  return best && best.confidence !== next?.confidence ? best : null;
}

module.exports = { route };
