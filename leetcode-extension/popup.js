const loginSection = document.getElementById("login-section");

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


        const progressRing =
            document.getElementById(
                "progress-ring"
            );


        if (progressRing) {

            progressRing.style
                .setProperty(
                    "--progress",
                    percent
                );
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

    chrome.storage.local.get(["lastSyncSummary"]).then((data) => {

        const summary = data?.lastSyncSummary;

        if (!summary) {
            return;
        }

        const newEl =
            document.getElementById("stat-new");

        const alreadyEl =
            document.getElementById("stat-already");

        const statusEl =
            document.getElementById("stat-status");

        const numberEl =
            document.getElementById("stat-number");

        const captionEl =
            document.getElementById("stat-caption");

        if (newEl) {
            newEl.textContent =
                summary.newSolutions ?? 0;
        }

        if (alreadyEl) {
            alreadyEl.textContent =
                summary.alreadySynced ?? 0;
        }

        if (numberEl) {
            numberEl.textContent =
                summary.processed ?? 0;
        }

        if (captionEl) {
            captionEl.textContent =
                "Solutions processed in your latest sync.";
        }

        if (statusEl) {
            statusEl.textContent =
                "Synced";
        }
    });

    const safeUsername =
        escapeHTML(
            username || "Developer"
        );


    const initial =
        escapeHTML(
            (username || "D")
                .charAt(0)
                .toUpperCase()
        );


    loginSection.innerHTML = `

        <section class="dashboard-page">

            <div class="page-intro">

                <p class="eyebrow">
                    Welcome back
                </p>

                <h1 class="page-title">
                    Your LeetCode journey
                </h1>

                <p class="page-subtitle">
                    Keep your accepted solutions
                    backed up on GitHub.
                </p>

            </div>


            <!-- USER -->

            <div class="card user-card">

                <div class="avatar">
                    ${initial}
                </div>


                <div class="user-info">

                    <div class="user-name">
                        ${safeUsername}
                    </div>


                    <div class="user-label">
                        LeetCode account
                    </div>


                    <span class="status-pill">

                        <span class="status-dot"></span>

                        Logged in

                    </span>

                </div>

            </div>


            <!-- SOLVED -->

            <div class="section">

                <div
                    class="card stat-card"
                    id="sync-summary-card"
                >

                    <div
                        class="stat-kicker"
                        id="stat-kicker"
                    >
                        LeetGit is ready
                    </div>


                    <div
                        class="stat-number"
                        id="stat-number"
                    >
                        —
                    </div>


                    <div
                        class="stat-caption"
                        id="stat-caption"
                    >
                        Accepted solutions will
                        appear here after your
                        first sync.
                    </div>


                    <div class="stat-divider"></div>


                    <div class="difficulty-row">

                        <div class="difficulty">

                            <div class="difficulty-name">
                                New
                            </div>

                            <div
                                class="difficulty-value"
                                id="stat-new"
                            >
                                —
                            </div>

                        </div>


                        <div class="difficulty">

                            <div class="difficulty-name">
                                Already synced
                            </div>

                            <div
                                class="difficulty-value"
                                id="stat-already"
                            >
                                —
                            </div>

                        </div>


                        <div class="difficulty">

                            <div class="difficulty-name">
                                Status
                            </div>

                            <div
                                class="difficulty-value"
                                id="stat-status"
                            >
                                Ready
                            </div>

                        </div>

                    </div>

                </div>

            </div>


            <!-- GITHUB -->

            <div class="section">

                <div class="section-label">

                    <span>
                        GitHub
                    </span>

                    <span id="github-mini-label">
                        Connection
                    </span>

                </div>


                <div class="card github-card">

                    <div class="github-row">

                        <div class="github-icon">
                            ◉
                        </div>


                        <div class="github-info">

                            <div class="github-title">
                                GitHub Connection
                            </div>


                            <div
                                class="github-subtitle"
                                id="github-status-text"
                            >
                                Checking connection...
                            </div>

                        </div>


                        <span
                            class="connected-pill"
                            id="github-pill"
                            style="display:none"
                        >

                            <span class="status-dot"></span>

                            Connected

                        </span>

                    </div>


                    <button
                        id="github"
                        class="secondary-button"
                        type="button"
                        style="margin-top:12px;"
                    >
                        Connect GitHub
                    </button>


                    <div class="repo-wrap">

                        <label
                            class="repo-label"
                            for="repository"
                        >
                            Sync repository
                        </label>


                        <select
                            id="repository"
                            disabled
                        >

                            <option value="">
                                Select repository
                            </option>

                        </select>

                    </div>

                </div>

            </div>


            <!-- SYNC -->

            <button
                id="sync"
                class="primary-button"
                type="button"
                disabled
            >

                <span class="primary-main">
                    ↻ &nbsp; Sync Now
                </span>


                <span class="primary-sub">
                    Fetch accepted solutions
                    and push to GitHub
                </span>

            </button>


            <div
                class="last-sync"
                id="last-sync"
            >
                No sync completed yet
            </div>


            <button
                id="logout"
                class="text-button"
                type="button"
            >
                Log out
            </button>


            <p
                id="message"
                class="message"
            ></p>

        </section>
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

            const data =
                await chrome.storage.local.get([
                    "syncState"
                ]);


            const syncState =
                data?.syncState;


            if (

                syncState?.status ===
                "starting"

                ||

                syncState?.status ===
                "running"

                ||

                syncState?.status ===
                "stopping"

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

        <section class="auth-card card">

            <div class="auth-icon">
                ✨
            </div>


            <h1 class="auth-title">
                Create your account
            </h1>


            <p class="auth-subtitle">
                Start syncing your LeetCode journey
                with GitHub using LeetGit.
            </p>


            <div class="form-group">

                <label
                    class="form-label"
                    for="register-username"
                >
                    Username
                </label>


                <input
                    id="register-username"
                    type="text"
                    placeholder="Choose a username"
                >

            </div>


            <div class="form-group">

                <label
                    class="form-label"
                    for="register-password"
                >
                    Password
                </label>


                <div class="password-wrapper">

    <input
        id="register-password"
        type="password"
        placeholder="Create a password"
    >

    <button
        type="button"
        class="password-toggle"
        id="toggle-register-password"
        aria-label="Show password"
    >
        👁
    </button>

</div>

            </div>


            <div class="auth-actions">

                <button
                    id="create-account"
                    class="primary-button"
                    type="button"
                >

                    <span class="primary-main">
                        Create Account
                    </span>

                </button>


                <button
                    id="back-to-login"
                    class="secondary-button"
                    type="button"
                >
                    ← Back to Login
                </button>

            </div>


            <p
                id="message"
                class="message"
            ></p>

        </section>
    `;


    document
        .getElementById("toggle-register-password")
        ?.addEventListener(
            "click",
            () => {

                const input =
                    document.getElementById(
                        "register-password"
                    );F

                const button =
                    document.getElementById(
                        "toggle-register-password"
                    );

                if (!input) return;

                if (input.type === "password") {

                    input.type = "text";

                    button.textContent = "🙈";

                    button.setAttribute(
                        "aria-label",
                        "Hide password"
                    );

                } else {

                    input.type = "password";

                    button.textContent = "👁";

                    button.setAttribute(
                        "aria-label",
                        "Show password"
                    );
                }
            }
        );

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
            "github-status-text"
        );


    const githubPill =
        document.getElementById(
            "github-pill"
        );


    const githubButton =
        document.getElementById(
            "github"
        );


    const syncButton =
        document.getElementById(
            "sync"
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
                "Unable to check GitHub status";


            if (githubPill) {

                githubPill.style.display =
                    "none";
            }


            if (githubButton) {

                githubButton.style.display =
                    "block";
            }


            return;
        }


        const result =
            await response.json();


        if (result.connected) {

            status.textContent =
                "Your GitHub account is connected";


            if (githubPill) {

                githubPill.style.display =
                    "inline-flex";
            }


            if (githubButton) {

                githubButton.style.display =
                    "none";
            }


            if (syncButton) {

                syncButton.disabled =
                    true;
            }


            await loadRepositories();

        } else {

            status.textContent =
                "Connect GitHub to start syncing";


            if (githubPill) {

                githubPill.style.display =
                    "none";
            }


            if (githubButton) {

                githubButton.style.display =
                    "block";
            }


            if (syncButton) {

                syncButton.disabled =
                    true;
            }
        }

    } catch (error) {

        console.error(error);


        status.textContent =
            "Unable to check GitHub status";


        if (githubPill) {

            githubPill.style.display =
                "none";
        }


        if (githubButton) {

            githubButton.style.display =
                "block";
        }


        if (syncButton) {

            syncButton.disabled =
                true;
        }
    }
}


