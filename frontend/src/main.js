import "./style.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const currentPath = window.location.pathname;
const currentView = currentPath === "/admin" ? "admin" : "user";
const API_URL = "https://usterki-miasto.onrender.com";
const app = document.querySelector("#app");

const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "admin123";

let map = null;
let selectedMarker = null;
let reportMarkers = [];

// =========================
// WSPÓLNE FUNKCJE
// =========================
function initMap(mapId, center = [50.318, 19.237], zoom = 12) {
    map = L.map(mapId).setView(center, zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    setTimeout(() => {
        map.invalidateSize();
    }, 200);

    window.addEventListener("load", () => {
        setTimeout(() => {
            map.invalidateSize();
        }, 300);
    });
}

function clearReportMarkers() {
    if (!map) return;
    reportMarkers.forEach((marker) => map.removeLayer(marker));
    reportMarkers = [];
}

// =========================
// WIDOK UŻYTKOWNIKA
// =========================
function renderUserView() {
    const savedProfile = JSON.parse(localStorage.getItem("reporterProfile") || "null");

    if (!savedProfile) {
        app.innerHTML = `
      <div class="container narrow">
        <section class="card">
          <h1>Zgłoszenie usterki</h1>
          <p>Aby przejść dalej, podaj podstawowe dane kontaktowe.</p>

          <form id="verify-form">
            <input type="text" id="reporter-name" placeholder="Imię i nazwisko" required />
            <input type="email" id="reporter-email" placeholder="Adres e-mail" required />
            <button type="submit">Przejdź do formularza zgłoszenia</button>
          </form>
        </section>
      </div>
    `;

        const verifyForm = document.querySelector("#verify-form");
        verifyForm.addEventListener("submit", (event) => {
            event.preventDefault();

            const name = document.querySelector("#reporter-name").value.trim();
            const email = document.querySelector("#reporter-email").value.trim();

            localStorage.setItem(
                "reporterProfile",
                JSON.stringify({ name, email })
            );

            renderUserView();
        });

        return;
    }

    app.innerHTML = `
  <div class="container">
    <section class="card">
      <div class="top-row">
        <div>
          <h1>System zgłaszania usterek w Dąbrowie Górniczej</h1>
          <p class="muted">Użytkownik: <strong>${savedProfile.name}</strong> (${savedProfile.email})</p>
        </div>
        <button id="logout-user" class="secondary-btn">Zmień dane</button>
      </div>
    </section>

      <section class="card">
        <h2>Mapa zgłoszenia</h2>
        <p>Kliknij na mapie, aby wskazać miejsce wystąpienia usterki.</p>
        <div id="map"></div>
      </section>

      <section class="card">
        <h2>Dodaj zgłoszenie</h2>
        <form id="report-form">
          <input type="text" id="title" placeholder="Tytuł zgłoszenia" required />

          <textarea
            id="description"
            placeholder="Opis problemu"
            required
          ></textarea>

          <select id="category" required>
            <option value="">Wybierz kategorię</option>
            <option value="Droga">Droga</option>
            <option value="Latarnia">Latarnia</option>
            <option value="Chodnik">Chodnik</option>
            <option value="Inne">Inne</option>
          </select>

          <input
            type="number"
            step="any"
            id="latitude"
            placeholder="Szerokość geograficzna (latitude)"
            required
          />

          <input
            type="number"
            step="any"
            id="longitude"
            placeholder="Długość geograficzna (longitude)"
            required
          />

          <input type="file" id="image" accept="image/*" />

          <button type="submit">Wyślij zgłoszenie</button>
        </form>

        <div id="thank-you-message" class="success-message hidden">
          Dziękujemy, zgłoszenie zostało przyjęte.
        </div>
      </section>
    </div>
  `;

    document.querySelector("#logout-user").addEventListener("click", () => {
        localStorage.removeItem("reporterProfile");
        renderUserView();
    });

    initMap("map");

    const form = document.querySelector("#report-form");
    const latitudeInput = document.querySelector("#latitude");
    const longitudeInput = document.querySelector("#longitude");
    const thankYouMessage = document.querySelector("#thank-you-message");

    map.on("click", (event) => {
        const { lat, lng } = event.latlng;

        latitudeInput.value = lat.toFixed(6);
        longitudeInput.value = lng.toFixed(6);

        if (selectedMarker) {
            map.removeLayer(selectedMarker);
        }

        selectedMarker = L.marker([lat, lng]).addTo(map);
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const imageFile = document.querySelector("#image").files[0];

        const formData = new FormData();
        formData.append("title", document.querySelector("#title").value);
        formData.append("description", document.querySelector("#description").value);
        formData.append("category", document.querySelector("#category").value);
        formData.append("latitude", latitudeInput.value);
        formData.append("longitude", longitudeInput.value);

        if (imageFile) {
            formData.append("image", imageFile);
        }

        try {
            const response = await fetch(`${API_URL}/reports`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Nie udało się dodać zgłoszenia.");
            }

            form.reset();
            thankYouMessage.classList.remove("hidden");

            if (selectedMarker) {
                map.removeLayer(selectedMarker);
                selectedMarker = null;
            }

            setTimeout(() => {
                thankYouMessage.classList.add("hidden");
            }, 4000);
        } catch (error) {
            console.error("Błąd dodawania zgłoszenia:", error);
            alert("Wystąpił błąd podczas dodawania zgłoszenia.");
        }
    });
}

// =========================
// LOGOWANIE ADMINISTRATORA
// =========================
function renderAdminLogin() {
    app.innerHTML = `
    <div class="container narrow">
      <section class="card">
        <h1>Logowanie administratora</h1>
        <p>Wprowadź dane logowania, aby uzyskać dostęp do panelu administratora.</p>

        <form id="admin-login-form">
          <input type="text" id="admin-login" placeholder="Login" required />
          <input type="password" id="admin-password" placeholder="Hasło" required />
          <button type="submit">Zaloguj się</button>
        </form>

        <p id="admin-login-error" class="error-message hidden">
          Nieprawidłowy login lub hasło.
        </p>
      </section>
    </div>
  `;

    const loginForm = document.querySelector("#admin-login-form");
    const errorBox = document.querySelector("#admin-login-error");

    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const login = document.querySelector("#admin-login").value.trim();
        const password = document.querySelector("#admin-password").value.trim();

        if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
            localStorage.setItem("adminAuthenticated", "true");
            renderAdminView();
            return;
        }

        errorBox.classList.remove("hidden");
    });
}

