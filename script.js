// ================= KONFIGURASI JSONBIN.IO CLOUD STORAGE =================
const JSONBIN_BIN_ID = '6afa9545ac6210605a8aee85';
const JSONBIN_MASTER_KEY = '$2a$10$U9tcSsMWrN7sORyjG0YXleEcBs3RC.dgn6zr3IGD6o5q3toJYg29C';

const MAX_TOKEN_QUOTA = 400000;

let VALID_ACCOUNTS = [
    { username: 'franky', password: '123', remainingTokens: 400000 },
    { username: 'sayangku', password: '212', remainingTokens: 400000 },
    { username: 'lesley', password: 'ml', remainingTokens: 400000 },
    { username: 'mclaren', password: 'crypto', remainingTokens: 400000 },
    { username: 'neonvip', password: '2026', remainingTokens: 400000 }
];

const VIKEY_API_KEY = 'vk-983b3ce5-bc28-4c14-a635-afdd3703bff3';
const VIKEY_ENDPOINT = 'https://api.vikey.ai/v1/chat/completions';

let attachedFile = null;
let conversationHistory = [];
let currentChatId = null;
let savedSessions = JSON.parse(localStorage.getItem('neon_franky_sessions') || '[]');
let userMemories = JSON.parse(localStorage.getItem('neon_franky_memories') || '["Gunakan gaya bahasa santai, cerdas, dan langsung pada intinya."]');
let currentArtifactContent = '';

const AI_AVATAR_SVG = `
<svg viewBox="0 0 120 120" class="avatar-svg">
    <ellipse cx="60" cy="64" rx="52" ry="18" transform="rotate(-18 60 64)" fill="none" stroke="#00F5FF" stroke-width="5"/>
    <circle cx="60" cy="62" r="42" fill="#0B1120" stroke="#0EA5E9" stroke-width="4"/>
    <path d="M46 22 L51 11 L60 18 L69 11 L74 22 Z" fill="#FACC15"/>
    <rect x="34" y="34" width="52" height="38" rx="14" fill="#1E293B" stroke="#38BDF8" stroke-width="3"/>
    <rect x="40" y="40" width="40" height="26" rx="9" fill="#090D16"/>
    <path d="M46 54 Q51 46 56 54" fill="none" stroke="#00F5FF" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M64 54 Q69 46 74 54" fill="none" stroke="#00F5FF" stroke-width="4.5" stroke-linecap="round"/>
</svg>`;

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ================= SINKRONISASI KUOTA KE JSONBIN.IO =================
function isJsonBinConfigured() {
    return (
        JSONBIN_BIN_ID &&
        !JSONBIN_BIN_ID.includes('PASTE_') &&
        JSONBIN_MASTER_KEY &&
        !JSONBIN_MASTER_KEY.includes('PASTE_')
    );
}

async function syncAccountsFromServer() {
    if (isJsonBinConfigured()) {
        try {
            const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
                headers: {
                    'X-Master-Key': JSONBIN_MASTER_KEY,
                    'X-Bin-Meta': 'false'
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && typeof data === 'object') {
                    VALID_ACCOUNTS.forEach(acc => {
                        if (typeof data[acc.username] === 'number') {
                            acc.remainingTokens = data[acc.username];
                        }
                    });
                    localStorage.setItem('neon_franky_accounts_cache', JSON.stringify(VALID_ACCOUNTS));
                    updateQuotaBadge();
                    return;
                }
            }
        } catch (e) {}
    }

    const cached = localStorage.getItem('neon_franky_accounts_cache');
    if (cached) VALID_ACCOUNTS = JSON.parse(cached);
    updateQuotaBadge();
}

function getCurrentUsername() {
    return sessionStorage.getItem('neon_franky_user') || 'guest';
}

function getRemainingTokens() {
    const user = getCurrentUsername();
    const acc = VALID_ACCOUNTS.find(a => a.username === user);
    return acc ? Math.max(0, acc.remainingTokens) : 0;
}

async function addUsedTokens(username, tokensAdded) {
    const acc = VALID_ACCOUNTS.find(a => a.username === username);
    if (!acc) return;

    acc.remainingTokens = Math.max(0, acc.remainingTokens - tokensAdded);
    localStorage.setItem('neon_franky_accounts_cache', JSON.stringify(VALID_ACCOUNTS));
    updateQuotaBadge();

    // Update langsung ke JSONBin.io agar tersimpan permanen di cloud
    if (isJsonBinConfigured()) {
        try {
            const payload = {};
            VALID_ACCOUNTS.forEach(a => {
                payload[a.username] = a.remainingTokens;
            });

            await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_MASTER_KEY
                },
                body: JSON.stringify(payload)
            });
        } catch (e) {}
    }
}

