import pytest
from app.adapters.nexacro_parser import NexacroParser, NexacroError, parse_nexacro_response


def test_parse_valid_nexacro_xml():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<Root xmlns="http://www.nexacroplatform.com/platform/dataset">
	<Parameters>
		<Parameter id="errorCode" type="int">1</Parameter>
		<Parameter id="errorMsg" type="string">SUCCESS</Parameter>
		<Parameter id="TotalCount">2</Parameter>
	</Parameters>
	<Dataset id="ds_result">
		<ColumnInfo>
			<Column id="ITEM_CD" type="string" size="32"/>
			<Column id="ITEM_NM" type="string" size="32"/>
			<Column id="STAT" type="string" size="32"/>
			<Column id="QTY" type="string" size="32"/>
		</ColumnInfo>
		<Rows>
			<Row>
				<Col id="ITEM_CD">PUMP-01</Col>
				<Col id="ITEM_NM">High Pressure Chiller Pump</Col>
				<Col id="STAT">01</Col>
				<Col id="QTY">10</Col>
			</Row>
			<Row>
				<Col id="ITEM_CD">VALVE-01</Col>
				<Col id="ITEM_NM">Safety Release Valve</Col>
				<Col id="STAT">01</Col>
				<Col id="QTY">0</Col>
			</Row>
		</Rows>
	</Dataset>
</Root>"""

    parsed = parse_nexacro_response(xml)
    assert parsed["metadata"]["error_code"] == 1
    assert parsed["metadata"]["error_msg"] == "SUCCESS"
    assert parsed["metadata"]["total_count"] == 2

    rows = parsed["raw_flattened"]
    assert len(rows) == 2
    assert rows[0]["ITEM_CD"] == "PUMP-01"
    assert rows[0]["QTY"] == "10"
    assert rows[1]["ITEM_CD"] == "VALVE-01"
    assert rows[1]["QTY"] == "0"


def test_parse_nexacro_negative_error_code():
    err_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Root xmlns="http://www.nexacroplatform.com/platform/dataset">
	<Parameters>
		<Parameter id="errorCode" type="int">-1</Parameter>
		<Parameter id="errorMsg" type="string">Session expired or invalid user token</Parameter>
	</Parameters>
</Root>"""

    parsed = parse_nexacro_response(err_xml, raise_on_error=False)
    assert parsed["metadata"]["error_code"] == -1
    assert "Session expired" in parsed["metadata"]["error_msg"]

    with pytest.raises(NexacroError) as exc_info:
        parse_nexacro_response(err_xml, raise_on_error=True)
    assert exc_info.value.error_code == -1
