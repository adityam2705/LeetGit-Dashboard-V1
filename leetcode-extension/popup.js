const loginSection = document.getElementById("login-section");
const message = document.getElementById("message");

const API_BASE_URL = "http://localhost:8080";

let syncInProgress = false;

// =========================================
// SYNC STATE / UI HELPERS
// =========================================

const REQUEST_TIMEOUT_MS = 15000;

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function safeNumber(
    value,
    fallback = 0
) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


function safePercent(
    processed,
    total
) {

    const p =
        Math.max(
            0,
            safeNumber(processed, 0)
        );

    const t =
        Math.max(
            0,
            safeNumber(total, 0)
        );

    if (t <= 0) {
        return 0;
    }

    return Math.min(
        100,
        Math.max(
            0,
            Math.round(
                (p / t) * 100
            )
        )
    );
}


async function fetchWithTimeout(
    url,
    options = {},
    timeoutMs = REQUEST_TIMEOUT_MS
) {

    const controller =
        new AbortController();

    const timeoutId =
        setTimeout(
            () => controller.abort(),
            timeoutMs
        );

    try {

        return await fetch(
            url,
            {
                ...options,
                signal:
                controller.signal
            }
        );

    } catch (error) {

        if (
            error?.name ===
            "AbortError"
        ) {

            throw new Error(
                `Request timed out after ${timeoutMs / 1000} seconds`
            );
        }

        throw error;

    } finally {

        clearTimeout(timeoutId);
    }
}


function setControlsDisabled(
    disabled
) {

    const syncButton =
        document.getElementById("sync");

    const repositorySelect =
        document.getElementById("repository");

    const logoutButton =
        document.getElementById("logout");


    if (syncButton) {

        syncButton.disabled =
            disabled ||
            !repositorySelect?.value;
    }


    if (repositorySelect) {

        repositorySelect.disabled =
            disabled;
    }


    if (logoutButton) {

        logoutButton.disabled =
            disabled;
    }
}


async function saveSyncState(
    state
) {

    try {

        await chrome.storage.local.set({
            syncState:
            state
        });

    } catch (error) {

        console.error(
            "Failed to save sync state:",
            error
        );
    }
}



// =========================================
// SYNC PROGRESS LISTENER
// =========================================

chrome.runtime.onMessage.addListener(
    (message) => {

        if (
            !message ||
            message.type !==
            "SYNC_PROGRESS"
        ) {

            return;
        }

        const progressBar =
            document.getElementById(
                "sync-progress-bar"
            );

        const progressText =
            document.getElementById(
                "sync-progress-text"
            );

        const progressPercent =
            document.getElementById(
                "sync-progress-percent"
            );

        const currentProblem =
            document.getElementById(
                "sync-current-problem"
            );

        if (
            !progressBar ||
            !progressText
        ) {

            return;
        }

        const processed =
            Math.max(
                0,
                safeNumber(
                    message.processed,
                    0
                )
            );

        const total =
            Math.max(
                0,
                safeNumber(
                    message.total,
                    0
                )
            );

        const percent =
            safePercent(
                processed,
                total
            );

        progressBar.style.width =
            percent + "%";

        progressText.textContent =
            `${processed} / ${total}`;

        if (progressPercent) {

            progressPercent.textContent =
                `${percent}%`;
        }

        if (
            currentProblem &&
            message.problem
        ) {

            currentProblem.textContent =
                "Syncing: " +
                message.problem;
        }

        syncInProgress =
            true;

        setControlsDisabled(
            true
        );
    }
);


// =========================================
// REFRESH ACCESS TOKEN
// =========================================

async function refreshAccessToken() {

    const data =
        await chrome.storage.local.get([
            "refreshToken"
        ]);


    if (!data.refreshToken) {

        throw new Error(
            "No refresh token found"
        );
    }


    const response =
        await fetchWithTimeout(
            API_BASE_URL + "/auth/refresh",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    refreshToken:
                    data.refreshToken
                })
            }
        );


    if (!response.ok) {

        throw new Error(
            "Refresh token invalid or expired"
        );
    }


    const result =
        await response.json();


    await chrome.storage.local.set({

        jwt:
        result.accessToken,

        refreshToken:
        result.refreshToken
    });


    return result.accessToken;
}