function updateQuotaBadge() {
    const user = getCurrentUsername();
    const remaining = getRemainingTokens();
    const badge = document.getElementById('loggedUserBadge');
    const topBadge = document.getElementById('topQuotaBadge');

    if (badge) {
        badge.innerText = `@${user} • Sisa ${remaining.toLocaleString('id-ID')} token`;
        badge.style.color = remaining <= 20000 ? '#f87171' : 'var(--accent-cyan)';
    }
    if (topBadge) {
        topBadge.innerText = `${Math.round(remaining / 1000)}K token`;
        topBadge.style.color = remaining <= 20000 ? '#f87171' : 'var(--accent-cyan)';
    }
}

// ================= INISIALISASI, RESPONSIVE HP/LAPTOP & LOGIN =================
function applyInitialResponsiveState() {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('openSidebarBtn');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
        openBtn.classList.remove('hidden');
        if (backdrop) backdrop.classList.add('hidden');
    } else {
        sidebar.classList.remove('collapsed');
        openBtn.classList.add('hidden');
        if (backdrop) backdrop.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    applyInitialResponsiveState();
    await syncAccountsFromServer();
    checkAuthStatus();

    const savedModel = localStorage.getItem('neon_franky_model');
    if (savedModel) document.getElementById('modelSelect').value = savedModel;
    renderHistorySidebar();
    updateMemoryUI();
});

function checkAuthStatus() {
    const isLoggedIn = sessionStorage.getItem('neon_franky_auth') === 'true';

    if (isLoggedIn) {
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        updateQuotaBadge();
    } else {
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    await syncAccountsFromServer();

    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const errorBox = document.getElementById('loginError');

    const matchedAccount = VALID_ACCOUNTS.find(
        acc => acc.username === user && acc.password === pass
    );

    if (matchedAccount) {
        sessionStorage.setItem('neon_franky_auth', 'true');
        sessionStorage.setItem('neon_franky_user', matchedAccount.username);
        errorBox.classList.add('hidden');
        checkAuthStatus();
    } else {
        errorBox.innerText = 'Username atau password tidak terdaftar!';
        errorBox.classList.remove('hidden');
    }
}

function handleLogout() {
    sessionStorage.removeItem('neon_franky_auth');
    sessionStorage.removeItem('neon_franky_user');
    document.getElementById('loginPass').value = '';
    checkAuthStatus();
}

document.getElementById('modelSelect').addEventListener('change', (e) => {
    localStorage.setItem('neon_franky_model', e.target.value);
});

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('openSidebarBtn');
    const backdrop = document.getElementById('sidebarBackdrop');

    const isCollapsed = sidebar.classList.toggle('collapsed');
    openBtn.classList.toggle('hidden', !isCollapsed);

    if (backdrop) {
        if (window.innerWidth <= 768 && !isCollapsed) {
            backdrop.classList.remove('hidden');
        } else {
            backdrop.classList.add('hidden');
        }
    }
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function selectModule(mode, samplePrompt) {
    document.getElementById('workMode').value = mode;
    const input = document.getElementById('userInput');
    input.value = samplePrompt;
    autoResize(input);
    sendMessage();
}

function triggerFileUpload(acceptTypes) {
    document.getElementById('workMode').value = 'document';
    const fileInput = document.getElementById('fileInput');
    fileInput.accept = acceptTypes;
    fileInput.click();
}

// ================= 10. AI MEMORY MANAGER =================
function openMemoryModal() {
    document.getElementById('memoryModal').classList.remove('hidden');
    updateMemoryUI();
}

function closeMemoryModal() {
    document.getElementById('memoryModal').classList.add('hidden');
}

function addManualMemory() {
    const input = document.getElementById('newMemoryInput');
    const val = input.value.trim();
    if (!val) return;
    userMemories.push(val);
    localStorage.setItem('neon_franky_memories', JSON.stringify(userMemories));
    input.value = '';
    updateMemoryUI();
}

function deleteMemory(index) {
    userMemories.splice(index, 1);
    localStorage.setItem('neon_franky_memories', JSON.stringify(userMemories));
    updateMemoryUI();
}

function updateMemoryUI() {
    const countEl = document.getElementById('memoryCount');
    if (countEl) countEl.innerText = userMemories.length;

    const listEl = document.getElementById('memoryList');
    if (!listEl) return;
    listEl.innerHTML = userMemories.map((m, idx) => `
        <div class="memory-item">
            <span>• ${m}</span>
            <button type="button" class="history-btn del" onclick="deleteMemory(${idx})">✕</button>
        </div>
    `).join('');
}

// ================= 5. AI VOICE =================
function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Browser tidak mendukung Speech Recognition. Gunakan Chrome atau Edge.');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;

    const micBtn = document.getElementById('micBtn');
    micBtn.classList.add('recording');

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const input = document.getElementById('userInput');
        input.value = transcript;
        autoResize(input);
        micBtn.classList.remove('recording');
        sendMessage();
    };

    recognition.onerror = () => micBtn.classList.remove('recording');
    recognition.onend = () => micBtn.classList.remove('recording');
    recognition.start();
}

