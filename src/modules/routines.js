import { db } from "../firebase";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { AppState } from "./state";
import { showToast } from "../utils/toast";
import { recordActivity } from "../utils/storage";

const ROUTINES_COLLECTION = collection(db, "routines");

export const RoutineManager = {

  async forceRefresh() {
    console.log("🔄 Force refreshing routines...");
    await this.load();
    if (window.Dashboard && typeof window.Dashboard.updateRoutineWidget === 'function') {
      window.Dashboard.updateRoutineWidget();
    }
  },

  async load() {
    const user = AppState.currentUser;
    if (!user) {
      console.log("No user, skipping routine load");
      return;
    }

    try {
      console.log("Loading routines for user:", user.uid);
      const q = query(ROUTINES_COLLECTION, where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      AppState.routines = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("✅ Routines loaded:", AppState.routines.length);
      
      this.render();
      window.dispatchEvent(new CustomEvent("routines-updated"));
      
      if (window.Dashboard && typeof window.Dashboard.updateRoutineWidget === 'function') {
        window.Dashboard.updateRoutineWidget();
      }
      
      if (window.Dashboard && typeof window.Dashboard.update === 'function') {
        window.Dashboard.update();
      }
      
    } catch (error) {
      console.error("Failed to load routines:", error);
    }
  },

  async add(data) {
    const user = AppState.currentUser;
    if (!user) return showToast("Login dulu!", "error");

    try {
      await addDoc(ROUTINES_COLLECTION, {
        days: data.days || [],
        icon: data.icon || "📌",
        title: data.title,
        startTime: data.startTime || "07:00",
        endTime: data.endTime || "08:00",
        streak: 0,
        lastCompleted: null,
        history: {},
        userId: user.uid,
        createdAt: Date.now()
      });
      showToast("✅ Rutinitas ditambahkan!", "success");
      await this.load();
      
    } catch (error) {
      console.error("Failed to add routine:", error);
      showToast("Gagal menambahkan!", "error");
    }
  },

  async toggle(id) {
    const routine = AppState.routines.find(r => r.id === id);
    if (!routine) return;

    const today = new Date().toISOString().split("T")[0];
    const isCompleted = routine.history?.[today] || false;

    if (isCompleted) {
      routine.history[today] = false;
      routine.streak = this.calculateStreak(routine.history);
      showToast(`⏸️ "${routine.title}" dibatalkan`, "info");
    } else {
      routine.history[today] = true;
      routine.lastCompleted = today;
      routine.streak = this.calculateStreak(routine.history);
      showToast(`✅ "${routine.title}" selesai!`, "success");
      recordActivity(AppState.activityLog);
    }

    try {
      await updateDoc(doc(db, "routines", id), {
        history: routine.history,
        lastCompleted: routine.lastCompleted,
        streak: routine.streak
      });
      await this.load();
      
    } catch (error) {
      console.error("Failed to toggle routine:", error);
      showToast("Gagal update!", "error");
    }
  },

  async update(id, data) {
    const user = AppState.currentUser;
    if (!user) return showToast("Login dulu!", "error");

    try {
      await updateDoc(doc(db, "routines", id), {
        days: data.days || [],
        icon: data.icon || "📌",
        title: data.title,
        startTime: data.startTime || "07:00",
        endTime: data.endTime || "08:00",
        updatedAt: Date.now()
      });
      showToast("✅ Rutinitas berhasil diupdate!", "success");
      await this.load();
    } catch (error) {
      console.error("Failed to update routine:", error);
      showToast("Gagal mengupdate!", "error");
    }
  },

  async delete(id) {
    try {
      await deleteDoc(doc(db, "routines", id));
      await this.load();
      showToast("🗑️ Rutinitas dihapus!", "success");
      
    } catch (error) {
      console.error("Failed to delete routine:", error);
      showToast("Gagal menghapus!", "error");
    }
  },

  calculateStreak(history) {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      if (history[dateStr]) streak++;
      else if (i > 0) break;
    }
    return streak;
  },

  getCompletionRate(history) {
    const last7Days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last7Days.push(date.toISOString().split("T")[0]);
    }
    const completed = last7Days.filter(d => history?.[d]).length;
    return Math.round((completed / 7) * 100);
  },

  getDayName(day) {
    const days = {
      senin: "Sen", selasa: "Sel", rabu: "Rab", kamis: "Kam",
      jumat: "Jum", sabtu: "Sab", minggu: "Min"
    };
    return days[day] || day;
  },

  render() {
    const container = document.getElementById("routinesContainer");
    if (!container) {
      console.log("routinesContainer not found");
      return;
    }

    if (!AppState.routines || AppState.routines.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-gray-500">
          <i class="fa-solid fa-calendar-check text-4xl mb-3 opacity-50"></i>
          <p>Belum ada rutinitas harian</p>
          <button onclick="window.routineManager.openAddModal()" 
            class="mt-3 text-sm text-primary hover:underline">
            + Tambah rutinitas pertama
          </button>
        </div>
      `;
      return;
    }

    const routines = [...AppState.routines];
    const today = new Date().toISOString().split("T")[0];
    const todayName = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"][new Date().getDay()];

    const todayRoutines = routines.filter(r => {
      if (!r.days || r.days.length === 0) return true;
      return r.days.includes(todayName);
    });

    const otherRoutines = routines.filter(r => {
      if (!r.days || r.days.length === 0) return false;
      return !r.days.includes(todayName);
    });

    let html = `
      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <i class="fa-solid fa-sun text-yellow-500"></i> Hari Ini
        </h3>
        <div class="space-y-3">
    `;

    for (const routine of todayRoutines) {
      const isDone = routine.history?.[today] || false;
      const completionRate = this.getCompletionRate(routine.history || {});
      const daysDisplay = routine.days?.length > 0 
        ? routine.days.map(d => this.getDayName(d)).join(", ")
        : "Setiap hari";

      html += `
        <div class="bg-white dark:bg-darkCard rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 flex-1">
              <input type="checkbox" 
                ${isDone ? "checked" : ""} 
                onchange="window.routineManager.toggle('${routine.id}')"
                class="w-5 h-5 rounded accent-primary cursor-pointer shrink-0">
              <div class="flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-2xl">${routine.icon || "📌"}</span>
                  <span class="font-medium ${isDone ? "line-through text-gray-400" : ""}">
                    ${escapeHtml(routine.title)}
                  </span>
                </div>
                <div class="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                  <span class="flex items-center gap-1">
                    <i class="fa-regular fa-clock"></i> ${routine.startTime || "07:00"} - ${routine.endTime || "08:00"}
                  </span>
                  <span class="flex items-center gap-1">
                    <i class="fa-regular fa-calendar"></i> ${daysDisplay}
                  </span>
                  ${routine.streak > 0 ? `
                    <span class="flex items-center gap-1 text-orange-500">
                      <i class="fa-solid fa-fire"></i> ${routine.streak} hari
                    </span>
                  ` : ""}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="window.routineManager.openEditModal('${routine.id}')"
                class="text-gray-400 hover:text-blue-500 p-2 transition shrink-0"
                title="Edit Rutinitas">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button onclick="window.routineManager.delete('${routine.id}')"
                class="text-gray-400 hover:text-red-500 p-2 transition shrink-0">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <div class="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-primary rounded-full transition-all" style="width: ${completionRate}%"></div>
            </div>
            <span class="text-[10px] text-gray-400">${completionRate}%</span>
          </div>
        </div>
      `;
    }

    if (todayRoutines.length === 0) {
      html += `<div class="text-center py-6 text-gray-400 text-sm">Belum ada rutinitas untuk hari ini</div>`;
    }

    html += `</div></div>`;

    if (otherRoutines.length > 0) {
  html += `
    <div class="mt-6">
      <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
        <i class="fa-solid fa-calendar-week text-primary"></i> Rutinitas Lainnya
      </h3>
      <div class="space-y-3">
  `;
  for (const routine of otherRoutines) {
  const daysDisplay = routine.days?.map(d => this.getDayName(d)).join(", ");
  html += `
    <div class="bg-white dark:bg-darkCard rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 opacity-70">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-2xl">${routine.icon || "📌"}</span>
          <div class="flex-1">
            <p class="font-medium">${escapeHtml(routine.title)}</p>
            <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span><i class="fa-regular fa-clock"></i> ${routine.startTime || "07:00"} - ${routine.endTime || "08:00"}</span>
              <span><i class="fa-regular fa-calendar"></i> ${daysDisplay}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="window.routineManager.openEditModal('${routine.id}')"
            class="text-gray-400 hover:text-blue-500 p-2 transition"
            title="Edit Rutinitas">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button onclick="window.routineManager.delete('${routine.id}')"
            class="text-gray-400 hover:text-red-500 p-2 transition"
            title="Hapus Rutinitas">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}
  html += `</div></div>`;
}

    container.innerHTML = html;
  },

 openAddModal() {
  const modal = document.getElementById("routineModal");
  if (!modal) return;

  const form = document.getElementById("routineForm");
  if (form) {
    form.reset();
    delete form.dataset.editId;
  }
  
  document.getElementById("routineTitle").value = "";
  document.getElementById("routineIcon").value = "";
  document.getElementById("routineStartTime").value = "07:00";
  document.getElementById("routineEndTime").value = "08:00";
  
  // Reset checkbox styling
  document.querySelectorAll(".day-checkbox").forEach(cb => {
    cb.checked = false;
    const parent = cb.closest('label');
    if (parent) {
      parent.classList.remove('bg-primary', 'text-white', 'border-primary');
      parent.classList.add('border-gray-200', 'dark:border-gray-700');
      parent.style.backgroundColor = '';
      parent.style.color = '';
      parent.style.borderColor = '';
    }
  });
  
  document.querySelectorAll(".icon-option").forEach(btn => {
    btn.classList.remove("border-primary", "bg-primary/10", "ring-2", "ring-primary");
  });
  
  const modalTitle = modal.querySelector("h3");
  if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-calendar-plus text-primary"></i> Tambah Rutinitas';
  
  const submitBtn = modal.querySelector("button[type='submit']");
  if (submitBtn) submitBtn.innerHTML = 'Tambah';
  
  modal.classList.remove("hidden");
  modal.classList.add("flex");
},

