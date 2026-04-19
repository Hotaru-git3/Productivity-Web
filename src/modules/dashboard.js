import { AppState } from "./state";
import ApexCharts from 'apexcharts';

let chartInstance = null;

export const Dashboard = {
  update() {
    const pendingTasks = AppState.tasks.filter(t => !t.done);
    const doneTasks = AppState.tasks.filter(t => t.done);

    const elPending = document.getElementById("stat-pending-tasks");
    const elNotes = document.getElementById("stat-total-notes");
    const elDone = document.getElementById("stat-done-tasks");

    if (elPending) elPending.innerText = pendingTasks.length;
    if (elNotes) elNotes.innerText = AppState.notes.length;
    if (elDone) elDone.innerText = doneTasks.length;

    this.renderUpNext(pendingTasks);
    this.renderChart(pendingTasks.length, doneTasks.length);
    this.renderHeatmap();
    this.updateMiniStats();
    this.updateRoutineWidget();
    this.renderUpcomingRoutines();
  },

  // Di dalam object Dashboard, tambahkan method ini:

renderUpcomingRoutines() {
  const container = document.getElementById("upcomingRoutines");
  if (!container) return;

  const routines = AppState.routines || [];
  const today = new Date().toISOString().split("T")[0];
  const todayName = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"][new Date().getDay()];
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Filter rutinitas yang berlaku hari ini & belum selesai
  let todayRoutines = routines.filter(r => {
    const isToday = (!r.days || r.days.length === 0) || r.days.includes(todayName);
    const isNotDone = !r.history?.[today];
    return isToday && isNotDone;
  });

  // Parse waktu mulai ke menit untuk sorting
  todayRoutines = todayRoutines.map(r => {
    const [startHour, startMinute] = (r.startTime || "00:00").split(":").map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const currentMinutes = currentHour * 60 + currentMinute;
    const isNow = startMinutes <= currentMinutes && currentMinutes <= (startMinutes + 60); // dalam 1 jam setelah start
    return { ...r, startMinutes, isNow };
  });

  // Urutkan: yang "Sekarang" duluan, lalu berdasarkan jam terdekat
  todayRoutines.sort((a, b) => {
    if (a.isNow && !b.isNow) return -1;
    if (!a.isNow && b.isNow) return 1;
    return a.startMinutes - b.startMinutes;
  });

  // Ambil maksimal 3 item
  const upcoming = todayRoutines.slice(0, 3);

  if (upcoming.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-gray-400 text-sm">
        ✨ Semua rutinitas hari ini sudah selesai! Istirahat dulu ya.
      </div>
    `;
    return;
  }

  // Grid 2 kolom (desktop), 1 kolom (mobile)
  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${upcoming.map(routine => {
        const timeRange = `${routine.startTime || '??:??'} - ${routine.endTime || '??:??'}`;
        const streak = routine.streak || 0;
        const isNow = routine.isNow;
        
        return `
          <div class="group glass-card card-animate p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all duration-300 hover:scale-[1.01]">
            <div class="flex items-start gap-2">
              <span class="text-2xl">${routine.icon || '📌'}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="font-medium text-sm truncate">${escapeHtml(routine.title)}</p>
                  ${streak > 0 ? `
                    <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded-full">
                      <i class="fa-solid fa-fire text-[9px]"></i> ${streak}
                    </span>
                  ` : ''}
                  ${isNow ? `
                    <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full animate-pulse">
                      <i class="fa-solid fa-clock"></i> Sekarang
                    </span>
                  ` : ''}
                </div>
                <p class="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <i class="fa-regular fa-clock"></i> ${timeRange}
                </p>
              </div>
              <button onclick="window.app.switchTab('routines')" 
                class="text-xs text-primary hover:underline whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                Kerjakan →
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
},

  renderUpNext(pendingTasks) {
  const list = document.getElementById("upNextList");
  if (!list) return;

  // Filter task yang punya deadline, urutkan dari terdekat
  const withDeadline = pendingTasks
    .filter(t => t.deadline)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 5); // Maksimal 5 tugas

  if (withDeadline.length === 0) {
    list.innerHTML = `
      <li class="text-sm text-gray-500 py-4 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        ✅ Tidak ada deadline mendekat. Santai dulu!
      </li>
    `;
    return;
  }

  list.innerHTML = withDeadline.map(t => {
    const deadlineDate = new Date(t.deadline);
    const today = new Date();
    const daysLeft = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
    
    let label = '';
    let colorClass = '';
    let bgClass = '';

    if (daysLeft <= 0) {
      label = '⚠️ TERLEWAT';
      colorClass = 'text-red-700';
      bgClass = 'bg-red-100 dark:bg-red-900/40';
    } else if (daysLeft === 1) {
      label = '🔴 BESOK!';
      colorClass = 'text-red-600';
      bgClass = 'bg-red-100 dark:bg-red-900/40';
    } else if (daysLeft === 2) {
      label = `🟠 ${daysLeft} hari lagi`;
      colorClass = 'text-orange-600';
      bgClass = 'bg-orange-100 dark:bg-orange-900/40';
    } else if (daysLeft <= 5) {
      label = `🟡 ${daysLeft} hari lagi`;
      colorClass = 'text-yellow-700';
      bgClass = 'bg-yellow-100 dark:bg-yellow-900/40';
    } else {
      label = `🟢 ${daysLeft} hari lagi`;
      colorClass = 'text-green-600';
      bgClass = 'bg-green-100 dark:bg-green-900/40';
    }

    // Format deadline jadi lebih rapi
    const formattedDate = deadlineDate.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    return `
      <li class="flex justify-between items-center p-3 rounded-lg ${bgClass} border border-gray-100 dark:border-gray-700 transition-all hover:shadow-sm">
        <div class="flex-1 min-w-0">
          <p class="font-medium text-sm truncate">${escapeHtml(t.title)}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <i class="fa-regular fa-calendar mr-1"></i> ${formattedDate}
          </p>
        </div>
        <div class="ml-3 flex-shrink-0">
          <span class="text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap ${colorClass} ${bgClass}">
            ${label}
          </span>
        </div>
      </li>
    `;
  }).join("");
},

  renderChart(pending, done) {
  const container = document.getElementById("taskChart");
  if (!container) return;

  const isDark = document.documentElement.classList.contains("dark");
  
  // Warna lebih soft
  const colors = {
    done: '#10B981',
    pending: '#EF4444'
  };
  
  const options = {
    series: [done, pending],
    labels: ['Selesai', 'Nunggak'],
    colors: [colors.done, colors.pending],
    chart: {
      type: 'donut',
      height: 280,
      width: '100%',
      background: 'transparent',
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 1200, // Lebih lambat = lebih smooth
        animateGradually: { 
          enabled: true, 
          delay: 200 // Delay antar segment
        },
        dynamicAnimation: {
          enabled: true,
          speed: 800
        }
      },
      dropShadow: {
        enabled: true,
        top: 2,
        left: 0,
        blur: 8,
        color: '#000',
        opacity: 0.1
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '68%',
          background: 'transparent',
          labels: {
            show: true,
            name: { 
              show: true, 
              fontSize: '14px', 
              fontFamily: 'Inter, sans-serif', 
              color: isDark ? '#F9FAFB' : '#111827',
              offsetY: -10
            },
            value: { 
              show: true, 
              fontSize: '24px', 
              fontFamily: 'Inter, sans-serif', 
              fontWeight: 'bold', 
              color: isDark ? '#F9FAFB' : '#111827', 
              offsetY: 10,
              formatter: (val) => val 
            },
            total: { 
              show: true, 
              label: 'Total', 
              fontSize: '12px', 
              fontFamily: 'Inter, sans-serif',
              color: isDark ? '#9CA3AF' : '#6B7280', 
              formatter: (val) => done + pending,
              offsetY: 25
            }
          }
        },
        pie: {
          expandOnClick: true,
          donut: {
            background: 'transparent'
          }
        }
      }
    },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center',
      fontSize: '13px',
      fontFamily: 'Inter, sans-serif',
      labels: { 
        colors: isDark ? '#9CA3AF' : '#4B5563', 
        useSeriesColors: false 
      },
      markers: { 
        width: 10, 
        height: 10, 
        radius: 6,
        hoverAnimation: true
      },
      itemMargin: { horizontal: 15, vertical: 8 },
      onItemClick: { toggleDataSeries: true },
      onItemHover: { highlightDataSeries: true }
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (val) => `${val} tugas` },
      style: {
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif'
      }
    },
    stroke: { 
      show: false,
      width: 0
    },
    dataLabels: { 
      enabled: false 
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'vertical',
        shadeIntensity: 0.3,
        gradientToColors: [colors.done, colors.pending],
        inverseColors: false,
        opacityFrom: 0.9,
        opacityTo: 0.95,
        stops: [0, 100]
      }
    },
    states: {
      hover: { 
        filter: { 
          type: 'darken', 
          value: 0.08 
        }
      },
      active: {
        allowMultipleDataPointsSelection: false,
        filter: { type: 'darken', value: 0.05 }
      }
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: { height: 240 },
        legend: { position: 'bottom', fontSize: '11px' },
        plotOptions: { pie: { donut: { labels: { value: { fontSize: '18px' } } } } }
      }
    }]
  };

  // Handle resize untuk responsive smooth
  if (!this._resizeHandler) {
    this._resizeHandler = () => {
      if (chartInstance && window.innerWidth <= 768) {
        chartInstance.updateOptions({
          chart: { height: 240 },
          plotOptions: { pie: { donut: { labels: { value: { fontSize: '18px' } } } } }
        });
      } else if (chartInstance && window.innerWidth > 768) {
        chartInstance.updateOptions({
          chart: { height: 280 },
          plotOptions: { pie: { donut: { labels: { value: { fontSize: '24px' } } } } }
        });
      }
    };
    window.addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(this._resizeHandler, 150);
    });
  }

  if (chartInstance) {
    // Update dengan animasi smooth
    chartInstance.updateOptions(options, false, true, false);
    chartInstance.updateSeries([done, pending], true);
  } else {
    chartInstance = new ApexCharts(container, options);
    chartInstance.render().then(() => {
      // Tambahin effect fade in selesai render
      container.style.opacity = '0';
      setTimeout(() => {
        container.style.transition = 'opacity 0.5s ease';
        container.style.opacity = '1';
      }, 50);
    });
  }
},

  renderHeatmap() {
  const grid = document.getElementById("heatmapGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const count = AppState.activityLog[dateStr] || 0;

    let colorClass = "bg-gray-200 dark:bg-gray-700";
    if (count >= 1 && count <= 2) colorClass = "bg-indigo-300 dark:bg-indigo-900/60";
    else if (count >= 3 && count <= 4) colorClass = "bg-indigo-400 dark:bg-indigo-700";
    else if (count >= 5) colorClass = "bg-indigo-600 dark:bg-indigo-500";

    const box = document.createElement("div");
    box.className = `w-4 h-4 md:w-5 md:h-5 rounded-sm ${colorClass} transition-all duration-300 hover:ring-2 hover:ring-primary cursor-pointer`;
    box.title = `${dateStr}: ${count} aktivitas`; // tooltip native (works on mobile tap & hold)
    
    // 🔥 TAMBAHKAN UNTUK MOBILE: tampilkan detail saat tap
    box.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showHeatmapDetail(dateStr, count, box);
    });
    
    grid.appendChild(box);
  }
},

