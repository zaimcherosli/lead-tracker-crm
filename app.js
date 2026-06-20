/**
 * Lead Tracker CRM - Frontend App Controller
 * Orchestrates SPA routing, layout rendering, event bindings, and data management.
 */

(function () {
  // Global View State
  const state = {
    currentView: "dashboard",
    filters: {
      search: "",
      niche: "",
      source: "",
      status: ""
    },
    followupViewMode: "list", // 'list' or 'calendar'
    calendar: {
      currentYear: new Date().getFullYear(),
      currentMonth: new Date().getMonth(), // 0-indexed
      selectedDate: new Date().toISOString().split("T")[0]
    },
    charts: {} // Store Chart.js instances
  };

  // Helper: Format Dates in Malay Locale
  function formatMalayDate(dateStr) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("ms-MY", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function formatMalayDateTime(dateStr) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleTimeString("ms-MY", {
      hour: "2-digit",
      minute: "2-digit"
    }) + ", " + date.toLocaleDateString("ms-MY", {
      day: "numeric",
      month: "short"
    });
  }

  // Helper: Get lead notes array
  function getLeadNotes(lead) {
    if (!lead.notes) return [];
    try {
      const parsed = JSON.parse(lead.notes);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Return single string note as array
      return [{
        id: "note_init",
        text: lead.notes,
        timestamp: lead.dateAdded || new Date().toISOString()
      }];
    }
    return [{
      id: "note_init",
      text: lead.notes,
      timestamp: lead.dateAdded || new Date().toISOString()
    }];
  }

  // ----------------------------------------------------
  // AUTHENTICATION GUARD
  // ----------------------------------------------------
  function checkAuthentication() {
    const settings = window.API.getSettings();
    const overlay = document.getElementById("login-overlay");
    const errorMsg = document.getElementById("login-error-msg");
    
    // Check if passcode is enabled
    if (!settings.appPasscode) {
      overlay.classList.add("hidden");
      return true;
    }

    // Check if already logged in for this browser session
    if (sessionStorage.getItem("crm_authenticated") === "true") {
      overlay.classList.add("hidden");
      return true;
    }

    // Show login screen
    overlay.classList.remove("hidden");
    errorMsg.classList.add("hidden");
    return false;
  }

  // Handle Login Form Submit
  document.getElementById("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const settings = window.API.getSettings();
    const passwordInput = document.getElementById("login-password").value;
    const errorMsg = document.getElementById("login-error-msg");

    // Match password to appPasscode
    if (passwordInput === settings.appPasscode) {
      sessionStorage.setItem("crm_authenticated", "true");
      document.getElementById("login-overlay").classList.add("hidden");
      
      // Clear inputs
      document.getElementById("login-password").value = "";
      
      // Initialize view
      router();
    } else {
      errorMsg.classList.remove("hidden");
    }
  });

  // Handle Logout
  document.getElementById("logout-btn").addEventListener("click", function () {
    if (confirm("Adakah anda pasti mahu keluar dari portal?")) {
      sessionStorage.removeItem("crm_authenticated");
      checkAuthentication();
    }
  });

  // ----------------------------------------------------
  // ROUTER
  // ----------------------------------------------------
  function router() {
    if (!checkAuthentication()) return;

    // Get current hash
    const hash = window.location.hash || "#dashboard";
    const [viewPath, queryString] = hash.split("?");
    const params = new URLSearchParams(queryString || "");
    
    // Update state view
    state.currentView = viewPath.replace("#", "");
    
    // Hide all views
    document.querySelectorAll(".view-panel").forEach(panel => panel.classList.add("hidden"));
    
    // Update navigation active states
    updateNavigationHighlight(state.currentView);

    // Dynamic Header title
    const headerTitle = document.getElementById("page-title");
    
    // Route logic
    switch (state.currentView) {
      case "dashboard":
        headerTitle.innerText = "Dashboard Analitis";
        renderDashboard();
        break;
      case "leads":
        headerTitle.innerText = "Modul Leads Utama";
        renderLeadsList();
        break;
      case "lead-detail":
        headerTitle.innerText = "Profil & Rekod Lead";
        const leadId = params.get("id");
        if (leadId) {
          renderLeadDetail(leadId);
        } else {
          window.location.hash = "#leads";
        }
        break;
      case "followups":
        headerTitle.innerText = "Jadual & Tugasan Follow Up";
        renderFollowups();
        break;
      case "analytics":
        headerTitle.innerText = "Graf & Analitis Tukaran";
        renderAnalytics();
        break;
      case "settings":
        headerTitle.innerText = "Pengurusan & Tetapan CRM";
        renderSettings();
        break;
      default:
        window.location.hash = "#dashboard";
        break;
    }
    
    // Sync indicator updates
    updateSyncBadge();
  }

  function updateNavigationHighlight(activeView) {
    // Desktop Nav Items
    document.querySelectorAll(".nav-item").forEach(item => {
      const view = item.getAttribute("data-view");
      if (view === activeView || (activeView === "lead-detail" && view === "leads")) {
        item.classList.add("bg-brand-500/10", "text-brand-500", "dark:text-slate-100");
        item.classList.remove("text-slate-600", "dark:text-slate-400");
      } else {
        item.classList.remove("bg-brand-500/10", "text-brand-500", "dark:text-slate-100");
        item.classList.add("text-slate-600", "dark:text-slate-400");
      }
    });

    // Mobile Nav Items
    document.querySelectorAll(".mobile-nav-item").forEach(item => {
      const view = item.getAttribute("data-view");
      if (view === activeView || (activeView === "lead-detail" && view === "leads")) {
        item.classList.add("text-brand-500");
        item.classList.remove("text-slate-500", "dark:text-slate-400");
      } else {
        item.classList.remove("text-brand-500");
        item.classList.add("text-slate-500", "dark:text-slate-400");
      }
    });
  }

  function updateSyncBadge() {
    const settings = window.API.getSettings();
    const badge = document.getElementById("sync-status-badge");
    const lastSyncTime = localStorage.getItem("lead_tracker_crm_last_sync") || "Never";
    
    document.getElementById("sidebar-sync-time").innerText = lastSyncTime;
    
    if (settings.googleAppsScriptUrl) {
      badge.className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500";
      badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span> Cloud Synced`;
    } else {
      badge.className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500";
      badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span> Local Storage`;
    }
  }

  // Handle Hash Changes
  window.addEventListener("hashchange", router);
  // Run on load
  window.addEventListener("DOMContentLoaded", () => {
    // Set default theme from settings
    const settings = window.API.getSettings();
    if (settings.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (settings.theme === "light") {
      document.documentElement.classList.remove("dark");
    }
    
    // Set profile info in sidebar
    document.getElementById("user-profile-name").innerText = settings.profileName || "Zaim Hartanah";
    document.getElementById("user-profile-company").innerText = settings.profileCompany || "Agency Owner";
    
    const initials = (settings.profileName || "ZH")
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    document.getElementById("user-initials").innerText = initials;

    router();
  });

  // ----------------------------------------------------
  // MODULE: DASHBOARD
  // ----------------------------------------------------
  function renderDashboard() {
    const leads = window.API.getLeads();
    const followups = window.API.getFollowups();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Compute Today's KPIs
    const todayNewLeads = leads.filter(l => l.dateAdded && l.dateAdded.startsWith(todayStr));
    const todayFollowupsDue = followups.filter(f => f.date === todayStr && f.completed !== "true");
    const todayClosedWon = leads.filter(l => l.status === "Closed Won" && l.lastContactDate && l.lastContactDate.startsWith(todayStr));
    const todayClosedLost = leads.filter(l => l.status === "Closed Lost" && l.lastContactDate && l.lastContactDate.startsWith(todayStr));

    // Update Today Statistics Elements
    document.getElementById("stat-new-leads").innerText = todayNewLeads.length;
    document.getElementById("stat-due-followups").innerText = todayFollowupsDue.length;
    document.getElementById("stat-closed-deals").innerText = todayClosedWon.length;
    document.getElementById("stat-lost-leads").innerText = todayClosedLost.length;

    // Monthly KPIs (Current Month)
    const currentMonthIndex = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();
    
    const monthlyLeads = leads.filter(l => {
      if (!l.dateAdded) return false;
      const d = new Date(l.dateAdded);
      return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
    });

    const monthlyClosedWon = leads.filter(l => {
      if (l.status !== "Closed Won" || !l.lastContactDate) return false;
      const d = new Date(l.lastContactDate);
      return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
    });

    const monthlyConversionRate = monthlyLeads.length > 0 
      ? Math.round((monthlyClosedWon.length / monthlyLeads.length) * 100) 
      : 0;

    document.getElementById("monthly-stat-total-leads").innerText = monthlyLeads.length;
    document.getElementById("monthly-stat-closed-won").innerText = monthlyClosedWon.length;
    document.getElementById("monthly-stat-conversion-rate").innerText = monthlyConversionRate + "%";

    // 1. Render Dashboard: Due Today Follow Ups list
    const dueFollowupsContainer = document.getElementById("dash-followups-list");
    dueFollowupsContainer.innerHTML = "";
    
    if (todayFollowupsDue.length === 0) {
      dueFollowupsContainer.innerHTML = `
        <div class="text-xs text-slate-400 text-center py-10">
          <i class="fa-regular fa-calendar-check text-2xl text-slate-300 dark:text-slate-700 mb-2 block"></i>
          Tiada tugasan follow up hari ini.
        </div>`;
    } else {
      todayFollowupsDue.forEach(f => {
        const lead = leads.find(l => l.id === f.leadId) || { name: "Unknown Lead", phone: "" };
        const item = document.createElement("div");
        item.className = "flex items-start space-x-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 hover:border-brand-500/30 transition-all";
        item.innerHTML = `
          <input type="checkbox" data-id="${f.id}" class="dash-complete-followup w-4 h-4 rounded text-brand-500 border-slate-300 bg-transparent mt-0.5 cursor-pointer">
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <a href="#lead-detail?id=${f.leadId}" class="text-xs font-bold hover:text-brand-500 transition-colors truncate">${lead.name}</a>
              <span class="text-[10px] font-semibold text-brand-500 bg-brand-500/10 px-1.5 py-0.5 rounded">${f.time}</span>
            </div>
            <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">${f.note}</p>
          </div>
        `;
        dueFollowupsContainer.appendChild(item);
      });

      // Bind dynamic checkboxes
      document.querySelectorAll(".dash-complete-followup").forEach(checkbox => {
        checkbox.addEventListener("change", function () {
          const id = this.getAttribute("data-id");
          const follow = followups.find(f => f.id === id);
          if (follow) {
            follow.completed = "true";
            window.API.saveFollowup(follow);
            // Refresh Dashboard
            renderDashboard();
          }
        });
      });
    }

    // 2. Render Dashboard: Recent Leads table (last 5 leads)
    const recentLeadsContainer = document.getElementById("dash-recent-leads");
    recentLeadsContainer.innerHTML = "";

    const sortedRecentLeads = [...leads]
      .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
      .slice(0, 5);

    if (sortedRecentLeads.length === 0) {
      recentLeadsContainer.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-slate-400">Tiada rekod lead tersimpan. Sila tambah lead baru.</td>
        </tr>`;
    } else {
      sortedRecentLeads.forEach(lead => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors";
        
        let badgeClass = "bg-slate-500/10 text-slate-500";
        if (lead.status === "New Lead") badgeClass = "bg-brand-500/10 text-brand-500";
        else if (lead.status === "Closed Won") badgeClass = "bg-emerald-500/10 text-emerald-500";
        else if (lead.status === "Closed Lost") badgeClass = "bg-red-500/10 text-red-500";
        else if (lead.status === "Follow Up" || lead.status === "Interested") badgeClass = "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
        else if (lead.status === "Negotiation") badgeClass = "bg-indigo-500/10 text-indigo-500";

        tr.innerHTML = `
          <td class="py-3 font-semibold text-slate-900 dark:text-slate-100">
            <a href="#lead-detail?id=${lead.id}" class="hover:underline">${lead.name}</a>
            <span class="block text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">${lead.phone}</span>
          </td>
          <td class="py-3">
            <span class="font-medium text-slate-700 dark:text-slate-300">${lead.niche}</span>
            <span class="block text-[10px] text-slate-400 truncate max-w-[120px]">${lead.product}</span>
          </td>
          <td class="py-3 text-slate-500 dark:text-slate-400">${lead.source}</td>
          <td class="py-3">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}">${lead.status}</span>
          </td>
          <td class="py-3 text-right">
            <div class="flex justify-end space-x-1.5">
              <a href="#lead-detail?id=${lead.id}" class="p-1 px-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-brand-500/10 hover:text-brand-500 transition-colors" title="Lihat Profil"><i class="fa-regular fa-folder-open"></i></a>
              <a href="https://wa.me/${lead.phone.replace(/[^0-9+]/g, "")}" target="_blank" class="p-1 px-2 border border-emerald-500/20 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
            </div>
          </td>
        `;
        recentLeadsContainer.appendChild(tr);
      });
    }
  }

  // ----------------------------------------------------
  // MODULE: LEADS LIST
  // ----------------------------------------------------
  function renderLeadsList() {
    const leads = window.API.getLeads();
    const settings = window.API.getSettings();

    // 1. Populate Dropdown Select filters
    const filterNiche = document.getElementById("filter-niche");
    const filterSource = document.getElementById("filter-source");
    const filterStatus = document.getElementById("filter-status");

    // Preserve selections
    const prevNiche = state.filters.niche;
    const prevSource = state.filters.source;
    const prevStatus = state.filters.status;

    filterNiche.innerHTML = '<option value="">Semua Niche</option>';
    settings.niches.forEach(n => {
      filterNiche.innerHTML += `<option value="${n}" ${n === prevNiche ? "selected" : ""}>${n}</option>`;
    });

    filterSource.innerHTML = '<option value="">Semua Source</option>';
    settings.sources.forEach(s => {
      filterSource.innerHTML += `<option value="${s}" ${s === prevSource ? "selected" : ""}>${s}</option>`;
    });

    filterStatus.innerHTML = '<option value="">Semua Status</option>';
    settings.statuses.forEach(st => {
      filterStatus.innerHTML += `<option value="${st}" ${st === prevStatus ? "selected" : ""}>${st}</option>`;
    });

    // 2. Perform Filters
    const query = state.filters.search.toLowerCase();
    
    const filteredLeads = leads.filter(lead => {
      // Search matching
      const matchesSearch = !query || 
        lead.name.toLowerCase().includes(query) ||
        lead.phone.includes(query) ||
        (lead.email && lead.email.toLowerCase().includes(query)) ||
        (lead.product && lead.product.toLowerCase().includes(query));

      // Dropdowns matching
      const matchesNiche = !state.filters.niche || lead.niche === state.filters.niche;
      const matchesSource = !state.filters.source || lead.source === state.filters.source;
      const matchesStatus = !state.filters.status || lead.status === state.filters.status;

      return matchesSearch && matchesNiche && matchesSource && matchesStatus;
    });

    // Update Count badge
    document.getElementById("filtered-leads-count").innerText = filteredLeads.length;

    // 3. Render Cards
    const leadsGrid = document.getElementById("leads-grid");
    const emptyState = document.getElementById("leads-empty-state");
    leadsGrid.innerHTML = "";

    if (filteredLeads.length === 0) {
      leadsGrid.classList.add("hidden");
      emptyState.classList.remove("hidden");
    } else {
      leadsGrid.classList.remove("hidden");
      emptyState.classList.add("hidden");

      filteredLeads.forEach(lead => {
        const card = document.createElement("div");
        card.className = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl relative overflow-hidden group hover:border-brand-500/40 hover:shadow-lg transition-all duration-200 flex flex-col justify-between";
        
        let badgeClass = "bg-slate-500/10 text-slate-500";
        if (lead.status === "New Lead") badgeClass = "bg-brand-500/10 text-brand-500";
        else if (lead.status === "Closed Won") badgeClass = "bg-emerald-500/10 text-emerald-500";
        else if (lead.status === "Closed Lost") badgeClass = "bg-red-500/10 text-red-500";
        else if (lead.status === "Follow Up" || lead.status === "Interested") badgeClass = "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
        else if (lead.status === "Negotiation") badgeClass = "bg-indigo-500/10 text-indigo-500";

        card.innerHTML = `
          <div>
            <!-- Header elements -->
            <div class="flex items-start justify-between mb-4">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}">${lead.status}</span>
              <span class="text-[10px] font-medium text-slate-400">${formatMalayDate(lead.dateAdded)}</span>
            </div>

            <!-- Lead profile -->
            <h4 class="font-extrabold text-base tracking-tight text-slate-900 dark:text-slate-100 line-clamp-1">
              <a href="#lead-detail?id=${lead.id}" class="hover:underline">${lead.name}</a>
            </h4>
            <div class="text-xs text-slate-500 mt-0.5 font-semibold">${lead.phone}</div>

            <!-- Niche products details -->
            <div class="mt-4 space-y-1 text-xs">
              <div class="flex items-center text-slate-600 dark:text-slate-300">
                <i class="fa-solid fa-folder-open text-[10px] text-slate-400 mr-2 w-3"></i>
                <span class="font-medium">${lead.niche}</span>
              </div>
              <div class="flex items-center text-slate-500">
                <i class="fa-solid fa-box text-[10px] text-slate-400 mr-2 w-3"></i>
                <span class="truncate max-w-[200px]">${lead.product}</span>
              </div>
              <div class="flex items-center text-slate-500">
                <i class="fa-solid fa-bullhorn text-[10px] text-slate-400 mr-2 w-3"></i>
                <span>${lead.source}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <a href="#lead-detail?id=${lead.id}" class="text-xs text-brand-500 font-bold hover:text-brand-600 flex items-center space-x-1">
              <span>View Profile</span>
              <i class="fa-solid fa-arrow-right"></i>
            </a>

            <div class="flex items-center space-x-1.5">
              <a href="https://wa.me/${lead.phone.replace(/[^0-9+]/g, "")}" target="_blank" class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
              <a href="tel:${lead.phone}" class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-all" title="Call"><i class="fa-solid fa-phone text-xs"></i></a>
              <button class="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-center transition-all delete-lead-quick-btn" data-id="${lead.id}" title="Padam"><i class="fa-regular fa-trash-can text-red-500"></i></button>
            </div>
          </div>
        `;
        leadsGrid.appendChild(card);
      });

      // Bind delete events
      document.querySelectorAll(".delete-lead-quick-btn").forEach(btn => {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          const id = this.getAttribute("data-id");
          if (confirm("Adakah anda pasti mahu memadamkan lead ini? Semua aktiviti dan jadual follow-up berkaitan akan dipadamkan.")) {
            window.API.deleteLead(id);
            renderLeadsList();
          }
        });
      });
    }
  }

  // Bind lead filter and search inputs
  document.getElementById("lead-search").addEventListener("input", function () {
    state.filters.search = this.value;
    renderLeadsList();
  });

  document.getElementById("filter-niche").addEventListener("change", function () {
    state.filters.niche = this.value;
    renderLeadsList();
  });

  document.getElementById("filter-source").addEventListener("change", function () {
    state.filters.source = this.value;
    renderLeadsList();
  });

  document.getElementById("filter-status").addEventListener("change", function () {
    state.filters.status = this.value;
    renderLeadsList();
  });

  // ----------------------------------------------------
  // MODULE: LEAD DETAILS
  // ----------------------------------------------------
  let activeDetailLeadId = "";
  
  function renderLeadDetail(leadId) {
    activeDetailLeadId = leadId;
    const lead = window.API.getLead(leadId);
    
    if (!lead) {
      window.location.hash = "#leads";
      return;
    }

    const settings = window.API.getSettings();

    // 1. Core Lead Metadata
    document.getElementById("detail-name").innerText = lead.name;
    document.getElementById("detail-niche").innerText = lead.niche;
    document.getElementById("detail-product").innerHTML = `<i class="fa-solid fa-box-open text-xs text-slate-400 mr-2"></i> ${lead.product}`;
    document.getElementById("detail-source").innerHTML = `<i class="fa-solid fa-bullhorn text-xs text-slate-400 mr-2"></i> ${lead.source}`;
    document.getElementById("detail-email").innerHTML = lead.email 
      ? `<i class="fa-solid fa-envelope text-xs text-slate-400 mr-2"></i> ${lead.email}`
      : `<i class="fa-solid fa-envelope text-xs text-slate-400 mr-2"></i> <span class="text-slate-450 italic">Tiada emel</span>`;
    
    const phoneClean = lead.phone.replace(/[^0-9+]/g, "");
    document.getElementById("detail-phone").innerHTML = `<i class="fa-solid fa-phone text-xs text-slate-400 mr-2"></i> ${lead.phone}`;
    document.getElementById("detail-phone").setAttribute("href", "tel:" + phoneClean);
    
    document.getElementById("detail-date-added").innerText = formatMalayDate(lead.dateAdded);
    document.getElementById("detail-date-contacted").innerText = formatMalayDateTime(lead.lastContactDate);

    // Initial Badge for Profile picture
    const initials = lead.name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    document.getElementById("detail-avatar").innerText = initials;

    // Status Badge
    let badgeClass = "bg-slate-500/10 text-slate-500";
    if (lead.status === "New Lead") badgeClass = "bg-brand-500/10 text-brand-500";
    else if (lead.status === "Closed Won") badgeClass = "bg-emerald-500/10 text-emerald-500";
    else if (lead.status === "Closed Lost") badgeClass = "bg-red-500/10 text-red-500";
    else if (lead.status === "Follow Up" || lead.status === "Interested") badgeClass = "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
    else if (lead.status === "Negotiation") badgeClass = "bg-indigo-500/10 text-indigo-500";

    document.getElementById("detail-status-badge").innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold ${badgeClass}">${lead.status}</span>`;

    // 2. Quick Actions setup
    // Format WhatsApp template
    const profileName = settings.profileName || "Ejen CRM";
    const wsTemplate = `Salam ${lead.name}, saya ${profileName}. Berkenaan perbincangan kita mengenai ${lead.product}...`;
    document.getElementById("action-whatsapp").setAttribute("href", `https://wa.me/${phoneClean}?text=${encodeURIComponent(wsTemplate)}`);
    document.getElementById("action-call").setAttribute("href", `tel:${phoneClean}`);

    // Set Change Status options
    const changeStatusSelect = document.getElementById("action-change-status");
    changeStatusSelect.innerHTML = "";
    settings.statuses.forEach(st => {
      changeStatusSelect.innerHTML += `<option value="${st}" ${st === lead.status ? "selected" : ""}>${st}</option>`;
    });

    // Unbind and rebind change event to avoid multiple triggers
    changeStatusSelect.onchange = null;
    changeStatusSelect.onchange = function () {
      const newStatus = this.value;
      if (newStatus !== lead.status) {
        lead.status = newStatus;
        window.API.saveLead(lead);
        renderLeadDetail(lead.id);
      }
    };

    // 3. Render Notes list
    const notesContainer = document.getElementById("detail-notes-container");
    notesContainer.innerHTML = "";
    const notesList = getLeadNotes(lead);
    
    if (notesList.length === 0) {
      notesContainer.innerHTML = `<div class="text-xs text-slate-400 text-center py-6">Tiada nota tambahan buat masa ini.</div>`;
    } else {
      // Sort notes newest first
      const sortedNotes = [...notesList].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      sortedNotes.forEach(note => {
        const item = document.createElement("div");
        item.className = "p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs relative group";
        item.innerHTML = `
          <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span>By System Owner</span>
            <span>${formatMalayDateTime(note.timestamp)}</span>
          </div>
          <p class="text-slate-700 dark:text-slate-350 pr-6">${note.text}</p>
          <button class="absolute top-3 right-3 text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity delete-note-btn" data-note-id="${note.id}" title="Padam Nota"><i class="fa-regular fa-trash-can"></i></button>
        `;
        notesContainer.appendChild(item);
      });

      // Bind delete note buttons
      document.querySelectorAll(".delete-note-btn").forEach(btn => {
        btn.addEventListener("click", function () {
          const noteId = this.getAttribute("data-note-id");
          if (confirm("Padam nota ini?")) {
            const currentNotes = getLeadNotes(lead);
            const filteredNotes = currentNotes.filter(n => n.id.toString() !== noteId.toString());
            
            lead.notes = JSON.stringify(filteredNotes);
            window.API.saveLead(lead);
            window.API.addActivity(lead.id, "Note Deleted", "A custom note was deleted from the lead profile");
            renderLeadDetail(lead.id);
          }
        });
      });
    }

    // 4. Render Activity Timeline
    const activities = window.API.getLeadActivities(lead.id);
    const timeline = document.getElementById("detail-activity-timeline");
    timeline.innerHTML = "";

    if (activities.length === 0) {
      timeline.innerHTML = `<div class="text-xs text-slate-400 text-center py-4 pl-4 border-l-0">Garis masa aktiviti kosong.</div>`;
    } else {
      activities.forEach(act => {
        const item = document.createElement("div");
        item.className = "relative pl-6 pb-2";
        
        let iconClass = "fa-solid fa-chevron-right text-brand-500 bg-brand-500/10";
        if (act.action.includes("Created")) iconClass = "fa-solid fa-plus text-indigo-500 bg-indigo-500/10";
        else if (act.action.includes("Status")) iconClass = "fa-solid fa-right-left text-orange-500 bg-orange-500/10";
        else if (act.action.includes("Won") || act.action.includes("Completed")) iconClass = "fa-solid fa-check text-emerald-500 bg-emerald-500/10";
        else if (act.action.includes("Lost") || act.action.includes("Cancelled")) iconClass = "fa-solid fa-xmark text-red-500 bg-red-500/10";
        else if (act.action.includes("Scheduled") || act.action.includes("Follow")) iconClass = "fa-solid fa-clock text-yellow-500 bg-yellow-500/10";
        
        item.innerHTML = `
          <span class="absolute -left-3.5 top-0.5 flex items-center justify-center w-7 h-7 rounded-full border-4 border-white dark:border-slate-900 ${iconClass} text-[10px]"></span>
          <div class="flex justify-between items-center text-[10px] text-slate-450 mb-1">
            <span class="font-bold text-slate-700 dark:text-slate-300 text-xs">${act.action}</span>
            <span>${formatMalayDateTime(act.timestamp)}</span>
          </div>
          <p class="text-slate-500 dark:text-slate-400 text-[11px]">${act.details}</p>
        `;
        timeline.appendChild(item);
      });
    }

    // 5. Render Lead specific Followups list
    const leadFollowups = window.API.getFollowups().filter(f => f.leadId === lead.id);
    const detailFollowupsList = document.getElementById("detail-followups-list");
    detailFollowupsList.innerHTML = "";

    if (leadFollowups.length === 0) {
      detailFollowupsList.innerHTML = `<div class="text-xs text-slate-400 text-center py-8">Tiada temujanji atau follow up dijadualkan.</div>`;
    } else {
      // Sort: upcoming and overdue first, completed at the end
      const sortedFollows = [...leadFollowups].sort((a, b) => {
        if (a.completed === b.completed) {
          return new Date(a.date + "T" + a.time) - new Date(b.date + "T" + b.time);
        }
        return a.completed === "true" ? 1 : -1;
      });

      sortedFollows.forEach(f => {
        const item = document.createElement("div");
        
        let borderClass = "border-yellow-500/20 bg-yellow-500/5";
        let titleClass = "text-yellow-600 dark:text-yellow-400";
        let isOverdue = false;
        
        const followDate = new Date(f.date + "T" + f.time);
        if (f.completed === "true") {
          borderClass = "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 opacity-70";
          titleClass = "text-slate-500 line-through";
        } else if (followDate < new Date()) {
          borderClass = "border-red-500/20 bg-red-500/5";
          titleClass = "text-red-500";
          isOverdue = true;
        }

        item.className = `p-4 rounded-2xl border ${borderClass} text-xs flex justify-between items-start space-x-3`;
        item.innerHTML = `
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2">
              <span class="font-bold ${titleClass}">${formatMalayDate(f.date)} pada ${f.time}</span>
              ${isOverdue ? '<span class="text-[9px] bg-red-500/10 text-red-500 font-bold px-1.5 py-0.5 rounded">Tunggakan</span>' : ""}
              ${f.completed === 'true' ? '<span class="text-[9px] bg-emerald-500/10 text-emerald-500 font-bold px-1.5 py-0.5 rounded">Selesai</span>' : ""}
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">${f.note}</p>
          </div>
          <div class="flex space-x-1">
            ${f.completed !== 'true' 
              ? `<button class="p-1 px-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors complete-lead-f-btn" data-id="${f.id}"><i class="fa-solid fa-check"></i></button>`
              : ""
            }
            <button class="p-1 px-2 border border-slate-200 dark:border-slate-800 rounded hover:bg-red-500/10 hover:text-red-500 transition-all delete-lead-f-btn" data-id="${f.id}"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        `;
        detailFollowupsList.appendChild(item);
      });

      // Bind buttons inside detail followups
      document.querySelectorAll(".complete-lead-f-btn").forEach(btn => {
        btn.addEventListener("click", function () {
          const id = this.getAttribute("data-id");
          const f = leadFollowups.find(item => item.id === id);
          if (f) {
            f.completed = "true";
            window.API.saveFollowup(f);
            renderLeadDetail(lead.id);
          }
        });
      });

      document.querySelectorAll(".delete-lead-f-btn").forEach(btn => {
        btn.addEventListener("click", function () {
          const id = this.getAttribute("data-id");
          if (confirm("Padam temujanji follow-up ini?")) {
            window.API.deleteFollowup(id);
            renderLeadDetail(lead.id);
          }
        });
      });
    }
  }

  // Handle Note Add form opening
  document.getElementById("add-note-btn").addEventListener("click", () => {
    document.getElementById("note-form-lead-id").value = activeDetailLeadId;
    document.getElementById("note-form-content").value = "";
    document.getElementById("note-modal").classList.remove("hidden");
  });

  // Handle Note Add submit
  document.getElementById("note-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const leadId = document.getElementById("note-form-lead-id").value;
    const content = document.getElementById("note-form-content").value.trim();
    
    if (content && leadId) {
      const lead = window.API.getLead(leadId);
      if (lead) {
        const currentNotes = getLeadNotes(lead);
        const newNoteObj = {
          id: "note_" + Date.now(),
          text: content,
          timestamp: new Date().toISOString()
        };
        currentNotes.unshift(newNoteObj);
        
        lead.notes = JSON.stringify(currentNotes);
        window.API.saveLead(lead);
        window.API.addActivity(lead.id, "Note Added", `Custom note added: "${content.substring(0, 45)}..."`);

        // Close modal and refresh
        document.getElementById("note-modal").classList.add("hidden");
        renderLeadDetail(leadId);
      }
    }
  });

  // Close Note Modal
  document.querySelectorAll(".note-modal-close").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("note-modal").classList.add("hidden");
    });
  });

  // Lead delete inside detail
  document.getElementById("detail-delete-btn").addEventListener("click", () => {
    if (activeDetailLeadId && confirm("Padamkan lead ini dan semua fail log? Tindakan ini kekal.")) {
      window.API.deleteLead(activeDetailLeadId);
      window.location.hash = "#leads";
    }
  });

  // Lead edit inside detail
  document.getElementById("detail-edit-btn").addEventListener("click", () => {
    if (activeDetailLeadId) {
      openLeadModal(activeDetailLeadId);
    }
  });

  // Tab switcher in lead detail
  document.querySelectorAll(".detail-tab-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      // Toggle tabs
      document.querySelectorAll(".detail-tab-btn").forEach(b => {
        b.className = "detail-tab-btn flex-1 py-2.5 px-4 text-xs font-semibold rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all";
      });
      this.className = "detail-tab-btn flex-1 py-2.5 px-4 text-xs font-semibold rounded-xl bg-brand-500 text-white transition-all";

      const tab = this.getAttribute("data-tab");
      document.querySelectorAll(".detail-tab-content").forEach(content => {
        content.classList.add("hidden");
      });
      document.getElementById(`tab-${tab}`).classList.remove("hidden");
    });
  });

  // ----------------------------------------------------
  // MODULE: FOLLOW UP (CALENDAR & LIST VIEWS)
  // ----------------------------------------------------
  function renderFollowups() {
    const followups = window.API.getFollowups();
    const leads = window.API.getLeads();
    const todayStr = new Date().toISOString().split("T")[0];

    // Compute Badge numbers
    const overdueList = followups.filter(f => f.date < todayStr && f.completed !== "true");
    const pendingList = followups.filter(f => f.completed !== "true");
    
    const overdueBadge = document.getElementById("followups-overdue-badge");
    const pendingBadge = document.getElementById("followups-pending-badge");

    if (overdueList.length > 0) {
      overdueBadge.innerText = overdueList.length + " Tunggakan";
      overdueBadge.classList.remove("hidden");
    } else {
      overdueBadge.classList.add("hidden");
    }
    pendingBadge.innerText = pendingList.length + " Belum Selesai";

    // Set view modes
    const listView = document.getElementById("followups-list-view");
    const calendarView = document.getElementById("followups-calendar-view");

    if (state.followupViewMode === "list") {
      listView.classList.remove("hidden");
      calendarView.classList.add("hidden");
      renderFollowupsList(followups, leads, todayStr);
    } else {
      listView.classList.add("hidden");
      calendarView.classList.remove("hidden");
      renderFollowupsCalendar(followups, leads);
    }
  }

  // Followups Tab Views Bindings
  document.querySelectorAll(".followup-view-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".followup-view-btn").forEach(b => {
        b.className = "followup-view-btn py-2 px-4 text-xs font-semibold rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all";
      });
      this.className = "followup-view-btn py-2 px-4 text-xs font-semibold rounded-xl bg-brand-500 text-white transition-all";
      state.followupViewMode = this.getAttribute("data-view-mode");
      renderFollowups();
    });
  });

  // Render List View columns
  function renderFollowupsList(followups, leads, todayStr) {
    const overdueContainer = document.getElementById("followups-overdue-list");
    const upcomingContainer = document.getElementById("followups-upcoming-list");
    const completedContainer = document.getElementById("followups-completed-list");

    overdueContainer.innerHTML = "";
    upcomingContainer.innerHTML = "";
    completedContainer.innerHTML = "";

    const overdue = [];
    const upcoming = [];
    const completed = [];

    // Grouping
    followups.forEach(f => {
      if (f.completed === "true") {
        completed.push(f);
      } else if (f.date < todayStr) {
        overdue.push(f);
      } else {
        upcoming.push(f);
      }
    });

    // Count badges updates
    document.getElementById("count-overdue").innerText = overdue.length;
    document.getElementById("count-upcoming").innerText = upcoming.length;
    document.getElementById("count-completed").innerText = completed.length;

    // Helper: Generate Followup Cards
    const createFollowCard = (f) => {
      const lead = leads.find(l => l.id === f.leadId) || { name: "Unknown Lead", phone: "" };
      const card = document.createElement("div");
      card.className = "p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-3 relative group shadow-sm hover:border-brand-500/20 transition-all";
      
      let dateColor = "text-brand-500";
      if (f.completed === "true") dateColor = "text-slate-400 line-through";
      else if (f.date < todayStr) dateColor = "text-red-500 font-bold";

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <a href="#lead-detail?id=${f.leadId}" class="font-bold hover:text-brand-500 transition-colors text-sm truncate max-w-[150px]">${lead.name}</a>
          <span class="text-[10px] font-semibold ${dateColor}">${formatMalayDate(f.date)} @ ${f.time}</span>
        </div>
        <p class="text-slate-500 dark:text-slate-400 text-[11px] line-clamp-2">${f.note}</p>
        
        <div class="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <a href="tel:${lead.phone.replace(/[^0-9+]/g, "")}" class="text-blue-500 hover:underline flex items-center"><i class="fa-solid fa-phone mr-1"></i> Hubungi</a>
          <div class="flex space-x-1">
            ${f.completed !== 'true'
              ? `<button class="p-1 px-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors f-complete-btn" data-id="${f.id}" title="Selesai"><i class="fa-solid fa-check text-[10px]"></i></button>`
              : ""
            }
            <button class="p-1 px-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-all f-delete-btn" data-id="${f.id}" title="Padam"><i class="fa-regular fa-trash-can text-[10px]"></i></button>
          </div>
        </div>
      `;
      return card;
    };

    // 1. Populate Overdue Column
    if (overdue.length === 0) {
      overdueContainer.innerHTML = `<div class="text-xs text-slate-400 text-center py-10">Tiada tugasan tunggakan. Baik!</div>`;
    } else {
      overdue.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(f => {
        overdueContainer.appendChild(createFollowCard(f));
      });
    }

    // 2. Populate Upcoming/Today Column
    if (upcoming.length === 0) {
      upcomingContainer.innerHTML = `<div class="text-xs text-slate-400 text-center py-10">Tiada tugasan hari ini & mendatang.</div>`;
    } else {
      upcoming.sort((a, b) => new Date(a.date + "T" + a.time) - new Date(b.date + "T" + b.time)).forEach(f => {
        upcomingContainer.appendChild(createFollowCard(f));
      });
    }

    // 3. Populate Completed Column
    if (completed.length === 0) {
      completedContainer.innerHTML = `<div class="text-xs text-slate-400 text-center py-10">Belum ada tugasan diselesaikan.</div>`;
    } else {
      completed.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(f => {
        completedContainer.appendChild(createFollowCard(f));
      });
    }

    // Bind events
    document.querySelectorAll(".f-complete-btn").forEach(btn => {
      btn.addEventListener("click", function () {
        const id = this.getAttribute("data-id");
        const f = followups.find(item => item.id === id);
        if (f) {
          f.completed = "true";
          window.API.saveFollowup(f);
          renderFollowups();
        }
      });
    });

    document.querySelectorAll(".f-delete-btn").forEach(btn => {
      btn.addEventListener("click", function () {
        const id = this.getAttribute("data-id");
        if (confirm("Adakah anda pasti mahu memadamkan follow-up ini?")) {
          window.API.deleteFollowup(id);
          renderFollowups();
        }
      });
    });
  }

  // Render Calendar monthly grid
  function renderFollowupsCalendar(followups, leads) {
    const year = state.calendar.currentYear;
    const month = state.calendar.currentMonth;
    
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const monthsMalay = [
      "Januari", "Februari", "Mac", "April", "Mei", "Jun", 
      "Julai", "Ogos", "September", "Oktober", "November", "Disember"
    ];

    document.getElementById("calendar-month-year").innerText = `${monthsMalay[month]} ${year}`;

    // Get first day of the month and number of days
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday, 6 = Saturday
    const totalDays = new Date(year, month + 1, 0).getDate();

    const daysGrid = document.getElementById("calendar-days-grid");
    daysGrid.innerHTML = "";

    // Prev month pad days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayCell = document.createElement("div");
      dayCell.className = "h-24 p-1 bg-slate-50/50 dark:bg-slate-900/10 text-slate-350 dark:text-slate-700 border-r border-b border-slate-100 dark:border-slate-800 text-[10px] text-right font-medium";
      dayCell.innerText = prevMonthDays - i;
      daysGrid.appendChild(dayCell);
    }

    // Active days of the month
    for (let day = 1; day <= totalDays; day++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayCell = document.createElement("div");
      
      let cellClass = "h-24 p-1.5 bg-white dark:bg-slate-900 border-r border-b border-slate-150 dark:border-slate-800/80 cursor-pointer hover:bg-brand-500/5 transition-colors relative flex flex-col justify-between";
      
      if (dayStr === todayStr) {
        cellClass += " ring-2 ring-brand-500/80 ring-inset bg-brand-500/5 dark:bg-brand-500/5";
      }

      dayCell.className = cellClass;
      dayCell.setAttribute("data-date", dayStr);

      // Label number
      const label = document.createElement("div");
      label.className = "text-xs font-bold text-slate-700 dark:text-slate-300 text-right";
      label.innerText = day;
      dayCell.appendChild(label);

      // Match follow-ups for this day
      const dayFollowups = followups.filter(f => f.date === dayStr);
      
      if (dayFollowups.length > 0) {
        const dotsContainer = document.createElement("div");
        dotsContainer.className = "flex flex-wrap gap-1 mt-1 pr-1 max-h-[35px] overflow-hidden no-scrollbar";
        
        dayFollowups.forEach(f => {
          const dot = document.createElement("span");
          
          let dotColor = "bg-yellow-500"; // Pending / Upcoming
          if (f.completed === "true") dotColor = "bg-emerald-500";
          else if (f.date < todayStr) dotColor = "bg-red-500 animate-pulse";

          dot.className = `w-2 h-2 rounded-full ${dotColor}`;
          dot.setAttribute("title", f.note);
          dotsContainer.appendChild(dot);
        });
        
        dayCell.appendChild(dotsContainer);
      }

      // Add selection style
      if (state.calendar.selectedDate === dayStr) {
        dayCell.classList.add("bg-brand-500/10", "dark:bg-brand-500/10");
      }

      // Click event
      dayCell.addEventListener("click", function () {
        document.querySelectorAll("#calendar-days-grid > div").forEach(c => {
          c.classList.remove("bg-brand-500/10", "dark:bg-brand-500/10");
        });
        this.classList.add("bg-brand-500/10", "dark:bg-brand-500/10");
        state.calendar.selectedDate = this.getAttribute("data-date");
        renderCalendarSelectedDayEvents(state.calendar.selectedDate, followups, leads);
      });

      daysGrid.appendChild(dayCell);
    }

    // Next month pad days to fill grid of 7x6 = 42 cells or 7x5
    const renderedCells = firstDayIndex + totalDays;
    const remainingCells = renderedCells % 7 === 0 ? 0 : 7 - (renderedCells % 7);
    
    for (let i = 1; i <= remainingCells; i++) {
      const dayCell = document.createElement("div");
      dayCell.className = "h-24 p-1 bg-slate-50/50 dark:bg-slate-900/10 text-slate-350 dark:text-slate-700 border-r border-b border-slate-100 dark:border-slate-800 text-[10px] text-right font-medium";
      dayCell.innerText = i;
      daysGrid.appendChild(dayCell);
    }

    // Render initial Selected Day drawer
    renderCalendarSelectedDayEvents(state.calendar.selectedDate, followups, leads);
  }

  function renderCalendarSelectedDayEvents(dateStr, followups, leads) {
    const displayDate = document.getElementById("calendar-selected-date-text");
    const container = document.getElementById("calendar-selected-events");
    
    displayDate.innerText = formatMalayDate(dateStr);
    container.innerHTML = "";

    const dayFollowups = followups.filter(f => f.date === dateStr);

    if (dayFollowups.length === 0) {
      container.innerHTML = `<div class="text-xs text-slate-400 py-6 text-center">Tiada tugasan follow up pada tarikh ini.</div>`;
    } else {
      dayFollowups.forEach(f => {
        const lead = leads.find(l => l.id === f.leadId) || { name: "Unknown Lead" };
        const card = document.createElement("div");
        
        let statusBadge = `<span class="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 rounded text-[9px] font-bold">Upcoming</span>`;
        if (f.completed === "true") {
          statusBadge = `<span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[9px] font-bold">Completed</span>`;
        } else if (f.date < new Date().toISOString().split("T")[0]) {
          statusBadge = `<span class="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold">Overdue</span>`;
        }

        card.className = "p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center text-xs";
        card.innerHTML = `
          <div>
            <div class="flex items-center space-x-2">
              <span class="font-bold text-brand-500">${f.time}</span>
              <a href="#lead-detail?id=${f.leadId}" class="font-semibold hover:underline">${lead.name}</a>
              ${statusBadge}
            </div>
            <p class="text-slate-500 dark:text-slate-400 text-[10px] mt-1">${f.note}</p>
          </div>
          <div>
            ${f.completed !== 'true'
              ? `<button class="p-1 px-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors cal-complete-f-btn" data-id="${f.id}"><i class="fa-solid fa-check text-[10px]"></i></button>`
              : ""
            }
          </div>
        `;
        container.appendChild(card);
      });

      // Bind complete btn inside calendar drawer
      document.querySelectorAll(".cal-complete-f-btn").forEach(btn => {
        btn.addEventListener("click", function () {
          const id = this.getAttribute("data-id");
          const f = followups.find(item => item.id === id);
          if (f) {
            f.completed = "true";
            window.API.saveFollowup(f);
            renderFollowups(); // Redraw
          }
        });
      });
    }
  }

  // Calendar prev/next navigation
  document.getElementById("cal-prev-month").addEventListener("click", () => {
    state.calendar.currentMonth--;
    if (state.calendar.currentMonth < 0) {
      state.calendar.currentMonth = 11;
      state.calendar.currentYear--;
    }
    renderFollowups();
  });

  document.getElementById("cal-next-month").addEventListener("click", () => {
    state.calendar.currentMonth++;
    if (state.calendar.currentMonth > 11) {
      state.calendar.currentMonth = 0;
      state.calendar.currentYear++;
    }
    renderFollowups();
  });

  document.getElementById("cal-today").addEventListener("click", () => {
    const today = new Date();
    state.calendar.currentMonth = today.getMonth();
    state.calendar.currentYear = today.getFullYear();
    state.calendar.selectedDate = today.toISOString().split("T")[0];
    renderFollowups();
  });

  // ----------------------------------------------------
  // MODULE: ANALYTICS
  // ----------------------------------------------------
  function renderAnalytics() {
    const leads = window.API.getLeads();
    const settings = window.API.getSettings();

    // Destroy active charts to allow redraw
    Object.keys(state.charts).forEach(key => {
      if (state.charts[key]) state.charts[key].destroy();
    });

    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#cbd5e1" : "#475569";
    const gridColor = isDark ? "#334155" : "#e2e8f0";

    // 1. Chart: Leads by Source (Doughnut)
    const sourceCounts = {};
    settings.sources.forEach(s => sourceCounts[s] = 0);
    leads.forEach(l => {
      if (sourceCounts[l.source] !== undefined) {
        sourceCounts[l.source]++;
      } else {
        sourceCounts["Other"] = (sourceCounts["Other"] || 0) + 1;
      }
    });

    const sourceLabels = Object.keys(sourceCounts).filter(k => sourceCounts[k] > 0);
    const sourceValues = sourceLabels.map(k => sourceCounts[k]);

    const ctxSource = document.getElementById("chart-leads-by-source").getContext("2d");
    state.charts.source = new Chart(ctxSource, {
      type: "doughnut",
      data: {
        labels: sourceLabels,
        datasets: [{
          data: sourceValues,
          backgroundColor: [
            "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", 
            "#ec4899", "#8b5cf6", "#14b8a6", "#f43f5e", "#a855f7"
          ],
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? "#0f172a" : "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { color: textColor, font: { size: 10 } }
          }
        }
      }
    });

    // 2. Chart: Leads by Niche (Bar)
    const nicheCounts = {};
    settings.niches.forEach(n => nicheCounts[n] = 0);
    leads.forEach(l => {
      if (nicheCounts[l.niche] !== undefined) nicheCounts[l.niche]++;
    });

    const nicheLabels = Object.keys(nicheCounts);
    const nicheValues = nicheLabels.map(k => nicheCounts[k]);

    const ctxNiche = document.getElementById("chart-leads-by-niche").getContext("2d");
    state.charts.niche = new Chart(ctxNiche, {
      type: "bar",
      data: {
        labels: nicheLabels,
        datasets: [{
          label: "Jumlah Lead",
          data: nicheValues,
          backgroundColor: "rgba(99, 102, 241, 0.75)",
          borderColor: "#6366f1",
          borderRadius: 8,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor, font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } }
        }
      }
    });

    // 3. Chart: Leads by Status (Polar Area / Doughnut)
    const statusCounts = {};
    settings.statuses.forEach(st => statusCounts[st] = 0);
    leads.forEach(l => {
      if (statusCounts[l.status] !== undefined) statusCounts[l.status]++;
    });

    const statusLabels = Object.keys(statusCounts).filter(k => statusCounts[k] > 0);
    const statusValues = statusLabels.map(k => statusCounts[k]);

    const ctxStatus = document.getElementById("chart-leads-by-status").getContext("2d");
    state.charts.status = new Chart(ctxStatus, {
      type: "polarArea",
      data: {
        labels: statusLabels,
        datasets: [{
          data: statusValues,
          backgroundColor: [
            "rgba(99, 102, 241, 0.7)", "rgba(59, 130, 246, 0.7)", "rgba(245, 158, 11, 0.7)",
            "rgba(16, 185, 129, 0.7)", "rgba(239, 68, 68, 0.7)", "rgba(236, 72, 153, 0.7)"
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { color: textColor, font: { size: 10 } } }
        },
        scales: {
          r: {
            grid: { color: gridColor },
            angleLines: { color: gridColor },
            pointLabels: { color: textColor }
          }
        }
      }
    });

    // 4. Chart: Monthly Trends (Line)
    // Gather counts for last 6 months
    const trendCounts = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      trendCounts[key] = { label: d.toLocaleDateString("ms-MY", { month: "short" }), count: 0 };
    }

    leads.forEach(l => {
      if (!l.dateAdded) return;
      const d = new Date(l.dateAdded);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (trendCounts[key]) {
        trendCounts[key].count++;
      }
    });

    const trendLabels = Object.keys(trendCounts).map(k => trendCounts[k].label);
    const trendValues = Object.keys(trendCounts).map(k => trendCounts[k].count);

    const ctxTrend = document.getElementById("chart-leads-monthly-trend").getContext("2d");
    state.charts.trend = new Chart(ctxTrend, {
      type: "line",
      data: {
        labels: trendLabels,
        datasets: [{
          label: "Leads Baru",
          data: trendValues,
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.1)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointBackgroundColor: "#8b5cf6"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } }
        }
      }
    });

    // 5. Populate Table: Best Performing Source
    const sourceTable = document.getElementById("analytics-table-source");
    sourceTable.innerHTML = "";

    const sourceStats = {};
    settings.sources.forEach(s => sourceStats[s] = { total: 0, won: 0 });
    leads.forEach(l => {
      if (sourceStats[l.source]) {
        sourceStats[l.source].total++;
        if (l.status === "Closed Won") {
          sourceStats[l.source].won++;
        }
      }
    });

    const sortedSources = Object.keys(sourceStats)
      .map(k => ({ name: k, ...sourceStats[k] }))
      .filter(item => item.total > 0)
      .sort((a, b) => b.won - a.won);

    if (sortedSources.length === 0) {
      sourceTable.innerHTML = '<tr><td colspan="3" class="py-4 text-center text-slate-400">Tiada rekod data dianalisa.</td></tr>';
    } else {
      sortedSources.forEach(item => {
        const convRate = item.total > 0 ? Math.round((item.won / item.total) * 100) : 0;
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors";
        tr.innerHTML = `
          <td class="py-3 font-semibold text-slate-700 dark:text-slate-350">${item.name}</td>
          <td class="py-3 text-center text-emerald-500 font-bold">${item.won}</td>
          <td class="py-3 text-center font-bold">${convRate}% <span class="text-[9px] text-slate-400 font-normal">(${item.won}/${item.total})</span></td>
        `;
        sourceTable.appendChild(tr);
      });
    }

    // 6. Populate Table: Niche Breakdown
    const nicheTable = document.getElementById("analytics-table-niche");
    nicheTable.innerHTML = "";

    const nicheStats = {};
    settings.niches.forEach(n => nicheStats[n] = { total: 0, won: 0 });
    leads.forEach(l => {
      if (nicheStats[l.niche]) {
        nicheStats[l.niche].total++;
        if (l.status === "Closed Won") {
          nicheStats[l.niche].won++;
        }
      }
    });

    const sortedNiches = Object.keys(nicheStats)
      .map(k => ({ name: k, ...nicheStats[k] }))
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total);

    if (sortedNiches.length === 0) {
      nicheTable.innerHTML = '<tr><td colspan="3" class="py-4 text-center text-slate-400">Tiada rekod data dianalisa.</td></tr>';
    } else {
      sortedNiches.forEach(item => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors";
        tr.innerHTML = `
          <td class="py-3 font-semibold text-slate-700 dark:text-slate-350">${item.name}</td>
          <td class="py-3 text-center font-bold">${item.total}</td>
          <td class="py-3 text-center text-emerald-500 font-bold">${item.won}</td>
        `;
        nicheTable.appendChild(tr);
      });
    }
  }

  // ----------------------------------------------------
  // MODULE: SETTINGS
  // ----------------------------------------------------
  function renderSettings() {
    const settings = window.API.getSettings();

    // Populate inputs
    document.getElementById("set-profile-name").value = settings.profileName || "";
    document.getElementById("set-profile-email").value = settings.profileEmail || "";
    document.getElementById("set-profile-company").value = settings.profileCompany || "";
    document.getElementById("set-app-passcode").value = settings.appPasscode || "";
    document.getElementById("set-gas-url").value = settings.googleAppsScriptUrl || "";
    document.getElementById("set-gas-passcode").value = settings.apiPasscode || "";

    // 1. Populate custom niches chip list
    const nicheList = document.getElementById("settings-niche-list");
    nicheList.innerHTML = "";
    settings.niches.forEach(n => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 text-xs";
      li.innerHTML = `
        <span class="font-semibold text-slate-700 dark:text-slate-300">${n}</span>
        <button class="text-red-500 hover:text-red-650 delete-niche-setting-btn" data-name="${n}"><i class="fa-solid fa-times-circle text-sm"></i></button>
      `;
      nicheList.appendChild(li);
    });

    // 2. Populate custom sources chip list
    const sourceList = document.getElementById("settings-source-list");
    sourceList.innerHTML = "";
    settings.sources.forEach(s => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 text-xs";
      li.innerHTML = `
        <span class="font-semibold text-slate-700 dark:text-slate-300">${s}</span>
        <button class="text-red-500 hover:text-red-650 delete-source-setting-btn" data-name="${s}"><i class="fa-solid fa-times-circle text-sm"></i></button>
      `;
      sourceList.appendChild(li);
    });

    // Bind deletes
    document.querySelectorAll(".delete-niche-setting-btn").forEach(btn => {
      btn.addEventListener("click", function () {
        const name = this.getAttribute("data-name");
        if (confirm(`Padam niche "${name}" dari tetapan dropdown?`)) {
          const list = settings.niches.filter(item => item !== name);
          window.API.saveSettings({ niches: list });
          renderSettings();
        }
      });
    });

    document.querySelectorAll(".delete-source-setting-btn").forEach(btn => {
      btn.addEventListener("click", function () {
        const name = this.getAttribute("data-name");
        if (confirm(`Padam source "${name}" dari tetapan dropdown?`)) {
          const list = settings.sources.filter(item => item !== name);
          window.API.saveSettings({ sources: list });
          renderSettings();
        }
      });
    });
  }

  // Handle Profile Form Submit
  document.getElementById("settings-profile-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const name = document.getElementById("set-profile-name").value.trim();
    const email = document.getElementById("set-profile-email").value.trim();
    const company = document.getElementById("set-profile-company").value.trim();

    window.API.saveSettings({
      profileName: name,
      profileEmail: email,
      profileCompany: company
    });

    // Update sidebar UI immediately
    document.getElementById("user-profile-name").innerText = name;
    document.getElementById("user-profile-company").innerText = company;
    const initials = name.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase();
    document.getElementById("user-initials").innerText = initials;

    alert("Profil berjaya dikemaskini!");
  });

  // Handle App Passcode PIN Security Update
  document.getElementById("settings-security-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const pin = document.getElementById("set-app-passcode").value.trim();
    
    window.API.saveSettings({ appPasscode: pin });
    alert("Kunci PIN keselamatan berjaya dikemaskini!");
  });

  // Add custom Niche
  document.getElementById("add-niche-btn").addEventListener("click", () => {
    const input = document.getElementById("new-niche-input");
    const val = input.value.trim();
    if (val) {
      const settings = window.API.getSettings();
      if (!settings.niches.includes(val)) {
        settings.niches.push(val);
        window.API.saveSettings({ niches: settings.niches });
        input.value = "";
        renderSettings();
      }
    }
  });

  // Add custom Source
  document.getElementById("add-source-btn").addEventListener("click", () => {
    const input = document.getElementById("new-source-input");
    const val = input.value.trim();
    if (val) {
      const settings = window.API.getSettings();
      if (!settings.sources.includes(val)) {
        settings.sources.push(val);
        window.API.saveSettings({ sources: settings.sources });
        input.value = "";
        renderSettings();
      }
    }
  });

  // Sync / Cloud Sync setup
  const gasInput = document.getElementById("set-gas-url");
  const gasPasscode = document.getElementById("set-gas-passcode");
  const consoleOut = document.getElementById("sync-console-output");

  function logConsole(msg, isError = false) {
    consoleOut.classList.remove("hidden");
    consoleOut.innerText = (isError ? "🚨 ERROR: " : "📋 SYSTEM: ") + msg;
    if (isError) {
      consoleOut.classList.add("text-red-500", "border-red-500/20", "bg-red-500/5");
      consoleOut.classList.remove("text-slate-700", "dark:text-slate-300");
    } else {
      consoleOut.classList.remove("text-red-500", "border-red-500/20", "bg-red-500/5");
      consoleOut.classList.add("text-slate-700", "dark:text-slate-300");
    }
  }

  // Connection Test
  document.getElementById("settings-test-conn").addEventListener("click", async () => {
    const url = gasInput.value.trim();
    const passcode = gasPasscode.value.trim();

    if (!url) {
      alert("Sila masukkan URL Google Apps Script!");
      return;
    }

    logConsole("Menguji sambungan ke Apps Script...");
    
    // Temporarily save to trigger testing
    window.API.saveSettings({ googleAppsScriptUrl: url, apiPasscode: passcode });

    try {
      const success = await window.API.fetchFromGoogleSheets();
      if (success) {
        logConsole("Sambungan BERJAYA! Data berjaya ditarik dari Google Sheet.");
        alert("Sambungan Google Sheet Berjaya!");
        updateSyncBadge();
      }
    } catch (e) {
      logConsole(e.message, true);
      alert("Gagal menyambung. Sila periksa Web App URL / kebenaran Apps Script CORS.");
    }
  });

  // Sync now
  document.getElementById("settings-sync-now").addEventListener("click", async () => {
    const url = gasInput.value.trim();
    const passcode = gasPasscode.value.trim();

    if (!url) {
      alert("Sila masukkan URL Google Apps Script!");
      return;
    }

    logConsole("Memulakan penyelarasan data (Synchronizing)...");
    window.API.saveSettings({ googleAppsScriptUrl: url, apiPasscode: passcode });

    try {
      const res = await window.API.syncWithGoogleSheets();
      if (res.success) {
        const timeStr = new Date().toLocaleTimeString("ms-MY") + " " + new Date().toLocaleDateString("ms-MY");
        localStorage.setItem("lead_tracker_crm_last_sync", timeStr);
        logConsole(`Penyelarasan SELESAI!\n${res.message}\nTarikh Sync: ${timeStr}`);
        alert("Penyelarasan Berjaya!");
        updateSyncBadge();
      }
    } catch (e) {
      logConsole(e.message, true);
      alert("Penyelarasan Gagal: " + e.message);
    }
  });

  // Sidebar sync shortcut
  document.getElementById("sidebar-sync-btn").addEventListener("click", async () => {
    const settings = window.API.getSettings();
    if (!settings.googleAppsScriptUrl) {
      alert("Sila konfigurasi URL Google Sheets di tab Settings terlebih dahulu!");
      window.location.hash = "#settings";
      return;
    }

    try {
      document.getElementById("sidebar-sync-btn").disabled = true;
      document.getElementById("sidebar-sync-btn").innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> <span>Syncing...</span>';
      
      const res = await window.API.syncWithGoogleSheets();
      if (res.success) {
        const timeStr = new Date().toLocaleTimeString("ms-MY") + " " + new Date().toLocaleDateString("ms-MY");
        localStorage.setItem("lead_tracker_crm_last_sync", timeStr);
        document.getElementById("sidebar-sync-time").innerText = timeStr;
        alert("Penyelarasan Google Sheets Selesai!");
        
        // Redraw current view
        router();
      }
    } catch (e) {
      alert("Ralat Sync: " + e.message);
    } finally {
      document.getElementById("sidebar-sync-btn").disabled = false;
      document.getElementById("sidebar-sync-btn").innerHTML = '<i class="fa-solid fa-rotate"></i> <span>Sync Spreadsheet</span>';
    }
  });

  // Database actions: Export JSON
  document.getElementById("db-export").addEventListener("click", () => {
    const backup = {
      leads: window.API.getLeads(),
      followups: window.API.getFollowups(),
      activities: window.API.getActivities(),
      settings: window.API.getSettings()
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lead_tracker_crm_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Database actions: Import JSON
  document.getElementById("db-import-file").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const data = JSON.parse(evt.target.result);
        
        if (data.leads && data.followups && data.activities && data.settings) {
          window.API.setData("leads", data.leads);
          window.API.setData("followups", data.followups);
          window.API.setData("activities", data.activities);
          window.API.setData("settings", data.settings);
          window.API.setData("initialized", true);
          
          alert("Pangkalan data berjaya diimport! Halaman akan dimuatkan semula.");
          window.location.reload();
        } else {
          alert("Struktur fail JSON sandaran tidak lengkap.");
        }
      } catch (err) {
        alert("Gagal membaca fail JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Database actions: Reset DB
  document.getElementById("db-reset").addEventListener("click", () => {
    if (confirm("AWAS: Tindakan ini akan memadam semua rekod lead, follow-up, aktiviti, dan tetapan local. Adakah anda pasti?")) {
      window.API.resetToDefaults();
      alert("Pangkalan data telah direset semula ke mock data asal.");
      window.location.reload();
    }
  });

  // ----------------------------------------------------
  // THEME TOGGLE
  // ----------------------------------------------------
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    window.API.saveSettings({ theme: isDark ? "dark" : "light" });
    
    // If currently rendering analytics, charts need redrawing with updated theme colors
    if (state.currentView === "analytics") {
      renderAnalytics();
    }
  });

  // Mobile sidebar toggle
  document.getElementById("mobile-sidebar-toggle").addEventListener("click", () => {
    // Simple alert for layout
    const sidebar = document.querySelector("aside");
    sidebar.classList.toggle("hidden");
    sidebar.classList.toggle("fixed");
    sidebar.classList.toggle("inset-y-0");
    sidebar.classList.toggle("left-0");
    sidebar.classList.toggle("bg-white");
    sidebar.classList.toggle("dark:bg-slate-900");
    sidebar.classList.toggle("shadow-2xl");
  });

  // ----------------------------------------------------
  // LEAD CREATE & EDIT MODAL CONTROLLERS
  // ----------------------------------------------------
  function openLeadModal(leadId = null) {
    const modal = document.getElementById("lead-modal");
    const form = document.getElementById("lead-form");
    const title = document.getElementById("lead-modal-title");
    const settings = window.API.getSettings();

    // Populate dropdown options inside form
    const formNiche = document.getElementById("lead-form-niche");
    const formSource = document.getElementById("lead-form-source");
    const formStatus = document.getElementById("lead-form-status");

    formNiche.innerHTML = "";
    settings.niches.forEach(n => {
      formNiche.innerHTML += `<option value="${n}">${n}</option>`;
    });

    formSource.innerHTML = "";
    settings.sources.forEach(s => {
      formSource.innerHTML += `<option value="${s}">${s}</option>`;
    });

    formStatus.innerHTML = "";
    settings.statuses.forEach(st => {
      formStatus.innerHTML += `<option value="${st}">${st}</option>`;
    });

    form.reset();

    if (leadId) {
      title.innerText = "Kemaskini Butiran Lead";
      const lead = window.API.getLead(leadId);
      if (lead) {
        document.getElementById("lead-form-id").value = lead.id;
        document.getElementById("lead-form-date-added").value = lead.dateAdded;
        document.getElementById("lead-form-name").value = lead.name;
        document.getElementById("lead-form-phone").value = lead.phone;
        document.getElementById("lead-form-email").value = lead.email || "";
        document.getElementById("lead-form-niche").value = lead.niche;
        document.getElementById("lead-form-product").value = lead.product;
        document.getElementById("lead-form-source").value = lead.source;
        document.getElementById("lead-form-status").value = lead.status;
        
        // Handle notes text (strip JSON formatting if any for simple editing)
        const notes = getLeadNotes(lead);
        if (notes.length > 0) {
          // If first note is system generated, just show its text, otherwise join notes text
          document.getElementById("lead-form-notes").value = notes.map(n => n.text).join("\n");
        } else {
          document.getElementById("lead-form-notes").value = "";
        }
      }
    } else {
      title.innerText = "Tambah Lead Baru";
      document.getElementById("lead-form-id").value = "";
      document.getElementById("lead-form-date-added").value = "";
    }

    modal.classList.remove("hidden");
  }

  // Handle lead form submission
  document.getElementById("lead-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const id = document.getElementById("lead-form-id").value;
    const dateAdded = document.getElementById("lead-form-date-added").value;
    const name = document.getElementById("lead-form-name").value.trim();
    const phone = document.getElementById("lead-form-phone").value.trim();
    const email = document.getElementById("lead-form-email").value.trim();
    const niche = document.getElementById("lead-form-niche").value;
    const product = document.getElementById("lead-form-product").value.trim();
    const source = document.getElementById("lead-form-source").value;
    const status = document.getElementById("lead-form-status").value;
    const noteText = document.getElementById("lead-form-notes").value.trim();

    let notesPayload = "";
    if (id) {
      // Edit mode: merge new note text or preserve
      const oldLead = window.API.getLead(id);
      const oldNotes = getLeadNotes(oldLead);
      
      // If noteText is typed and differs from combined old notes
      const combinedOldText = oldNotes.map(n => n.text).join("\n");
      if (noteText && noteText !== combinedOldText) {
        // Append as a new note entry
        const newNoteObj = {
          id: "note_" + Date.now(),
          text: noteText,
          timestamp: new Date().toISOString()
        };
        oldNotes.unshift(newNoteObj);
        notesPayload = JSON.stringify(oldNotes);
      } else {
        notesPayload = oldLead.notes;
      }
    } else {
      // New lead: store noteText as a single JSON note entry inside array
      if (noteText) {
        notesPayload = JSON.stringify([{
          id: "note_" + Date.now(),
          text: noteText,
          timestamp: new Date().toISOString()
        }]);
      }
    }

    const leadData = {
      id: id || "lead_" + Date.now(),
      name: name,
      phone: phone,
      email: email,
      niche: niche,
      product: product,
      source: source,
      status: status,
      notes: notesPayload
    };

    if (dateAdded) {
      leadData.dateAdded = dateAdded;
    }

    window.API.saveLead(leadData);

    // Hide Modal and refresh
    document.getElementById("lead-modal").classList.add("hidden");
    
    if (state.currentView === "lead-detail" && id === activeDetailLeadId) {
      renderLeadDetail(id);
    } else {
      // Go to leads tab and refresh list
      window.location.hash = "#leads";
      renderLeadsList();
    }
  });

  // Bind Open Buttons
  document.getElementById("quick-add-lead-btn").addEventListener("click", () => openLeadModal());
  
  // Bind close buttons
  document.querySelectorAll(".lead-modal-close").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("lead-modal").classList.add("hidden");
    });
  });

  // ----------------------------------------------------
  // FOLLOW UP MODAL CONTROLLERS
  // ----------------------------------------------------
  function openFollowupModal(leadId) {
    const modal = document.getElementById("followup-modal");
    const form = document.getElementById("followup-form");
    
    form.reset();
    document.getElementById("followup-form-id").value = "";
    document.getElementById("followup-form-lead-id").value = leadId;

    // Set tomorrow's date as default
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById("followup-form-date").value = tomorrow.toISOString().split("T")[0];
    document.getElementById("followup-form-time").value = "10:00";

    modal.classList.remove("hidden");
  }

  // Handle follow up schedule submit
  document.getElementById("followup-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const id = document.getElementById("followup-form-id").value;
    const leadId = document.getElementById("followup-form-lead-id").value;
    const date = document.getElementById("followup-form-date").value;
    const time = document.getElementById("followup-form-time").value;
    const note = document.getElementById("followup-form-note").value.trim();

    const followupData = {
      id: id || "follow_" + Date.now(),
      leadId: leadId,
      date: date,
      time: time,
      note: note,
      completed: "false"
    };

    window.API.saveFollowup(followupData);

    // Close and refresh
    document.getElementById("followup-modal").classList.add("hidden");
    
    if (state.currentView === "lead-detail") {
      renderLeadDetail(leadId);
    } else {
      renderFollowups();
    }
  });

  // Bind Open Scheduler in Profile details page
  document.getElementById("schedule-followup-btn").addEventListener("click", () => {
    if (activeDetailLeadId) {
      openFollowupModal(activeDetailLeadId);
    }
  });

  // Bind close buttons
  document.querySelectorAll(".followup-modal-close").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("followup-modal").classList.add("hidden");
    });
  });

})();
