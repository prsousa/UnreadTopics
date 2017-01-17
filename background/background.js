"use strict"

const chromep = new ChromePromise();

const badgeColorLight = [134, 64, 46, 255];
const badgeColorDark = [85, 0, 0, 120];

let topics = new TopicsManager();
let notifs = new NotificationsManager();
let tabs = new TabsManager();
var other = {
    popupSensibility: 500,
    displayImages: true,
    cleanDataOnLogout: true
};

let updaterClock;
let consecutiveExecep = 0;

function loadData() {
    let promises = [];
    promises.push(Utils.load(topics, "topics"));
    promises.push(Utils.load(tabs, "tabs"));
    promises.push(Utils.load(notifs, "notifs"));
    promises.push(Utils.load(other, "other"));

    return Promise.all(promises);
}

loadData().then(() => {
    topics.setUnreadTopicsChangeListener(updateBadge);
    topics.setOnLoadingChangeListener(updateBadge);
    topics.setLoginStatusChangeListener(newStatus => {
        console.log("Login Status Changed", newStatus);
        updateBadge();
        if (newStatus) {
            stopUpdating();
            updater();
        } else if (other.cleanDataOnLogout) {
            topics.clear();
            Utils.save("topics", topics);
        }
    });

    updateBadge();
    updater();
});

function updateBadge() {
    let newText = "";
    let unreadPosts = 0;
    let newColor = badgeColorLight;

    if (topics._isLoading) {
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
        let unreadTopics = topics.getLocalUnreadTopics();
        let unreadLinks = unreadTopics.map(topic => { return topic.link });
        tabs.openLinks(unreadLinks);
        Utils.save("topics", topics);
        return unreadTopics;
    });
}

function openConfigPage() {
    chrome.runtime.openOptionsPage();
}

function stopUpdating() {
    clearTimeout(updaterClock);
};

function updater() {
    console.log("Updating", new Date());

    if (topics.isLoggedIn() && !GCMManager.isRegistered()) {
        GCMManager.register(topics.userId, "625116915699");
    }

    (() => {
        let minutesNormal = 30;
        if (topics.isOutdated(10)) {
            console.log("Is Oudated", new Date());
            return topics.fetchUnread().then(newTopics => {
                consecutiveExecep = 0;
                if (newTopics) {
                    notifyUnreadTopics();
                }
                return minutesNormal;
            }).catch(reason => {
                console.log(reason, consecutiveExecep);
                return minutesNormal * Math.pow(1.2, consecutiveExecep++);
            });
        } else {
            return Promise.resolve(minutesNormal);
        }
    })().then(minutesToNextUpdate => {
        console.log("Update in", minutesToNextUpdate);
        updaterClock = setTimeout(updater, minutesToNextUpdate * 60 * 1000);
        Utils.save("topics", topics);
    });
}


// Receive push notifications from GCM/FCM
chrome.gcm.onMessage.addListener(message => {
    if (!topics.isLoggedIn()) return;
    if (message.data && message.data.topic && message.data.board && message.data.posterName) {
        console.log("Push Message Received:", message, new Date());

        if (topics.knownBoard(message.data.board)) {
            if (topics.receiveValidPost(message.data)) {
                notifyUnreadTopics();
            }
            Utils.save("topics", topics);
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
            case "set-html": topics.seedFromHTML(request[req]); Utils.save("topics", topics); break; // IN: htmlData
            case "set-reading-last-page": topics.setTopicRead(request[req]); break; // IN: topicId
            case "get-unread-topics": sendResponse(topics.getLocalUnreadTopics()); break; // OUT: unreadTopics
            case "get-embed-images": sendResponse(other.displayImages); break; // OUT: display image preference
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
            case "postpone-notifications-period": notifs.postponeHourPeriod(); Utils.save("notifs", notifs); break;
            case "set-notifications-enabled": notifs.setEnabled(request[req]); Utils.save("notifs", notifs); break; // IN: notifications enabled
            case "reload": loadData(); break;
            case "open-config-page": openConfigPage(); break;
            case "get-popup-sensibility": sendResponse(other.popupSensibility); break; // OUT: popupSensibility (ms)
            case "fetch-unread-topics":
                topics.fetchUnread().then(newTopics => { // OUT: indication of conclusion
                    sendResponse({
                        success: true,
                        newTopics: newTopics
                    });
                    Utils.save("topics", topics);
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
        case "open-forum": tabs.openLinks([topics.forumURL]); break;
    }
});

// Receives signal on extension installation
chrome.runtime.onInstalled.addListener(function (details) {
    let newVersion = chrome.runtime.getManifest().version;

    if (details.previousVersion < "3.0.0") {
        // Migrate Data
        let oldOther = {
            popupSensibility: localStorage["TIMECLICK"] || other.popupSensibility,
            displayImages: localStorage["displayPictures"] || other.displayImages
        };

        let oldTopics = {
            unreadOption: localStorage["abrirOp"] || topics.unreadOption,
            excludedTopics: (localStorage["exclusoes"] || "").trim().split("\n").filter(elem => {
                return elem.length > 0;
            })
        }

        let oldNotifs = {
            enabled: localStorage["notificacoes"] === "sim" || other.enabled,
            audioVolume: (localStorage["somNotificacoes"] === "false") ? 0.0 : notifs.audioVolume,
            muteHourPeriod: localStorage["horasPausaNotificacoes"] || notifs.muteHourPeriod
        };

        let oldTabs = {
            setFocusOnFirst: localStorage["foco"] !== "nao" || tabs.setFocusOnFirst,
            maxLinksOpen: localStorage["maxTabs"] || tabs.maxLinksOpen
        }

        Utils.save("other", oldOther);
        Utils.save("topics", oldTopics);
        Utils.save("notifs", oldNotifs);
        Utils.save("tabs", oldTabs);

        localStorage.clear();
        loadData();

        notifs.notifyUpdate('Clica aqui para as opções', newVersion);
    }

    if (details.previousVersion < newVersion) {
        console.log(`Updated from ${details.previousVersion} to ${newVersion}`);
    }
});
