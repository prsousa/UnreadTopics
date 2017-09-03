"use strict"

const chromep = new ChromePromise();

const badgeColorLight = [134, 64, 46, 255];
const badgeColorDark = [85, 0, 0, 120];

let topics = new TopicsManager();
let notifs = new NotificationsManager();
let tabs = new TabsManager();
let other = new GeneralManager();

let updaterClock = {};
let currentIdleState = "active";

function loadData() {
    return Promise.all([
        topics.load(),
        notifs.load(),
        tabs.load(),
        other.load()
    ]);
}

loadData().then(() => {
    Analytics.trackPageView();
    topics.setUnreadTopicsChangeListener(updateBadge);
    topics.setOnLoadingChangeListener(updateBadge);
    topics.setLoginStatusChangeListener(newStatus => {
        console.log("Login Status Changed", newStatus);
        updateBadge();
        if (newStatus) {
            updaterUnread();
            updaterGCM();
        } else if (other.prefs.cleanDataOnLogout) {
            topics.clear();
            topics.save();
        }
    });

    updateBadge();
    updaterUnread();
    updaterGCM();
});

function updateBadge() {
    let newText = "";
    let unreadPosts = 0;
    let newColor = badgeColorLight;

    if (topics.isLoading) {
        newText = "...";
        newColor = badgeColorDark;
    } else if (!topics.isLoggedIn()) {
        newText = " ";
    } else if ((unreadPosts = topics.getLocalUnreadTopics().length) > 0) {
        newText += unreadPosts;
    }

    chrome.browserAction.setBadgeText({ text: newText });
    chrome.browserAction.setBadgeBackgroundColor({ color: newColor });
}


function notifyUnreadTopics() {
    let items = topics.getLocalUnreadTopics().map(topic => { return { title: topic.name, message: topic.lastPoster }; });
    notifs.notifyTopics(items.reverse());
}

function openUnreadTopics() {
    return topics.fetchUnread().then(newTopics => {
        Analytics.addEvent('fetch-unread', 'open-unread-topics', newTopics);
        updateUnreadIn(30);
        let unreadTopics = topics.getLocalUnreadTopics();
        let unreadLinks = unreadTopics.map(topic => { return topic.link });
        tabs.openLinks(unreadLinks);
        notifs.clearTopicsNotifications();
        topics.save();
        return unreadTopics;
    });
}

function openConfigPage() {
    chrome.runtime.openOptionsPage();
}

function stopUpdater(clock) {
    clearTimeout(clock);
};

function updateGCMIn(minutes) {
    stopUpdater(updaterClock.gcm);
    updaterClock.gcm = setTimeout(updaterGCM, minutes * 60 * 1000);
    console.log("Update 'GCM' in", minutes, "minutes", new Date());
}

function updaterGCM() {
    if (topics.isLoggedIn()) {
        Utils.doRetry(() => {
            return GCMManager.register(topics.db.userId, "625116915699");
        }).then(() => {
            stopUpdater(updaterClock.gcm);
            updateGCMIn(10);
        });
    }
}

function updateUnreadIn(minutes) {
    stopUpdater(updaterClock.unread);
    updaterClock.unread = setTimeout(updaterUnread, minutes * 60 * 1000);
    console.log("Update 'Unread' in", minutes, "minutes", new Date());
}

function updaterUnread() {
    Analytics.addEvent('background-updater', 'request', topics.db.userId);
    console.log("Updating", new Date());

    return Utils.doRetry(() => {
        return topics.fetchUnread().then(newTopics => {
            Analytics.addEvent('fetch-unread', 'background-updater', newTopics);
            if (newTopics) notifyUnreadTopics();
        })
    }).then(() => {
        updateUnreadIn(30);
        return topics.save();
    });
}


// Receive signal when computer idle state change
chrome.idle.onStateChanged.addListener((newIdleState) => {
    // console.log("Idle state changed", newIdleState, new Date());
    if (currentIdleState === "locked" && newIdleState === "active") {
        updaterUnread().then(() => {
            currentIdleState = newIdleState;
        });
        updaterGCM();
    } else {
        currentIdleState = newIdleState;

        if (newIdleState === "locked") {
            stopUpdater(updaterClock.unread);
        }
    }
});


// Receive push notifications from GCM/FCM
chrome.gcm.onMessage.addListener(message => {
    console.log("state when onMessage", currentIdleState, new Date().getTime(), new Date());
    if (!topics.isLoggedIn() || currentIdleState === "locked") return;
    if (message.data && message.data.topic && message.data.board && message.data.posterName) {
        // console.log("Push Message Received:", message, new Date(), Date.now());

        if (topics.knownBoard(message.data.board)) {
            if (topics.receiveValidPost(message.data)) {
                notifyUnreadTopics();
            }
        } else {
            // Unknown Board - what to do?
            console.log("Unknown Board");
        }

    } else {
        console.log("Unknown Message Received");
    }
});