// =========================================
// API FETCH
// Automatically refreshes JWT
// =========================================

async function apiFetch(
    url,
    options = {}
) {

    const data =
        await chrome.storage.local.get([
            "jwt"
        ]);


    if (!data.jwt) {

        throw new Error(
            "No JWT found"
        );
    }


    const headers =
        new Headers(
            options.headers || {}
        );


    headers.set(
        "Authorization",
        "Bearer " + data.jwt
    );


    const response =
        await fetchWithTimeout(
            url,
            {
                ...options,
                headers
            }
        );


    if (response.status !== 401) {

        return response;
    }


    // Access token expired

    const newToken =
        await refreshAccessToken();


    headers.set(
        "Authorization",
        "Bearer " + newToken
    );


    return fetchWithTimeout(
        url,
        {
            ...options,
            headers
        }
    );
}


// =========================================
// LOGGED-IN SCREEN
// =========================================

function showLoggedIn(username) {

    loginSection.innerHTML = `

        <p>
            ✓ Logged in as
            <strong>${escapeHTML(username)}</strong>
        </p>


        <!-- GITHUB STATUS -->

        <div
            id="github-status"
            class="github-status"
        >
            Checking GitHub...
        </div>


        <!-- CONNECT GITHUB -->

        <button id="github">
            Connect GitHub
        </button>


        <br><br>


        <!-- REPOSITORY -->

        <label for="repository">
            Repository
        </label>


        <select
            id="repository"
            disabled
        >

            <option value="">
                Select repository
            </option>

        </select>


        <br><br>


        <!-- SYNC HINT -->

        <p class="sync-hint">
            ℹ Open LeetCode Progress to sync your solutions
        </p>


        <!-- SYNC BUTTON -->

        <button
            id="sync"
            disabled
        >
            Sync Now
        </button>


        <br><br>


        <!-- LOGOUT -->

        <button id="logout">
            Logout
        </button>
    `;


    document
        .getElementById("github")
        .addEventListener(
            "click",
            connectGitHub
        );


    document
        .getElementById("sync")
        .addEventListener(
            "click",
            syncNow
        );


    document
        .getElementById("logout")
        .addEventListener(
            "click",
            logout
        );


    void (async () => {

        try {

            // Restore an active sync FIRST.
            // GitHub/repository initialization must not hide a running sync.

            const data =
                await chrome.storage.local.get([
                    "syncState"
                ]);

            const syncState =
                data?.syncState;

            if (
                syncState?.status === "starting" ||
                syncState?.status === "running"
            ) {

                await renderSyncState(
                    syncState
                );

                return;
            }

            await checkGitHubStatus();

            await restoreSyncState();

        } catch (error) {

            console.error(
                "Failed to initialize popup:",
                error
            );
        }

    })();
}


// =========================================
// REGISTER SCREEN
// =========================================

function showRegister() {

    loginSection.innerHTML = `

        <h4>
            Create your account
        </h4>


        <input
            id="register-username"
            type="text"
            placeholder="Username"
        />


        <br><br>


        <input
            id="register-password"
            type="password"
            placeholder="Password"
        />


        <br><br>


        <button id="create-account">
            Create Account
        </button>


        <br><br>


        <button id="back-to-login">
            ← Back to Login
        </button>


        <p id="message"></p>
    `;


    document
        .getElementById("create-account")
        .addEventListener(
            "click",
            register
        );


    document
        .getElementById("back-to-login")
        .addEventListener(
            "click",
            showLogin
        );
}


// =========================================
// CHECK GITHUB STATUS
// =========================================

