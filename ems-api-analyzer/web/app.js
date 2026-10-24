/**
 * EMS API Studio & Analyzer - Interactive Frontend Application
 */

(function () {
  'use strict';

  // State
  let state = {
    data: null,
    currentView: 'dashboard',
    searchQuery: '',
    selectedModule: 'ALL',
    selectedCategory: 'ALL',
    selectedProgram: 'ALL',
    sortBy: 'calls-desc',
    activeModalEndpoint: null,
    activeCodeLang: 'curl',
    activeSessionIdx: 2
  };

  // DOM Elements
  const el = {
    globalSearchInput: document.getElementById('globalSearchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    reanalyzeBtn: document.getElementById('reanalyzeBtn'),
    exportDropdownBtn: document.getElementById('exportDropdownBtn'),
    exportMenu: document.getElementById('exportMenu'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),

    // Nav
    navItems: document.querySelectorAll('.nav-item'),
    viewPanels: document.querySelectorAll('.view-panel'),
    badgeTotalEndpoints: document.getElementById('badgeTotalEndpoints'),
    badgeTotalFlows: document.getElementById('badgeTotalFlows'),
    badgeTotalDatasets: document.getElementById('badgeTotalDatasets'),
    headerCallCount: document.getElementById('headerCallCount'),

    // Sidebar Filters
    moduleFilterChips: document.getElementById('moduleFilterChips'),
    categoryFilterChips: document.getElementById('categoryFilterChips'),
    programBadgesList: document.getElementById('programBadgesList'),

    // Dashboard
    kpiEndpoints: document.getElementById('kpiEndpoints'),
    kpiCalls: document.getElementById('kpiCalls'),
    kpiDatasets: document.getElementById('kpiDatasets'),
    kpiLatency: document.getElementById('kpiLatency'),
    moduleBarList: document.getElementById('moduleBarList'),
    categoryDistributionList: document.getElementById('categoryDistributionList'),
    topEndpointsTbody: document.getElementById('topEndpointsTbody'),
    viewAllEndpointsFromDashBtn: document.getElementById('viewAllEndpointsFromDashBtn'),

    // Explorer
    moduleSelectFilter: document.getElementById('moduleSelectFilter'),
    categorySelectFilter: document.getElementById('categorySelectFilter'),
    sortBySelect: document.getElementById('sortBySelect'),
    resultsCount: document.getElementById('resultsCount'),
    totalCount: document.getElementById('totalCount'),
    activeFilterTags: document.getElementById('activeFilterTags'),
    endpointsGrid: document.getElementById('endpointsGrid'),

    // Flows
    sessionsList: document.getElementById('sessionsList'),
    sessionWaterfallPane: document.getElementById('sessionWaterfallPane'),
    emptySessionState: document.getElementById('emptySessionState'),
    waterfallContent: document.getElementById('waterfallContent'),

    // Datasets
    datasetSearchInput: document.getElementById('datasetSearchInput'),
    datasetsGrid: document.getElementById('datasetsGrid'),

    // Modal
    endpointModalBackdrop: document.getElementById('endpointModalBackdrop'),
    endpointModalDrawer: document.getElementById('endpointModalDrawer'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalMethodBadge: document.getElementById('modalMethodBadge'),
    modalCategoryBadge: document.getElementById('modalCategoryBadge'),
    modalProgramBadge: document.getElementById('modalProgramBadge'),
    modalEndpointTitle: document.getElementById('modalEndpointTitle'),
    modalUrlCode: document.getElementById('modalUrlCode'),
    modalCallCount: document.getElementById('modalCallCount'),
    modalAvgDuration: document.getElementById('modalAvgDuration'),
    modalModule: document.getElementById('modalModule'),
    modalController: document.getElementById('modalController'),
    copyUrlBtn: document.getElementById('copyUrlBtn'),
    copyCurlBtn: document.getElementById('copyCurlBtn'),
    modalTabs: document.querySelectorAll('.modal-tab'),
    modalTabPanes: document.querySelectorAll('.tab-pane'),
    modalReqParamsContainer: document.getElementById('modalReqParamsContainer'),
    modalReqDatasetsContainer: document.getElementById('modalReqDatasetsContainer'),
    modalResParamsContainer: document.getElementById('modalResParamsContainer'),
    modalResDatasetsContainer: document.getElementById('modalResDatasetsContainer'),
    codeTabBtns: document.querySelectorAll('.code-tab-btn'),
    modalCodeSnippet: document.getElementById('modalCodeSnippet'),
    copyCodeSnippetBtn: document.getElementById('copyCodeSnippetBtn'),
    modalRawJson: document.getElementById('modalRawJson'),

    // Toast
    toastContainer: document.getElementById('toastContainer')
  };

  // Initialize
  async function init() {
    setupEventListeners();
    setupTheme();
    await loadData();
  }

  // Load Data from API
  async function loadData() {
    try {
      showToast('Đang tải dữ liệu phân tích...');
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Không thể tải /api/data');
      state.data = await res.json();
      renderAll();
      showToast('Đã tải thành công 50 Endpoints EMS!');
    } catch (err) {
      console.warn('Không tải được qua /api/data, thử đọc data/analyzed_apis.json...', err);
      try {
        const res = await fetch('../data/analyzed_apis.json');
        state.data = await res.json();
        renderAll();
      } catch (e2) {
        showToast('Lỗi tải dữ liệu. Vui lòng đảm bảo server.py đang chạy.', 'error');
      }
    }
  }

  // Render All Views
  function renderAll() {
    if (!state.data) return;

    renderHeaderStats();
    renderSidebarFilters();
    renderDashboard();
    renderEndpointsExplorer();
    renderFlowSessions();
    renderDatasets();
  }

  // Header & Badges
  function renderHeaderStats() {
    const meta = state.data.metadata;
    el.badgeTotalEndpoints.textContent = meta.total_unique_endpoints;
    el.badgeTotalFlows.textContent = meta.total_notes_scanned;
    el.badgeTotalDatasets.textContent = meta.total_unique_datasets;
    el.headerCallCount.textContent = `${meta.total_api_calls_recorded} calls`;
  }

  // Sidebar Filters Render
  function renderSidebarFilters() {
    // Module chips
    const modules = state.data.groups.by_module;
    let modHtml = `<button class="chip ${state.selectedModule === 'ALL' ? 'active' : ''}" data-module="ALL">
      <span>Tất cả phân hệ</span>
      <strong>${state.data.endpoints.length}</strong>
    </button>`;

    for (const [mod, count] of Object.entries(modules)) {
      modHtml += `<button class="chip ${state.selectedModule === mod ? 'active' : ''}" data-module="${mod}">
        <span>${mod}</span>
        <strong>${count}</strong>
      </button>`;
    }
    el.moduleFilterChips.innerHTML = modHtml;

    // Module dropdown in Explorer view
    let selectHtml = `<option value="ALL">Tất cả phân hệ (${state.data.endpoints.length})</option>`;
    for (const [mod, count] of Object.entries(modules)) {
      selectHtml += `<option value="${mod}">${mod} (${count})</option>`;
    }
    el.moduleSelectFilter.innerHTML = selectHtml;
    el.moduleSelectFilter.value = state.selectedModule;

    // Program IDs badges list
    const programs = state.data.groups.by_program;
    let progHtml = '';
    const sortedProgs = Object.entries(programs).sort((a, b) => b[1] - a[1]);
    for (const [prog, count] of sortedProgs) {
      progHtml += `<span class="program-badge ${state.selectedProgram === prog ? 'active' : ''}" data-program="${prog}">
        ${prog} <small>(${count})</small>
      </span>`;
    }
    el.programBadgesList.innerHTML = progHtml;
  }

  // Dashboard View
  function renderDashboard() {
    const meta = state.data.metadata;
    el.kpiEndpoints.textContent = meta.total_unique_endpoints;
    el.kpiCalls.textContent = meta.total_api_calls_recorded;
    el.kpiDatasets.textContent = meta.total_unique_datasets;
    el.kpiLatency.innerHTML = `${meta.overall_avg_duration_ms} <small>ms</small>`;

    // Module bar distribution
    const modules = state.data.groups.by_module;
    const maxMod = Math.max(...Object.values(modules));
    const colors = {
      emsspareparts: 'linear-gradient(90deg, #06b6d4, #3b82f6)',
      emscom: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
      emsworkorder: 'linear-gradient(90deg, #10b981, #059669)',
      Servlet: 'linear-gradient(90deg, #f59e0b, #d97706)'
    };

    let barHtml = '';
    for (const [mod, count] of Object.entries(modules)) {
      const pct = Math.round((count / maxMod) * 100);
      barHtml += `
        <div class="module-bar-item" data-module="${mod}" style="cursor: pointer;">
          <div class="bar-header">
            <span>${mod}</span>
            <span style="color: var(--text-muted);">${count} endpoints (${Math.round((count / meta.total_unique_endpoints) * 100)}%)</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%; background: ${colors[mod] || 'var(--accent-blue)'};"></div>
          </div>
        </div>
      `;
    }
    el.moduleBarList.innerHTML = barHtml;

    // Attach click to filter from bar
    el.moduleBarList.querySelectorAll('.module-bar-item').forEach(item => {
      item.addEventListener('click', () => {
        state.selectedModule = item.dataset.module;
        switchView('endpoints');
      });
    });

    // Category distribution
    const categories = state.data.groups.by_category;
    let catHtml = '';
    for (const [cat, count] of Object.entries(categories)) {
      catHtml += `
        <div class="meta-pill" style="margin-bottom: 0.5rem; justify-content: space-between; padding: 0.6rem 0.85rem; cursor: pointer;" data-category="${cat}">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="cat-badge cat-${cat.toLowerCase()}">${cat}</span>
            <span>${getCategoryDesc(cat)}</span>
          </div>
          <strong>${count} endpoints</strong>
        </div>
      `;
    }
    el.categoryDistributionList.innerHTML = catHtml;
    el.categoryDistributionList.querySelectorAll('[data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedCategory = btn.dataset.category;
        switchView('endpoints');
      });
    });

    // Top endpoints table
    const top10 = state.data.endpoints.slice(0, 8);
    let tbodyHtml = '';
    for (const ep of top10) {
      tbodyHtml += `
        <tr>
          <td><span class="method-badge method-${ep.method.toLowerCase()}">${ep.method}</span></td>
          <td>
            <div style="font-weight: 700;">${ep.action}</div>
            <code style="font-size: 0.75rem; color: var(--text-muted);">${ep.path}</code>
          </td>
          <td><span class="tag-badge">${ep.module}</span></td>
          <td><span class="cat-badge cat-${ep.category.toLowerCase()}">${ep.category}</span></td>
          <td><strong style="color: var(--accent-purple);">${ep.total_calls} calls</strong></td>
          <td><span style="font-family: var(--font-mono); color: var(--accent-amber);">${ep.avg_duration_ms} ms</span></td>
          <td>
            <button class="btn btn-sm btn-ghost inspect-endpoint-btn" data-id="${ep.id}">Chi tiết</button>
          </td>
        </tr>
      `;
    }
    el.topEndpointsTbody.innerHTML = tbodyHtml;

    // Click handler for table inspect buttons
    el.topEndpointsTbody.querySelectorAll('.inspect-endpoint-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openEndpointModal(btn.dataset.id);
      });
    });
  }

  // Endpoints Explorer View
  function renderEndpointsExplorer() {
    const filtered = getFilteredEndpoints();
    el.resultsCount.textContent = filtered.length;
    el.totalCount.textContent = state.data.endpoints.length;

    // Render active filter tags
    let tagsHtml = '';
    if (state.selectedModule !== 'ALL') {
      tagsHtml += `<span class="tag-badge" style="cursor:pointer;" id="tagClearModule">Phân hệ: ${state.selectedModule} ✕</span>`;
    }
    if (state.selectedCategory !== 'ALL') {
      tagsHtml += `<span class="tag-badge" style="cursor:pointer;" id="tagClearCategory">Nghiệp vụ: ${state.selectedCategory} ✕</span>`;
    }
    if (state.selectedProgram !== 'ALL') {
      tagsHtml += `<span class="tag-badge" style="cursor:pointer;" id="tagClearProgram">Program: ${state.selectedProgram} ✕</span>`;
    }
    if (state.searchQuery) {
      tagsHtml += `<span class="tag-badge" style="cursor:pointer;" id="tagClearSearch">Từ khóa: "${state.searchQuery}" ✕</span>`;
    }
    el.activeFilterTags.innerHTML = tagsHtml;

    // Wire up tag clear clicks
    if (document.getElementById('tagClearModule')) {
      document.getElementById('tagClearModule').onclick = () => { state.selectedModule = 'ALL'; renderAll(); };
    }
    if (document.getElementById('tagClearCategory')) {
      document.getElementById('tagClearCategory').onclick = () => { state.selectedCategory = 'ALL'; renderAll(); };
    }
    if (document.getElementById('tagClearProgram')) {
      document.getElementById('tagClearProgram').onclick = () => { state.selectedProgram = 'ALL'; renderAll(); };
    }
    if (document.getElementById('tagClearSearch')) {
      document.getElementById('tagClearSearch').onclick = () => { state.searchQuery = ''; el.globalSearchInput.value = ''; renderAll(); };
    }

    if (filtered.length === 0) {
      el.endpointsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 3rem; text-align: center;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
          <h3>Không tìm thấy Endpoint nào phù hợp</h3>
          <p style="color: var(--text-muted); margin-top: 0.25rem;">Thử xóa bộ lọc hoặc tìm kiếm bằng từ khóa khác.</p>
        </div>
      `;
      return;
    }

    let cardsHtml = '';
    for (const ep of filtered) {
      const reqDsKeys = Object.keys(ep.request_datasets);
      const resDsKeys = Object.keys(ep.response_datasets);
      const reqParamCount = Object.keys(ep.request_params).length;

      cardsHtml += `
        <div class="endpoint-card" data-id="${ep.id}">
          <div class="card-top">
            <div class="card-tags">
              <span class="method-badge method-${ep.method.toLowerCase()}">${ep.method}</span>
              <span class="cat-badge cat-${ep.category.toLowerCase()}">${ep.category}</span>
              ${ep.program_ids.length > 0 ? `<span class="card-program-tag">${ep.program_ids[0]}</span>` : ''}
            </div>
            <span class="card-calls-badge">${ep.total_calls} calls</span>
          </div>

          <div class="card-path-box">
            <div class="card-action-title">${ep.action}</div>
            <div class="card-url-sub">${ep.path}</div>
          </div>

          <div class="card-meta-pills">
            <div class="meta-pill" title="Thời gian phản hồi trung bình">
              <span>⏱️</span>
              <strong>${ep.avg_duration_ms} ms</strong>
            </div>
            <div class="meta-pill" title="Số lượng tham số request">
              <span>🔑</span>
              <strong>${reqParamCount} params</strong>
            </div>
            <div class="meta-pill" title="Số bảng dataset gửi lên / trả về">
              <span>📦</span>
              <strong>In: ${reqDsKeys.length} | Out: ${resDsKeys.length}</strong>
            </div>
            ${resDsKeys.length > 0 ? `<div class="meta-pill" title="Datasets chính">${resDsKeys.slice(0, 2).join(', ')}</div>` : ''}
          </div>

          <div class="card-footer-action">
            <span class="footer-module-tag">📁 ${ep.module} / ${ep.submodule || ep.controller || ''}</span>
            <button class="btn-inspect">Xem chi tiết specs →</button>
          </div>
        </div>
      `;
    }
    el.endpointsGrid.innerHTML = cardsHtml;

    // Card click events
    el.endpointsGrid.querySelectorAll('.endpoint-card').forEach(card => {
      card.addEventListener('click', () => {
        openEndpointModal(card.dataset.id);
      });
    });
  }

  // Filter endpoints logic
  function getFilteredEndpoints() {
    let list = [...state.data.endpoints];

    // Filter Module
    if (state.selectedModule !== 'ALL') {
      list = list.filter(ep => ep.module === state.selectedModule);
    }

    // Filter Category
    if (state.selectedCategory !== 'ALL') {
      list = list.filter(ep => ep.category === state.selectedCategory);
    }

    // Filter Program
    if (state.selectedProgram !== 'ALL') {
      list = list.filter(ep => ep.program_ids.includes(state.selectedProgram));
    }

    // Filter Search Query
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      list = list.filter(ep => {
        return ep.path.toLowerCase().includes(q) ||
               ep.action.toLowerCase().includes(q) ||
               ep.module.toLowerCase().includes(q) ||
               ep.program_ids.some(p => p.toLowerCase().includes(q)) ||
               Object.keys(ep.request_params).some(k => k.toLowerCase().includes(q)) ||
               Object.keys(ep.request_datasets).some(k => k.toLowerCase().includes(q)) ||
               Object.keys(ep.response_datasets).some(k => k.toLowerCase().includes(q));
      });
    }

    // Sorting
    if (state.sortBy === 'calls-desc') {
      list.sort((a, b) => b.total_calls - a.total_calls);
    } else if (state.sortBy === 'latency-desc') {
      list.sort((a, b) => b.avg_duration_ms - a.avg_duration_ms);
    } else if (state.sortBy === 'latency-asc') {
      list.sort((a, b) => a.avg_duration_ms - b.avg_duration_ms);
    } else if (state.sortBy === 'name-asc') {
      list.sort((a, b) => a.action.localeCompare(b.action));
    }

    return list;
  }

  // Render Workflow Flow Traces
  function renderFlowSessions() {
    const sessions = state.data.flow_sessions;
    let listHtml = '';
    for (const session of sessions) {
      const isSelected = session.note_index === state.activeSessionIdx;
      listHtml += `
        <div class="session-item ${isSelected ? 'active' : ''}" data-index="${session.note_index}">
          <div class="session-top">
            <span class="session-title">Session #${session.note_index}</span>
            <span class="session-call-count">${session.total_calls} APIs</span>
          </div>
          <div class="session-time">⏱️ ${session.total_duration_ms} ms tổng cộng</div>
        </div>
      `;
    }
    el.sessionsList.innerHTML = listHtml;

    // Attach click
    el.sessionsList.querySelectorAll('.session-item').forEach(item => {
      item.addEventListener('click', () => {
        state.activeSessionIdx = parseInt(item.dataset.index, 10);
        renderFlowSessions();
        renderSessionWaterfall(state.activeSessionIdx);
      });
    });

    if (state.activeSessionIdx) {
      renderSessionWaterfall(state.activeSessionIdx);
    }
  }

  // Render Session Waterfall
  function renderSessionWaterfall(noteIndex) {
    const session = state.data.flow_sessions.find(s => s.note_index === noteIndex);
    if (!session || !session.calls || session.calls.length === 0) {
      el.emptySessionState.style.display = 'block';
      el.waterfallContent.style.display = 'none';
      return;
    }

    el.emptySessionState.style.display = 'none';
    el.waterfallContent.style.display = 'block';

    let html = `
      <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem;">
        <div>
          <h3>Chi tiết Chuỗi Thao tác: Session #${session.note_index}</h3>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Ghi nhận ${session.total_calls} cuộc gọi API tuần tự từ client.</p>
        </div>
        <span class="live-status-pill">⏱️ ${session.total_duration_ms} ms</span>
      </div>
      <div class="waterfall-steps-list">
    `;

    session.calls.forEach((c, idx) => {
      const path = c.url.replace(/^http:\/\/[^/]+\//, '');
      const actionName = path.split('/').pop().replace(/\.lgdn$/, '');
      const epMatch = state.data.endpoints.find(e => e.url === c.url);

      html += `
        <div class="waterfall-step">
          <div class="step-num">${idx + 1}</div>
          <div class="step-content">
            <div class="step-top">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="method-badge method-${c.method.toLowerCase()}">${c.method}</span>
                <span class="step-title">${actionName}</span>
                <span class="tag-badge">${c.programId}</span>
              </div>
              <span class="step-latency">${c.durationMs} ms</span>
            </div>
            <div class="step-url">${c.url}</div>

            <div class="step-datasets-pills">
              ${c.request_datasets.map(d => `<span class="step-ds-pill step-ds-in">Req: ${d}</span>`).join('')}
              ${c.response_datasets.map(d => `<span class="step-ds-pill step-ds-out">Res: ${d}</span>`).join('')}
            </div>

            <div style="margin-top: 0.5rem; display: flex; justify-content: flex-end;">
              ${epMatch ? `<button class="btn btn-sm btn-ghost inspect-endpoint-btn" data-id="${epMatch.id}">Xem Specs Endpoint</button>` : ''}
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    el.waterfallContent.innerHTML = html;

    // Wire clicks to open modal
    el.waterfallContent.querySelectorAll('.inspect-endpoint-btn').forEach(btn => {
      btn.addEventListener('click', () => openEndpointModal(btn.dataset.id));
    });
  }

  // Datasets View
  function renderDatasets() {
    const list = state.data.datasets;
    const query = (el.datasetSearchInput ? el.datasetSearchInput.value : '').toLowerCase().trim();

    const filtered = list.filter(ds => {
      if (!query) return true;
      return ds.name.toLowerCase().includes(query) || ds.columns.some(c => c.toLowerCase().includes(query));
    });

    let html = '';
    for (const ds of filtered) {
      const typeClass = ds.type === 'REQUEST' ? 'ds-type-request' : 'ds-type-response';
      html += `
        <div class="dataset-card">
          <div class="dataset-header">
            <span class="dataset-name">${ds.name}</span>
            <span class="dataset-type-badge ${typeClass}">${ds.type}</span>
          </div>

          <div style="font-size: 0.8rem; color: var(--text-muted);">
            Sử dụng trong <strong>${ds.endpoints_count}</strong> endpoints | <strong>${ds.columns_count}</strong> cột dữ liệu
          </div>

          <div class="dataset-cols-preview">
            ${ds.columns.map(c => `<span class="dataset-col-item">${c}</span>`).join('')}
          </div>
        </div>
      `;
    }
    el.datasetsGrid.innerHTML = html;
  }

  // Open Endpoint Modal Drawer
  function openEndpointModal(endpointId) {
    const ep = state.data.endpoints.find(e => e.id === endpointId);
    if (!ep) return;

    state.activeModalEndpoint = ep;

    el.modalMethodBadge.textContent = ep.method;
    el.modalCategoryBadge.textContent = ep.category;
    el.modalCategoryBadge.className = `modal-category-badge cat-badge cat-${ep.category.toLowerCase()}`;
    el.modalProgramBadge.textContent = ep.program_ids.join(', ') || 'COMMON';

    el.modalEndpointTitle.textContent = `${ep.action}.lgdn`;
    el.modalUrlCode.textContent = ep.url;
    el.modalCallCount.textContent = `${ep.total_calls} lần`;
    el.modalAvgDuration.textContent = `${ep.avg_duration_ms} ms (min: ${ep.min_duration_ms}ms, max: ${ep.max_duration_ms}ms)`;
    el.modalModule.textContent = ep.module;
    el.modalController.textContent = ep.submodule || ep.controller || '-';

    // Render Request Params
    renderParamsTable(ep.request_params, el.modalReqParamsContainer);

    // Render Request Datasets
    renderDatasetsPreview(ep.request_datasets, el.modalReqDatasetsContainer);

    // Render Response Params
    renderParamsTable(ep.response_params, el.modalResParamsContainer);

    // Render Response Datasets
    renderDatasetsPreview(ep.response_datasets, el.modalResDatasetsContainer);

    // Render Code Snippet
    renderCodeSnippet(ep, state.activeCodeLang);

    // Render Raw JSON
    el.modalRawJson.textContent = JSON.stringify({
      url: ep.url,
      method: ep.method,
      request: ep.sample_request,
      response: ep.sample_response
    }, null, 2);

    el.endpointModalBackdrop.classList.add('show');
  }

  // Render Parameters Table
  function renderParamsTable(paramsObj, container) {
    const keys = Object.keys(paramsObj);
    if (keys.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0;">Không có tham số param</div>';
      return;
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Tên Tham Số</th>
            <th>Kiểu</th>
            <th>Giá Trị Mẫu Thực Tế</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const [k, meta] of Object.entries(paramsObj)) {
      html += `
        <tr>
          <td><code style="color: var(--accent-cyan); font-weight: 700;">${k}</code></td>
          <td><span class="tag-badge">${meta.type || 'string'}</span></td>
          <td><code style="color: var(--text-secondary);">${meta.sample_value === '' ? "'' (chuỗi rỗng)" : String(meta.sample_value)}</code></td>
        </tr>
      `;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  // Render Datasets Preview Table
  function renderDatasetsPreview(datasetsObj, container) {
    const keys = Object.keys(datasetsObj);
    if (keys.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0;">Không có dataset trao đổi</div>';
      return;
    }

    let html = '';
    for (const [dsName, dsInfo] of Object.entries(datasetsObj)) {
      const cols = dsInfo.cols || [];
      const sampleRow = dsInfo.sample_row || [];

      html += `
        <div style="margin-bottom: 1.25rem; background: var(--bg-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <div>
              <strong style="color: var(--accent-blue); font-family: var(--font-mono); font-size: 0.95rem;">Dataset: ${dsName}</strong>
              <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 0.5rem;">(${cols.length} cột, ${dsInfo.sample_count || 0} dòng mẫu)</span>
            </div>
            <span class="tag-badge">Table Schema</span>
          </div>

          <div class="table-container" style="max-height: 250px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 40px;">#</th>
                  ${cols.map(c => `<th>${c}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="color: var(--text-muted);">1</td>
                  ${cols.map((c, i) => `<td><code>${sampleRow[i] !== undefined ? String(sampleRow[i]) : ''}</code></td>`).join('')}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  // Code Snippet Generator
  function renderCodeSnippet(ep, lang) {
    let code = '';
    const reqBody = ep.sample_request || { params: {}, datasets: {} };

    if (lang === 'curl') {
      code = `curl -X POST "${ep.url}" \\
  -H "Content-Type: application/json; charset=UTF-8" \\
  -H "User-Agent: LG-Display-EMS-Client" \\
  -d '${JSON.stringify(reqBody, null, 2)}'`;
    } else if (lang === 'javascript') {
      code = `// Gọi API EMS ${ep.action} qua Javascript Fetch
const payload = ${JSON.stringify(reqBody, null, 2)};

async function callEmsEndpoint() {
  const response = await fetch("${ep.url}", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  console.log("EMS Result:", data);
  return data;
}

callEmsEndpoint();`;
    } else if (lang === 'python') {
      code = `# Gọi API EMS ${ep.action} bằng Python Requests
import requests
import json

url = "${ep.url}"
payload = ${JSON.stringify(reqBody, null, 2).replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None')}

headers = {
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)
print("Status:", response.status_code)
print("Response:", response.json())`;
    }

    el.modalCodeSnippet.textContent = code;
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Navigation items
    el.navItems.forEach(btn => {
      btn.addEventListener('click', () => {
        switchView(btn.dataset.view);
      });
    });

    // View All button on Dashboard
    el.viewAllEndpointsFromDashBtn.addEventListener('click', () => {
      switchView('endpoints');
    });

    // Global Search
    el.globalSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      el.clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
      renderEndpointsExplorer();
      if (state.currentView !== 'endpoints' && state.searchQuery.trim().length > 1) {
        switchView('endpoints');
      }
    });

    el.clearSearchBtn.addEventListener('click', () => {
      state.searchQuery = '';
      el.globalSearchInput.value = '';
      el.clearSearchBtn.style.display = 'none';
      renderEndpointsExplorer();
    });

    // Keyboard shortcut Ctrl + K
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        el.globalSearchInput.focus();
      }
      if (e.key === 'Escape') {
        closeEndpointModal();
      }
    });

    // Sidebar Module Filter chips
    el.moduleFilterChips.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-module]');
      if (!chip) return;
      state.selectedModule = chip.dataset.module;
      renderAll();
      switchView('endpoints');
    });

    // Sidebar Category Filter chips
    el.categoryFilterChips.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-category]');
      if (!chip) return;
      const cat = chip.dataset.category;
      state.selectedCategory = state.selectedCategory === cat ? 'ALL' : cat;
      chip.classList.toggle('active', state.selectedCategory === cat);
      renderEndpointsExplorer();
      switchView('endpoints');
    });

    // Sidebar Program Badges
    el.programBadgesList.addEventListener('click', (e) => {
      const badge = e.target.closest('[data-program]');
      if (!badge) return;
      const prog = badge.dataset.program;
      state.selectedProgram = state.selectedProgram === prog ? 'ALL' : prog;
      renderAll();
      switchView('endpoints');
    });

    // Explorer Select Filters
    el.moduleSelectFilter.addEventListener('change', (e) => {
      state.selectedModule = e.target.value;
      renderAll();
    });

    el.categorySelectFilter.addEventListener('change', (e) => {
      state.selectedCategory = e.target.value;
      renderEndpointsExplorer();
    });

    el.sortBySelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderEndpointsExplorer();
    });

    // Dataset Search
    if (el.datasetSearchInput) {
      el.datasetSearchInput.addEventListener('input', () => {
        renderDatasets();
      });
    }

    // Modal Close
    el.modalCloseBtn.addEventListener('click', closeEndpointModal);
    el.endpointModalBackdrop.addEventListener('click', (e) => {
      if (e.target === el.endpointModalBackdrop) {
        closeEndpointModal();
      }
    });

    // Modal Tabs
    el.modalTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        el.modalTabs.forEach(t => t.classList.remove('active'));
        el.modalTabPanes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });

    // Code Language Tabs
    el.codeTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        el.codeTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeCodeLang = btn.dataset.lang;
        if (state.activeModalEndpoint) {
          renderCodeSnippet(state.activeModalEndpoint, state.activeCodeLang);
        }
      });
    });

    // Copy Code Snippet
    el.copyCodeSnippetBtn.addEventListener('click', () => {
      copyToClipboard(el.modalCodeSnippet.textContent, 'Đã sao chép mã code vào Clipboard!');
    });

    // Copy URL
    el.copyUrlBtn.addEventListener('click', () => {
      if (state.activeModalEndpoint) {
        copyToClipboard(state.activeModalEndpoint.url, 'Đã sao chép URL vào Clipboard!');
      }
    });

    // Copy cURL
    el.copyCurlBtn.addEventListener('click', () => {
      if (state.activeModalEndpoint) {
        const reqBody = state.activeModalEndpoint.sample_request || {};
        const curl = `curl -X POST "${state.activeModalEndpoint.url}" -H "Content-Type: application/json" -d '${JSON.stringify(reqBody)}'`;
        copyToClipboard(curl, 'Đã sao chép lệnh cURL!');
      }
    });

    // Re-analyze Button
    el.reanalyzeBtn.addEventListener('click', async () => {
      try {
        el.reanalyzeBtn.disabled = true;
        el.reanalyzeBtn.innerHTML = '<span class="pulse-dot"></span> Đang phân tích A1.txt...';
        showToast('Đang đọc lại và phân tích file A1.txt...');

        const res = await fetch('/api/reanalyze', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
          state.data = result.data;
          renderAll();
          showToast('Phân tích thành công file A1.txt!');
        } else {
          showToast(`Lỗi phân tích: ${result.error}`, 'error');
        }
      } catch (err) {
        showToast(`Lỗi kết nối server: ${err.message}`, 'error');
      } finally {
        el.reanalyzeBtn.disabled = false;
        el.reanalyzeBtn.innerHTML = '<span class="btn-icon">🔄</span><span class="btn-text">Phân tích lại A1.txt</span>';
      }
    });

    // Export Dropdown Toggle
    el.exportDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      el.exportMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      el.exportMenu.classList.remove('show');
    });
  }

  // Switch Active View
  function switchView(viewName) {
    state.currentView = viewName;
    el.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    el.viewPanels.forEach(panel => {
      panel.classList.remove('active');
    });

    const targetPanel = document.getElementById(`view${capitalize(viewName)}`);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }
  }

  // Close Modal
  function closeEndpointModal() {
    el.endpointModalBackdrop.classList.remove('show');
    state.activeModalEndpoint = null;
  }

  // Copy to clipboard helper
  function copyToClipboard(text, successMessage) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMessage);
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(successMessage);
    }
  }

  // Toast Notification
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'error' ? '❌' : '✅';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Theme Management
  function setupTheme() {
    const savedTheme = localStorage.getItem('ems-theme') || 'dark';
    document.body.className = `theme-${savedTheme}`;
    updateThemeIcon(savedTheme);

    el.themeToggleBtn.addEventListener('click', () => {
      const isDark = document.body.classList.contains('theme-dark');
      const newTheme = isDark ? 'light' : 'dark';
      document.body.className = `theme-${newTheme}`;
      localStorage.setItem('ems-theme', newTheme);
      updateThemeIcon(newTheme);
    });
  }

  function updateThemeIcon(theme) {
    el.themeToggleBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
  }

  // Helpers
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function getCategoryDesc(cat) {
    switch (cat) {
      case 'QUERY': return 'Lấy dữ liệu danh sách, cờ flag, thông tin';
      case 'MUTATE': return 'Tạo mới, chỉnh sửa trạng thái dữ liệu';
      case 'SECURITY': return 'Kiểm tra phân quyền, button, phê duyệt';
      case 'LOGGING': return 'Ghi nhận bắt đầu/kết thúc phiên kết nối';
      default: return 'Khác';
    }
  }

  // Run App
  window.addEventListener('DOMContentLoaded', init);
})();
