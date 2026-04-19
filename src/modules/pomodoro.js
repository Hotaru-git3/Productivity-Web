import { POMODORO_DURATION, ALARM_SOUND_URL } from "../utils/constants";
import { showToast } from "../utils/toast";
import { recordActivity } from "../utils/storage";
import { AppState } from "./state";

let pomoInterval = null;
let pomoTime = POMODORO_DURATION;
let endTime = null;
let alarmAudio = null;
let isRunning = false;

export const Pomodoro = {
  init() {
    this.updateDisplay();
    this.initAlarmSound();

    const startBtn = document.getElementById("pomodoroStart");
    const resetBtn = document.getElementById("pomodoroReset");
    const stopAlarmBtn = document.getElementById("stopAlarmBtn");

    startBtn?.addEventListener("click", () => this.start());
    resetBtn?.addEventListener("click", () => this.reset());
    stopAlarmBtn?.addEventListener("click", () => this.stopAlarm());
  },

  initAlarmSound() {
    alarmAudio = new Audio(ALARM_SOUND_URL);
    alarmAudio.preload = "auto";
    
    alarmAudio.onerror = () => {
      console.warn("Local alarm sound not found, using online fallback");
      alarmAudio = new Audio("https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3");
      alarmAudio.preload = "auto";
      
      alarmAudio.onerror = () => {
        console.warn("Online alarm sound failed, will use Web Audio beep");
        alarmAudio = null;
      };
    };
  },

  updateDisplay() {
    const minutes = Math.floor(pomoTime / 60).toString().padStart(2, "0");
    const seconds = (pomoTime % 60).toString().padStart(2, "0");
    const display = document.getElementById("pomodoroDisplay");
    if (display) display.innerText = `${minutes}:${seconds}`;
  },

  start() {
    if (isRunning) {
      // PAUSE
      clearInterval(pomoInterval);
      pomoInterval = null;
      isRunning = false;

      const btn = document.getElementById("pomodoroStart");
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Start';
        btn.classList.remove("bg-yellow-500");
        btn.classList.add("bg-primary");
      }
      this.stopAlarm();
    } else {
      // START or RESUME
      const btn = document.getElementById("pomodoroStart");
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        btn.classList.remove("bg-primary");
        btn.classList.add("bg-yellow-500");
      }

      isRunning = true;
      endTime = Date.now() + (pomoTime * 1000);

      pomoInterval = setInterval(async () => {
        if (!isRunning) return;

        const now = Date.now();
        const remaining = Math.round((endTime - now) / 1000);

        if (remaining > 0) {
          pomoTime = remaining;
          this.updateDisplay();
        } else {
          // WAKTU HABIS
          pomoTime = 0;
          this.updateDisplay();
          this.resetTimerState();

          // 🔥 LOG STUDY SESSION KE FIRESTORE
          // Di bagian timer habis, ganti dengan kode ini:

// 🔥 LOG STUDY SESSION (AGGREGATE PER HARI)
try {
  const { addDoc, collection, query, where, getDocs, updateDoc, doc } = await import("firebase/firestore");
  const { db } = await import("../firebase");
  const user = AppState.currentUser;
  
  if (user) {
    const today = new Date().toISOString().split("T")[0];
    
    // Cek apakah sudah ada dokumen untuk hari ini
    const q = query(
      collection(db, "dailyFocus"),
      where("userId", "==", user.uid),
      where("date", "==", today)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      // Buat dokumen baru
      await addDoc(collection(db, "dailyFocus"), {
        userId: user.uid,
        date: today,
        totalMinutes: 25,
        sessions: 1,
        lastUpdated: Date.now()
      });
    } else {
      // Update dokumen yang sudah ada
      const existingDoc = snapshot.docs[0];
      const currentMinutes = existingDoc.data().totalMinutes || 0;
      const currentSessions = existingDoc.data().sessions || 0;
      
      await updateDoc(doc(db, "dailyFocus", existingDoc.id), {
        totalMinutes: currentMinutes + 25,
        sessions: currentSessions + 1,
        lastUpdated: Date.now()
      });
    }
    
    console.log("✅ Daily focus updated!");
    window.dispatchEvent(new CustomEvent("session-logged"));
  }
} catch (err) {
  console.error("Failed to log session:", err);
}

          showToast("⏰ Waktu fokus abis! Istirahat dulu sana.", "success");
          recordActivity(AppState.activityLog);
          this.playAlarm();

          window.dispatchEvent(new CustomEvent("pomodoro-complete", {
            detail: { message: "Waktu fokus selesai! Waktunya istirahat!" }
          }));
        }
      }, 500);
    }
  },

  resetTimerState() {
    if (pomoInterval) {
      clearInterval(pomoInterval);
      pomoInterval = null;
    }
    isRunning = false;
    endTime = null;

    const btn = document.getElementById("pomodoroStart");
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-play"></i> Start';
      btn.classList.remove("bg-yellow-500");
      btn.classList.add("bg-primary");
    }
  },

  reset() {
    this.resetTimerState();
    pomoTime = POMODORO_DURATION;
    this.updateDisplay();
    this.stopAlarm();
  },

  playAlarm() {
    this.showStopAlarmButton(true);
    
    if (alarmAudio) {
      alarmAudio.currentTime = 0;
      alarmAudio.play().catch(e => {
        console.log("Audio play failed:", e);
        this.fallbackBeep();
      });
    } else {
      this.fallbackBeep();
    }
  },

  fallbackBeep() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.5;
      
      oscillator.start();
      
      let count = 0;
      const interval = setInterval(() => {
        if (count >= 2) {
          clearInterval(interval);
          oscillator.stop();
          audioCtx.close();
        } else {
          oscillator.stop();
          setTimeout(() => {
            oscillator.start();
          }, 100);
          count++;
        }
      }, 500);
      
    } catch (e) {
      console.log("Fallback beep failed:", e);
    }
  },

  stopAlarm() {
    this.showStopAlarmButton(false);
    if (alarmAudio) {
      alarmAudio.pause();
      alarmAudio.currentTime = 0;
    }
  },

  showStopAlarmButton(show) {
    const stopBtn = document.getElementById("stopAlarmBtn");
    if (stopBtn) {
      if (show) stopBtn.classList.remove("hidden");
      else stopBtn.classList.add("hidden");
    }
  }
};