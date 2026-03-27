import { POMODORO_DURATION, ALARM_SOUND_URL } from "../utils/constants";
import { showToast } from "../utils/toast";
import { recordActivity } from "../utils/storage";
import { AppState } from "./state";

let pomoInterval = null;
let pomoTime = POMODORO_DURATION;
let alarmAudio = null;
let lastTimestamp = null;
let accumulatedTime = 0; // 🔥 Tambahin buat akumulasi

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
      console.warn("Sound file not accessible");
      alarmAudio = null;
    };
  },

  updateDisplay() {
    const minutes = Math.floor(pomoTime / 60).toString().padStart(2, "0");
    const seconds = (pomoTime % 60).toString().padStart(2, "0");
    const display = document.getElementById("pomodoroDisplay");
    if (display) display.innerText = `${minutes}:${seconds}`;
    
    document.title = `🍅 ${minutes}:${seconds} - Co-Dash`;
  },

  start() {
    if (pomoInterval) {
      // PAUSE
      clearInterval(pomoInterval);
      pomoInterval = null;
      const btn = document.getElementById("pomodoroStart");
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Start';
        btn.classList.remove("bg-yellow-500");
        btn.classList.add("bg-primary");
      }
      this.stopAlarm();
      document.title = "Co-Dash | Productivity Dashboard";
    } else {
      // START or RESUME
      const btn = document.getElementById("pomodoroStart");
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        btn.classList.remove("bg-primary");
        btn.classList.add("bg-yellow-500");
      }

      // 🔥 Pakai lastTimestamp yang terakhir (kalau resume) atau sekarang (kalau start baru)
      if (lastTimestamp === null) {
        lastTimestamp = Date.now();
      }
      
      pomoInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - lastTimestamp) / 1000);
        
        if (elapsed >= 1 && pomoTime > 0) {
          pomoTime = Math.max(0, pomoTime - elapsed);
          lastTimestamp = now;
          this.updateDisplay();
          
          if (pomoTime === 0) {
            this.reset();
            showToast("⏰ Waktu fokus abis! Istirahat dulu sana.", "success");
            recordActivity(AppState.activityLog);
            this.playAlarm();

            window.dispatchEvent(new CustomEvent("pomodoro-complete", {
              detail: { message: "Waktu fokus selesai! Waktunya istirahat!" }
            }));
          }
        }
      }, 200);
    }
  },

  reset() {
    if (pomoInterval) {
      clearInterval(pomoInterval);
      pomoInterval = null;
    }
    pomoTime = POMODORO_DURATION;
    lastTimestamp = null; // 🔥 Reset timestamp
    this.updateDisplay();
    this.stopAlarm();
    document.title = "Co-Dash | Productivity Dashboard";

    const btn = document.getElementById("pomodoroStart");
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-play"></i> Start';
      btn.classList.remove("bg-yellow-500");
      btn.classList.add("bg-primary");
    }
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