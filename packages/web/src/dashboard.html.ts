import type { AnalysisResult } from "@cc-skills-usage/core";

export function generateDashboardHtml(result: AnalysisResult): string {
  const data = JSON.stringify(result);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>cc-skills-usage Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  :root {
    --bg: #0d1117;
    --bg2: #161b22;
    --bg3: #21262d;
    --border: #30363d;
    --text: #e6edf3;
    --text2: #8b949e;
    --accent: #58a6ff;
    --accent2: #3fb950;
    --accent3: #d2a8ff;
    --accent4: #f78166;
    --accent5: #79c0ff;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
    padding: 24px;
  }
  h1 { font-size: 24px; margin-bottom: 8px; }
  h2 { font-size: 18px; color: var(--accent); margin-bottom: 12px; }
  .subtitle { color: var(--text2); margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
  }
  .card-full { grid-column: 1 / -1; }
  .stat-value { font-size: 36px; font-weight: 700; color: var(--accent); }
  .stat-label { color: var(--text2); font-size: 14px; }
  .chart-container { position: relative; height: 300px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border); color: var(--text2); font-weight: 600; }
  td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
  tr:hover td { background: var(--bg3); }
  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    background: var(--bg3);
    color: var(--accent);
    margin: 2px;
  }
  .unused-tag {
    background: rgba(247, 129, 102, 0.15);
    color: var(--accent4);
  }
  .filter-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .filter-bar input, .filter-bar select {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    color: var(--text);
    font-size: 14px;
  }
  .filter-bar input:focus, .filter-bar select:focus {
    outline: none;
    border-color: var(--accent);
  }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .dim { color: var(--text2); }
  .truncate { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
</head>
<body>
<h1>cc-skills-usage</h1>
<p class="subtitle">Claude Code Skill Usage Dashboard</p>

<div class="grid">
  <div class="card">
    <div class="stat-label">Total Calls</div>
    <div class="stat-value" id="totalCalls"></div>
  </div>
  <div class="card">
    <div class="stat-label">Unique Skills</div>
    <div class="stat-value" id="uniqueSkills"></div>
  </div>
  <div class="card">
    <div class="stat-label">Projects</div>
    <div class="stat-value" id="projectCount"></div>
  </div>
  <div class="card">
    <div class="stat-label">Period</div>
    <div class="stat-value" id="period" style="font-size:20px"></div>
  </div>
</div>

<div class="grid">
  <div class="card">
    <h2>Skill Usage</h2>
    <div class="chart-container"><canvas id="skillChart"></canvas></div>
  </div>
  <div class="card">
    <h2>Token Usage</h2>
    <div class="chart-container"><canvas id="tokenChart"></canvas></div>
  </div>
</div>

<div class="grid">
  <div class="card card-full">
    <h2>Daily Timeline</h2>
    <div class="chart-container" style="height:250px"><canvas id="dailyChart"></canvas></div>
  </div>
</div>

<div class="grid">
  <div class="card">
    <h2>Project Breakdown</h2>
    <table>
      <thead><tr><th>Project</th><th class="num">Calls</th><th>Skills</th></tr></thead>
      <tbody id="projectTable"></tbody>
    </table>
  </div>
  <div class="card">
    <h2>Unused Skills</h2>
    <div id="unusedSkills"></div>
  </div>
</div>

<div class="grid">
  <div class="card card-full">
    <h2>Recent Calls</h2>
    <div class="filter-bar">
      <input id="filterText" type="text" placeholder="Filter by skill or project...">
    </div>
    <table>
      <thead><tr><th>Time</th><th>Skill</th><th>Project</th><th>Args</th><th>Trigger</th></tr></thead>
      <tbody id="recentTable"></tbody>
    </table>
  </div>
</div>

<script>
window.__DATA__ = ${data};

const D = window.__DATA__;
const COLORS = ['#58a6ff','#3fb950','#d2a8ff','#f78166','#79c0ff','#ffa657','#ff7b72','#7ee787','#a5d6ff','#d5a5ff'];

// Summary
document.getElementById('totalCalls').textContent = D.totalCalls.toLocaleString();
document.getElementById('uniqueSkills').textContent = D.skillStats.length;
document.getElementById('projectCount').textContent = D.projectStats.length;
document.getElementById('period').textContent = (D.dateRange.from || 'N/A') + ' → ' + (D.dateRange.to || 'N/A');

// Skill chart
new Chart(document.getElementById('skillChart'), {
  type: 'bar',
  data: {
    labels: D.skillStats.map(s => s.name),
    datasets: [{
      label: 'Calls',
      data: D.skillStats.map(s => s.count),
      backgroundColor: D.skillStats.map((_, i) => COLORS[i % COLORS.length]),
      borderRadius: 4,
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#30363d' }, ticks: { color: '#8b949e' } },
      y: { grid: { display: false }, ticks: { color: '#e6edf3' } },
    }
  }
});

// Token chart
if (D.tokenStats.length > 0) {
  new Chart(document.getElementById('tokenChart'), {
    type: 'bar',
    data: {
      labels: D.tokenStats.map(t => t.skillName),
      datasets: [
        { label: 'Input', data: D.tokenStats.map(t => t.inputTokens), backgroundColor: '#58a6ff', borderRadius: 4 },
        { label: 'Output', data: D.tokenStats.map(t => t.outputTokens), backgroundColor: '#3fb950', borderRadius: 4 },
        { label: 'Cache Create', data: D.tokenStats.map(t => t.cacheCreateTokens), backgroundColor: '#d2a8ff', borderRadius: 4 },
        { label: 'Cache Read', data: D.tokenStats.map(t => t.cacheReadTokens), backgroundColor: '#ffa657', borderRadius: 4 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b949e' } } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: '#e6edf3' } },
        y: { stacked: true, grid: { color: '#30363d' }, ticks: { color: '#8b949e' } },
      }
    }
  });
}

// Daily chart
if (D.dailyStats.length > 0) {
  const allSkills = [...new Set(D.dailyStats.flatMap(d => Object.keys(d.skills)))];
  new Chart(document.getElementById('dailyChart'), {
    type: 'bar',
    data: {
      labels: D.dailyStats.map(d => d.date),
      datasets: allSkills.map((skill, i) => ({
        label: skill,
        data: D.dailyStats.map(d => d.skills[skill] || 0),
        backgroundColor: COLORS[i % COLORS.length],
        borderRadius: 2,
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b949e' } } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: '#8b949e' } },
        y: { stacked: true, grid: { color: '#30363d' }, ticks: { color: '#8b949e' } },
      }
    }
  });
}

// Project table
const ptBody = document.getElementById('projectTable');
D.projectStats.forEach(p => {
  const tags = p.skills.map(s => '<span class="tag">' + s.name + ':' + s.count + '</span>').join('');
  ptBody.innerHTML += '<tr><td>' + p.projectName + '</td><td class="num">' + p.totalCalls + '</td><td>' + tags + '</td></tr>';
});

// Unused skills
const unusedDiv = document.getElementById('unusedSkills');
if (D.unusedSkills.length === 0) {
  unusedDiv.innerHTML = '<p class="dim">All registered skills have been used.</p>';
} else {
  unusedDiv.innerHTML = D.unusedSkills.map(s => '<span class="tag unused-tag">' + s + '</span>').join(' ');
}

// Recent calls table
function renderRecent(filter) {
  const tbody = document.getElementById('recentTable');
  const lc = (filter || '').toLowerCase();
  const rows = D.recentCalls.filter(c =>
    !lc || c.skillName.toLowerCase().includes(lc) || c.projectPath.toLowerCase().includes(lc)
  );
  tbody.innerHTML = rows.map(c => {
    const ts = c.timestamp.replace('T', ' ').slice(0, 19);
    const args = c.args ? '<span class="dim">' + escHtml(c.args.slice(0, 80)) + '</span>' : '';
    const trigger = c.triggerMessage ? '<span class="dim">' + escHtml(c.triggerMessage.slice(0, 100)) + '</span>' : '';
    return '<tr><td class="dim">' + ts + '</td><td>' + c.skillName + '</td><td>' + c.projectPath + '</td><td class="truncate">' + args + '</td><td class="truncate">' + trigger + '</td></tr>';
  }).join('');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

renderRecent('');
document.getElementById('filterText').addEventListener('input', e => renderRecent(e.target.value));
</script>
</body>
</html>`;
}
