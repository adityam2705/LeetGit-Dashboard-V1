console.log("LeetCode Sync extension loaded");

const API_BASE_URL = "http://localhost:8080";

// =========================================
// NETWORK TIMEOUT
// =========================================

const REQUEST_TIMEOUT_MS = 30000;

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
            error &&
            error.name === "AbortError"
        ) {

            throw new Error(
                `Request timed out after ${timeoutMs / 1000} seconds: ${url}`
            );
        }

        throw error;

    } finally {

        clearTimeout(timeoutId);
    }
}



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
// LEETCODE GRAPHQL
// =========================================

async function leetcodeGraphQL(
    query,
    variables = {}
) {

    const response =
        await fetchWithTimeout(
            "https://leetcode.com/graphql/",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                credentials:
                    "include",

                body: JSON.stringify({

                    query:
                    query,

                    variables:
                    variables
                })
            }
        );


    if (!response.ok) {

        throw new Error(
            `LeetCode GraphQL request failed: ${response.status}`
        );
    }


    const result =
        await response.json();


    if (
        result.errors &&
        result.errors.length
    ) {

        throw new Error(
            result.errors
                .map(
                    error =>
                        error.message
                )
                .join("; ")
        );
    }


    return result.data;
}



// =========================================
// 1. FETCH SOLVED PROBLEMS
// =========================================

async function fetchSolvedProblems() {

    const allQuestions = [];

    const pageSize = 1000;

    let skip = 0;

    let totalNum = null;


    while (true) {

        const query = `
            query userProgressQuestionList(
                $filters: UserProgressQuestionListInput
            ) {

                userProgressQuestionList(
                    filters: $filters
                ) {

                    totalNum

                    questions {

                        frontendId
                        title
                        titleSlug
                        difficulty
                        lastSubmittedAt

                    }
                }
            }
        `;


        const variables = {

            filters: {

                skip:
                skip,

                limit:
                pageSize,

                questionStatus:
                    "SOLVED"
            }
        };


        const data =
            await leetcodeGraphQL(
                query,
                variables
            );


        const result =
            data?.userProgressQuestionList;


        if (!result) {

            throw new Error(
                "LeetCode returned an invalid progress response."
            );
        }


        const questions =
            Array.isArray(
                result.questions
            )
                ? result.questions
                : [];


        if (
            totalNum === null &&
            Number.isFinite(
                Number(
                    result.totalNum
                )
            )
        ) {

            totalNum =
                Number(
                    result.totalNum
                );
        }


        allQuestions.push(
            ...questions
        );


        console.log(
            `Solved problems received in this page: ${questions.length}`
        );


        if (
            questions.length === 0 ||
            questions.length < pageSize ||
            (
                totalNum !== null &&
                allQuestions.length >= totalNum
            )
        ) {

            break;
        }


        skip += pageSize;
    }


    console.log(
        `Total solved problems: ${allQuestions.length}`
    );


    return allQuestions;
}



// =========================================
// 2. SYNC PROBLEM
// =========================================

async function syncProblem(
    problem,
    token
) {

    const response =
        await apiFetch(
            API_BASE_URL +
            "/problems/sync",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    leetcodeId:
                        Number(
                            problem.frontendId
                        ),

                    title:
                    problem.title,

                    slug:
                    problem.titleSlug,

                    difficulty:
                    problem.difficulty,

                    lastSubmittedAt:
                    problem.lastSubmittedAt
                })
            }
        );


    if (!response.ok) {

        throw new Error(
            `Problem sync failed: ${response.status}`
        );
    }


    return await response.json();
}



// =========================================
// 3. FETCH SUBMISSIONS
// =========================================

async function fetchSubmissions(
    titleSlug
) {

    const allSubmissions = [];

    const pageSize = 20;

    let offset = 0;


    while (true) {

        const query = `
            query submissionList(
                $offset: Int!
                $limit: Int!
                $questionSlug: String!
            ) {

                submissionList(
                    offset: $offset
                    limit: $limit
                    questionSlug: $questionSlug
                ) {

                    submissions {

                        id
                        statusDisplay
                        lang
                        timestamp
                        runtime
                        memory

                    }
                }
            }
        `;


        const variables = {

            offset:
            offset,

            limit:
            pageSize,

            questionSlug:
            titleSlug
        };


        const data =
            await leetcodeGraphQL(
                query,
                variables
            );


        const submissions =
            data?.submissionList?.submissions;


        if (
            !Array.isArray(
                submissions
            )
        ) {

            break;
        }


        allSubmissions.push(
            ...submissions
        );


        if (
            submissions.length <
            pageSize
        ) {

            break;
        }


        offset += pageSize;
    }


    return allSubmissions;
}



