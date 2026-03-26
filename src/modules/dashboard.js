import Chart from "chart.js/auto";
import { AppState } from "./state";

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
    const ctx = document.getElementById("taskChart");
    if (!ctx) return;

    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#9CA3AF" : "#4B5563";

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Selesai", "Nunggak"],
        datasets: [{ data: [done, pending], backgroundColor: ["#10B981", "#EF4444"], borderWidth: 0, hoverOffset: 4 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { color: textColor, padding: 20 } } },
        cutout: "70%"
      }
    });
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