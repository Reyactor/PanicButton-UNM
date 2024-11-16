import express from "express";
import session from "express-session";
import multer from "multer";
import nunjucks from "nunjucks";
import open from "open";

// Firebase
import { FirebaseError, initializeApp } from "@firebase/app";
import { getFirestore, collection, addDoc } from "@firebase/firestore";
import { getAuth, createUserWithEmailAndPassword } from "@firebase/auth";

if (
    !Bun.env["FIREBASE_API_KEY"] ||
    !Bun.env["FIREBASE_AUTH_DOMAIN"] ||
    !Bun.env["FIREBASE_PROJECT_ID"] ||
    !Bun.env["FIREBASE_STORAGE_BUCKET"] ||
    !Bun.env["FIREBASE_MESSAGING_SENDER_ID"] ||
    !Bun.env["FIREBASE_APP_ID"]
) throw new Error("Autentikasi Firebase tidak lengkap. Mohon periksa file .env");

const firebaseApp = initializeApp({
    apiKey: Bun.env["FIREBASE_API_KEY"],
    authDomain: Bun.env["FIREBASE_AUTH_DOMAIN"],
    projectId: Bun.env["FIREBASE_PROJECT_ID"],
    storageBucket: Bun.env["FIREBASE_STORAGE_BUCKET"],
    messagingSenderId: Bun.env["FIREBASE_MESSAGING_SENDER_ID"],
    appId: Bun.env["FIREBASE_APP_ID"]
});
const firebaseAuth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

// App baru
const app = express();
app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: Bun.env["SECRET"] || "test"
}));

// Handle form-data
const upload = multer({ dest: "uploads/" });

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
        res.render("register", {
            login: true,
            title: "Daftar",
        });
    }
});

// POST register
app.post("/register", upload.single("register-photo"), async (req, res) => {
    const email = req.body["register-email"];
    const password = req.body["register-password"];
    
    // Lempar error jika email dan password kosong
    if (!email && !password) {
        res.redirect("/register");
        throw new Error("Email atau password kosong.");
    }

    console.log("Menyimpan user...");
    // Register ke Authentication
    let uid: string = "0";
    try {
        const user = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        uid = user.user.uid;
    } catch (error) {
        console.error("Menyimpan user gagal", error);
        return res.render("register", {
            login: true,
            title: "Daftar",
            alreadyRegistered: true
        });
    }

    // Simpan informasi pribadi
    await addDoc(collection(firestore, "users"), {
        userId: uid,
        name: req.body["register-name"],
        nim: req.body["register-nim"],
        email: req.body["register-email"],
        fakultas: req.body["register-fakultas"],
        studi: req.body["register-studi"],
        photo: __dirname + "/" + req.file?.path
    });

    // Lanjutkan ke login (seharusnya langsung masuk dashboard)
    console.log("User tersimpan");
    res.redirect("/login");
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