// =========================================
// 4. FETCH SUBMISSION DETAILS
// =========================================

async function fetchSubmissionDetails(
    submissionId
) {

    const query = `
        query submissionDetails(
            $submissionId: Int!
        ) {

            submissionDetails(
                submissionId: $submissionId
            ) {

                code

                lang {
                    name
                }

                runtime
                memory
                statusDisplay

            }
        }
    `;


    const data =
        await leetcodeGraphQL(
            query,
            {
                submissionId:
                    Number(
                        submissionId
                    )
            }
        );


    return data?.submissionDetails;
}



// =========================================
// 5. SYNC SOLUTION
// =========================================

async function syncSolution(
    problem,
    submission,
    token
) {

    const response =
        await apiFetch(
            API_BASE_URL +
            "/solutions/sync/" +
            encodeURIComponent(
                problem.frontendId
            ),
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    leetcodeSubmissionId:
                    submission.submissionId,

                    code:
                    submission.code,

                    language:
                    submission.language,

                    submittedAt:
                    submission.submittedAt,

                    runtime:
                    submission.runtime,

                    memory:
                    submission.memory,

                    status:
                    submission.status
                })
            }
        );


    if (!response.ok) {

        throw new Error(
            `Solution sync failed: ${response.status}`
        );
    }


    return await response.json();
}



// =========================================
// 6. SEND SYNC PROGRESS
// =========================================

async function sendSyncProgress(
    processed,
    total,
    problem
) {

    try {

        await chrome.storage.local.set({

            syncState: {

                status:
                    "running",

                processed:
                processed,

                total:
                total,

                problem:
                problem
            }
        });

    } catch (error) {

        console.error(
            "Could not save sync progress:",
            error
        );
    }


    try {

        await chrome.runtime.sendMessage({

            type:
                "SYNC_PROGRESS",

            processed:
            processed,

            total:
            total,

            problem:
            problem
        });

    } catch (error) {

        // Popup/side panel may be closed.
        // Storage remains the source of truth.

        console.debug(
            "Could not send progress message:",
            error
        );
    }
}



// =========================================
// SYNC CANCELLATION
// =========================================

let syncCancellationRequested =
    false;


class SyncCancelledError extends Error {

    constructor() {

        super(
            "Sync stopped by user."
        );

        this.name =
            "SyncCancelledError";
    }
}


function throwIfSyncCancelled() {

    if (
        syncCancellationRequested
    ) {

        throw new SyncCancelledError();
    }
}


async function saveStoppedSyncState() {

    try {

        const current =
            await chrome.storage.local.get([
                "syncState"
            ]);


        const previous =
            current?.syncState ||
            {};


        await chrome.storage.local.set({

            syncState: {

                status:
                    "stopped",

                processed:
                    Number.isFinite(
                        Number(
                            previous.processed
                        )
                    )
                        ? Number(
                            previous.processed
                        )
                        : 0,

                total:
                    Number.isFinite(
                        Number(
                            previous.total
                        )
                    )
                        ? Number(
                            previous.total
                        )
                        : 0,

                problem:
                    "Sync stopped"
            }
        });

    } catch (error) {

        console.error(
            "Could not save stopped sync state:",
            error
        );
    }
}



// =========================================
// 7. HISTORICAL IMPORT
// =========================================

