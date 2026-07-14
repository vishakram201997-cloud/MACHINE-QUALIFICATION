/**
 * Machine Installation Control Center (MICC)
 * Google Apps Script Backend
 * 
 * Instructions:
 * 1. Open your combined Google Sheet (MICC_Database).
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any default code and paste this script.
 * 4. Click Save (disk icon).
 * 5. Click "Deploy" > "New deployment".
 * 6. Under "Select type", choose "Web app".
 * 7. Set "Execute as" to "Me".
 * 8. Set "Who has access" to "Anyone".
 * 9. Click Deploy and copy the Web App URL. Paste it in your MICC settings panel.
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = {};
  
  var sheetsToFetch = [
    { name: "InstallationPlanBatch1", sheetName: "InstallationPlanBatch1" },
    { name: "FinalSummary", sheetName: "FinalSummary" },
    { name: "ManpowerPlan", sheetName: "ManpowerPlan" },
    { name: "ManpowerSummary", sheetName: "ManpowerSummary" },
    { name: "ManpowerPlanning", sheetName: "ManpowerPlanning" },
    { name: "PendingEquipments", sheetName: "PendingEquipments" },
    { name: "MEPReadiness", sheetName: "MEPReadiness" }
  ];
  
  sheetsToFetch.forEach(function(s) {
    var sheet = ss.getSheetByName(s.sheetName);
    if (sheet) {
      result[s.name] = getSheetData(sheet);
    } else {
      result[s.name] = [];
    }
  });
  
  // Read Overrides
  var overrides = {};
  var overrideSheet = ss.getSheetByName("WebpageOverrides");
  if (overrideSheet) {
    var rows = overrideSheet.getDataRange().getDisplayValues();
    for (var i = 1; i < rows.length; i++) {
      var key = rows[i][0] ? rows[i][0].trim() : "";
      var val = rows[i][1] ? rows[i][1].trim() : "";
      if (key) {
        try {
          overrides[key] = JSON.parse(val);
        } catch(err) {
          overrides[key] = val;
        }
      }
    }
  }
  result["Overrides"] = overrides;
  
  var jsonString = JSON.stringify(result);
  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid JSON payload: " + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (payload.action === "saveOverrides") {
    var overrideSheet = ss.getSheetByName("WebpageOverrides");
    if (!overrideSheet) {
      overrideSheet = ss.insertSheet("WebpageOverrides");
      overrideSheet.appendRow(["Key", "Value"]);
    }
    
    var key = payload.key;
    var value = payload.value; // JSON string or null/undefined
    
    var range = overrideSheet.getDataRange();
    var values = range.getValues();
    var foundIndex = -1;
    
    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === key) {
        foundIndex = i + 1; // 1-indexed row number
        break;
      }
    }
    
    if (foundIndex !== -1) {
      if (value === null || value === undefined || value === "") {
        overrideSheet.deleteRow(foundIndex);
      } else {
        overrideSheet.getRange(foundIndex, 2).setValue(value);
      }
    } else {
      if (value !== null && value !== undefined && value !== "") {
        overrideSheet.appendRow([key, value]);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unknown action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(sheet) {
  var values = sheet.getDataRange().getDisplayValues();
  if (values.length <= 1) return [];
  
  var headers = values[0];
  var data = [];
  
  for (var r = 1; r < values.length; r++) {
    var rowObj = {};
    var hasData = false;
    var row = values[r];
    for (var c = 0; c < headers.length; c++) {
      var header = headers[c] ? headers[c].trim() : "Column_" + (c + 1);
      var val = row[c] ? row[c].trim() : "";
      if (val !== "") {
        hasData = true;
      }
      rowObj[header] = val;
    }
    if (hasData) {
      data.push(rowObj);
    }
  }
  return data;
}
