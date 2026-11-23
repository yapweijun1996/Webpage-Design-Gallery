'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mapAnchorRepairScope } = require('../lib/anchor-repair-scope');
const { compare, encodePng } = require('../tools/anchor-qa');

const HERO = '02-hero';
const ABOUT = '04-about';
const OWNERS = Object.freeze({ [HERO]: '02', [ABOUT]: '04' });
const VIEWPORTS = { desktop: [1440, 900], tablet: [768, 1024], mobile: [393, 844] };
const HERO_CELLS = [[1, 1], [1, 2], [2, 1]];
const ABOUT_CELLS = [[3, 1], [3, 2], [4, 1]];

function geometry(width, height) {
  return [
    { sectionId: HERO, x: 0, y: 0, width, height: height / 2 },
    { sectionId: ABOUT, x: 0, y: height / 2, width, height: height / 2 },
  ];
}

function view(name, changes = HERO_CELLS) {
  const [width, height] = VIEWPORTS[name];
  const columns = 4, rows = 4;
  const cells = Array.from({ length: columns * rows }, (_, index) => {
    const row = Math.floor(index / columns) + 1;
    const column = index % columns + 1;
    const changed = changes.some(([r, c]) => r === row && c === column);
    return { row, column, edgeDensityDelta: changed ? 0.16 : 0.02, deviation: changed ? 0.84 : 0.12 };
  });
  return {
    name, width, height, status: 'fail', geometry: geometry(width, height),
    report: { pass: false, score: 71, threshold: 80, palette: { distance: 0.04 }, grid: { columns, rows, cells },
      aspect: { anchor: { width, height }, screenshot: { width, height }, distance: 0 } },
  };
}

function map(breakpoints, owners = OWNERS) {
  return mapAnchorRepairScope({ breakpoints, owners });
}

test('returns bounded evidence for the same full rendered section at two distinct failed widths', () => {
  const phone = view('mobile', [[1, 3], [1, 4], [2, 4]]);
  const desktop = view('desktop');
  const unavailable = { name: 'tablet', width: 768, height: 1024, status: 'missing' };
  const input = { breakpoints: [phone, unavailable, desktop], owners: { [HERO]: '21', [ABOUT]: '04' } };
  const original = structuredClone(input);
  const result = mapAnchorRepairScope(input);
  assert.deepEqual(input, original);
  assert.deepEqual(result, {
    sectionId: HERO,
    ownerId: '21',
    evidence: [
      {
        name: 'desktop', width: 1440, height: 900, columns: 4, rows: 4, materialCells: 3, structuralCells: 3,
        cells: [{ row: 1, column: 1, edgeDensityDelta: 0.16 }, { row: 1, column: 2, edgeDensityDelta: 0.16 },
          { row: 2, column: 1, edgeDensityDelta: 0.16 }],
      },
      {
        name: 'mobile', width: 393, height: 844, columns: 4, rows: 4, materialCells: 3, structuralCells: 3,
        cells: [{ row: 1, column: 3, edgeDensityDelta: 0.16 }, { row: 1, column: 4, edgeDensityDelta: 0.16 },
          { row: 2, column: 4, edgeDensityDelta: 0.16 }],
      },
    ],
  });
});

test('strong cells are ranked with a fixed output bound', () => {
  const desktop = view('desktop', [[1, 1], [1, 2], [1, 3], [1, 4], [2, 1], [2, 2]]);
  const last = desktop.report.grid.cells.find(({ row, column }) => row === 2 && column === 2);
  last.edgeDensityDelta = 0.21;
  const result = map([desktop, view('mobile')]);
  assert.equal(result.evidence[0].materialCells, 6);
  assert.equal(result.evidence[0].structuralCells, 6);
  assert.equal(result.evidence[0].cells.length, 4);
  assert.deepEqual(result.evidence[0].cells[0], { row: 2, column: 2, edgeDensityDelta: 0.21 });
});

test('requires two failures at distinct widths and declines a capture error', () => {
  const pc = view('desktop');
  const phone = view('mobile');
  assert.equal(map([pc, { ...phone, status: 'pass' }]), null);
  assert.equal(map([pc, { ...pc, name: 'mobile' }]), null);
  assert.equal(map([pc, { ...phone, name: 'desktop' }]), null);
  assert.equal(map([pc, phone, { ...view('tablet'), status: 'error' }]), null);
});

