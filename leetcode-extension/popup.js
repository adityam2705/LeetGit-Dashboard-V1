const loginSection = document.getElementById("login-section");
const message = document.getElementById("message");
const API_BASE_URL = "http://localhost:8080";

function showLoggedIn(username) {
    loginSection.innerHTML = `
        <p>✓ Logged in as <strong>${username}</strong></p>

        <p id="github-status">Checking GitHub...</p>

<button id="github">Connect GitHub</button>

<br><br>

<label for="repository">Repository</label>

<select id="repository" disabled>
    <option value="">Select repository</option>
</select>

<br><br>

<button id="sync" disabled>Sync Now</button>

        <br><br>

        <button id="logout">Logout</button>
    `;

    document.getElementById("github")
        .addEventListener("click", connectGitHub);

    document.getElementById("sync")
        .addEventListener("click", syncNow);

    document.getElementById("logout")
        .addEventListener("click", logout);

    checkGitHubStatus();
}

function showRegister() {
    loginSection.innerHTML = `
        <h4>Create your account</h4>

        <input id="register-username" type="text" placeholder="Username" />
        <br><br>

        <input id="register-email" type="email" placeholder="Email" />
        <br><br>

        <input id="register-password" type="password" placeholder="Password" />
        <br><br>

        <button id="create-account">Create Account</button>

        <br><br>

        <button id="back-to-login">← Back to Login</button>

        <p id="message"></p>
    `;

    document.getElementById("create-account")
        .addEventListener("click", register);

    document.getElementById("back-to-login")
        .addEventListener("click", showLogin);
}

async function checkGitHubStatus() {
    const status = document.getElementById("github-status");

    const data = await chrome.storage.local.get(["jwt"]);

    if (!data.jwt) {
        return;
    }

    try {
        const response = await fetch(
            API_BASE_URL + "/github/api/status",
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + data.jwt
                }
            }
        );

        if (!response.ok) {
            status.textContent = "GitHub: Unable to check status";
            return;
        }

        const result = await response.json();
        const syncButton = document.getElementById("sync");


        if (result.connected) {
            status.textContent = "GitHub: ✓ Connected";
            syncButton.disabled = false;
            await loadRepositories();
        } else {
            status.textContent = "GitHub: Not connected";
            syncButton.disabled = true;
        }

    } catch (error) {
        console.error(error);
        status.textContent = "GitHub: Unable to check status";
    }
}

async function loadRepositories() {

    const data = await chrome.storage.local.get(["jwt"]);

    if (!data.jwt) {
        return;
    }

    try {
        const response = await fetch(
            API_BASE_URL + "/github/api/repositories",
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + data.jwt
                }
            }
        );

        if (!response.ok) {
            console.error("Failed to load repositories");
            return;
        }

        const repositories = await response.json();

        const repositorySelect =
            document.getElementById("repository");

        repositorySelect.innerHTML =
            '<option value="">Select repository</option>';

        repositories.forEach(repository => {

            const option = document.createElement("option");

            option.value = repository.full_name;
            option.textContent = repository.full_name;

            repositorySelect.appendChild(option);
        });

        repositorySelect.disabled = false;
        repositorySelect.addEventListener("change", () => {
            saveRepository(repositorySelect.value);
        });

    } catch (error) {
        console.error("Failed to load repositories:", error);
    }
}

async function saveRepository(fullName) {

    if (!fullName) {
        return;
    }

    const parts = fullName.split("/");

    const owner = parts[0];
    const repository = parts[1];

    const data = await chrome.storage.local.get(["jwt"]);

    if (!data.jwt) {
        return;
    }

    try {
        const response = await fetch(
            API_BASE_URL + "/github/api/repository",
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + data.jwt,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    owner: owner,
                    repository: repository
                })
            }
        );

        if (!response.ok) {
            console.error("Failed to save repository");
            return;
        }

        console.log("Repository saved:", fullName);

    } catch (error) {
        console.error("Failed to save repository:", error);
    }
}

async function register() {
    const username = document.getElementById("register-username").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const message = document.getElementById("message");

    if (!username || !email || !password) {
        message.textContent = "Please fill all fields";
        return;
    }

    try {
        const response = await fetch(
            API_BASE_URL + "/users",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error(error);
            message.textContent = "Could not create account";
            return;
        }

        message.textContent = "Account created successfully!";

        setTimeout(() => {
            showLogin();
        }, 1000);

    } catch (error) {
        console.error(error);
        message.textContent = "Could not connect to server";
    }
}

function showLogin() {
    loginSection.innerHTML = `
        <input id="username" type="text" placeholder="Username" />
        <br><br>

        <input id="password" type="password" placeholder="Password" />
        <br><br>

        <button id="login">Login</button>

        <br><br>

        <button id="register">Create account</button>

        <p id="message"></p>
    `;

    document.getElementById("login")
        .addEventListener("click", login);

    document.getElementById("register")
        .addEventListener("click", showRegister);
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
            API_BASE_URL + "/auth/login"
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

        const result = await response.json();

        await chrome.storage.local.set({
            jwt: result.accessToken,
            refreshToken: result.refreshToken,
            username: username
        });

        showLoggedIn(username);

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
        API_BASE_URL + "/github/connect-url",
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

async function syncNow() {

    const status = document.getElementById("github-status");
    const syncButton = document.getElementById("sync");

    syncButton.disabled = true;
    status.textContent = "Syncing...";

    try {

        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        if (!tabs.length) {
            status.textContent = "No active tab found";
            return;
        }

        await chrome.tabs.sendMessage(
            tabs[0].id,
            {
                type: "SYNC_NOW"
            }
        );

        status.textContent = "Sync completed";

    } catch (error) {

        console.error("Sync failed:", error);

        status.textContent =
            "Sync failed. Make sure you are on LeetCode.";

    } finally {

        syncButton.disabled = false;
    }
}