function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/[#*`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 600));
    utterance.lang = 'id-ID';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
}

// ================= FILE UPLOAD HANDLER =================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        attachedFile = file;
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        document.getElementById('fileName').innerText = `📄 ${file.name} (${sizeMB} MB)`;
        document.getElementById('filePreview').classList.remove('hidden');
    }
}

function clearFile() {
    attachedFile = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInput').accept = '';
    document.getElementById('filePreview').classList.add('hidden');
}

// ================= SYSTEM PROMPTS RINGKAS & CEPAT =================
function buildSystemPrompt(mode) {
    const memoryContext = userMemories.length > 0
        ? `\n[MEMORI USER]: ${userMemories.join(' | ')}`
        : '';

    const baseTools = `
Tools JSON murni (tanpa teks tambahan jika memanggil tool):
- Math: {"tool":"math_eval","expression":"mean([10,20])","reason":"Hitung"}
- PPT: {"tool":"create_ppt","topic":"Judul Topik","reason":"Buat PPT"}
- Gambar: {"tool":"create_image","prompt":"detailed english prompt, 8k","reason":"Buat gambar"}
- Grafik: {"tool":"create_chart","chartType":"bar","title":"Judul","labels":["A","B"],"values":[10,20],"reason":"Grafik"}
- Memori: {"tool":"save_memory","fact":"Fakta penting","reason":"Simpan memori"}`;

    switch (mode) {
        case 'general':
            return `Kamu adalah Neon Franky. Jawab cepat, cerdas, dan langsung ke inti dalam Bahasa Indonesia.${memoryContext}`;
        case 'image':
            return `Ubah deskripsi gambar ke Bahasa Inggris artistik dan balas HANYA JSON: {"tool":"create_image","prompt":"english prompt","reason":"Buat gambar"}`;
        case 'coding':
            return `Kamu adalah Neon Franky (Expert Coder). Tulis kode bersih & siap jalan. Bungkus HTML lengkap dalam \`\`\`html ... \`\`\` untuk Live Artifact.${memoryContext}`;
        case 'research':
            return `Kamu adalah Neon Franky (Research Analyst). Berikan riset terstruktur, tajam, dan lengkap dalam Bahasa Indonesia.${memoryContext}`;
        case 'document':
            return `Kamu adalah Neon Franky (Document Reader). Rangkum dan jawab pertanyaan berdasarkan isi file PDF/Word user secara akurat.${memoryContext}`;
        case 'translator':
            return `Kamu adalah Neon Franky (Translator). Terjemahkan teks secara alami dan akurat sesuai konteks bahasa tujuan.${memoryContext}`;
        case 'analyst':
            return `Kamu adalah Neon Franky (Data Analyst). Analisis statistik secara presisi. Gunakan tool math_eval atau create_chart jika perlu.${memoryContext}${baseTools}`;
        case 'automation':
            return `Kamu adalah Neon Franky (Automation AI). Otomatiskan pembuatan PPT (create_ppt), SOP, atau template kerja.${memoryContext}${baseTools}`;
        default:
            return `Kamu adalah Neon Franky, AI serba bisa.${memoryContext}${baseTools}
Jawab langsung & rapi dalam Bahasa Indonesia (atau bungkus HTML dalam \`\`\`html ... \`\`\`).`;
    }
}

