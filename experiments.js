import { createPair, stepPair, summarizePair, aggregate, measures, ensembleCSV, MODEL_VERSION } from './experiments-core.js';
import { drawExperimentMap, historySVG, distributionSVG, number as n, htmlEscape as esc } from './experiment-graphics.js';
import { buildReport } from './experiment-report.js';

const $ = id => document.getElementById(id);
const signed = value => Number.isFinite(value) ? `${value>0?'+':''}${n(value)}` : 'N/A';
const nowLabel = () => new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function initializeExperiments(bridge) {
  let pair = null, captured = null, playing = false, fast = false, clock = 0, elapsed = 0;
  let worker = null, ensemble = null, reportHTML = '', pairSaved = false;

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function snapshot(sim, name) {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 448;
    drawExperimentMap(canvas, sim);
    const stats = typeof sim.stats === 'function' ? sim.stats() : sim.stats;
    const history = structuredClone(sim.history || []);
    if (!history.length || history.at(-1).day !== stats.day) history.push({ ...stats });
    return { name, seed: sim.config.seed, config: { ...sim.config }, stats,
      lightning: sim.lightningStrikes ?? stats.lightning, treatments: sim.rxEvents ?? stats.treatments,
      peak: sim.peak ?? stats.peak, history, events: structuredClone(sim.events || []), mapImage: canvas.toDataURL('image/png') };
  }
  function baselineImage(context) {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 448;
    drawExperimentMap(canvas, { cells: context.baseline, config: context.config, day: 0 });
    return canvas.toDataURL('image/png');
  }
  function openReport(data) {
    reportHTML = buildReport({ created: nowLabel(), ...data });
    $('reportFrame').srcdoc = reportHTML;
    $('reportDialog').showModal();
  }
  $('downloadReport').onclick = () => download('firelinelab-experiment-report.html', reportHTML, 'text/html');
  $('closeReport').onclick = () => $('reportDialog').close();
  $('reportDialog').addEventListener('close', () => { $('reportFrame').srcdoc = ''; });

  function pause() {
    playing = false; fast = false; elapsed = 0;
    $('pairPlay').textContent = '▶ Run both forests';
    $('pairFinish').textContent = 'Fast-forward to end ↗';
  }
  function provenance(context) {
    const c = context.config;
    return `Baseline seed ${context.baselineConfig.seed} · ${c.model} model · ${context.years} years · Rx every ${c.interval}y, day ${c.burnDay}, ${c.treatment}% strip, ${c.thin}% thinning`;
  }
  function loadPair() {
    bridge.pauseStudio(); pause(); captured = structuredClone(bridge.getContext());
    captured.years = +$('compareYears').value;
    captured.config.horizon = captured.years;
    pair = createPair(captured.config, captured.baseline, captured.years);
    pairSaved = false; $('pairSave').disabled = false;
    $('parallelLab').hidden = false;
    $('pairProvenance').textContent = provenance(captured);
    $('pairSetupNote').textContent = 'This pair has a frozen copy of your setup. Load current setup again to include later changes.';
    renderPair();
  }
  function renderPair() {
    if (!pair) return;
    const row = summarizePair(pair), day = pair.unmanaged.day;
    $('pairDate').textContent = `Year ${Math.floor(day/365)+1} · Day ${String(day%365+1).padStart(3,'0')} · ${(day/365).toFixed(2)} years elapsed`;
    $('pairTimeline').max = captured.years*365; $('pairTimeline').value = day;
    for (const name of ['unmanaged','managed']) {
      drawExperimentMap($(name+'Map'), pair[name], $('pairLayer').value);
      $(name+'Active').textContent = `${n(row[name].active,0)} active cells`;
      $(name+'Stats').innerHTML = [['Forest cover',row[name].cover,'%'],['Mature survival',row[name].matureSurvival,'%'],['Burned footprint',row[name].burned,' ha']]
        .map(([label,value,unit])=>`<div><span>${label}</span><b>${n(value)}${Number.isFinite(value)?unit:''}</b></div>`).join('');
    }
    const fields = [['cover','Forest cover','pp'],['matureSurvival','Original mature survival','pp'],['wildArea','Wild/manual burned','ha'],['fuel','Surface fuel','points']];
    $('pairDeltas').innerHTML = fields.map(([key,label,unit]) => {
      const delta = Number.isFinite(row.managed[key]) && Number.isFinite(row.unmanaged[key]) ? row.managed[key]-row.unmanaged[key] : null;
      return `<div class="delta-card"><span>${label}</span><b>${signed(delta)} <small>${Number.isFinite(delta)?unit:''}</small></b><p>Managed − unmanaged</p></div>`;
    }).join('');
    const last = pair.unmanaged.lastLightning;
    $('pairEvent').textContent = `${day===captured.years*365?'Complete · ':playing?'Running · ':'Paused · '}${row.unmanaged.lightning} matching lightning strikes · ${row.managed.treatments} managed treatments${last?` · latest strike on day ${last.day} at cell ${last.index%80+1}, ${Math.floor(last.index/80)+1}`:''}`;
    const series = [pair.unmanaged,pair.managed].map(s=>({ history:s.history.at(-1).day===s.day?s.history:[...s.history,s.stats()] }));
    $('pairChart').innerHTML = historySVG(series, $('pairMeasure').value, $('pairMeasure').selectedOptions[0].textContent);
    const finished = day>=captured.years*365;
    $('pairPlay').disabled = finished; $('pairStep').disabled = finished; $('pairFinish').disabled = finished;
  }
  $('pair').onclick = loadPair;
  $('pairPlay').onclick = () => { bridge.pauseStudio(); playing=!playing; fast=false; clock=performance.now(); elapsed=0; $('pairPlay').textContent=playing?'Ⅱ Pause both forests':'▶ Run both forests'; $('pairFinish').textContent='Fast-forward to end ↗'; renderPair(); };
  $('pairStep').onclick = () => { pause(); stepPair(pair); pairSaved=false; $('pairSave').disabled=false; renderPair(); };
  $('pairFinish').onclick = () => { playing=!fast; fast=!fast; elapsed=0; clock=performance.now(); $('pairPlay').textContent=playing?'Ⅱ Pause both forests':'▶ Run both forests'; $('pairFinish').textContent=fast?'Ⅱ Pause fast-forward':'Fast-forward to end ↗'; renderPair(); };
  $('pairReset').onclick = () => { pause(); pair=createPair(captured.config,captured.baseline,captured.years); pairSaved=false; $('pairSave').disabled=false; renderPair(); };
  $('pairLayer').onchange = renderPair; $('pairMeasure').onchange = renderPair;
  $('pairSave').onclick = () => {
    pause(); if (pairSaved) return;
    bridge.savePair(pair); pairSaved=true; $('pairSave').disabled=true; renderPair();
  };
  $('pairReport').onclick = () => {
    pause(); renderPair();
    openReport({ title:'Parallel forests · management comparison',
      runs:[snapshot(pair.unmanaged,'Unmanaged'),snapshot(pair.managed,'Prescribed burn strategy')],
      baselineImage:baselineImage(captured), baselineConfig:captured.baselineConfig,
      settingsNote:`${provenance(captured)}. Identical baseline, weather and lightning within this pair. Snapshot at elapsed day ${pair.unmanaged.day}; ${pair.unmanaged.day<captured.years*365?'the experiment is incomplete.':'the selected horizon is complete.'}` });
  };
  $('editStrategy').onclick = () => { pause(); bridge.editStrategy(); };

  function finishWorker() {
    worker?.terminate(); worker=null; $('ensembleStart').disabled=false; $('ensembleProgress').hidden=true;
  }
  function renderEnsemble() {
    if (!ensemble) return;
    $('ensembleResults').hidden=false;
    $('ensembleProvenance').textContent=`${ensemble.rows.length} paired seeds · ${ensemble.rows.length*2} simulations · ${provenance(ensemble.context)} · ${ensemble.created}`;
    const coverage=aggregate(ensemble.rows,'cover'), fire=aggregate(ensemble.rows,'wildArea'), survival=aggregate(ensemble.rows,'matureSurvival');
    $('ensembleMetrics').innerHTML=[['Median cover change',`${signed(coverage.median)} pp`,'Median of paired differences'],['Higher cover',`${coverage.improved} / ${coverage.count}`,`${coverage.tied} tied · ${coverage.worse} lower`],['Median wildfire-area change',`${signed(fire.median)} ha`,'Cumulative wild/manual area'],['Median mature-survival change',survival.count?`${signed(survival.median)} pp`:'N/A','Original mature cohort']].map(([label,value,detail])=>`<div class="delta-card"><span>${label}</span><b>${value}</b><p>${detail}</p></div>`).join('');
    const key=$('distributionMeasure').value, measure=measures[key], summary=aggregate(ensemble.rows,key);
    $('distributionChart').innerHTML=distributionSVG(summary,measure.unit);
    $('distributionCaption').textContent=summary.count?`${measure.label}: median ${signed(summary.median)} ${measure.unit}; 10th–90th percentile ${n(summary.p10)} to ${n(summary.p90)}. ${summary.improved} improved, ${summary.tied} tied, ${summary.worse} worsened. ${measure.direction===1?'Positive':'Negative'} differences count as improvement for this measure.`:'No original mature stands: survival percentages are not applicable.';
    $('ensembleTable').innerHTML='<thead><tr><th>Measure</th><th>Unmanaged median</th><th>Managed median</th><th>Median paired change</th><th>10th–90th percentile of changes</th></tr></thead><tbody>'+Object.entries(measures).map(([key,m])=>{const a=aggregate(ensemble.rows,key);return `<tr><th>${esc(m.label)}</th><td>${n(a.unmanagedMedian)}</td><td>${n(a.managedMedian)}</td><td>${signed(a.median)} ${m.unit}</td><td>${n(a.p10)} to ${n(a.p90)} ${m.unit}</td></tr>`;}).join('')+'</tbody>';
  }
  $('ensembleStart').onclick = () => {
    if(worker)return;
    bridge.pauseStudio();pause();renderPair();
    const context=structuredClone(bridge.getContext()),count=+$('seedCount').value;
    context.years=+$('compareYears').value;context.config.horizon=context.years;
    $('ensembleStart').disabled=true;$('ensembleProgress').hidden=false;
    $('ensembleProgress').querySelector('progress').value=0;
    $('ensembleStatus').textContent='Preparing paired seeds…';
    try {
      worker=new Worker(new URL('./ensemble-worker.js',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{
        if(data.type==='progress'){
          $('ensembleProgress').querySelector('progress').value=data.fraction*100;
          $('ensembleStatus').textContent=`${data.completed} / ${data.total} pairs completed · event seed ${data.seed} · ${n(data.fraction*100,0)}%`;
        }else if(data.type==='complete'){
          const first=data.rows[0];
          const reportRuns=['unmanaged','managed'].map(name=>snapshot({...data.example[name],stats:first[name]},name==='unmanaged'?'Unmanaged':'Prescribed burn strategy'));
          ensemble={version:1,rows:data.rows,context:{config:context.config,baselineConfig:context.baselineConfig,years:context.years},
            years:context.years,created:nowLabel(),reportRuns,baselineImage:baselineImage(context)};
          finishWorker();renderEnsemble();
          try{localStorage.setItem('firelinelab.ensemble',JSON.stringify(ensemble));bridge.toast('Multi-seed results saved locally. Reports and per-seed CSV are ready.');}
          catch{bridge.toast('Test complete, but browser storage is full. Export the report and CSV before closing.');}
        }else if(data.type==='error'){finishWorker();bridge.toast('Multi-seed test failed: '+data.message);}
      };
      worker.onerror=()=>{finishWorker();bridge.toast('The background simulation could not run. Reload and try again.');};
      worker.postMessage({config:context.config,baseline:context.baseline,years:context.years,count});
    }catch(error){finishWorker();bridge.toast(error.message);}
  };
  $('ensembleCancel').onclick=()=>{finishWorker();bridge.toast('Test canceled. No partial sample was added; previous completed results remain.');};
  $('distributionMeasure').onchange=renderEnsemble;
  $('ensembleCSV').onclick=()=>download('firelinelab-paired-seeds.csv',ensembleCSV(ensemble.rows),'text/csv');
  $('ensembleReport').onclick=()=>{
    openReport({title:'Multi-seed strategy experiment',runs:ensemble.reportRuns,ensemble,
      baselineImage:ensemble.baselineImage,baselineConfig:ensemble.context.baselineConfig,
      settingsNote:`${provenance(ensemble.context)}. ${MODEL_VERSION}. Complete sample; no canceled pairs included. Export the per-seed CSV for all endpoint measurements.`});
  };
  $('studioReport').onclick=()=>{
    bridge.pauseStudio();const context=bridge.getContext();
    openReport({title:'Forest simulation snapshot',runs:[snapshot(bridge.getSimulation(),'Current simulation')],
      baselineImage:baselineImage(context),baselineConfig:context.baselineConfig,
      settingsNote:'Snapshot of the current simulation. Endpoint settings and recent event history are included; this is not a full replay file.'});
  };

  function animate(now){
    if(playing&&pair){
      const remaining=captured.years*365-pair.unmanaged.day;
      elapsed+=Math.min((now-clock)/1000,.25)*+$('pairSpeed').value;
      const steps=Math.min(remaining,fast?30:Math.floor(elapsed));
      if(steps){stepPair(pair,steps);pairSaved=false;$('pairSave').disabled=false;elapsed=fast?0:elapsed-steps;if(pair.unmanaged.day>=captured.years*365)pause();renderPair();}
    }
    clock=now;requestAnimationFrame(animate);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  try{
    const saved=JSON.parse(localStorage.getItem('firelinelab.ensemble'));
    if(saved?.version===1&&Array.isArray(saved.rows)&&saved.rows.length>0&&saved.rows.length<=100&&saved.reportRuns?.length===2&&saved.context?.config&&saved.context?.baselineConfig){
      ensemble=saved;renderEnsemble();
    }
  }catch{bridge.toast('Previous multi-seed results could not be restored. Run a new test.');}
  requestAnimationFrame(animate);
  return {
    pause,
    snapshot,
    savedReport(run){openReport({title:run.name,runs:[run],settingsNote:'Saved result. Older runs may lack map snapshots or original-cohort survival data.'});},
  };
}
