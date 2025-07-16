"use strict";

// Load external scripts
importScripts(
  '/libs/chrome-promise.js',
  '/utils.js',
  '/html-inspector.js',
  '/topics.js',
  '/notifications.js',
  '/tabs.js',
  '/general.js',
  '/ementa.js'
);

const chromep = new ChromePromise();

const badgeColorLight = [134, 64, 46, 255];
const badgeColorDark = [85, 0, 0, 120];

let topics = new TopicsManager();
let notifs = new NotificationsManager();
let tabs = new TabsManager();
let other = new GeneralManager();

let currentIdleState = "active";

// Load and initialize
function loadData() {
  return Promise.all([topics.load(), notifs.load(), tabs.load(), other.load()]);
}

loadData().then(() => {
  topics.setUnreadTopicsChangeListener(updateBadge);
  topics.setOnLoadingChangeListener(updateBadge);
  topics.setLoginStatusChangeListener(newStatus => {
    updateBadge();
    if (newStatus) {
      updaterUnread();
    } else if (other.prefs.cleanDataOnLogout) {
      topics.clear();
      topics.save();
    }
  });

  updateBadge();
  updaterUnread();
});

// Badge update
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

  chrome.action.setBadgeText({ text: newText });
  chrome.action.setBadgeBackgroundColor({ color: newColor });
}

// Notification
function notifyUnreadTopics() {
  const items = topics.getLocalUnreadTopics().map(topic => ({
    title: topic.name,
    message: topic.lastPoster
  }));
  notifs.notifyTopics(items.reverse());
}

function createNextUpdate(){
  chrome.alarms.create("updaterUnread", {
    periodInMinutes: notifs.prefs.updateNotificationMinutePeriod
  });
  console.log("Next update scheduled in", notifs.prefs.updateNotificationMinutePeriod, "minutes (" + new Date(Date.now() + notifs.prefs.updateNotificationMinutePeriod * 60 * 1000) + ")");
}

// Periodic update
function updaterUnread() {
  return Utils.doRetry(() => {
    return topics.fetchUnread().then(newTopics => {
      if (newTopics) notifyUnreadTopics();
    });
  }).then(() => {
    createNextUpdate();

    return topics.save();
  }).catch(err => {
    throw Promise.reject(err);
  });
}

// Handle alarm triggers
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "updaterUnread") {
    updaterUnread();
  }
});

// Commands
function openUnreadTopics() {  
  return topics.fetchUnread().then(newTopics => {
    createNextUpdate();

    let unreadTopics = topics.getLocalUnreadTopics();
    let unreadLinks = unreadTopics.map(topic => {
      return topic.link;
    });
    tabs.openLinks(unreadLinks);
    notifs.clearTopicsNotifications();
    topics.save();

    return unreadTopics;
  }).catch(err => {
    return Promise.reject(err);
  });
}

function openConfigPage() {
  chrome.runtime.openOptionsPage();
}

// Idle detection
chrome.idle.onStateChanged.addListener(newIdleState => {
  currentIdleState = newIdleState;
  if (newIdleState === "locked") {
    chrome.alarms.clear("updaterUnread");
  } else if (newIdleState === "active") {
    updaterUnread();
  }
});

// Runtime messaging
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // console.log(request, sender);
  for (let req in request) {
    switch (req) {
      case "set-html":
        topics.seedFromHTML(request[req]);
        topics.save();
        break; // IN: htmlData
      case "set-reading-last-page":
        topics.setTopicRead(request[req]);
        topics.save();
        break; // IN: topicId
      case "get-unread-topics":
        sendResponse({
          topics: topics.getLocalUnreadTopics(),
          lastUpdate: topics.lastUpdate
        });
        break; // OUT: unread topics and last update date
      case "get-embed-images":
        sendResponse(other.prefs.displayImages);
        break; // OUT: display image preference
      case "open-unread-topics":
        openUnreadTopics().then(topics => {
          sendResponse({ success: true, unreadTopics: topics });
        }).catch(err => {
          sendResponse({ success: false, msg: err });
        });
        return true; // Keep the message channel open for async response
      case "open-links":
        tabs.openLinks(request[req]);
        break; // IN: [link]
      case "close-current-tab":
        tabs.closeTab(sender.tab.id);
        break;
      case "search-topics":
        sendResponse(topics.searchTopicsByName(request[req]));
        break; // IN: string
      case "get-notifications-state":
        sendResponse(notifs.getCurrentState());
        break;
      case "postpone-notifications-period":
        notifs.postponeHourPeriod();
        notifs.save();
        break;
      case "set-notifications-enabled":
        notifs.setEnabled(request[req]);
        notifs.save();
        break; // IN: notifications enabled
      case "reload":
        loadData();
        break;
      case "open-config-page":
        openConfigPage();
        break;
      case "get-vegetariano":
        sendResponse(other.prefs.vegetariano);
        break; // OUT: vegetariano boolean
      case "get-popup-sensibility":
        sendResponse(other.prefs.popupSensibility);
        break; // OUT: popupSensibility (ms)
      case "fetch-unread-topics":
        topics.fetchUnread().then(newTopics => {
          createNextUpdate();
          sendResponse({ success: true, newTopics });
          topics.save();
        }).catch(() => {
          sendResponse({ success: false });
        });
        return true;
      case "print-msg"://just for debugging
        console.log(request[req]);
        break; // IN: string
      case "alreadyfetching":
        sendResponse(topics.isLoading);
        break; // OUT: boolean
      default:
        console.log("Unknown Message Received", request);
    }
  }
});

// Notifications
chrome.notifications.onClicked.addListener(notificationId => {
  if (notificationId === "unread")
    openUnreadTopics();
  else if (notificationId === "update")
    openConfigPage();

  chrome.notifications.clear(notificationId);
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === "unread" && buttonIndex === 0) {
    notifs.postponeHourPeriod();
    notifs.save();
  }

  chrome.notifications.clear(notificationId);
});

// Hotkeys
chrome.commands.onCommand.addListener(command => {
  switch (command) {
    case "open-unread-topics-command":
      openUnreadTopics().catch(err => {
        console.log("Error opening unread topics:", err);
        // chromep.runtime.sendMessage("open-unread-topics");
      });
      break;
    case "open-forum-command":
      tabs.openLinks([topics.prefs.forumURL]);
      break;
  }
});

// Installation logic
chrome.runtime.onInstalled.addListener(details => {
  const newVersion = chrome.runtime.getManifest().version;

  if (details.previousVersion < newVersion) {
    // Set update message to be displayed
    const updateMessage = "Migration to Manifest V3, refactoring some functionalities";

    notifs.notifyUpdate(updateMessage, newVersion, false);
  }

  else {
    topics.prefs.forumURL = "http://www.lei-uminho.com/forum/";
    Promise.all([topics.save()]).then(() => {
      notifs.notifyUpdate("Reload com sucesso.\nClica aqui para as opções", newVersion, true);
      loadData();
    });
  }
});

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "disable-notifications",
    type: "normal",
    title: "Desligar Notificações",
    contexts: ["action"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "disable-notifications") {
    notifs.setEnabled(false);
    notifs.save();
  }
});