// ================= KIRIM PESAN & STREAMING REAL-TIME =================
async function sendMessage() {
    if (getRemainingTokens() <= 0) {
        alert(`Kuota akun @${getCurrentUsername()} sudah mencapai batas maksimal 400.000 token!`);
        return;
    }

    const selectedModel = document.getElementById('modelSelect').value;
    const modelLabel = document.getElementById('modelSelect').options[document.getElementById('modelSelect').selectedIndex].text;
    const workMode = document.getElementById('workMode').value;
    const modeLabel = document.getElementById('workMode').options[document.getElementById('workMode').selectedIndex].text;
    const inputField = document.getElementById('userInput');
    const prompt = inputField.value.trim();

    if (!prompt && !attachedFile) return;

    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.remove();

    const displayUserText = prompt || `[Mengirim file: ${attachedFile.name}]`;
    appendMessage('user', displayUserText);
    inputField.value = '';
    inputField.style.height = 'auto';

    if (!currentChatId) {
        currentChatId = 'chat_' + Date.now();
        savedSessions.unshift({
            id: currentChatId,
            title: displayUserText.slice(0, 32),
            pinned: false,
            messages: []
        });
    }

    const currentFile = attachedFile;
    clearFile();

    const tagTitle = `${modelLabel} • ${modeLabel}`;
    appendMessage('ai', `<span style="color:var(--accent-cyan);">⚡ Mengetik...</span>`, tagTitle);

    try {
        let userContent = [];
        const baseText = prompt || 'Tolong analisis dan rangkum isi file ini secara lengkap.';

        if (!currentFile) {
            userContent = baseText;
        } else if (currentFile.type.startsWith('image/')) {
            updateAgentSteps(['🖼️ Memproses gambar...']);
            const base64Image = await fileToBase64(currentFile);
            userContent = [
                { type: 'text', text: baseText },
                { type: 'image_url', image_url: { url: base64Image } }
            ];
        } else if (currentFile.type.startsWith('video/')) {
            updateAgentSteps(['🎬 Mengekstrak frame video...']);
            const frames = await extractVideoFrames(currentFile);
            userContent = [
                { type: 'text', text: `${baseText}\n(4 frame berurutan dari video user)` },
                ...frames.map(url => ({ type: 'image_url', image_url: { url } }))
            ];
        } else if (currentFile.type === 'application/pdf') {
            updateAgentSteps(['📄 Membaca PDF...']);
            const pdfText = await extractPdfText(currentFile);
            userContent = `${baseText}\n\n=== ISI PDF (${currentFile.name}) ===\n${pdfText.slice(0, 25000)}`;
        } else if (currentFile.name.endsWith('.docx')) {
            updateAgentSteps(['📝 Membaca Word (.docx)...']);
            const wordText = await extractWordText(currentFile);
            userContent = `${baseText}\n\n=== ISI WORD (${currentFile.name}) ===\n${wordText.slice(0, 25000)}`;
        } else {
            updateAgentSteps([`📂 Membaca ${currentFile.name}...`]);
            const rawText = await currentFile.text();
            userContent = `${baseText}\n\n=== ISI FILE (${currentFile.name}) ===\n${rawText.slice(0, 25000)}`;
        }

        conversationHistory.push({ role: 'user', content: userContent });
        if (conversationHistory.length > 6) conversationHistory = conversationHistory.slice(-6);

        await runExecutionLoop(selectedModel, tagTitle, workMode, displayUserText);

    } catch (error) {
        updateLastAIMessage(`❌ Error: ${error.message}`, tagTitle);
    }
}

