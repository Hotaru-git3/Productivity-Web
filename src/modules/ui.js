import { AppState } from "./state";
import { Dashboard } from "./dashboard";
import { DEFAULT_WORDS, getWordOfDay } from "../utils/constants";
import { TaskManager } from "./tasks";
import { NoteManager } from "./notes";
import { ChatManager } from "./chat";

import { fetchWeatherAuto } from './weather.js';

export const renderCurrentDate = () => {
  const dateElement = document.getElementById("dateDisplay");
  if (!dateElement) return;

  const today = new Date();
  
  // Pake Intl.DateTimeFormat biar dapet format lokal yang enak dibaca
  // Contoh output: "Senin, 29 Maret 2026"
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  dateElement.innerText = today.toLocaleDateString('id-ID', options);
};

// src/modules/ui.js

export const updateDashboardInfo = async () => {
  const weatherEl = document.getElementById("weatherDisplay");
  const dateEl = document.getElementById("dateDisplay");
  if (!weatherEl) return;

  // Render Tanggal tetep jalan
  const now = new Date();
  if (dateEl) {
    dateEl.innerText = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Minta lokasi tanpa fallback
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // KONDISI SUKSES: Render cuaca asli
        const data = await fetchWeatherAuto(pos.coords.latitude, pos.coords.longitude);
        if (data) {
          weatherEl.innerHTML = `
            <div class="flex items-center gap-3 bg-white/5 backdrop-blur-sm p-2 px-4 rounded-2xl border border-white/10 shadow-sm animate-fade-in">
              <i class="fa-solid ${data.iconClass} text-2xl"></i>
              <div class="text-left">
                <p class="text-xl font-bold leading-none">${data.temp}°C</p>
                <p class="text-[10px] font-bold uppercase tracking-widest text-primary mt-1">${data.area} - ${data.desc}</p>
              </div>
            </div>
          `;
        }
      },
      (err) => {
        // KONDISI ERROR/DITOLAK: Tampilkan pesan error, jangan fallback ke Jakarta
        console.warn("Geolocation Error:", err.message);
        weatherEl.innerHTML = `
          <div class="text-[10px] text-red-400 font-bold uppercase italic bg-red-400/10 p-2 rounded-xl border border-red-400/20">
            <i class="fa-solid fa-location-dot mr-1"></i> Izin Lokasi Diperlukan
          </div>
        `;
      },
      { timeout: 10000 } // Kasih timeout 10 detik biar gak nunggu kelamaan
    );
  } else {
    weatherEl.innerHTML = `<span class="text-xs text-gray-400 italic">Browser tidak support lokasi</span>`;
  }
};

