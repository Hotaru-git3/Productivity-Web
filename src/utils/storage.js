export function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
    return false;
  }
}

export function loadFromLocalStorage(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error("Failed to load from localStorage:", error);
    return defaultValue;
  }
}

export function recordActivity(activityLog) {
  const today = new Date().toISOString().split("T")[0];
  activityLog[today] = (activityLog[today] || 0) + 1;
  saveToLocalStorage("activityLog", activityLog);
  return activityLog;
}