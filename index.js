const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

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
// 🤖 INISIALISASI WHATSAPP BOT (STEALTH MODE)
// ==========================================
const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
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
            '--single-process', 
            '--disable-software-rasterizer',
            '--mute-audio',
            // 🕵️ STEALTH INJECTION: Menyembunyikan identitas Bot
            '--disable-blink-features=AutomationControlled',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        ]
    }
});

client.on('qr', (qr) => {
    console.log(`${logTime()} 🔄 Silakan scan QR Code di terminal atau web dashboard...`);
    qrcode.generate(qr, { small: true });
    qrCodeData = qr; 
});

client.once('ready', () => {
    console.log(`${logTime()} ✅ MANTAP! Sistem Notifikasi Sehati Care Plus ON & STABIL (Stealth Mode Active)!`);
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

    const N8N_WEBHOOK_URL = 'http://localhost:8080/webhook/webhook-wa-mysehati'; 
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); 

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
// 🚦 SISTEM ANTREAN & HUMANIZER LENGKAP
// ==========================================
const messageQueue = [];
let isProcessingQueue = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const processQueue = async () => {
    if (isProcessingQueue || messageQueue.length === 0) return;
    isProcessingQueue = true;

    while (messageQueue.length > 0) {
        const { finalTarget, message, resolveObj, rejectObj } = messageQueue.shift();

        try {
            console.log(`${logTime()} ⚙️ [QUEUE] Memproses pesan untuk ${finalTarget}...`);
            
            // 1. Ambil objek chat
            const chat = await client.getChatById(finalTarget);
            
            // 🕵️ PRESENCE SPOOFING: Simulasi buka HP & buka obrolan
            console.log(`${logTime()} 👻 [STEALTH] Simulasi human presence & open chat...`);
            await client.sendPresenceAvailable(); // Bikin online
            await chat.sendSeen(); // Centang biru chat sebelumnya (jika ada)

            // Jeda mikir sejenak seolah sedang membaca (1 - 2 detik)
            await delay(Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000);

            // 2. Mulai ngetik
            await chat.sendStateTyping();

            // 3. Jeda ngetik acak (2 - 5 detik tergantung panjang pesan)
            // Rumus canggih: Makin panjang teks, makin lama delay ngetiknya (maksimal 6 detik)
            let dynamicDelay = message.length * 40; 
            if (dynamicDelay < 2000) dynamicDelay = 2500;
            if (dynamicDelay > 6000) dynamicDelay = 6000;
            
            const finalTypingDelay = Math.floor(Math.random() * (dynamicDelay - (dynamicDelay - 500) + 1)) + (dynamicDelay - 500);
            await delay(finalTypingDelay);
            
            // 🔍 DEBUGGING LOGS
            console.log(`${logTime()} 🔍 DEBUG: Tipe data pesan -> ${typeof message}`);
            
            // 4. Kirim pesan
            const sendResult = await client.sendMessage(finalTarget, message);
            
            const msgId = sendResult.id ? (sendResult.id._serialized || sendResult.id.id) : 'ID-TIDAK-TERBACA';
            console.log(`${logTime()} 📤 [QUEUE] Outgoing Sukses! ID Pesan WA: ${msgId}`);
            
            resolveObj({ status: true, message: 'Terkirim via Mysehati API-System (Stealth Queued)' });

            // 5. Cooldown acak antar antrean (1.5 - 3 detik) agar tidak berpola robot
            const cooldown = Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500;
            await delay(cooldown);

        } catch (error) {
            console.error(`${logTime()} ❌ [QUEUE] Outgoing Gagal ke ${finalTarget}:`, error.message);
            rejectObj(error);
        }
    }

    isProcessingQueue = false;
};

// ==========================================
// 🌐 ROUTING DASHBOARD & API 
// ==========================================
app.get('/api/status', (req, res) => {
    res.json({ 
        whatsapp_ready: isClientReady, 
        qr_code: qrCodeData,
        queue_length: messageQueue.length 
    });
});

app.get('/api/reset', async (req, res) => {
    console.log(`${logTime()} 🚨 PERINTAH RESET DARURAT DITERIMA!`);
    try {
        await client.destroy();
        const authPath = './.wwebjs_auth';
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }
        res.json({ status: true, message: 'Sistem dibersihkan! Restarting...' });
        
        setTimeout(() => process.exit(1), 2000);
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

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
    
    new Promise((resolve, reject) => {
        messageQueue.push({ finalTarget, message, resolveObj: resolve, rejectObj: reject });
        processQueue();
    })
    .then((result) => res.status(200).json(result))
    .catch((error) => res.status(500).json({ status: false, error: error.message }));
});

app.listen(PORT, () => {
    console.log(`🚀 Mysehati API-System (Stealth Edition) berjalan di http://localhost:${PORT}`);
});