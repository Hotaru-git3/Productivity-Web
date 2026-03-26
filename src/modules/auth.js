import { auth, googleProvider } from "../firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { UI } from "./ui";
import { AppState, resetState } from "./state";
import { showToast } from "../utils/toast";

export const AuthManager = {
  async login() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      showToast(`Halo ${result.user.displayName}! Selamat datang.`, "success");
      return result.user;
    } catch (error) {
      console.error("Login error:", error.code, error.message);
      if (error.code === "auth/popup-blocked") {
        showToast("Popup diblokir browser! Izinkan popup untuk login.", "error");
      } else if (error.code === "auth/popup-closed-by-user") {
        showToast("Login dibatalkan.", "warning");
      } else if (error.code === "auth/unauthorized-domain") {
        showToast("Domain tidak diizinkan. Tambahkan localhost ke Firebase Auth settings!", "error");
      } else if (error.code === "auth/network-request-failed") {
        showToast("Koneksi bermasalah. Cek internet dan coba lagi.", "error");
      } else {
        showToast(error.message || "Gagal login, coba lagi.", "error");
      }
      throw error;
    }
  },

  async logout() {
    try {
      await signOut(auth);
      showToast("Berhasil logout. Sampai jumpa!", "success");
      resetState();
      const taskList = document.getElementById("taskList");
      if (taskList) taskList.innerHTML = "";
      const chatBox = document.getElementById("chatBox");
      if (chatBox) chatBox.innerHTML = "";
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      showToast("Gagal logout!", "error");
      throw error;
    }
  },

  monitorState() {
    onAuthStateChanged(auth, async (user) => {
      AppState.currentUser = user;
      UI.renderAuthState(user);
    });
  }
};