async function historicalImport(
    token
) {

    console.log(
        "Starting historical import..."
    );


    throwIfSyncCancelled();


    const problems =
        await fetchSolvedProblems();


    throwIfSyncCancelled();


    if (
        !Array.isArray(
            problems
        )
    ) {

        throw new Error(
            "LeetCode returned an invalid solved-problem list."
        );
    }


    console.log(
        `Found ${problems.length} solved problems`
    );


    let processed = 0;

    let newSolutions = 0;

    let alreadySynced = 0;

    let failedProblems = 0;

    let skippedWithoutAccepted = 0;


    await sendSyncProgress(
        0,
        problems.length,
        "Starting sync..."
    );


    for (
        const problem of problems
        ) {

        throwIfSyncCancelled();


        const problemLabel =
            `${problem?.frontendId || "?"}. ${problem?.title || "Unknown problem"}`;

        try {

            if (
                !problem ||
                !problem.frontendId ||
                !problem.titleSlug
            ) {

                throw new Error(
                    "Invalid problem data received from LeetCode."
                );
            }


            console.log(
                "======================================"
            );


            console.log(
                `${processed + 1}/${problems.length}`
            );


            console.log(
                `Processing: ${problem.title}`
            );


            console.log(
                `LeetCode ID: ${problem.frontendId}`
            );


            // -----------------------------------------
            // STEP 1
            // Sync problem + user_problem
            // -----------------------------------------

            const syncedProblem =
                await syncProblem(
                    problem,
                    token
                );


            throwIfSyncCancelled();


            // -----------------------------------------
            // STEP 2
            // Already synced to GitHub
            // -----------------------------------------

            if (
                syncedProblem &&
                syncedProblem.githubSynced === true
            ) {

                console.log(
                    `Already synced to GitHub: ${problem.title}`
                );


                console.log(
                    "Skipping submission fetch."
                );


                alreadySynced++;

            } else {


                // -----------------------------------------
                // STEP 3
                // Find an Accepted submission
                // Pagination is handled inside fetchSubmissions.
                // -----------------------------------------

                const submissions =
                    await fetchSubmissions(
                        problem.titleSlug
                    );


                throwIfSyncCancelled();


                const acceptedSubmission =
                    submissions.find(
                        submission =>
                            submission?.statusDisplay ===
                            "Accepted"
                    );


                if (
                    !acceptedSubmission
                ) {

                    console.log(
                        `No accepted submission found for ${problem.title}`
                    );


                    skippedWithoutAccepted++;

                } else {


                    console.log(
                        "Accepted submission:",
                        acceptedSubmission
                    );


                    // -----------------------------------------
                    // STEP 4
                    // Fetch complete submission details
                    // -----------------------------------------

                    const details =
                        await fetchSubmissionDetails(
                            acceptedSubmission.id
                        );


                    throwIfSyncCancelled();


                    if (
                        !details ||
                        !details.code
                    ) {

                        throw new Error(
                            "Accepted submission details did not contain source code."
                        );
                    }


                    // -----------------------------------------
                    // STEP 5
                    // Prepare solution
                    // -----------------------------------------

                    const submission = {

                        submissionId:
                            Number(
                                acceptedSubmission.id
                            ),

                        code:
                        details.code,

                        language:
                            details.lang?.name ||
                            acceptedSubmission.lang ||
                            "unknown",

                        submittedAt:
                            Number(
                                acceptedSubmission.timestamp
                            ) || 0,

                        runtime:
                            details.runtime ??
                            "",

                        memory:
                            details.memory ??
                            "",

                        status:
                            details.statusDisplay ||
                            acceptedSubmission.statusDisplay
                    };


                    // -----------------------------------------
                    // STEP 6
                    // Sync solution
                    // -----------------------------------------

                    await syncSolution(
                        problem,
                        submission,
                        token
                    );


                    throwIfSyncCancelled();


                    newSolutions++;


                    console.log(
                        `SUCCESS: ${problem.title}`
                    );
                }
            }

        } catch (error) {

            // Cancellation must escape the per-problem catch.

            if (
                error instanceof SyncCancelledError ||
                error?.name === "SyncCancelledError"
            ) {

                throw error;
            }


            failedProblems++;


            console.error(
                `FAILED: ${problemLabel}`,
                error
            );
        }


        // -----------------------------------------
        // ALWAYS advance progress
        // -----------------------------------------

        throwIfSyncCancelled();


        processed++;


        console.log(
            `${processed}/${problems.length}`
        );


        await sendSyncProgress(
            processed,
            problems.length,
            problemLabel
        );


        throwIfSyncCancelled();


        // No delay between problems.
        // Do not let an individual failure stop the import.

        if (
            processed <
            problems.length
        ) {

            throwIfSyncCancelled();
        }
    }


    console.log(
        "======================================"
    );


    console.log(
        "HISTORICAL IMPORT COMPLETE"
    );


    console.log(
        `Processed: ${processed}`
    );


    console.log(
        `New solutions: ${newSolutions}`
    );


    console.log(
        `Already synced: ${alreadySynced}`
    );


    console.log(
        `No accepted submission: ${skippedWithoutAccepted}`
    );


    console.log(
        `Failed problems: ${failedProblems}`
    );


    console.log(
        "======================================"
    );


    // =========================================
    // STEP 7
    // ONE BULK GITHUB SYNC
    // =========================================

    throwIfSyncCancelled();


    console.log(
        "Starting GitHub bulk sync..."
    );


    const githubResponse =
        await apiFetch(
            API_BASE_URL +
            "/github/sync",
            {
                method: "POST"
            }
        );


    throwIfSyncCancelled();


    if (
        !githubResponse.ok
    ) {

        throw new Error(
            `GitHub sync failed: ${githubResponse.status}`
        );
    }


    const githubResult =
        await githubResponse.text();


    console.log(
        "GitHub bulk sync completed:",
        githubResult
    );


    const summary = {

        processed:
        processed,

        newSolutions:
        newSolutions,

        alreadySynced:
        alreadySynced,

        skippedWithoutAccepted:
        skippedWithoutAccepted,

        failedProblems:
        failedProblems,

        github:
        githubResult
    };


    await chrome.storage.local.set({

        syncState: {

            status:
                "completed",

            processed:
            processed,

            total:
            problems.length,

            problem:
                "Sync completed",

            summary:
            summary
        }
    });


    return summary;
}



