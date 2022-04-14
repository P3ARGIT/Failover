const { ipcRenderer } = require("electron");

// Credentials moeten komen via electron-store
let credentials = {
    'username': '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    'jan': 'ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae',
    'jef': 'dc00c903852bb19eb250aeba05e534a6d211629d77d055033806b783bae09937',
    'admin': 'eeb658c58d39de623b3f8193d6a08434a1bc53d6026b8a4dcd51dac1b80ed5ac',
}

// Helper function
async function sha256(message) {
    // Encode as UTF-8
    const msgBuffer = new TextEncoder().encode(message);

    // Hash the message
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);

    // Convert ArrayBuffer to Array
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // Convert bytes to hex string
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const loginButton = document.getElementById('loginButton');
loginButton.addEventListener('click', loginProcess)

async function loginProcess() {
    // Deze gegevens worden opgehaald uit tekstvelden die de user invult
    let userEnteredUsername = document.getElementById('usernameInput').value;
    let userEnteredPassword = document.getElementById('passwordInput').value;

    if (credentials[userEnteredUsername] == undefined) {
        alert('Wrong credentials');
        return;
    }

    // Hash het user entered password (zoek nog een hashing function, liefst veiliger dan md5)
    let hashedUserEnteredPassword = await sha256(userEnteredPassword);

    // Dit haalt de hash van het juiste wachtwoord van de gebruiker op
    // op basis van de door de gebruiker ingevulde username
    let correctPassword = credentials[userEnteredUsername];

    // Check of de hashes van de wachtwoorden niet overeenkomen
    if (hashedUserEnteredPassword !== correctPassword) {
        // Login failed
        alert('Wrong credentials');
        return;
    }

    ipcRenderer.sendSync('login-success');
}
