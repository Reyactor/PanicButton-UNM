import express from "express";
import session from "express-session";
import nunjucks from "nunjucks";
import open from "open";

// App baru
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: Bun.env["SECRET"] || "test"
}))

// Persiapkan nunjucks
app.set("view engine", "njk");
nunjucks.configure("public", {
    watch: true,
    express: app,
    autoescape: true
});

// File static
app.use(express.static(__dirname + "/public"));
// Jangan perbolehkan akses kalau belum login
app.use((req, res, next) => {
    if ((
        req.url != "/register" &&
        req.url != "/login" &&
        !req.url.startsWith("/styles") &&
        !req.url.startsWith("/scripts") &&
        !req.url.startsWith("/img")
    ) && !req.session.user) {
        res.redirect("/login");
    } else {
        next();
    }
})

// Halaman utama (atau login jika belum login)
app.get("/", (_req, res) => {
    res.render("index", { title: "Beranda" });
});

// Halaman profil
app.get("/profile", (_req, res) => {
    res.render("profile", { title: "Profil" });
});

// Halaman riwayat
app.get("/history", (_req, res) => {
    res.render("history", { title: "Riwayat" });
});

// Halaman pengaturan
app.get("/settings", (_req, res) => {
    res.render("settings", { title: "Pengaturan" });
});

// Halaman login
app.get("/login", (req, res) => {
    if (req.session.user) {
        res.redirect("/");
    } else {
        res.render("login", { login: true, title: "Masuk" });
    }
});

// Halaman register
app.get("/register", (req, res) => {
    if (req.session.user) {
        res.redirect("/");
    } else {
        res.render("register", { login: true, title: "Daftar" });
    }
});

// POST register
app.post("/register", (req, res) => {
    console.log(req.body);
});

app.listen(process.env.PORT || 8080, () => {
    open("http://localhost:8080");
});

// Fungsi //
/**
 * Random token untuk sesi login
 * 
 * @param {number?} length 
 * @returns {string} Generated token
 */
function generateToken(length = 32) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?';
    let token = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        token += characters[randomIndex];
    }
    return token;
}