async function runExecutionLoop(model, tagTitle, workMode, lastUserText) {
    let stepsLog = [];
    const maxIterations = 3;
    const systemPrompt = buildSystemPrompt(workMode);
    const activeUser = getCurrentUsername();

    for (let step = 1; step <= maxIterations; step++) {
        const remainingNow = getRemainingTokens();
        if (remainingNow <= 0) {
            updateLastAIMessage(`⛔ Kuota 400.000 token untuk akun <b>@${activeUser}</b> telah habis.`, tagTitle);
            return;
        }

        const trimmedHistory = conversationHistory.slice(-4);
        const payloadMessages = [{ role: 'system', content: systemPrompt }, ...trimmedHistory];

        const response = await fetch(VIKEY_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${VIKEY_API_KEY}`
            },
            body: JSON.stringify({
                model: model,
                messages: payloadMessages,
                max_tokens: Math.min(3000, remainingNow),
                temperature: workMode === 'coding' ? 0.15 : 0.3,
                stream: true
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let aiRawReply = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                const dataStr = trimmed.slice(6);
                if (dataStr === '[DONE]') break;

                try {
                    const parsed = JSON.parse(dataStr);
                    const delta = parsed.choices?.[0]?.delta?.content || '';
                    if (delta) {
                        aiRawReply += delta;
                        if (!aiRawReply.trim().startsWith('{')) {
                            updateLastAIMessage(formatText(aiRawReply), tagTitle);
                        }
                    }
                } catch (e) {}
            }
        }

        aiRawReply = aiRawReply.trim();

        const estimatedTokens = Math.ceil((JSON.stringify(payloadMessages).length + aiRawReply.length) / 4);
        await addUsedTokens(activeUser, estimatedTokens);

        const toolCall = parseToolCall(aiRawReply);

        if (toolCall) {
            stepsLog.push(`⚙️ <b>Modul (${toolCall.tool}):</b> ${toolCall.reason || 'Menjalankan fungsi'}`);
            updateAgentSteps(stepsLog);

            if (toolCall.tool === 'math_eval') {
                const res = executeMathTool(toolCall.expression);
                stepsLog.push(`🧮 <b>Math Engine:</b> <code>${toolCall.expression}</code> = <b>${res}</b>`);
                updateAgentSteps(stepsLog);
                conversationHistory.push({ role: 'assistant', content: aiRawReply });
                conversationHistory.push({ role: 'user', content: `[OBSERVATION]: Hasil eksak: ${res}. Jelaskan analisisnya.` });
                continue;
            }

            if (toolCall.tool === 'create_chart') {
                const chartId = 'chart_' + Date.now();
                const stepsHTML = `<div class="agent-steps">${stepsLog.map(s => `<div>${s}</div>`).join('')}</div>`;
                const html = `${stepsHTML}<b>📊 Visualisasi Data: ${toolCall.title}</b><div class="chart-container-box"><canvas id="${chartId}"></canvas></div>`;
                updateLastAIMessage(html, tagTitle);
                renderChartCanvas(chartId, toolCall);
                saveSessionData(lastUserText, `[Grafik Data: ${toolCall.title}]`, tagTitle);
                return;
            }

            if (toolCall.tool === 'save_memory') {
                userMemories.push(toolCall.fact);
                localStorage.setItem('neon_franky_memories', JSON.stringify(userMemories));
                updateMemoryUI();
                const html = `🧠 <b>Tersimpan di AI Memory:</b> "${toolCall.fact}"`;
                updateLastAIMessage(html, tagTitle);
                saveSessionData(lastUserText, html, tagTitle);
                return;
            }

            if (toolCall.tool === 'create_ppt') {
                await generatePPT(toolCall.topic, model, tagTitle, stepsLog);
                saveSessionData(lastUserText, `[Presentasi PPT: ${toolCall.topic}]`, tagTitle);
                return;
            }

            if (toolCall.tool === 'create_image') {
                await generateImage(toolCall.prompt, tagTitle, stepsLog);
                saveSessionData(lastUserText, `[Gambar dibuat: ${toolCall.prompt}]`, tagTitle);
                return;
            }
        }

        const htmlMatch = aiRawReply.match(/```html([\s\S]*?)```/i);
        let artifactBtnHTML = '';
        if (htmlMatch && htmlMatch[1]) {
            openArtifact(htmlMatch[1].trim(), 'Live Code Preview');
            artifactBtnHTML = `<br><button type="button" class="artifact-card-btn" onclick="toggleArtifactPanel()">◈ Buka Live Preview di Artifact Panel</button>`;
        }

        conversationHistory.push({ role: 'assistant', content: aiRawReply });
        const stepsHTML = stepsLog.length > 0
            ? `<div class="agent-steps">${stepsLog.map(s => `<div>${s}</div>`).join('')}</div>`
            : '';

        const finalHTML = `${stepsHTML}${formatText(aiRawReply)}${artifactBtnHTML}`;
        updateLastAIMessage(finalHTML, tagTitle, aiRawReply);
        saveSessionData(lastUserText, finalHTML, tagTitle);

        if (document.getElementById('autoSpeakToggle').checked) {
            speakText(aiRawReply);
        }
        return;
    }
}

// ================= RENDER GRAFIK DATA ANALYST =================
function renderChartCanvas(canvasId, chartData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    new Chart(ctx, {
        type: chartData.chartType || 'bar',
        data: {
            labels: chartData.labels || [],
            datasets: [{
                label: chartData.title || 'Data',
                data: chartData.values || [],
                backgroundColor: 'rgba(14, 165, 233, 0.6)',
                borderColor: '#00F5FF',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#F1F5F9' } } },
            scales: {
                x: { ticks: { color: '#94A3B8' } },
                y: { ticks: { color: '#94A3B8' } }
            }
        }
    });
}

// ================= EKSTRAKTOR WORD & PDF =================
async function extractWordText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    return result.value || '';
}

async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 20);
    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += `\n[Halaman ${i}]\n` + content.items.map(item => item.str).join(' ');
    }
    return fullText;
}

// ================= PPT GENERATOR =================
async function generatePPT(topic, model, tagTitle, stepsLog = []) {
    try {
        const cleanTopic = topic.replace(/bikin ppt|buat ppt|buatkan powerpoint|presentasi/gi, '').trim() || 'Materi Presentasi';
        const systemPrompt = `Buat materi presentasi PowerPoint terstruktur untuk topik: "${cleanTopic}".
Minimal 4 slide pembahasan. Setiap slide wajib memiliki "title" dan "bullets" (3-4 poin kalimat lengkap).
Balas HANYA JSON valid:
{"title": "Judul", "subtitle": "Subjudul", "slides": [{"title": "Slide 1", "bullets": ["Poin 1", "Poin 2", "Poin 3"]}]}`;

        const response = await fetch(VIKEY_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VIKEY_API_KEY}` },
            body: JSON.stringify({ model: model, messages: [{ role: 'user', content: systemPrompt }], temperature: 0.3 })
        });

        const data = await response.json();
        let rawText = data.choices[0].message.content;
        await addUsedTokens(getCurrentUsername(), data.usage?.total_tokens || Math.ceil(rawText.length / 3));

        const jsonStart = rawText.indexOf('{');
        const jsonEnd = rawText.lastIndexOf('}');
        const pptData = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));

        const pres = new PptxGenJS();
        pres.layout = 'LAYOUT_16x9';

        const cover = pres.addSlide();
        cover.background = { color: '12151C' };
        cover.addText(pptData.title || cleanTopic, { x: 0.8, y: 2.1, w: '85%', fontSize: 34, bold: true, color: 'F1F5F9' });
        cover.addText(pptData.subtitle || 'Disusun oleh Neon Franky AI', { x: 0.8, y: 3.3, w: '85%', fontSize: 18, color: '00F5FF' });

        const validSlides = (pptData.slides || []).filter(s => s.title && Array.isArray(s.bullets) && s.bullets.length > 0);
        validSlides.forEach((s, idx) => {
            const slide = pres.addSlide();
            slide.background = { color: 'F8FAFC' };
            slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: '0EA5E9' } });
            slide.addText(`${idx + 1}. ${s.title}`, { x: 0.6, y: 0.45, w: '88%', fontSize: 22, bold: true, color: '0F172A' });
            const bulletItems = s.bullets.map(b => ({ text: String(b), options: { bullet: true, breakLine: true } }));
            slide.addText(bulletItems, { x: 0.6, y: 1.35, w: '88%', h: 3.8, fontSize: 16, color: '334155', lineSpacing: 26, valign: 'top' });
        });

        const safeName = (pptData.title || cleanTopic).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
        await pres.writeFile({ fileName: `PPT_${safeName}.pptx` });

        const stepsHTML = stepsLog.length > 0 ? `<div class="agent-steps">${stepsLog.map(s => `<div>${s}</div>`).join('')}</div>` : '';
        updateLastAIMessage(`${stepsHTML}✅ Presentasi <b>"${pptData.title}"</b> (${validSlides.length + 1} slide) berhasil dibuat dan ter-download.`, tagTitle);
    } catch (error) {
        updateLastAIMessage(`❌ Gagal bikin PPT: ${error.message}`, tagTitle);
    }
}

