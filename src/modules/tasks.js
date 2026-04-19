import { db } from "../firebase";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { AppState } from "./state";
import { showToast, showTaskCompleteToast } from "../utils/toast";
import { recordActivity } from "../utils/storage";
import { Dashboard } from "./dashboard";

const TASKS_COLLECTION = collection(db, "tasks");

export const TaskManager = {
  async load() {
    const user = AppState.currentUser;
    if (!user) return;

    try {
      const q = query(TASKS_COLLECTION, where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      AppState.tasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // 🔥 PANGGIL CLEANUP
      await this.cleanupOldTasks();
      
      this.render();
      Dashboard.update();
    } catch (error) {
      console.error("Failed to load tasks:", error);
      showToast("Gagal memuat tugas", "error");
    }
  },

  // 🔥 TAMBAHKAN METHOD INI
  async cleanupOldTasks() {
    const user = AppState.currentUser;
    if (!user) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    try {
      // Hapus task selesai > 7 hari
      const oldTasksQuery = query(
        TASKS_COLLECTION,
        where("userId", "==", user.uid),
        where("done", "==", true),
        where("completedAt", "<=", sevenDaysAgoStr)
      );
      const oldTasksSnapshot = await getDocs(oldTasksQuery);
      for (const docSnap of oldTasksSnapshot.docs) {
        await deleteDoc(docSnap.ref);
      }

      // Batasi completed tasks maksimal 30
      const completedTasksQuery = query(
        TASKS_COLLECTION,
        where("userId", "==", user.uid),
        where("done", "==", true)
      );
      const completedSnapshot = await getDocs(completedTasksQuery);
      const completedTasks = completedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt || new Date(0).toISOString()
      }));
      completedTasks.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));

      if (completedTasks.length > 30) {
        const toDelete = completedTasks.slice(0, completedTasks.length - 30);
        for (const task of toDelete) {
          await deleteDoc(doc(db, "tasks", task.id));
        }
      }

      // Refresh state
      const refreshQuery = query(TASKS_COLLECTION, where("userId", "==", user.uid));
      const refreshSnapshot = await getDocs(refreshQuery);
      AppState.tasks = refreshSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log("🧹 Cleanup completed");
    } catch (error) {
      console.error("Cleanup tasks error:", error);
    }
  },

  async add(e) {
    e.preventDefault();
    const user = AppState.currentUser;
    if (!user) return showToast("Login dulu!", "error");

    const input = document.getElementById("taskInput");
    const deadline = document.getElementById("taskDeadline");
    const priority = document.getElementById("taskPriority")?.value || "medium";
    const title = input.value.trim();
    const deadlineValue = deadline.value;

    if (!title) return showToast("Isi tugasnya dulu!", "error");
    if (!deadlineValue) return showToast("Isi tanggalnya dulu!", "error");

    try {
      await addDoc(TASKS_COLLECTION, {
        title,
        deadline: deadlineValue,
        priority: priority,
        done: false,
        overdueNotified: false,
        userId: user.uid,
        timestamp: Date.now()
      });
      input.value = "";
      deadline.value = "";
      if (document.getElementById("taskPriority")) {
        document.getElementById("taskPriority").value = "medium";
      }
      showToast("Tugas berhasil ditambahkan!");
      await this.load();
    } catch (error) {
      console.error("Failed to add task:", error);
      showToast("Gagal menambahkan tugas!", "error");
    }
  },

  async updatePriority(id, newPriority) {
    const task = AppState.tasks.find(t => t.id === id);
    if (!task) return;

    try {
      await updateDoc(doc(db, "tasks", id), { priority: newPriority });
      await this.load();
      const labels = { high: "🔴 Tinggi", medium: "🟡 Sedang", low: "🟢 Rendah" };
      showToast(`Priority diubah ke ${labels[newPriority]}`, "success");
    } catch (error) {
      console.error("Failed to update priority:", error);
      showToast("Gagal mengubah priority!", "error");
    }
  },

  getPriorityLabel(priority) {
    const labels = {
      high: "🔴 Tinggi",
      medium: "🟡 Sedang",
      low: "🟢 Rendah"
    };
    return labels[priority] || "🟡 Sedang";
  },

  getPriorityColor(priority) {
    const colors = {
      high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
      medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
    };
    return colors[priority] || colors.medium;
  },

  async toggle(id) {
    const task = AppState.tasks.find(t => t.id === id);
    if (!task) return;

    const newDone = !task.done;
    const wasDone = task.done;

    try {
      if (newDone && !wasDone) {
        task.completedAt = new Date().toISOString();
        await updateDoc(doc(db, "tasks", id), {
          done: true,
          completedAt: task.completedAt
        });
        recordActivity(AppState.activityLog);
        
        showTaskCompleteToast(task.title);
        
        if (window.NotificationManager && Notification.permission === "granted") {
          window.NotificationManager.send(
            "🎉 Selamat!",
            `Tugas "${task.title}" berhasil diselesaikan! Keep it up! 💪`,
            { tabId: 'tasks', tag: `complete_${task.id}`, silent: false }
          );
        }
      } else {
        await updateDoc(doc(db, "tasks", id), { done: newDone });
      }
      await this.load();
    } catch (error) {
      console.error("Failed to toggle task:", error);
      showToast("Gagal mengupdate tugas!", "error");
    }
  },

  async delete(id) {
    try {
      await deleteDoc(doc(db, "tasks", id));
      await this.load();
      showToast("✅ Tugas berhasil dihapus!", "success");
    } catch (error) {
      console.error("Failed to delete task:", error);
      showToast("Gagal menghapus tugas!", "error");
    }
  },

  setFilter(filter) {
  AppState.taskFilter = filter;
  this.render();
  
  // Update tombol aktif
  const allBtn = document.getElementById('filterAll');
  const pendingBtn = document.getElementById('filterPending');
  const doneBtn = document.getElementById('filterDone');
  
  // Reset semua ke gray
  [allBtn, pendingBtn, doneBtn].forEach(btn => {
    if (btn) {
      btn.classList.remove('text-primary', 'font-semibold');
      btn.classList.add('text-gray-500');
    }
  });
  
  // Set aktif sesuai filter
  if (filter === 'all' && allBtn) {
    allBtn.classList.remove('text-gray-500');
    allBtn.classList.add('text-primary', 'font-semibold');
  } else if (filter === 'pending' && pendingBtn) {
    pendingBtn.classList.remove('text-gray-500');
    pendingBtn.classList.add('text-primary', 'font-semibold');
  } else if (filter === 'done' && doneBtn) {
    doneBtn.classList.remove('text-gray-500');
    doneBtn.classList.add('text-primary', 'font-semibold');
  }
},