// =========================
// WIDOK ADMINISTRATORA
// =========================
function renderAdminView() {
    const isAuthenticated = localStorage.getItem("adminAuthenticated") === "true";

    if (!isAuthenticated) {
        renderAdminLogin();
        return;
    }

    app.innerHTML = `
    <div class="container">
      <section class="card">
        <div class="top-row">
          <div>
            <h1>Panel administratora</h1>
            <p class="muted">Podgląd wszystkich zgłoszeń oraz zarządzanie ich statusem.</p>
          </div>
          <button id="admin-logout" class="secondary-btn">Wyloguj</button>
        </div>
      </section>

      <section class="stats-grid">
        <div class="stat-card">
          <span>Wszystkie</span>
          <strong id="count-all">0</strong>
        </div>
        <div class="stat-card">
          <span>Nowe</span>
          <strong id="count-new">0</strong>
        </div>
        <div class="stat-card">
          <span>W trakcie</span>
          <strong id="count-progress">0</strong>
        </div>
        <div class="stat-card">
          <span>Naprawione</span>
          <strong id="count-done">0</strong>
        </div>
      </section>

      <section class="card">
        <h2>Mapa zgłoszeń</h2>
        <div id="map"></div>
      </section>

      <section class="card">
        <h2>Filtry</h2>
        <div class="filters">
          <select id="filter-category">
            <option value="">Wszystkie kategorie</option>
            <option value="Droga">Droga</option>
            <option value="Latarnia">Latarnia</option>
            <option value="Chodnik">Chodnik</option>
            <option value="Inne">Inne</option>
          </select>

          <select id="filter-status">
            <option value="">Wszystkie statusy</option>
            <option value="Nowe">Nowe</option>
            <option value="W trakcie">W trakcie</option>
            <option value="Naprawione">Naprawione</option>
          </select>
        </div>
      </section>

      <section class="card">
        <h2>Lista zgłoszeń</h2>
        <div id="reports-list"></div>
      </section>
    </div>
  `;

    document.querySelector("#admin-logout").addEventListener("click", () => {
        localStorage.removeItem("adminAuthenticated");
        renderAdminLogin();
    });

    initMap("map");

    const reportsList = document.querySelector("#reports-list");
    const filterCategory = document.querySelector("#filter-category");
    const filterStatus = document.querySelector("#filter-status");

    async function fetchReports() {
        try {
            const response = await fetch(`${API_URL}/reports`);
            const reports = await response.json();

            document.querySelector("#count-all").textContent = reports.length;
            document.querySelector("#count-new").textContent = reports.filter((r) => r.status === "Nowe").length;
            document.querySelector("#count-progress").textContent = reports.filter((r) => r.status === "W trakcie").length;
            document.querySelector("#count-done").textContent = reports.filter((r) => r.status === "Naprawione").length;

            const selectedCategory = filterCategory.value;
            const selectedStatus = filterStatus.value;

            const filteredReports = reports.filter((report) => {
                const matchesCategory =
                    selectedCategory === "" || report.category === selectedCategory;
                const matchesStatus =
                    selectedStatus === "" || report.status === selectedStatus;

                return matchesCategory && matchesStatus;
            });

            clearReportMarkers();

            if (!Array.isArray(filteredReports) || filteredReports.length === 0) {
                reportsList.innerHTML = `<p>Brak zgłoszeń.</p>`;
                return;
            }

            reportsList.innerHTML = filteredReports
                .map(
                    (report) => `
            <div class="report-item admin-report-item"
                 data-lat="${report.latitude}"
                 data-lng="${report.longitude}">
              <div class="report-main">
                <h3>${report.title}</h3>
                <p><strong>Opis:</strong> ${report.description}</p>
                <p><strong>Kategoria:</strong> ${report.category}</p>
                <p><strong>Status:</strong> <span class="status-badge status-${report.status
                        .toLowerCase()
                        .replace(/\s+/g, "-")}">${report.status}</span></p>
                <p><strong>Lokalizacja:</strong> ${report.latitude}, ${report.longitude}</p>
                ${
                        report.image_url
                            ? `<img src="${API_URL}${report.image_url}" alt="Zdjęcie zgłoszenia" class="report-image" />`
                            : ""
                    }
              </div>

              <div class="admin-controls">
                <select data-id="${report.id}" class="status-select">
                  <option value="Nowe" ${report.status === "Nowe" ? "selected" : ""}>Nowe</option>
                  <option value="W trakcie" ${report.status === "W trakcie" ? "selected" : ""}>W trakcie</option>
                  <option value="Naprawione" ${report.status === "Naprawione" ? "selected" : ""}>Naprawione</option>
                </select>
              </div>
            </div>
          `
                )
                .join("");

            filteredReports.forEach((report) => {
                if (report.latitude && report.longitude) {
                    const marker = L.marker([report.latitude, report.longitude])
                        .addTo(map)
                        .bindPopup(`
              <strong>${report.title}</strong><br>
              ${report.category}<br>
              Status: ${report.status}
            `);

                    reportMarkers.push(marker);
                }
            });

            document.querySelectorAll(".admin-report-item").forEach((item) => {
                item.addEventListener("click", () => {
                    const lat = Number(item.dataset.lat);
                    const lng = Number(item.dataset.lng);

                    if (!lat || !lng) return;

                    map.flyTo([lat, lng], 18, {
                        animate: true,
                        duration: 1.2,
                    });
                });
            });

            document.querySelectorAll(".status-select").forEach((select) => {
                select.addEventListener("change", async (event) => {
                    const id = event.target.dataset.id;
                    const status = event.target.value;

                    try {
                        const response = await fetch(`${API_URL}/reports/${id}/status`, {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ status }),
                        });

                        if (!response.ok) {
                            throw new Error("Nie udało się zmienić statusu");
                        }

                        fetchReports();
                    } catch (error) {
                        console.error("Błąd zmiany statusu:", error);
                        alert("Nie udało się zmienić statusu.");
                    }
                });
            });
        } catch (error) {
            console.error("Błąd pobierania zgłoszeń:", error);
            reportsList.innerHTML = `<p>Nie udało się pobrać zgłoszeń.</p>`;
        }
    }

    filterCategory.addEventListener("change", fetchReports);
    filterStatus.addEventListener("change", fetchReports);

    fetchReports();
}

// =========================
// START
// =========================
if (currentView === "admin") {
    renderAdminView();
} else {
    renderUserView();
}