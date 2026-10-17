/**
 * Automated Test Suite for the 8 Core Data Retrieval Endpoints
 * All endpoints query directly from unified SQLite database (db/ems.db)
 */
const http = require('http');

const PORT = process.env.PORT || 9000;
const HOST = '127.0.0.1';

const tests = [
  {
    name: '[1/8] Spare Parts: Stock Status Search',
    path: '/emsspareparts/sp101/sp110Nav/RetStockStatusList.lgdn',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_ItemInfo"><ColumnInfo><Column id="item" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="item">QCAD57452</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_result') && xml.includes('QCAD57452')
  },
  {
    name: '[2/8] Spare Parts: Estimate Requests (RFQ)',
    path: '/emsspareparts/sp101/sp120Nav/RetEstimateRequestList.lgdn',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_ItemInfo"><ColumnInfo><Column id="item" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="item">QCAD57452</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_list') && xml.includes('Q2610-3091080')
  },
  {
    name: '[3/8] Spare Parts: Item Detail Info',
    path: '/emsspareparts/sp102/sp135Nav/retrieveItemInfoDetail.lgdn',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_Input"><ColumnInfo><Column id="inventoryItemId" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="inventoryItemId">1934887</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_Item') && xml.includes('ds_Inv')
  },
  {
    name: '[4/8] Spare Parts: Target Stock Optimization',
    path: '/emsspareparts/sp302/sp335Nav/TargetStockSearchList.lgdn',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_ItemInfo"><ColumnInfo><Column id="item" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="item">QCAD57452</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_StockInfomation') && xml.includes('OPTIMIZATION_NON_PERIOD')
  },
  {
    name: '[5/8] Popups: Item Master Search',
    path: '/emscom/popupNav/retrieveItem.lgdn',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_Search"><ColumnInfo><Column id="item" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="item">QCAD</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_List') && xml.includes('QCAD57452')
  },
  {
    name: '[6/8] Popups: Item PO Status Tracking',
    path: '/emscom/popupNav/retrieveItemPoStatusList.lgdn',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Dataset id="ds_Search"><ColumnInfo><Column id="item" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="item">QCAD57452</Col></Row></Rows></Dataset></Root>`,
    check: (xml) => xml.includes('ds_Rtn') && xml.includes('PO-2026-4412')
  },
  {
    name: '[7/8] Common: Common Code Dictionary',
    path: '/emscom/codeNav/retComCodeList.lgdn',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Parameters><Parameter id="statementName">retrieveItemType:retrieveEstimateStatus:</Parameter></Parameters></Root>`,
    check: (xml) => xml.includes('ds_output0') && xml.includes('ds_output1')
  },
  {
    name: '[8/8] Work Order: Factory List',
    path: '/emswonew/wn90/wn900Nav/retFactoryList.lgdn',
    payload: `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Parameters><Parameter id="_ems_organizationId">28753</Parameter></Parameters></Root>`,
    check: (xml) => xml.includes('ds_cbo_factory') && xml.includes('HW')
  }
];

function sendPost(path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runAllTests() {
  console.log('====================================================');
  console.log(`Starting Data Retrieval Verification against http://${HOST}:${PORT}`);
  console.log('====================================================\n');

  let passed = 0;
  for (const t of tests) {
    try {
      const res = await sendPost(t.path, t.payload);
      if (res.status === 200 && t.check(res.body)) {
        console.log(`[PASS] ${t.name}`);
        passed++;
      } else {
        console.error(`[FAIL] ${t.name} (Status: ${res.status})`);
        console.error('Response Preview:', res.body ? res.body.slice(0, 300) : 'EMPTY');
      }
    } catch (err) {
      console.error(`[ERROR] ${t.name}: ${err.message}`);
    }
  }

  console.log('\n====================================================');
  console.log(`Result: ${passed}/${tests.length} tests passed (${Math.round((passed / tests.length) * 100)}%)`);
  console.log('====================================================');

  if (passed === tests.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAllTests();
