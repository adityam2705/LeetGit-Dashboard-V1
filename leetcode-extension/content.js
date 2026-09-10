console.log("LeetCode Sync extension loaded");

const API_BASE_URL = "http://localhost:8080";

async function refreshAccessToken() {

    const data = await chrome.storage.local.get([
        "refreshToken"
    ]);

    if (!data.refreshToken) {
        throw new Error("No refresh token found");
    }

    const response = await fetch(
        API_BASE_URL + "/auth/refresh",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                refreshToken: data.refreshToken
            })
        }
    );

    if (!response.ok) {
        throw new Error("Refresh token invalid or expired");
    }

    const result = await response.json();

    await chrome.storage.local.set({
        jwt: result.accessToken,
        refreshToken: result.refreshToken
    });

    return result.accessToken;
}

async function refreshAccessToken() {

    const data = await chrome.storage.local.get([
        "refreshToken"
    ]);

    if (!data.refreshToken) {
        throw new Error("No refresh token found");
    }

    const response = await fetch(
        API_BASE_URL + "/auth/refresh",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                refreshToken: data.refreshToken
            })
        }
    );

    if (!response.ok) {
        throw new Error("Refresh token invalid or expired");
    }

    const result = await response.json();

    await chrome.storage.local.set({
        jwt: result.accessToken,
        refreshToken: result.refreshToken
    });

    return result.accessToken;
}

// 1. SYNC PROBLEM WITH BACKEND


async function syncProblem(problem, token) {

    console.log("Syncing problem...");

    const response = await fetch(
        API_BASE_URL+"/problems/sync",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },

            body: JSON.stringify({
                leetcodeId: Number(problem.frontendId),
                title: problem.title,
                slug: problem.titleSlug,
                difficulty: problem.difficulty
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            `Problem sync failed: ${response.status}`
        );
    }

    const result = await response.json();

    console.log("Problem synced:", result);

    return result;
}



// 2. FETCH SUBMISSIONS


async function fetchSubmissions(slug) {

    console.log("Fetching submissions...");

    const query = `
        query submissionList(
            $questionSlug: String!
            $limit: Int
            $offset: Int
        ) {
            submissionList(
                questionSlug: $questionSlug
                limit: $limit
                offset: $offset
            ) {
                submissions {
                    id
                    statusDisplay
                    lang
                    timestamp
                }
            }
        }
    `;

    const variables = {
        questionSlug: slug,
        limit: 20,
        offset: 0
    };

    const response = await fetch(
        "https://leetcode.com/graphql/",
        {
            method: "POST",

            credentials: "include",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                query,
                variables
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            `Submission list failed: ${response.status}`
        );
    }

    const data = await response.json();

    const submissions =
        data?.data?.submissionList?.submissions || [];

    console.log(
        `Submissions found: ${submissions.length}`
    );

    return submissions;
}



// 3. FETCH SUBMISSION DETAILS


async function fetchSubmissionDetails(submissionId) {

    console.log("Fetching submission code...");

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

    const variables = {
        submissionId: Number(submissionId)
    };

    const response = await fetch(
        "https://leetcode.com/graphql/",
        {
            method: "POST",

            credentials: "include",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                query,
                variables
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            `Submission details failed: ${response.status}`
        );
    }

    const data = await response.json();

    const details =
        data?.data?.submissionDetails;

    console.log("Submission details received.");

    return details;
}



// 4. SYNC SOLUTION WITH BACKEND


async function syncSolution(
    problem,
    submission,
    token
) {

    const solution = {

        leetcodeSubmissionId:
            Number(submission.submissionId),

        code:
        submission.code,

        language:
        submission.language,

        submittedAt:
            Number(submission.submittedAt),

        runtime:
        submission.runtime,

        memory:
        submission.memory,

        status:
        submission.status
    };

    console.log("Solution prepared:", solution);

    console.log("Sending solution to backend...");

    const response = await fetch(
        `${API_BASE_URL}/solutions/sync/${problem.frontendId}`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },

            body: JSON.stringify(solution)
        }
    );

    if (!response.ok) {
        throw new Error(
            `Solution sync failed: ${response.status}`
        );
    }

    const result = await response.json();

    console.log("Solution saved:", result);

    return result;
}



// 5. FETCH ALL SOLVED PROBLEMS FROM LEETCODE


async function fetchSolvedProblems() {

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
            questionStatus: "SOLVED",
            skip: 0,
            limit: 1000
        }
    };

    const response = await fetch(
        "https://leetcode.com/graphql/",
        {
            method: "POST",

            credentials: "include",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                query,
                variables
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            `Solved problems fetch failed: ${response.status}`
        );
    }

    const data = await response.json();

    const questions =
        data?.data?.userProgressQuestionList?.questions || [];

    console.log(
        `Total solved problems: ${questions.length}`
    );

    return questions;
}



// 6. HISTORICAL IMPORT