async function checkGitHubStatus() {

    const status =
        document.getElementById(
            "github-status"
        );


    if (!status) {
        return;
    }


    try {

        const response =
            await apiFetch(
                API_BASE_URL +
                "/github/api/status",
                {
                    method: "GET"
                }
            );


        if (!response.ok) {

            status.textContent =
                "GitHub: Unable to check status";

            return;
        }


        const result =
            await response.json();


        const syncButton =
            document.getElementById(
                "sync"
            );


        const githubButton =
            document.getElementById(
                "github"
            );


        if (
            !syncButton ||
            !githubButton
        ) {

            return;
        }


        if (result.connected) {

            status.textContent =
                "GitHub: ✓ Connected";


            githubButton.style.display =
                "none";


            // Sync remains disabled
            // until repository is selected

            syncButton.disabled =
                true;


            await loadRepositories();

        } else {

            status.textContent =
                "GitHub: Not connected";


            githubButton.style.display =
                "block";


            syncButton.disabled =
                true;
        }

    } catch (error) {

        console.error(error);


        status.textContent =
            "GitHub: Unable to check status";
    }
}


// =========================================
// RESTORE / RENDER SYNC STATE
// =========================================

function renderRunningState(
    syncState
) {

    const status =
        document.getElementById(
            "github-status"
        );

    if (!status) {
        return;
    }


    const processed =
        Math.max(
            0,
            safeNumber(
                syncState?.processed,
                0
            )
        );


    const total =
        Math.max(
            0,
            safeNumber(
                syncState?.total,
                0
            )
        );


    const percent =
        safePercent(
            processed,
            total
        );


    const problem =
        syncState?.problem ||
        "Syncing...";


    status.innerHTML = `

        <div class="sync-card">

            <div class="sync-card-header">

                <div class="sync-icon">
                    ⟳
                </div>

                <div class="sync-info">

                    <div class="sync-title">
                        Syncing LeetCode Solutions...
                    </div>

                    <div class="sync-subtitle">
                        Processing your solved problems
                    </div>

                </div>

                <div
                    id="sync-progress-text"
                    class="sync-count"
                >
                    ${processed} / ${total}
                </div>

            </div>


            <div class="sync-progress-row">

                <div class="sync-progress-track">

                    <div
                        id="sync-progress-bar"
                        class="sync-progress-bar"
                        style="width: ${percent}%"
                    ></div>

                </div>

                <div
                    id="sync-progress-percent"
                    class="sync-percent"
                >
                    ${percent}%
                </div>

            </div>


            <div
                id="sync-current-problem"
                class="sync-current-problem"
            >
                Syncing: ${escapeHTML(problem)}
            </div>


            <button
                id="stop-sync"
                type="button"
            >
                Stop Sync
            </button>

        </div>
    `;


    syncInProgress =
        true;


    setControlsDisabled(
        true
    );


    const stopButton =
        document.getElementById(
            "stop-sync"
        );


    if (stopButton) {

        stopButton.addEventListener(
            "click",
            stopSync
        );
    }
}


function renderCompletedState(
    syncState
) {

    const status =
        document.getElementById(
            "github-status"
        );

    if (!status) {
        return;
    }


    const summary =
        syncState?.summary || {};


    const processed =
        Math.max(
            0,
            safeNumber(
                summary.processed,
                syncState?.processed || 0
            )
        );


    const newSolutions =
        Math.max(
            0,
            safeNumber(
                summary.newSolutions,
                0
            )
        );


    const alreadySynced =
        Math.max(
            0,
            safeNumber(
                summary.alreadySynced,
                0
            )
        );


    const skippedWithoutAccepted =
        Math.max(
            0,
            safeNumber(
                summary.skippedWithoutAccepted,
                0
            )
        );


    const failedProblems =
        Math.max(
            0,
            safeNumber(
                summary.failedProblems,
                0
            )
        );


    const github =
        summary.github ||
        "Completed";


    status.innerHTML = `

        <div class="sync-card">

            <div class="sync-card-header">

                <div class="sync-icon">
                    ✓
                </div>

                <div class="sync-info">

                    <div class="sync-title">
                        Sync completed
                    </div>

                    <div class="sync-subtitle">
                        Your LeetCode progress is up to date
                    </div>

                </div>

            </div>


            <div class="sync-result">

                <div class="sync-result-row">

                    <span>
                        Problems processed
                    </span>

                    <strong>
                        ${processed}
                    </strong>

                </div>


                <div class="sync-result-row">

                    <span>
                        New solutions added
                    </span>

                    <strong>
                        ${newSolutions}
                    </strong>

                </div>


                <div class="sync-result-row">

                    <span>
                        Already synced
                    </span>

                    <strong>
                        ${alreadySynced}
                    </strong>

                </div>


                <div class="sync-result-row">

                    <span>
                        No accepted submission
                    </span>

                    <strong>
                        ${skippedWithoutAccepted}
                    </strong>

                </div>


                <div class="sync-result-row">

                    <span>
                        Failed problems
                    </span>

                    <strong>
                        ${failedProblems}
                    </strong>

                </div>


                <div class="sync-result-row">

                    <span>
                        GitHub sync
                    </span>

                    <strong>
                        ${escapeHTML(github)}
                    </strong>

                </div>

            </div>


            <div class="sync-progress-row">

                <div class="sync-progress-track">

                    <div
                        class="sync-progress-bar"
                        style="width: 100%;"
                    ></div>

                </div>

                <div class="sync-percent">
                    100%
                </div>

            </div>

        </div>
    `;


    syncInProgress =
        false;


    setControlsDisabled(
        false
    );
}


