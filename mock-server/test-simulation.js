/**
 * Comprehensive Automated Test Suite for Omni-EMS Mock Server
 * Verifies Core Data Retrieval, Mutation PRV, Security, Work Order, and Catalog Dispatcher
 * Synchronized with 50 analyzed endpoints from ems-api-analyzer
 */
const http = require('http');

const PORT = process.env.PORT || 9000;
const HOST = '127.0.0.1';

const tests = [
  {
    name: '[1/16] Spare Parts: Stock Status Search (QCAD57452 & QCAK93067)',
    path: '/emsspareparts/sp101/sp110Nav/RetStockStatusList.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_ItemInfo"><ColumnInfo><Column id="item" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="item">QCAD57452</Col></Row><Row><Col id="item">QCAK93067</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_result') && xml.includes('QCAD57452') && xml.includes('QCAK93067')
  },
  {
    name: '[2/16] Spare Parts: Estimate Requests (RFQ)',
    path: '/emsspareparts/sp101/sp120Nav/RetEstimateRequestList.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_ItemInfo"><ColumnInfo><Column id="item" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="item">QCAD57452</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_list') && xml.includes('Q2610-3091080')
  },
  {
    name: '[3/16] Spare Parts: Item Detail Info (MTBF & Inventory)',
    path: '/emsspareparts/sp102/sp135Nav/retrieveItemInfoDetail.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_Input"><ColumnInfo><Column id="inventoryItemId" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="inventoryItemId">1934887</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_Item') && xml.includes('ds_Inv')
  },
  {
    name: '[4/16] Spare Parts: Target Stock Optimization (93 Indicators)',
    path: '/emsspareparts/sp302/sp335Nav/TargetStockSearchList.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_ItemInfo"><ColumnInfo><Column id="item" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="item">QCAD57452</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_StockInfomation') && xml.includes('OPTIMIZATION_NON_PERIOD')
  },
  {
    name: '[5/16] Spare Parts: Optimization Info (GetOptimizeInfo)',
    path: '/emsspareparts/sp302/sp330Nav/GetOptimizeInfo.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_search"><ColumnInfo><Column id="organizationId" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="organizationId">28753</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_rtn') && xml.includes('optimizeFlag')
  },
  {
    name: '[6/16] Popups: Item Master Search (retrieveItem with FDM CAD)',
    path: '/emscom/popupNav/retrieveItem.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_Search"><ColumnInfo><Column id="item" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="item">QCAC23840</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_List') && xml.includes('QCAC23840') && xml.includes('Windchill')
  },
  {
    name: '[7/16] Popups: Item PO Status Tracking',
    path: '/emscom/popupNav/retrieveItemPoStatusList.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_Search"><ColumnInfo><Column id="item" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="item">QCAD57452</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_Rtn') && xml.includes('PO-2026-4412')
  },
  {
    name: '[8/16] Common: Common Code Dictionary (retComCodeList)',
    path: '/emscom/codeNav/retComCodeList.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Parameters><Parameter id="statementName">retrieveItemType:retrieveEstimateStatus:</Parameter></Parameters></Root>`,
    check: (xml) => xml.includes('ds_output0') && xml.includes('ds_output1')
  },
  {
    name: '[9/16] Work Order: Factory List (retFactoryList)',
    path: '/emswonew/wn90/wn900Nav/retFactoryList.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Parameters><Parameter id="_ems_organizationId">28753</Parameter></Parameters></Root>`,
    check: (xml) => xml.includes('ds_cbo_factory') && xml.includes('HW')
  },
  {
    name: '[10/16] MUTATE: Purchase Request Creation (CreInsertItemPrvRequest)',
    path: '/emsspareparts/sp101/sp110Nav/CreInsertItemPrvRequest.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_search"><ColumnInfo><Column id="txnGroupId" type="STRING" size="256"/><Column id="inventoryItemId" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="txnGroupId">421996047</Col><Col id="inventoryItemId">3890752</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_list') && xml.includes('OK')
  },
  {
    name: '[11/16] Operational Checks: Repair Interlock & EC Flag',
    path: '/emsspareparts/sp102/sp131Nav/retWaitRepairItemInterlock.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_search"><ColumnInfo><Column id="item" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="item">QCAK93067</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_result') && xml.includes('applyFlag')
  },
  {
    name: '[12/16] Work Orders: WO Save Init (WO230WoSaveInit)',
    path: '/emsworkorder/wo20/wo230Nav/WO230WoSaveInit.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_info"><ColumnInfo><Column id="wipEntityId" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="wipEntityId">314805734</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_init') && xml.includes('ds_oplist') && xml.includes('ds_mtlist')
  },
  {
    name: '[13/16] Work Orders: Status History (statusHistory)',
    path: '/emsworkorder/wo50/wo580Nav/statusHistory.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_info"><ColumnInfo><Column id="wipEntityId" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="wipEntityId">314805734</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_list') && xml.includes('PR Return')
  },
  {
    name: '[14/16] Security & Governance: Master Auth & Priv Flag Check',
    path: '/emsspareparts/sp302/sp330Nav/CheckMasterAuth.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_search"><ColumnInfo><Column id="userId" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="userId">658359</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_auth') && xml.includes('masterYn')
  },
  {
    name: '[15/16] Universal Catalog Dispatcher: Realtime Status & Lowest EmNo',
    path: '/emsspareparts/sp201/sp220Nav/retSparepartsStatus.lgdn',
    method: 'POST',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_Search"><ColumnInfo><Column id="organizationId" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="organizationId">28753</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_RealtimeReviewreq') && xml.includes('ds_RealPORemainQty')
  },
  {
    name: '[16/16] REST Management APIs: Health Check & Endpoints Catalog',
    path: '/api/health',
    method: 'GET',
    payload: '',
    check: (body) => {
      try {
        const json = JSON.parse(body);
        return json.status === 'ONLINE' && json.database && json.database.items > 0;
      } catch (e) {
        return false;
      }
    }
  }
];

function sendRequest(path, method = 'POST', body = '') {
  return new Promise((resolve, reject) => {
    const isXml = method === 'POST';
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': isXml ? 'text/xml; charset=UTF-8' : 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runAllTests() {
  console.log('========================================================================');
  console.log(`⚡ [Omni-EMS Mock Server Verification] Testing against http://${HOST}:${PORT}`);
  console.log('   Universal 50-Endpoint Engine synchronized with ems-api-analyzer');
  console.log('========================================================================\n');

  let passed = 0;
  for (const t of tests) {
    try {
      const res = await sendRequest(t.path, t.method || 'POST', t.payload || '');
      if (res.status === 200 && t.check(res.body)) {
        console.log(`  [PASS] ${t.name}`);
        passed++;
      } else {
        console.error(`  [FAIL] ${t.name} (HTTP Status: ${res.status})`);
        console.error('         Response Preview:', res.body ? res.body.slice(0, 200).replace(/\n/g, ' ') : 'EMPTY');
      }
    } catch (err) {
      console.error(`  [ERROR] ${t.name}: ${err.message}`);
    }
  }

  console.log('\n========================================================================');
  console.log(`🎉 Kết quả kiểm thử: ${passed}/${tests.length} tests passed (${Math.round((passed / tests.length) * 100)}%)`);
  console.log('========================================================================');

  if (passed === tests.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAllTests();