// 🔥 TAMBAHKAN INI - FUNGSI EDIT
openEditModal(id) {
  console.log("🔥 openEditModal dipanggil dengan id:", id);
  
  const routine = AppState.routines.find(r => r.id === id);
  if (!routine) {
    console.log("Routine not found with id:", id);
    return;
  }

  const modal = document.getElementById("routineModal");
  if (!modal) return;

  const form = document.getElementById("routineForm");
  if (form) {
    form.reset();
  }
  
  // Reset checkbox styling
  document.querySelectorAll(".day-checkbox").forEach(cb => {
    cb.checked = false;
    const parent = cb.closest('label');
    if (parent) {
      parent.classList.remove('bg-primary', 'text-white', 'border-primary');
      parent.classList.add('border-gray-200', 'dark:border-gray-700');
      parent.style.backgroundColor = '';
      parent.style.color = '';
      parent.style.borderColor = '';
    }
  });
  
  // Reset icon options
  document.querySelectorAll(".icon-option").forEach(btn => {
    btn.classList.remove("border-primary", "bg-primary/10", "ring-2", "ring-primary");
  });

  // Isi form dengan data routine
  document.getElementById("routineTitle").value = routine.title;
  document.getElementById("routineIcon").value = routine.icon || "📌";
  document.getElementById("routineStartTime").value = routine.startTime || "07:00";
  document.getElementById("routineEndTime").value = routine.endTime || "08:00";
  
  // Set checkbox sesuai hari yang dipilih
  if (routine.days && routine.days.length > 0) {
    routine.days.forEach(day => {
      const checkbox = document.querySelector(`.day-checkbox[value="${day}"]`);
      if (checkbox) {
        checkbox.checked = true;
        const parent = checkbox.closest('label');
        if (parent) {
          parent.classList.remove('border-gray-200', 'dark:border-gray-700');
          parent.classList.add('bg-primary', 'text-white', 'border-primary');
          parent.style.backgroundColor = '#6366f1';
          parent.style.color = 'white';
          parent.style.borderColor = '#6366f1';
        }
      }
    });
  }
  
  // Set icon yang dipilih
  const iconValue = routine.icon || "📌";
  document.getElementById("routineIcon").value = iconValue;
  document.querySelectorAll(".icon-option").forEach(btn => {
    if (btn.getAttribute("data-icon") === iconValue) {
      btn.classList.add("border-primary", "bg-primary/10", "ring-2", "ring-primary");
    }
  });
  
  if (form) form.dataset.editId = id;
  
  const modalTitle = modal.querySelector("h3");
  if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-pen text-primary"></i> Edit Rutinitas';
  
  const submitBtn = modal.querySelector("button[type='submit']");
  if (submitBtn) submitBtn.innerHTML = 'Update';
  
  modal.classList.remove("hidden");
  modal.classList.add("flex");
},

  closeModal() {
    const modal = document.getElementById("routineModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      
      const form = document.getElementById("routineForm");
      if (form) {
        form.reset();
        delete form.dataset.editId;
      }
      
      document.querySelectorAll(".day-checkbox").forEach(cb => {
        cb.checked = false;
        const parent = cb.closest('label');
        if (parent) {
          parent.classList.remove('bg-primary', 'text-white', 'border-primary');
          parent.classList.add('border-gray-200', 'dark:border-gray-700');
          parent.style.backgroundColor = '';
        }
      });
      
      document.querySelectorAll(".icon-option").forEach(btn => {
        btn.classList.remove("border-primary", "bg-primary/10", "ring-2", "ring-primary");
      });
      
      const modalTitle = modal.querySelector("h3");
      if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-calendar-plus text-primary"></i> Tambah Rutinitas';
      
      const submitBtn = modal.querySelector("button[type='submit']");
      if (submitBtn) submitBtn.innerHTML = 'Tambah';
    }
  },

  getSelectedDays() {
    const days = [];
    document.querySelectorAll(".day-checkbox:checked").forEach(cb => {
      days.push(cb.value);
    });
    return days;
  },

  initModalListener() {
  const form = document.getElementById("routineForm");
  if (form) {
    if (form._submitHandler) {
      form.removeEventListener('submit', form._submitHandler);
    }
    
    form._submitHandler = async (e) => {
      e.preventDefault();
      const title = document.getElementById("routineTitle").value.trim();
      if (!title) {
        showToast("Nama rutinitas tidak boleh kosong!", "error");
        return;
      }

      const days = this.getSelectedDays();
      const icon = document.getElementById("routineIcon").value.trim() || "📌";
      const startTime = document.getElementById("routineStartTime").value;
      const endTime = document.getElementById("routineEndTime").value;
      
      const editId = form.dataset.editId;
      
      if (editId) {
        await this.update(editId, { days, icon, title, startTime, endTime });
        delete form.dataset.editId;
      } else {
        await this.add({ days, icon, title, startTime, endTime });
      }
      
      this.closeModal();
    };
    
    form.addEventListener('submit', form._submitHandler);
  }
  
  // 🔥 TAMBAHKAN INI - CHECKBOX STYLING
  document.querySelectorAll(".day-checkbox").forEach(cb => {
    // Hapus listener lama
    cb.removeEventListener('change', this._checkboxChangeHandler);
    
    // Buat handler baru
    this._checkboxChangeHandler = function() {
      const parent = this.closest('label');
      if (this.checked) {
        parent.classList.add('bg-primary', 'text-white', 'border-primary');
        parent.classList.remove('border-gray-200', 'dark:border-gray-700');
        parent.style.backgroundColor = '#6366f1';
        parent.style.color = 'white';
        parent.style.borderColor = '#6366f1';
      } else {
        parent.classList.remove('bg-primary', 'text-white', 'border-primary');
        parent.classList.add('border-gray-200', 'dark:border-gray-700');
        parent.style.backgroundColor = '';
        parent.style.color = '';
        parent.style.borderColor = '';
      }
    };
    
    cb.addEventListener('change', this._checkboxChangeHandler);
  });
  
  // ICON OPTION STYLING
  document.querySelectorAll(".icon-option").forEach(btn => {
    btn.removeEventListener('click', this._iconClickHandler);
    
    this._iconClickHandler = () => {
      const icon = btn.getAttribute("data-icon");
      document.getElementById("routineIcon").value = icon;
      document.querySelectorAll(".icon-option").forEach(b => {
        b.classList.remove("border-primary", "bg-primary/10", "ring-2", "ring-primary");
      });
      btn.classList.add("border-primary", "bg-primary/10", "ring-2", "ring-primary");
    };
    
    btn.addEventListener('click', this._iconClickHandler);
  });
},
};

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, function(m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}