test('declines unmapped, reserved or inherited owners and retains full section identity', () => {
  const views = [view('desktop'), view('mobile')];
  assert.equal(map(views, {}), null);
  assert.equal(map(views, { [HERO]: '00' }), null);
  assert.equal(map(views, Object.create({ [HERO]: '02' })), null);
  assert.equal(map(views, { '02-older-hero': '02' }), null);
});

test('declines structural fragments split across widths even for two sections owned by the same worker', () => {
  assert.equal(map([view('desktop'), view('mobile', ABOUT_CELLS)], { [HERO]: '02', [ABOUT]: '02' }), null);
  assert.equal(map([view('desktop'), view('mobile'), view('tablet', ABOUT_CELLS)]), null);
});

test('declines mixed evidence or cells with no dominant non-overlapping section', () => {
  const phone = view('mobile', [[2, 1], [3, 1]]);
  const desktop = view('desktop');
  assert.equal(map([desktop, phone]), null);

  const mixed = view('mobile', [...HERO_CELLS, [4, 1]]);
  mixed.report.grid.cells.find(({ row, column }) => row === 4 && column === 1).edgeDensityDelta = 0.01;
  assert.equal(map([desktop, mixed]), null);

  const boundary = view('mobile');
  boundary.geometry[0].height = boundary.height / 8;
  boundary.geometry[1].y = boundary.height / 8;
  boundary.geometry[1].height = boundary.height * 7 / 8;
  assert.equal(map([desktop, boundary]), null);
});

test('declines global palette, aspect, widespread or color-only deviations', () => {
  const desktop = view('desktop');
  const phone = view('mobile');
  phone.report.palette.distance = 0.22;
  assert.equal(map([desktop, phone]), null);
  phone.report.palette.distance = 0.04;
  phone.report.aspect.anchor.height = 846;
  assert.equal(map([desktop, phone]), null);
  phone.report.aspect.anchor.height = 844;
  phone.report.aspect.distance = 0.01;
  assert.equal(map([desktop, phone]), null);

  const color = view('mobile');
  for (const cell of color.report.grid.cells) cell.edgeDensityDelta = 0.05;
  assert.equal(map([desktop, color]), null);
  const broad = view('mobile', Array.from({ length: 12 }, (_, i) => [Math.floor(i / 4) + 1, i % 4 + 1]));
  broad.geometry = [{ sectionId: HERO, x: 0, y: 0, width: broad.width, height: broad.height }];
  assert.equal(map([desktop, broad]), null);
});

test('declines insufficient structural support, duplicated grid cells and inconsistent failure details', () => {
  const desktop = view('desktop');
  assert.equal(map([desktop, view('mobile', [[1, 1], [2, 2]])]), null);
  assert.equal(map([desktop, view('mobile', [[1, 1]])]), null);
  const duplicate = view('mobile');
  duplicate.report.grid.cells[1] = duplicate.report.grid.cells[0];
  assert.equal(map([desktop, duplicate]), null);
  const passed = view('mobile');
  passed.report.pass = true;
  assert.equal(map([desktop, passed]), null);
});

test('declines missing, malformed, duplicate or overlapping geometry in any failed view', () => {
  const desktop = view('desktop');
  const tablet = view('tablet');
  const phone = view('mobile');
  assert.equal(map([desktop, tablet, { ...phone, geometry: undefined }]), null);
  for (const update of [
    box => { box.y = -0.5; },
    box => { box.width = Infinity; },
    box => { box.height += phone.height; },
    box => { box.sectionId = HERO; },
    box => { box.y -= 1; },
  ]) {
    const copied = structuredClone(phone);
    update(copied.geometry[1]);
    assert.equal(map([desktop, copied]), null);
  }
});

function stripedImage(width, height, stripes) {
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = y >= height / 2 ? 128 : stripes ? (Math.floor(x / (width / 288)) % 2) * 255
        : y < height / 4 ? 0 : 255;
      const index = (y * width + x) * 3;
      rgb[index] = rgb[index + 1] = rgb[index + 2] = value;
    }
  }
  return encodePng({ width, height, rgb });
}

test('localizes actual comparator output with unchanged palette and material structural variation', () => {
  const views = [['desktop', 576, 768], ['mobile', 288, 384]].map(([name, width, height]) => {
    const report = compare(stripedImage(width, height, true), stripedImage(width, height, false), { includeImage: false });
    assert.equal(report.pass, false);
    assert.equal(report.palette.distance, 0);
    return { name, width, height, geometry: geometry(width, height), status: 'fail', report };
  });
  const result = map(views);
  assert.equal(result?.sectionId, HERO);
  assert.equal(result.ownerId, '02');
  assert.equal(result.evidence.length, 2);
});
