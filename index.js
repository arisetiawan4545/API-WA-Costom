const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs'); // Modul tambahan untuk hapus cache otomatis

const app = express();
const SECRET_API_KEY = "mysehati-super-rahasia-2026";
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public')));

// Penanda status bot dan penyimpanan QR sementara
let isClientReady = false;
let qrCodeData = '';

// ==========================================
// 🛡️ SISTEM ANTI-CRASH & LOGGING WAKTU
// ==========================================
const logTime = () => `[${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}]`;

process.on('uncaughtException', (err) => {
    console.error(`${logTime()} 🚨 CRITICAL ERROR (Bypassed):`, err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error(`${logTime()} 🚨 PROMISE REJECTION (Bypassed):`, reason);
});

// ==========================================
// 🤖 INISIALISASI WHATSAPP BOT (ENTERPRISE GRADE)
// ==========================================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process', // Menghemat RAM server kecil
            '--disable-software-rasterizer',
            '--mute-audio'
        ]
    }
});

client.on('qr', (qr) => {
    console.log(`${logTime()} 🔄 Silakan scan QR Code di terminal atau web dashboard...`);
    qrcode.generate(qr, { small: true });
    qrCodeData = qr; 
});

client.once('ready', () => {
    console.log(`${logTime()} ✅ MANTAP! Sistem Notifikasi Sehati Care Plus ON & STABIL!`);
    isClientReady = true;
    qrCodeData = ''; 
});

// 🔄 FITUR AUTO-RECONNECT & SELF HEALING
client.on('disconnected', async (reason) => {
    console.log(`${logTime()} ❌ Client terputus dari WhatsApp Server:`, reason);
    isClientReady = false;
    qrCodeData = ''; 

    try {
        console.log(`${logTime()} 🔄 Menutup session secara aman...`);
        await client.destroy(); 
    } catch (error) {
        console.error(`${logTime()} ⚠️ Gagal destroy client:`, error.message);
    }

    // Jika diputus paksa (logout dari HP), hapus cache memori sampai bersih
    if (reason === 'NAVIGATION_FAIL_INTENDED' || reason === 'LOGOUT' || reason === 'CONFLICT') {
        console.log(`${logTime()} 🧹 Membersihkan folder cache sesi lama...`);
        const authPath = './.wwebjs_auth';
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }
    }

    console.log(`${logTime()} 🚀 Memulai sistem kebangkitan ulang dalam 5 detik...`);
    setTimeout(() => {
        client.initialize().catch(err => console.error('Gagal re-initialize:', err.message));
    }, 5000); 
});

// ==========================================
// 📨 LISTENER PESAN MASUK -> N8N
// ==========================================
client.on('message', async msg => {
    if (msg.from === 'status@broadcast') return;

    // 🛡️ Mencegah Bug @lid
    let senderId = msg.from;
    if (senderId.includes('@lid')) {
        try {
            const contact = await msg.getContact();
            if (contact && contact.id) senderId = contact.id._serialized; 
        } catch (err) {
            console.error(`${logTime()} ⚠️ Gagal konversi @lid:`, err.message);
        }
    }

    console.log(`${logTime()} 📥 Incoming Chat dari ${senderId}: ${msg.body}`);

    // URL n8n (Timeout Protection)
    const N8N_WEBHOOK_URL = 'http://localhost:8080/webhook/webhook-wa-mysehati'; 
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Batas 10 detik

    try {
        await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: senderId, message: msg.body }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log(`${logTime()} 🟢 Pesan sukses diteruskan ke n8n.`);
    } catch (error) {
        clearTimeout(timeoutId);
        console.error(`${logTime()} 🔴 Gagal ke n8n (Timeout/Error):`, error.message);
    }
});

client.initialize();

// ==========================================
// 🚦 SISTEM ANTREAN & HUMANIZER (ANTI-SPAM)
// ==========================================
const messageQueue = [];
let isProcessingQueue = false;

