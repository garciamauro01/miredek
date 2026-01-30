import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Configuração do Multer para salvar na pasta public
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Se for o exe, usamos o nome fixo. Se for o json, usamos version.json
        if (file.fieldname === 'exe') {
            cb(null, 'MireDesk-Setup.exe');
        } else {
            cb(null, 'version.json');
        }
    }
});

const upload = multer({ storage: storage });

// CORS para permitir requisições do frontend
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-update-token');
    next();
});

// Pasta para hospedar o executável de update
app.use(express.static(path.join(__dirname, 'public')));

const io = new Server(server, {
    cors: {
        origin: "*",
    }
});

const PORT = process.env.PORT || 3001;
const UPDATE_TOKEN = process.env.UPDATE_TOKEN || 'miredesk-secret-token';

// Endpoint para receber o upload do executável e do manifesto de versão
app.post('/upload-update', upload.fields([
    { name: 'exe', maxCount: 1 },
    { name: 'version', maxCount: 1 }
]), (req, res) => {
    const token = req.headers['x-update-token'];

    if (!token || token !== UPDATE_TOKEN) {
        console.warn('Tentativa de upload sem token válido');
        return res.status(403).json({ error: 'Acesso negado: Token de upload inválido ou ausente' });
    }

    if (!req.files || (!req.files.exe && !req.files.version)) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    console.log(`[Update] Novo upload recebido. Token validado.`);

    // Mover o version.json da pasta public para a raiz do servidor se necessário
    // mas no código atual ele lê da raiz, então vamos garantir que fique no lugar certo.
    const publicVersion = path.join(__dirname, 'public', 'version.json');
    const rootVersion = path.join(__dirname, 'version.json');

    if (fs.existsSync(publicVersion)) {
        fs.copyFileSync(publicVersion, rootVersion);
    }

    res.json({
        success: true,
        message: 'Arquivos recebidos e atualizados com sucesso',
        files: Object.keys(req.files)
    });
});

app.get('/version', (req, res) => {
    try {
        const versionFile = path.join(__dirname, 'version.json');
        if (fs.existsSync(versionFile)) {
            const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
            res.json(versionData);
        } else {
            // Fallback se o arquivo não existir
            res.json({ version: '1.0.0', critical: false });
        }
    } catch (e) {
        console.error('Erro ao ler versão:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on('offer', ({ roomId, offer }) => {
        socket.to(roomId).emit('offer', offer);
    });

    socket.on('answer', ({ roomId, answer }) => {
        socket.to(roomId).emit('answer', answer);
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
        socket.to(roomId).emit('ice-candidate', candidate);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
    console.log(`Upload Token configurado: ${UPDATE_TOKEN === 'miredesk-secret-token' ? 'PADRÃO (miredesk-secret-token)' : 'PERSONALIZADO'}`);
});

