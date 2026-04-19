import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { AppState } from "./state";

export const StudyTracker = {
  async getTodayFocusMinutes() {
    const user = AppState.currentUser;
    if (!user) return 0;

    const today = new Date().toISOString().split("T")[0];
    const q = query(
      collection(db, "dailyFocus"),
      where("userId", "==", user.uid),
      where("date", "==", today)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return 0;
    return snapshot.docs[0].data().totalMinutes || 0;
  },

  async getWeeklyFocusData() {
    const user = AppState.currentUser;
    if (!user) return [];

    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      weekDays.push(date.toISOString().split("T")[0]);
    }

    const q = query(
      collection(db, "dailyFocus"),
      where("userId", "==", user.uid),
      where("date", ">=", weekDays[0]),
      where("date", "<=", weekDays[6])
    );
    const snapshot = await getDocs(q);

    const focusMap = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      focusMap[data.date] = data.totalMinutes || 0;
    });

    return weekDays.map(date => ({
      date,
      minutes: focusMap[date] || 0,
      label: new Date(date).toLocaleDateString('id-ID', { weekday: 'short' })
    }));
  },

  async renderDashboardWidget() {
    const container = document.getElementById("studyWidget");
    if (!container) return;

    const todayMinutes = await this.getTodayFocusMinutes();
    const hours = Math.floor(todayMinutes / 60);
    const mins = todayMinutes % 60;
    const display = hours > 0 ? `${hours} jam ${mins} menit` : `${mins} menit`;

    container.innerHTML = `
      <div class="glass-card card-animate p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold text-lg flex items-center gap-2">
            <i class="fa-solid fa-brain text-primary"></i>
            <span class="text-gradient">Fokus Hari Ini</span>
          </h3>
          <i class="fa-solid fa-hourglass-half text-primary text-xl"></i>
        </div>
        <p class="text-3xl font-bold text-primary">${todayMinutes}</p>
        <p class="text-xs text-gray-500">menit fokus</p>
        <div class="mt-3 h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div class="h-full bg-primary rounded-full" style="width: ${Math.min(100, (todayMinutes / 120) * 100)}%"></div>
        </div>
        <p class="text-[10px] text-gray-400 mt-2">Target 2 jam/hari (120 menit)</p>
      </div>
    `;
  },

  async renderToolsChart() {
    const container = document.getElementById("weeklyFocusChart");
    if (!container) return;

    const data = await this.getWeeklyFocusData();
    const maxMinutes = Math.max(...data.map(d => d.minutes), 60);

    container.innerHTML = `
      <div class="bg-white dark:bg-darkCard rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 mt-6">
        <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
          <i class="fa-solid fa-chart-line text-primary"></i>
          <span class="text-gradient">Fokus Minggu Ini (menit)</span>
        </h3>
        <div class="flex items-end gap-2 h-48">
          ${data.map(day => `
            <div class="flex-1 flex flex-col items-center gap-1 group">
              <div class="relative w-full flex justify-center">
                <div class="w-full max-w-[40px] bg-primary/20 rounded-t-lg overflow-hidden transition-all duration-300 group-hover:bg-primary/30"
                  style="height: ${(day.minutes / maxMinutes) * 140}px">
                  <div class="w-full bg-primary rounded-t-lg transition-all"
                    style="height: ${(day.minutes / maxMinutes) * 140}px">
                  </div>
                </div>
                <span class="absolute -top-6 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition">
                  ${day.minutes}
                </span>
              </div>
              <span class="text-[10px] text-gray-500 mt-2">${day.label}</span>
            </div>
          `).join('')}
        </div>
        <p class="text-center text-xs text-gray-400 mt-4">Total: ${data.reduce((sum, d) => sum + d.minutes, 0)} menit minggu ini</p>
      </div>
    `;
  }
};