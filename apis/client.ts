import {
  NexacroClientConfig,
  NexacroPayload,
  NexacroResponse,
  StockStatusSearchParams,
  StockStatusItem,
  EstimateRequestSearchParams,
  EstimateRequestItem,
  ItemDetailInput,
  ItemDetailResponse,
  ItemDetailMaster,
  ItemDetailInventory,
  ItemDetailSummary,
  TargetStockSearchParams,
  TargetStockItem,
  ItemSearchParams,
  ItemSearchRecord,
  ItemPoStatusParams,
  ItemPoStatusRecord,
  CommonCodeItem,
  FactoryItem
} from "./types";

function escapeXml(val: any): string {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(val: string): string {
  if (!val) return "";
  return val
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function buildNexacroXml(payload: NexacroPayload): string {
  const params = payload.parameters || {};
  const datasets = payload.datasets || {};

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<Root xmlns="http://www.nexacroplatform.com/platform/dataset">\n';

  // Parameters
  const paramKeys = Object.keys(params);
  if (paramKeys.length > 0) {
    xml += '\t<Parameters>\n';
    for (const key of paramKeys) {
      const v = params[key];
      if (v === null || v === undefined || v === "") {
        xml += `\t\t<Parameter id="${escapeXml(key)}" />\n`;
      } else {
        xml += `\t\t<Parameter id="${escapeXml(key)}">${escapeXml(v)}</Parameter>\n`;
      }
    }
    xml += '\t</Parameters>\n';
  } else {
    xml += '\t<Parameters />\n';
  }

  // Datasets
  for (const [dsId, rows] of Object.entries(datasets)) {
    xml += `\t<Dataset id="${escapeXml(dsId)}">\n`;
    const colSet = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        colSet.add(k);
      }
    }
    const cols = Array.from(colSet);

    xml += '\t\t<ColumnInfo>\n';
    for (const col of cols) {
      xml += `\t\t\t<Column id="${escapeXml(col)}" type="STRING" size="256" />\n`;
    }
    xml += '\t\t</ColumnInfo>\n';

    xml += '\t\t<Rows>\n';
    for (const row of rows) {
      xml += '\t\t\t<Row>\n';
      for (const col of cols) {
        const val = row[col];
        if (val === null || val === undefined || val === "") {
          xml += `\t\t\t\t<Col id="${escapeXml(col)}" />\n`;
        } else {
          xml += `\t\t\t\t<Col id="${escapeXml(col)}">${escapeXml(val)}</Col>\n`;
        }
      }
      xml += '\t\t\t</Row>\n';
    }
    xml += '\t\t</Rows>\n';
    xml += '\t</Dataset>\n';
  }

  xml += '</Root>\n';
  return xml;
}

export function parseNexacroXml<T = any>(xml: string): NexacroResponse<T> {
  const parameters: Record<string, string> = {};
  const datasets: Record<string, any[]> = {};
  const cleanXml = xml.replace(/\r/g, "");

  const paramMatches = cleanXml.matchAll(/<Parameter id="([^"]+)"(?:[^>]*>([\s\S]*?)<\/Parameter>|\s*\/>)/g);
  for (const m of paramMatches) {
    parameters[m[1]] = m[2] !== undefined ? unescapeXml(m[2].trim()) : "";
  }

  const dsMatches = cleanXml.matchAll(/<Dataset id="([^"]+)">([\s\S]*?)<\/Dataset>/g);
  for (const dsm of dsMatches) {
    const dsId = dsm[1];
    const dsContent = dsm[2];
    const rows: Record<string, any>[] = [];
    const rowMatches = dsContent.matchAll(/<Row>([\s\S]*?)<\/Row>/g);

    for (const rm of rowMatches) {
      const rowObj: Record<string, any> = {};
      const colMatches = rm[1].matchAll(/<Col id="([^"]+)"(?:>([\s\S]*?)<\/Col>|\s*\/>)/g);
      for (const cm of colMatches) {
        rowObj[cm[1]] = cm[2] !== undefined ? unescapeXml(cm[2].trim()) : "";
      }
      rows.push(rowObj);
    }
    datasets[dsId] = rows;
  }

  const errorCode = parseInt(parameters["errorCode"] || "1", 10);
  const errorMsg = parameters["errorMsg"] || "";
  const firstDsKey = Object.keys(datasets)[0];
  const data = (firstDsKey ? datasets[firstDsKey] : []) as unknown as T;

  return { errorCode, errorMsg, parameters, datasets, data };
}

export class NexacroClient {
  public baseUrl: string;
  public userId: string;
  public organizationId: string;
  public language: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(config: NexacroClientConfig = {}) {
    this.baseUrl = config.baseUrl || "http://ems.lgdisplay.com:9000";
    this.userId = config.userId || "658359";
    this.organizationId = config.organizationId || "28753";
    this.language = config.language || "EN";
    this.defaultHeaders = {
      "Content-Type": "text/xml; charset=UTF-8",
      "User-Agent": "Nexacro/17.0",
      ...(config.headers || {})
    };
    this.timeout = config.timeout || 30000;
  }

