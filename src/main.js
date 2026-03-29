import "./style.css";
import { AuthManager } from "./modules/auth";
import { UI } from "./modules/ui";
import { TaskManager } from "./modules/tasks";
import { NoteManager } from "./modules/notes";
import { ChatManager } from "./modules/chat";
import { Dashboard } from "./modules/dashboard";
import { Pomodoro } from "./modules/pomodoro";
import { MusicPlayer } from "./modules/music";
import { NotificationManager } from "./modules/notifications";
import { AppState } from "./modules/state";
import { saveToLocalStorage } from "./utils/storage";
import { initToast, showToast, showTaskCompleteToast, showDeadlineToast } from "./utils/toast";
import { RoutineManager } from "./modules/routines";



// Panggil load saat user login
// Di UI.renderAuthState, tambahin:


// Expose globally for HTML onclick handlers
window.app = { switchTab: (tab) => UI.switchTab(tab) };
window.auth = AuthManager;
window.taskManager = TaskManager;
window.taskManager.updatePriority = TaskManager.updatePriority.bind(TaskManager);
window.noteManager = NoteManager;
window.chatManager = ChatManager;
window.music = MusicPlayer;
window.pomodoro = Pomodoro;
window.NotificationManager = NotificationManager;
window.showToast = showToast;
window.showTaskCompleteToast = showTaskCompleteToast;
window.routineManager = RoutineManager;
window.Dashboard = Dashboard;

window.addEventListener("routines-updated", () => {
  console.log("🔄 Routines updated event received, refreshing dashboard...");
  if (window.Dashboard) {
    window.Dashboard.update();
    if (typeof window.Dashboard.updateRoutineWidget === 'function') {
      window.Dashboard.updateRoutineWidget();
    }
  }
});

// Reminder modal functions
window.showReminderModal = async (taskId, taskTitle) => {
  const title = prompt("Judul reminder:", taskTitle ? `Selesaikan: ${taskTitle}` : "");
  if (!title) return;

  const dateStr = prompt("Tanggal & waktu (YYYY-MM-DD HH:MM):", new Date(Date.now() + 3600000).toISOString().slice(0, 16).replace("T", " "));
  if (!dateStr) return;

  const datetime = new Date(dateStr.replace(" ", "T"));
  if (isNaN(datetime.getTime())) {
    showToast("Format tanggal salah!", "error");
    return;
  }

  await NotificationManager.setCustomReminder(title, title, datetime, taskId);
};

window.closeReminderModal = () => { };
window.deleteReminder = async (id) => await NotificationManager.deleteCustomReminder(id);
window.loadActiveReminders = async () => { };
window.shareNote = (id) => NoteManager.share(id);

// Confirm modal
window.confirmModal = {
    close() {
        const modal = document.getElementById("confirmModal");
        if (modal) {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
        }
        AppState.pendingDelete = null;
    },
    async confirm() {
        const pending = AppState.pendingDelete;
        if (pending) {
            console.log("🗑️ Confirming delete:", pending);
            if (pending.type === "task") {
                await TaskManager.delete(pending.id);
            } else if (pending.type === "note") {
                await NoteManager.delete(pending.id);
            } else if (pending.type === "chat") {
                await ChatManager.clearHistory();
            }
        }
        this.close();
    },
};

// Event listeners
window.addEventListener("user-data-loaded", () => Dashboard.update());
window.addEventListener("pomodoro-complete", (e) => {
  if (NotificationManager) {
    NotificationManager.send("🍅 Pomodoro Selesai!", e.detail.message || "Waktunya istirahat! 🎉", {
      tabId: "tools", tag: "pomodoro_complete", silent: false
    });
  }
});

// Fungsi global untuk email auth
window.handleEmailLogin = async () => {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) {
    showToast("Isi email dan password!", "error");
    return;
  }
  await AuthManager.loginWithEmail(email, password);
};

window.handleEmailRegister = async () => {
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;
  if (!email || !password) {
    showToast("Isi email dan password!", "error");
    return;
  }
  if (password.length < 6) {
    showToast("Password minimal 6 karakter!", "error");
    return;
  }
  await AuthManager.registerWithEmail(email, password);
};

window.showResetPassword = () => {
  document.getElementById("resetModal").classList.remove("hidden");
  document.getElementById("resetModal").classList.add("flex");
};

window.closeResetModal = () => {
  document.getElementById("resetModal").classList.add("hidden");
  document.getElementById("resetModal").classList.remove("flex");
};

window.handleResetPassword = async () => {
  const email = document.getElementById("resetEmail").value;
  if (!email) {
    showToast("Isi email!", "error");
    return;
  }
  await AuthManager.resetPassword(email);
  closeResetModal();
};

// Tab切换
document.getElementById("tabLogin")?.addEventListener("click", () => {
  document.getElementById("loginForm").classList.remove("hidden");
  document.getElementById("registerForm").classList.add("hidden");
  document.getElementById("tabLogin").classList.add("border-b-2", "border-primary", "text-primary");
  document.getElementById("tabRegister").classList.remove("border-b-2", "border-primary", "text-primary");
  document.getElementById("tabRegister").classList.add("text-gray-500");
});

