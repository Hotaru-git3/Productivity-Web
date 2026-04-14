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
  },

  renderUpNext(pendingTasks) {
    const list = document.getElementById("upNextList");
    if (!list) return;

    const withDeadline = pendingTasks.filter(t => t.deadline).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    const top3 = withDeadline.slice(0, 3);

    if (top3.length === 0) {
      list.innerHTML = `<li class="text-sm text-gray-500 py-4 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">✅ Aman, nggak ada deadline mepet! Bawa kalem dulu aja.</li>`;
      return;
    }

    list.innerHTML = top3.map(t => {
      const daysLeft = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24));
      let alertClass = "text-green-600 bg-green-100 dark:bg-green-900/40";
      let text = `${daysLeft} hari lagi`;

      if (daysLeft <= 2 && daysLeft > 0) alertClass = "text-orange-500 bg-orange-100 dark:bg-orange-900/40";
      else if (daysLeft === 0) { alertClass = "text-red-500 bg-red-100 dark:bg-red-900/40"; text = "Hari Ini!"; }
      else if (daysLeft < 0) { alertClass = "text-gray-500 bg-gray-200 dark:bg-gray-700"; text = "Terlewat"; }

      return `
        <li class="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
          <span class="font-medium text-sm truncate pr-4">${escapeHtml(t.title)}</span>
          <span class="text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap ${alertClass}">${text}</span>
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
      box.title = `${dateStr}: ${count} aktivitas`;
      grid.appendChild(box);
    }
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

    container.innerHTML = `
      <div class="bg-white dark:bg-darkCard p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div class="flex justify-between items-center mb-3">
          <h3 class="font-bold text-lg ">📋<span class="text-gradient">Today's Routine<span/></h3>
          <span class="text-sm font-semibold text-primary">${completedToday}/${totalToday}</span>
        </div>
        <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div class="h-full bg-primary rounded-full transition-all" style="width: ${percent}%"></div>
        </div>
        <p class="text-xs text-gray-500 mt-3">
          ${percent === 100 ? "🎉 All done! Great job!" : `${totalToday - completedToday} more to go!`}
        </p>
        <button onclick="window.app.switchTab('routines')" 
          class="mt-3 w-full text-center text-xs text-primary hover:underline">
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