// ================= IMAGE GENERATOR =================
async function generateImage(prompt, tagTitle, stepsLog = []) {
    const encoded = encodeURIComponent(prompt || 'futuristic neon blue robot, 8k');
    const seed = Math.floor(Math.random() * 999999);
    const endpoints = [
        `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`,
        `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&seed=${seed}&model=turbo&nologo=true`
    ];

    const stepsHTML = stepsLog.length > 0 ? `<div class="agent-steps">${stepsLog.map(s => `<div>${s}</div>`).join('')}</div>` : '';
    let loadedBlobUrl = null;

    for (let url of endpoints) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 16000);
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (response.ok) {
                const blob = await response.blob();
                if (blob.size > 1000 && blob.type.startsWith('image/')) {
                    loadedBlobUrl = URL.createObjectURL(blob);
                    break;
                }
            }
        } catch (e) {}
    }

    if (loadedBlobUrl) {
        const html = `${stepsHTML}Gambar untuk <b>"${prompt}"</b>:<br><img src="${loadedBlobUrl}" class="generated-img" onload="scrollToBottom()"><a href="${loadedBlobUrl}" download="NeonFranky_${seed}.jpg" class="btn-download-img">⬇️ Download Gambar</a>`;
        updateLastAIMessage(html, tagTitle);
    } else {
        const html = `${stepsHTML}Gambar untuk <b>"${prompt}"</b>:<br><img src="${endpoints[0]}" class="generated-img" onload="scrollToBottom()" onerror="this.outerHTML='<div class=\\'math-box\\'>⚠️ Server render gambar sedang sibuk, silakan coba lagi.</div>'">`;
        updateLastAIMessage(html, tagTitle);
    }
}

