import { auth } from "../firebase";
import { showToast } from "../utils/toast";
import { AppState } from "./state";

export const ProfileManager = {
  // Ganti bagian init() di profile.js lo dengan ini:
init() {
  const menuBtn = document.getElementById("profileMenuBtn"); //
  const dropdown = document.getElementById("profileDropdown"); //
  const arrow = document.getElementById("dropdownArrow"); //
  let closeTimer;

  if (!menuBtn || !dropdown) return;

  const showDropdown = () => {
    clearTimeout(closeTimer);
    dropdown.classList.remove("hidden");
    if (arrow) arrow.style.transform = "rotate(180deg)";
  };

  const hideDropdown = () => {
    // Delay 300ms biar smooth pas pindah kursor
    closeTimer = setTimeout(() => {
      dropdown.classList.add("hidden");
      if (arrow) arrow.style.transform = "rotate(0deg)";
    }, 300);
  };

  // Event saat hover tombol
  menuBtn.addEventListener("mouseenter", showDropdown);
  menuBtn.addEventListener("mouseleave", hideDropdown);

  // Event saat kursor di dalem dropdown (biar nggak mati pas lagi milih menu)
  dropdown.addEventListener("mouseenter", () => clearTimeout(closeTimer));
  dropdown.addEventListener("mouseleave", hideDropdown);

  this.updateUserInfo();
},
  
  getInitials(name) {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  },
  
  updateUserInfo() {
  const user = auth.currentUser;
  const nameEl = document.getElementById("dropdownUserName");
  const emailEl = document.getElementById("dropdownUserEmail");
  const avatarEl = document.getElementById("userAvatar");
  
  // Hapus semua console.log yang menampilkan user
  // console.log("updateUserInfo called");
  // console.log("user:", user);
  // console.log("nameEl:", nameEl);
  // console.log("emailEl:", emailEl);
  
  if (user) {
    const displayName = user.displayName || user.email?.split('@')[0] || "User";
    const initials = this.getInitials(displayName);
    
    if (nameEl) nameEl.innerText = displayName;
    if (emailEl) emailEl.innerText = user.email || "";
    if (avatarEl) avatarEl.innerText = initials;
  }
},
  
 showProfile() {
  const user = auth.currentUser;
  if (!user) return;
  
  const displayName = user.displayName || user.email?.split('@')[0] || "User";
  const initials = this.getInitials(displayName);
  
  // Hitung statistik
  const totalTasksDone = AppState.tasks.filter(t => t.done).length;
  const totalNotes = AppState.notes.length;
  const streak = window.Dashboard?.getStreak() || 0;
  
  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in p-4";
  modal.innerHTML = `
    <div class="bg-white dark:bg-darkCard rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-100 dark:border-gray-800">
      <!-- Header -->
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-bold">Profile</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 transition w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center">✕</button>
      </div>
      
      <!-- Avatar & Nama -->
      <div class="flex flex-col items-center mb-4">
        <div class="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-3xl shadow-md">
          ${initials}
        </div>
        <p class="font-semibold text-lg mt-3">${displayName}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">${user.email || ""}</p>
        <div class="mt-2 px-3 py-1 rounded-full text-xs ${user.emailVerified ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}">
          ${user.emailVerified ? "✓ Terverifikasi" : "⚠️ Belum verifikasi"}
        </div>
      </div>
      
      <!-- Stats Cards -->
      <div class="grid grid-cols-3 gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
        <div class="text-center">
          <p class="text-2xl font-bold text-primary">${totalTasksDone}</p>
          <p class="text-[10px] text-gray-500">Tugas Selesai</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-bold text-primary">${totalNotes}</p>
          <p class="text-[10px] text-gray-500">Catatan</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-bold text-primary">${streak}</p>
          <p class="text-[10px] text-gray-500">Streak 🔥</p>
        </div>
      </div>
      
      <!-- Info Akun -->
      <div class="space-y-2 text-sm border-t border-gray-100 dark:border-gray-800 pt-4">
        <div class="flex justify-between">
          <span class="text-gray-500">Akun sejak:</span>
          <span class="font-medium">${new Date(user.metadata.creationTime).toLocaleDateString('id-ID')}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Terakhir login:</span>
          <span class="font-medium">${new Date(user.metadata.lastLoginTime).toLocaleDateString('id-ID')}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Login dengan:</span>
          <span class="font-medium">${user.providerData[0]?.providerId === 'google.com' ? 'Google' : 'Email'}</span>
        </div>
      </div>
      
      <!-- Tombol Tutup -->
      <button onclick="this.closest('.fixed').remove()" class="w-full mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-600 transition font-medium">Tutup</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Tutup dropdown
  document.getElementById("profileDropdown")?.classList.add("hidden");
  const arrow = document.getElementById("dropdownArrow");
  if (arrow) arrow.style.transform = "rotate(0deg)";
},
  
  showSettings() {
  // Tutup dropdown
  const dropdown = document.getElementById("profileDropdown");
  const arrow = document.getElementById("dropdownArrow");
  if (dropdown) dropdown.classList.add("hidden");
  if (arrow) arrow.style.transform = "rotate(0deg)";
  
  // Buka tab pengaturan
  if (window.app && window.app.switchTab) {
    window.app.switchTab("settings");
  } else {
    // Fallback: cari UI dari global
    const UI = window.UI;
    if (UI && UI.switchTab) {
      UI.switchTab("settings");
    }
  }
  
  // Reload settings container setiap kali dibuka
  setTimeout(() => {
    if (window.settingsManager && window.settingsManager.renderForm) {
      window.settingsManager.renderForm();
    }
  }, 100);
},
};