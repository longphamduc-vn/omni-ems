/**
 * Nexacro XML Protocol Response Builder
 */

function escapeXml(val) {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildNexacroResponse({
  errorCode = 1,
  errorMsg = "",
  parameters = {},
  datasets = {}
} = {}) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<Root xmlns="http://www.nexacroplatform.com/platform/dataset">\n';

  // Parameters
  xml += '\t<Parameters>\n';
  xml += `\t\t<Parameter id="errorCode" type="int">${errorCode}</Parameter>\n`;
  xml += `\t\t<Parameter id="errorMsg" type="string">${escapeXml(errorMsg)}</Parameter>\n`;

  for (const [key, val] of Object.entries(parameters)) {
    if (key !== "errorCode" && key !== "errorMsg") {
      if (val === null || val === undefined || val === "") {
        xml += `\t\t<Parameter id="${escapeXml(key)}" />\n`;
      } else {
        xml += `\t\t<Parameter id="${escapeXml(key)}">${escapeXml(val)}</Parameter>\n`;
      }
    }
  }
  xml += '\t</Parameters>\n';

  // Datasets
  for (const [dsId, rows] of Object.entries(datasets)) {
    xml += `\t<Dataset id="${escapeXml(dsId)}">\n`;

    // Extract columns
    const colSet = new Set();
    const safeRows = Array.isArray(rows) ? rows : (rows ? [rows] : []);
    for (const r of safeRows) {
      if (r && typeof r === "object") {
        for (const k of Object.keys(r)) {
          colSet.add(k);
        }
      }
    }
    const cols = Array.from(colSet);

    xml += '\t\t<ColumnInfo>\n';
    for (const col of cols) {
      xml += `\t\t\t<Column id="${escapeXml(col)}" type="string" size="32"/>\n`;
    }
    xml += '\t\t</ColumnInfo>\n';

    xml += '\t\t<Rows>\n';
    for (const r of safeRows) {
      xml += '\t\t\t<Row>\n';
      for (const col of cols) {
        const val = r[col];
        if (val === null || val === undefined || val === "") {
          xml += `\t\t\t\t<Col id="${escapeXml(col)}"></Col>\n`;
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

module.exports = { buildNexacroResponse, escapeXml };