// ================= PINNED & HISTORY MANAGER =================
function startNewChat() {
    currentChatId = null;
    conversationHistory = [];
    clearFile();
    closeArtifactPanel();
    location.reload();
}

function saveSessionData(userText, aiHtml, modelLabel) {
    const session = savedSessions.find(s => s.id === currentChatId);
    if (session) {
        session.messages.push({ role: 'user', html: userText });
        session.messages.push({ role: 'ai', html: aiHtml, model: modelLabel });
        if (savedSessions.length > 25) savedSessions = savedSessions.slice(0, 25);
        localStorage.setItem('neon_franky_sessions', JSON.stringify(savedSessions));
        renderHistorySidebar();
    }
}

function togglePinSession(event, id) {
    event.stopPropagation();
    const session = savedSessions.find(s => s.id === id);
    if (session) {
        session.pinned = !session.pinned;
        localStorage.setItem('neon_franky_sessions', JSON.stringify(savedSessions));
        renderHistorySidebar();
    }
}

function renderHistorySidebar() {
    const pinnedSection = document.getElementById('pinnedSection');
    const pinnedList = document.getElementById('pinnedList');
    const historyList = document.getElementById('historyList');
    if (!historyList || !pinnedList) return;

    const pinnedItems = savedSessions.filter(s => s.pinned);
    const regularItems = savedSessions.filter(s => !s.pinned);

    if (pinnedItems.length > 0) {
        pinnedSection.classList.remove('hidden');
        pinnedList.innerHTML = pinnedItems.map(s => createHistoryItemHTML(s)).join('');
    } else {
        pinnedSection.classList.add('hidden');
    }
    historyList.innerHTML = regularItems.map(s => createHistoryItemHTML(s)).join('');
}

function createHistoryItemHTML(s) {
    return `
        <div class="history-item ${s.id === currentChatId ? 'active' : ''}" onclick="loadSession('${s.id}')">
            <span class="history-title">${s.title}</span>
            <div class="history-actions">
                <button type="button" class="history-btn ${s.pinned ? 'pinned' : ''}" onclick="togglePinSession(event, '${s.id}')" title="Sematkan">📌</button>
                <button type="button" class="history-btn del" onclick="deleteSession(event, '${s.id}')" title="Hapus">✕</button>
            </div>
        </div>
    `;
}

function loadSession(id) {
    const session = savedSessions.find(s => s.id === id);
    if (!session) return;
    currentChatId = id;
    conversationHistory = [];
    const container = document.getElementById('chatContainer');
    container.innerHTML = '';
    session.messages.forEach(m => appendMessage(m.role, m.html, m.model || ''));
    renderHistorySidebar();
    if (window.innerWidth <= 768) toggleSidebar();
}

function deleteSession(event, id) {
    event.stopPropagation();
    savedSessions = savedSessions.filter(s => s.id !== id);
    localStorage.setItem('neon_franky_sessions', JSON.stringify(savedSessions));
    if (currentChatId === id) startNewChat();
    else renderHistorySidebar();
}

// ================= ARTIFACT & UI HELPERS =================
function openArtifact(code, title = 'Live Artifact') {
    currentArtifactContent = code;
    document.getElementById('artifactTitle').innerText = title;
    document.getElementById('artifactPanel').classList.remove('hidden');
    document.getElementById('toggleArtifactBtn').classList.remove('hidden');
    document.getElementById('artifactCodeView').textContent = code;
    document.getElementById('artifactPreviewFrame').srcdoc = code;
    switchArtifactTab('preview');
}

