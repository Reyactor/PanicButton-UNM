import express, { text } from "express";
import multer from "multer";
import nunjucks from "nunjucks";
import open from "open";

// Firebase
import { initializeApp } from "@firebase/app";
import { getFirestore, doc, setDoc, getDoc, arrayUnion, updateDoc } from "@firebase/firestore";
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
const njk = nunjucks.configure("public", {
    watch: true,
    express: app,
    autoescape: true
});

// Filter nunjucks
njk.addFilter("date", (date: number) => {
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const d = new Date(date);
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    
    return `${day} ${month} ${year}` ;
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

// Halaman utama
///////////////////////////////////////////////////////

// Halaman utama (atau login jika belum login)
app.get("/", (_req, res) => {
    res.render("index", { title: "Beranda", noDummy: true });
});

// POST Terima data emergency lalu kirim ke telegram
app.post("/emergency", express.json(), async (req, res): Promise<any> => {
    if (!currentUser) {
        return res.json({ error: true, message: "Status login tidak ditemukan." });
    }

    console.log("Laporan baru dari " + currentUser.displayName);
    try {
        const data = {
            name: currentUser.displayName || "NoName",
            latitude: req.body.latitude,
            longitute: req.body.longitude,
            date: Date.now(),
            gmap: `https://www.google.com/maps?q=loc:${req.body.latitude},${req.body.longitude}`
        }

        // Tambah emergency user ke history
        console.log("Menyimpan history...");
        await updateDoc(doc(firestore, "history", currentUser.uid), {
            history: arrayUnion(data)
        });

        // Kirim informasi ke bot telegram
        console.log("Mengirim ke Telegram...");
        const information = await getDoc(doc(firestore, "users", currentUser.uid));

        let message = "**🚨 Laporan Terbaru!**";
        message += "\n\n";
        message += `Nama: ${currentUser.displayName || "NoName"}\n`;
        message += `NIM: ${information.get("nim")}\n`;
        message += `Email: ${information.get("email")}\n`;
        message += `Fakultas: ${information.get("fakultas")}\n`;
        message += `Prodi: ${information.get("studi")}\n`;
        message += `Latitude: ${data.latitude}\n`;
        message += `Longitude: ${data.longitute}\n`;
        message += `\n\n`;
        message += data.gmap;

        await fetch(`https://api.telegram.org/bot${Bun.env["TELEGRAM_BOT_TOKEN"]}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: Bun.env["TELEGRAM_CHAT_ID"],
                text: message
            })
        });
        
        console.log("Laporan berhasil dikirim!")
        // Beritahu client
        res.json({ error: false, message: "Tersimpan!" });
    } catch (error) {
        console.error(error);
        res.json({ error: true, message: "Tidak diketahui." })
    }
});

// Halaman biasa
///////////////////////////////////////////////////////

// Halaman profil
app.get("/profile", async (_req, res) => {
    const information = await getDoc(doc(firestore, "users", currentUser?.uid || "0"))
        .then(res => res.data())
        .catch(console.error);

    res.render("profile", { title: "Profil", information });
});

// Akses ke foto profil
app.use("/uploads", express.static(__dirname + "/uploads"));

// Halaman riwayat
app.get("/history", async (_req, res) => {
    const histories = await getDoc(doc(firestore, "history", currentUser?.uid || "0"))
        .then(res => res.get("history"))
        .catch(console.error);
    const information = await getDoc(doc(firestore, "users", currentUser?.uid || "0"))
        .then(res => res.data())
        .catch(console.error);

    res.render("history", { title: "Riwayat", histories, information });
});

// Halaman login dan logout
///////////////////////////////////////////////////////

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
///////////////////////////////////////////////////////

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

    console.log("Menyimpan informasi pribadi...")
    // Simpan informasi pribadi
    await setDoc(doc(firestore, "users", user.uid), userInformation);
    // Simpan placeholder history
    await setDoc(doc(firestore, "history", user.uid), { history: [] });

    // Lanjutkan ke login
    console.log("Penyimpanan user dan informasi berhasil!");
    res.redirect("/login");
});

///////////////////////////////////////////////////////

app.listen(process.env.PORT || 8080, () => {
    open("http://localhost:8080");
});