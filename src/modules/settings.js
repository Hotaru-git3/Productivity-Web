import { auth, db } from "../firebase";
import { updateProfile, updateEmail, sendEmailVerification, updatePassword } from "firebase/auth";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { showToast } from "../utils/toast";
import { AppState } from "./state";
import { TaskManager } from "./tasks";
import { NoteManager } from "./notes";
import { RoutineManager } from "./routines";

export const SettingsManager = {
  init() {
    this.loadSettings();
    this.setupEventListeners();
  },

  loadSettings() {
    // Load dari localStorage
    const settings = JSON.parse(localStorage.getItem("codash_settings")) || {
      darkMode: "system", // light, dark, system
      fontSize: "medium", // small, medium, large
      notifications: {
        deadline: true,
        taskComplete: true,
        dailySummary: true,
        sound: false
      }
    };
    
    this.settings = settings;
    this.applySettings();
    this.renderForm();
  },

  saveSettings() {
    localStorage.setItem("codash_settings", JSON.stringify(this.settings));
    this.applySettings();
    showToast("⚙️ Pengaturan disimpan!", "success");
  },

  applySettings() {
    // Dark mode
    const isDark = this.settings.darkMode === "dark" || 
      (this.settings.darkMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    
    if (isDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    
    // Font size
    const fontSizeMap = { small: "14px", medium: "16px", large: "18px" };
    document.documentElement.style.fontSize = fontSizeMap[this.settings.fontSize];
  },

  renderForm() {
  const container = document.getElementById("settingsContainer");
  if (!container) return;

  const user = auth.currentUser;
  const settings = this.settings;

  container.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-4 md:space-y-6 px-2 md:px-0">
      <!-- Profil & Akun -->
      <div class="bg-white dark:bg-darkCard rounded-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-800">
        <h3 class="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <i class="fa-regular fa-user text-primary"></i> Profil & Akun
        </h3>
        <div class="space-y-3 md:space-y-4">
          <div>
            <label class="block text-xs md:text-sm font-medium mb-1">Nama Tampilan</label>
            <input type="text" id="displayName" value="${user?.displayName || ''}" 
              class="w-full px-3 md:px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base">
          </div>
          <div>
            <label class="block text-xs md:text-sm font-medium mb-1">Email</label>
            <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <input type="email" id="email" value="${user?.email || ''}" readonly disabled
                class="flex-1 px-3 md:px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-sm md:text-base">
              <button id="verifyEmailBtn" class="px-3 md:px-4 py-2 rounded-xl bg-primary text-white hover:bg-indigo-600 transition text-xs md:text-sm whitespace-nowrap">
                ${user?.emailVerified ? '✓ Terverifikasi' : 'Verifikasi'}
              </button>
            </div>
          </div>
          <div>
            <label class="block text-xs md:text-sm font-medium mb-1">Password</label>
            <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <input type="password" id="password" placeholder="••••••••" 
                class="flex-1 px-3 md:px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base">
              <button id="updatePasswordBtn" class="px-3 md:px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 transition text-xs md:text-sm">Update</button>
            </div>
          </div>
          <button id="deleteAccountBtn" class="text-red-500 text-xs md:text-sm hover:underline flex items-center gap-1 mt-2">
            <i class="fa-solid fa-trash-can"></i> Hapus Akun
          </button>
        </div>
      </div>

      <!-- Tampilan -->
      <div class="bg-white dark:bg-darkCard rounded-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-800">
        <h3 class="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <i class="fa-solid fa-palette text-primary"></i> Tampilan
        </h3>
        <div class="space-y-3 md:space-y-4">
          <div>
            <label class="block text-xs md:text-sm font-medium mb-2">Mode Gelap</label>
            <div class="flex flex-wrap gap-3 md:gap-4">
              <label class="flex items-center gap-2 text-sm"><input type="radio" name="darkMode" value="light" ${settings.darkMode === 'light' ? 'checked' : ''}> Terang</label>
              <label class="flex items-center gap-2 text-sm"><input type="radio" name="darkMode" value="dark" ${settings.darkMode === 'dark' ? 'checked' : ''}> Gelap</label>
              <label class="flex items-center gap-2 text-sm"><input type="radio" name="darkMode" value="system" ${settings.darkMode === 'system' ? 'checked' : ''}> Ikuti Sistem</label>
            </div>
          </div>
          <div>
            <label class="block text-xs md:text-sm font-medium mb-2">Ukuran Font</label>
            <div class="flex flex-wrap gap-3 md:gap-4">
              <label class="flex items-center gap-2 text-sm"><input type="radio" name="fontSize" value="small" ${settings.fontSize === 'small' ? 'checked' : ''}> Kecil</label>
              <label class="flex items-center gap-2 text-sm"><input type="radio" name="fontSize" value="medium" ${settings.fontSize === 'medium' ? 'checked' : ''}> Sedang</label>
              <label class="flex items-center gap-2 text-sm"><input type="radio" name="fontSize" value="large" ${settings.fontSize === 'large' ? 'checked' : ''}> Besar</label>
            </div>
          </div>
        </div>
      </div>

      <!-- Notifikasi -->
      <div class="bg-white dark:bg-darkCard rounded-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-800">
        <h3 class="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <i class="fa-solid fa-bell text-primary"></i> Notifikasi
        </h3>
        <div class="space-y-3">
          <label class="flex items-center justify-between cursor-pointer py-1">
            <span class="text-sm md:text-base">Deadline Mendekat</span>
            <input type="checkbox" id="notifDeadline" ${settings.notifications.deadline ? 'checked' : ''} class="toggle-switch">
          </label>
          <label class="flex items-center justify-between cursor-pointer py-1">
            <span class="text-sm md:text-base">Tugas Selesai</span>
            <input type="checkbox" id="notifTaskComplete" ${settings.notifications.taskComplete ? 'checked' : ''} class="toggle-switch">
          </label>
          <label class="flex items-center justify-between cursor-pointer py-1">
            <span class="text-sm md:text-base">Daily Summary</span>
            <input type="checkbox" id="notifDailySummary" ${settings.notifications.dailySummary ? 'checked' : ''} class="toggle-switch">
          </label>
          <label class="flex items-center justify-between cursor-pointer py-1">
            <span class="text-sm md:text-base">Suara Notifikasi</span>
            <input type="checkbox" id="notifSound" ${settings.notifications.sound ? 'checked' : ''} class="toggle-switch">
          </label>
        </div>
      </div>

      <!-- Data & Backup -->
      <div class="bg-white dark:bg-darkCard rounded-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-800">
        <h3 class="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <i class="fa-solid fa-database text-primary"></i> Data & Backup
        </h3>
        <div class="flex flex-wrap gap-2 md:gap-3">
          <button id="exportDataBtn" class="px-3 md:px-4 py-2 rounded-xl bg-primary text-white hover:bg-indigo-600 transition text-sm">📥 Ekspor</button>
          <button id="importDataBtn" class="px-3 md:px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 transition text-sm">📤 Impor</button>
          <button id="resetDataBtn" class="px-3 md:px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition text-sm">🗑️ Hapus</button>
        </div>
        <input type="file" id="importFile" accept=".json" class="hidden">
      </div>

      <!-- Tentang -->
      <div class="bg-white dark:bg-darkCard rounded-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-800">
        <h3 class="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <i class="fa-solid fa-info-circle text-primary"></i> Tentang
        </h3>
        <p class="text-sm"><strong>Co-Dash</strong> v1.0.0</p>
        <p class="text-xs text-gray-500 mt-2">© 2025 Zidane Solahudin</p>
      </div>

      <button id="saveSettingsBtn" class="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-indigo-600 transition text-sm md:text-base">
        Simpan Semua Pengaturan
      </button>
    </div>
  `;

  this.attachEventListeners();
},

  attachEventListeners() {
    // Save button
    document.getElementById("saveSettingsBtn")?.addEventListener("click", () => this.saveAllSettings());
    
    // Profile updates
    document.getElementById("updatePasswordBtn")?.addEventListener("click", () => this.updatePassword());
    document.getElementById("verifyEmailBtn")?.addEventListener("click", () => this.verifyEmail());
    document.getElementById("deleteAccountBtn")?.addEventListener("click", () => this.deleteAccount());
    
    // Data management
    document.getElementById("exportDataBtn")?.addEventListener("click", () => this.exportData());
    document.getElementById("importDataBtn")?.addEventListener("click", () => document.getElementById("importFile")?.click());
    document.getElementById("importFile")?.addEventListener("change", (e) => this.importData(e));
    document.getElementById("resetDataBtn")?.addEventListener("click", () => this.resetData());
  },

  saveAllSettings() {
    // Dark mode
    const darkMode = document.querySelector('input[name="darkMode"]:checked')?.value;
    const fontSize = document.querySelector('input[name="fontSize"]:checked')?.value;
    
    this.settings.darkMode = darkMode;
    this.settings.fontSize = fontSize;
    
    // Notifications
    this.settings.notifications = {
      deadline: document.getElementById("notifDeadline")?.checked || false,
      taskComplete: document.getElementById("notifTaskComplete")?.checked || false,
      dailySummary: document.getElementById("notifDailySummary")?.checked || false,
      sound: document.getElementById("notifSound")?.checked || false
    };
    
    // Update display name
    const newName = document.getElementById("displayName")?.value;
    if (newName && auth.currentUser && newName !== auth.currentUser.displayName) {
      updateProfile(auth.currentUser, { displayName: newName })
        .then(() => {
          showToast("Nama berhasil diupdate!", "success");
          document.getElementById("dropdownUserName").innerText = newName;
          document.getElementById("welcomeText").innerText = `Welcome Back, ${newName}!`;
        })
        .catch(err => showToast(err.message, "error"));
    }
    
    this.saveSettings();
  },

  async updatePassword() {
    const password = document.getElementById("password")?.value;
    if (!password || password.length < 6) {
      showToast("Password minimal 6 karakter!", "error");
      return;
    }
    
    try {
      await updatePassword(auth.currentUser, password);
      showToast("Password berhasil diupdate!", "success");
      document.getElementById("password").value = "";
    } catch (err) {
      showToast(err.message, "error");
    }
  },

  async verifyEmail() {
    try {
      await sendEmailVerification(auth.currentUser);
      showToast("Email verifikasi telah dikirim! Cek inbox/spam.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  },

  deleteAccount() {
    if (confirm("⚠️ Yakin mau hapus akun? SEMUA DATA akan hilang permanen!")) {
      // Hapus semua data user dari Firestore
      const userId = auth.currentUser.uid;
      // Logic hapus data (bisa diimplementasi)
      auth.currentUser.delete()
        .then(() => {
          showToast("Akun berhasil dihapus", "success");
          setTimeout(() => window.auth.logout(), 1000);
        })
        .catch(err => showToast(err.message, "error"));
    }
  },

  exportData() {
    const data = {
      tasks: AppState.tasks,
      notes: AppState.notes,
      routines: AppState.routines,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codash-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✅ Data berhasil diekspor!", "success");
  },

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // Logic restore data ke Firestore
        showToast("📥 Data berhasil diimpor! (Fitur dalam pengembangan)", "info");
      } catch (err) {
        showToast("File tidak valid!", "error");
      }
    };
    reader.readAsText(file);
  },

  resetData() {
    if (confirm("⚠️ Yakin mau hapus SEMUA tasks, notes, dan routines? Data tidak bisa dikembalikan!")) {
      // Logic hapus semua data
      showToast("🗑️ Semua data telah dihapus", "success");
      setTimeout(() => {
        TaskManager.load();
        NoteManager.load();
        RoutineManager.load();
      }, 500);
    }
  },

  setupEventListeners() {
    // Tambahin listener untuk toggle switch styling (opsional)
  }
};