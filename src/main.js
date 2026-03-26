// ============================================================================
// IMPORT & SETUP
// ============================================================================
import './style.css';
import Chart from 'chart.js/auto';
import { db, auth, googleProvider } from './firebase.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

// ============================================================================
// 1. GLOBAL STATE (Data Center)
// ============================================================================
const State = {
    tasks: [],
    notes: [],
    activityLog: JSON.parse(localStorage.getItem('activityLog')) || {},
    taskFilter: 'all',
    pomodoro: { time: 25 * 60, interval: null },
    pendingDelete: { id: null, type: null }
};

// ============================================================================
// 2. UTILITY (Fungsi Bantuan)
// ============================================================================
const Utils = {
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        const color = type === 'success' ? 'bg-green-500' : 'bg-red-500';
        const icon = type === 'success' ? 'check' : 'circle-exclamation';

        toast.className = `${color} text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in`;
        toast.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${message}`;

        document.getElementById('toastContainer')?.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    saveLocal(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
        Dashboard.update();
    },

    recordActivity() {
        const today = new Date().toISOString().split('T')[0];
        State.activityLog[today] = (State.activityLog[today] || 0) + 1;
        this.saveLocal('activityLog', State.activityLog);
    }
};

// ============================================================================
// 3. UI MANAGER (Ngurus Tampilan Aja)
// ============================================================================
const UI = {
    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(tabId)?.classList.remove('hidden');

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active-tab');
            if (btn.dataset.target === tabId) btn.classList.add('active-tab');
        });

        if (window.innerWidth < 1024) this.toggleSidebar();
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');

        if (window.innerWidth >= 1024) return;

        const isOpen = !sidebar.classList.contains('-translate-x-full');

        if (isOpen) {
            // Tutup Sidebar
            sidebar.classList.add('-translate-x-full');
            overlay.style.opacity = '0';
            overlay.style.visibility = 'hidden';
        } else {
            // Buka Sidebar
            sidebar.classList.remove('-translate-x-full');
            overlay.style.visibility = 'visible';
            overlay.style.opacity = '1';
        }
    },

    toggleTheme() {
        const root = document.documentElement;
        root.classList.toggle('dark');
        localStorage.theme = root.classList.contains('dark') ? 'dark' : 'light';
        Dashboard.update();
    },

    initTheme() {
        const isDark = localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    },

    renderAuthState(user) {
        const loginScreen = document.getElementById('loginScreen');
        const mainDashboard = document.getElementById('mainDashboard');

        if (user) {
            // HAPUS ATAU KOMENTARI INI
            // const jpGreeting = document.getElementById('jpGreeting');
            // if (jpGreeting) jpGreeting.innerText = `Semangat nugasnya, ${firstName}-kun! 🎌`;

            const words = [
                { kanji: '勉強', romaji: '(Benkyou) - Belajar' },
                { kanji: '頑張って', romaji: '(Ganbatte) - Semangat/Berjuang' },
                { kanji: '効率', romaji: '(Kouritsu) - Efisiensi' },
                { kanji: '目標', romaji: '(Mokuhyou) - Target/Tujuan' },
                { kanji: '情報セキュリティ', romaji: '(Jouhou Sekyuriti) - Cybersecurity' }
            ];
            const randomWord = words[Math.floor(Math.random() * words.length)];

            // Update Word of the Day
            const jpKanji = document.getElementById('jpKanji');
            const jpRomaji = document.getElementById('jpRomaji');
            if (jpKanji) jpKanji.innerText = randomWord.kanji;
            if (jpRomaji) jpRomaji.innerText = randomWord.romaji;

            const welcomeText = document.getElementById('welcomeText');
            if (welcomeText) welcomeText.innerText = `Welcome Back, ${user.displayName}!`;

            const userProfileImg = document.getElementById('userProfileImg');
            if (userProfileImg) {
                userProfileImg.onerror = () => userProfileImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=6366F1&color=fff`;
                userProfileImg.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=6366F1&color=fff`;
            }

            if (loginScreen) loginScreen.classList.add('hidden');
            if (mainDashboard) {
                mainDashboard.classList.remove('hidden');
                mainDashboard.classList.add('flex');
            }

            setTimeout(() => {
                TaskManager.load();
                NoteManager.load();
                ChatBot.load();
                Dashboard.update();
            }, 100);

            if (typeof ReminderScheduler !== 'undefined' && ReminderScheduler.start) {
                ReminderScheduler.start();
            }

            if (typeof NotificationManager !== 'undefined' && NotificationManager.init) {
                NotificationManager.init();
            }

            setTimeout(async () => {
                if (typeof NotificationManager !== 'undefined') {
                    await NotificationManager.checkDeadlines();
                    await NotificationManager.checkCustomReminders();
                }
            }, 3000);

        } else {
            if (loginScreen) loginScreen.classList.remove('hidden');
            if (mainDashboard) {
                mainDashboard.classList.add('hidden');
                mainDashboard.classList.remove('flex');
            }
            State.tasks = [];
            State.notes = [];
            if (document.getElementById('taskList')) document.getElementById('taskList').innerHTML = '';
            const chatBox = document.getElementById('chatBox');
            if (chatBox) chatBox.innerHTML = '';

            if (typeof ReminderScheduler !== 'undefined' && ReminderScheduler.stop) {
                ReminderScheduler.stop();
            }
        }
    }
};

// ============================================================================
// 4. AUTH MANAGER
// ============================================================================
// ============================================================================
// 4. AUTH MANAGER (FIXED)
// ============================================================================
const AuthManager = {
    async login() {
        try {
            console.log("Starting login...");

            // Gunakan signInWithPopup dengan konfigurasi yang lebih baik
            const result = await signInWithPopup(auth, googleProvider);
            console.log("Login success:", result.user.displayName);

            Utils.showToast(`Halo ${result.user.displayName}! Selamat datang.`, 'success');

            // Force reload state
            setTimeout(() => {
                UI.renderAuthState(auth.currentUser);
            }, 500);

        } catch (error) {
            console.error("Login error:", error.code, error.message);

            // Handle specific errors
            if (error.code === 'auth/popup-blocked') {
                Utils.showToast('Popup diblokir browser! Izinkan popup untuk login.', 'error');
                // Fallback ke redirect
                try {
                    await signInWithRedirect(auth, googleProvider);
                } catch (e) {
                    console.error("Redirect fallback failed:", e);
                }
            } else if (error.code === 'auth/popup-closed-by-user') {
                Utils.showToast('Login dibatalkan.', 'warning');
            } else if (error.code === 'auth/unauthorized-domain') {
                Utils.showToast('Domain tidak diizinkan. Tambahkan localhost ke Firebase Auth settings!', 'error');
            } else if (error.code === 'auth/network-request-failed') {
                Utils.showToast('Koneksi bermasalah. Cek internet dan coba lagi.', 'error');
            } else {
                Utils.showToast(error.message || 'Gagal login, coba lagi.', 'error');
            }
        }
    },

    async logout() {
        try {
            await signOut(auth);
            Utils.showToast('Berhasil logout. Sampai jumpa!', 'success');

            // Reset state
            State.tasks = [];
            State.notes = [];
            if (document.getElementById('taskList')) document.getElementById('taskList').innerHTML = '';
            const chatBox = document.getElementById('chatBox');
            if (chatBox) chatBox.innerHTML = '';

        } catch (error) {
            console.error("Logout error:", error);
            Utils.showToast('Gagal logout!', 'error');
        }
    },

    monitorState() {
        console.log("Setting up onAuthStateChanged listener...");

        onAuthStateChanged(auth, (user) => {
            console.log("onAuthStateChanged FIRED!", user?.displayName || "No user");
            console.log("User UID:", user?.uid);
            console.log("User email:", user?.email);

            UI.renderAuthState(user);
        });
    }
};

// // ============================================================================
// 5. DASHBOARD MANAGER
// ============================================================================
let taskChartInstance = null;
const Dashboard = {
    update: function () {
        const pendingTasks = State.tasks.filter(t => !t.done);
        const doneTasks = State.tasks.filter(t => t.done);

        const elPending = document.getElementById('stat-pending-tasks');
        const elNotes = document.getElementById('stat-total-notes');
        const elDone = document.getElementById('stat-done-tasks');

        if (elPending) elPending.innerText = pendingTasks.length;
        if (elNotes) elNotes.innerText = State.notes.length;
        if (elDone) elDone.innerText = doneTasks.length;

        // Panggil dengan .call(this) untuk memastikan this mengacu ke Dashboard
        this.renderUpNext.call(this, pendingTasks);
        this.renderChart.call(this, pendingTasks.length, doneTasks.length);
        this.renderHeatmap.call(this);
    },

    renderUpNext: function (pendingTasks) {
        const list = document.getElementById('upNextList');
        if (!list) return;

        const withDeadline = pendingTasks.filter(t => t.deadline).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        const top3 = withDeadline.slice(0, 3);

        if (top3.length === 0) {
            list.innerHTML = `<li class="text-sm text-gray-500 py-4 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">✅ Aman, nggak ada deadline mepet! Bawa kalem dulu aja.</li>`;
            return;
        }

        list.innerHTML = top3.map(t => {
            const daysLeft = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24));
            let alertClass = 'text-green-600 bg-green-100 dark:bg-green-900/40';
            let text = `${daysLeft} hari lagi`;

            if (daysLeft <= 2 && daysLeft > 0) alertClass = 'text-orange-500 bg-orange-100 dark:bg-orange-900/40';
            else if (daysLeft === 0) { alertClass = 'text-red-500 bg-red-100 dark:bg-red-900/40'; text = 'Hari Ini!'; }
            else if (daysLeft < 0) { alertClass = 'text-gray-500 bg-gray-200 dark:bg-gray-700'; text = 'Terlewat'; }

            return `
                <li class="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                    <span class="font-medium text-sm truncate pr-4">${t.title}</span>
                    <span class="text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap ${alertClass}">${text}</span>
                </li>
            `;
        }).join('');
    },

    renderChart: function (pending, done) {
        const ctx = document.getElementById('taskChart');
        if (!ctx) return;
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#9CA3AF' : '#4B5563';

        if (taskChartInstance) {
            taskChartInstance.destroy();
            taskChartInstance = null;
        }

        taskChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Selesai', 'Nunggak'], datasets: [{ data: [done, pending], backgroundColor: ['#10B981', '#EF4444'], borderWidth: 0, hoverOffset: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor, padding: 20 } } }, cutout: '70%' }
        });
    },

    renderHeatmap: function () {
        const grid = document.getElementById('heatmapGrid');
        if (!grid) return;
        grid.innerHTML = '';

        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const count = State.activityLog[dateStr] || 0;

            let colorClass = 'bg-gray-200 dark:bg-gray-700';
            if (count >= 1 && count <= 2) colorClass = 'bg-indigo-300 dark:bg-indigo-900/60';
            else if (count >= 3 && count <= 4) colorClass = 'bg-indigo-400 dark:bg-indigo-700';
            else if (count >= 5) colorClass = 'bg-indigo-600 dark:bg-indigo-500';

            const box = document.createElement('div');
            box.className = `w-4 h-4 md:w-5 md:h-5 rounded-sm ${colorClass} transition-all duration-300 hover:ring-2 hover:ring-primary cursor-pointer`;
            box.title = `${dateStr}: ${count} aktivitas`;
            grid.appendChild(box);
        }
    }
};

// ============================================================================
// 5.1 MINI STATS & OVERRIDE (TAMBAHKAN INI)
// ============================================================================

function updateMiniStats() {
    const streakCount = document.getElementById('streakCount');
    const todayTasksDone = document.getElementById('todayTasksDone');

    if (streakCount) {
        const streak = typeof NotificationManager !== 'undefined' && NotificationManager.getStreak
            ? NotificationManager.getStreak()
            : 0;
        streakCount.innerText = streak;
    }

    if (todayTasksDone) {
        const today = new Date().toISOString().split('T')[0];
        const completedToday = State.tasks.filter(t => {
            if (!t.done || !t.completedAt) return false;
            return t.completedAt.split('T')[0] === today;
        });
        todayTasksDone.innerText = completedToday.length;
    }
}

// Override Dashboard.update dengan cara yang benar
const originalDashboardUpdate = Dashboard.update.bind(Dashboard);
Dashboard.update = function () {
    originalDashboardUpdate();
    updateMiniStats();
}.bind(Dashboard);

// Panggil pertama kali
setTimeout(() => {
    updateMiniStats();
}, 500);

// ============================================================================
// 6. TASK MANAGER (Firebase Cloud)
// ============================================================================
// ============================================================================
// 6. TASK MANAGER (Firebase Cloud) + Auto Cleanup
// ============================================================================
const TaskManager = {
    tasksCol: collection(db, "tasks"),

    async load() {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const q = query(this.tasksCol, where("userId", "==", user.uid));
            const querySnapshot = await getDocs(q);
            State.tasks = [];
            querySnapshot.forEach(doc => State.tasks.push({ id: doc.id, ...doc.data() }));

            // 🔥 Auto cleanup setelah load
            await this.cleanupOldTasks();

            this.render();
            Dashboard.update();
        } catch (error) {
            console.error("Gagal nyaring data:", error);
        }
    },

    // 🔥 FUNGSI CLEANUP: Hapus task selesai > 7 hari + batasi maksimal 30
    async cleanupOldTasks() {
        const user = auth.currentUser;
        if (!user) return;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString();

        let deletedCount = 0;

        try {
            // STEP 1: Hapus task yang sudah selesai > 7 hari
            const oldTasksQuery = query(
                this.tasksCol,
                where("userId", "==", user.uid),
                where("done", "==", true),
                where("completedAt", "<=", sevenDaysAgoStr)
            );
            const oldTasksSnapshot = await getDocs(oldTasksQuery);

            for (const docSnap of oldTasksSnapshot.docs) {
                await deleteDoc(docSnap.ref);
                deletedCount++;
            }

            // STEP 2: Batasi jumlah task selesai maksimal 30
            const completedTasksQuery = query(
                this.tasksCol,
                where("userId", "==", user.uid),
                where("done", "==", true)
            );
            const completedSnapshot = await getDocs(completedTasksQuery);
            const completedTasks = completedSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                completedAt: doc.data().completedAt || new Date(0).toISOString()
            }));

            // Urutkan dari yang paling lama selesainya
            completedTasks.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));

            // Jika lebih dari 30, hapus yang paling lama
            if (completedTasks.length > 30) {
                const toDelete = completedTasks.slice(0, completedTasks.length - 30);
                for (const task of toDelete) {
                    await deleteDoc(doc(db, "tasks", task.id));
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                console.log(`🧹 Cleanup: ${deletedCount} task selesai dihapus (max 30 task, >7 hari)`);

                // Refresh state setelah cleanup
                const refreshQuery = query(this.tasksCol, where("userId", "==", user.uid));
                const refreshSnapshot = await getDocs(refreshQuery);
                State.tasks = [];
                refreshSnapshot.forEach(doc => State.tasks.push({ id: doc.id, ...doc.data() }));
            }

        } catch (error) {
            console.error("Gagal cleanup tasks:", error);
        }
    },

    async add(e) {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return Utils.showToast("Login dulu!", "error");

        const input = document.getElementById('taskInput');
        const deadline = document.getElementById('taskDeadline');
        if (!deadline.value) return Utils.showToast('Isi tanggalnya dulu bro!', 'error');

        try {
            await addDoc(this.tasksCol, {
                title: input.value,
                deadline: deadline.value,
                done: false,
                overdueNotified: false, // Tambahin buat reminder
                userId: user.uid,
                timestamp: Date.now()
            });
            input.value = '';
            deadline.value = '';
            Utils.showToast('Tugas udah disimpen!');
            this.load();
        } catch (error) {
            Utils.showToast('Gagal nyimpen!', 'error');
        }
    },

    async toggle(id) {
        const task = State.tasks.find(t => t.id === id);
        if (!task) return;
        const newDone = !task.done;
        const wasDone = task.done;

        task.done = newDone;

        // Tambahkan tracking completedAt
        if (newDone && !wasDone) {
            task.completedAt = new Date().toISOString();

            // Kirim notifikasi selamat!
            if (typeof NotificationManager !== 'undefined') {
                NotificationManager.send(
                    "🎉 Selamat!",
                    `Tugas "${task.title}" berhasil diselesaikan! Keep it up! 💪`,
                    { tabId: 'tasks', tag: `complete_${task.id}`, silent: false }
                );
            }
        }

        this.render();
        Dashboard.update();

        try {
            await updateDoc(doc(db, "tasks", id), {
                done: newDone,
                completedAt: task.completedAt || null
            });
            if (newDone && !wasDone) Utils.recordActivity();

            // 🔥 Setelah update, jalankan cleanup (biar task lama langsung terhapus)
            if (newDone && !wasDone) {
                await this.cleanupOldTasks();
            }

        } catch (error) {
            task.done = !newDone;
            if (task.completedAt && !wasDone) delete task.completedAt;
            this.render();
            Dashboard.update();
            Utils.showToast('Gagal centang tugas!', 'error');
        }
    },

    delete(id) {
        window.openConfirmModal(id, 'task');
    },

    async executeDelete(id) {
        const idx = State.tasks.findIndex(t => t.id === id);
        if (idx === -1) return;
        const [removed] = State.tasks.splice(idx, 1);
        this.render();
        Dashboard.update();
        try {
            await deleteDoc(doc(db, "tasks", id));
            Utils.showToast('Tugas dihapus dari muka bumi!', 'error');
        } catch (error) {
            State.tasks.splice(idx, 0, removed);
            this.render();
            Dashboard.update();
            Utils.showToast('Gagal hapus tugas!', 'error');
        }
    },

    setFilter(filter) {
        State.taskFilter = filter;
        this.render();
    },

    render() {
        const list = document.getElementById('taskList');
        if (!list) return;
        list.innerHTML = '';
        const filteredTasks = State.tasks.filter(t => {
            if (State.taskFilter === 'pending') return !t.done;
            if (State.taskFilter === 'done') return t.done;
            return true;
        });

        if (filteredTasks.length === 0) {
            list.innerHTML = `<p class="text-gray-500 text-sm text-center py-4">Kosong nih. Santuy dulu aja!</p>`;
            return;
        }

        filteredTasks.forEach(task => {
            let isMepet = false;
            let daysLeft = null;
            if (task.deadline && !task.done) {
                daysLeft = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24));
                if (daysLeft < 2) isMepet = true;
            }

            const li = document.createElement('li');
            li.className = `flex justify-between items-center p-3 rounded-xl border ${task.done ? 'bg-gray-50 dark:bg-gray-800/50 border-transparent opacity-60' : 'bg-white dark:bg-darkCard border-gray-100 dark:border-gray-700'}`;
            li.innerHTML = `
                <div class="flex items-center gap-3 w-full">
                    <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleTask('${task.id}')" class="w-5 h-5 text-primary rounded cursor-pointer accent-primary shrink-0">
                    <div class="flex-1 min-w-0">
                        <p class="truncate ${task.done ? 'line-through text-gray-500' : 'font-medium'}">${task.title}</p>
                        ${task.deadline ? `<p class="text-xs ${isMepet ? 'text-red-500 font-bold' : 'text-gray-500'}"><i class="fa-regular fa-clock"></i> ${task.deadline} ${daysLeft !== null && daysLeft >= 0 && !task.done ? `(Sisa ${daysLeft} hari)` : ''}</p>` : ''}
                    </div>
                    <div class="flex gap-1 shrink-0">
                        ${!task.done ? `<button onclick="showReminderModal('${task.id}', '${task.title.replace(/'/g, "\\'")}')" class="text-gray-400 hover:text-primary transition p-1" title="Set Reminder"><i class="fa-solid fa-bell"></i></button>` : ''}
                        <button onclick="deleteTask('${task.id}')" class="text-gray-400 hover:text-red-500 transition p-1"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
            list.appendChild(li);
        });
    }
};