showHeatmapDetail(dateStr, count, targetBox) {
  // Hapus tooltip sementara yang mungkin sudah ada
  const existingTooltip = document.getElementById("heatmap-tooltip");
  if (existingTooltip) existingTooltip.remove();
  
  // Buat tooltip custom
  const tooltip = document.createElement("div");
  tooltip.id = "heatmap-tooltip";
  tooltip.className = "fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none animate-fade-in";
  tooltip.innerHTML = `
    <strong>${dateStr}</strong><br>
    ${count} aktivitas
    <div class="text-[10px] text-gray-300 mt-1">${count === 0 ? 'Tidak ada aktivitas' : count === 1 ? '1 aktivitas' : `${count} aktivitas`}</div>
  `;
  
  document.body.appendChild(tooltip);
  
  // Posisikan di dekat box yang diklik
  const rect = targetBox.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2 - 60}px`;
  tooltip.style.top = `${rect.top - 40}px`;
  
  // Auto hilang setelah 2 detik
  setTimeout(() => {
    if (tooltip) tooltip.remove();
  }, 2000);
},

  updateMiniStats() {
    const streakCount = document.getElementById("streakCount");
    const todayTasksDone = document.getElementById("todayTasksDone");

    if (streakCount) {
      streakCount.innerText = this.getStreak();
    }

    if (todayTasksDone) {
      const today = new Date().toISOString().split("T")[0];
      const completedToday = AppState.tasks.filter(t => {
        if (!t.done || !t.completedAt) return false;
        return t.completedAt.split("T")[0] === today;
      });
      todayTasksDone.innerText = completedToday.length;
    }
  },

  getStreak() {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      if (AppState.activityLog[dateStr] && AppState.activityLog[dateStr] > 0) streak++;
      else if (i > 0) break;
    }
    return streak;
  },

  updateRoutineWidget() {
    const container = document.getElementById("routineWidget");
    if (!container) return;

    const routines = AppState.routines || [];
    const today = new Date().toISOString().split("T")[0];
    const todayName = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"][new Date().getDay()];

    const todayRoutines = routines.filter(r => {
      if (!r.days || r.days.length === 0) return true;
      return r.days.includes(todayName);
    });

    const completedToday = todayRoutines.filter(r => r.history?.[today]).length;
    const totalToday = todayRoutines.length;
    const percent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

    if (totalToday === 0) {
      container.innerHTML = `
        <div class="bg-white dark:bg-darkCard p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-gradient">
          <div class="flex justify-between items-center mb-3">
            <h3 class="font-bold text-lg flex items-center gap-2">
  <i class="fa-solid fa-calendar-check text-primary"></i> 
  <span class="text-gradient">Today's Routine</span>