function renderFailedState(
    syncState
) {

    const status =
        document.getElementById(
            "github-status"
        );

    if (!status) {
        return;
    }


    const processed =
        Math.max(
            0,
            safeNumber(
                syncState?.processed,
                0
            )
        );


    const total =
        Math.max(
            0,
            safeNumber(
                syncState?.total,
                0
            )
        );


    const error =
        syncState?.error ||
        "Sync failed. Please try again.";


    status.innerHTML = `

        <div class="sync-card">

            <div class="sync-card-header">

                <div class="sync-icon">
                    !
                </div>

                <div class="sync-info">

                    <div class="sync-title">
                        Sync failed
                    </div>

                    <div class="sync-subtitle">
                        ${escapeHTML(error)}
                    </div>

                </div>

            </div>


            <div class="sync-current-problem">

                Progress when stopped:
                ${processed} / ${total}

            </div>

        </div>
    `;


    syncInProgress =
        false;


    setControlsDisabled(
        false
    );
}


async function renderSyncState(
    syncState
) {

    if (
        !syncState ||
        typeof syncState !==
        "object"
    ) {

        return;
    }


    try {

        switch (
            syncState.status
            ) {

            case "starting":
            case "running":
            case "stopping":

                renderRunningState(
                    syncState
                );

                break;


            case "completed":

                renderCompletedState(
                    syncState
                );

                break;


            case "failed":

                renderFailedState(
                    syncState
                );

                break;


            case "stopped":

                renderFailedState({

                    ...syncState,

                    error:
                        syncState?.error ||
                        "Sync stopped."
                });

                break;


            default:

                break;
        }

    } catch (error) {

        console.error(
            "Failed to render sync state:",
            error
        );
    }
}


async function restoreSyncState() {

    try {

        const data =
            await chrome.storage.local.get([
                "syncState"
            ]);

        await renderSyncState(
            data?.syncState
        );

    } catch (error) {

        console.error(
            "Failed to restore sync state:",
            error
        );
    }
}


// =========================================
// STORAGE STATE UPDATES
// =========================================

chrome.storage.onChanged.addListener(
    (
        changes,
        areaName
    ) => {

        if (
            areaName !== "local" ||
            !changes.syncState
        ) {

            return;
        }


        void renderSyncState(
            changes.syncState.newValue
        );
    }
);


// =========================================
// LOAD GITHUB REPOSITORIES
// =========================================