// ============================================================================
// 7. NOTE MANAGER (Firebase Cloud)
// ============================================================================
const NoteManager = {
    notesCol: collection(db, "notes"),
    toggleModal() {
        const modal = document.getElementById('noteModal');
        if (!modal) return;
        modal.classList.toggle('hidden');
        modal.classList.toggle('flex');
        if (modal.classList.contains('hidden')) document.getElementById('noteForm').reset();
    },
    async load() {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const q = query(this.notesCol, where("userId", "==", user.uid));
            const querySnapshot = await getDocs(q);
            State.notes = [];
            querySnapshot.forEach(doc => State.notes.push({ id: doc.id, ...doc.data() }));
            this.render(); Dashboard.update();
        } catch (error) { console.error("Gagal load notes:", error); }
    },
    async save(e) {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return Utils.showToast("Login dulu bro!", "error");

        const id = document.getElementById('noteId').value;
        const noteData = {
            title: document.getElementById('noteTitle').value,
            tag: document.getElementById('noteTag').value || 'General',
            content: document.getElementById('noteContent').value,
            userId: user.uid,
            date: new Date().toLocaleDateString('id-ID'),
            timestamp: Date.now()
        };

        try {
            if (id) {
                await updateDoc(doc(db, "notes", id), noteData);
                Utils.showToast('Catatan di-update di Cloud!');
            } else {
                await addDoc(this.notesCol, noteData);
                Utils.showToast('Catatan berhasil ditambahkan!');
                Utils.recordActivity();
            }
            this.toggleModal(); this.load();
        } catch (error) { Utils.showToast('Gagal nyimpen note!', 'error'); }
    },
    delete(id) { window.openConfirmModal(id, 'note'); },
    async executeDelete(id) {
        try {
            await deleteDoc(doc(db, "notes", id));
            Utils.showToast('Catatan musnah!', 'error');
            this.load();
        } catch (error) { Utils.showToast('Gagal hapus!', 'error'); }
    },
    edit(id) {
        const note = State.notes.find(n => n.id === id);
        if (note) {
            document.getElementById('noteId').value = note.id;
            document.getElementById('noteTitle').value = note.title;
            document.getElementById('noteTag').value = note.tag;
            document.getElementById('noteContent').value = note.content;
            this.toggleModal();
        }
    },
    export(id) {
        const note = State.notes.find(n => n.id === id);
        if (!note) return;
        const blob = new Blob([`${note.title}\nKategori: ${note.tag}\nTanggal: ${note.date}\n\n${note.content}`], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${note.title.replace(/\s+/g, '_')}.txt`;
        a.click(); URL.revokeObjectURL(url);
        Utils.showToast('Berhasil diexport!');
    },
    render(searchQuery = '') {
        const grid = document.getElementById('notesGrid');
        if (!grid) return;
        grid.innerHTML = '';

        const query = searchQuery.toLowerCase();
        const filteredNotes = State.notes.filter(n =>
            n.title.toLowerCase().includes(query) || n.tag.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)
        );

        if (filteredNotes.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">Belum ada catatan nih.</div>`;
            return;
        }

        filteredNotes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-darkCard p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col h-64 hover:shadow-md transition group';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-semibold bg-indigo-100 text-primary dark:bg-indigo-900/40 px-2 py-1 rounded-md">${note.tag}</span>
                    <div class="opacity-0 group-hover:opacity-100 transition flex gap-2">
                        <button onclick="exportNote('${note.id}')" class="text-gray-400 hover:text-green-500"><i class="fa-solid fa-download"></i></button>
                        <button onclick="editNote('${note.id}')" class="text-gray-400 hover:text-blue-500"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteNote('${note.id}')" class="text-gray-400 hover:text-red-500"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <h3 class="font-bold text-lg mb-1 truncate">${note.title}</h3>
                <p class="text-xs text-gray-400 mb-3">${note.date}</p>
                <p class="text-sm text-gray-600 dark:text-gray-300 flex-1 overflow-hidden overflow-ellipsis line-clamp-4">${note.content}</p>
            `;
            grid.appendChild(card);
        });
    }
};

// ============================================================================
// 8. CHATBOT AI MANAGER (Sekarang Punya Ingatan Cloud! 🧠)
// ============================================================================
let attachedFile = { base64: null, mimeType: null, name: null, isImage: false };

// main.js - Modul ChatBot via GROQ CLOUD
const ChatBot = {
    chatsCol: collection(db, "chats"),

    init() {
        document.getElementById('fileInput')?.addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('removeImageBtn')?.addEventListener('click', () => this.clearAttachment());
        document.getElementById('chatForm')?.addEventListener('submit', (e) => this.handleSubmit(e));
    },

    async executeDelete() {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const q = query(this.chatsCol, where("userId", "==", user.uid));
            const querySnapshot = await getDocs(q);
            const deletePromises = [];
            querySnapshot.forEach((document) => { deletePromises.push(deleteDoc(doc(db, "chats", document.id))); });
            await Promise.all(deletePromises);

            const box = document.getElementById('chatBox');
            if (box) box.innerHTML = '';
            this.appendMessage("Riwayat chat berhasil dibersihkan! Ada yang bisa dibantu lagi?", false, null, false);
            Utils.showToast("History chat udah bersih!", "success");
        } catch (error) { Utils.showToast("Gagal bersihin history!", "error"); }
    },

    async load() {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const q = query(this.chatsCol, where("userId", "==", user.uid));
            const querySnapshot = await getDocs(q);
            const box = document.getElementById('chatBox');
            if (box) box.innerHTML = '';
            let historyChats = [];
            querySnapshot.forEach(doc => historyChats.push({ id: doc.id, ...doc.data() }));
            historyChats.sort((a, b) => a.timestamp - b.timestamp);
            if (historyChats.length === 0) {
                this.appendMessage("Halo! Ada materi yang mau dibahas atau dijelasin ulang? Ketik aja!", false, null, false);
                return;
            }
            historyChats.forEach(chat => this.appendMessage(chat.text, chat.isUser, chat.fileInfo, false));
        } catch (error) { console.error("Gagal load chat:", error); }
    },

    async saveToCloud(text, isUser, fileInfo = null) {
        const user = auth.currentUser;
        if (!user) return;
        let safeFileInfo = fileInfo ? { name: fileInfo.name, isImage: fileInfo.isImage } : null;
        try {
            await addDoc(this.chatsCol, {
                userId: user.uid, text: text || '', isUser: isUser, fileInfo: safeFileInfo, timestamp: Date.now()
            });
        } catch (error) { console.error("Gagal save chat:", error); }
    },

    appendMessage(text, isUser = false, fileData = null, saveDb = true) {
        const box = document.getElementById('chatBox');
        if (!box) return;
        if (saveDb) this.saveToCloud(text, isUser, fileData);

        const user = auth.currentUser;
        const userPhoto = user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=6366F1&color=fff`;
        const msgDiv = document.createElement('div');
        msgDiv.className = `flex gap-3 ${isUser ? 'justify-end' : ''} animate-fade-in mb-4`;

        let fileHtml = '';
        if (fileData) {
            if (fileData.base64) {
                fileHtml = fileData.isImage
                    ? `<img src="data:${fileData.mimeType};base64,${fileData.base64}" class="max-w-xs rounded-lg mb-2 border border-gray-200 dark:border-gray-700 shadow-sm">`
                    : `<div class="flex items-center gap-3 bg-gray-200 dark:bg-gray-700 p-3 rounded-lg mb-2 max-w-xs text-gray-800 dark:text-gray-200 shadow-sm"><i class="fa-solid fa-file-lines text-2xl text-primary"></i><span class="text-xs font-medium truncate">${fileData.name}</span></div>`;
            } else {
                const icon = fileData.isImage ? 'image' : 'file-lines';
                fileHtml = `<div class="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg mb-2 max-w-xs text-gray-500 dark:text-gray-400 text-xs shadow-sm border border-gray-200 dark:border-gray-700 opacity-80"><i class="fa-solid fa-${icon} text-lg"></i><span class="truncate">[History] ${fileData.name}</span></div>`;
            }
        }

        if (isUser) {
            msgDiv.innerHTML = `
                <div class="flex flex-col items-end max-w-[80%]">${fileHtml}${text ? `<div class="bg-primary text-white p-3 rounded-2xl rounded-tr-none text-sm shadow-md">${text}</div>` : ''}</div>
                <img class="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-100 dark:border-gray-700 shadow-sm" src="${userPhoto}">`;
        } else {
            const formattedText = text ? text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>') : '';
            msgDiv.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white flex-shrink-0"><i class="fa-solid fa-robot"></i></div>
                <div class="bg-gray-100 dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none text-sm max-w-[80%] text-gray-800 dark:text-gray-200 shadow-sm leading-relaxed overflow-hidden">${formattedText}</div>`;
        }
        box.appendChild(msgDiv);
        box.scrollTop = box.scrollHeight;
    },

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        const allowedDocs = ['application/pdf', 'text/plain'];
        const isImage = file.type.startsWith('image/');

        if (!isImage && !allowedDocs.includes(file.type)) {
            Utils.showToast('Cuma nerima Gambar, PDF, atau TXT!', 'error');
            this.clearAttachment(); return;
        }
        if (file.size > 5 * 1024 * 1024) {
            Utils.showToast('Maksimal 5MB ya bro!', 'error');
            this.clearAttachment(); return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            attachedFile = { base64: event.target.result.split(',')[1], mimeType: file.type, name: file.name, isImage };
            const previewCont = document.getElementById('imagePreviewContainer');
            const previewImg = document.getElementById('imagePreview');
            const input = document.getElementById('chatInput');

            if (previewCont) previewCont.classList.remove('hidden');
            document.getElementById('removeImageBtn')?.classList.remove('hidden');
            document.getElementById('docPreviewIcon')?.remove();

            if (isImage) {
                if (previewImg) { previewImg.src = event.target.result; previewImg.classList.remove('hidden'); }
            } else {
                if (previewImg) { previewImg.src = ''; previewImg.classList.add('hidden'); }
                if (previewCont) {
                    const docPreview = document.createElement('div');
                    docPreview.id = 'docPreviewIcon';
                    docPreview.className = 'flex items-center gap-2 p-2 px-4 bg-gray-200 dark:bg-gray-700 rounded-md text-gray-800 dark:text-gray-200';
                    docPreview.innerHTML = `<i class="fa-solid fa-file-lines text-primary"></i> <span class="text-xs truncate max-w-[100px]">${file.name}</span>`;
                    previewCont.insertBefore(docPreview, document.getElementById('removeImageBtn'));
                }
            }
            if (input) input.removeAttribute('required');
        };
        reader.readAsDataURL(file);
    },

    clearAttachment() {
        attachedFile = { base64: null, mimeType: null, name: null, isImage: false };
        if (document.getElementById('fileInput')) document.getElementById('fileInput').value = '';
        if (document.getElementById('imagePreview')) {
            document.getElementById('imagePreview').src = ''; document.getElementById('imagePreview').classList.add('hidden');
        }
        document.getElementById('docPreviewIcon')?.remove();
        document.getElementById('imagePreviewContainer')?.classList.add('hidden');
        document.getElementById('removeImageBtn')?.classList.add('hidden');
        document.getElementById('chatInput')?.setAttribute('required', '');
    },

    async handleSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('chatInput');
        const userText = input ? input.value.trim() : '';
        if (!userText && !attachedFile.base64) return;

        const API_KEY = import.meta.env.VITE_GROQ_API_KEY;
        if (!API_KEY) return Utils.showToast('Groq API Key belum dipasang di .env!', 'error');

        const currentPayload = { ...attachedFile };
        this.appendMessage(userText, true, currentPayload, true);
        this.clearAttachment();
        if (input) input.value = '';

        const loadingId = 'loading-' + Date.now();
        this.showLoading(loadingId);

        try {
            let contentParts = [{ type: "text", text: userText || "Tolong jelaskan ini." }];

            // 🔥 OTOMATIS GANTI OTAK AI BERDASARKAN FILE
            let selectedModel = "llama-3.3-70b-versatile"; // Cepat banget buat teks / koding

            if (currentPayload.base64) {
                if (currentPayload.isImage) {
                    selectedModel = "meta-llama/llama-4-scout-17b-16e-instruct"; // Khusus baca gambar
                    contentParts.push({
                        type: "image_url",
                        image_url: { url: `data:${currentPayload.mimeType};base64,${currentPayload.base64}` }
                    });
                } else {
                    // Kalau upload PDF/TXT, Groq gak bisa baca Base64 langsung. Kita akalin kasih tau AI-nya.
                    contentParts[0].text = `[User mengirim file ${currentPayload.name}] ${userText}`;
                    Utils.showToast("Groq saat ini cuma bisa baca Teks/Gambar yaa.", "warning");
                }
            }

            // PERHATIKAN: URL Fetch udah diganti ke jalur Groq
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: [{ role: "user", content: contentParts }],
                    temperature: 0.7
                })
            });

            // Peredam Kejut (Error Handling)
            const rawText = await response.text();
            let data;
            try { data = JSON.parse(rawText); }
            catch (parseError) {
                document.getElementById(loadingId)?.remove();
                return this.appendMessage(`🚨 **Server Groq Error!** Coba lagi nanti yaaa.`, false, null, true);
            }

            document.getElementById(loadingId)?.remove();

            if (!response.ok) {
                const errMsg = data.error?.message || "Gagal nembak Groq";
                return this.appendMessage(`🚨 **Error:** ${errMsg}`, false, null, true);
            }

            const aiResponse = data.choices[0].message.content;
            this.appendMessage(aiResponse, false, null, true);
            if (currentPayload.base64) Utils.recordActivity();

        } catch (error) {
            document.getElementById(loadingId)?.remove();
            this.appendMessage(`Koneksi Groq gagal: ${error.message}`, false, null, true);
        }
    },

    showLoading(id) {
        const box = document.getElementById('chatBox');
        if (box) {
            box.insertAdjacentHTML('beforeend', `<div id="${id}" class="flex gap-3 mb-4"><div class="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white flex-shrink-0"><i class="fa-solid fa-robot"></i></div><div class="bg-gray-100 dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none text-sm flex items-center gap-1"><span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span><span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span><span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span></div></div>`);
            box.scrollTop = box.scrollHeight;
        }
    }
};

// ============================================================================
// 9. POMODORO TIMER
// ============================================================================
const Pomodoro = {
    updateDisplay() {
        const m = Math.floor(State.pomodoro.time / 60).toString().padStart(2, '0');
        const s = (State.pomodoro.time % 60).toString().padStart(2, '0');
        const display = document.getElementById('pomodoroDisplay');
        if (display) display.innerText = `${m}:${s}`;
    },
    toggle(btn) {
        if (State.pomodoro.interval) {
            clearInterval(State.pomodoro.interval);
            State.pomodoro.interval = null;
            btn.innerText = 'Start';
            btn.classList.replace('bg-yellow-500', 'bg-primary');
            stopAlarmSound();
        } else {
            btn.innerText = 'Pause';
            btn.classList.replace('bg-primary', 'bg-yellow-500');
            State.pomodoro.interval = setInterval(() => {
                if (State.pomodoro.time > 0) {
                    State.pomodoro.time--;
                    this.updateDisplay();
                } else {
                    this.reset();
                    Utils.showToast('⏰ Waktu fokus abis! Istirahat dulu sana.', 'success');
                    Utils.recordActivity();
                    playAlarmSound();  // 🔥 MAININ SUARA

                    if (typeof NotificationManager !== 'undefined') {
                        NotificationManager.send(
                            "🍅 Pomodoro Selesai!",
                            "Waktu fokus 25 menit sudah habis. Waktunya istirahat! 🎉",
                            { tabId: 'tools', tag: 'pomodoro_complete', silent: false }
                        );
                    }
                }
            }, 1000);
        }
    },
    reset() {
        clearInterval(State.pomodoro.interval); State.pomodoro.interval = null;
        State.pomodoro.time = 25 * 60; this.updateDisplay();
        const btn = document.getElementById('pomodoroStart');
        if (btn) { btn.innerText = 'Start'; btn.classList.replace('bg-yellow-500', 'bg-primary'); }
    }
};

// ============================================================================
// 9.1 POMODORO SOUND EFFECTS (TAMBAHKAN INI)
// ============================================================================
let alarmAudio = null;
let isAlarmPlaying = false;

function initAlarmSound() {
    alarmAudio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
    alarmAudio.preload = 'auto';
    alarmAudio.onerror = () => {
        console.warn('Sound file not accessible, using fallback beep');
        alarmAudio = null;
    };
}

function playAlarmSound() {
    window.showStopAlarmButton(true);
    if (alarmAudio) {
        alarmAudio.currentTime = 0;
        alarmAudio.play().catch(e => console.log('Audio play failed:', e));
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
    isAlarmPlaying = true;
}

function stopAlarmSound() {
    window.showStopAlarmButton(false);
    if (alarmAudio) {
        alarmAudio.pause();
        alarmAudio.currentTime = 0;
    }
    isAlarmPlaying = false;
}

// Tambahkan di bagian Music Player
function closeMusicPlayer() {
    stopMusic();
}

window.showStopAlarmButton = function (show) {
    const stopBtn = document.getElementById('stopAlarmBtn');
    if (stopBtn) {
        if (show) {
            stopBtn.classList.remove('hidden');
            stopBtn.classList.add('flex');
        } else {
            stopBtn.classList.add('hidden');
            stopBtn.classList.remove('flex');
        }
    }
};

// ============================================================================
// 10. MUSIC PLAYER FOR POMODORO 🎵 (LOCAL AUDIO)
// ============================================================================
let currentAudio = null;
let currentMusicType = null;
let isMusicPlaying = false;

// Daftar playlist study music (file lokal)
const musicPlaylists = {
    lofi: {
        name: "Lo-Fi Study Beats",
        file: "/music/lofi.mp3",
        icon: "fa-headphones"
    },
    classical: {
        name: "Classical for Studying",
        file: "/music/classical.mp3",
        icon: "fa-music"
    },
    ambient: {
        name: "Ambient Study",
        file: "/music/ambient.mp3",
        icon: "fa-cloud-moon"
    },
    nature: {
        name: "Nature Sounds",
        file: "/music/nature.mp3",
        icon: "fa-tree"
    }
};

// Fungsi untuk memutar musik
function playStudyMusic(type) {
    const music = musicPlaylists[type];
    if (!music) return;

    // Hentikan musik yang sedang diputar
    stopMusic();

    try {
        // Buat audio element baru
        currentAudio = new Audio(music.file);
        currentAudio.loop = true;
        currentAudio.volume = 0.5; // Volume default 50%

        // Play musik
        currentAudio.play().catch(e => {
            console.error("Audio play failed:", e);
            Utils.showToast('Gagal memutar musik, coba lagi', 'error');
        });

        currentMusicType = type;
        isMusicPlaying = true;

        // Update UI
        const currentMusicSpan = document.getElementById('currentMusic');
        const musicIcon = document.getElementById('musicIcon');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const stopMusicBtn = document.getElementById('stopMusicBtn');
        const musicVolume = document.getElementById('musicVolume');
        const volumeSlider = document.getElementById('volumeSlider');

        if (currentMusicSpan) currentMusicSpan.innerText = music.name;
        if (musicIcon) musicIcon.className = `fa-solid ${music.icon} text-primary text-sm`;
        if (playPauseBtn) playPauseBtn.classList.remove('hidden');
        if (stopMusicBtn) stopMusicBtn.classList.remove('hidden');
        if (musicVolume) musicVolume.classList.remove('hidden');

        // Set volume slider ke nilai saat ini
        if (volumeSlider) {
            volumeSlider.value = currentAudio.volume * 100;
        }

        Utils.showToast(`🎵 Memutar: ${music.name}`, 'success');

    } catch (error) {
        console.error("Error playing music:", error);
        Utils.showToast('Gagal memutar musik', 'error');
    }
}

// Fungsi untuk stop musik
function stopMusic() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    currentMusicType = null;
    isMusicPlaying = false;

    // Reset UI
    const currentMusicSpan = document.getElementById('currentMusic');
    const musicIcon = document.getElementById('musicIcon');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const stopMusicBtn = document.getElementById('stopMusicBtn');
    const musicVolume = document.getElementById('musicVolume');

    if (currentMusicSpan) currentMusicSpan.innerText = 'Belum ada musik diputar';
    if (musicIcon) musicIcon.className = 'fa-solid fa-headphones text-primary text-sm';
    if (playPauseBtn) playPauseBtn.classList.add('hidden');
    if (stopMusicBtn) stopMusicBtn.classList.add('hidden');
    if (musicVolume) musicVolume.classList.add('hidden');
}

// Fungsi toggle play/pause
function toggleMusicPlayPause() {
    if (!currentAudio) return;

    if (isMusicPlaying) {
        currentAudio.pause();
        isMusicPlaying = false;

        // Update icon
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            playPauseBtn.innerHTML = '<i class="fa-solid fa-play text-xs"></i>';
        }
        Utils.showToast('⏸️ Musik dijeda', 'info');
    } else {
        currentAudio.play().catch(e => console.error("Play failed:", e));
        isMusicPlaying = true;

        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            playPauseBtn.innerHTML = '<i class="fa-solid fa-pause text-xs"></i>';
        }
        Utils.showToast('▶️ Musik dilanjutkan', 'info');
    }
}

// Volume control
function setupVolumeControl() {
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            if (currentAudio) {
                currentAudio.volume = volume;
            }
        });
    }
}

// Tambahkan fungsi untuk update icon play/pause saat musik berakhir
function updatePlayPauseIcon(isPlaying) {
    const playPauseBtn = document.getElementById('playPauseBtn');
    if (playPauseBtn) {
        playPauseBtn.innerHTML = isPlaying
            ? '<i class="fa-solid fa-pause text-xs"></i>'
            : '<i class="fa-solid fa-play text-xs"></i>';
    }
}

// Override playStudyMusic untuk update icon
const originalPlayStudyMusic = playStudyMusic;
window.playStudyMusic = function (type) {
    originalPlayStudyMusic(type);
    updatePlayPauseIcon(true);
};

// Override toggleMusicPlayPause untuk update icon
window.toggleMusicPlayPause = function () {
    toggleMusicPlayPause();
    updatePlayPauseIcon(isMusicPlaying);
};

// ============================================================================
// 11. NOTES ENHANCEMENT - Mobile Friendly Edit & Download
// ============================================================================

// Tambahkan fungsi download note dengan format yang lebih baik
NoteManager.export = function (id) {
    const note = State.notes.find(n => n.id === id);
    if (!note) return;

    // Format untuk download
    const content = `📝 ${note.title}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Tag: ${note.tag}
📅 Tanggal: ${note.date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${note.content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Diexport dari Co-Dash Productivity Dashboard
    `;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    Utils.showToast(`📥 "${note.title}" berhasil diexport!`, 'success');
};

// Tambahkan fungsi share note (jika browser support)
NoteManager.share = async function (id) {
    const note = State.notes.find(n => n.id === id);
    if (!note) return;

    if (navigator.share) {
        try {
            await navigator.share({
                title: note.title,
                text: `${note.title}\nTag: ${note.tag}\n\n${note.content.substring(0, 500)}...`,
            });
            Utils.showToast('Berhasil dibagikan!', 'success');
        } catch (error) {
            if (error.name !== 'AbortError') {
                Utils.showToast('Gagal membagikan!', 'error');
            }
        }
    } else {
        // Fallback: copy ke clipboard
        const shareText = `${note.title}\nTag: ${note.tag}\n\n${note.content}`;
        await navigator.clipboard.writeText(shareText);
        Utils.showToast('📋 Catatan disalin ke clipboard!', 'success');
    }
};

// Update NoteManager.render untuk mobile-friendly (tambah tombol share & edit lebih besar)
const originalNoteRender = NoteManager.render;
NoteManager.render = function (searchQuery = '') {
    const grid = document.getElementById('notesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const query = searchQuery.toLowerCase();
    const filteredNotes = State.notes.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.tag.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query)
    );

    if (filteredNotes.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">📭 Belum ada catatan nih. Klik tombol "Buat Note" untuk mulai!</div>`;
        return;
    }

    filteredNotes.forEach(note => {
        const card = document.createElement('div');
        // Tambahkan touch-friendly classes untuk mobile
        card.className = 'bg-white dark:bg-darkCard p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col hover:shadow-md transition group touch-manipulation';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2 flex-wrap gap-2">
                <span class="text-xs font-semibold bg-indigo-100 text-primary dark:bg-indigo-900/40 px-2 py-1 rounded-md">${note.tag}</span>
                <div class="flex gap-1 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                    <button onclick="shareNote('${note.id}')" class="text-gray-400 hover:text-green-500 p-1.5 sm:p-1 rounded-lg active:bg-gray-100 dark:active:bg-gray-700" title="Bagikan">
                        <i class="fa-solid fa-share-nodes text-sm sm:text-base"></i>
                    </button>
                    <button onclick="editNote('${note.id}')" class="text-gray-400 hover:text-blue-500 p-1.5 sm:p-1 rounded-lg active:bg-gray-100 dark:active:bg-gray-700" title="Edit">
                        <i class="fa-solid fa-pen text-sm sm:text-base"></i>
                    </button>
                    <button onclick="exportNote('${note.id}')" class="text-gray-400 hover:text-green-500 p-1.5 sm:p-1 rounded-lg active:bg-gray-100 dark:active:bg-gray-700" title="Download">
                        <i class="fa-solid fa-download text-sm sm:text-base"></i>
                    </button>
                    <button onclick="deleteNote('${note.id}')" class="text-gray-400 hover:text-red-500 p-1.5 sm:p-1 rounded-lg active:bg-gray-100 dark:active:bg-gray-700" title="Hapus">
                        <i class="fa-solid fa-trash text-sm sm:text-base"></i>
                    </button>
                </div>
            </div>
            <h3 class="font-bold text-base sm:text-lg mb-1 truncate">${note.title}</h3>
            <p class="text-xs text-gray-400 mb-2">📅 ${note.date}</p>
            <p class="text-sm text-gray-600 dark:text-gray-300 flex-1 overflow-hidden overflow-ellipsis line-clamp-4">${note.content}</p>
            <div class="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button onclick="editNote('${note.id}')" class="text-xs text-primary hover:underline w-full text-center block sm:hidden">
                    <i class="fa-solid fa-pen"></i> Edit Note
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
};

// Export global functions untuk notes
window.shareNote = (id) => NoteManager.share(id);

// ============================================================================
// 10. MODAL KONFIRMASI (Global)
// ============================================================================
window.openConfirmModal = (id, type) => {
    State.pendingDelete = { id, type };
    const modal = document.getElementById('confirmModal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
};

window.closeConfirmModal = () => {
    const modal = document.getElementById('confirmModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    State.pendingDelete = { id: null, type: null };
};

// ============================================================================
// 11. EVENT LISTENERS & INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    UI.initTheme();
    ChatBot.init();
    setupVolumeControl();  // TAMBAHKAN INI
    initAlarmSound();      // TAMBAHKAN INI

    document.getElementById('toggleSidebar')?.addEventListener('click', () => UI.toggleSidebar());
    document.getElementById('openSidebar')?.addEventListener('click', () => UI.toggleSidebar());
    document.getElementById('themeToggle')?.addEventListener('click', () => UI.toggleTheme());
    document.getElementById('taskForm')?.addEventListener('submit', (e) => TaskManager.add(e));
    document.getElementById('noteForm')?.addEventListener('submit', (e) => NoteManager.save(e));
    document.getElementById('pomodoroStart')?.addEventListener('click', (e) => Pomodoro.toggle(e.target));
    document.getElementById('pomodoroReset')?.addEventListener('click', () => Pomodoro.reset());

    document.getElementById('overlay')?.addEventListener('click', () => {
        if (window.innerWidth >= 1024) return;
        document.getElementById('sidebar')?.classList.add('-translate-x-full');

        const overlay = document.getElementById('overlay');
        overlay?.classList.remove('opacity-100');
        overlay?.classList.add('opacity-0', 'pointer-events-none');
    });

    document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
        const { id, type } = State.pendingDelete;

        if (type === 'task') await TaskManager.executeDelete(id);
        else if (type === 'note') await NoteManager.executeDelete(id);
        else if (type === 'chat') await ChatBot.executeDelete(); // 🔥 TAMBAHIN INI

        window.closeConfirmModal();
    });

    document.getElementById('globalSearch')?.addEventListener('input', (e) => {
        UI.switchTab('notes'); NoteManager.render(e.target.value);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            e.preventDefault(); document.getElementById('globalSearch')?.focus();
        }
    });
});

// ============================================================================
// 12. NOTIFICATION & REMINDER MANAGER (Cloud Version)
// ============================================================================
const NotificationManager = {
    remindersCol: collection(db, "reminders"),

    // Request izin notifikasi browser
    async requestPermission() {
        if (!("Notification" in window)) {
            console.log("Browser ini tidak support notifikasi");
            return false;
        }

        if (Notification.permission === "granted") {
            return true;
        } else if (Notification.permission !== "denied") {
            const permission = await Notification.requestPermission();
            return permission === "granted";
        }
        return false;
    },

    // Kirim notifikasi
    send(title, body, options = {}) {
        if (Notification.permission !== "granted") return;

        try {
            const notification = new Notification(title, {
                body: body,
                icon: options.icon || "https://www.svgrepo.com/show/475656/google-color.svg",
                tag: options.tag || "productivity",
                silent: options.silent || false,
                ...options
            });

            notification.onclick = () => {
                window.focus();
                if (options.tabId) {
                    UI.switchTab(options.tabId); // Ganti switchTab jadi UI.switchTab
                }
                notification.close();
            };

            setTimeout(() => notification.close(), 10000);
            return notification;
        } catch (error) {
            console.error("Gagal kirim notifikasi:", error);
        }
    },

    // Cek deadline tugas dari cloud
    async checkDeadlines() {
        const user = auth.currentUser;
        if (!user) return;

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentHour = now.getHours();

        // Ambil tugas yang belum selesai dari State
        const pendingTasks = State.tasks.filter(t => !t.done && t.deadline);

        // Ambil reminder yang sudah dikirim hari ini dari cloud
        const sentReminders = await this.getTodaySentReminders(user.uid, today);

        for (const task of pendingTasks) {
            const deadlineDate = new Date(task.deadline);
            const daysLeft = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
            const reminderKey = `deadline_${task.id}_${today}`;

            // Cek udah dikirim belum
            if (sentReminders.has(reminderKey)) continue;

            let reminderType = null;
            let message = "";

            // Reminder H-1
            if (daysLeft === 1 && currentHour >= 9 && currentHour <= 20) {
                reminderType = "h-1";
                message = `Tugas "${task.title}" deadline besok! Jangan lupa dikerjain.`;
                Utils.showToast(`Reminder: "${task.title}" deadline besok!`, 'warning');
            }
            // Reminder H-0
            else if (daysLeft === 0 && currentHour >= 8 && currentHour <= 18) {
                reminderType = "h-0";
                const hoursLeft = Math.ceil((deadlineDate - now) / (1000 * 60 * 60));
                if (hoursLeft > 0 && hoursLeft <= 12) {
                    message = `⚠️ Tugas "${task.title}" deadline ${hoursLeft} jam lagi!`;
                } else {
                    message = `Tugas "${task.title}" deadline HARI INI!`;
                }
                Utils.showToast(`⚠️ "${task.title}" deadline hari ini!`, 'error');
            }
            // Reminder overdue
            else if (daysLeft < 0 && !task.overdueNotified) {
                reminderType = "overdue";
                message = `Tugas "${task.title}" sudah melewati deadline. Segera selesaikan!`;
                task.overdueNotified = true;
                Utils.showToast(`❗ "${task.title}" sudah lewat deadline!`, 'error');
            }

            if (reminderType) {
                // Kirim notifikasi
                this.send(
                    reminderType === "overdue" ? "❗ Tugas Terlewat!" : "⏰ Deadline Mendekat!",
                    message,
                    { tabId: 'tasks', tag: `deadline_${task.id}` }
                );

                // Simpan ke cloud bahwa reminder sudah dikirim
                await this.saveSentReminder(user.uid, {
                    taskId: task.id,
                    type: reminderType,
                    date: today,
                    timestamp: Date.now()
                });
            }
        }

        // Bersihkan reminder lama (lebih dari 7 hari)
        await this.cleanOldReminders(user.uid);
    },

    // Ambil reminder yang sudah dikirim hari ini dari cloud
    async getTodaySentReminders(userId, today) {
        const sentReminders = new Set();
        try {
            const q = query(
                this.remindersCol,
                where("userId", "==", userId),
                where("date", "==", today)
            );
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                const data = doc.data();
                sentReminders.add(`${data.type}_${data.taskId}_${data.date}`);
            });
        } catch (error) {
            console.error("Gagal ambil sent reminders:", error);
        }
        return sentReminders;
    },

    // Simpan reminder yang sudah dikirim ke cloud
    async saveSentReminder(userId, reminderData) {
        try {
            await addDoc(this.remindersCol, {
                userId: userId,
                taskId: reminderData.taskId,
                type: reminderData.type,
                date: reminderData.date,
                timestamp: reminderData.timestamp
            });
        } catch (error) {
            console.error("Gagal save sent reminder:", error);
        }
    },

    // Bersihkan reminder lama (lebih dari 7 hari)
    async cleanOldReminders(userId) {
        try {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekAgoStr = weekAgo.toISOString().split('T')[0];

            const q = query(
                this.remindersCol,
                where("userId", "==", userId),
                where("date", "<", weekAgoStr)
            );
            const querySnapshot = await getDocs(q);

            const deletePromises = [];
            querySnapshot.forEach(doc => {
                deletePromises.push(deleteDoc(doc.ref));
            });
            await Promise.all(deletePromises);
        } catch (error) {
            console.error("Gagal bersihkan old reminders:", error);
        }
    },

    // Daily Summary (Ringkasan Harian)
    async sendDailySummary() {
        const user = auth.currentUser;
        if (!user) return;

        const pendingTasks = State.tasks.filter(t => !t.done);

        // Hitung tugas yang selesai hari ini (dari completedAt)
        const today = new Date().toISOString().split('T')[0];
        const completedToday = State.tasks.filter(t => {
            if (!t.done || !t.completedAt) return false;
            return t.completedAt.split('T')[0] === today;
        });

        const upcomingDeadlines = State.tasks.filter(t => {
            if (!t.deadline || t.done) return false;
            const daysLeft = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24));
            return daysLeft <= 3 && daysLeft >= 0;
        });

        let summary = `📋 Ringkasan Hari Ini:\n`;
        summary += `📝 Tersisa: ${pendingTasks.length} tugas belum selesai\n`;
        summary += `✅ Selesai hari ini: ${completedToday.length} tugas\n`;

        if (upcomingDeadlines.length > 0) {
            summary += `\n⚠️ Deadline mepet (≤3 hari):\n`;
            upcomingDeadlines.forEach(t => {
                const days = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24));
                summary += `• ${t.title} (${days} hari lagi)\n`;
            });
        }

        summary += `\n📚 Total notes: ${State.notes.length}\n`;
        summary += `🔥 Streak: ${this.getStreak()} hari aktif`;

        this.send(
            "📊 Daily Summary",
            summary,
            { tabId: 'dashboard', tag: 'daily_summary', silent: false }
        );
    },

    // Hitung streak aktivitas
    getStreak() {
        let streak = 0;
        const today = new Date();

        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            if (State.activityLog[dateStr] && State.activityLog[dateStr] > 0) {
                streak++;
            } else if (i > 0) {
                break;
            }
        }
        return streak;
    },

    // Set custom reminder (simpan ke cloud)
    async setCustomReminder(title, message, datetime, taskId = null) {
        const user = auth.currentUser;
        if (!user) {
            Utils.showToast('Login dulu untuk set reminder!', 'error');
            return;
        }

        try {
            await addDoc(collection(db, "custom_reminders"), {
                userId: user.uid,
                title: title,
                message: message || title,
                overdueNotified: false, // Tambahkan ini
                datetime: datetime.toISOString(),
                taskId: taskId,
                createdAt: new Date().toISOString(),
                triggered: false
            });

            Utils.showToast(`Reminder "${title}" berhasil diset!`, 'success');
        } catch (error) {
            console.error("Gagal save custom reminder:", error);
            Utils.showToast('Gagal menyimpan reminder!', 'error');
        }
    },

    // Cek custom reminder dari cloud
    async checkCustomReminders() {
        const user = auth.currentUser;
        if (!user) return;

        const now = new Date();

        try {
            const q = query(
                collection(db, "custom_reminders"),
                where("userId", "==", user.uid),
                where("triggered", "==", false)
            );
            const querySnapshot = await getDocs(q);

            // Perbaiki iterasi
            for (const docSnap of querySnapshot.docs) {
                const reminder = { id: docSnap.id, ...docSnap.data() };
                const reminderTime = new Date(reminder.datetime);

                if (reminderTime <= now) {
                    this.send(
                        reminder.title,
                        reminder.message,
                        { tabId: reminder.taskId ? 'tasks' : 'dashboard', tag: `custom_${reminder.id}` }
                    );

                    await updateDoc(doc(db, "custom_reminders", reminder.id), {
                        triggered: true,
                        triggeredAt: now.toISOString()
                    });

                    Utils.showToast(`🔔 ${reminder.title}`, 'success');
                }
            }
        } catch (error) {
            console.error("Gagal cek custom reminders:", error);
        }
    },

    // Hapus custom reminder
    async deleteCustomReminder(reminderId) {
        try {
            await deleteDoc(doc(db, "custom_reminders", reminderId));
            Utils.showToast('Reminder dihapus!', 'success');
        } catch (error) {
            console.error("Gagal hapus reminder:", error);
        }
    },

    // Ambil semua custom reminder user
    async getCustomReminders() {
        const user = auth.currentUser;
        if (!user) return [];

        try {
            const q = query(
                collection(db, "custom_reminders"),
                where("userId", "==", user.uid),
                where("triggered", "==", false)
            );
            const querySnapshot = await getDocs(q);
            const reminders = [];
            querySnapshot.forEach(doc => {
                reminders.push({ id: doc.id, ...doc.data() });
            });
            return reminders.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        } catch (error) {
            console.error("Gagal ambil custom reminders:", error);
            return [];
        }
    },

    // Request permission saat login
    async init() {
        const granted = await this.requestPermission();
        if (granted) {
            console.log("Notifikasi diizinkan!");
        }
    }
};

