import { loadFromLocalStorage } from "../utils/storage";

export const AppState = {
  tasks: [],
  routines: [],
  notes: [],
  activityLog: loadFromLocalStorage("activityLog", {}),
  taskFilter: "all",
  pendingDelete: null,
  currentUser: null,
  pomodoro: { time: 25 * 60, interval: null }
};

export function updateState(key, value) {
  if (key in AppState) {
    AppState[key] = value;
  }
}

export function resetState() {
  AppState.tasks = [];
  AppState.routines = [];
  AppState.notes = [];
  AppState.taskFilter = "all";
  AppState.pendingDelete = null;
}