async function loadRepositories() {

    try {

        const response =
            await apiFetch(
                API_BASE_URL +
                "/github/api/repositories",
                {
                    method: "GET"
                }
            );


        if (!response.ok) {

            console.error(
                "Failed to load repositories"
            );

            return;
        }


        const repositories =
            await response.json();


        const repositorySelect =
            document.getElementById(
                "repository"
            );


        if (!repositorySelect) {
            return;
        }


        repositorySelect.innerHTML =
            `
                <option value="">
                    Select repository
                </option>
            `;


        if (
            !Array.isArray(
                repositories
            )
        ) {

            console.error(
                "Invalid repository response"
            );

            return;
        }


        repositories.forEach(
            repository => {

                if (
                    !repository ||
                    !repository.full_name
                ) {

                    return;
                }


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    repository.full_name;


                option.textContent =
                    repository.full_name;


                repositorySelect.appendChild(
                    option
                );
            }
        );


        // Restore the previously selected repository.

        const saved =
            await chrome.storage.local.get([
                "selectedRepository"
            ]);


        if (
            saved?.selectedRepository
        ) {

            const exists =
                Array.from(
                    repositorySelect.options
                ).some(
                    option =>
                        option.value ===
                        saved.selectedRepository
                );


            if (exists) {

                repositorySelect.value =
                    saved.selectedRepository;
            }
        }


        // Enable repository dropdown.

        repositorySelect.disabled =
            false;


        repositorySelect.addEventListener(
            "change",
            () => {

                const syncButton =
                    document.getElementById(
                        "sync"
                    );


                if (syncButton) {

                    syncButton.disabled =
                        !repositorySelect.value;
                }


                void chrome.storage.local.set({
                    selectedRepository:
                    repositorySelect.value
                });


                void saveRepository(
                    repositorySelect.value
                );
            }
        );


        // If sync is already running,
        // immediately lock the repository again.

        void chrome.storage.local.get([
            "syncState"
        ]).then(
            data => {

                if (
                    data?.syncState?.status ===
                    "running"
                ) {

                    setControlsDisabled(
                        true
                    );
                }
            }
        );

    } catch (error) {

        console.error(
            "Failed to load repositories:",
            error
        );
    }
}


// =========================================
// SAVE SELECTED REPOSITORY
// =========================================

async function saveRepository(
    fullName
) {

    if (!fullName) {

        return;
    }


    const parts =
        fullName.split("/");


    if (
        parts.length !== 2 ||
        !parts[0] ||
        !parts[1]
    ) {

        console.error(
            "Invalid repository name:",
            fullName
        );

        return;
    }


    const owner =
        parts[0];


    const repository =
        parts[1];


    try {

        const response =
            await apiFetch(
                API_BASE_URL +
                "/github/api/repository",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        owner:
                        owner,

                        repository:
                        repository
                    })
                }
            );


        if (!response.ok) {

            console.error(
                "Failed to save repository:",
                response.status
            );

            return;
        }


        console.log(
            "Repository saved:",
            fullName
        );

    } catch (error) {

        console.error(
            "Failed to save repository:",
            error
        );
    }
}


// =========================================
// REGISTER
// =========================================

async function register() {

    const username =
        document.getElementById(
            "register-username"
        ).value.trim();


    const password =
        document.getElementById(
            "register-password"
        ).value;


    const message =
        document.getElementById(
            "message"
        );


    if (
        !username ||
        !password
    ) {

        message.textContent =
            "Please fill all fields";

        return;
    }


    try {

        const response =
            await fetchWithTimeout(
                API_BASE_URL + "/users",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        username:
                        username,

                        password:
                        password
                    })
                }
            );


        if (!response.ok) {

            if (response.status === 409) {

                message.textContent =
                    "Username is already taken";

                return;
            }


            const error =
                await response.text();


            console.error(
                error
            );


            message.textContent =
                "Could not create account";

            return;
        }


        message.textContent =
            "Account created successfully!";


        setTimeout(
            () => {

                showLogin();

            },
            1000
        );

    } catch (error) {

        console.error(error);


        message.textContent =
            "Could not connect to server";
    }
}


// =========================================
// LOGIN SCREEN
// =========================================

