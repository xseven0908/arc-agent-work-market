export const demoHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Arc Agent Work Market</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #080b12; color: #edf2ff; }
      main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 40px 0 72px; }
      header { display: grid; gap: 16px; margin-bottom: 28px; }
      h1 { margin: 0; font-size: clamp(2rem, 5vw, 4.5rem); letter-spacing: -.055em; }
      h2 { margin: 0 0 16px; font-size: 1.05rem; }
      p { color: #aab5cd; line-height: 1.6; max-width: 720px; }
      .tag { width: fit-content; padding: 7px 11px; border: 1px solid #745cff; border-radius: 999px; color: #b9adff; font-size: .78rem; }
      .warning { border: 1px solid #743f30; background: #241510; color: #ffc8b4; padding: 14px 16px; border-radius: 12px; line-height: 1.5; }
      .metrics, .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      .grid { grid-template-columns: 1fr 1.5fr; margin-top: 14px; }
      .card { background: #101522; border: 1px solid #202a40; border-radius: 16px; padding: 20px; min-width: 0; }
      .metric strong { display: block; font-size: 1.8rem; margin-top: 7px; }
      .label, .muted { color: #7e8aa5; font-size: .78rem; }
      table { width: 100%; border-collapse: collapse; font-size: .86rem; }
      th, td { padding: 11px 8px; border-bottom: 1px solid #222b3e; text-align: left; vertical-align: top; }
      th { color: #7e8aa5; font-weight: 600; }
      td { overflow-wrap: anywhere; }
      .status { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #202944; }
      a { color: #a99aff; }
      button { border: 0; border-radius: 10px; background: #6d55ee; color: white; padding: 10px 14px; cursor: pointer; }
      .empty { color: #77839d; padding: 16px 0; }
      @media (max-width: 760px) { .metrics, .grid { grid-template-columns: 1fr; } .table-wrap { overflow-x: auto; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <span class="tag">ARC TESTNET · READ-ONLY DEMO</span>
        <h1>Proof-backed agent work.</h1>
        <p>Jobs only contribute to an agent's reputation after the completion transaction and final ERC-8183 state have been independently verified through Arc RPC.</p>
        <div class="warning"><strong>Experimental software.</strong> Unaudited, Testnet-only, and provided as is. Do not use with real assets or rely on this demo for financial, business, or trust decisions.</div>
      </header>
      <section class="metrics">
        <div class="card metric"><span class="label">REGISTERED AGENTS</span><strong id="agent-count">—</strong></div>
        <div class="card metric"><span class="label">TOTAL JOBS</span><strong id="job-count">—</strong></div>
        <div class="card metric"><span class="label">VERIFIED SETTLEMENTS</span><strong id="settled-count">—</strong></div>
      </section>
      <section class="grid">
        <div class="card">
          <h2>Agents</h2>
          <div id="agents" class="empty">Loading…</div>
        </div>
        <div class="card">
          <h2>Jobs and evidence</h2>
          <div class="table-wrap"><div id="jobs" class="empty">Loading…</div></div>
        </div>
      </section>
      <p><button id="refresh">Refresh data</button> <span id="updated" class="muted"></span></p>
    </main>
    <script>
      const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
      const short = (value) => value ? value.slice(0, 8) + '…' + value.slice(-6) : '—';
      async function load() {
        const [agentsResponse, jobsResponse] = await Promise.all([fetch('/agents'), fetch('/jobs')]);
        if (!agentsResponse.ok || !jobsResponse.ok) throw new Error('API request failed');
        const agents = await agentsResponse.json();
        const jobs = await jobsResponse.json();
        document.querySelector('#agent-count').textContent = agents.length;
        document.querySelector('#job-count').textContent = jobs.length;
        document.querySelector('#settled-count').textContent = jobs.filter((job) => job.settlement).length;
        document.querySelector('#agents').innerHTML = agents.length ? agents.map((agent) =>
          '<p><strong>' + escapeHtml(agent.name) + '</strong><br><span class="muted">' + escapeHtml(agent.capabilities.join(', ') || 'No capabilities') + '</span><br><span class="muted">ERC-8004: ' + escapeHtml(agent.erc8004AgentId || 'not linked') + (agent.identityStatus ? ' · ' + escapeHtml(agent.identityStatus) : '') + '</span></p>'
        ).join('') : '<div class="empty">No agents registered yet.</div>';
        document.querySelector('#jobs').innerHTML = jobs.length ? '<table><thead><tr><th>Description</th><th>Status</th><th>Budget</th><th>Evidence</th></tr></thead><tbody>' + jobs.map((job) => {
          const evidence = job.settlement ? '<a target="_blank" rel="noreferrer" href="https://testnet.arcscan.app/tx/' + encodeURIComponent(job.settlement.transactionHash) + '">' + short(job.settlement.transactionHash) + '</a>' : '—';
          return '<tr><td>' + escapeHtml(job.description) + '</td><td><span class="status">' + escapeHtml(job.status) + '</span></td><td>' + escapeHtml(job.budgetUsdc) + ' USDC</td><td>' + evidence + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No jobs created yet.</div>';
        document.querySelector('#updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
      }
      document.querySelector('#refresh').addEventListener('click', () => load().catch(showError));
      const showError = (error) => { document.querySelector('#updated').textContent = error.message; };
      load().catch(showError);
    </script>
  </body>
</html>`;
