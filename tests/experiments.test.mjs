import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, createLandscape, Simulation } from '../engine.js';
import { createPair, stepPair, seedSequence, aggregate, quantile, summarizePair, ensembleCSV } from '../experiments-core.js';
import { buildReport } from '../experiment-report.js';

test('paired clocks, settings and lightning remain matched with baseline edits',()=>{
  const baseline=createLandscape(defaults);baseline[20]={...baseline[20],barrier:true,age:0,brush:0,dead:0};
  const before=structuredClone(baseline),pair=createPair(defaults,baseline,1);
  assert.deepEqual(pair.managed.cells,pair.unmanaged.cells);
  assert.equal(pair.managed.config.prescribed,true);assert.equal(pair.unmanaged.config.prescribed,false);
  stepPair(pair,365);assert.equal(pair.managed.day,365);assert.equal(pair.unmanaged.day,365);
  assert.equal(pair.managed.lightningStrikes,pair.unmanaged.lightningStrikes);
  assert.deepEqual(pair.managed.lastLightning&&{...pair.managed.lastLightning,ignited:null},pair.unmanaged.lastLightning&&{...pair.unmanaged.lastLightning,ignited:null});
  assert.deepEqual(baseline,before);assert.equal(pair.managed.cells[20].barrier,true);
  assert.equal(stepPair(pair),false);assert.equal(pair.managed.day,365);
});
test('sample sequence is reproducible and unique across the seed boundary',()=>{
  const seeds=seedSequence(999999999,100);assert.equal(seeds[0],999999999);assert.equal(new Set(seeds).size,100);
  assert(seeds.every(s=>s>=1&&s<=999999999));assert.deepEqual(seeds,seedSequence(999999999,100));
  assert.throws(()=>seedSequence(0,20));assert.throws(()=>seedSequence(1,101));
});
test('summary uses median paired differences, tracks ties and does not substitute difference of medians',()=>{
  const rows=[{unmanaged:{cover:0},managed:{cover:5}},{unmanaged:{cover:10},managed:{cover:110}},{unmanaged:{cover:100},managed:{cover:100}}];
  const s=aggregate(rows,'cover');assert.equal(s.median,5);assert.equal(s.managedMedian-s.unmanagedMedian,90);
  assert.equal(s.improved,2);assert.equal(s.tied,1);assert.equal(s.worse,0);assert.equal(s.p10,1);assert.equal(s.p90,81);
  assert.equal(aggregate([{unmanaged:{loss:5},managed:{loss:2}}],'loss').improved,1);
  assert.equal(quantile([], .5),null);
});
test('mature cohort survival is not replenished by replacement trees',()=>{
  const sim=new Simulation({...defaults,prescribed:true,thin:80,treatment:60,lightning:0});
  const initial=sim.initialMature;sim.treatment();assert(sim.matureCohort.size<initial);
  const killed=sim.cells.findIndex((c,i)=>sim.initial[i].age>=sim.config.maturity&&!sim.matureCohort.has(i));
  const survival=sim.stats().matureSurvival;sim.cells[killed].age=100;
  assert.equal(sim.stats().matureSurvival,survival);
  const empty=new Simulation({...defaults,density:0});assert.equal(empty.stats().matureSurvival,null);
  const agg=aggregate([{unmanaged:empty.stats(),managed:empty.stats()}],'matureSurvival');assert.equal(agg.count,0);assert.equal(agg.median,null);
});
test('resetting a frozen pair reproduces results independent of subsequent setup changes',()=>{
  const settings={...defaults},baseline=createLandscape(settings),pair=createPair(settings,baseline,1);
  settings.wind=60;baseline[0].brush=0;stepPair(pair,365);
  const reset=createPair(defaults,createLandscape(defaults),1);stepPair(reset,365);
  assert.deepEqual(summarizePair(pair),summarizePair(reset));
});
test('CSV carries explicit policy columns and signed paired deltas',()=>{
  const row={seed:4,unmanaged:{day:365,cover:70,matureSurvival:null},managed:{day:365,cover:80,matureSurvival:null}};
  const csv=ensembleCSV([row]);assert(csv.startsWith('seed,day,unmanaged_cover,managed_cover,delta_cover'));
  assert(csv.includes('\n4,365,70,80,10,,,,'));
});
test('reports embed charts and escape names, events and settings',()=>{
  const sim=new Simulation(defaults),stats=sim.stats();
  const run={name:'<script>alert(1)</script>',seed:1,config:defaults,stats,history:[stats],events:[{day:0,text:'<img src=x onerror=alert(1)>'}],mapImage:'javascript:bad'};
  const html=buildReport({title:'<unsafe>',created:'test',runs:[run]});
  assert(html.includes('&lt;unsafe&gt;'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>alert'));
  assert(!html.includes('src="javascript:'));assert(html.includes('<svg'));assert(html.includes('window.print()'));
  assert(html.includes('Original mature stand survival'));assert(html.includes('Map snapshot unavailable'));
});
