/**
 * Workflow Engine & Data Fusion Layer - Interactive Demo UI Logic
 */

// Presets
const PRESETS = {
  wf_comprehensive_ems_fusion: {
    type: "registered",
    workflow_id: "wf_comprehensive_ems_fusion",
    inputs: {
      organizationId: "28753",
      userId: "658359",
      items: [
        { item: "QCAB17587", inventoryItemId: "3042180" },
        { item: "QDAE01694", inventoryItemId: "3365330" }
      ]
    },
    description: "EMS 360: Full Sequential Execution of all 6 EMS Production APIs (Trace 1, 5, 9, 16, 21, 24/25) & Unified 360-degree Data Fusion."
  },
  wf_target_stock_optimization: {
    type: "registered",
    workflow_id: "wf_target_stock_optimization",
    inputs: {
      organizationId: "28753",
      userId: "658359",
      items: [
        { item: "QCAB17587", inventoryItemId: "3042180" },
        { item: "QDAE01694", inventoryItemId: "3365330" }
      ]
    },
    description: "Target Stock Optimization: Orchestrate GetOptimizeInfo, TargetStockSearchList (93 cols), retrieveItemInfoDetail in Loop mode, & JSONata dictionary enrichment."
  },
  wf_search_and_enrich: {
    type: "registered",
    workflow_id: "wf_search_and_enrich",
    inputs: {
      keyword: "QCAB17587",
      status_filter: "ACTIVE",
      items: [
        { code: "QCAB17587" },
        { code: "QDAE01694" }
      ]
    },
    description: "Search inventory items & enrich real-time status matrix via JSONata with production dictionaries."
  },
  wf_loop_item_details: {
    type: "registered",
    workflow_id: "wf_loop_item_details",
    inputs: {
      items: [
        { code: "QCAB17587" },
        { code: "QCAD57452" }
      ]
    },
    description: "Iterate over items concurrently with asyncio.Semaphore(5) bounded pool."
  },
  wf_auth_nexacro_global: {
    type: "registered",
    workflow_id: "wf_auth_nexacro_global",
    inputs: {
      username: "658359",
      organization_id: "28753"
    },
    description: "Automate Nexacro session login & manage in-memory TTLCache (3600s)."
  },
  custom_inline: {
    type: "inline",
    workflow_definition: `id: wf_custom_demo
name: "Custom Dynamic Workflow"
inputs:
  parts:
    - code: "PUMP-01"
      stat: "01"
      qty: "15"
      cat: "PUMP"
    - code: "VALVE-02"
      stat: "01"
      qty: "0"
      cat: "VALVE"
    - code: "MOTOR-99"
      stat: "02"
      qty: "3"
      cat: "MOTOR"
steps:
  - id: enrich_parts
    type: "transform_jsonata"
    config:
      expression: |
        inputs.parts.[{
          "item_code": code,
          "category_name": $lookup($globals.dict.CATEGORY, cat) ? $lookup($globals.dict.CATEGORY, cat) : "Other",
          "calculated_status": (
            stat == '01' and $number(qty) > 0 ? "AVAILABLE" :
            stat == '01' and $number(qty) <= 0 ? "OUT_OF_STOCK" : "INACTIVE"
          )
        }]
      output_var: "results"
response:
  status: "SUCCESS"
  data: "{{ steps.enrich_parts.output }}"`,
    inputs: {},
    description: "Execute arbitrary workflow YAML directly without saving on disk."
  }
};

let currentPresetKey = "wf_comprehensive_ems_fusion";
let isRunning = false;

document.addEventListener("DOMContentLoaded", () => {
  initHealthChecks();
  initPresetSelector();
  initTabs();
  initExecuteAction();
  initCacheControls();
});

// 1. Health Checks & Token Status
async function initHealthChecks() {
  try {
    const res = await fetch("/api/v1/health");
    if (res.ok) {
      document.getElementById("engine-status-text").textContent = "Port 8000 Online";
      document.getElementById("engine-dot").className = "dot online";
    }
  } catch (e) {
    document.getElementById("engine-status-text").textContent = "Engine Offline";
    document.getElementById("engine-dot").className = "dot offline";
  }

  // Refresh token status
  refreshTokenStatus();
}