document.getElementById("tabRegister")?.addEventListener("click", () => {
  document.getElementById("registerForm").classList.remove("hidden");
  document.getElementById("loginForm").classList.add("hidden");
  document.getElementById("tabRegister").classList.add("border-b-2", "border-primary", "text-primary");
  document.getElementById("tabLogin").classList.remove("border-b-2", "border-primary", "text-primary");
  document.getElementById("tabLogin").classList.add("text-gray-500");
});

// DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  initToast();
  UI.init();
  Pomodoro.init();
  MusicPlayer.init();
  NotificationManager.init();
  RoutineManager.initModalListener();

  // 🔥 TAMBAHKAN INI - Request notification permission after user interaction
  const requestNotificationAfterInteraction = async () => {
    console.log("👆 User interaction detected, requesting notification permission...");
    if (window.NotificationManager) {
      const granted = await window.NotificationManager.requestPermissionWithInteraction();
      if (granted) {
        console.log("✅ Notification permission granted after interaction");
        // Kirim test notification
        window.NotificationManager.send(
          "🔔 Notifikasi Aktif!",
          "Notifikasi akan muncul untuk deadline tugas dan pengingat lainnya.",
          { tag: "welcome", silent: true }
        );
      } else {
        console.log("❌ Notification permission denied");
      }
    }
    // Hapus listener setelah sekali jalan
    document.removeEventListener("click", handleFirstInteraction);
    document.removeEventListener("touchstart", handleFirstInteraction);
  };
  
  const handleFirstInteraction = () => {
    requestNotificationAfterInteraction();
  };
  
  // Tunggu user melakukan interaksi pertama (klik/tap di mana saja)
  document.addEventListener("click", handleFirstInteraction);
  document.addEventListener("touchstart", handleFirstInteraction);
  
  // Timeout 10 detik, kalau ga ada interaksi, skip (biar ga numpuk listener)
  setTimeout(() => {
    document.removeEventListener("click", handleFirstInteraction);
    document.removeEventListener("touchstart", handleFirstInteraction);
  }, 10000);

  // Form handlers
  document.getElementById("taskForm")?.addEventListener("submit", (e) => TaskManager.add(e));
  document.getElementById("noteForm")?.addEventListener("submit", (e) => NoteManager.save(e));
  document.getElementById("confirmDeleteBtn")?.addEventListener("click", () => window.confirmModal.confirm());
  document.getElementById("globalSearch")?.addEventListener("input", (e) => {
    UI.switchTab("notes");
    NoteManager.render(e.target.value);
  });
  document.getElementById("fileInput")?.addEventListener("change", (e) => ChatManager.handleFileSelect(e));
  document.getElementById("removeImageBtn")?.addEventListener("click", () => ChatManager.clearAttachment());
  document.getElementById("chatForm")?.addEventListener("submit", (e) => ChatManager.sendMessage(e));

  // Start auth monitoring
  AuthManager.monitorState();

  // Auto-save activity log
  setInterval(() => {
    saveToLocalStorage("activityLog", AppState.activityLog);
  }, 60000);
});

// ========== NOTIFICATION & REMINDER SCHEDULER ==========
let reminderInterval = null;
let dailySummaryTimeout = null;

const startReminderScheduler = () => {
  // Stop existing scheduler
  if (reminderInterval) clearInterval(reminderInterval);
  if (dailySummaryTimeout) clearTimeout(dailySummaryTimeout);

  // Check deadlines every 15 minutes
  reminderInterval = setInterval(async () => {
    if (window.NotificationManager) {
      await window.NotificationManager.checkDeadlines();
      await window.NotificationManager.checkCustomReminders();
    }
  }, 15 * 60 * 1000);

  // Schedule daily summary at 7 AM
  const scheduleDailySummary = async () => {
    const now = new Date();
    const next7AM = new Date();
    next7AM.setHours(7, 0, 0, 0);
    
    if (now >= next7AM) {
      next7AM.setDate(next7AM.getDate() + 1);
    }
    
    const timeUntil7AM = next7AM - now;
    
    dailySummaryTimeout = setTimeout(async () => {
      if (window.NotificationManager) {
        await window.NotificationManager.sendDailySummary();
      }
      scheduleDailySummary();
    }, timeUntil7AM);
  };
  
  scheduleDailySummary();
  
  console.log("✅ Reminder scheduler started");
};

const stopReminderScheduler = () => {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  if (dailySummaryTimeout) {
    clearTimeout(dailySummaryTimeout);
    dailySummaryTimeout = null;
  }
  console.log("⏸️ Reminder scheduler stopped");
};

// Request notification permission on user interaction
const requestNotificationPermission = async () => {
  if ("Notification" in window) {
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        console.log("✅ Notification permission granted");
      }
    }
  }
};

// Monitor auth state to start/stop scheduler
const originalRenderAuthState = UI.renderAuthState;
UI.renderAuthState = function(user) {
  originalRenderAuthState.call(this, user);
  if (user) {
    // Start scheduler
    startReminderScheduler();
    // Request notification permission after login
    setTimeout(() => {
      requestNotificationPermission();
      // Initial check
      if (window.NotificationManager) {
        window.NotificationManager.checkDeadlines();
        window.NotificationManager.checkCustomReminders();
      }
    }, 2000);
  } else {
    stopReminderScheduler();
  }
};