import express from "express";
import multer from "multer";
import nunjucks from "nunjucks";
import open from "open";

// Firebase
import { initializeApp } from "@firebase/app";
import { getFirestore, doc, setDoc } from "@firebase/firestore";
import { 
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    onAuthStateChanged,
    type User
} from "@firebase/auth";

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
let currentUser: User | null;

// Perhatikan state login pengguna
onAuthStateChanged(firebaseAuth, (user) => {
    currentUser = user;
    // console.log(user); // UNTUK DEBUGGING
});

// App baru
const app = express();
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
    ) && !currentUser) {
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
app.get("/login", (_req, res) => {
    if (currentUser) {
        res.redirect("/");
    } else {
        res.render("login", { login: true, title: "Masuk" });
    }
});

// POST Login
app.post("/login", express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const credential = await signInWithEmailAndPassword(firebaseAuth, req.body["login-email"], req.body["login-password"]);
        console.log(credential.user.displayName + " masuk.")
        res.redirect(".");
    } catch (error) {
        console.error("Login user gagal", error);
        res.render("login", { login: true, title: "Masuk", wrongUser: true });
    }
});

// Logout
app.get("/logout", async (_req, res) => {
    console.log(currentUser?.displayName + " keluar.")

    await signOut(firebaseAuth)
    res.redirect("/login");
});

// Halaman register
app.get("/register", (_req, res) => {
    if (currentUser) res.redirect("/");
    else res.render("register", { login: true, title: "Daftar" });
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
    let user: User;

    // Informasi pribadi
    const userInformation = {
        name: req.body["register-name"] as string,
        nim: req.body["register-nim"] as string,
        email: req.body["register-email"] as string,
        fakultas: req.body["register-fakultas"] as string,
        studi: req.body["register-studi"] as string,
        photo: "/" + req.file?.path as string,
    }

    try {
        user = await createUserWithEmailAndPassword(firebaseAuth, email, password)
            .then(user => user.user);
        
        // Simpan data pribadi juga ke Authentication
        updateProfile(user, {
            displayName: req.body["register-name"],
            photoURL: userInformation.photo
        });
    } catch (error) {
        console.error("Menyimpan user gagal", error);
        return res.render("register", { login: true, title: "Daftar", alreadyRegistered: true });
    }

    // Simpan informasi pribadi
    await setDoc(doc(firestore, "users", user.uid), userInformation);
    // Simpan placeholder history
    await setDoc(doc(firestore, "history", user.uid), { history: [] });

    // Lanjutkan ke login
    console.log("User tersimpan");
    res.redirect("/login");
});

app.listen(process.env.PORT || 8080, () => {
    open("http://localhost:8080");
});