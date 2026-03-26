import { db } from "../firebase";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { AppState } from "./state";
import { showToast } from "../utils/toast";
import { UI } from "./ui";
import { showDeadlineToast } from "../utils/toast";

const REMINDERS_COLLECTION = collection(db, "reminders");
const CUSTOM_REMINDERS_COLLECTION = collection(db, "custom_reminders");

export const NotificationManager = {
  async requestPermission() {
    if (!("Notification" in window)) {
      console.log("Browser tidak support notifikasi");
      return false;
    }

    // Cek permission saat ini
    if (Notification.permission === "granted") {
      console.log("✅ Notification permission already granted");
      return true;
    }
    
    // Untuk HP, kita perlu user interaction dulu
    if (Notification.permission !== "denied") {
      // Jangan langsung minta permission, tunggu user klik
      console.log("⏳ Waiting for user interaction to request permission");
      return false;
    }
    
    return false;
  },

  // Panggil fungsi ini saat user melakukan interaksi (klik tombol, login, dll)
  async requestPermissionWithInteraction() {
    if (!("Notification" in window)) return false;
    
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") {
      console.log("❌ Notification denied by user");
      return false;
    }
    
    // Baru minta permission setelah user interaksi
    const permission = await Notification.requestPermission();
    console.log("📱 Permission requested, result:", permission);
    return permission === "granted";
  },

  send(title, body, options = {}) {
    // Cek permission
    if (Notification.permission !== "granted") {
      console.log("❌ Cannot send notification: permission not granted");
      
      // Fallback untuk HP: tampilkan toast sebagai pengganti notifikasi
      if (typeof showToast === 'function') {
        showToast(`${title}: ${body.substring(0, 50)}`, "info");
      }
      return null;
    }

    try {
      // Untuk HP, kita buat notifikasi dengan icon yang jelas
      const notification = new Notification(title, {
        body: body,
        icon: options.icon || "https://www.svgrepo.com/show/475656/google-color.svg",
        badge: options.badge || "https://www.svgrepo.com/show/475656/google-color.svg",
        tag: options.tag || "productivity",
        silent: options.silent || false,
        vibrate: options.vibrate || [200, 100, 200], // Getar untuk HP
        ...options
      });

      notification.onclick = () => {
        window.focus();
        if (options.tabId && window.app) {
          window.app.switchTab(options.tabId);
        }
        notification.close();
      };

      setTimeout(() => notification.close(), 8000);
      console.log(`✅ Notification sent: ${title}`);
      return notification;
    } catch (error) {
      console.error("Gagal kirim notifikasi:", error);
      
      // Fallback ke toast
      if (typeof showToast === 'function') {
        showToast(`${title}: ${body.substring(0, 50)}`, "info");
      }
      return null;
    }
  },

  send(title, body, options = {}) {
    if (Notification.permission !== "granted") {
      console.log("Cannot send notification: permission not granted");
      return null;
    }

    try {
      const notification = new Notification(title, {
        body: body,
        icon: options.icon || "https://www.svgrepo.com/show/475656/google-color.svg",
        tag: options.tag || "productivity",
        silent: options.silent || false,
        ...options
      });

      notification.onclick = () => {
        window.focus();
        if (options.tabId) {
          UI.switchTab(options.tabId);
        }
        notification.close();
      };

      setTimeout(() => notification.close(), 8000);
      console.log(`✅ Notification sent: ${title}`);
      return notification;
    } catch (error) {
      console.error("Gagal kirim notifikasi:", error);
      return null;
    }
  },

  async checkDeadlines() {
    const user = AppState.currentUser;
    if (!user) {
      console.log("No user logged in, skipping deadline check");
      return;
    }

    console.log("Checking deadlines...");
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentHour = now.getHours();

    const pendingTasks = AppState.tasks.filter(t => !t.done && t.deadline);
    console.log(`Found ${pendingTasks.length} pending tasks with deadlines`);

    const sentReminders = await this.getTodaySentReminders(user.uid, today);

    for (const task of pendingTasks) {
      const deadlineDate = new Date(task.deadline);
      const daysLeft = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
      const reminderKey = `deadline_${task.id}_${today}`;

      if (sentReminders.has(reminderKey)) continue;

      let reminderType = null;
      let message = "";
      let title = "";

      if (daysLeft === 1 && currentHour >= 9 && currentHour <= 20) {
        reminderType = "h-1";
        title = "⏰ Deadline Besok!";
        message = `Tugas "${task.title}" deadline besok! Jangan lupa dikerjain.`;
        showToast(`Reminder: "${task.title}" deadline besok!`, "warning");
      } else if (daysLeft === 0 && currentHour >= 8 && currentHour <= 22) {
        reminderType = "h-0";
        title = "⚠️ Deadline Hari Ini!";
        const hoursLeft = Math.ceil((deadlineDate - now) / (1000 * 60 * 60));
        if (hoursLeft > 0 && hoursLeft <= 12) {
          message = `⚠️ Tugas "${task.title}" deadline ${hoursLeft} jam lagi!`;
        } else {
          message = `Tugas "${task.title}" deadline HARI INI!`;
        }
        showToast(`⚠️ "${task.title}" deadline hari ini!`, "error");
      } else if (daysLeft < 0 && !task.overdueNotified) {
        reminderType = "overdue";
        title = "❗ Tugas Terlewat!";
        message = `Tugas "${task.title}" sudah melewati deadline. Segera selesaikan!`;
        showToast(`❗ "${task.title}" sudah lewat deadline!`, "error");
        task.overdueNotified = true;
      }

      if (reminderType) {
    // 🔥 TAMPILKAN TOAST UNTUK DEADLINE
    if (reminderType === "h-1") {
        showDeadlineToast(task.title, 1);
    } else if (reminderType === "h-0") {
        showDeadlineToast(task.title, 0);
    } else if (reminderType === "overdue") {
        showDeadlineToast(task.title, -1);
    }
    
    // Kirim notifikasi browser juga
    this.send(
        reminderType === "overdue" ? "❗ Tugas Terlewat!" : "⏰ Deadline Mendekat!",
        message,
        { tabId: 'tasks', tag: `deadline_${task.id}` }
    );
    
    await this.saveSentReminder(user.uid, {
        taskId: task.id,
        type: reminderType,
        date: today,
        timestamp: Date.now()
    });
}
    }
  },

  async getTodaySentReminders(userId, today) {
    const sentReminders = new Set();
    try {
      const q = query(REMINDERS_COLLECTION, where("userId", "==", userId), where("date", "==", today));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(doc => {
        const data = doc.data();
        sentReminders.add(`${data.type}_${data.taskId}_${data.date}`);
      });
    } catch (error) {
      console.error("Gagal ambil sent reminders:", error);
    }
    return sentReminders;
  },

  async saveSentReminder(userId, reminderData) {
    try {
      await addDoc(REMINDERS_COLLECTION, {
        userId: userId,
        taskId: reminderData.taskId,
        type: reminderData.type,
        date: reminderData.date,
        timestamp: reminderData.timestamp
      });
    } catch (error) {
      console.error("Gagal save sent reminder:", error);
    }
  },

  async sendDailySummary() {
    const user = AppState.currentUser;
    if (!user) {
      console.log("No user, skipping daily summary");
      return;
    }

    console.log("Sending daily summary...");
    const pendingTasks = AppState.tasks.filter(t => !t.done);
    const today = new Date().toISOString().split("T")[0];
    const completedToday = AppState.tasks.filter(t => {
      if (!t.done || !t.completedAt) return false;
      return t.completedAt.split("T")[0] === today;
    });

    const upcomingDeadlines = AppState.tasks.filter(t => {
      if (!t.deadline || t.done) return false;
      const daysLeft = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24));
      return daysLeft <= 3 && daysLeft >= 0;
    });

    let summary = `📋 Ringkasan Hari Ini:\n\n`;
    summary += `📝 Tersisa: ${pendingTasks.length} tugas belum selesai\n`;
    summary += `✅ Selesai hari ini: ${completedToday.length} tugas\n`;
    
    if (upcomingDeadlines.length > 0) {
      summary += `\n⚠️ Deadline mepet (≤3 hari):\n`;
      upcomingDeadlines.forEach(t => {
        const days = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        summary += `  • ${t.title} (${days} hari lagi)\n`;
      });
    }
    
    summary += `\n📚 Total notes: ${AppState.notes.length}\n`;
    summary += `🔥 Streak: ${this.getStreak()} hari aktif`;

    this.send("📊 Daily Summary", summary, { tabId: "dashboard", tag: "daily_summary", silent: false });
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

  async setCustomReminder(title, message, datetime, taskId = null) {
    const user = AppState.currentUser;
    if (!user) {
      showToast("Login dulu untuk set reminder!", "error");
      return;
    }

    try {
      await addDoc(CUSTOM_REMINDERS_COLLECTION, {
        userId: user.uid,
        title: title,
        message: message || title,
        datetime: datetime.toISOString(),
        taskId: taskId,
        createdAt: new Date().toISOString(),
        triggered: false
      });
      showToast(`Reminder "${title}" berhasil diset!`, "success");
    } catch (error) {
      console.error("Gagal save custom reminder:", error);
      showToast("Gagal menyimpan reminder!", "error");
    }
  },

  async checkCustomReminders() {
    const user = AppState.currentUser;
    if (!user) return;

    const now = new Date();
    try {
      const q = query(CUSTOM_REMINDERS_COLLECTION, where("userId", "==", user.uid), where("triggered", "==", false));
      const querySnapshot = await getDocs(q);

      for (const docSnap of querySnapshot.docs) {
        const reminder = { id: docSnap.id, ...docSnap.data() };
        const reminderTime = new Date(reminder.datetime);
        
        if (reminderTime <= now) {
          this.send(reminder.title, reminder.message, { tabId: reminder.taskId ? "tasks" : "dashboard", tag: `custom_${reminder.id}` });
          
          await updateDoc(doc(db, "custom_reminders", reminder.id), {
            triggered: true,
            triggeredAt: now.toISOString()
          });
          
          showToast(`🔔 ${reminder.title}`, "success");
        }
      }
    } catch (error) {
      console.error("Gagal cek custom reminders:", error);
    }
  },

  async init() {
    const granted = await this.requestPermission();
    if (granted) {
      console.log("✅ Notifikasi diizinkan!");
      // Initial check after 2 seconds
      setTimeout(() => {
        this.checkDeadlines();
        this.checkCustomReminders();
      }, 2000);
    } else {
      console.log("❌ Notifikasi tidak diizinkan");
    }
  }
};