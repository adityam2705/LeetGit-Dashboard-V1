console.log("LeetGit background service worker loaded");


// =========================================
// SIDE PANEL
// =========================================

chrome.runtime.onInstalled.addListener(() => {

    chrome.sidePanel.setPanelBehavior({
        openPanelOnActionClick: true
    });

});

chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
});


// =========================================
// FIND LEETCODE TAB
// =========================================

async function getLeetCodeTab() {

    const tabs = await chrome.tabs.query({
        url: [
            "https://leetcode.com/progress/*"
        ]
    });


    if (!tabs.length) {

        throw new Error(
            "Please open LeetCode Progress page first."
        );
    }


    return tabs[0];
}


// =========================================
// START / STOP SYNC
// =========================================

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (
            message.type !== "START_SYNC" &&
            message.type !== "STOP_SYNC"
        ) {

            return;
        }


        (async () => {

            try {

                console.log(
                    "Background received:",
                    message.type
                );


                const tab =
                    await getLeetCodeTab();


                console.log(
                    "Using LeetCode tab:",
                    tab.id,
                    tab.url
                );


                // =====================================
                // content.js is already loaded through
                // manifest.json.
                //
                // DO NOT inject it again here.
                // =====================================

                console.log(
                    "Sending command to content.js..."
                );


                const response =
                    await chrome.tabs.sendMessage(
                        tab.id,
                        {
                            type:
                                message.type === "START_SYNC"
                                    ? "SYNC_NOW"
                                    : "STOP_SYNC"
                        }
                    );


                console.log(
                    "Content script response:",
                    response
                );


                sendResponse(
                    response
                );

            } catch (error) {

                console.error(
                    "Background:",
                    error
                );


                sendResponse({

                    success: false,

                    message:
                        error?.message ||
                        "Could not communicate with LeetCode page."

                });
            }

        })();


        return true;
    }
);