// Fungsi untuk membuat jeda (delay)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const processQueue = async () => {
    // Cegah eksekusi ganda jika antrean sedang diproses atau antrean kosong
    if (isProcessingQueue || messageQueue.length === 0) return;
    isProcessingQueue = true;

    while (messageQueue.length > 0) {
        // Ambil data paling depan dari array
        const { finalTarget, message, resolveObj, rejectObj } = messageQueue.shift();

        try {
            console.log(`${logTime()} ⚙️ [QUEUE] Memproses pesan untuk ${finalTarget}...`);
            
            // 1. Ambil objek chat dari kontak target
            const chat = await client.getChatById(finalTarget);
            
            // 2. Kirim status "Sedang mengetik..." (Humanizer)
            await chat.sendStateTyping();

            // 3. Beri jeda acak antara 2 hingga 4 detik
            const typingDelay = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000;
            await delay(typingDelay);

            // 4. Hapus status "Sedang mengetik..." lalu kirim pesan sungguhan
            await chat.clearState();
            await client.sendMessage(finalTarget, message);
            
            console.log(`${logTime()} 📤 [QUEUE] Outgoing Sukses ke ${finalTarget}`);
            
            // Beri respons sukses ke n8n (agar n8n tidak timeout menunggu)
            resolveObj({ status: true, message: 'Terkirim via Mysehati API-System (Queued & Humanized)' });

            // 5. Cooldown 1.5 detik sebelum memproses pesan CS selanjutnya
            await delay(1500);

        } catch (error) {
            console.error(`${logTime()} ❌ [QUEUE] Outgoing Gagal ke ${finalTarget}:`, error.message);
            rejectObj(error);
        }
    }

    isProcessingQueue = false;
};

// ==========================================
// 🌐 ROUTING DASHBOARD & API (ENTERPRISE)
// ==========================================

app.get('/api/status', (req, res) => {
    res.json({ 
        whatsapp_ready: isClientReady, 
        qr_code: qrCodeData,
        queue_length: messageQueue.length 
    });
});

// 🚨 ENDPOINT PANIC BUTTON (Hapus Cache Manual)
app.get('/api/reset', async (req, res) => {
    console.log(`${logTime()} 🚨 PERINTAH RESET DARURAT DITERIMA!`);
    try {
        await client.destroy();
        const authPath = './.wwebjs_auth';
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }
        res.json({ status: true, message: 'Sistem dibersihkan! Restarting...' });
        
        // Matikan node process agar PM2 otomatis menyalakannya dalam posisi "Fresh"
        setTimeout(() => process.exit(1), 2000);
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

// 📩 ENDPOINT PENERIMA PAYLOAD DARI N8N
app.post('/api/send-message', (req, res) => {
    const clientApiKey = req.headers['x-api-key'];

    if (!clientApiKey || clientApiKey !== SECRET_API_KEY) {
        console.warn(`${logTime()} 🛑 Akses ilegal terblokir!`);
        return res.status(401).json({ status: false, message: 'Unauthorized API Key!' });
    }

    if (!isClientReady) {
        return res.status(503).json({ status: false, message: 'Bot belum siap / disconnected.' });
    }

    const { target, message } = req.body;
    if (!target || !message) {
        return res.status(400).json({ status: false, message: 'Parameter tidak lengkap.' });
    }

    let finalTarget;
    if (target.includes('@')) {
        finalTarget = target; 
    } else {
        let formattedNumber = target.replace(/\D/g, ''); 
        if (formattedNumber.startsWith('0')) {
            formattedNumber = '62' + formattedNumber.substring(1);
        }
        finalTarget = `${formattedNumber}@c.us`; 
    }
    
    // Masukkan ke antrean (Queue) BUKAN eksekusi instan
    new Promise((resolve, reject) => {
        messageQueue.push({ finalTarget, message, resolveObj: resolve, rejectObj: reject });
        
        // Pelatuk untuk menyalakan mesin antrean (hanya jalan jika sedang berhenti)
        processQueue();
    })
    .then((result) => res.status(200).json(result))
    .catch((error) => res.status(500).json({ status: false, error: error.message }));
});

app.listen(PORT, () => {
    console.log(`🚀 Mysehati API-System (Enterprise Edition) berjalan di http://localhost:${PORT}`);
});