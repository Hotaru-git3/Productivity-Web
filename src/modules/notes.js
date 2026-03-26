import { db } from "../firebase";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { AppState } from "./state";
import { showToast } from "../utils/toast";
import { recordActivity } from "../utils/storage";
import { Dashboard } from "./dashboard";

const NOTES_COLLECTION = collection(db, "notes");

export const NoteManager = {
  async load() {
    const user = AppState.currentUser;
    if (!user) return;

    try {
      const q = query(NOTES_COLLECTION, where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      AppState.notes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.render();
      Dashboard.update();
    } catch (error) {
      console.error("Failed to load notes:", error);
      showToast("Gagal memuat catatan", "error");
    }
  },

  openModal(id = null) {
    const modal = document.getElementById("noteModal");
    const form = document.getElementById("noteForm");

    if (!modal) return;

    if (id) {
      const note = AppState.notes.find(n => n.id === id);
      if (note) {
        document.getElementById("noteId").value = note.id;
        document.getElementById("noteTitle").value = note.title;
        document.getElementById("noteTag").value = note.tag || "";
        document.getElementById("noteContent").value = note.content;
      }
    } else {
      form.reset();
      document.getElementById("noteId").value = "";
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  },

  closeModal() {
    const modal = document.getElementById("noteModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
    document.getElementById("noteForm").reset();
  },

  async save(e) {
    e.preventDefault();
    const user = AppState.currentUser;
    if (!user) return showToast("Login dulu!", "error");

    const id = document.getElementById("noteId").value;
    const noteData = {
      title: document.getElementById("noteTitle").value.trim(),
      tag: document.getElementById("noteTag").value.trim() || "General",
      content: document.getElementById("noteContent").value.trim(),
      userId: user.uid,
      date: new Date().toLocaleDateString("id-ID"),
      timestamp: Date.now()
    };

    if (!noteData.title) return showToast("Judul tidak boleh kosong!", "error");

    try {
      if (id) {
        await updateDoc(doc(db, "notes", id), noteData);
        showToast("Catatan diupdate!");
      } else {
        await addDoc(NOTES_COLLECTION, noteData);
        showToast("Catatan berhasil ditambahkan!");
        recordActivity(AppState.activityLog);
      }
      this.closeModal();
      await this.load();
    } catch (error) {
      console.error("Failed to save note:", error);
      showToast("Gagal menyimpan catatan!", "error");
    }
  },

  async delete(id) {
    try {
      await deleteDoc(doc(db, "notes", id));
      await this.load();
      showToast("Catatan dihapus!", "success");
    } catch (error) {
      console.error("Failed to delete note:", error);
      showToast("Gagal menghapus catatan!", "error");
    }
  },

  export(id) {
    const note = AppState.notes.find(n => n.id === id);
    if (!note) return;

    const content = `📝 ${note.title}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Tag: ${note.tag}
📅 Tanggal: ${note.date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${note.content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Diexport dari Co-Dash
    `;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`"${note.title}" berhasil diexport!`, "success");
  },

  async share(id) {
    const note = AppState.notes.find(n => n.id === id);
    if (!note) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: note.title,
          text: `${note.title}\nTag: ${note.tag}\n\n${note.content.substring(0, 500)}...`
        });
        showToast("Berhasil dibagikan!", "success");
      } catch (error) {
        if (error.name !== "AbortError") showToast("Gagal membagikan!", "error");
      }
    } else {
      await navigator.clipboard.writeText(`${note.title}\n\n${note.content}`);
      showToast("📋 Catatan disalin ke clipboard!", "success");
    }
  },

  render(searchQuery = "") {
    const grid = document.getElementById("notesGrid");
    if (!grid) return;

    const query = searchQuery.toLowerCase();
    const filteredNotes = AppState.notes.filter(n =>
      n.title.toLowerCase().includes(query) ||
      n.tag.toLowerCase().includes(query) ||
      n.content.toLowerCase().includes(query)
    );

    if (filteredNotes.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">📭 Belum ada catatan nih. Klik tombol "Buat Note" untuk mulai!</div>`;
      return;
    }

    grid.innerHTML = filteredNotes.map(note => `
      <div class="bg-white dark:bg-darkCard p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col hover:shadow-md transition">
        <div class="flex justify-between items-start mb-2 flex-wrap gap-2">
          <span class="text-xs font-semibold bg-indigo-100 text-primary dark:bg-indigo-900/40 px-2 py-1 rounded-md">${escapeHtml(note.tag)}</span>
          <div class="flex gap-1 sm:gap-2">
            <button onclick="window.noteManager.share('${note.id}')" class="text-gray-400 hover:text-green-500 p-1.5 rounded-lg" title="Bagikan"><i class="fa-solid fa-share-nodes"></i></button>
            <button onclick="window.noteManager.openModal('${note.id}')" class="text-gray-400 hover:text-blue-500 p-1.5 rounded-lg" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button onclick="window.noteManager.export('${note.id}')" class="text-gray-400 hover:text-green-500 p-1.5 rounded-lg" title="Download"><i class="fa-solid fa-download"></i></button>
            <button onclick="window.noteManager.delete('${note.id}')" class="text-gray-400 hover:text-red-500 p-1.5 rounded-lg" title="Hapus"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <h3 class="font-bold text-base sm:text-lg mb-1 truncate">${escapeHtml(note.title)}</h3>
        <p class="text-xs text-gray-400 mb-2">📅 ${note.date}</p>
        <p class="text-sm text-gray-600 dark:text-gray-300 flex-1 overflow-hidden line-clamp-4">${escapeHtml(note.content)}</p>
      </div>
    `).join("");
  }
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