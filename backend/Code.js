/**
 * Google Apps Script for Lead Tracker CRM Backend
 * 
 * Instructions:
 * 1. Create a new Google Spreadsheet.
 * 2. Click Extensions > Apps Script.
 * 3. Delete any code in Code.gs and paste this code.
 * 4. Click Deploy > New Deployment.
 * 5. Select type: Web app.
 * 6. Set "Execute as": Me.
 * 7. Set "Who has access": Anyone.
 * 8. Click Deploy, authorize permissions, and copy the Web App URL.
 * 9. Paste the URL into the Settings section of the Lead Tracker CRM app.
 */

// Simple security passcode (optional - configure this in sheet or code)
var API_PASSCODE = ""; // Leave blank to disable security, or set a passcode

function doPost(e) {
  var output = { success: false, message: "" };
  
  try {
    // Parse input payload
    var payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = e.parameter;
    }
    
    // Check passcode if configured
    if (API_PASSCODE !== "" && payload.passcode !== API_PASSCODE) {
      output.message = "Unauthorized: Invalid Passcode";
      return ContentService.createTextOutput(JSON.stringify(output))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader('Access-Control-Allow-Origin', '*')
        .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    
    var action = payload.action;
    var data = payload.data || {};
    
    // Initialize Spreadsheet sheets if they don't exist
    initSpreadsheet();
    
    if (action === "read") {
      output.success = true;
      output.data = readAllData();
      output.message = "Data read successfully";
    } else if (action === "sync") {
      output.success = true;
      output.data = syncData(data);
      output.message = "Data synchronized successfully";
    } else {
      output.message = "Unknown action: " + action;
    }
    
  } catch (err) {
    output.success = false;
    output.message = "Error: " + err.toString();
  }
  
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

// Support OPTIONS for CORS preflight requests
function doGenericOptions(e) {
  return ContentService.createTextOutput("")
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function doGet(e) {
  // Redirect GET request to doPost format for simplicity, or return simple welcome
  return ContentService.createTextOutput(JSON.stringify({ 
    success: true, 
    message: "Lead Tracker CRM Google Apps Script Backend is running! Use POST to read or sync data." 
  }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*');
}

/**
 * Initialize Sheets with proper headers if they do not exist
 */
function initSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Leads Sheet
  var leadsSheet = ss.getSheetByName("leads");
  if (!leadsSheet) {
    leadsSheet = ss.insertSheet("leads");
    leadsSheet.appendRow([
      "id", "name", "phone", "email", "niche", "product", 
      "source", "status", "notes", "dateAdded", "lastContactDate"
    ]);
    leadsSheet.getRange(1, 1, 1, 11).setFontWeight("bold");
  }
  
  // 2. Follow-ups Sheet
  var followupsSheet = ss.getSheetByName("followups");
  if (!followupsSheet) {
    followupsSheet = ss.insertSheet("followups");
    followupsSheet.appendRow(["id", "leadId", "date", "time", "note", "completed"]);
    followupsSheet.getRange(1, 1, 1, 6).setFontWeight("bold");
  }
  
  // 3. Timeline / Activities Sheet
  var timelineSheet = ss.getSheetByName("activities");
  if (!timelineSheet) {
    timelineSheet = ss.insertSheet("activities");
    timelineSheet.appendRow(["id", "leadId", "action", "details", "timestamp"]);
    timelineSheet.getRange(1, 1, 1, 5).setFontWeight("bold");
  }
  
  // 4. Settings Sheet
  var settingsSheet = ss.getSheetByName("settings");
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet("settings");
    settingsSheet.appendRow(["key", "value"]);
    settingsSheet.getRange(1, 1, 1, 2).setFontWeight("bold");
  }
}

/**
 * Read all tables and return them as object arrays
 */
function readAllData() {
  return {
    leads: getSheetRowsAsObjects("leads"),
    followups: getSheetRowsAsObjects("followups"),
    activities: getSheetRowsAsObjects("activities"),
    settings: getSheetRowsAsObjects("settings")
  };
}

/**
 * Helper to convert a sheet's rows to objects based on header row
 */
function getSheetRowsAsObjects(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length <= 1) return [];
  
  var headers = values[0];
  var objects = [];
  
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var obj = {};
    var hasData = false;
    for (var c = 0; c < headers.length; c++) {
      var val = row[c];
      // Format Dates as strings to prevent conversion issues
      if (val instanceof Date) {
        val = val.toISOString();
      }
      obj[headers[c]] = val;
      if (val !== "" && val !== null && val !== undefined) {
        hasData = true;
      }
    }
    if (hasData) {
      objects.push(obj);
    }
  }
  
  return objects;
}