</h3>
            <button onclick="window.app.switchTab('routines')" class="text-xs text-primary hover:underline">Setup →</button>
          </div>
          <p class="text-sm text-gray-500 text-center py-4">Belum ada rutinitas untuk hari ini.</p>
        </div>
      `;
      return;
    }

    // Ambil rutinitas yang belum selesai hari ini (maks 3)
const upcoming = todayRoutines.filter(r => !r.history?.[today]).slice(0, 3);

let upcomingHtml = '';
if (upcoming.length > 0) {
  upcomingHtml = `
  <div class="${upcoming.length === 1 ? 'grid grid-cols-1' : 'grid grid-cols-1'} gap-3">
    ${upcoming.map(r => `
      <div class="rounded-xl p-3 transition cursor-pointer bg-indigo-50/60 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/30"
        onclick="window.app.switchTab('routines')">
        <div class="flex items-start gap-2">
          <span class="text-xl">${r.icon || '📌'}</span>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-sm truncate text-indigo-900 dark:text-indigo-100">${r.title}</p>
            <p class="text-xs text-indigo-400 dark:text-indigo-400 mt-0.5">
              <i class="fa-regular fa-clock"></i> ${r.startTime || '??:??'} - ${r.endTime || '??:??'}
            </p>
            ${r.streak > 0 ? `<p class="text-xs text-orange-500 mt-0.5">🔥 ${r.streak} hari</p>` : ''}
          </div>
        </div>
      </div>
    `).join('')}
  </div>
`;
} else if (percent < 100) {
  upcomingHtml = '';
} else {
  upcomingHtml = '';
}

    container.innerHTML = `
  <div class="bg-white dark:bg-darkCard p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
    <!-- Header + counter -->
    <div class="flex justify-between items-center mb-3">
      <h3 class="font-bold text-lg">📋<span class="text-gradient pl-2">Today's Routine</span></h3>
      <span class="text-sm font-semibold text-primary">${completedToday}/${totalToday}</span>
    </div>

    <!-- Progress bar -->
    <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div class="h-full bg-primary rounded-full transition-all" style="width: ${percent}%"></div>
    </div>
    <p class="text-xs text-gray-500 mt-2 mb-4">
      ${percent === 100 ? "🎉 All done! Great job!" : `${totalToday - completedToday} more to go!`}
    </p>

    <!-- Preview grid 2 kolom (rutinitas belum selesai) -->
    ${upcomingHtml}

    <!-- Link ke semua rutinitas -->
    <button onclick="window.app.switchTab('routines')" 
      class="mt-4 w-full text-center text-xs text-primary hover:underline">
      Lihat semua rutinitas →
    </button>
  </div>
`;
  }
};

function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}