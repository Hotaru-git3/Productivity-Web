let toastContainer = null;
let toastQueue = [];

export function initToast() {
  toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "fixed bottom-5 right-5 z-50 flex flex-col gap-2";
    document.body.appendChild(toastContainer);
  }
}

export function showToast(message, type = "success", duration = 3000) {
  if (!toastContainer) initToast();

  // Buat elemen toast
  const toast = document.createElement("div");
  
  // Konfigurasi berdasarkan tipe
  const config = {
    success: {
      icon: "fa-check-circle",
      bgColor: "bg-emerald-500",
      borderColor: "border-emerald-600",
      title: "Berhasil!",
    },
    error: {
      icon: "fa-circle-exclamation",
      bgColor: "bg-red-500",
      borderColor: "border-red-600",
      title: "Gagal!",
    },
    warning: {
      icon: "fa-triangle-exclamation",
      bgColor: "bg-amber-500",
      borderColor: "border-amber-600",
      title: "Peringatan!",
    },
    info: {
      icon: "fa-circle-info",
      bgColor: "bg-sky-500",
      borderColor: "border-sky-600",
      title: "Info",
    },
    celebration: {
      icon: "fa-party-horn",
      bgColor: "bg-gradient-to-r from-emerald-500 to-teal-500",
      borderColor: "border-emerald-600",
      title: "🎉 Selamat!",
    },
  };

  const selected = config[type] || config.success;
  
  toast.className = `${selected.bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-start gap-3 animate-slide-in-right border-l-4 ${selected.borderColor} max-w-sm`;
  toast.style.transform = "translateX(400px)";
  toast.style.transition = "transform 0.3s ease";
  
  toast.innerHTML = `
    <div class="flex-shrink-0 mt-0.5">
      <i class="fa-solid ${selected.icon} text-lg"></i>
    </div>
    <div class="flex-1">
      <p class="font-semibold text-sm">${selected.title}</p>
      <p class="text-xs opacity-90 mt-0.5">${message}</p>
    </div>
    <button class="toast-close flex-shrink-0 text-white/70 hover:text-white transition">
      <i class="fa-solid fa-times text-sm"></i>
    </button>
  `;
  
  toastContainer.appendChild(toast);
  
  // Animate masuk
  setTimeout(() => {
    toast.style.transform = "translateX(0)";
  }, 10);
  
  // Auto close
  const timeoutId = setTimeout(() => {
    closeToast(toast);
  }, duration);
  
  // Close button handler
  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => {
    clearTimeout(timeoutId);
    closeToast(toast);
  });
  
  return toast;
}

function closeToast(toast) {
  toast.style.transform = "translateX(400px)";
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 300);
}

// Toast khusus untuk tugas selesai (dengan animasi celebration)
export function showTaskCompleteToast(taskTitle) {
  if (!toastContainer) initToast();
  
  const toast = document.createElement("div");
  toast.className = "bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-bounce-in max-w-sm";
  
  toast.innerHTML = `
    <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
      <i class="fa-solid fa-check-double text-xl"></i>
    </div>
    <div class="flex-1">
      <p class="font-bold text-sm">🎉 Tugas Selesai!</p>
      <p class="text-xs opacity-90 mt-0.5">"${taskTitle.substring(0, 40)}"</p>
      <p class="text-[10px] opacity-80 mt-1">Keep it up! 💪</p>
    </div>
    <div class="flex-shrink-0">
      <i class="fa-solid fa-fire text-xl animate-pulse"></i>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Auto close setelah 4 detik
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
  
  return toast;
}

// Toast untuk deadline
export function showDeadlineToast(taskTitle, daysLeft) {
  if (!toastContainer) initToast();
  
  let bgColor = "bg-amber-500";
  let icon = "fa-clock";
  let title = "⏰ Deadline Mendekat!";
  
  if (daysLeft === 0) {
    bgColor = "bg-red-500";
    icon = "fa-circle-exclamation";
    title = "⚠️ Deadline Hari Ini!";
  } else if (daysLeft < 0) {
    bgColor = "bg-red-600";
    icon = "fa-skull";
    title = "❗ Tugas Terlewat!";
  }
  
  const toast = document.createElement("div");
  toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-in-right max-w-sm`;
  
  toast.innerHTML = `
    <div class="flex-shrink-0">
      <i class="fa-solid ${icon} text-lg"></i>
    </div>
    <div class="flex-1">
      <p class="font-semibold text-sm">${title}</p>
      <p class="text-xs opacity-90 mt-0.5">"${taskTitle.substring(0, 40)}"</p>
      ${daysLeft === 1 ? `<p class="text-[10px] opacity-80 mt-1">Besok deadline! Jangan lupa dikerjain.</p>` : ""}
      ${daysLeft === 0 ? `<p class="text-[10px] opacity-80 mt-1">Selesaikan hari ini!</p>` : ""}
      ${daysLeft < 0 ? `<p class="text-[10px] opacity-80 mt-1">Sudah melewati deadline!</p>` : ""}
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 5000);
  
  return toast;
}