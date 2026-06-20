/**
 * Lead Tracker CRM - API & Storage Layer
 * Manages LocalStorage, remote Google Sheets sync, mock data initialization, and CRUD.
 */

(function () {
  const STORAGE_KEY_PREFIX = "lead_tracker_crm_";
  
  // Default configurations
  const DEFAULT_NICHES = [
    "Hartanah",
    "Website Development",
    "Landing Page Service",
    "Renovation",
    "Insurance",
    "Financing",
    "Other"
  ];

  const DEFAULT_SOURCES = [
    "WhatsApp",
    "Facebook Page",
    "Facebook Group",
    "Facebook Marketplace",
    "Facebook Ads",
    "TikTok Video",
    "TikTok Live",
    "TikTok Ads",
    "Instagram",
    "Threads",
    "Website",
    "Landing Page",
    "Referral",
    "Walk In",
    "Google Search",
    "Mudah",
    "PropertyGuru",
    "iProperty",
    "Telegram",
    "Waze",
    "Other"
  ];

  const DEFAULT_STATUSES = [
    "New Lead",
    "Contacted",
    "Follow Up",
    "Interested",
    "Negotiation",
    "Pending",
    "Closed Won",
    "Closed Lost"
  ];

  // API Client Definition
  const API = {
    // ----------------------------------------------------
    // STORAGE CORE
    // ----------------------------------------------------
    getData(key) {
      const data = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      return data ? JSON.parse(data) : null;
    },

    setData(key, value) {
      localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
    },

    // ----------------------------------------------------
    // INITIALIZATION & MOCK DATA
    // ----------------------------------------------------
    init() {
      // Check if data is already initialized
      if (!this.getData("initialized")) {
        this.resetToDefaults();
      }
    },

    resetToDefaults() {
      // Setup default settings
      const settings = {
        niches: [...DEFAULT_NICHES],
        sources: [...DEFAULT_SOURCES],
        statuses: [...DEFAULT_STATUSES],
        googleAppsScriptUrl: "",
        apiPasscode: "",
        appPasscode: "", // Local login passcode
        profileName: "Zaim Hartanah",
        profileEmail: "zaim@example.com",
        profileCompany: "Zaim Renovation & Property Service",
        theme: "dark"
      };
      this.setData("settings", settings);

      // Generate rich mock data
      const mockLeads = this.generateMockLeads();
      this.setData("leads", mockLeads);

      const mockFollowups = this.generateMockFollowups(mockLeads);
      this.setData("followups", mockFollowups);

      const mockActivities = this.generateMockActivities(mockLeads, mockFollowups);
      this.setData("activities", mockActivities);

      // Track deleted records for syncing
      this.setData("deleted_leads", []);
      this.setData("deleted_followups", []);

      this.setData("initialized", true);
    },

    // Helper to generate Malaysian Mock Leads
    generateMockLeads() {
      const names = [
        "Ahmad Fauzi", "Siti Aminah", "Chong Wei Min", "Ramasamy Muthu",
        "Farhana Rosli", "Muhammad Haziq", "Wong Siew Ling", "Nadia Mansor",
        "Amirul Ashraf", "Eliza Tan", "Khairul Anuar", "Sarah Lim"
      ];
      
      const phonePrefixes = ["+6012", "+6013", "+6017", "+6019", "+6011"];
      const niches = [...DEFAULT_NICHES];
      const sources = ["WhatsApp", "Facebook Ads", "Mudah", "PropertyGuru", "Website", "Recommendation", "TikTok Ads"];
      const statuses = [...DEFAULT_STATUSES];
      
      const products = {
        "Hartanah": ["Semi-D Setia Alam", "Condo KLCC", "Teres 2 Tingkat Bangi", "Tanah Lot Kajang"],
        "Website Development": ["E-Commerce Site", "Corporate Portfolio Web", "Custom Web App"],
        "Landing Page Service": ["Single Sales Funnel Page", "Lead Capture Form Landing"],
        "Renovation": ["Kitchen Extension", "Plaster Ceiling & Painting", "Whole House Renovation", "Bathroom Refurbish"],
        "Insurance": ["Hibah Takaful Plan", "Medical Card Family", "Critical Illness Protection"],
        "Financing": ["SME Business Loan", "Refinancing Consultation", "Home Mortgage Loan"]
      };

      const notes = [
        "Sangat berminat. Minta hantar quotation secepat mungkin.",
        "Sedang buat perbandingan harga dengan kontraktor lain.",
        "Nak tengok show unit hujung minggu ini dengan pasangan.",
        "Mahu diskaun tambahan untuk tempahan awal.",
        "Masih ragu-ragu tentang kelayakan pinjaman perumahan.",
        "Baru mula kerja, mahu perbincangan lanjut tentang bajet.",
        "Kena hubungi semula minggu depan selepas gaji masuk.",
        "WhatsApp sudah dibalas, mahu call jam 3 petang."
      ];

      const leads = [];
      const now = new Date();

      for (let i = 0; i < names.length; i++) {
        const id = "lead_" + (Date.now() - i * 86400000 - Math.floor(Math.random() * 1000));
        const niche = niches[i % (niches.length - 1)]; // Avoid "Other"
        const productList = products[niche] || ["General Consult"];
        const product = productList[Math.floor(Math.random() * productList.length)];
        const status = statuses[i % statuses.length];
        
        // Formulate dates spanning the last 30 days
        const daysAgo = Math.floor(Math.random() * 25);
        const dateAdded = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        const lastContactDate = new Date(dateAdded.getTime() + Math.floor(Math.random() * daysAgo) * 24 * 60 * 60 * 1000);

        leads.push({
          id: id,
          name: names[i],
          phone: phonePrefixes[Math.floor(Math.random() * phonePrefixes.length)] + (Math.floor(Math.random() * 9000000) + 1000000),
          email: names[i].toLowerCase().replace(/\s+/g, "") + "@example.com",
          niche: niche,
          product: product,
          source: sources[Math.floor(Math.random() * sources.length)],
          status: status,
          notes: notes[i % notes.length],
          dateAdded: dateAdded.toISOString(),
          lastContactDate: lastContactDate.toISOString()
        });
      }

      return leads;
    },

    // Helper to generate Mock Follow-ups
    generateMockFollowups(leads) {
      const followups = [];
      const now = new Date();

      leads.forEach((lead, index) => {
        // Create followups for about 80% of leads
        if (Math.random() > 0.2) {
          const id = "follow_" + (Date.now() - index * 60000);
          
          let date;
          let completed = "false";

          if (lead.status === "Closed Won" || lead.status === "Closed Lost") {
            // Past completed followups
            date = new Date(now.getTime() - (Math.floor(Math.random() * 5) + 1) * 24 * 60 * 60 * 1000);
            completed = "true";
          } else if (lead.status === "Follow Up" || lead.status === "Negotiation") {
            // Due today or upcoming
            const rand = Math.random();
            if (rand < 0.3) {
              // Today
              date = new Date(now);
            } else if (rand < 0.7) {
              // Upcoming (1-5 days later)
              date = new Date(now.getTime() + (Math.floor(Math.random() * 5) + 1) * 24 * 60 * 60 * 1000);
            } else {
              // Overdue (1-3 days ago)
              date = new Date(now.getTime() - (Math.floor(Math.random() * 3) + 1) * 24 * 60 * 60 * 1000);
            }
          } else {
            // Random future follow-up
            date = new Date(now.getTime() + (Math.floor(Math.random() * 10) + 1) * 24 * 60 * 60 * 1000);
          }

          const hours = String(9 + Math.floor(Math.random() * 8)).padStart(2, "0");
          const mins = Math.random() > 0.5 ? "00" : "30";

          followups.push({
            id: id,
            leadId: lead.id,
            date: date.toISOString().split("T")[0],
            time: `${hours}:${mins}`,
            note: "Follow up status: " + lead.status + " - Bincang butiran lanjut.",
            completed: completed
          });
        }
      });

      return followups;
    },

    // Helper to generate Mock Activities
    generateMockActivities(leads, followups) {
      const activities = [];
      leads.forEach((lead, idx) => {
        // 1. Lead Created
        activities.push({
          id: "act_" + (Date.now() - idx * 300000 - 10000),
          leadId: lead.id,
          action: "Lead Created",
          details: `Lead created from source: ${lead.source}`,
          timestamp: lead.dateAdded
        });

        // 2. Initial status changes
        if (lead.status !== "New Lead") {
          activities.push({
            id: "act_" + (Date.now() - idx * 300000 - 5000),
            leadId: lead.id,
            action: "Status Changed",
            details: `Status changed from New Lead to ${lead.status}`,
            timestamp: lead.lastContactDate
          });
        }

        // 3. Followup events
        const leadFollowups = followups.filter(f => f.leadId === lead.id);
        leadFollowups.forEach((f, fIdx) => {
          activities.push({
            id: "act_" + (Date.now() - idx * 300000 - fIdx * 2000),
            leadId: lead.id,
            action: f.completed === "true" ? "Follow Up Completed" : "Follow Up Scheduled",
            details: `Follow-up set for ${f.date} @ ${f.time}. Note: ${f.note}`,
            timestamp: lead.lastContactDate
          });
        });
      });

      return activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    // ----------------------------------------------------
    // GETTERS & CRUDS
    // ----------------------------------------------------
    getLeads() {
      return this.getData("leads") || [];
    },

    getLead(id) {
      return this.getLeads().find(l => l.id === id) || null;
    },

    saveLead(lead) {
      const leads = this.getLeads();
      const existingIdx = leads.findIndex(l => l.id === lead.id);
      
      let isNew = false;
      let oldStatus = "";

      if (existingIdx >= 0) {
        oldStatus = leads[existingIdx].status;
        leads[existingIdx] = { ...leads[existingIdx], ...lead };
      } else {
        isNew = true;
        lead.id = lead.id || "lead_" + Date.now();
        lead.dateAdded = lead.dateAdded || new Date().toISOString();
        lead.lastContactDate = lead.lastContactDate || new Date().toISOString();
        leads.push(lead);
      }

      this.setData("leads", leads);

      // Add timeline activities
      if (isNew) {
        this.addActivity(lead.id, "Lead Created", `Lead created under niche ${lead.niche} and source ${lead.source}`);
      } else if (oldStatus !== lead.status) {
        this.addActivity(lead.id, "Status Changed", `Status updated from ${oldStatus} to ${lead.status}`);
      }

      return lead;
    },

    deleteLead(id) {
      const leads = this.getLeads();
      const leadIdx = leads.findIndex(l => l.id === id);
      
      if (leadIdx >= 0) {
        const deletedLead = leads.splice(leadIdx, 1)[0];
        this.setData("leads", leads);

        // Keep track of deleted leads for syncing with sheets
        const deletedLeads = this.getData("deleted_leads") || [];
        deletedLeads.push({ id: id, _deleted: true });
        this.setData("deleted_leads", deletedLeads);

        // Delete associated followups too
        const followups = this.getFollowups();
        const remainingFollowups = [];
        const deletedFollowups = this.getData("deleted_followups") || [];
        
        followups.forEach(f => {
          if (f.leadId === id) {
            deletedFollowups.push({ id: f.id, _deleted: true });
          } else {
            remainingFollowups.push(f);
          }
        });

        this.setData("followups", remainingFollowups);
        this.setData("deleted_followups", deletedFollowups);

        // Clean up activities
        const activities = this.getActivities().filter(a => a.leadId !== id);
        this.setData("activities", activities);

        return true;
      }
      return false;
    },

    getFollowups() {
      return this.getData("followups") || [];
    },

    saveFollowup(followup) {
      const followups = this.getFollowups();
      const existingIdx = followups.findIndex(f => f.id === followup.id);
      
      let isNew = false;
      let statusChanged = false;

      if (existingIdx >= 0) {
        if (followups[existingIdx].completed !== followup.completed) {
          statusChanged = true;
        }
        followups[existingIdx] = { ...followups[existingIdx], ...followup };
      } else {
        isNew = true;
        followup.id = followup.id || "follow_" + Date.now();
        followup.completed = followup.completed || "false";
        followups.push(followup);
      }

      this.setData("followups", followups);

      // Activity timeline trigger
      if (isNew) {
        this.addActivity(followup.leadId, "Follow Up Scheduled", `New follow-up set for ${followup.date} at ${followup.time}`);
      } else if (statusChanged) {
        const statusText = followup.completed === "true" ? "Completed" : "Re-opened";
        this.addActivity(followup.leadId, "Follow Up " + statusText, `Follow-up scheduled for ${followup.date} is marked as ${statusText.toLowerCase()}`);
      }

      return followup;
    },

    deleteFollowup(id) {
      const followups = this.getFollowups();
      const fIdx = followups.findIndex(f => f.id === id);

      if (fIdx >= 0) {
        const deleted = followups.splice(fIdx, 1)[0];
        this.setData("followups", followups);

        const deletedFollowups = this.getData("deleted_followups") || [];
        deletedFollowups.push({ id: id, _deleted: true });
        this.setData("deleted_followups", deletedFollowups);

        this.addActivity(deleted.leadId, "Follow Up Cancelled", `Follow-up scheduled for ${deleted.date} was deleted`);
        return true;
      }
      return false;
    },

    getActivities() {
      return this.getData("activities") || [];
    },

    getLeadActivities(leadId) {
      return this.getActivities().filter(a => a.leadId === leadId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    addActivity(leadId, action, details) {
      const activities = this.getActivities();
      const activity = {
        id: "act_" + Date.now() + "_" + Math.floor(Math.random() * 100),
        leadId: leadId,
        action: action,
        details: details,
        timestamp: new Date().toISOString()
      };
      
      activities.unshift(activity);
      
      // Limit to 500 records locally to prevent excessive localStorage usage
      if (activities.length > 500) {
        activities.pop();
      }
      
      this.setData("activities", activities);

      // Update lead's lastContactDate
      const leads = this.getLeads();
      const leadIdx = leads.findIndex(l => l.id === leadId);
      if (leadIdx >= 0) {
        leads[leadIdx].lastContactDate = new Date().toISOString();
        this.setData("leads", leads);
      }

      return activity;
    },

    getSettings() {
      return this.getData("settings") || {};
    },

    saveSettings(settingsData) {
      const current = this.getSettings();
      const updated = { ...current, ...settingsData };
      this.setData("settings", updated);
      return updated;
    },

    // ----------------------------------------------------
    // GOOGLE APPS SCRIPT SYNC
    // ----------------------------------------------------
    async syncWithGoogleSheets() {
      const settings = this.getSettings();
      const url = settings.googleAppsScriptUrl;
      const passcode = settings.apiPasscode;

      if (!url) {
        throw new Error("Google Apps Script Web App URL is not configured in Settings.");
      }

      // Gather local data & deletions
      const localLeads = this.getLeads();
      const deletedLeads = this.getData("deleted_leads") || [];
      const leadsPayload = [...localLeads, ...deletedLeads];

      const localFollowups = this.getFollowups();
      const deletedFollowups = this.getData("deleted_followups") || [];
      const followupsPayload = [...localFollowups, ...deletedFollowups];

      const activitiesPayload = this.getActivities();
      
      // Settings structure mapping for Spreadsheet sync
      const settingsPayload = [
        { key: "profileName", value: settings.profileName || "" },
        { key: "profileEmail", value: settings.profileEmail || "" },
        { key: "profileCompany", value: settings.profileCompany || "" },
        { key: "niches", value: JSON.stringify(settings.niches || []) },
        { key: "sources", value: JSON.stringify(settings.sources || []) }
      ];

      const payload = {
        action: "sync",
        passcode: passcode,
        data: {
          leads: leadsPayload,
          followups: followupsPayload,
          activities: activitiesPayload,
          settings: settingsPayload
        }
      };

      try {
        const response = await fetch(url, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "text/plain" // Prevents CORS preflight pre-requisites issues with Apps Script
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error("HTTP connection failed. Code: " + response.status);
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.message || "Sync failed on Apps Script backend.");
        }

        // Backend successfully processed. Store returned state
        const serverData = result.data;
        
        if (serverData.leads) this.setData("leads", serverData.leads);
        if (serverData.followups) this.setData("followups", serverData.followups);
        if (serverData.activities) this.setData("activities", serverData.activities);
        
        // Sync settings from server
        if (serverData.settings) {
          const serverSettings = {};
          serverData.settings.forEach(item => {
            if (item.key === "niches" || item.key === "sources") {
              try {
                serverSettings[item.key] = JSON.parse(item.value);
              } catch (e) {
                // If parsing fails, skip
              }
            } else {
              serverSettings[item.key] = item.value;
            }
          });
          
          this.saveSettings(serverSettings);
        }

        // Clear deleted trackers
        this.setData("deleted_leads", []);
        this.setData("deleted_followups", []);

        return { success: true, message: "Sync successful! Database updated." };

      } catch (err) {
        console.error("Sync error: ", err);
        throw err;
      }
    },

    // Perform an initial pull/read from Google Sheets
    async fetchFromGoogleSheets() {
      const settings = this.getSettings();
      const url = settings.googleAppsScriptUrl;
      const passcode = settings.apiPasscode;

      if (!url) {
        throw new Error("Google Apps Script Web App URL is not configured.");
      }

      const payload = {
        action: "read",
        passcode: passcode
      };

      try {
        const response = await fetch(url, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "text/plain"
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error("Connection failed. HTTP: " + response.status);
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.message || "Fetch failed.");
        }

        const serverData = result.data;
        
        if (serverData.leads) this.setData("leads", serverData.leads);
        if (serverData.followups) this.setData("followups", serverData.followups);
        if (serverData.activities) this.setData("activities", serverData.activities);
        
        if (serverData.settings) {
          const serverSettings = {};
          serverData.settings.forEach(item => {
            if (item.key === "niches" || item.key === "sources") {
              try {
                serverSettings[item.key] = JSON.parse(item.value);
              } catch (e) {}
            } else {
              serverSettings[item.key] = item.value;
            }
          });
          this.saveSettings(serverSettings);
        }

        // Reset deleted caches
        this.setData("deleted_leads", []);
        this.setData("deleted_followups", []);

        return true;
      } catch (err) {
        console.error("Fetch error: ", err);
        throw err;
      }
    }
  };

  // Export API to global scope
  window.API = API;
  
  // Auto-initialize
  API.init();
})();
