// ============================================================================
// IMPORT & SETUP
// ============================================================================
import './style.css';
import Chart from 'chart.js/auto';
import { db, auth, googleProvider } from './firebase.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

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
            if(btn.dataset.target === tabId) btn.classList.add('active-tab');
        });

        if (window.innerWidth < 1024) this.toggleSidebar();
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        if (window.innerWidth >= 1024) {
            sidebar?.classList.remove('-translate-x-full');
            overlay?.classList.add('hidden');
            return;
        }
        sidebar?.classList.toggle('-translate-x-full');
        overlay?.classList.toggle('hidden');
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
            const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Zidane';
            const jpGreeting = document.getElementById('jpGreeting');
            if (jpGreeting) jpGreeting.innerText = `Semangat nugasnya, ${firstName}-kun! 🎌`;

            const words = [
                { kanji: '勉強', romaji: '(Benkyou) - Belajar' },
                { kanji: '頑張って', romaji: '(Ganbatte) - Semangat/Berjuang' },
                { kanji: '効率', romaji: '(Kouritsu) - Efisiensi' },
                { kanji: '目標', romaji: '(Mokuhyou) - Target/Tujuan' },
                { kanji: '情報セキュリティ', romaji: '(Jouhou Sekyuriti) - Cybersecurity' }
            ];
            const randomWord = words[Math.floor(Math.random() * words.length)];
            if (document.getElementById('jpKanji')) {
                document.getElementById('jpKanji').innerText = randomWord.kanji;
                document.getElementById('jpRomaji').innerText = randomWord.romaji;
            }

            const welcomeText = document.getElementById('welcomeText');
            if (welcomeText) welcomeText.innerText = `Welcome Back, ${user.displayName}!`;

            const userProfileImg = document.getElementById('userProfileImg');
            if (userProfileImg) {
                userProfileImg.onerror = () => userProfileImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=6366F1&color=fff`;
                userProfileImg.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=6366F1&color=fff`;
            }

            if(loginScreen) loginScreen.classList.add('hidden');
            if(mainDashboard) {
                mainDashboard.classList.remove('hidden');
                mainDashboard.classList.add('flex');
            }

            // 🔥 PANGGIL SEMUA DATA DARI CLOUD!
            setTimeout(() => {
                TaskManager.load();
                NoteManager.load(); 
                ChatBot.load(); // Load history chat!
                Dashboard.update();
            }, 100);

        } else {
            if(loginScreen) loginScreen.classList.remove('hidden');
            if(mainDashboard) {
                mainDashboard.classList.add('hidden');
                mainDashboard.classList.remove('flex');
            }
            State.tasks = [];
            State.notes = [];
            if (document.getElementById('taskList')) document.getElementById('taskList').innerHTML = '';
            const chatBox = document.getElementById('chatBox');
            if (chatBox) chatBox.innerHTML = '';
        }
    }
};

// ============================================================================
// 4. AUTH MANAGER
// ============================================================================
const AuthManager = {
    async login() {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            Utils.showToast(`Halo ${result.user.displayName}! Selamat datang.`, 'success');
        } catch (error) { Utils.showToast(error.message, 'error'); }
    },
    async logout() {
        try {
            await signOut(auth);
            Utils.showToast('Berhasil logout. Sampai jumpa!', 'success');
        } catch (error) { Utils.showToast('Gagal logout!', 'error'); }
    },
    monitorState() {
        onAuthStateChanged(auth, (user) => UI.renderAuthState(user));
    }
};