// =========================================
// RESTORE / RENDER SYNC STATE
// =========================================

function renderRunningState(
    syncState
) {

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
        escapeHTML(
            syncState?.problem ||
            "Starting sync..."
        );


    loginSection.innerHTML = `

        <section class="sync-page">

            <div class="back-row">

                <button
                    class="back-button"
                    id="sync-back"
                    type="button"
                    aria-label="Back"
                >
                    ‹
                </button>


                <div>

                    <p class="eyebrow">
                        LeetGit Sync
                    </p>


                    <h1 class="page-title">
                        Sync Progress
                    </h1>

                </div>

            </div>


            <p class="page-subtitle">
                Fetching your accepted solutions
                and pushing them to GitHub.
            </p>


            <div class="card sync-card">

                <div class="sync-top">

                    <div>

                        <div class="sync-heading">
                            Syncing in progress...
                        </div>


                        <div class="sync-subheading">
                            Processing your LeetCode solutions
                        </div>

                    </div>


                    <span class="status-pill">

                        <span class="status-dot"></span>

                        Live

                    </span>

                </div>


                <div class="sync-stage">

                    <div class="progress-layout">

                        <div
                            class="progress-ring"
                            id="progress-ring"
                            style="--progress:${percent}"
                        >

                            <span
                                class="progress-value"
                                id="sync-progress-percent"
                            >
                                ${percent}%
                            </span>

                        </div>


                        <div class="progress-details">

                            <div
                                class="progress-status"
                                id="sync-stage-status"
                            >
                                Processing files
                            </div>


                            <div
                                class="progress-caption"
                                id="sync-current-problem"
                            >
                                ${problem}
                            </div>


                            <div
                                class="progress-count"
                                id="sync-progress-text"
                            >
                                ${processed} / ${total}
                            </div>

                        </div>

                    </div>


                    <div class="progress-track">

                        <div
                            class="progress-bar"
                            id="sync-progress-bar"
                            style="width:${percent}%"
                        ></div>

                    </div>

                </div>

            </div>


            <div class="activity-card">

                <div class="activity-title">
                    Current activity
                </div>


                <div
                    class="activity-list"
                    id="sync-activity-list"
                >

                    <div class="activity-item current">

                        <span class="activity-icon">
                            ◉
                        </span>


                        <span>
                            ${problem}
                        </span>

                    </div>

                </div>

            </div>


            <div class="info-banner">

                <strong>
                    ⓘ Keep LeetGit open
                </strong>


                Closing this panel may interrupt
                the sync process.

            </div>


            <button
                id="stop-sync"
                class="danger-button"
                type="button"
                style="margin-top:11px;"
            >
                ■ &nbsp; Cancel Sync
            </button>

        </section>
    `;


    document
        .getElementById("sync-back")
        ?.addEventListener(
            "click",
            async () => {

                const data =
                    await chrome.storage.local.get([
                        "username"
                    ]);


                showLoggedIn(
                    data?.username ||
                    "Developer"
                );

            }
        );


    document
        .getElementById("stop-sync")
        ?.addEventListener(
            "click",
            stopSync
        );


    syncInProgress = true;


    setControlsDisabled(
        true
    );
}


