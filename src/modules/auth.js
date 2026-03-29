import { 
  auth, 
  googleProvider, 
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from "../firebase";
import { UI } from "./ui";
import { AppState, resetState } from "./state";
import { showToast } from "../utils/toast";

export const AuthManager = {
  // Google Login
  async loginWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      showToast(`Halo ${result.user.displayName}! Selamat datang.`, "success");
      return result.user;
    } catch (error) {
      console.error("Google login error:", error);
      if (error.code === 'auth/popup-blocked') {
        showToast("Popup diblokir browser! Izinkan popup untuk login.", "error");
      } else if (error.code === 'auth/unauthorized-domain') {
        showToast("Domain tidak diizinkan. Tambahkan localhost ke Firebase Auth settings!", "error");
      } else {
        showToast(error.message || "Gagal login, coba lagi.", "error");
      }
      throw error;
    }
  },

  // Email/Password Register
  async registerWithEmail(email, password) {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(auth.currentUser);
      showToast("Akun berhasil dibuat! Silakan verifikasi email Anda.", "success");
      return result.user;
    } catch (error) {
      console.error("Register error:", error);
      if (error.code === 'auth/email-already-in-use') {
        showToast("Email sudah terdaftar!", "error");
      } else if (error.code === 'auth/weak-password') {
        showToast("Password terlalu lemah! Minimal 6 karakter.", "error");
      } else {
        showToast(error.message || "Gagal mendaftar!", "error");
      }
      throw error;
    }
  },

  // Email/Password Login
  async loginWithEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    if (!result.user.emailVerified) {
      await sendEmailVerification(result.user);
      showToast("Email belum diverifikasi! Cek inbox Anda.", "warning");
      await firebaseSignOut(auth);
      return null;
    }
    
    showToast(`Selamat datang kembali!`, "success");
    return result.user;
  } catch (error) {
    console.error("Login error:", error);
    
    // 🔥 HANDLE RATE LIMITING
    if (error.code === 'auth/too-many-requests') {
      showToast("Terlalu banyak percobaan! Tunggu beberapa menit atau coba login dengan Google.", "error");
    } else if (error.code === 'auth/user-not-found') {
      showToast("Email tidak ditemukan!", "error");
    } else if (error.code === 'auth/wrong-password') {
      showToast("Password salah!", "error");
    } else if (error.code === 'auth/invalid-email') {
      showToast("Format email tidak valid!", "error");
    } else {
      showToast(error.message || "Gagal login!", "error");
    }
    throw error;
  }
},

  // Reset Password
async resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    // 🔥 TAMBAHKAN PESAN DENGAN PERINGATAN CEK SPAM
    showToast("📧 Email reset password telah dikirim! Cek inbox atau folder Spam/Junk Anda.", "success");
    return true;
  } catch (error) {
    console.error("Reset password error:", error);
    if (error.code === 'auth/user-not-found') {
      showToast("Email tidak ditemukan!", "error");
    } else if (error.code === 'auth/invalid-email') {
      showToast("Format email tidak valid!", "error");
    } else if (error.code === 'auth/too-many-requests') {
      showToast("Terlalu banyak permintaan! Coba lagi nanti.", "error");
    } else {
      showToast(error.message || "Gagal mengirim email reset password!", "error");
    }
    return false;
  }
},

  // Logout
  async logout() {
    try {
      await firebaseSignOut(auth);
      showToast("Berhasil logout. Sampai jumpa!", "success");
      resetState();
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      showToast("Gagal logout!", "error");
      return false;
    }
  },

  // Monitor auth state
  monitorState() {
    onAuthStateChanged(auth, (user) => {
      AppState.currentUser = user;
      UI.renderAuthState(user);
    });
  }
};