async function historicalImport(token) {

    console.log("Starting historical import...");

    const problems =
        await fetchSolvedProblems();

    console.log(
        `Found ${problems.length} solved problems`
    );

    let processed = 0;

    for (const problem of problems) {

        try {

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


            // ------------------------------------------------
            // STEP 1
            // Sync problem + user_problem
            // ------------------------------------------------

            const syncedProblem =
                await syncProblem(
                    problem,
                    token
                );



            // STEP 2
            // IMPORTANT OPTIMIZATION

            // If problem already belongs to this user,
            // DO NOT fetch submissions.


            if (!syncedProblem.newForUser) {

                console.log(
                    `Already synced: ${problem.title}`
                );

                console.log(
                    "Skipping submission fetch."
                );

                processed++;

                console.log(
                    `${processed}/${problems.length}`
                );

                continue;
            }



            // STEP 3
            // Only NEW problems reach here


            const submissions =
                await fetchSubmissions(
                    problem.titleSlug
                );



            // STEP 4
            // Find Accepted submission


            const acceptedSubmission =
                submissions.find(
                    submission =>
                        submission.statusDisplay === "Accepted"
                );


            if (!acceptedSubmission) {

                console.log(
                    `No accepted submission found for ${problem.title}`
                );

                processed++;

                console.log(
                    `${processed}/${problems.length}`
                );

                continue;
            }


            console.log(
                "Accepted submission:",
                acceptedSubmission
            );



            // STEP 5
            // Fetch complete submission details


            const details =
                await fetchSubmissionDetails(
                    acceptedSubmission.id
                );


            if (!details) {

                console.log(
                    `Could not fetch submission details for ${problem.title}`
                );

                processed++;

                console.log(
                    `${processed}/${problems.length}`
                );

                continue;
            }


            // ------------------------------------------------
            // STEP 6
            // Prepare solution object
            // ------------------------------------------------

            const submission = {

                submissionId:
                acceptedSubmission.id,

                code:
                details.code,

                language:
                    details.lang?.name ||
                    acceptedSubmission.lang,

                submittedAt:
                    Number(
                        acceptedSubmission.timestamp
                    ),

                runtime:
                details.runtime,

                memory:
                details.memory,

                status:
                details.statusDisplay
            };



            // STEP 7


            await syncSolution(
                problem,
                submission,
                token
            );


            console.log(
                `SUCCESS: ${problem.title}`
            );


        } catch (error) {

            console.error(
                `FAILED: ${problem.title}`,
                error
            );
        }


        processed++;

        console.log(
            `${processed}/${problems.length}`
        );


        // Small delay
        await new Promise(
            resolve =>
                setTimeout(resolve, 300)
        );
    }


    console.log(
        "======================================"
    );

    console.log(
        "HISTORICAL IMPORT COMPLETE"
    );

    console.log(
        `Processed ${processed} problems`
    );

    console.log(
        "======================================"
    );
}


// 7. SYNC CURRENT PROBLEM PAGE


async function syncCurrentProblem(token) {

    const path =
        window.location.pathname;

    if (!path.startsWith("/problems/")) {
        return;
    }

    if (path.includes("/submissions")) {
        return;
    }

    const slug =
        path.split("/")[2];

    if (!slug) {
        return;
    }


    console.log(
        `Current problem detected: ${slug}`
    );


    const query = `
        query questionData(
            $titleSlug: String!
        ) {
            question(
                titleSlug: $titleSlug
            ) {
                questionFrontendId
                title
                titleSlug
                difficulty
            }
        }
    `;

    const variables = {
        titleSlug: slug
    };


    const response = await fetch(
        "https://leetcode.com/graphql/",
        {
            method: "POST",

            credentials: "include",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                query,
                variables
            })
        }
    );


    if (!response.ok) {
        throw new Error(
            `Problem fetch failed: ${response.status}`
        );
    }


    const data =
        await response.json();


    const question =
        data?.data?.question;


    if (!question) {

        console.log(
            "Could not find current problem"
        );

        return;
    }


    const problem = {

        frontendId:
        question.questionFrontendId,

        title:
        question.title,

        titleSlug:
        question.titleSlug,

        difficulty:
        question.difficulty
    };


    const result =
        await syncProblem(
            problem,
            token
        );


    console.log(
        "Current problem sync result:",
        result
    );
}



// 8. GET JWT FROM CHROME STORAGE


chrome.storage.local.get(
    ["jwt"],
    async (result) => {

        const token =
            result.jwt;


        if (!token) {

            console.log(
                "No JWT found in chrome storage"
            );

            return;
        }
    })

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.type === "SYNC_NOW") {

        chrome.storage.local.get(["jwt"], async (data) => {

            if (!data.jwt) {
                sendResponse({
                    success: false,
                    message: "Please login first"
                });
                return;
            }

            try {
                await historicalImport(data.jwt);

                sendResponse({
                    success: true,
                    message: "Sync completed"
                });

            } catch (error) {
                console.error("Sync failed:", error);

                sendResponse({
                    success: false,
                    message: "Sync failed"
                });
            }
        });

        return true;
    }
});