/**
 * Syncs lead, followup, activities and settings data from client
 * Overwrites or creates spreadsheet rows matching client IDs.
 * If client specifies items deleted, they are removed from sheet.
 */
function syncData(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (data.leads) syncTable(ss.getSheetByName("leads"), data.leads, 11);
  if (data.followups) syncTable(ss.getSheetByName("followups"), data.followups, 6);
  if (data.activities) syncTable(ss.getSheetByName("activities"), data.activities, 5);
  if (data.settings) syncSettingsTable(ss.getSheetByName("settings"), data.settings);
  
  return readAllData();
}

/**
 * Sync general table (e.g. leads, followups, activities) based on 'id' column
 */
function syncTable(sheet, clientDataArray, colCount) {
  if (!sheet || !clientDataArray) return;
  
  var range = sheet.getDataRange();
  var values = range.getValues();
  var headers = values[0];
  
  // Create mapping of ID -> Row Index (1-based index)
  var idToRowMap = {};
  for (var r = 1; r < values.length; r++) {
    var rowId = values[r][0]; // assumes ID is in column A (index 0)
    if (rowId) {
      idToRowMap[rowId] = r + 1; // Spreadsheet rows are 1-based, plus row 1 is header
    }
  }
  
  clientDataArray.forEach(function(item) {
    var id = item.id;
    if (!id) return;
    
    // If item is marked as deleted
    if (item._deleted) {
      if (idToRowMap[id]) {
        var row = idToRowMap[id];
        sheet.deleteRow(row);
        // Refresh mapping indexes since a row was deleted
        refreshIdMap(sheet, idToRowMap);
      }
      return;
    }
    
    // Construct values array in header order
    var rowValues = [];
    headers.forEach(function(header) {
      var val = item[header];
      if (val === undefined || val === null) {
        val = "";
      }
      rowValues.push(val);
    });
    
    if (idToRowMap[id]) {
      // Update existing row
      var row = idToRowMap[id];
      sheet.getRange(row, 1, 1, colCount).setValues([rowValues]);
    } else {
      // Add new row
      sheet.appendRow(rowValues);
      // Update map
      idToRowMap[id] = sheet.getLastRow();
    }
  });
}

function refreshIdMap(sheet, map) {
  // Clear map keys
  for (var key in map) delete map[key];
  
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    var rowId = values[r][0];
    if (rowId) {
      map[rowId] = r + 1;
    }
  }
}

/**
 * Sync settings table (Key-Value structured sheet)
 */
function syncSettingsTable(sheet, clientSettingsArray) {
  if (!sheet || !clientSettingsArray) return;
  
  var values = sheet.getDataRange().getValues();
  
  // Mapping of Key -> Row Index
  var keyToRowMap = {};
  for (var r = 1; r < values.length; r++) {
    var key = values[r][0];
    if (key) {
      keyToRowMap[key] = r + 1;
    }
  }
  
  clientSettingsArray.forEach(function(item) {
    var key = item.key;
    var value = item.value;
    if (!key) return;
    
    if (keyToRowMap[key]) {
      var row = keyToRowMap[key];
      sheet.getRange(row, 2).setValue(value);
    } else {
      sheet.appendRow([key, value]);
      keyToRowMap[key] = sheet.getLastRow();
    }
  });
}
