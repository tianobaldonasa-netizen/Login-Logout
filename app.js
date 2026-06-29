// Using Firebase Compat SDK (loaded via script tags in index.html)
// Configuration is also loaded via script tag (firebaseConfig)

// DOM Elements
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loadingOverlay = document.getElementById('loading-overlay');
const nameInput = document.getElementById('name');
const ageInput = document.getElementById('age');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnSignup = document.getElementById('btn-signup');
const btnShowSignup = document.getElementById('btn-show-signup');
const btnShowLogin = document.getElementById('btn-show-login');
const signupOnlyFields = document.querySelectorAll('.signup-only');
const loginButtons = document.getElementById('login-buttons');
const signupButtons = document.getElementById('signup-buttons');
const authError = document.getElementById('auth-error');
const userEmailDisplay = document.getElementById('user-email-display');
const btnLogout = document.getElementById('btn-logout');
const noteForm = document.getElementById('note-form');
const noteInput = document.getElementById('note-input');
const notesList = document.getElementById('notes-list');

// App State
let app, auth, db;
let currentUser = null;
let unsubscribeNotes = null;

// Initialize Firebase Application
function initApp() {
    try {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();

        // Listen to Auth State changes
        auth.onAuthStateChanged((user) => {
            loadingOverlay.classList.remove('active');
            if (user) {
                // User is signed in
                currentUser = user;
                showDashboard();
                loadNotes();
            } else {
                // User is signed out
                currentUser = null;
                showLogin();
                if (unsubscribeNotes) unsubscribeNotes();
            }
        });

    } catch (error) {
        console.error("Firebase Init Error: ", error);
        showError("Failed to initialize Firebase. Did you add your config to config.js?");
        loadingOverlay.classList.remove('active');
    }
}

// UI Handlers
function showDashboard() {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    userEmailDisplay.textContent = currentUser.email;
    emailInput.value = '';
    passwordInput.value = '';
    authError.textContent = '';
}

function showLogin() {
    dashboardView.classList.add('hidden');
    loginView.classList.remove('hidden');
    notesList.innerHTML = '';
    
    // Reset to login mode
    signupOnlyFields.forEach(el => el.style.display = 'none');
    loginButtons.style.display = 'flex';
    signupButtons.style.display = 'none';
    nameInput.value = '';
    ageInput.value = '';
}

function showError(msg) {
    authError.textContent = msg;
    loadingOverlay.classList.remove('active');
}

// Mode Toggling
btnShowSignup.addEventListener('click', () => {
    signupOnlyFields.forEach(el => el.style.display = 'block');
    loginButtons.style.display = 'none';
    signupButtons.style.display = 'flex';
    authError.textContent = '';
});

btnShowLogin.addEventListener('click', () => {
    signupOnlyFields.forEach(el => el.style.display = 'none');
    loginButtons.style.display = 'flex';
    signupButtons.style.display = 'none';
    authError.textContent = '';
});

// Authentication Logic
btnSignup.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const age = ageInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!name || !age || !email || !password) {
        showError("All fields are required for sign up.");
        return;
    }

    loadingOverlay.classList.add('active');
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        // Save additional user info to Firestore
        await db.collection("users").doc(userCredential.user.uid).set({
            name: name,
            age: parseInt(age, 10),
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // onAuthStateChanged will handle UI transition
    } catch (error) {
        showError(error.message);
        loadingOverlay.classList.remove('active');
    }
});

btnLogin.addEventListener('click', async (e) => {
    e.preventDefault(); // Prevent form submission

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showError("Email and password are required.");
        return;
    }

    loadingOverlay.classList.add('active');
    try {
        await auth.signInWithEmailAndPassword(email, password);
        // onAuthStateChanged will handle UI transition
    } catch (error) {
        showError("Invalid email or password.");
    }
});

btnLogout.addEventListener('click', async () => {
    loadingOverlay.classList.add('active');
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Logout Error:", error);
        loadingOverlay.classList.remove('active');
    }
});

// Firestore Logic
noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = noteInput.value.trim();
    if (!text || !currentUser) return;

    const submitBtn = noteForm.querySelector('button');
    submitBtn.disabled = true;

    try {
        await db.collection("notes").add({
            text: text,
            email: currentUser.email,
            uid: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        noteInput.value = '';
    } catch (error) {
        console.error("Error adding document: ", error);
        alert("Failed to add note. Check console for details.");
    } finally {
        submitBtn.disabled = false;
    }
});

function loadNotes() {
    // We listen to the "notes" collection in real-time
    const q = db.collection("notes").orderBy("createdAt", "desc");

    unsubscribeNotes = q.onSnapshot((snapshot) => {
        notesList.innerHTML = ''; // clear current

        if (snapshot.empty) {
            notesList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No notes yet. Be the first to say hi!</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const noteEl = document.createElement('div');
            noteEl.classList.add('note-item');

            // Format time if available
            let timeString = 'Just now';
            if (data.createdAt) {
                const date = data.createdAt.toDate();
                timeString = new Intl.DateTimeFormat('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                }).format(date);
            }

            noteEl.innerHTML = `
                <div class="note-email">${escapeHtml(data.email)}</div>
                <div class="note-text">${escapeHtml(data.text)}</div>
                <div class="note-time">${timeString}</div>
            `;
            notesList.appendChild(noteEl);
        });
    }, (error) => {
        console.error("Error listening to notes: ", error);
        if (error.code === 'permission-denied') {
            notesList.innerHTML = '<p style="color: var(--error-color); text-align: center;">Permission Denied. Please check your Firestore Security Rules.</p>';
        }
    });
}

// Utility to prevent XSS
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Start app
initApp();