export const UI = {
  sidebar: null,
  overlay: null,

  isMobile() {
    return window.innerWidth < 1024;
  },

  init() {
    this.sidebar = document.getElementById("sidebar");
    this.overlay = document.getElementById("overlay");
    this.initTheme();
    this.initEventListeners();
  },

  switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.remove("hidden");

    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.classList.remove("active-tab");
      if (btn.dataset.tab === tabId) btn.classList.add("active-tab");
    });

    if (this.isMobile()) this.closeSidebar();
  },

  openSidebar() {
    if (!this.sidebar) return;
    this.sidebar.classList.remove("-translate-x-full");
    if (this.overlay) {
      this.overlay.style.visibility = "visible";
      this.overlay.style.opacity = "1";
      this.overlay.style.pointerEvents = "auto";
    }
  },

  closeSidebar() {
    if (!this.sidebar) return;
    this.sidebar.classList.add("-translate-x-full");
    if (this.overlay) {
      this.overlay.style.visibility = "hidden";
      this.overlay.style.opacity = "0";
      this.overlay.style.pointerEvents = "none";
    }
  },

  toggleSidebar() {
    if (this.sidebar.classList.contains("-translate-x-full")) {
      this.openSidebar();
    } else {
      this.closeSidebar();
    }
  },

  initTheme() {
    const savedTheme = localStorage.getItem("theme");
    const isDark = savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  },

  toggleTheme() {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
    Dashboard.update();
  },

  initEventListeners() {
    const openBtn = document.getElementById("openSidebarBtn");
    const closeBtn = document.getElementById("closeSidebarBtn");
    const themeBtn = document.getElementById("themeToggle");

    openBtn?.addEventListener("click", () => this.openSidebar());
    closeBtn?.addEventListener("click", () => this.closeSidebar());
    themeBtn?.addEventListener("click", () => this.toggleTheme());
    this.overlay?.addEventListener("click", () => this.closeSidebar());

    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        e.preventDefault();
        document.getElementById("globalSearch")?.focus();
      }
    });
  },

  renderAuthState(user) {
    const loginScreen = document.getElementById("loginScreen");
    const mainDashboard = document.getElementById("mainDashboard");

    if (user) {
      // Update Word of the Day dengan safe check
      try {
        const word = getWordOfDay(); // 🔥 Pakai fungsi getWordOfDay
        const jpKanji = document.getElementById("jpKanji");
        const jpRomaji = document.getElementById("jpRomaji");
        if (jpKanji) jpKanji.innerText = word.kanji;
        if (jpRomaji) jpRomaji.innerText = `(${word.romaji}) - ${word.meaning}`;
      } catch (error) {
        console.error("Error updating word of day:", error);
        // Fallback
        const jpKanji = document.getElementById("jpKanji");
        const jpRomaji = document.getElementById("jpRomaji");
        if (jpKanji) jpKanji.innerText = "勉強";
        if (jpRomaji) jpRomaji.innerText = "(Benkyou) - Belajar";
      }

      // 🔥 LOGIC FOTO & NAMA BARU DI SINI 🔥
      const welcomeText = document.getElementById("welcomeText");
      if (welcomeText) {
        // Ambil nama dari displayName (kalo login Google). Kalo email, potong nama depan sblm '@'
        const displayName = user.displayName || (user.email ? user.email.split('@')[0] : "User");
        welcomeText.innerText = `Welcome Back, ${displayName}!`;
      }

      const userProfileImg = document.getElementById("userProfileImg");
      if (userProfileImg) {
        if (user.photoURL) {
          // KONDISI 1: Google Login -> Gak diapa-apain, tetep pake foto asli
          userProfileImg.src = user.photoURL;
          
          // Jaga-jaga kalo link foto dari Google lagi error
          userProfileImg.onerror = () => {
            const fbName = user.displayName || "User";
            userProfileImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fbName)}&background=6366F1&color=fff&bold=true`;
          };
        } else {
          // KONDISI 2: Email Login -> Ambil 2 huruf depan email
          const emailStr = user.email || "User";
          const initials = emailStr.substring(0, 2).toUpperCase(); // misal "ab@..." jadi "AB"
          
          userProfileImg.src = `https://ui-avatars.com/api/?name=${initials}&background=6366F1&color=fff&bold=true`;
          userProfileImg.onerror = null; // Biar ga nge-loop errornya
        }
      }

      loginScreen?.classList.add("hidden");
      mainDashboard?.classList.remove("hidden");
      mainDashboard?.classList.add("flex");

      setTimeout(async () => {
        await TaskManager.load();
        await NoteManager.load();
        await ChatManager.load();

        if (window.routineManager) {
          console.log("📋 Loading routines...");
          await window.routineManager.load();
        }

        Dashboard.update();
        updateDashboardInfo();
      }, 100);
    } else {
      loginScreen?.classList.remove("hidden");
      mainDashboard?.classList.add("hidden");
      mainDashboard?.classList.remove("flex");
      
      AppState.tasks = [];
      AppState.notes = [];
      AppState.routines = [];
      
      const taskList = document.getElementById("taskList");
      if (taskList) taskList.innerHTML = "";
      
      const chatBox = document.getElementById("chatBox");
      if (chatBox) chatBox.innerHTML = "";
      
      const routinesContainer = document.getElementById("routinesContainer");
      if (routinesContainer) routinesContainer.innerHTML = "";

      // Balikin foto ke default pas udah log out
      const userProfileImg = document.getElementById("userProfileImg");
      if (userProfileImg) {
        userProfileImg.src = `https://ui-avatars.com/api/?name=User&background=6366F1&color=fff`;
        userProfileImg.onerror = null;
      }
    }
  } 
};