// Receive messages from tabs and other extensions
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // console.log(request, sender);
    for (let req in request) {
        switch (req) {
            case "set-html": topics.seedFromHTML(request[req]); topics.save(); break; // IN: htmlData
            case "set-reading-last-page": topics.setTopicRead(request[req]); topics.save(); break; // IN: topicId
            case "get-unread-topics": sendResponse({
                topics: topics.getLocalUnreadTopics(),
                lastUpdate: topics.lastUpdate
            }); break; // OUT: unread topics and last update date
            case "get-embed-images": sendResponse(other.prefs.displayImages); break; // OUT: display image preference
            case "open-unread-topics":
                openUnreadTopics().then(topics => {
                    sendResponse({
                        success: true,
                        unreadTopics: topics
                    });
                }).catch(err => {
                    sendResponse({
                        success: false,
                        msg: err
                    });
                });
                return true;
                break;
            case "open-links": tabs.openLinks(request[req]); break; // IN: [link]
            case "close-current-tab": tabs.closeTab(sender.tab.id); break;
            case "search-topics": sendResponse(topics.searchTopicsByName(request[req])); break; // IN: string
            case "get-notifications-state": sendResponse(notifs.getCurrentState()); break;
            case "postpone-notifications-period": notifs.postponeHourPeriod(); notifs.save(); break;
            case "set-notifications-enabled": notifs.setEnabled(request[req]); notifs.save(); break; // IN: notifications enabled
            case "reload": loadData(); break;
            case "open-config-page": openConfigPage(); break;
            case "get-popup-sensibility": sendResponse(other.prefs.popupSensibility); break; // OUT: popupSensibility (ms)
            case "fetch-unread-topics":
                Analytics.addEvent('fetch-unread', 'fetch-unread-topics', topics.db.userId);
                topics.fetchUnread().then(newTopics => { // OUT: indication of conclusion
                    updateUnreadIn(30);
                    sendResponse({
                        success: true,
                        newTopics: newTopics
                    });
                    topics.save();
                }).catch(err => {
                    sendResponse({ success: false });
                });
                return true;
                break;
        }
    }
});

// Receives clicks on notifications
chrome.notifications.onClicked.addListener(function (notificationId) {
    switch (notificationId) {
        case "unread": openUnreadTopics(); break;
        case "update": openConfigPage(); break;
    }

    chrome.notifications.clear(notificationId);
});

// Receives clicks on notifications buttons
chrome.notifications.onButtonClicked.addListener(function (notificationId, buttonIndex) {
    if (notificationId === "unread") {
        if (buttonIndex === 0) {
            notifs.postponeHourPeriod();
        } /* else if (...) */
    }

    chrome.notifications.clear(notificationId);
});

// Receives (key) commands from the browser/OS
chrome.commands.onCommand.addListener(function (command) {
    switch (command) {
        case "open-unread-topics": openUnreadTopics(); break;
        case "open-forum": tabs.openLinks([topics.prefs.forumURL]); break;
    }
});

// Receives signal on extension installation
chrome.runtime.onInstalled.addListener(function (details) {
    let newVersion = chrome.runtime.getManifest().version;

    if (details.previousVersion < newVersion) {
        Analytics.addEvent('extension-update', 'request', newVersion);
        console.log(`Updated from ${details.previousVersion} to ${newVersion}`);
    }

    if (details.previousVersion < "3.0.0") {
        // Migrate Data
        // TODO: update to new storage scheme

        other.prefs = {
            popupSensibility: parseInt(localStorage["TIMECLICK"]) || other.prefs.popupSensibility,
            displayImages: localStorage["displayPictures"] === "true" || other.prefs.displayImages
        }

        topics.prefs = {
            unreadOption: localStorage["abrirOp"] || topics.prefs.unreadOption,
            excludedTopics: (localStorage["exclusoes"] || "").trim().split("\n").filter(elem => {
                return elem.length > 0;
            })
        }

        notifs.prefs = {
            enabled: localStorage["notificacoes"] === "sim" || notifs.prefs.enabled,
            audioVolume: (localStorage["somNotificacoes"] === "false") ? 0.0 : notifs.prefs.audioVolume,
            muteHourPeriod: parseInt(localStorage["horasPausaNotificacoes"]) || notifs.prefs.muteHourPeriod
        };

        tabs.prefs = {
            setFocusOnFirst: localStorage["foco"] !== "nao" || tabs.prefs.setFocusOnFirst,
            maxLinksOpen: parseInt(localStorage["maxTabs"]) || tabs.prefs.maxLinksOpen
        }

        let containers = [other, topics, notifs, tabs];
        Promise.all(containers.map(container => {
            return container.save();
        })).then(() => {
            localStorage.clear();
            return loadData();
        });

        notifs.notifyUpdate('Clica aqui para as opções', newVersion);
    }

    if (details.previousVersion === "3.0.1") {
        // migrate data
        chromep.storage.sync.get(["topics", "notifs", "tabs", "other"]).then(oldItems => {
            // Topics
            if (oldItems.topics) {
                for (let k in topics.db) {
                    topics.db[k] = oldItems.topics[k] || topics.db[k];
                }

                for (let k in topics.prefs) {
                    topics.prefs[k] = oldItems.topics[k] || topics.prefs[k];
                }
            }

            // Tabs
            if (oldItems.tabs) {
                for (let k in tabs.prefs) {
                    tabs.prefs[k] = oldItems.tabs[k] || tabs.prefs[k];
                }
            }

            // Notifs
            if (oldItems.notifs) {
                for (let k in notifs.db) {
                    notifs.db[k] = oldItems.notifs[k] || notifs.db[k];
                }

                for (let k in notifs.prefs) {
                    notifs.prefs[k] = oldItems.notifs[k] || notifs.prefs[k];
                }
            }

            // Other
            if (oldItems.other) {
                for (let k in other.prefs) {
                    other.prefs[k] = oldItems.other[k] || other.prefs[k];
                }
            }

            let clearSyncP = chromep.storage.sync.clear();
            let clearLocalP = chromep.storage.local.clear();

            return Promise.all([clearSyncP, clearLocalP]);
        }).then(() => {
            let containers = [other, topics, notifs, tabs];
            return Promise.all(containers.map(container => {
                return container.save();
            }));
        }).then(() => {
            Analytics.addEvent('extension-update', 'success', newVersion);
            notifs.notifyUpdate('Clica aqui para as opções', newVersion, false);
            return loadData();
        });
    }
});
