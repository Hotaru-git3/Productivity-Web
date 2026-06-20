import { db } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";
import { AppState } from "./state";
import { showToast } from "../utils/toast";
import { recordActivity } from "../utils/storage";

const CHATS_COLLECTION = collection(db, "chats");
let currentFile = null;
let loadingId = null;

// Security: Validasi input
function sanitizeInput(text) {
    if (!text) return "";
    return text.replace(/[<>]/g, "").trim();
}

// Security: Validasi file
function validateFile(file) {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "text/plain"];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: "Tipe file tidak diizinkan" };
    }
    if (file.size > maxSize) {
        return { valid: false, error: "Ukuran file maksimal 5MB" };
    }
    return { valid: true };
}

// Security: Filter response dari AI
function filterResponse(text) {
    if (!text) return "";
    const blockedPatterns = [
        /ignore previous instructions/i,
        /forget your instructions/i,
        /you are now/i,
        /system prompt/i
    ];
    
    let filtered = text;
    for (const pattern of blockedPatterns) {
        filtered = filtered.replace(pattern, "[filtered]");
    }
    return filtered;
}

export const ChatManager = {
  async load() {
    const user = AppState.currentUser;
    if (!user) return;

    try {
      const q = query(CHATS_COLLECTION, where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const messages = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      messages.sort((a, b) => a.timestamp - b.timestamp);

      const box = document.getElementById("chatBox");
      if (box) box.innerHTML = "";

      if (messages.length === 0) {
        this.appendMessage("Halo! Ada materi yang mau dibahas atau dijelasin ulang? Ketik aja!", false, null, false);
      } else {
        messages.forEach(msg => this.appendMessage(msg.text, msg.isUser, msg.fileInfo || null, false));
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  },

  async clearHistory() {
    const user = AppState.currentUser;
    if (!user) return;

    try {
      const q = query(CHATS_COLLECTION, where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      await Promise.all(querySnapshot.docs.map(doc => deleteDoc(doc.ref)));

      const box = document.getElementById("chatBox");
      if (box) box.innerHTML = "";
      this.appendMessage("Riwayat chat berhasil dibersihkan! Ada yang bisa dibantu lagi?", false, null, false);
      showToast("History chat udah bersih!", "success");
    } catch (error) {
      console.error("Failed to clear chat history:", error);
      showToast("Gagal bersihin history!", "error");
    }
  },

  async saveToCloud(text, isUser, fileInfo = null) {
    const user = AppState.currentUser;
    if (!user) return;

    const safeText = sanitizeInput(text);
    const safeFileInfo = fileInfo ? { 
        name: sanitizeInput(fileInfo.name), 
        isImage: fileInfo.isImage 
    } : null;
    
    try {
      await addDoc(CHATS_COLLECTION, {
        userId: user.uid,
        text: safeText || "",
        isUser: isUser,
        fileInfo: safeFileInfo,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Failed to save chat:", error);
    }
  },

  appendMessage(text, isUser = false, fileData = null, saveToDb = true) {
    const box = document.getElementById("chatBox");
    if (!box) return;

    if (saveToDb && AppState.currentUser) {
      this.saveToCloud(text, isUser, fileData);
    }

    const user = AppState.currentUser;
    const userPhoto = user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || "User")}&background=6366F1&color=fff`;

    const msgDiv = document.createElement("div");
    msgDiv.className = `flex gap-2 sm:gap-3 ${isUser ? "justify-end" : ""} animate-fade-in mb-3 sm:mb-4`;
    
    const bubbleMaxWidth = isUser ? "max-w-[85%] sm:max-w-[75%]" : "max-w-[90%] sm:max-w-[80%]";

    if (isUser) {
      msgDiv.innerHTML = `
        <div class="flex flex-col items-end ${bubbleMaxWidth}">
          ${text ? `<div class="bg-primary text-white p-2.5 sm:p-3 rounded-2xl rounded-tr-none text-sm shadow-md break-words">${escapeHtml(text)}</div>` : ""}
        </div>
        <img class="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover shrink-0 border border-gray-100 dark:border-gray-700 shadow-sm" src="${userPhoto}">
      `;
    } else {
      const formattedText = text ? text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>") : "";
      msgDiv.innerHTML = `
        <div class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white flex-shrink-0 shadow-md">
          <i class="fa-solid fa-robot text-xs sm:text-sm"></i>
        </div>
        <div class="bg-gray-100 dark:bg-gray-800 p-2.5 sm:p-3 rounded-2xl rounded-tl-none text-xs sm:text-sm ${bubbleMaxWidth} text-gray-800 dark:text-gray-200 shadow-sm leading-relaxed break-words">
          ${formattedText}
        </div>
      `;
    }

    box.appendChild(msgDiv);
    this.scrollToBottom();
  },

  scrollToBottom() {
    const box = document.getElementById("chatBox");
    if (box) {
      setTimeout(() => {
        box.scrollTo({
          top: box.scrollHeight,
          behavior: "smooth"
        });
      }, 100);
    }
  },

  async sendMessage(e) {
    e.preventDefault();

    const input = document.getElementById("chatInput");
    let userText = input?.value.trim() || "";
    
    if (userText.length > 4000) {
      showToast("Pesan terlalu panjang! Maksimal 4000 karakter.", "error");
      return;
    }
    
    userText = sanitizeInput(userText);
    if (!userText && !currentFile) return;

    if (currentFile) {
      const fileInput = document.getElementById("fileInput");
      const file = fileInput?.files?.[0];
      if (file) {
        const validation = validateFile(file);
        if (!validation.valid) {
          showToast(validation.error, "error");
          this.clearAttachment();
          return;
        }
      }
    }

    const apiKey = import.meta.env.VITE_NVIDIA_API_KEY;
    
    if (!apiKey) {
      showToast("NVIDIA API Key belum dipasang di .env!", "error");
      return;
    }

    const currentPayload = currentFile ? { ...currentFile } : null;
    this.appendMessage(userText, true, currentPayload, true);
    this.clearAttachment();
    if (input) input.value = "";

    this.showLoading();

    try {
      // 🔥 MODEL NAME YANG BENAR UNTUK NVIDIA NIM
      let selectedModel = "deepseek-ai/deepseek-v4-flash";
      
      let messages = [
        {
          role: "system",
          content: `You are a helpful AI assistant for a student productivity dashboard. 
          Provide clear, accurate, and educational responses. 
          Do not provide harmful, dangerous, or inappropriate content.
          Keep responses concise and helpful.
          If you don't know something, say so.`
        },
        {
          role: "user",
          content: userText || "Tolong jelaskan ini."
        }
      ];

      let requestBody = {
        model: selectedModel,
        messages: messages,
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 4096,
        stream: false
      };

      // 🔥 JIKA ADA GAMBAR
      if (currentPayload?.base64 && currentPayload.isImage) {
        requestBody.model = "meta/llama-4-maverick-17b-128e-instruct";
        requestBody.messages = [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userText || "Apa yang ada di gambar ini?"
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${currentPayload.mimeType};base64,${currentPayload.base64}`
                }
              }
            ]
          }
        ];
      }

      // 🔥 JIKA ADA PDF/TXT
      if (currentPayload?.base64 && !currentPayload.isImage) {
        messages[0].content = `[User mengirim file: ${currentPayload.name}]\n\n${userText || "Tolong jelaskan isi file ini."}`;
        requestBody.messages = messages;
        showToast("📄 File akan diproses sebagai teks.", "info");
      }

      const lastRequest = this._lastRequestTime || 0;
      const now = Date.now();
      if (now - lastRequest < 1000) {
        showToast("Tunggu sebentar sebelum mengirim pesan lagi.", "warning");
        this.hideLoading();
        return;
      }
      this._lastRequestTime = now;

      // 🔥 PAKAI PROXY
      console.log("📤 Sending to NVIDIA:", requestBody.model);
      const response = await fetch("/api/nvidia/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      // 🔥 BACA RESPONSE DENGAN BENAR
      const responseText = await response.text();
      console.log("📥 Response status:", response.status);
      console.log("📥 Response preview:", responseText.substring(0, 200));

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("❌ JSON Parse Error:", parseError);
        throw new Error("Respons dari server tidak valid. Coba lagi nanti.");
      }

      this.hideLoading();

      if (!response.ok) {
        console.error("❌ NVIDIA API Error:", data);
        const errorMsg = data.error?.message || data.message || "Gagal mendapatkan respons dari NVIDIA AI";
        throw new Error(errorMsg);
      }

      let aiResponse = data.choices?.[0]?.message?.content || "Maaf, saya tidak bisa memberikan respons.";
      aiResponse = filterResponse(aiResponse);
      
      this.appendMessage(aiResponse, false, null, true);

      if (currentPayload) recordActivity(AppState.activityLog);
    } catch (error) {
      console.error("❌ Chat error:", error);
      this.hideLoading();
      this.appendMessage(`Error: ${error.message}`, false, null, true);
    }
  },

  _lastRequestTime: 0,

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      showToast(validation.error, "error");
      this.clearAttachment();
      e.target.value = "";
      return;
    }

    const isImage = file.type.startsWith("image/");

    const reader = new FileReader();
    reader.onload = (event) => {
      currentFile = {
        base64: event.target.result.split(",")[1],
        mimeType: file.type,
        name: sanitizeInput(file.name),
        isImage
      };

      const previewContainer = document.getElementById("imagePreviewContainer");
      const previewImg = document.getElementById("imagePreview");
      const input = document.getElementById("chatInput");

      if (previewContainer) previewContainer.classList.remove("hidden");
      document.getElementById("removeImageBtn")?.classList.remove("hidden");

      if (isImage && previewImg) {
        previewImg.src = event.target.result;
        previewImg.classList.remove("hidden");
        previewImg.className = "h-12 w-auto rounded-md object-cover border border-gray-200 dark:border-gray-700";
      } else if (previewContainer) {
        const existingPreview = document.getElementById("docPreviewIcon");
        if (existingPreview) existingPreview.remove();

        const docPreview = document.createElement("div");
        docPreview.id = "docPreviewIcon";
        docPreview.className = "flex items-center gap-2 p-1.5 px-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-700 dark:text-gray-300 text-sm";
        docPreview.innerHTML = `<i class="fa-solid fa-file-lines text-primary"></i> <span class="text-xs truncate max-w-[120px]">${sanitizeInput(file.name)}</span>`;
        previewContainer.insertBefore(docPreview, document.getElementById("removeImageBtn"));
      }

      if (input) input.removeAttribute("required");
      showToast(`📎 File terupload: ${sanitizeInput(file.name)}`, "success");
    };
    reader.readAsDataURL(file);
  },

  clearAttachment() {
    currentFile = null;
    const fileInput = document.getElementById("fileInput");
    if (fileInput) fileInput.value = "";

    const previewImg = document.getElementById("imagePreview");
    if (previewImg) {
      previewImg.src = "";
      previewImg.classList.add("hidden");
    }

    document.getElementById("docPreviewIcon")?.remove();
    document.getElementById("imagePreviewContainer")?.classList.add("hidden");
    document.getElementById("removeImageBtn")?.classList.add("hidden");

    const chatInput = document.getElementById("chatInput");
    if (chatInput) chatInput.setAttribute("required", "");
  },

  showLoading() {
    const box = document.getElementById("chatBox");
    const id = "loading-" + Date.now();
    loadingId = id;

    box.insertAdjacentHTML("beforeend", `
      <div id="${id}" class="flex gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white flex-shrink-0 shadow-md">
          <i class="fa-solid fa-robot text-xs sm:text-sm"></i>
        </div>
        <div class="bg-gray-100 dark:bg-gray-800 p-2.5 sm:p-3 rounded-2xl rounded-tl-none text-sm flex items-center gap-1">
          <span class="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0s"></span>
          <span class="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.15s"></span>
          <span class="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.3s"></span>
        </div>
      </div>
    `);
    this.scrollToBottom();
  },

  hideLoading() {
    if (loadingId) {
      document.getElementById(loadingId)?.remove();
      loadingId = null;
    }
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