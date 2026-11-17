import test from 'node:test';
import assert from 'node:assert/strict';
import {createPerformanceMonitor} from '../demos/corporate/gjh/v11/assets/performance-monitor.js';

test('uses actual RAF intervals, nearest-rank tails and mean cadence', () => {
  const monitor = createPerformanceMonitor();
  monitor.frame(1);
  assert.equal(monitor.snapshot().fps, null);
  monitor.setEnabled(true);
  for (const at of [0,10,20,30,100]) monitor.frame(at);
  const read = monitor.snapshot({includeHistory:false});
  assert.equal(read.samples,4);
  assert.equal(read.fps,40);
  assert.equal(read.frameMs,70);
  assert.equal(read.p50Ms,10);
  assert.equal(read.p95Ms,70);
  assert.equal(read.p99Ms,70);
  assert.equal(read.history,undefined);
  assert.equal(monitor.snapshot().slowFrames[0].reason,'raf-gap');
});

test('correlates callback duration, render workload and context, even on first frame', () => {
  const monitor = createPerformanceMonitor();
  monitor.setEnabled(true);
  const info = {render:{calls:132,triangles:270000},memory:{geometries:61,textures:22}};
  const detail = {simulationMs:32,renderMs:27,callbackMs:65,steps:4,zone:'gogo',tier:'low',x:-8.25,z:3.5,width:640,height:480};
  monitor.frame(1000,info,detail);
  monitor.frame(1016,info,detail);
  const report = monitor.snapshot();
  assert.equal(report.slowFrames[0].frameMs,null);
  assert.equal(report.slowFrames[1].reason,'busy-callback');
  assert.equal(report.history[0].drawCalls,132);
  for (const [key,value] of Object.entries(detail)) assert.equal(report.history[0][key],value);
  assert.deepEqual(report.seconds,[{at:1000,samples:1,maxMs:16,maxCallbackMs:65,
    maxDrawCalls:132,maxTriangles:270000,slowCount:2,meanMs:16,fps:62.5,zone:'gogo',tier:'low',x:-8.25,z:3.5}]);
  report.history[0].drawCalls = -1;
  assert.equal(monitor.snapshot().history[0].drawCalls,132);
});

test('hidden and disabled time never enters cadence, history stays bounded by age and count', () => {
  const monitor = createPerformanceMonitor();
  monitor.setEnabled(true);
  for (let t=0;t<1100;t++) monitor.frame(t);
  assert.equal(monitor.snapshot().history.length,720);
  monitor.pause();
  monitor.frame(7000);
  assert.equal(monitor.snapshot().samples,0);
  for (let i=1;i<=2200;i++) monitor.frame(7000+60*i);
  let report = monitor.snapshot();
  assert.equal(report.slowFrames.length,20);
  assert.equal(report.seconds.length,120);
  assert.ok(report.history.every(item => item.at>report.at-5000));
  assert.ok(report.seconds.every((item,i,all) => i===0 || item.at>all[i-1].at));
  monitor.setEnabled(false);
  monitor.frame(200000);
  monitor.setEnabled(true);
  monitor.frame(250000);
  report = monitor.snapshot();
  assert.equal(report.frameMs,null);
  assert.equal(report.samples,0);
  assert.equal(report.slowFrames.length,0);
});
