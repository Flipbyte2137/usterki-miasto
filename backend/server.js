const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const pool = require("./db");

const app = express();

// =========================
// FIX: Auto-create uploads folder if it doesn't exist
// (on Render the filesystem resets, so this folder may be missing)
// =========================
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log("Utworzono folder uploads/");
}

app.use(cors());
app.use("/uploads", express.static(uploadsDir));
app.use(express.json());

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

// =========================
// TEST: database connection on startup
// =========================
pool.query("SELECT NOW()")
    .then((res) => console.log("✅ Połączono z bazą danych:", res.rows[0].now))
    .catch((err) => console.error("❌ Błąd połączenia z bazą danych:", err.message));

app.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() AS now");
        res.json({
            message: "API działa poprawnie",
            time: result.rows[0],
        });
    } catch (error) {
        console.error("Błąd bazy danych:", error);
        res.status(500).json({ error: "Błąd połączenia z bazą danych" });
    }
});

app.post("/reports", upload.single("image"), async (req, res) => {
    try {
        // Log incoming data to help debug
        console.log("POST /reports - body:", req.body);
        console.log("POST /reports - file:", req.file ? req.file.filename : "brak");

        const { title, description, category, latitude, longitude } = req.body;

        // Validate required fields
        if (!title || !description || !category || !latitude || !longitude) {
            return res.status(400).json({
                error: "Brakujące pola",
                received: { title, description, category, latitude, longitude },
            });
        }

        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const result = await pool.query(
            `INSERT INTO reports 
      (title, description, category, latitude, longitude, image_url) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`,
            [title, description, category, parseFloat(latitude), parseFloat(longitude), imageUrl]
        );

        res.json(result.rows[0]);
    } catch (error) {
        // Log the FULL error so Render logs show what went wrong
        console.error("❌ Błąd zapisu zgłoszenia:", error.message);
        console.error(error.stack);
        res.status(500).json({ error: "Błąd zapisu zgłoszenia", details: error.message });
    }
});

app.get("/reports", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM reports ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Błąd pobierania zgłoszeń:", error.message);
        console.error(error.stack);
        res.status(500).json({ error: "Błąd pobierania zgłoszeń", details: error.message });
    }
});

app.put("/reports/:id/status", async (req, res) => {
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
            return res.status(404).json({ error: "Nie znaleziono zgłoszenia" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("❌ Błąd aktualizacji statusu:", error.message);
        console.error(error.stack);
        res.status(500).json({ error: "Błąd aktualizacji statusu", details: error.message });
    }
});

const PORT = Number(process.env.PORT) || 5001;

const server = app.listen(PORT, () => {
    console.log(`✅ Serwer działa na porcie ${PORT}`);
});

server.on("error", (error) => {
    console.error("❌ Błąd uruchamiania serwera:", error);
});