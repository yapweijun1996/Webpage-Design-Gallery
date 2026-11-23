'use strict';

const VIEW_NAMES = new Set(['desktop', 'tablet', 'mobile']);
const SECTION_ID = /^\d{2}-[a-z0-9-]{1,100}$/;
const OWNER_ID = /^(?:0[1-9]|[1-9]\d)$/;
// The QA score includes color and aspect. Automatic repair needs corroborating local structure.
const MAX_PALETTE_DISTANCE = 0.20;
const MIN_MATERIAL_DEVIATION = 0.35;
const MIN_EDGE_DENSITY_DELTA = 0.10;
const MAX_VIEWPORT_SHARE = 0.50;
const MIN_SECTION_COVERAGE = 0.90;
const EVIDENCE_CELLS_PER_VIEW = 4;

const ratio = value => Number.isFinite(value) && value >= 0 && value <= 1;

function rect(box) {
  return { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height };
}

function overlap(a, b) {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

function renderedSections(geometry, width, height) {
  if (!Array.isArray(geometry) || !geometry.length || geometry.length > 99) return null;
  const sections = [];
  const ids = new Set();
  for (const entry of geometry) {
    if (!entry || typeof entry.sectionId !== 'string' || !SECTION_ID.test(entry.sectionId) || ids.has(entry.sectionId) ||
        ![entry.x, entry.y, entry.width, entry.height].every(Number.isFinite) ||
        entry.x < 0 || entry.y < 0 || entry.width <= 0 || entry.height <= 0) return null;
    const box = rect(entry);
    if (box.right > width || box.bottom > height || sections.some(section => overlap(box, section.box) > 0)) return null;
    ids.add(entry.sectionId);
    sections.push({ sectionId: entry.sectionId, box });
  }
  return sections;
}

function materialCells(grid) {
  const { columns, rows, cells } = grid ?? {};
  if (!Number.isInteger(columns) || columns < 1 || columns > 64 || !Number.isInteger(rows) || rows < 1 || rows > 64 ||
      !Array.isArray(cells) || cells.length !== columns * rows) return null;
  const seen = new Set();
  for (const cell of cells) {
    if (!cell || !Number.isInteger(cell.column) || cell.column < 1 || cell.column > columns ||
        !Number.isInteger(cell.row) || cell.row < 1 || cell.row > rows ||
        !ratio(cell.edgeDensityDelta) || !ratio(cell.deviation)) return null;
    const key = (cell.row - 1) * columns + cell.column;
    if (seen.has(key)) return null;
    seen.add(key);
  }
  const material = cells.filter(cell => cell.deviation >= MIN_MATERIAL_DEVIATION);
  return material.length <= cells.length * MAX_VIEWPORT_SHARE ? material : null;
}

function cellSection(cell, sections, width, height, { columns, rows }) {
  const box = { left: width * (cell.column - 1) / columns, right: width * cell.column / columns,
    top: height * (cell.row - 1) / rows, bottom: height * cell.row / rows };
  const area = (box.right - box.left) * (box.bottom - box.top);
  const matches = sections.map(section => ({ section, area: overlap(box, section.box) })).filter(match => match.area > 0);
  if (matches.length !== 1 || matches[0].area < area * MIN_SECTION_COVERAGE) return null;
  return matches[0].section.sectionId;
}

function adjacentCells(cells) {
  const positions = new Set(cells.map(({ row, column }) => `${row}:${column}`));
  return cells.some(({ row, column }) => positions.has(`${row + 1}:${column}`) || positions.has(`${row}:${column + 1}`));
}

function localize({ name, width, height, geometry, report }) {
  const matchesCapture = frame => frame?.width === width && frame?.height === height;
  if (report?.pass !== false || !Number.isFinite(report.score) || !Number.isFinite(report.threshold) ||
      report.score >= report.threshold || report.aspect?.distance !== 0 ||
      !matchesCapture(report.aspect?.anchor) || !matchesCapture(report.aspect?.screenshot) ||
      !ratio(report.palette?.distance) || report.palette.distance >= MAX_PALETTE_DISTANCE) return null;

  const sections = renderedSections(geometry, width, height);
  const material = materialCells(report.grid);
  if (!sections || !material) return null;
  const structural = material.filter(cell => cell.edgeDensityDelta >= MIN_EDGE_DENSITY_DELTA);
  if (!adjacentCells(structural)) return null;
  // Every material cell must belong to the same section, including color-only deviations.
  const sectionId = cellSection(material[0], sections, width, height, report.grid);
  if (!sectionId || material.some(cell => cellSection(cell, sections, width, height, report.grid) !== sectionId)) return null;
  const cells = structural.sort((a, b) => b.edgeDensityDelta - a.edgeDensityDelta || a.row - b.row || a.column - b.column)
    .slice(0, EVIDENCE_CELLS_PER_VIEW)
    .map(({ row, column, edgeDensityDelta }) => ({ row, column, edgeDensityDelta }));
  const { columns, rows } = report.grid;
  return { sectionId, evidence: { name, width, height, columns, rows, materialCells: material.length, structuralCells: structural.length, cells } };
}

/** Return a bounded repair candidate from QA and authoritative ownership, or null for operator review. */
function mapAnchorRepairScope({ breakpoints, owners } = {}) {
  if (!Array.isArray(breakpoints) || breakpoints.length > VIEW_NAMES.size ||
      !owners || typeof owners !== 'object' || Array.isArray(owners)) return null;
  const widths = new Set();
  const names = new Set();
  const failed = [];
  for (const view of breakpoints) {
    if (!view || !VIEW_NAMES.has(view.name) || names.has(view.name) ||
        !Number.isSafeInteger(view.width) || view.width <= 0 || widths.has(view.width) ||
        !Number.isSafeInteger(view.height) || view.height <= 0 || !['pass', 'fail', 'missing'].includes(view.status)) return null;
    widths.add(view.width);
    names.add(view.name);
    if (view.status === 'fail') failed.push(view);
  }
  if (failed.length < 2) return null;

  const findings = failed.map(localize);
  const sectionId = findings[0]?.sectionId;
  if (!sectionId || findings.some(finding => finding?.sectionId !== sectionId) || !Object.hasOwn(owners, sectionId)) return null;
  const ownerId = owners[sectionId];
  if (typeof ownerId !== 'string' || !OWNER_ID.test(ownerId)) return null;

  const evidence = findings.map(finding => finding.evidence).sort((a, b) => b.width - a.width);
  return { sectionId, ownerId, evidence };
}

module.exports = { mapAnchorRepairScope };
