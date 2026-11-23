import { WIDTH, HEIGHT, clamp } from './engine.js';

export function drawExperimentMap(canvas, simulation, layer = 'forest') {
  const ctx = canvas.getContext('2d'), sx = canvas.width / WIDTH, sy = canvas.height / HEIGHT;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  simulation.cells.forEach((cell, i) => {
    const x = i % WIDTH * sx, y = Math.floor(i / WIDTH) * sy;
    let color = '#303e28';
    if (cell.water) color = '#345253';
    else if (cell.barrier) color = '#b1a485';
    else if (layer === 'fuel') color = `hsl(${105 - clamp((cell.brush + cell.dead * .8) / 1.8) * 83} 30% ${17 + (cell.brush + cell.dead * .8) * 18}%)`;
    else if (layer === 'burn') color = cell.burned ? '#a16a43' : '#2d4631';
    else if (cell.burned && simulation.day - cell.lastBurn < 120) color = '#443629';
    else color = `hsl(92 20% ${17 + cell.brush * 10}%)`;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, sx + .3, sy + .3);
    if (layer === 'forest' && cell.age > 0 && !cell.water && !cell.barrier) {
      const mature = cell.age >= simulation.config.maturity;
      const radius = (mature ? .43 : .29) * sx;
      ctx.fillStyle = mature ? '#5b815c' : '#a4b779';
      ctx.beginPath();
      ctx.moveTo(x + sx/2, y + sy/2 - radius);
      ctx.lineTo(x + sx/2 + radius, y + sy/2 + radius*.7);
      ctx.lineTo(x + sx/2 - radius, y + sy/2 + radius*.7);
      ctx.fill();
    }
    if (cell.fire) {
      ctx.fillStyle = cell.source === 2 ? '#f6c567' : '#f08043';
      ctx.fillRect(x+.5, y+.5, sx-1, sy-1);
      ctx.fillStyle = '#fff1bb';
      ctx.fillRect(x+sx*.4, y+sy*.2, sx*.25, sy*.5);
    }
  });
  const strike=simulation.lastLightning;
  if(strike&&simulation.day-strike.day<12){
    ctx.strokeStyle='#f9e7a3';ctx.lineWidth=2;ctx.beginPath();
    ctx.arc((strike.index%WIDTH+.5)*sx,(Math.floor(strike.index/WIDTH)+.5)*sy,sx*1.6,0,Math.PI*2);ctx.stroke();
  }
}

export const htmlEscape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const number = (value, digits = 1) => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits }) : 'N/A';

export function historySVG(series, key = 'cover', label = 'Forest cover (%)') {
  const width = 900, height = 230, left = 48, top = 22, bottom = 35;
  const maxDay = Math.max(1, ...series.flatMap(s => s.history.map(p => p.day)));
  const values = series.flatMap(s => s.history.map(p => p[key])).filter(Number.isFinite);
  const maximum = ['cover','fuel','burnedPct','matureSurvival'].includes(key) ? 100 : Math.max(1,...values);
  const y = value => top + (1-value/maximum) * (height-top-bottom);
  const x = day => left + day/maxDay * (width-left-20);
  const grid = [0,.25,.5,.75,1].map(f => `<path d="M${left} ${y(f*maximum)}H880" stroke="#dce1d9"/><text x="5" y="${y(f*maximum)+4}">${number(f*maximum,0)}</text><text x="${x(maxDay*f)-8}" y="220">${number(maxDay*f/365,1)}y</text>`).join('');
  const lines = series.map((s,i) => {
    const points = s.history.filter(p => Number.isFinite(p[key]));
    return `<path fill="none" stroke="${i?'#4c7b5b':'#b87939'}" stroke-width="2.5" d="${points.map((p,j)=>`${j?'L':'M'}${x(p.day).toFixed(2)} ${y(p[key]).toFixed(2)}`).join(' ')}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${htmlEscape(label)}" style="font:12px sans-serif;fill:#6e7b6c"><title>${htmlEscape(label)}</title>${grid}${lines}</svg>`;
}

export function distributionSVG(summary, label) {
  if (!summary.count) return '<p>No eligible original mature stands in this landscape.</p>';
  const lo = Math.min(0,summary.min), hi = Math.max(0,summary.max), span = hi-lo || 1;
  const x = n => 45+(n-lo)/span*810;
  const points = summary.deltas.map((d,i)=>`<circle cx="${x(d)}" cy="${53+(i%7)*9}" r="3" fill="#647f62" fill-opacity=".65"><title>Pair ${i+1}: ${number(d)} ${htmlEscape(label)}</title></circle>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 190" role="img" aria-label="Paired differences: ${htmlEscape(label)}" style="font:12px sans-serif;fill:#65735f"><path d="M${x(0)} 20V145" stroke="#acb6a5" stroke-dasharray="4 4"/><path d="M45 140H855" stroke="#acb6a5"/>${points}<path d="M${x(summary.p10)} 125H${x(summary.p90)}" stroke="#497d57" stroke-width="8"/><circle cx="${x(summary.median)}" cy="125" r="7" fill="#b87939"/><text x="${x(lo)}" y="164">${number(lo)}</text><text text-anchor="end" x="${x(hi)}" y="164">${number(hi)}</text><text text-anchor="middle" x="450" y="185">Managed − unmanaged · ${htmlEscape(label)}</text></svg>`;
}