function renderCompletedState(
    syncState
) {

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


    const failedProblems =
        Math.max(
            0,
            safeNumber(
                summary.failedProblems,
                0
            )
        );

    chrome.storage.local.set({
        lastSyncSummary: {
            processed,
            newSolutions,
            alreadySynced,
            failedProblems
        }
    });

    loginSection.innerHTML = `

        <section class="sync-page">

            <div class="back-row">

                <button
                    class="back-button"
                    id="sync-back"
                    type="button"
                >
                    ‹
                </button>


                <div>

                    <p class="eyebrow">
                        LeetGit Sync
                    </p>


                    <h1 class="page-title">
                        Sync Complete
                    </h1>

                </div>

            </div>


            <div
                class="card sync-card sync-result-hero"
            >

                <div class="success-mark">
                    ✓
                </div>


                <div class="result-title">
                    Sync completed successfully
                </div>


                <div class="result-subtitle">
                    Your LeetCode solutions have
                    been processed.
                </div>


                <div class="result-number">
                    ${processed}
                </div>


                <div class="result-number-label">
                    solutions processed
                </div>


                <div class="result-grid">

                    <div class="result-mini">

                        <strong>
                            ${newSolutions}
                        </strong>


                        <span>
                            New solutions
                        </span>

                    </div>


                    <div class="result-mini">

                        <strong>
                            ${alreadySynced}
                        </strong>


                        <span>
                            Already synced
                        </span>

                    </div>


                    <div class="result-mini">

                        <strong>
                            ${failedProblems}
                        </strong>


                        <span>
                            Failed
                        </span>

                    </div>


                    <div class="result-mini">

                        <strong>
                            100%
                        </strong>


                        <span>
                            Sync finished
                        </span>

                    </div>

                </div>

            </div>


            <div class="tip-banner">

                <strong>
                    💡 Tip
                </strong>


                Only accepted solutions are synced,
                keeping your repository clean.

            </div>


            <button
                id="done-sync"
                class="primary-button"
                type="button"
            >

                <span class="primary-main">
                    Done
                </span>


                <span class="primary-sub">
                    Return to LeetGit
                </span>

            </button>

        </section>
    `;


    const goBack =
        async () => {

            await chrome.storage.local.remove([
                "syncState"
            ]);

            const data =
                await chrome.storage.local.get([
                    "username"
                ]);

            showLoggedIn(
                data?.username ||
                "Developer"
            );

        };


    document
        .getElementById("sync-back")
        ?.addEventListener(
            "click",
            goBack
        );


    document
        .getElementById("done-sync")
        ?.addEventListener(
            "click",
            goBack
        );


    syncInProgress = false;
}


