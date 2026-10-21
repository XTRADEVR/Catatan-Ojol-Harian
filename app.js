/**
 * Catatan Ojol PWA - Core Logic (app.js)
 * Mobile-First, Offline-Ready, Ultra-Lightweight
 */

(function () {
  'use strict';

  // State keys
  const STORAGE_KEY = 'catatan_ojol_data_v1';
  const THEME_KEY = 'catatan_ojol_theme';

  // Format currency in Indonesian Rupiah
  const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number || 0);
  };

  const formatDateIndo = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const getTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Default Categories
  const SERVICE_CATEGORIES = [
    { id: 'goride', name: 'GoRide / GrabBike', icon: '🛵', color: '#10B981' },
    { id: 'gofood', name: 'GoFood / GrabFood', icon: '🍔', color: '#F59E0B' },
    { id: 'grabexpress', name: 'GrabExpress / GoSend', icon: '📦', color: '#3B82F6' },
    { id: 'tip_bonus', name: 'Tip & Insentif / Bonus', icon: '🎁', color: '#8B5CF6' }
  ];

  const EXPENSE_CATEGORIES = [
    { id: 'bensin', name: 'Bensin (Pertalite)', icon: '⛽', color: '#EF4444' },
    { id: 'parkir', name: 'Parkir Resto & Mall', icon: '🅿️', color: '#6B7280' },
    { id: 'makan', name: 'Makan & Kopi Warkop', icon: '☕', color: '#EC4899' },
    { id: 'kuota', name: 'Pulsa / Kuota', icon: '📱', color: '#6366F1' },
    { id: 'perawatan', name: 'Tambal / Servis Motor', icon: '🔧', color: '#14B8A6' }
  ];

  // App State
  let appState = {
    selectedDate: getTodayStr(),
    activeTab: 'today',
    targetBulanan: 5000000,
    targetHarian: 200000,
    driverName: 'Driver Ojol',
    logs: []
  };

  let deferredInstallPrompt = null;

  // Initialize Data from LocalStorage or Fallback
  function initData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        appState.logs = parsed.logs || [];
        appState.targetBulanan = parsed.targetBulanan || 5000000;
        appState.targetHarian = parsed.targetHarian || 200000;
        appState.driverName = parsed.driverName || 'Driver Ojol';
      } else {
        // Load default seed from app-data.json
        fetch('./app-data.json')
          .then((res) => res.json())
          .then((data) => {
            if (data && data.sampleLogs) {
              appState.logs = data.sampleLogs;
              appState.targetBulanan = data.driverProfile?.monthlyTarget || 5000000;
              appState.targetHarian = data.driverProfile?.dailyTarget || 200000;
              saveData();
              renderApp();
            }
          })
          .catch(() => {
            appState.logs = [];
            saveData();
          });
      }
    } catch (e) {
      console.error('Error loading data:', e);
      appState.logs = [];
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        logs: appState.logs,
        targetBulanan: appState.targetBulanan,
        targetHarian: appState.targetHarian,
        driverName: appState.driverName,
        lastUpdated: new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error saving data:', e);
    }
  }

  // Get or Create Daily Log Record
  function getDailyLog(dateStr) {
    let log = appState.logs.find((l) => l.date === dateStr);
    if (!log) {
      log = {
        id: 'log-' + dateStr,
        date: dateStr,
        trips: 0,
        onlineHours: 8,
        incomes: [],
        expenses: [],
        grossTotal: 0,
        expenseTotal: 0,
        netTotal: 0
      };
      appState.logs.push(log);
    }
    recalculateLog(log);
    return log;
  }

  function recalculateLog(log) {
    const gross = (log.incomes || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const expense = (log.expenses || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    log.grossTotal = gross;
    log.expenseTotal = expense;
    log.netTotal = gross - expense;
  }

  // Toast Notification
  function showToast(message) {
    const toast = document.getElementById('toast-box');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  // Render Daily Tab
  function renderDailyTab() {
    const log = getDailyLog(appState.selectedDate);
    
    // Date ribbon text
    const dateDisplay = document.getElementById('selected-date-display');
    const isToday = appState.selectedDate === getTodayStr();
    if (dateDisplay) {
      dateDisplay.textContent = (isToday ? 'Hari Ini • ' : '') + formatDateIndo(appState.selectedDate);
    }

    // Hero metrics
    const heroNet = document.getElementById('hero-net-amount');
    const heroGross = document.getElementById('hero-gross-amount');
    const heroExpense = document.getElementById('hero-expense-amount');

    if (heroNet) {
      heroNet.textContent = formatRupiah(log.netTotal);
      heroNet.style.color = log.netTotal >= 0 ? 'var(--color-income)' : 'var(--color-expense)';
    }
    if (heroGross) heroGross.textContent = formatRupiah(log.grossTotal);
    if (heroExpense) heroExpense.textContent = formatRupiah(log.expenseTotal);

    // Stat chips
    const statTrips = document.getElementById('stat-trips');
    const statAvgTrip = document.getElementById('stat-avg-trip');
    const statMargin = document.getElementById('stat-margin');

    if (statTrips) statTrips.textContent = log.trips || 0;
    if (statAvgTrip) {
      const avg = log.trips > 0 ? Math.round(log.netTotal / log.trips) : 0;
      statAvgTrip.textContent = formatRupiah(avg);
    }
    if (statMargin) {
      const margin = log.grossTotal > 0 ? Math.round((log.netTotal / log.grossTotal) * 100) : 0;
      statMargin.textContent = `${margin}%`;
    }

    // Render Incomes Quick Badges
    SERVICE_CATEGORIES.forEach((cat) => {
      const badge = document.getElementById(`badge-cat-${cat.id}`);
      if (badge) {
        const catSum = (log.incomes || [])
          .filter((i) => i.category === cat.id)
          .reduce((acc, curr) => acc + curr.amount, 0);
        badge.textContent = catSum > 0 ? formatRupiah(catSum) : 'Rp 0';
      }
    });

    // Render Expenses Quick Badges
    EXPENSE_CATEGORIES.forEach((cat) => {
      const badge = document.getElementById(`badge-cat-${cat.id}`);
      if (badge) {
        const catSum = (log.expenses || [])
          .filter((e) => e.category === cat.id)
          .reduce((acc, curr) => acc + curr.amount, 0);
        badge.textContent = catSum > 0 ? formatRupiah(catSum) : 'Rp 0';
      }
    });

    // Render Entries List
    renderEntriesList(log);
  }

  function renderEntriesList(log) {
    const listEl = document.getElementById('daily-entries-list');
    if (!listEl) return;

    const allEntries = [];
    (log.incomes || []).forEach((item, idx) => {
      const cat = SERVICE_CATEGORIES.find((c) => c.id === item.category) || { name: 'Pendapatan', icon: '💰' };
      allEntries.push({ ...item, type: 'income', catName: cat.name, icon: cat.icon, index: idx });
    });
    (log.expenses || []).forEach((item, idx) => {
      const cat = EXPENSE_CATEGORIES.find((c) => c.id === item.category) || { name: 'Pengeluaran', icon: '💸' };
      allEntries.push({ ...item, type: 'expense', catName: cat.name, icon: cat.icon, index: idx });
    });

    if (allEntries.length === 0) {
      listEl.innerHTML = '<div class="empty-state">Belum ada catatan transaksi untuk tanggal ini.<br>Pilih tombol orderan / pengeluaran di atas untuk mencatat.</div>';
      return;
    }

    listEl.innerHTML = allEntries.map((entry) => `
      <div class="entry-item">
        <div class="entry-info">
          <span class="entry-icon">${entry.icon}</span>
          <div class="entry-desc">
            <span class="entry-title">${entry.catName}</span>
            <span class="entry-note">${entry.note || (entry.type === 'income' ? 'Order' : 'Pengeluaran')}</span>
          </div>
        </div>
        <div class="entry-val-box">
          <span class="entry-val ${entry.type}">${entry.type === 'income' ? '+' : '-'} ${formatRupiah(entry.amount)}</span>
          <button class="entry-del-btn" data-type="${entry.type}" data-idx="${entry.index}" title="Hapus">✕</button>
        </div>
      </div>
    `).join('');

    // Attach delete listeners
    listEl.querySelectorAll('.entry-del-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const type = btn.getAttribute('data-type');
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        deleteEntry(type, idx);
      });
    });
  }

  // Delete an entry
  function deleteEntry(type, index) {
    const log = getDailyLog(appState.selectedDate);
    if (type === 'income') {
      log.incomes.splice(index, 1);
    } else {
      log.expenses.splice(index, 1);
    }
    recalculateLog(log);
    saveData();
    renderApp();
    showToast('Catatan dihapus');
  }

  // Render Reports & Monthly Targets Tab
  function renderReportsTab() {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Filter logs for this month
    const thisMonthLogs = appState.logs.filter((l) => {
      if (!l.date) return false;
      const d = new Date(l.date + 'T00:00:00');
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthGross = thisMonthLogs.reduce((acc, curr) => acc + (curr.grossTotal || 0), 0);
    const monthExpense = thisMonthLogs.reduce((acc, curr) => acc + (curr.expenseTotal || 0), 0);
    const monthNet = monthGross - monthExpense;
    const totalTrips = thisMonthLogs.reduce((acc, curr) => acc + (curr.trips || 0), 0);
    const workDays = thisMonthLogs.filter((l) => (l.grossTotal || 0) > 0).length;

    // Last 7 days
    const past7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      const found = appState.logs.find((l) => l.date === str);
      if (found) past7Days.push(found);
    }
    const weekGross = past7Days.reduce((acc, curr) => acc + (curr.grossTotal || 0), 0);
    const weekExpense = past7Days.reduce((acc, curr) => acc + (curr.expenseTotal || 0), 0);
    const weekNet = weekGross - weekExpense;

    // Monthly Target Progress
    const target = appState.targetBulanan || 5000000;
    const progressPct = Math.min(100, Math.round((monthNet / target) * 100));
    const sisaTarget = Math.max(0, target - monthNet);

    // Days remaining in month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = today.getDate();
    const sisaHari = Math.max(1, daysInMonth - currentDay + 1);
    const targetPerHari = Math.round(sisaTarget / sisaHari);

    const elMonthNet = document.getElementById('rep-month-net');
    const elMonthGross = document.getElementById('rep-month-gross');
    const elMonthExpense = document.getElementById('rep-month-expense');
    const elMonthTrips = document.getElementById('rep-month-trips');
    const elWorkDays = document.getElementById('rep-work-days');

    const elWeekNet = document.getElementById('rep-week-net');
    const elWeekGross = document.getElementById('rep-week-gross');

    const elTargetVal = document.getElementById('target-display-val');
    const elTargetPercent = document.getElementById('target-percent');
    const elTargetFill = document.getElementById('target-progress-fill');
    const elSisaTarget = document.getElementById('target-sisa');
    const elTargetPerHari = document.getElementById('target-per-hari');

    if (elMonthNet) elMonthNet.textContent = formatRupiah(monthNet);
    if (elMonthGross) elMonthGross.textContent = formatRupiah(monthGross);
    if (elMonthExpense) elMonthExpense.textContent = formatRupiah(monthExpense);
    if (elMonthTrips) elMonthTrips.textContent = `${totalTrips} Trip`;
    if (elWorkDays) elWorkDays.textContent = `${workDays} Hari Narik`;

    if (elWeekNet) elWeekNet.textContent = formatRupiah(weekNet);
    if (elWeekGross) elWeekGross.textContent = formatRupiah(weekGross);

    if (elTargetVal) elTargetVal.textContent = formatRupiah(target);
    if (elTargetPercent) elTargetPercent.textContent = `${progressPct}%`;
    if (elTargetFill) elTargetFill.style.width = `${progressPct}%`;
    if (elSisaTarget) elSisaTarget.textContent = sisaTarget === 0 ? 'Target Tercapai! 🏆' : formatRupiah(sisaTarget);
    if (elTargetPerHari) elTargetPerHari.textContent = formatRupiah(targetPerHari);
  }

  // Render SVG Performance Charts
  function renderChartsTab() {
    const chartContainer = document.getElementById('performance-chart-svg');
    if (!chartContainer) return;

    // Get last 7 days of dates sorted chronologically
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      const log = appState.logs.find((l) => l.date === str) || {
        date: str,
        grossTotal: 0,
        expenseTotal: 0,
        netTotal: 0
      };
      last7Days.push(log);
    }

    const maxVal = Math.max(...last7Days.map((d) => Math.max(d.grossTotal, d.netTotal, 50000)));
    const svgWidth = 320;
    const svgHeight = 160;
    const padding = { top: 20, right: 10, bottom: 30, left: 10 };
    const chartW = svgWidth - padding.left - padding.right;
    const chartH = svgHeight - padding.top - padding.bottom;

    const colWidth = chartW / last7Days.length;
    const barWidth = 14;

    let barsSvg = '';
    let labelsSvg = '';
    let guideLines = '';

    // Draw baseline
    const baseY = padding.top + chartH;
    guideLines += `<line x1="${padding.left}" y1="${baseY}" x2="${svgWidth - padding.right}" y2="${baseY}" stroke="var(--border-color)" stroke-width="1" />`;

    last7Days.forEach((item, i) => {
      const centerX = padding.left + i * colWidth + colWidth / 2;
      const netH = Math.max(0, (item.netTotal / maxVal) * chartH);
      const grossH = Math.max(0, (item.grossTotal / maxVal) * chartH);

      const netY = baseY - netH;
      const grossY = baseY - grossH;

      const dateObj = new Date(item.date + 'T00:00:00');
      const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'narrow' }).format(dateObj);
      const dayNum = dateObj.getDate();

      // Bar for Gross (faint background)
      barsSvg += `
        <rect x="${centerX - barWidth / 2}" y="${grossY}" width="${barWidth}" height="${grossH}" rx="3" fill="var(--color-primary-light)" opacity="0.6" />
      `;

      // Bar for Net (emerald green)
      barsSvg += `
        <rect x="${centerX - barWidth / 2}" y="${netY}" width="${barWidth}" height="${netH}" rx="3" fill="var(--color-primary)" />
      `;

      // Label below bar
      labelsSvg += `
        <text x="${centerX}" y="${baseY + 16}" font-size="10" fill="var(--text-secondary)" text-anchor="middle" font-weight="600">${dayName}</text>
        <text x="${centerX}" y="${baseY + 26}" font-size="8" fill="var(--text-muted)" text-anchor="middle">${dayNum}</text>
      `;
    });

    chartContainer.innerHTML = `
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="chart-svg">
        ${guideLines}
        ${barsSvg}
        ${labelsSvg}
      </svg>
    `;

    // Service Breakdown bars
    renderServiceBreakdown();
  }

  function renderServiceBreakdown() {
    const el = document.getElementById('service-breakdown-bars');
    if (!el) return;

    const breakdown = {};
    SERVICE_CATEGORIES.forEach((c) => (breakdown[c.id] = 0));

    appState.logs.forEach((log) => {
      (log.incomes || []).forEach((inc) => {
        if (breakdown[inc.category] !== undefined) {
          breakdown[inc.category] += Number(inc.amount) || 0;
        }
      });
    });

    const totalIncome = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;

    el.innerHTML = SERVICE_CATEGORIES.map((cat) => {
      const val = breakdown[cat.id] || 0;
      const pct = Math.round((val / totalIncome) * 100);
      return `
        <div style="margin-bottom: 10px;">
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:4px;">
            <span>${cat.icon} <strong>${cat.name}</strong></span>
            <span><strong>${formatRupiah(val)}</strong> (${pct}%)</span>
          </div>
          <div class="progress-bar-track" style="height:7px;">
            <div class="progress-bar-fill" style="width:${pct}%; background:${cat.color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render History Tab
  function renderHistoryTab() {
    const listEl = document.getElementById('history-logs-list');
    if (!listEl) return;

    const sortedLogs = [...appState.logs].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedLogs.length === 0) {
      listEl.innerHTML = '<div class="empty-state">Belum ada riwayat pembukuan tersimpan.</div>';
      return;
    }

    listEl.innerHTML = sortedLogs.map((log) => `
      <div class="entry-item" style="cursor:pointer;" onclick="window.OjolApp.selectDateAndGoDaily('${log.date}')">
        <div class="entry-info">
          <div style="font-size:1.4rem;">📅</div>
          <div class="entry-desc">
            <span class="entry-title">${formatDateIndo(log.date)}</span>
            <span class="entry-note">${log.trips || 0} Trip • Kotor: ${formatRupiah(log.grossTotal)}</span>
          </div>
        </div>
        <div style="text-align:right;">
          <div class="entry-val ${log.netTotal >= 0 ? 'income' : 'expense'}">${formatRupiah(log.netTotal)}</div>
          <span style="font-size:0.68rem; color:var(--text-muted);">Bersih</span>
        </div>
      </div>
    `).join('');
  }

  // Render Entire App based on active tab
  function renderApp() {
    // Show active tab
    document.querySelectorAll('.tab-content').forEach((tab) => {
      tab.classList.toggle('active', tab.id === `tab-${appState.activeTab}`);
    });
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.getAttribute('data-tab') === appState.activeTab);
    });

    if (appState.activeTab === 'today') {
      renderDailyTab();
    } else if (appState.activeTab === 'reports') {
      renderReportsTab();
    } else if (appState.activeTab === 'charts') {
      renderChartsTab();
    } else if (appState.activeTab === 'history') {
      renderHistoryTab();
    }
  }

  // Modal logic for Quick Input
  let activeModalCategory = null;
  let activeModalType = 'income';

  function openEntryModal(catId, type) {
    activeModalCategory = catId;
    activeModalType = type;

    const modal = document.getElementById('entry-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalSubtitle = document.getElementById('modal-subtitle');
    const amountInput = document.getElementById('modal-amount');
    const noteInput = document.getElementById('modal-note');

    const cat = type === 'income'
      ? SERVICE_CATEGORIES.find((c) => c.id === catId)
      : EXPENSE_CATEGORIES.find((c) => c.id === catId);

    if (cat) {
      modalTitle.textContent = `${cat.icon} Catat ${cat.name}`;
      modalSubtitle.textContent = type === 'income' ? 'Tambah pendapatan orderan' : 'Tambah pengeluaran operasional';
    }

    amountInput.value = '';
    noteInput.value = '';
    modal.classList.add('open');
    setTimeout(() => amountInput.focus(), 150);
  }

  function closeEntryModal() {
    const modal = document.getElementById('entry-modal');
    modal.classList.remove('open');
  }

  function handleSaveEntry() {
    const amountInput = document.getElementById('modal-amount');
    const noteInput = document.getElementById('modal-note');
    const amount = parseInt(amountInput.value.replace(/[^0-9]/g, ''), 10);

    if (!amount || amount <= 0) {
      showToast('Masukkan nominal yang valid');
      return;
    }

    const log = getDailyLog(appState.selectedDate);
    const newEntry = {
      category: activeModalCategory,
      amount: amount,
      note: noteInput.value.trim() || undefined,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    if (activeModalType === 'income') {
      log.incomes = log.incomes || [];
      log.incomes.push(newEntry);
      // Auto increment trip count for ride/food/express orders
      if (['goride', 'gofood', 'grabexpress'].includes(activeModalCategory)) {
        log.trips = (log.trips || 0) + 1;
      }
    } else {
      log.expenses = log.expenses || [];
      log.expenses.push(newEntry);
    }

    recalculateLog(log);
    saveData();
    closeEntryModal();
    renderApp();
    showToast('Tercatat: ' + formatRupiah(amount));
  }

  // Setup Event Listeners
  function setupListeners() {
    // Bottom navigation
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', () => {
        appState.activeTab = item.getAttribute('data-tab');
        renderApp();
      });
    });

    // Date navigation
    document.getElementById('prev-date-btn')?.addEventListener('click', () => {
      const d = new Date(appState.selectedDate + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      appState.selectedDate = d.toISOString().split('T')[0];
      renderApp();
    });

    document.getElementById('next-date-btn')?.addEventListener('click', () => {
      const d = new Date(appState.selectedDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      appState.selectedDate = d.toISOString().split('T')[0];
      renderApp();
    });

    document.getElementById('today-btn')?.addEventListener('click', () => {
      appState.selectedDate = getTodayStr();
      renderApp();
    });

    const datePicker = document.getElementById('hidden-date-picker');
    document.getElementById('selected-date-display')?.addEventListener('click', () => {
      datePicker?.showPicker ? datePicker.showPicker() : datePicker?.click();
    });
    datePicker?.addEventListener('change', (e) => {
      if (e.target.value) {
        appState.selectedDate = e.target.value;
        renderApp();
      }
    });

    // Trip +/- buttons
    document.getElementById('trip-minus-btn')?.addEventListener('click', () => {
      const log = getDailyLog(appState.selectedDate);
      if (log.trips > 0) {
        log.trips--;
        saveData();
        renderDailyTab();
      }
    });

    document.getElementById('trip-plus-btn')?.addEventListener('click', () => {
      const log = getDailyLog(appState.selectedDate);
      log.trips = (log.trips || 0) + 1;
      saveData();
      renderDailyTab();
    });

    // Category button clicks
    document.querySelectorAll('.category-card-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-cat');
        const type = btn.getAttribute('data-type');
        openEntryModal(catId, type);
      });
    });

    // Modal quick chips (+10k, +20k, +50k, +100k)
    document.querySelectorAll('.modal-quick-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const val = parseInt(chip.getAttribute('data-val'), 10);
        const input = document.getElementById('modal-amount');
        const currentVal = parseInt(input.value.replace(/[^0-9]/g, '') || 0, 10);
        input.value = currentVal + val;
      });
    });

    // Modal submit & cancel
    document.getElementById('modal-save-btn')?.addEventListener('click', handleSaveEntry);
    document.getElementById('modal-cancel-btn')?.addEventListener('click', closeEntryModal);
    document.getElementById('modal-close-icon')?.addEventListener('click', closeEntryModal);
    document.getElementById('entry-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'entry-modal') closeEntryModal();
    });

    // Edit Target Modal
    document.getElementById('edit-target-btn')?.addEventListener('click', () => {
      const newTarget = prompt('Masukkan target pendapatan bersih bulanan (Rp):', appState.targetBulanan);
      if (newTarget !== null) {
        const num = parseInt(newTarget.replace(/[^0-9]/g, ''), 10);
        if (num > 0) {
          appState.targetBulanan = num;
          saveData();
          renderApp();
          showToast('Target berhasil diperbarui');
        }
      }
    });

    // Export & Backup
    document.getElementById('export-data-btn')?.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `catatan-ojol-backup-${getTodayStr()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Data berhasil diexport!');
    });

    // Import Data
    const importInput = document.getElementById('import-file-input');
    document.getElementById('import-data-btn')?.addEventListener('click', () => {
      importInput?.click();
    });
    importInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed && (parsed.logs || parsed.sampleLogs)) {
            appState.logs = parsed.logs || parsed.sampleLogs;
            if (parsed.targetBulanan) appState.targetBulanan = parsed.targetBulanan;
            saveData();
            renderApp();
            showToast('Data berhasil diimport!');
          } else {
            showToast('Format file backup tidak cocok');
          }
        } catch (err) {
          showToast('Gagal membaca file JSON');
        }
      };
      reader.readAsText(file);
    });

    // Reset Data
    document.getElementById('reset-data-btn')?.addEventListener('click', () => {
      if (confirm('Yakin ingin mereset data ke contoh awal?')) {
        localStorage.removeItem(STORAGE_KEY);
        initData();
        showToast('Data direset');
      }
    });

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    themeBtn?.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      let nextTheme;
      if (currentTheme === 'dark') {
        nextTheme = 'light';
      } else if (currentTheme === 'light') {
        nextTheme = 'dark';
      } else {
        nextTheme = isSystemDark ? 'light' : 'dark';
      }
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem(THEME_KEY, nextTheme);
      updateThemeIcon(nextTheme);
    });

    // Online / Offline Detection
    const updateOnlineStatus = () => {
      const banner = document.getElementById('offline-banner');
      if (banner) {
        banner.classList.toggle('active', !navigator.onLine);
      }
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // PWA Install Prompt Handling
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.classList.remove('hidden');
    });

    document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('Aplikasi berhasil dipasang!');
        }
        deferredInstallPrompt = null;
        document.getElementById('pwa-install-banner')?.classList.add('hidden');
      }
    });

    document.getElementById('close-install-banner')?.addEventListener('click', () => {
      document.getElementById('pwa-install-banner')?.classList.add('hidden');
    });

    // Check if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      document.getElementById('pwa-install-banner')?.classList.add('hidden');
    }
  }

  function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // Register Service Worker
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js')
          .then((reg) => console.log('[PWA] Service Worker registered:', reg.scope))
          .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
      });
    }
  }

  // Global helper for inline clicks
  window.OjolApp = {
    selectDateAndGoDaily: (dateStr) => {
      appState.selectedDate = dateStr;
      appState.activeTab = 'today';
      renderApp();
    }
  };

  // Run on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    // Restore theme
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
      updateThemeIcon(savedTheme);
    }

    initData();
    setupListeners();
    renderApp();
    registerServiceWorker();
  });

  window.OjolAppInitialized = true;
})();