async function refreshTokenStatus() {
  try {
    const res = await fetch("/api/v1/cache/token");
    if (res.ok) {
      const data = await res.json();
      const tokenPill = document.getElementById("cache-token-text");
      if (data.cached && data.token_data) {
        const token = data.token_data.token || data.token_data.session_token;
        tokenPill.textContent = `Token: ${token.substring(0, 15)}... (Cached)`;
      } else {
        tokenPill.textContent = "Token: None (Miss)";
      }
    }
  } catch (e) {}
}

// 2. Preset Selector
function initPresetSelector() {
  const select = document.getElementById("workflow-preset-select");
  const descEl = document.getElementById("preset-description");
  const inputsArea = document.getElementById("inputs-json-editor");
  const inlineYamlGroup = document.getElementById("inline-yaml-group");
  const inlineYamlArea = document.getElementById("inline-yaml-editor");

  function updatePreset() {
    currentPresetKey = select.value;
    const preset = PRESETS[currentPresetKey];
    descEl.textContent = preset.description;

    if (preset.type === "inline") {
      inlineYamlGroup.style.display = "flex";
      inlineYamlArea.value = preset.workflow_definition;
      inputsArea.value = JSON.stringify(preset.inputs, null, 2);
    } else {
      inlineYamlGroup.style.display = "none";
      inputsArea.value = JSON.stringify(preset.inputs, null, 2);
    }
  }

  select.addEventListener("change", updatePreset);
  updatePreset();
}

// 3. Tab Switching
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const content = document.getElementById(`tab-${targetTab}`);
      if (content) content.classList.add("active");
    });
  });
}

// 4. Cache Purge Action
function initCacheControls() {
  const btn = document.getElementById("btn-purge-cache");
  btn.addEventListener("click", async () => {
    btn.textContent = "Purging...";
    await fetch("/api/v1/cache/clear", { method: "POST" });
    await refreshTokenStatus();
    btn.textContent = "Purge Cache";
    showHealingAlert("In-Memory Auth Token Cache purged! Next execution will re-authenticate.");
  });
}

function showHealingAlert(msg) {
  const alert = document.getElementById("healing-alert");
  const msgEl = document.getElementById("healing-alert-text");
  msgEl.textContent = msg;
  alert.classList.add("active");
  setTimeout(() => alert.classList.remove("active"), 6000);
}

// 5. Execution Pipeline Visualizer & Dispatch
function setStageState(stageId, state, badgeText = "") {
  const el = document.getElementById(stageId);
  if (!el) return;
  el.className = `stage-node ${state}`;
  if (badgeText) {
    const badge = el.querySelector(".stage-badge");
    if (badge) badge.textContent = badgeText;
  }
}

function resetPipelineStages() {
  const stages = [
    "stage-1", "stage-2", "stage-3", "stage-4",
    "stage-5", "stage-6", "stage-7", "stage-8"
  ];
  stages.forEach(s => setStageState(s, "idle", "Waiting"));
}

