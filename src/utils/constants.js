export const APP_NAME = "Co-Dash";

export const STORAGE_KEYS = {
  ACTIVITY_LOG: "activityLog",
  THEME: "theme",
};

// src/utils/constants.js
export const DEFAULT_WORDS = [
  { kanji: "勉強", romaji: "Benkyou", meaning: "Belajar" },
  { kanji: "頑張って", romaji: "Ganbatte", meaning: "Semangat/Berjuang" },
  { kanji: "効率", romaji: "Kouritsu", meaning: "Efisiensi" },
  { kanji: "目標", romaji: "Mokuhyou", meaning: "Target/Tujuan" },
  { kanji: "集中", romaji: "Shuuchuu", meaning: "Konsentrasi" },
  { kanji: "習慣", romaji: "Shuukan", meaning: "Kebiasaan" },
  { kanji: "進歩", romaji: "Shinpo", meaning: "Kemajuan" },
  { kanji: "成長", romaji: "Seichou", meaning: "Perkembangan" },
  { kanji: "達成", romaji: "Tassei", meaning: "Pencapaian" },
  { kanji: "継続", romaji: "Keizoku", meaning: "Konsistensi" }
];

export function getWordOfDay() {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const index = dayOfYear % DEFAULT_WORDS.length;
  return DEFAULT_WORDS[index];
};

export const MUSIC_PLAYLISTS = {
  lofi: { name: "Lo-Fi Study Beats", file: "/music/lofi.mp3", icon: "fa-headphones" },
  classical: { name: "Classical for Studying", file: "/music/classical.mp3", icon: "fa-music" },
  ambient: { name: "Ambient Study", file: "/music/ambient.mp3", icon: "fa-cloud-moon" },
  nature: { name: "Nature Sounds", file: "/music/nature.mp3", icon: "fa-tree" }
};

export const POMODORO_DURATION = 25 * 60;
export const ALARM_SOUND_URL = "/music/alarm.mp3";