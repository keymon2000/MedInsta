/* ------------------------------------------------------------------
   Medicine Continuity — Operations Console logic
   ------------------------------------------------------------------ */

const OPS = (() => {

  let selectedId = null;

  function init() {
    renderRows();
  }

  function renderRows() {
    const rows = document.getElementById("ops-rows");
    rows.innerHTML = MC_DATA.opsWorkflows.map(wf => `
      <tr class="row-clickable ${selectedId === wf.id ? "row-active" : ""}" onclick="OPS.select('${wf.id}')">
        <td class="cust">${wf.customer}</td>
        <td class="ord">${wf.order}</td>
        <td>${wf.issue}</td>
        <td><span class="status-pill ${wf.status}">${wf.status}</span></td>
        <td><span class="review-link">Review →</span></td>
      </tr>
    `).join("");
  }

  function select(id) {
    selectedId = id;
    renderRows();
    renderDetail();
  }

  function renderDetail() {
    const wf = MC_DATA.opsWorkflows.find(w => w.id === selectedId);
    const panel = document.getElementById("ops-detail");
    if (!wf) {
      panel.innerHTML = `<div class="d-empty">Select a workflow to view agent activity and audit trail.</div>`;
      return;
    }

    const icon = { done: "✓", warning: "!", pending: "…" };

    panel.innerHTML = `
      <h3>${wf.customer}</h3>
      <div class="d-sub">${wf.order} · ${wf.issue} · <span class="status-pill ${wf.status}">${wf.status}</span></div>

      <div class="section-label" style="margin-top:0;">Agent Activity</div>
      <ul class="activity-list">
        ${wf.activity.map(a => `
          <li>
            <span class="a-ico ${a.state}">${icon[a.state] || ""}</span>
            <span>${a.label}</span>
          </li>
        `).join("")}
      </ul>

      <div class="section-label">Resolution</div>
      <div class="ops-actions">
        <button class="primary" onclick="OPS.act('${wf.id}', 'Resolved')">Approve</button>
        <button onclick="OPS.act('${wf.id}', 'Pending')">Request info</button>
        <button onclick="OPS.act('${wf.id}', 'Escalated')">Escalate</button>
      </div>
    `;
  }

  function act(id, newStatus) {
    const wf = MC_DATA.opsWorkflows.find(w => w.id === id);
    if (!wf) return;
    wf.status = newStatus;
    renderRows();
    renderDetail();
    showToast(`${wf.customer}'s workflow marked "${newStatus}"`);
  }

  function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  document.addEventListener("DOMContentLoaded", init);

  return { select, act };
})();
