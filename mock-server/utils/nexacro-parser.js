/**
 * Nexacro XML Protocol Parser
 */

function unescapeXml(val) {
  if (!val) return "";
  return val
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseNexacroXml(xmlString) {
  if (!xmlString) {
    return { parameters: {}, datasets: {} };
  }

  const clean = xmlString.replace(/\r/g, "");
  const parameters = {};
  const datasets = {};

  // Parse Parameters
  const paramRegex = /<Parameter id="([^"]+)"(?:[^>]*>([\s\S]*?)<\/Parameter>|\s*\/>)/g;
  let match;
  while ((match = paramRegex.exec(clean)) !== null) {
    const id = match[1];
    const val = match[2] !== undefined ? unescapeXml(match[2].trim()) : "";
    parameters[id] = val;
  }

  // Parse Datasets
  const dsRegex = /<Dataset id="([^"]+)">([\s\S]*?)<\/Dataset>/g;
  let dsMatch;
  while ((dsMatch = dsRegex.exec(clean)) !== null) {
    const dsId = dsMatch[1];
    const dsBody = dsMatch[2];

    const rows = [];
    const rowRegex = /<Row>([\s\S]*?)<\/Row>/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(dsBody)) !== null) {
      const rowContent = rowMatch[1];
      const rowData = {};

      const colRegex = /<Col id="([^"]+)"(?:>([\s\S]*?)<\/Col>|\s*\/>)/g;
      let colMatch;
      while ((colMatch = colRegex.exec(rowContent)) !== null) {
        const colId = colMatch[1];
        const colVal = colMatch[2] !== undefined ? unescapeXml(colMatch[2].trim()) : "";
        rowData[colId] = colVal;
      }
      rows.push(rowData);
    }
    datasets[dsId] = rows;
  }

  return { parameters, datasets };
}

module.exports = { parseNexacroXml, unescapeXml };
