"use strict"

var TabsManager = function () {
    this.prefs = {
        setFocusOnFirst: true,
        maxLinksOpen: 10
    };
}

TabsManager.prototype.save = function () {
    return Utils.saveRemotely(this.prefs);
}

TabsManager.prototype.load = function () {
    return Utils.loadRemotely(this.prefs);
}

TabsManager.prototype.closeTab = function (tabId) {
    chrome.tabs.remove(tabId);
}

TabsManager.prototype.openLinks = function (links) {
    if (links.length === 0) return;

    links = links.slice(0, this.prefs.maxLinksOpen);

    let _this = this;
    chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
        if (tabs && tabs.length > 0) {
            var windowId = tabs[0].windowId;

            links.forEach((link, i) => {
                setTimeout(() => {
                    chrome.tabs.create({ windowId: windowId, url: link, active: (i == 0 && _this.prefs.setFocusOnFirst) });
                }, i * 500);
            });

            chrome.windows.update(windowId, { focused: true });
        } else if (tabs) {
            chrome.windows.create({ url: links });
        }
    });
}
