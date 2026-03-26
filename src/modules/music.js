import { MUSIC_PLAYLISTS } from "../utils/constants";
import { showToast } from "../utils/toast";

let currentAudio = null;
let isPlaying = false;

export const MusicPlayer = {
  init() {
    const volumeSlider = document.getElementById("volumeSlider");
    if (volumeSlider) {
      volumeSlider.addEventListener("input", (e) => {
        if (currentAudio) {
          currentAudio.volume = e.target.value / 100;
        }
      });
    }
  },

  play(type) {
    const playlist = MUSIC_PLAYLISTS[type];
    if (!playlist) return;

    if (currentAudio) {
      currentAudio.pause();
    }

    currentAudio = new Audio(playlist.file);
    currentAudio.loop = true;
    currentAudio.volume = 0.5;
    currentAudio.play().catch(e => {
      console.error("Audio play failed:", e);
      showToast("Gagal memutar musik, coba lagi", "error");
    });

    isPlaying = true;
    this.updateUI(playlist.name);
    showToast(`🎵 Memutar: ${playlist.name}`, "success");
  },

  stop() {
    if (!currentAudio) {
      showToast("Tidak ada musik yang sedang diputar", "info");
      return;
    }
    
    const musicName = document.getElementById("currentMusicLabel")?.innerText || "Musik";
    
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    isPlaying = false;
    this.resetUI();
    
    // 🔥 TAMBAHKAN TOAST STOP MUSIK
    showToast(`⏹️ ${musicName} dihentikan`, "info");
  },

  togglePlayPause() {
    if (!currentAudio) {
      showToast("Tidak ada musik yang sedang diputar", "info");
      return;
    }

    if (isPlaying) {
      currentAudio.pause();
      isPlaying = false;
      this.updatePlayPauseIcon(false);
      showToast("⏸️ Musik dijeda", "info");
    } else {
      currentAudio.play().catch(e => console.error("Play failed:", e));
      isPlaying = true;
      this.updatePlayPauseIcon(true);
      showToast("▶️ Musik dilanjutkan", "info");
    }
  },

  updateUI(musicName) {
    const label = document.getElementById("currentMusicLabel");
    const playPauseBtn = document.getElementById("musicPlayPauseBtn");
    const stopBtn = document.getElementById("musicStopBtn");
    const volumeControl = document.getElementById("volumeControl");

    if (label) label.innerText = musicName;
    if (playPauseBtn) playPauseBtn.classList.remove("hidden");
    if (stopBtn) stopBtn.classList.remove("hidden");
    if (volumeControl) volumeControl.classList.remove("hidden");

    this.updatePlayPauseIcon(true);
  },

  resetUI() {
    const label = document.getElementById("currentMusicLabel");
    const playPauseBtn = document.getElementById("musicPlayPauseBtn");
    const stopBtn = document.getElementById("musicStopBtn");
    const volumeControl = document.getElementById("volumeControl");

    if (label) label.innerText = "Belum ada musik diputar";
    if (playPauseBtn) playPauseBtn.classList.add("hidden");
    if (stopBtn) stopBtn.classList.add("hidden");
    if (volumeControl) volumeControl.classList.add("hidden");
  },

  updatePlayPauseIcon(playing) {
    const playPauseBtn = document.getElementById("musicPlayPauseBtn");
    if (playPauseBtn) {
      playPauseBtn.innerHTML = playing ? '<i class="fa-solid fa-pause text-xs"></i>' : '<i class="fa-solid fa-play text-xs"></i>';
    }
  }
};