function toggleArtifactPanel() { document.getElementById('artifactPanel').classList.toggle('hidden'); }
function closeArtifactPanel() { document.getElementById('artifactPanel').classList.add('hidden'); }
function switchArtifactTab(tab) {
    const isPreview = tab === 'preview';
    document.getElementById('artifactPreviewFrame').classList.toggle('hidden', !isPreview);
    document.getElementById('artifactCodeView').classList.toggle('hidden', isPreview);
    document.getElementById('tabPreview').classList.toggle('active', isPreview);
    document.getElementById('tabCode').classList.toggle('active', !isPreview);
}
function copyArtifactCode() { navigator.clipboard.writeText(currentArtifactContent); alert('Kode disalin!'); }
function downloadArtifact() {
    const blob = new Blob([currentArtifactContent], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `NeonFranky_${Date.now()}.html`;
    a.click();
}

function executeMathTool(expr) {
    try { return String(math.evaluate(expr)); } catch (e) { return `Error (${e.message})`; }
}

function parseToolCall(text) {
    try {
        const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
            const parsed = JSON.parse(cleaned);
            if (parsed.tool) return parsed;
        }
    } catch (e) {}
    return null;
}

function extractVideoFrames(videoFile) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const frames = [];
        video.preload = 'metadata';
        video.muted = true;
        video.src = URL.createObjectURL(videoFile);
        video.onloadedmetadata = async () => {
            canvas.width = Math.min(video.videoWidth, 720);
            canvas.height = (video.videoHeight / video.videoWidth) * canvas.width;
            const d = video.duration || 1;
            for (let t of [d * 0.1, d * 0.4, d * 0.7, d * 0.9]) {
                await new Promise((res) => {
                    video.currentTime = t;
                    video.onseeked = () => {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        frames.push(canvas.toDataURL('image/jpeg', 0.7));
                        res();
                    };
                });
            }
            URL.revokeObjectURL(video.src);
            resolve(frames);
        };
    });
}

function updateAgentSteps(stepsArray) {
    const bubbles = document.querySelectorAll('.message.ai .bubble');
    if (bubbles.length > 0) {
        const lastBubble = bubbles[bubbles.length - 1];
        const tag = lastBubble.querySelector('.model-tag')?.outerHTML || '';
        lastBubble.innerHTML = `${tag}<div class="agent-steps">${stepsArray.map(s => `<div>${s}</div>`).join('')}</div>`;
        scrollToBottom();
    }
}

function appendMessage(role, htmlText, modelTag = '') {
    const container = document.getElementById('chatContainer');
    const avatarContent = role === 'user' ? 'U' : AI_AVATAR_SVG;
    const tagHTML = (role === 'ai' && modelTag) ? `<div class="model-tag">${modelTag}</div>` : '';
    container.insertAdjacentHTML('beforeend', `
        <div class="message ${role}">
            <div class="avatar">${avatarContent}</div>
            <div class="bubble">${tagHTML}<div class="msg-content">${htmlText}</div></div>
        </div>
    `);
    scrollToBottom();
}

function updateLastAIMessage(htmlText, modelTag = '', rawCopyText = '') {
    const bubbles = document.querySelectorAll('.message.ai .bubble');
    if (bubbles.length > 0) {
        const tagHTML = modelTag ? `<div class="model-tag">${modelTag}</div>` : '';
        const actionButtons = rawCopyText ? `
            <div class="msg-actions">
                <button type="button" class="msg-action-btn" onclick="copyTextFromBubble(this)">📋 Copy</button>
                <button type="button" class="msg-action-btn" onclick="speakTextFromBubble(this)">🔊 Dengarkan</button>
            </div>
        ` : '';
        bubbles[bubbles.length - 1].innerHTML = `${tagHTML}<div class="msg-content">${htmlText}</div>${actionButtons}`;
    }
    scrollToBottom();
}

function copyTextFromBubble(btn) {
    const content = btn.closest('.bubble').querySelector('.msg-content').innerText;
    navigator.clipboard.writeText(content);
    btn.innerText = '✅ Copied';
    setTimeout(() => { btn.innerText = '📋 Copy'; }, 1500);
}

function speakTextFromBubble(btn) {
    const content = btn.closest('.bubble').querySelector('.msg-content').innerText;
    speakText(content);
}

function scrollToBottom() {
    const container = document.getElementById('chatContainer');
    container.scrollTop = container.scrollHeight;
}

function formatText(text) {
    return text
        .replace(/```[\w]*\n([\s\S]*?)```/g, '<div class="math-box">$1</div>')
        .replace(/`([^`]+)`/g, '<code style="background:var(--bg-sidebar);padding:2px 6px;border-radius:5px;color:var(--accent-cyan);">$1</code>')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}