// ============================================================================
// 13. REMINDER INTERVAL & SCHEDULER (Updated)
// ============================================================================
let reminderInterval = null;

const ReminderScheduler = {
    async start() {
        // Cek deadline setiap 15 menit
        reminderInterval = setInterval(async () => {
            if (typeof NotificationManager !== 'undefined') {
                await NotificationManager.checkDeadlines();
                await NotificationManager.checkCustomReminders();
            }
        }, 15 * 60 * 1000);

        // Daily summary setiap jam 7 pagi
        const scheduleNextDaily = async () => {
            const now = new Date();
            const next7AM = new Date();
            next7AM.setHours(7, 0, 0, 0);

            if (now >= next7AM) {
                next7AM.setDate(next7AM.getDate() + 1);
            }

            const timeUntil7AM = next7AM - now;

            setTimeout(async () => {
                await NotificationManager.sendDailySummary();
                scheduleNextDaily(); // Re-schedule untuk besok
            }, timeUntil7AM);
        };

        scheduleNextDaily();

        console.log("Reminder scheduler started!");
    },

    stop() {
        if (reminderInterval) {
            clearInterval(reminderInterval);
            reminderInterval = null;
        }
    }
};

// ============================================================================
// 14. MODAL SET REMINDER (UI Baru)
// ============================================================================
async function showReminderModal(taskId = null, taskTitle = null) {
    // Cek apakah modal sudah ada
    let modal = document.getElementById('reminderModal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'reminderModal';
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm hidden items-center justify-center z-[70]';
        modal.innerHTML = `
            <div class="bg-white dark:bg-darkCard w-full max-w-md rounded-2xl p-6 transform transition-all shadow-2xl animate-fade-in">
                <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                    <i class="fa-solid fa-bell text-primary"></i>
                    Set Reminder
                </h3>
                <form id="reminderForm" class="space-y-4">
                    <input type="hidden" id="reminderTaskId">
                    <div>
                        <label class="block text-sm font-medium mb-1">Judul Reminder</label>
                        <input type="text" id="reminderTitle" class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="Misal: Kerjakan Tugas Matematika" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Pesan</label>
                        <textarea id="reminderMessage" rows="2" class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="Pengingat tambahan..."></textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Tanggal & Waktu</label>
                        <input type="datetime-local" id="reminderDateTime" class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-primary outline-none" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Daftar Reminder Aktif</label>
                        <div id="activeRemindersList" class="max-h-32 overflow-y-auto space-y-2 text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                            <p class="text-gray-400 text-center text-xs">Loading...</p>
                        </div>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="closeReminderModal()" class="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition font-semibold">
                            Batal
                        </button>
                        <button type="submit" class="flex-1 px-4 py-2 bg-primary text-white rounded-xl hover:bg-indigo-600 transition font-semibold shadow-lg shadow-primary/30">
                            <i class="fa-solid fa-bell"></i> Set Reminder
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        // Event listener form
        document.getElementById('reminderForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const taskId = document.getElementById('reminderTaskId').value;
            const title = document.getElementById('reminderTitle').value;
            const message = document.getElementById('reminderMessage').value;
            const datetime = new Date(document.getElementById('reminderDateTime').value);

            if (datetime <= new Date()) {
                Utils.showToast('Waktu reminder harus di masa depan!', 'error');
                return;
            }

            await NotificationManager.setCustomReminder(title, message || title, datetime, taskId || null);
            closeReminderModal();
        });
    }

    // Isi data
    if (taskId && taskTitle) {
        document.getElementById('reminderTaskId').value = taskId;
        document.getElementById('reminderTitle').value = `Selesaikan: ${taskTitle}`;
        document.getElementById('reminderMessage').value = `Jangan lupa kerjakan tugas "${taskTitle}"!`;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(8, 0, 0, 0);
        document.getElementById('reminderDateTime').value = tomorrow.toISOString().slice(0, 16);
    } else {
        document.getElementById('reminderTaskId').value = '';
        document.getElementById('reminderTitle').value = '';
        document.getElementById('reminderMessage').value = '';
        const defaultTime = new Date();
        defaultTime.setHours(defaultTime.getHours() + 1);
        document.getElementById('reminderDateTime').value = defaultTime.toISOString().slice(0, 16);
    }

    // Load daftar reminder aktif
    await loadActiveReminders();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function loadActiveReminders() {
    const listContainer = document.getElementById('activeRemindersList');
    if (!listContainer) return;

    const reminders = await NotificationManager.getCustomReminders();

    if (reminders.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-400 text-center text-xs py-2">Belum ada reminder aktif</p>';
        return;
    }

    listContainer.innerHTML = reminders.map(reminder => {
        const date = new Date(reminder.datetime);
        const formattedDate = date.toLocaleString('id-ID');
        return `
            <div class="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium truncate">${reminder.title}</p>
                    <p class="text-[10px] text-gray-500">${formattedDate}</p>
                </div>
                <button onclick="deleteReminder('${reminder.id}')" class="text-red-400 hover:text-red-500 text-xs p-1">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

async function deleteReminder(reminderId) {
    await NotificationManager.deleteCustomReminder(reminderId);
    await loadActiveReminders(); // Refresh list
}

function closeReminderModal() {
    const modal = document.getElementById('reminderModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// ============================================================================
// 12. ROUTING GLOBAL HTML -> JS
// ============================================================================
window.loginGoogle = () => AuthManager.login();
window.logoutUser = () => AuthManager.logout();
window.switchTab = (tabId) => UI.switchTab(tabId);
window.filterTasks = (filter) => TaskManager.setFilter(filter);
window.toggleTask = (id) => TaskManager.toggle(id);
window.deleteTask = (id) => TaskManager.delete(id);
window.toggleNoteModal = () => NoteManager.toggleModal();
window.deleteNote = (id) => NoteManager.delete(id);
window.editNote = (id) => NoteManager.edit(id);
window.exportNote = (id) => NoteManager.export(id);
// Tambahkan di bagian akhir
window.showReminderModal = showReminderModal;
window.closeReminderModal = closeReminderModal;
window.deleteReminder = deleteReminder;
window.loadActiveReminders = loadActiveReminders;

window.playStudyMusic = playStudyMusic;
window.stopMusic = stopMusic;
window.closeMusicPlayer = closeMusicPlayer;
window.toggleMusicPlayPause = toggleMusicPlayPause;
window.shareNote = (id) => NoteManager.share(id);

AuthManager.monitorState();