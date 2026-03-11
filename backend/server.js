const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
require("dotenv").config();
const pool = require("./db");

const app = express();

app.use(cors());
app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

app.use(express.json());

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

const PORT = Number(process.env.PORT) || 5001;

const server = app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});

server.on("error", (error) => {
    console.error("Błąd uruchamiania serwera:", error);
});

app.post("/reports", upload.single("image"), async (req, res) => {
    try {
        const { title, description, category, latitude, longitude } = req.body;

        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const result = await pool.query(
            `INSERT INTO reports 
      (title, description, category, latitude, longitude, image_url) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`,
            [title, description, category, latitude, longitude, imageUrl]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Błąd zapisu zgłoszenia:", error);
        res.status(500).json({ error: "Błąd zapisu zgłoszenia" });
    }
});

app.get("/reports", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM reports ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Błąd pobierania zgłoszeń" });
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
        console.error("Błąd aktualizacji statusu:", error);
        res.status(500).json({ error: "Błąd aktualizacji statusu" });
    }
});