function initExecuteAction() {
  const btn = document.getElementById("btn-execute");
  btn.addEventListener("click", async () => {
    if (isRunning) return;
    isRunning = true;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner">⏳</span> Executing Pipeline...`;

    resetPipelineStages();

    // Parse inputs
    let inputsObj = {};
    try {
      inputsObj = JSON.parse(document.getElementById("inputs-json-editor").value || "{}");
    } catch (e) {
      alert("Invalid JSON in Inputs editor!");
      isRunning = false;
      btn.disabled = false;
      btn.innerHTML = `<span>▶</span> Run Execution Pipeline`;
      return;
    }

    const simulateSelfHealing = document.getElementById("chk-simulate-healing").checked;
    if (simulateSelfHealing) {
      await fetch("/api/v1/cache/clear", { method: "POST" });
      showHealingAlert("⚡ Self-Healing Circuit Breaker: Session expired detected! Purging cache and auto-reauthenticating...");
    }

    // Pipeline progressive visual animation
    setStageState("stage-1", "active", "Checking Token");
    await sleep(40);
    setStageState("stage-1", "success", "Cached (3600s)");

    setStageState("stage-2", "active", "Batch HTTP (1)");
    await sleep(35);
    setStageState("stage-2", "success", "ComCodes OK");

    setStageState("stage-3", "active", "Batch HTTP (1)");
    await sleep(35);
    setStageState("stage-3", "success", "38 Cols OK");

    setStageState("stage-4", "active", "Batch HTTP (1)");
    await sleep(30);
    setStageState("stage-4", "success", "Optimize OK");

    setStageState("stage-5", "active", "Batch HTTP (1)");
    await sleep(35);
    setStageState("stage-5", "success", "93 Metrics OK");

    setStageState("stage-6", "active", "Loop Sem(5)");
    await sleep(40);
    setStageState("stage-6", "success", "Master OK");

    setStageState("stage-7", "active", "Loop Sem(5)");
    await sleep(40);
    setStageState("stage-7", "success", "MTBF & Specs");

    setStageState("stage-8", "active", "Fusing 6 APIs");

    // Build payload
    const preset = PRESETS[currentPresetKey];
    let payload = { inputs: inputsObj };
    if (preset.type === "inline") {
      payload.workflow_definition = document.getElementById("inline-yaml-editor").value;
    } else {
      payload.workflow_id = preset.workflow_id;
    }

    const startTime = performance.now();
    try {
      const response = await fetch("/api/v1/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const elapsed = Math.round(performance.now() - startTime);

      if (response.ok) {
        setStageState("stage-8", "success", `Fused in ${elapsed}ms`);

        document.getElementById("exec-meta-id").textContent = result.workflow_id || currentPresetKey;
        document.getElementById("exec-meta-time").textContent = `${result.execution_time_ms || elapsed}ms`;

        // Render Outputs
        renderEnrichedTable(result.data);
        renderDataContextJson(result);
        renderTimeline(result);
        refreshTokenStatus();
      } else {
        setStageState("stage-8", "failed", `Error ${response.status}`);
        alert(`Workflow Execution Failed:\n${JSON.stringify(result, null, 2)}`);
      }
    } catch (err) {
      setStageState("stage-8", "failed", "Network Error");
      alert(`Network error dispatching workflow: ${err.message}`);
    } finally {
      isRunning = false;
      btn.disabled = false;
      btn.innerHTML = `<span>▶</span> Run Execution Pipeline`;
    }
  });
}

// Global toggle for 360 Profile drawer
window.toggle360Drawer = function(itemCode) {
  const row = document.getElementById(`drawer-${itemCode}`);
  const btn = document.getElementById(`btn-360-${itemCode}`);
  if (!row) return;
  if (row.style.display === "none" || !row.style.display) {
    row.style.display = "table-row";
    if (btn) btn.innerHTML = `<span>▼</span> Hide 360°`;
  } else {
    row.style.display = "none";
    if (btn) btn.innerHTML = `<span>🔍</span> 360° Profile`;
  }
};

// 6. Output Renderers: 360-Degree Data Fusion & Enriched View
function renderEnrichedTable(data) {
  const tbody = document.getElementById("table-body");
  const countEl = document.getElementById("table-row-count");
  tbody.innerHTML = "";

  const items = Array.isArray(data) ? data : (data ? [data] : []);
  countEl.textContent = `${items.length} items fused`;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-dim); padding: 32px;">No items returned from query</td></tr>`;
    return;
  }

  items.forEach(item => {
    // Check if item is from 360 Comprehensive Fusion or flat item
    const is360 = Boolean(item.item_identification || item.stock_and_inventory_balances);

    let code, name, category, status, statusClass, onhand, avail, target, safety, poPrice, supplier, poType, leadTime, dueDays, mtbf, avgUsage3m, actionRec;

    if (is360) {
      const id = item.item_identification || {};
      const org = item.organization_and_responsibility || {};
      const stk = item.stock_and_inventory_balances || {};
      const proc = item.procurement_and_commercials || {};
      const rel = item.lead_time_and_equipment_reliability || {};
      const opt = item.optimization_matrix || {};

      code = id.item_code || "N/A";
      name = id.description || id.maker || "N/A";
      category = id.category_name || id.category_code || "Other";
      status = opt.health_rating || "NORMAL";
      actionRec = opt.action_recommendation || "";

      onhand = stk.onhand_qty ?? "-";
      avail = stk.available_qty ?? "-";
      target = stk.target_stock_qty ?? "-";
      safety = stk.safety_stock_qty ?? "-";

      poPrice = proc.unit_price_po ? `$${proc.unit_price_po}` : "N/A";
      supplier = proc.supplier_name || `ID: ${proc.supplier_id || 'N/A'}`;
      poType = proc.po_type || "Standard";

      leadTime = rel.full_lead_time_days ? `${rel.full_lead_time_days}d` : "-";
      dueDays = rel.due_days !== undefined ? `${rel.due_days}d` : "-";
      mtbf = rel.mtbf_days ? `${rel.mtbf_days}d` : "-";
      avgUsage3m = rel.last_3m_monthly_avg_usage ? `${rel.last_3m_monthly_avg_usage}/mo` : "-";
    } else {
      code = item.item_code || item.item || item.code || "N/A";
      name = item.item_name || item.description || "N/A";
      category = item.category_name || "General";
      status = item.calculated_status || item.status || "UNKNOWN";
      actionRec = "";

      onhand = item.QTY || item.qty || "-";
      avail = item.available_qty || onhand;
      target = item.target_qty || "-";
      safety = "-";

      poPrice = item.price ? `$${item.price}` : "-";
      supplier = item.supplier || "-";
      poType = "Standard";

      leadTime = "-";
      dueDays = "-";
      mtbf = "-";
      avgUsage3m = "-";
    }

    // Health / Status Badge class
    statusClass = "inactive";
    if (status === "AVAILABLE" || status === "OPTIMAL_HEALTHY" || status === "OPTIMIZED") {
      statusClass = "optimal";
    } else if (status === "OUT_OF_STOCK" || status === "CRITICAL_EXPEDITE" || status === "CRITICAL_LEAD_TIME") {
      statusClass = "critical";
    } else if (status.includes("REORDER") || status.includes("WARNING")) {
      statusClass = "warning";
    }

    // Main Table Row
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-family: var(--font-mono); font-weight: 700; color: var(--color-cyan); font-size: 0.9rem;">${escapeHtml(code)}</span>
          <span class="badge-category">${escapeHtml(category)}</span>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(name)}">
          ${escapeHtml(name)}
        </div>
      </td>
      <td>
        <div style="display: flex; gap: 6px; font-family: var(--font-mono); font-size: 0.75rem;">
          <span style="background: rgba(16, 185, 129, 0.1); color: #34d399; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.2);" title="Available Qty">AVL: <b>${avail}</b></span>
          <span style="background: rgba(6, 182, 212, 0.1); color: #38bdf8; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(6, 182, 212, 0.2);" title="Target Stock Qty">TGT: <b>${target}</b></span>
          <span style="background: rgba(148, 163, 184, 0.1); color: #94a3b8; padding: 2px 6px; border-radius: 4px;" title="On-Hand Qty">OH: ${onhand}</span>
        </div>
      </td>
      <td>
        <div style="font-weight: 600; color: #38bdf8; font-family: var(--font-mono);">${poPrice}</div>
        <div style="font-size: 0.72rem; color: var(--text-dim); max-width: 160px; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(supplier)}">${escapeHtml(supplier)}</div>
      </td>
      <td>
        <div style="font-size: 0.75rem; font-family: var(--font-mono); color: var(--text-muted);">
          <span>Due: <b style="color: #fca5a5;">${dueDays}</b></span> &bull; <span>LT: <b>${leadTime}</b></span>
        </div>
        <div style="font-size: 0.7rem; color: var(--text-dim);">MTBF: ${mtbf} | 3M Avg: ${avgUsage3m}</div>
      </td>
      <td>
        <span class="badge-status ${statusClass}">● ${escapeHtml(status)}</span>
      </td>
      <td>
        ${is360 ? `
          <button class="btn-toggle-360" id="btn-360-${escapeHtml(code)}" onclick="toggle360Drawer('${escapeHtml(code)}')">
            <span>🔍</span> 360° Profile
          </button>
        ` : `<span style="font-size: 0.72rem; color: var(--text-dim);">Flat Item</span>`}
      </td>
    `;
    tbody.appendChild(tr);

    // Expandable Drawer Row for 360 View
    if (is360) {
      const id = item.item_identification || {};
      const org = item.organization_and_responsibility || {};
      const stk = item.stock_and_inventory_balances || {};
      const proc = item.procurement_and_commercials || {};
      const rel = item.lead_time_and_equipment_reliability || {};
      const opt = item.optimization_matrix || {};

      const drawerTr = document.createElement("tr");
      drawerTr.id = `drawer-${escapeHtml(code)}`;
      drawerTr.className = "row-drawer";
      drawerTr.style.display = "none";

      drawerTr.innerHTML = `
        <td colspan="6" class="row-drawer-content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.1rem; font-weight: 700; color: #38bdf8;">🌐 Spare Part 360° Master Record &bull; ${escapeHtml(code)}</span>
              <span class="mode-pill fusion">ALL 6 APIS FUSED</span>
              <span class="mode-pill cache">${escapeHtml(id.uom || 'EA')}</span>
            </div>
            ${id.fdm_drawing_url ? `
              <a href="${escapeHtml(id.fdm_drawing_url)}" target="_blank" style="font-size: 0.75rem; color: var(--color-cyan); text-decoration: none; display: flex; align-items: center; gap: 4px; background: rgba(6, 182, 212, 0.1); padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(6, 182, 212, 0.2);">
                📐 Open FDM CAD Drawing ↗
              </a>
            ` : ''}
          </div>

          <div class="profile-360-grid">

            <!-- Pillar 1: Item Identification & Specs -->
            <div class="pillar-card">
              <div class="pillar-title">🏷️ 1. Item Master & Specs (retrieveItem)</div>
              <div class="pillar-metric-list">
                <div class="pillar-metric-row"><span class="pillar-metric-label">Item Code:</span><span class="pillar-metric-val">${escapeHtml(id.item_code || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Inventory ID:</span><span class="pillar-metric-val">${escapeHtml(id.inventory_item_id || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Maker / Brand:</span><span class="pillar-metric-val">${escapeHtml(id.maker || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Model Number:</span><span class="pillar-metric-val">${escapeHtml(id.model || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Maker Part:</span><span class="pillar-metric-val">${escapeHtml(id.maker_part || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Catalog Group:</span><span class="pillar-metric-val">${escapeHtml(id.catalog_group_id || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Lifecycle Status:</span><span class="pillar-metric-val">${escapeHtml(id.item_status || 'Active')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Unification / Reb SN:</span><span class="pillar-metric-val">${escapeHtml(id.unification_flag || 'N')} / ${escapeHtml(id.reb_sn_flag || 'N')}</span></div>
              </div>
            </div>

            <!-- Pillar 2: Stock Balances & Optimization (38 & 93 metrics) -->
            <div class="pillar-card">
              <div class="pillar-title">📦 2. Stock Balances (RetStockStatusList)</div>
              <div class="metric-pill-grid">
                <div class="metric-pill-item"><div class="val" style="color: #34d399;">${stk.available_qty ?? 0}</div><div class="lbl">Available</div></div>
                <div class="metric-pill-item"><div class="val" style="color: #38bdf8;">${stk.target_stock_qty ?? 0}</div><div class="lbl">Target Stock</div></div>
                <div class="metric-pill-item"><div class="val" style="color: #94a3b8;">${stk.onhand_qty ?? 0}</div><div class="lbl">On Hand</div></div>
                <div class="metric-pill-item"><div class="val">${stk.safety_stock_qty ?? 0}</div><div class="lbl">Safety Stock</div></div>
                <div class="metric-pill-item"><div class="val">${stk.allocated_qty ?? 0}</div><div class="lbl">Allocated</div></div>
                <div class="metric-pill-item"><div class="val">${stk.po_waiting_qty ?? 0}</div><div class="lbl">PO Waiting</div></div>
              </div>
              <div class="pillar-metric-list" style="margin-top: 6px;">
                <div class="pillar-metric-row"><span class="pillar-metric-label">Other Site On-Hand:</span><span class="pillar-metric-val">${stk.other_site_onhand_qty ?? 0}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Overstock Flag / Qty:</span><span class="pillar-metric-val">${escapeHtml(stk.overstock_flag || 'N')} (${stk.overstock_qty ?? 0})</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Disuse Flag:</span><span class="pillar-metric-val">${escapeHtml(stk.disuse_flag || 'N')}</span></div>
              </div>
            </div>

            <!-- Pillar 3: Procurement & Commercials -->
            <div class="pillar-card">
              <div class="pillar-title">💰 3. Procurement & Commercials</div>
              <div class="pillar-metric-list">
                <div class="pillar-metric-row"><span class="pillar-metric-label">PO Unit Price:</span><span class="pillar-metric-val" style="color: #38bdf8;">$${proc.unit_price_po ?? '0.00'}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">New / Reb / Unl Price:</span><span class="pillar-metric-val">$${proc.unit_price_new ?? 0} / $${proc.unit_price_reb ?? 0} / $${proc.unit_price_unl ?? 0}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Supplier Name:</span><span class="pillar-metric-val" style="color: #67e8f9;">${escapeHtml(proc.supplier_name || '-')}</span></div>
                ${proc.supplier_raw_name && proc.supplier_raw_name !== proc.supplier_name ? `
                  <div class="pillar-metric-row"><span class="pillar-metric-label">Legacy Source Name:</span><span class="pillar-metric-val" style="font-size: 0.7rem; color: var(--text-dim);">${escapeHtml(proc.supplier_raw_name)}</span></div>
                ` : ''}
                <div class="pillar-metric-row"><span class="pillar-metric-label">Supplier ID:</span><span class="pillar-metric-val">${escapeHtml(proc.supplier_id || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Buy Item Type:</span><span class="pillar-metric-val">${escapeHtml(proc.buy_item_type_desc || proc.buy_item_type_code || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">PO Type & Ownership:</span><span class="pillar-metric-val">${escapeHtml(proc.po_type || '-')} (${escapeHtml(proc.po_ownership || '-')})</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Price Reg Status:</span><span class="pillar-metric-val">${escapeHtml(proc.price_reg_status || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Timely Purchase Date:</span><span class="pillar-metric-val">${escapeHtml(proc.timely_purchase_date || '-')}</span></div>
              </div>
            </div>

            <!-- Pillar 4: Lead Time & Reliability (MTBF) -->
            <div class="pillar-card">
              <div class="pillar-title">⏱️ 4. Lead Time & MTBF Reliability</div>
              <div class="pillar-metric-list">
                <div class="pillar-metric-row"><span class="pillar-metric-label">Full Lead Time:</span><span class="pillar-metric-val">${rel.full_lead_time_days ? rel.full_lead_time_days + ' days' : '-'}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Due Days (Urgency):</span><span class="pillar-metric-val" style="color: #fca5a5;">${rel.due_days !== undefined ? rel.due_days + ' days' : '-'}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Basis Days / Buffer:</span><span class="pillar-metric-val">${rel.basis_days ?? '-'}d / ${rel.order_buf_day ?? '-'}d</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">MTBF (Reliability):</span><span class="pillar-metric-val" style="color: #67e8f9;">${rel.mtbf_days ? rel.mtbf_days + ' days' : '-'}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">2Y / 1Y / 3M Avg Usage:</span><span class="pillar-metric-val">${rel.last_2y_monthly_avg_usage ?? 0} / ${rel.last_1y_monthly_avg_usage ?? 0} / ${rel.last_3m_monthly_avg_usage ?? 0}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Month Issues (Last / This):</span><span class="pillar-metric-val">${rel.last_month_issue_qty ?? 0} / ${rel.this_month_issue_qty ?? 0}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Issue Frequency / Max:</span><span class="pillar-metric-val">${rel.issue_count_frequency ?? 0} times (Max: ${rel.once_max_issue_qty ?? 0})</span></div>
              </div>
            </div>

            <!-- Pillar 5: Organization & Responsibility -->
            <div class="pillar-card">
              <div class="pillar-title">🏭 5. Organization & Ownership</div>
              <div class="pillar-metric-list">
                <div class="pillar-metric-row"><span class="pillar-metric-label">Organization:</span><span class="pillar-metric-val">${escapeHtml(org.organization_name || '-')} (${org.organization_id || '-'})</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Stock Department:</span><span class="pillar-metric-val">${escapeHtml(org.stock_department || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Inventory Dept Code:</span><span class="pillar-metric-val">${escapeHtml(org.inventory_department_code || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Planner Code:</span><span class="pillar-metric-val">${escapeHtml(org.planner_code || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Manager Name:</span><span class="pillar-metric-val">${escapeHtml(org.manager_name || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Manager Contact:</span><span class="pillar-metric-val">${escapeHtml(org.management_contact || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Buyer Name:</span><span class="pillar-metric-val">${escapeHtml(org.buyer_name || '-')}</span></div>
              </div>
            </div>

            <!-- Pillar 6: Optimization Matrix & Recommendations -->
            <div class="pillar-card">
              <div class="pillar-title">🎯 6. Target Stock Decision Matrix</div>
              <div class="pillar-metric-list">
                <div class="pillar-metric-row"><span class="pillar-metric-label">Health Rating:</span><span class="badge-status ${statusClass}">● ${escapeHtml(opt.health_rating || 'NORMAL')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Action Status:</span><span class="pillar-metric-val" style="color: #38bdf8;">${escapeHtml(opt.action_recommendation || 'NORMAL')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Optimize Flag:</span><span class="pillar-metric-val">${escapeHtml(opt.optimize_flag || 'N')} (Apply: ${escapeHtml(opt.optimized_apply_date || '-')})</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Target Apply Type:</span><span class="pillar-metric-val">${escapeHtml(opt.target_apply_type_desc || opt.target_apply_type_code || '-')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">PO Opt Target:</span><span class="pillar-metric-val">${escapeHtml(opt.po_opt_target || 'N')}</span></div>
                <div class="pillar-metric-row"><span class="pillar-metric-label">Inventory Tooltip:</span><span class="pillar-metric-val" style="font-size: 0.7rem; color: var(--text-dim);">${escapeHtml(opt.inventory_tooltip || '-')}</span></div>
              </div>
            </div>

          </div>
        </td>
      `;
      tbody.appendChild(drawerTr);
    }
  });
}

function renderDataContextJson(result) {
  const pre = document.getElementById("raw-json-output");
  pre.textContent = JSON.stringify(result, null, 2);
}

function renderTimeline(result) {
  const container = document.getElementById("timeline-container");
  container.innerHTML = "";

  const isFusion = (result.workflow_id === "wf_comprehensive_ems_fusion");

  const steps = isFusion ? [
    {
      id: "Step 1: Auth & Ingest Verification",
      mode: "SUB-WORKFLOW",
      modeClass: "cache",
      type: "execute_sub_workflow (wf_auth_nexacro_global)",
      endpoint: "In-Memory TTLCache (:8000)",
      status: "SUCCESS",
      desc: "Validated Nexacro session JSESSIONID. Hit cache = 0ms network latency."
    },
    {
      id: "Step 2: Common Code Dictionaries",
      mode: "BATCH MODE",
      modeClass: "batch",
      type: "http_request (Single HTTP POST)",
      endpoint: "POST /retComCodeList.lgdn",
      status: "SUCCESS",
      desc: "Batch compiled CATEGORY, STATUS, and PO_TYPE code mappings for client session."
    },
    {
      id: "Step 3: Stock Status & Balances",
      mode: "BATCH MODE",
      modeClass: "batch",
      type: "http_request (Single HTTP POST)",
      endpoint: "POST /RetStockStatusList.lgdn",
      status: "SUCCESS",
      desc: "Batch fetched 38 columns (Onhand, Available, Allocated, Dept, Planner) for all items in 1 HTTP payload."
    },
    {
      id: "Step 4: Target Stock Optimization Flags",
      mode: "BATCH MODE",
      modeClass: "batch",
      type: "http_request (Single HTTP POST)",
      endpoint: "POST /GetOptimizeInfo.lgdn",
      status: "SUCCESS",
      desc: "Batch verified target stock optimization activation flags and apply dates."
    },
    {
      id: "Step 5: Target Stock 93 Indicators",
      mode: "BATCH MODE",
      modeClass: "batch",
      type: "http_request (Single HTTP POST)",
      endpoint: "POST /TargetStockSearchList.lgdn",
      status: "SUCCESS",
      desc: "Batch queried 93 granular supply chain metrics (Logic BM Qty, Safety Stock, Due Days, Lead Time)."
    },
    {
      id: "Step 6: Item Popup Master Records",
      mode: "LOOP CONCURRENCY (SEMAPHORE=5)",
      modeClass: "loop",
      type: "http_request (Concurrent loop bounded by Semaphore)",
      endpoint: "POST /retrieveItem.lgdn",
      status: "SUCCESS",
      desc: "Dispatched concurrent HTTP POSTs bounded by asyncio.Semaphore(5) for Item Specs, FDM CAD URLs, and Maker Parts."
    },
    {
      id: "Step 7: Item Technical Specs & MTBF",
      mode: "LOOP CONCURRENCY (SEMAPHORE=5)",
      modeClass: "loop",
      type: "http_request (Concurrent loop bounded by Semaphore)",
      endpoint: "POST /retrieveItemInfoDetail.lgdn",
      status: "SUCCESS",
      desc: "Dispatched concurrent HTTP POSTs bounded by asyncio.Semaphore(5) extracting MTBF days, failure rates, and material specs."
    },
    {
      id: "Step 8: 360-Degree Data Fusion",
      mode: "JSONATA DATA FUSION",
      modeClass: "fusion",
      type: "transform_jsonata (In-Memory Fusion)",
      endpoint: "DataContext Central Bus",
      status: "SUCCESS",
      desc: "Fused 6 API datasets into unified Spare Part 360 Master Record with 6 core domain pillars."
    }
  ] : [
    {
      id: "Step 1: Global Router & Auth Sub-Workflow",
      mode: "SUB-WORKFLOW",
      modeClass: "cache",
      type: "execute_sub_workflow",
      endpoint: "In-Memory TTLCache",
      status: "SUCCESS",
      desc: "Session verified via TTLCache (3600s)"
    },
    {
      id: "Step 2: Dynamic Payload Builder",
      mode: "BATCH MODE",
      modeClass: "batch",
      type: "jinja2_template",
      endpoint: "app/templates/*.xml.j2",
      status: "SUCCESS",
      desc: "Compiled Nexacro XML request body"
    },
    {
      id: "Step 3: Async HTTP Adapter Layer",
      mode: "HTTP ADAPTER",
      modeClass: "batch",
      type: "httpx_post",
      endpoint: "Legacy Nexacro (:9000)",
      status: "SUCCESS",
      desc: `Dispatched to legacy Nexacro, latency: ${result.execution_time_ms || 235}ms`
    },
    {
      id: "Step 4: Response Parser & Flattener",
      mode: "XML PARSER",
      modeClass: "fusion",
      type: "nexacro_parser",
      endpoint: "raw_flattened",
      status: "SUCCESS",
      desc: `Unpacked <Dataset> into ${Array.isArray(result.data) ? result.data.length : 1} raw objects`
    },
    {
      id: "Step 5: Status Matrix & Enrichment",
      mode: "JSONATA FUSION",
      modeClass: "fusion",
      type: "transform_jsonata",
      endpoint: "DataContext",
      status: "SUCCESS",
      desc: "Evaluated Status Logic Matrix & translated domain codes via $globals.dict"
    }
  ];

  steps.forEach(s => {
    const div = document.createElement("div");
    div.className = "step-item open";
    div.innerHTML = `
      <div class="step-header">
        <div class="step-info">
          <span style="color: var(--color-emerald); font-weight: bold;">✔</span>
          <span style="font-weight: 600; font-size: 0.85rem;">${s.id}</span>
          <span class="mode-pill ${s.modeClass}">${s.mode}</span>
          <span style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--color-cyan); background: rgba(6,182,212,0.1); padding: 2px 6px; border-radius: 4px;">${s.endpoint}</span>
        </div>
        <span style="font-size: 0.75rem; color: var(--text-dim);">${s.desc}</span>
      </div>
    `;
    container.appendChild(div);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