let historicalImportRunning = false;



// =========================================
// CONTENT SCRIPT HEALTH CHECK
// =========================================

chrome.runtime.onMessage.addListener(
    (
        message,
        sender,
        sendResponse
    ) => {

        if (
            message?.type ===
            "LEETGIT_PING"
        ) {

            sendResponse({

                success:
                    true,

                message:
                    "LeetGit content script is ready."
            });

            return;
        }


        // =========================================
        // STOP SYNC
        // =========================================

        if (
            message?.type ===
            "STOP_SYNC"
        ) {

            if (
                !historicalImportRunning
            ) {

                sendResponse({

                    success:
                        true,

                    message:
                        "No sync is currently running."
                });

                return;
            }


            syncCancellationRequested =
                true;


            sendResponse({

                success:
                    true,

                message:
                    "Sync stop requested."
            });

            return;
        }


        // =========================================
        // SYNC NOW
        // =========================================

        if (
            message?.type !==
            "SYNC_NOW"
        ) {

            return;
        }


        if (
            historicalImportRunning
        ) {

            sendResponse({

                success:
                    false,

                message:
                    "A sync is already running."
            });

            return;
        }


        historicalImportRunning =
            true;


        syncCancellationRequested =
            false;


        // THIS IS THE IMPORTANT FIX.
        // Respond immediately.

        sendResponse({

            success:
                true,

            message:
                "Sync started."
        });


        // The actual sync is completely detached
        // from the message request.

        void (async () => {

            try {

                const data =
                    await chrome.storage.local.get([
                        "jwt"
                    ]);


                if (!data.jwt) {

                    throw new Error(
                        "Please login first"
                    );
                }


                await chrome.storage.local.set({

                    syncState: {

                        status:
                            "running",

                        processed:
                            0,

                        total:
                            0,

                        problem:
                            "Starting sync..."
                    }
                });


                await historicalImport(
                    data.jwt
                );


            } catch (error) {

                console.error(
                    "Sync failed:",
                    error
                );


                if (
                    error instanceof SyncCancelledError ||
                    error?.name ===
                    "SyncCancelledError"
                ) {

                    await saveStoppedSyncState();

                    return;
                }


                const current =
                    await chrome.storage.local.get([
                        "syncState"
                    ]);


                const previous =
                    current?.syncState ||
                    {};


                await chrome.storage.local.set({

                    syncState: {

                        status:
                            "failed",

                        processed:
                            Number(
                                previous.processed
                            ) || 0,

                        total:
                            Number(
                                previous.total
                            ) || 0,

                        problem:
                            previous.problem ||
                            "Sync failed",

                        error:
                            error?.message ||
                            "Sync failed"
                    }
                });


            } finally {

                historicalImportRunning =
                    false;


                syncCancellationRequested =
                    false;
            }

        })();


        return;
    }
);