// Di dalam TaskManager, tambahin method ini:

getFilterFromURL() {
  const params = new URLSearchParams(window.location.search);
  const filter = params.get('filter');
  if (filter && ['all', 'pending', 'done'].includes(filter)) {
    AppState.taskFilter = filter;
    this.updateFilterButtons();
    this.render();
  }
},

setFilter(filter) {
  AppState.taskFilter = filter;
  this.render();
  this.updateFilterButtons();

  // Update URL query string
  const url = new URL(window.location);
  url.searchParams.set('filter', filter);
  window.history.pushState({}, '', url);
},

  render() {
    const list = document.getElementById("taskList");
    if (!list) return;

    let filteredTasks = AppState.tasks;
    if (AppState.taskFilter === "pending") filteredTasks = AppState.tasks.filter(t => !t.done);
    else if (AppState.taskFilter === "done") filteredTasks = AppState.tasks.filter(t => t.done);

    if (filteredTasks.length === 0) {
      list.innerHTML = `<p class="text-gray-500 text-sm text-center py-4">📭 Kosong nih. Santuy dulu aja!</p>`;
      return;
    }

    list.innerHTML = filteredTasks.map(task => {
      let isMepet = false;
      let daysLeft = null;
      let showDaysLeft = false; // 🔥 TAMBAHIN INI
      
      if (task.deadline && !task.done) {
        daysLeft = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        // 🔥 Cuma tampil kalo deadline ≤ 3 hari
        if (daysLeft <= 3 && daysLeft >= 0) {
          isMepet = true;
          showDaysLeft = true;
        }
        // Kalo overdue (minus) jangan tampilkan
        if (daysLeft < 0) {
          showDaysLeft = false;
        }
        // Kalo masih lama (>3 hari) jangan tampilkan
        if (daysLeft > 3) {
          showDaysLeft = false;
        }
      }

      const priorityColor = this.getPriorityColor(task.priority || "medium");
      const priorityLabel = this.getPriorityLabel(task.priority || "medium");

      return `
        <li class="flex justify-between items-center p-3 rounded-xl border ${task.done ? "bg-gray-50 dark:bg-gray-800/50 opacity-60" : "bg-white dark:bg-darkCard"}">
          <div class="flex items-center gap-3 w-full">
            <input type="checkbox" ${task.done ? "checked" : ""} onchange="window.taskManager.toggle('${task.id}')" class="w-5 h-5 text-primary rounded cursor-pointer accent-primary shrink-0">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="truncate ${task.done ? "line-through text-gray-500" : "font-medium"}">${escapeHtml(task.title)}</p>
                <span class="text-[10px] px-2 py-0.5 rounded-full ${priorityColor} border font-medium whitespace-nowrap">
                  ${priorityLabel}
                </span>
              </div>
              ${task.deadline ? `
                <div class="flex items-center gap-2 flex-wrap mt-1">
                  <p class="text-xs ${isMepet ? "text-red-500 font-bold" : "text-gray-500"}">
                    <i class="fa-regular fa-clock"></i> ${task.deadline}
                  </p>
                  ${showDaysLeft ? `
                    <p class="text-xs ${daysLeft === 0 ? "text-red-500 font-bold animate-pulse" : daysLeft === 1 ? "text-orange-500 font-semibold" : "text-amber-500"}">
                      ⏰ Sisa ${daysLeft === 0 ? "HARI INI!" : `${daysLeft} hari`}
                    </p>
                  ` : ""}
                </div>
              ` : ""}
            </div>
            <div class="flex gap-1 shrink-0">
              ${!task.done ? `
                <div class="relative group">
                  <button class="text-gray-400 hover:text-primary transition p-1" title="Ubah Priority">
                    <i class="fa-solid fa-flag"></i>
                  </button>
                  <div class="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hidden group-hover:block z-10 min-w-[100px]">
                    <button onclick="window.taskManager.updatePriority('${task.id}', 'high')" class="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600">🔴 High</button>
                    <button onclick="window.taskManager.updatePriority('${task.id}', 'medium')" class="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-amber-600">🟡 Medium</button>
                    <button onclick="window.taskManager.updatePriority('${task.id}', 'low')" class="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-green-600">🟢 Low</button>
                  </div>
                </div>
                <button onclick="window.showReminderModal('${task.id}', '${task.title.replace(/'/g, "\\'")}')" class="text-gray-400 hover:text-primary transition p-1" title="Set Reminder">
                  <i class="fa-solid fa-bell"></i>
                </button>
              ` : ""}
              <button onclick="window.taskManager.delete('${task.id}')" class="text-gray-400 hover:text-red-500 transition p-1">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </li>
      `;
    }).join("");
  }
};

function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}