  public setSession(userId: string, organizationId: string, language: string = "EN") {
    this.userId = userId;
    this.organizationId = organizationId;
    this.language = language;
  }

  public async execute<T = any>(endpoint: string, payload: NexacroPayload = {}): Promise<NexacroResponse<T>> {
    const fullUrl = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;

    const mergedParams = {
      _ems_userId: this.userId,
      _ems_organizationId: this.organizationId,
      _ems_language: this.language,
      ...(payload.parameters || {})
    };

    const xmlBody = buildNexacroXml({
      parameters: mergedParams,
      datasets: payload.datasets || {}
    });

    const res = await fetch(fullUrl, {
      method: "POST",
      headers: this.defaultHeaders,
      body: xmlBody
    });

    if (!res.ok) {
      throw new Error(`Nexacro HTTP Error ${res.status}: ${res.statusText}`);
    }

    const xmlText = await res.text();
    const parsed = parseNexacroXml<T>(xmlText);

    if (parsed.errorCode !== 1 && parsed.errorCode !== 0) {
      throw new Error(`Nexacro Error [code ${parsed.errorCode}]: ${parsed.errorMsg}`);
    }

    return parsed;
  }

  // 1. Stock Status
  async getStockStatus(params: StockStatusSearchParams, items: string[] = []): Promise<StockStatusItem[]> {
    const itemFilterRows = items.map(it => ({ item: it }));
    const res = await this.execute<StockStatusItem[]>("emsspareparts/sp101/sp110Nav/RetStockStatusList.lgdn", {
      datasets: {
        ds_search: [params as any],
        ds_ItemInfo: itemFilterRows
      }
    });
    return (res.datasets["ds_result"] || res.data || []) as StockStatusItem[];
  }

  // 2. Estimate Requests (RFQ)
  async getEstimateRequests(params: EstimateRequestSearchParams, items: string[] = []): Promise<EstimateRequestItem[]> {
    const itemFilterRows = items.map(it => ({ item: it }));
    const res = await this.execute<EstimateRequestItem[]>("emsspareparts/sp101/sp120Nav/RetEstimateRequestList.lgdn", {
      datasets: {
        ds_Search: [params as any],
        ds_ItemInfo: itemFilterRows
      }
    });
    return (res.datasets["ds_list"] || res.data || []) as EstimateRequestItem[];
  }

  // 3. Item Detail
  async getItemDetail(input: ItemDetailInput): Promise<ItemDetailResponse> {
    const res = await this.execute("emsspareparts/sp102/sp135Nav/retrieveItemInfoDetail.lgdn", {
      datasets: {
        ds_Input: [input as any]
      }
    });
    return {
      item: (res.datasets["ds_Item"]?.[0] || {}) as ItemDetailMaster,
      inventory: (res.datasets["ds_Inv"]?.[0] || {}) as ItemDetailInventory,
      summary: (res.datasets["ds_Summary"]?.[0] || {}) as ItemDetailSummary
    };
  }

  // 4. Target Stock List
  async getTargetStockList(params: TargetStockSearchParams, items: string[] = []): Promise<TargetStockItem[]> {
    const itemFilterRows = items.map(it => ({ item: it }));
    const res = await this.execute<TargetStockItem[]>("emsspareparts/sp302/sp335Nav/TargetStockSearchList.lgdn", {
      datasets: {
        ds_search: [params as any],
        ds_ItemInfo: itemFilterRows
      }
    });
    return (res.datasets["ds_StockInfomation"] || res.data || []) as TargetStockItem[];
  }

  // 5. Item Search Popup
  async searchItems(params: ItemSearchParams): Promise<ItemSearchRecord[]> {
    const res = await this.execute<ItemSearchRecord[]>("emscom/popupNav/retrieveItem.lgdn", {
      datasets: {
        ds_Search: [params as any]
      }
    });
    return (res.datasets["ds_List"] || res.data || []) as ItemSearchRecord[];
  }

  // 6. Item PO History
  async getItemPoStatusList(params: ItemPoStatusParams): Promise<ItemPoStatusRecord[]> {
    const res = await this.execute<ItemPoStatusRecord[]>("emscom/popupNav/retrieveItemPoStatusList.lgdn", {
      datasets: {
        ds_Search: [params as any]
      }
    });
    return (res.datasets["ds_Rtn"] || res.data || []) as ItemPoStatusRecord[];
  }

  // 7. Common Codes
  async getCommonCodes(statementName: string = "retrieveItemType:"): Promise<CommonCodeItem[]> {
    const res = await this.execute<CommonCodeItem[]>("emscom/codeNav/retComCodeList.lgdn", {
      parameters: { statementName, comboCnt: "1" }
    });
    return (res.datasets["ds_output0"] || res.data || []) as CommonCodeItem[];
  }

  // 8. Factory List
  async getFactoryList(organizationId?: string): Promise<FactoryItem[]> {
    const res = await this.execute<FactoryItem[]>("emswonew/wn90/wn900Nav/retFactoryList.lgdn", {
      parameters: { _ems_organizationId: organizationId || this.organizationId }
    });
    return (res.datasets["ds_cbo_factory"] || res.data || []) as FactoryItem[];
  }
}

export const emsClient = new NexacroClient();
