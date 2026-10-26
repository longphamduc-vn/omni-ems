/**
 * Analyzed API Catalog for Mock Server
 * Loads the 50 analyzed endpoints and production response datasets from ems-api-analyzer
 */
const fs = require('fs');
const path = require('path');

const CANDIDATE_PATHS = [
  path.join(__dirname, '..', '..', 'ems-api-analyzer', 'data', 'analyzed_apis.json'),
  path.join(__dirname, '..', 'data', 'analyzed_apis.json'),
  path.join(__dirname, 'analyzed_apis.json')
];

let catalogData = null;
let endpointMap = new Map();

function normalizePath(p) {
  if (!p) return '';
  let clean = p.trim();
  if (clean.includes('://')) {
    try {
      const u = new URL(clean);
      clean = u.pathname;
    } catch (e) {
      clean = clean.split('://')[1].substring(clean.split('://')[1].indexOf('/'));
    }
  }
  return clean.replace(/^\/+/, '').replace(/\/+$/, '');
}

function loadCatalog() {
  if (catalogData) return endpointMap;

  let filePath = CANDIDATE_PATHS.find(p => fs.existsSync(p));
  if (!filePath) {
    console.warn('[Catalog] Warning: analyzed_apis.json not found in candidate paths.');
    return endpointMap;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    catalogData = JSON.parse(raw);
    const endpoints = catalogData.endpoints || [];

    for (const ep of endpoints) {
      const normPath = normalizePath(ep.path);
      const sampleRes = ep.sample_response || {};
      const rawDatasets = sampleRes.datasets || {};
      const formattedDatasets = {};

      for (const [dsName, dsInfo] of Object.entries(rawDatasets)) {
        const cols = dsInfo.cols || [];
        const rows = dsInfo.rows || [];
        formattedDatasets[dsName] = rows.map(r => {
          if (Array.isArray(r)) {
            const rowObj = {};
            cols.forEach((col, idx) => {
              rowObj[col] = r[idx] !== undefined && r[idx] !== null ? String(r[idx]) : '';
            });
            return rowObj;
          }
          return r;
        });
      }

      const entry = {
        id: ep.id,
        path: ep.path,
        url: ep.url,
        action: ep.action,
        category: ep.category,
        programIds: ep.program_ids || [],
        totalCalls: ep.total_calls || 0,
        requestDatasetsSchema: ep.request_datasets || {},
        responseDatasetsSchema: ep.response_datasets || {},
        parameters: sampleRes.params || { errorCode: '1', errorMsg: '' },
        datasets: formattedDatasets
      };

      endpointMap.set(normPath, entry);
      if (ep.action) {
        endpointMap.set(`action:${ep.action}`, entry);
      }
    }

    console.log(`[Catalog] Loaded ${endpointMap.size / 2} endpoints from ${path.basename(filePath)}`);
  } catch (err) {
    console.error('[Catalog] Error loading analyzed_apis.json:', err.message);
  }

  return endpointMap;
}

// Initial load
loadCatalog();

function getEndpoint(routePath) {
  const norm = normalizePath(routePath);
  return endpointMap.get(norm) || endpointMap.get(`action:${norm.split('/').pop().replace(/\.(lgdn|document)$/, '')}`);
}

function getAllEndpoints() {
  const seen = new Set();
  const list = [];
  for (const [key, ep] of endpointMap.entries()) {
    if (!key.startsWith('action:') && !seen.has(ep.id)) {
      seen.add(ep.id);
      list.push(ep);
    }
  }
  return list;
}

module.exports = {
  loadCatalog,
  getEndpoint,
  getAllEndpoints,
  normalizePath
};