// ============================================================================
// 5. DASHBOARD MANAGER
// ============================================================================
let taskChartInstance = null;
const Dashboard = {
    update() {
        const pendingTasks = State.tasks.filter(t => !t.done);
        const doneTasks = State.tasks.filter(t => t.done);
        
        const elPending = document.getElementById('stat-pending-tasks');
        const elNotes = document.getElementById('stat-total-notes');
        const elDone = document.getElementById('stat-done-tasks');

        if(elPending) elPending.innerText = pendingTasks.length;
        if(elNotes) elNotes.innerText = State.notes.length;
        if(elDone) elDone.innerText = doneTasks.length;

        this.renderUpNext(pendingTasks);
        this.renderChart(pendingTasks.length, doneTasks.length);
        this.renderHeatmap();
    },
    renderUpNext(pendingTasks) {
        const list = document.getElementById('upNextList');
        if(!list) return;

        const withDeadline = pendingTasks.filter(t => t.deadline).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        const top3 = withDeadline.slice(0, 3);

        if (top3.length === 0) {
            list.innerHTML = `<li class="text-sm text-gray-500 py-4 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">Aman, nggak ada deadline mepet! Bawa kalem dulu aja.</li>`;
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
    renderChart(pending, done) {
        const ctx = document.getElementById('taskChart');
        if (!ctx) return;
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#9CA3AF' : '#4B5563';

        if (taskChartInstance) {
            taskChartInstance.data.datasets[0].data = [done, pending];
            taskChartInstance.options.plugins.legend.labels.color = textColor;
            taskChartInstance.update();
            return;
        }
        taskChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Selesai', 'Nunggak'], datasets: [{ data: [done, pending], backgroundColor: ['#10B981', '#EF4444'], borderWidth: 0, hoverOffset: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor, padding: 20 } } }, cutout: '75%' }
        });
    },
    renderHeatmap() {
        const grid = document.getElementById('heatmapGrid');
        if(!grid) return;
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
// 6. TASK MANAGER (Firebase Cloud)
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
            this.render(); Dashboard.update();
        } catch (error) { console.error("Gagal nyaring data:", error); }
    },
    async add(e) {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return Utils.showToast("Login dulu!", "error");

        const input = document.getElementById('taskInput');
        const deadline = document.getElementById('taskDeadline');
        if (!deadline.value) return Utils.showToast('Isi tanggalnya dulu bro!', 'error');

        try {
            await addDoc(this.tasksCol, { title: input.value, deadline: deadline.value, done: false, userId: user.uid, timestamp: Date.now() });
            input.value = ''; deadline.value = '';
            Utils.showToast('Tugas udah disimpen!');
            this.load(); 
        } catch (error) { Utils.showToast('Gagal nyimpen!', 'error'); }
    },
    async toggle(id) {
        const task = State.tasks.find(t => t.id === id);
        if (!task) return;
        const newDone = !task.done;
        task.done = newDone;
        this.render(); Dashboard.update();
        try {
            await updateDoc(doc(db, "tasks", id), { done: newDone });
            if (newDone) Utils.recordActivity();
        } catch (error) {
            task.done = !newDone;
            this.render(); Dashboard.update();
            Utils.showToast('Gagal centang tugas!', 'error');
        }
    },
    delete(id) { window.openConfirmModal(id, 'task'); },
    async executeDelete(id) {
        const idx = State.tasks.findIndex(t => t.id === id);
        if (idx === -1) return;
        const [removed] = State.tasks.splice(idx, 1);
        this.render(); Dashboard.update();
        try {
            await deleteDoc(doc(db, "tasks", id));
            Utils.showToast('Tugas dihapus dari muka bumi!', 'error');
        } catch (error) {
            State.tasks.splice(idx, 0, removed);
            this.render(); Dashboard.update();
            Utils.showToast('Gagal hapus tugas!', 'error');
        }
    },
    setFilter(filter) { State.taskFilter = filter; this.render(); },
    render() {
        const list = document.getElementById('taskList');
        if(!list) return;
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
            if (task.deadline && !task.done) {
                const daysLeft = (new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24);
                if (daysLeft < 2) isMepet = true;
            }
            const li = document.createElement('li');
            li.className = `flex justify-between items-center p-3 rounded-xl border ${task.done ? 'bg-gray-50 dark:bg-gray-800/50 border-transparent opacity-60' : 'bg-white dark:bg-darkCard border-gray-100 dark:border-gray-700'}`;
            li.innerHTML = `
                <div class="flex items-center gap-3 w-full pr-4">
                    <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleTask('${task.id}')" class="w-5 h-5 text-primary rounded cursor-pointer accent-primary shrink-0">
                    <div class="truncate">
                        <p class="truncate ${task.done ? 'line-through text-gray-500' : 'font-medium'}">${task.title}</p>
                        ${task.deadline ? `<p class="text-xs ${isMepet ? 'text-red-500 font-bold' : 'text-gray-500'}"><i class="fa-regular fa-clock"></i> ${task.deadline}</p>` : ''}
                    </div>
                </div>
                <button onclick="deleteTask('${task.id}')" class="text-gray-400 hover:text-red-500 transition shrink-0"><i class="fa-solid fa-trash"></i></button>
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
        if(note) {
            document.getElementById('noteId').value = note.id;
            document.getElementById('noteTitle').value = note.title;
            document.getElementById('noteTag').value = note.tag;
            document.getElementById('noteContent').value = note.content;
            this.toggleModal();
        }
    },
    export(id) {
        const note = State.notes.find(n => n.id === id);
        if(!note) return;
        const blob = new Blob([`${note.title}\nKategori: ${note.tag}\nTanggal: ${note.date}\n\n${note.content}`], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${note.title.replace(/\s+/g, '_')}.txt`;
        a.click(); URL.revokeObjectURL(url);
        Utils.showToast('Berhasil diexport!');
    },
    render(searchQuery = '') {
        const grid = document.getElementById('notesGrid');
        if(!grid) return;
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
            
            if(previewCont) previewCont.classList.remove('hidden');
            document.getElementById('removeImageBtn')?.classList.remove('hidden');
            document.getElementById('docPreviewIcon')?.remove();

            if (isImage) {
                if(previewImg) { previewImg.src = event.target.result; previewImg.classList.remove('hidden'); }
            } else {
                if(previewImg) { previewImg.src = ''; previewImg.classList.add('hidden'); }
                if (previewCont) {
                    const docPreview = document.createElement('div');
                    docPreview.id = 'docPreviewIcon';
                    docPreview.className = 'flex items-center gap-2 p-2 px-4 bg-gray-200 dark:bg-gray-700 rounded-md text-gray-800 dark:text-gray-200';
                    docPreview.innerHTML = `<i class="fa-solid fa-file-lines text-primary"></i> <span class="text-xs truncate max-w-[100px]">${file.name}</span>`;
                    previewCont.insertBefore(docPreview, document.getElementById('removeImageBtn'));
                }
            }
            if(input) input.removeAttribute('required');
        };
        reader.readAsDataURL(file);
    },

    clearAttachment() {
        attachedFile = { base64: null, mimeType: null, name: null, isImage: false };
        if(document.getElementById('fileInput')) document.getElementById('fileInput').value = '';
        if(document.getElementById('imagePreview')) {
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
        if(input) input.value = '';

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
            if(currentPayload.base64) Utils.recordActivity(); 

        } catch (error) {
            document.getElementById(loadingId)?.remove();
            this.appendMessage(`Koneksi Groq gagal: ${error.message}`, false, null, true);
        }
    },

    showLoading(id) {
        const box = document.getElementById('chatBox');
        if(box) {
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
        if(display) display.innerText = `${m}:${s}`;
    },
    toggle(btn) {
        if (State.pomodoro.interval) {
            clearInterval(State.pomodoro.interval); State.pomodoro.interval = null;
            btn.innerText = 'Start'; btn.classList.replace('bg-yellow-500', 'bg-primary');
        } else {
            btn.innerText = 'Pause'; btn.classList.replace('bg-primary', 'bg-yellow-500');
            State.pomodoro.interval = setInterval(() => {
                if (State.pomodoro.time > 0) { State.pomodoro.time--; this.updateDisplay(); }
                else {
                    this.reset();
                    Utils.showToast('Waktu fokus abis! Istirahat dulu sana.');
                    Utils.recordActivity(); 
                    new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(()=>{});
                }
            }, 1000);
        }
    },
    reset() {
        clearInterval(State.pomodoro.interval); State.pomodoro.interval = null;
        State.pomodoro.time = 25 * 60; this.updateDisplay();
        const btn = document.getElementById('pomodoroStart');
        if(btn) { btn.innerText = 'Start'; btn.classList.replace('bg-yellow-500', 'bg-primary'); }
    }
};

// ============================================================================
// 10. MODAL KONFIRMASI (Global)
// ============================================================================
window.openConfirmModal = (id, type) => {
    State.pendingDelete = { id, type };
    const modal = document.getElementById('confirmModal');
    if(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
};

window.closeConfirmModal = () => {
    const modal = document.getElementById('confirmModal');
    if(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    State.pendingDelete = { id: null, type: null };
};

// ============================================================================
// 11. EVENT LISTENERS & INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    UI.initTheme();
    ChatBot.init();

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
        document.getElementById('overlay')?.classList.add('hidden');
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

AuthManager.monitorState();