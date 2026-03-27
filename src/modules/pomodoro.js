import { POMODORO_DURATION, ALARM_SOUND_URL } from "../utils/constants";
import { showToast } from "../utils/toast";
import { recordActivity } from "../utils/storage";
import { AppState } from "./state";

let pomoInterval = null;
let pomoTime = POMODORO_DURATION; // Sisa waktu dalam detik
let endTime = null; // Waktu absolut kapan timer harusnya kelar
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

    // 🔥 Event visibilitychange dihapus, udah nggak perlu lagi karena pakai Absolute Time
  },

  initAlarmSound() {
    alarmAudio = new Audio(ALARM_SOUND_URL);
    alarmAudio.preload = "auto";
    alarmAudio.onerror = () => {
      console.warn("Sound file not accessible");
      alarmAudio = null;
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
      
      // Tentukan target waktu kelar secara absolut (Waktu Sekarang + Sisa Waktu)
      endTime = Date.now() + (pomoTime * 1000);

      pomoInterval = setInterval(() => {
        if (!isRunning) return;

        const now = Date.now();
        // Hitung sisa detik berdasarkan waktu absolut
        const remaining = Math.round((endTime - now) / 1000);

        if (remaining > 0) {
          pomoTime = remaining;
          this.updateDisplay();
        } else {
          // WAKTU HABIS
          pomoTime = 0;
          this.updateDisplay();
          this.resetTimerState(); // Pakai helper biar rapi

          showToast("⏰ Waktu fokus abis! Istirahat dulu sana.", "success");
          recordActivity(AppState.activityLog);
          this.playAlarm();

          window.dispatchEvent(new CustomEvent("pomodoro-complete", {
            detail: { message: "Waktu fokus selesai! Waktunya istirahat!" }
          }));
        }
      }, 500); // Jalanin tiap 500ms biar pas nge-render detik di layar kerasa lebih smooth
    }
  },

  // Helper biar nggak ngulang nulis kode reset UI buat tombol
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
      alarmAudio.play().catch(e => console.log("Audio play failed:", e));
    } else {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.5;
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioCtx.close();
        }, 1000);
      } catch (e) { }
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