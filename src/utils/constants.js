export const APP_NAME = "Co-Dash";

export const STORAGE_KEYS = {
  ACTIVITY_LOG: "activityLog",
  THEME: "theme",
};

export const DEFAULT_WORDS = [
  { kanji: "勉強", romaji: "(Benkyou) - Belajar" },
  { kanji: "頑張って", romaji: "(Ganbatte) - Semangat/Berjuang" },
  { kanji: "効率", romaji: "(Kouritsu) - Efisiensi" },
  { kanji: "目標", romaji: "(Mokuhyou) - Target/Tujuan" },
  { kanji: "情報セキュリティ", romaji: "(Jouhou Sekyuriti) - Cybersecurity" }
];

export const MUSIC_PLAYLISTS = {
  lofi: { name: "Lo-Fi Study Beats", file: "/music/lofi.mp3", icon: "fa-headphones" },
  classical: { name: "Classical for Studying", file: "/music/classical.mp3", icon: "fa-music" },
  ambient: { name: "Ambient Study", file: "/music/ambient.mp3", icon: "fa-cloud-moon" },
  nature: { name: "Nature Sounds", file: "/music/nature.mp3", icon: "fa-tree" }
};

export const POMODORO_DURATION = 25 * 60;
export const ALARM_SOUND_URL = "https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3";