function renderFailedState(
    syncState
) {

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
        escapeHTML(
            syncState?.error ||
            "Sync failed. Please try again."
        );


    loginSection.innerHTML = `

        <section class="sync-page">

            <div class="back-row">

                <button
                    class="back-button"
                    id="sync-back"
                    type="button"
                >
                    ‹
                </button>


                <div>

                    <p class="eyebrow">
                        LeetGit Sync
                    </p>


                    <h1 class="page-title">
                        Sync failed
                    </h1>

                </div>

            </div>


            <div
                class="card sync-card sync-result-hero"
            >

                <div class="error-mark">
                    !
                </div>


                <div class="result-title">
                    We couldn't finish the sync
                </div>


                <div class="result-subtitle">
                    ${error}
                </div>


                <div class="result-number">
                    ${processed}/${total}
                </div>


                <div class="result-number-label">
                    solutions processed
                    before stopping
                </div>

            </div>


            <button
                id="retry-sync"
                class="primary-button"
                type="button"
            >

                <span class="primary-main">
                    ↻ Try Again
                </span>


                <span class="primary-sub">
                    Return to the sync screen
                </span>

            </button>

        </section>
    `;


    const goBack =
        async () => {

            await chrome.storage.local.remove([
                "syncState"
            ]);

            const data =
                await chrome.storage.local.get([
                    "username"
                ]);

            showLoggedIn(
                data?.username ||
                "Developer"
            );

        };


    document
        .getElementById("sync-back")
        ?.addEventListener(
            "click",
            goBack
        );


    document
        .getElementById("retry-sync")
        ?.addEventListener(
            "click",
            goBack
        );


    syncInProgress = false;
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

        const syncButton =
            document.getElementById("sync");

        if (syncButton) {
            syncButton.disabled =
                !repositorySelect.value;
        }


        repositorySelect.addEventListener(
            "change",
            () => {

                const syncButton =
                    document.getElementById("sync");

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

    syncInProgress = false;


    loginSection.innerHTML = `

        <section class="auth-card card">

            <div class="auth-icon">
                ⚡
            </div>


            <h1 class="auth-title">
                Welcome to LeetGit
            </h1>


            <p class="auth-subtitle">
                Sync your accepted LeetCode solutions
                directly to your GitHub repository.
            </p>


           <div class="form-group">

    <label
        class="form-label"
        for="username"
    >
        Username
    </label>

    <input
        id="username"
        type="text"
        placeholder="Enter your username"
        autocomplete="username"
    >

</div>


<div class="form-group">

    <label
        class="form-label"
        for="password"
    >
        Password
    </label>

    <div class="password-wrapper">

        <input
            id="password"
            type="password"
            placeholder="Enter your password"
            autocomplete="current-password"
        >

        <button
            type="button"
            class="password-toggle"
            id="toggle-login-password"
            aria-label="Show password"
        >
            👁
        </button>

    </div>

</div>



            <div class="auth-actions">

                <button
                    id="login"
                    class="primary-button"
                    type="button"
                >

                    <span class="primary-main">
                        Login
                    </span>


                    <span class="primary-sub">
                        Continue to LeetGit
                    </span>

                </button>


                <button
                    id="register"
                    class="secondary-button"
                    type="button"
                >
                    Create an account
                </button>

            </div>


            <p
                id="message"
                class="message"
            ></p>

        </section>
    `;

    document
        .getElementById("toggle-login-password")
        ?.addEventListener(
            "click",
            () => {

                const input =
                    document.getElementById("password");

                const button =
                    document.getElementById(
                        "toggle-login-password"
                    );

                if (!input) return;

                if (input.type === "password") {

                    input.type = "text";

                    button.textContent = "🙈";

                    button.setAttribute(
                        "aria-label",
                        "Hide password"
                    );

                } else {

                    input.type = "password";

                    button.textContent = "👁";

                    button.setAttribute(
                        "aria-label",
                        "Show password"
                    );
                }
            }
        );

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

            message.textContent =
                "Invalid username or password";

            return;
        }


        const result =
            await response.json();


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

        console.error(
            "Login failed:",
            error
        );


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

        "syncState",

        "lastSyncSummary"

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


    // The storage listener will render the
    // new sync screen through renderSyncState().


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


        // Do not wait for the entire sync here.
        //
        // background.js -> content.js performs
        // the long-running sync and updates
        // chrome.storage.local with progress.

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

        // Do not unlock controls if the background
        // worker has already started the sync.

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