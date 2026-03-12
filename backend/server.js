const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");

require("dotenv").config();
const pool = require("./db");

const app = express();

// =======================
// RATE LIMIT
// =======================

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Za dużo zapytań. Spróbuj ponownie za kilka minut." }
});

app.use(apiLimiter);

// =======================
// UPLOADS FOLDER
// =======================

const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log("Utworzono folder uploads/");
}

// =======================
// CORS
// =======================

app.use(cors({
    origin: [
        "https://twoja-strona.vercel.app",
        "http://localhost:5173"
    ]
}));

app.use("/uploads", express.static(uploadsDir));
app.use(express.json());

// =======================
// MULTER STORAGE
// =======================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {

        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("Dozwolone tylko JPG, PNG lub WEBP"));
        }

        cb(null, true);
    }
});

// =======================
// DB TEST
// =======================

pool.query("SELECT NOW()")
    .then((res) => console.log("Polaczono z baza danych:", res.rows[0].now))
    .catch((err) => console.error("Blad polaczenia z baza danych:", err.message));

// =======================
// SETUP (tylko raz)
// =======================

app.get("/setup", async (req, res) => {

    try {

        await pool.query(`
            CREATE TABLE IF NOT EXISTS reports (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                category VARCHAR(100) NOT NULL,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                image_url TEXT,
                status VARCHAR(50) DEFAULT 'Nowe',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        res.json({
            message: "Tabela reports utworzona lub juz istnieje."
        });

    } catch (error) {

        console.error("Blad tworzenia tabeli:", error.message);

        res.status(500).json({
            error: error.message
        });

    }
});

// =======================
// API STATUS
// =======================

app.get("/", async (req, res) => {

    try {

        const result = await pool.query("SELECT NOW() AS now");

        res.json({
            message: "API dziala poprawnie",
            time: result.rows[0]
        });

    } catch (error) {

        console.error("Blad bazy danych:", error);

        res.status(500).json({
            error: "Blad polaczenia z baza danych"
        });

    }

});

// =======================
// ADD REPORT
// =======================

app.post("/reports", upload.single("image"), async (req, res) => {

    try {

        console.log("POST /reports body:", req.body);

        const { title, description, category, latitude, longitude } = req.body;

        if (!title || !description || !category || !latitude || !longitude) {

            return res.status(400).json({
                error: "Brakujace pola",
                received: { title, description, category, latitude, longitude }
            });

        }

        const imageUrl = req.file
            ? `/uploads/${req.file.filename}`
            : null;

        const result = await pool.query(
            `INSERT INTO reports 
            (title, description, category, latitude, longitude, image_url) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *`,
            [
                title,
                description,
                category,
                parseFloat(latitude),
                parseFloat(longitude),
                imageUrl
            ]
        );

        res.json(result.rows[0]);

    } catch (error) {

        console.error("Blad zapisu zgloszenia:", error.message);
        console.error(error.stack);

        res.status(500).json({
            error: "Blad zapisu zgloszenia",
            details: error.message
        });

    }

});

// =======================
// GET REPORTS
// =======================

app.get("/reports", async (req, res) => {

    try {

        const result = await pool.query(
            "SELECT * FROM reports ORDER BY created_at DESC"
        );

        res.json(result.rows);

    } catch (error) {

        console.error("Blad pobierania zgloszen:", error.message);
        console.error(error.stack);

        res.status(500).json({
            error: "Blad pobierania zgloszen",
            details: error.message
        });

    }

});

// =======================
// UPDATE STATUS (ADMIN)
// =======================

app.put("/reports/:id/status", async (req, res) => {

    const adminKey = req.headers["x-admin-key"];

    if (adminKey !== process.env.ADMIN_KEY) {

        return res.status(403).json({
            error: "Brak uprawnien administratora"
        });

    }

    try {

        const { id } = req.params;
        const { status } = req.body;

        const result = await pool.query(
            `UPDATE reports 
            SET status = $1 
            WHERE id = $2 
            RETURNING *`,
            [status, id]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                error: "Nie znaleziono zgloszenia"
            });

        }

        res.json(result.rows[0]);

    } catch (error) {

        console.error("Blad aktualizacji statusu:", error.message);
        console.error(error.stack);

        res.status(500).json({
            error: "Blad aktualizacji statusu",
            details: error.message
        });

    }

});

// =======================
// SERVER START
// =======================

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {

    console.log("Serwer dziala na porcie " + PORT);

});

server.on("error", (error) => {

    console.error("Blad uruchamiania serwera:", error);

});