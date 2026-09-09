const loginSection = document.getElementById("login-section");
const message = document.getElementById("message");

function showLoggedIn(username) {

    loginSection.innerHTML = `
        <p>Logged in</p>

        <button id="github">
            Connect GitHub
        </button>

        <br><br>

        <button id="logout">
            Logout
        </button>
    `;

    document.getElementById("github")
        .addEventListener("click", connectGitHub);

    document.getElementById("logout")
        .addEventListener("click", logout);
}

function showLogin() {

    loginSection.innerHTML = `
        <input
            id="username"
            type="text"
            placeholder="Username"
        />

        <br><br>

        <input
            id="password"
            type="password"
            placeholder="Password"
        />

        <br><br>

        <button id="login">
            Login
        </button>

        <p id="message"></p>
    `;

    document.getElementById("login")
        .addEventListener("click", login);
}

async function login() {

    const username =
        document.getElementById("username").value;

    const password =
        document.getElementById("password").value;

    const message =
        document.getElementById("message");

    if (!username || !password) {
        message.textContent =
            "Enter username and password";
        return;
    }

    try {

        const response = await fetch(
            "http://localhost:8080/auth/login"
            + "?username=" + encodeURIComponent(username)
            + "&password=" + encodeURIComponent(password),
            {
                method: "POST"
            }
        );

        if (!response.ok) {
            message.textContent =
                "Invalid username or password";
            return;
        }

        const token = await response.text();

        await chrome.storage.local.set({
            jwt: token,
            username: username
        });

        showLoggedIn();

    } catch (error) {

        console.error(error);

        message.textContent =
            "Could not connect to server";
    }
}

async function logout() {

    await chrome.storage.local.remove([
        "jwt",
        "username"
    ]);

    showLogin();
}


// Check login when popup opens
chrome.storage.local.get(
    ["jwt", "username"],
    (data) => {

        if (data.jwt) {
            showLoggedIn(data.username);
        } else {
            showLogin();
        }

    }
);

async function connectGitHub() {

    const data = await chrome.storage.local.get(["jwt"]);

    const response = await fetch(
        "http://localhost:8080/github/connect-url",
        {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + data.jwt
            }
        }
    );

    if (!response.ok) {
        console.error("Failed to get GitHub authorization URL");
        return;
    }

    const authorizationUrl = await response.text();

    window.open(authorizationUrl, "_blank");
}