function showLogin() {

    syncInProgress =
        false;


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


        <br><br>


        <button id="register">
            Create account
        </button>


        <p id="message"></p>
    `;


    document
        .getElementById("login")
        .addEventListener(
            "click",
            login
        );


    document
        .getElementById("register")
        .addEventListener(
            "click",
            showRegister
        );
}


// =========================================
// LOGIN
// =========================================

async function login() {

    const username =
        document.getElementById(
            "username"
        ).value.trim();


    const password =
        document.getElementById(
            "password"
        ).value;


    const message =
        document.getElementById(
            "message"
        );


    if (
        !username ||
        !password
    ) {

        message.textContent =
            "Enter username and password";

        return;
    }


    try {

        const response =
            await fetchWithTimeout(
                API_BASE_URL + "/auth/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password
                    })
                }
            );


        if (!response.ok) {

            message.textContent =
                "Invalid username or password";

            return;
        }


        const result =
            await response.json();


        if (
            !result?.accessToken
        ) {

            throw new Error(
                "Login response did not contain an access token."
            );
        }


        await chrome.storage.local.set({

            jwt:
            result.accessToken,

            refreshToken:
            result.refreshToken,

            username:
            username
        });


        showLoggedIn(
            username
        );

    } catch (error) {

        console.error(error);


        message.textContent =
            "Could not connect to server";
    }
}


// =========================================
// LOGOUT
// =========================================

async function logout() {

    if (syncInProgress) {

        return;
    }


    const syncState =
        await chrome.storage.local.get([
            "syncState"
        ]);


    if (
        syncState?.syncState?.status ===
        "running"
    ) {

        return;
    }


    await chrome.storage.local.remove([

        "jwt",

        "refreshToken",

        "username",

        "selectedRepository",

        "syncState"
    ]);


    showLogin();
}


// =========================================
// CHECK LOGIN WHEN POPUP OPENS
// =========================================

chrome.storage.local.get(
    [
        "jwt",
        "username"
    ],
    (data) => {

        if (data.jwt) {

            showLoggedIn(
                data.username
            );

        } else {

            showLogin();
        }
    }
);


// =========================================
// CONNECT GITHUB
// =========================================

async function connectGitHub() {

    try {

        const response =
            await apiFetch(
                API_BASE_URL +
                "/github/connect-url",
                {
                    method: "GET"
                }
            );


        if (!response.ok) {

            console.error(
                "Failed to get GitHub authorization URL:",
                response.status
            );

            return;
        }


        const authorizationUrl =
            await response.text();


        if (
            !authorizationUrl
        ) {

            throw new Error(
                "GitHub authorization URL was empty."
            );
        }


        window.open(
            authorizationUrl,
            "_blank"
        );

    } catch (error) {

        console.error(
            "GitHub connection failed:",
            error
        );
    }
}


// =========================================
// STOP SYNC
// =========================================

// =========================================
// STOP SYNC
// =========================================

async function stopSync() {

    if (!syncInProgress) {
        return;
    }


    const stopButton =
        document.getElementById(
            "stop-sync"
        );


    if (stopButton) {

        stopButton.disabled =
            true;

        stopButton.textContent =
            "Stopping...";
    }


    try {

        await saveSyncState({

            status:
                "stopping",

            problem:
                "Stopping sync..."
        });


        // Send the stop request through the
        // background service worker.
        //
        // The background worker finds the
        // correct LeetCode tab and sends
        // STOP_SYNC to content.js.

        const response =
            await chrome.runtime.sendMessage({

                type:
                    "STOP_SYNC"
            });


        if (
            !response ||
            response.success !== true
        ) {

            throw new Error(
                response?.message ||
                "Could not stop sync."
            );
        }


        console.log(
            "Stop request delivered:",
            response.message
        );


    } catch (error) {

        console.error(
            "Could not stop sync:",
            error
        );


        const current =
            await chrome.storage.local.get([
                "syncState"
            ]);


        const previous =
            current?.syncState || {};


        await saveSyncState({

            status:
                "failed",

            processed:
                safeNumber(
                    previous.processed,
                    0
                ),

            total:
                safeNumber(
                    previous.total,
                    0
                ),

            problem:
                "Could not stop sync",

            error:
                error?.message ||
                "Could not stop sync."
        });
    }
}
// =========================================
// SYNC NOW
// =========================================

async function syncNow() {

    // Prevent multiple syncs.

    if (syncInProgress) {

        return;
    }


    const status =
        document.getElementById(
            "github-status"
        );


    const syncButton =
        document.getElementById(
            "sync"
        );


    const repositorySelect =
        document.getElementById(
            "repository"
        );


    const logoutButton =
        document.getElementById(
            "logout"
        );


    if (
        !status ||
        !syncButton ||
        !repositorySelect ||
        !logoutButton
    ) {

        console.error(
            "Sync UI elements are missing."
        );

        return;
    }


    // =====================================
    // CHECK PERSISTED STATE
    // =====================================

    try {

        const currentState =
            await chrome.storage.local.get([
                "syncState"
            ]);


        if (
            currentState?.syncState?.status ===
            "starting" ||
            currentState?.syncState?.status ===
            "running"
        ) {

            syncInProgress =
                true;


            await renderSyncState(
                currentState.syncState
            );

            return;
        }

    } catch (error) {

        console.error(
            "Could not check current sync state:",
            error
        );
    }


    // =====================================
    // LOCK CONTROLS
    // =====================================

    syncInProgress =
        true;


    setControlsDisabled(
        true
    );


    // =====================================
    // SHOW INITIAL SYNC CARD
    // =====================================

    status.innerHTML = `

        <div class="sync-card">

            <div class="sync-card-header">

                <div class="sync-icon">
                    ⟳
                </div>

                <div class="sync-info">

                    <div class="sync-title">
                        Syncing LeetCode Solutions...
                    </div>

                    <div class="sync-subtitle">
                        Processing your solved problems
                    </div>

                </div>

                <div
                    id="sync-progress-text"
                    class="sync-count"
                >
                    0 / 0
                </div>

            </div>


            <div class="sync-progress-row">

                <div class="sync-progress-track">

                    <div
                        id="sync-progress-bar"
                        class="sync-progress-bar"
                        style="width: 0%;"
                    ></div>

                </div>


                <div
                    id="sync-progress-percent"
                    class="sync-percent"
                >
                    0%
                </div>

            </div>


            <div
                id="sync-current-problem"
                class="sync-current-problem"
            >
                Starting sync...
            </div>


            <button
                id="stop-sync"
                type="button"
            >
                Stop Sync
            </button>

        </div>
    `;


    // =====================================
    // SAVE STARTING STATE
    // =====================================

    await saveSyncState({

        status:
            "starting",

        processed:
            0,

        total:
            0,

        problem:
            "Starting sync..."
    });


    // =====================================
    // STOP BUTTON
    // =====================================

    const initialStopButton =
        document.getElementById(
            "stop-sync"
        );


    if (initialStopButton) {

        initialStopButton.addEventListener(
            "click",
            stopSync
        );
    }


    // =====================================
    // START SYNC THROUGH BACKGROUND
    // =====================================

    try {

        console.log(
            "Requesting background service worker to start sync..."
        );


        const response =
            await chrome.runtime.sendMessage({

                type:
                    "START_SYNC"
            });


        if (
            !response ||
            response.success !== true
        ) {

            throw new Error(
                response?.message ||
                "Could not start sync."
            );
        }


        console.log(
            "Sync started:",
            response.message
        );


        // IMPORTANT:
        //
        // Do NOT wait for the entire sync here.
        //
        // background.js -> content.js starts
        // the long-running sync.
        //
        // content.js writes progress into
        // chrome.storage.local.
        //
        // The storage listener above updates
        // this Side Panel automatically.

        return;


    } catch (error) {

        console.error(
            "Sync failed:",
            error
        );


        const errorMessage =
            error?.message ||
            "Sync failed.";


        let previous = {};


        try {

            const current =
                await chrome.storage.local.get([
                    "syncState"
                ]);


            previous =
                current?.syncState ||
                {};

        } catch (storageError) {

            console.error(
                "Could not read sync state:",
                storageError
            );
        }


        const failedState = {

            status:
                "failed",

            processed:
                safeNumber(
                    previous.processed,
                    0
                ),

            total:
                safeNumber(
                    previous.total,
                    0
                ),

            problem:
                previous.problem ||
                "Sync failed",

            error:
            errorMessage
        };


        await saveSyncState(
            failedState
        );


        renderFailedState(
            failedState
        );

    } finally {

        // Do not unlock controls if the
        // background/content script has
        // already started the sync.

        try {

            const latest =
                await chrome.storage.local.get([
                    "syncState"
                ]);


            if (
                latest?.syncState?.status !==
                "starting" &&
                latest?.syncState?.status !==
                "running" &&
                latest?.syncState?.status !==
                "stopping"
            ) {

                syncInProgress =
                    false;

                setControlsDisabled(
                    false
                );
            }

        } catch (error) {

            console.error(
                "Could not check latest sync state:",
                error
            );

        }
    }
}