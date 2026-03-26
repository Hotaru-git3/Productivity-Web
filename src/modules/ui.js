import { AppState } from "./state";
import { Dashboard } from "./dashboard";
import { DEFAULT_WORDS } from "../utils/constants";
import { TaskManager } from "./tasks";
import { NoteManager } from "./notes";
import { ChatManager } from "./chat";

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
      // Update Word of the Day
      const randomWord = DEFAULT_WORDS[Math.floor(Math.random() * DEFAULT_WORDS.length)];
      const jpKanji = document.getElementById("jpKanji");
      const jpRomaji = document.getElementById("jpRomaji");
      if (jpKanji) jpKanji.innerText = randomWord.kanji;
      if (jpRomaji) jpRomaji.innerText = randomWord.romaji;

      const welcomeText = document.getElementById("welcomeText");
      if (welcomeText) welcomeText.innerText = `Welcome Back, ${user.displayName}!`;

      const userProfileImg = document.getElementById("userProfileImg");
      if (userProfileImg) {
        userProfileImg.onerror = () => userProfileImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "User")}&background=6366F1&color=fff`;
        userProfileImg.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "User")}&background=6366F1&color=fff`;
      }

      loginScreen?.classList.add("hidden");
      mainDashboard?.classList.remove("hidden");
      mainDashboard?.classList.add("flex");

      setTimeout(() => {
        TaskManager.load();
        NoteManager.load();
        ChatManager.load();
        Dashboard.update();
      }, 100);
    } else {
      loginScreen?.classList.remove("hidden");
      mainDashboard?.classList.add("hidden");
      mainDashboard?.classList.remove("flex");
      AppState.tasks = [];
      AppState.notes = [];
      const taskList = document.getElementById("taskList");
      if (taskList) taskList.innerHTML = "";
      const chatBox = document.getElementById("chatBox");
      if (chatBox) chatBox.innerHTML = "";
    }
  }
};