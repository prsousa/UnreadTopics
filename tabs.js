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

    let _this = this;
    chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
        if (tabs && tabs.length > 0) {
            var windowId = tabs[0].windowId;

            for (let i = 0; i < Math.min(_this.prefs.maxLinksOpen, links.length); i++) {
                setTimeout(() => {
                    chrome.tabs.create({ windowId: windowId, url: links[i], active: (i == 0 && _this.prefs.setFocusOnFirst) });
                }, i * 500);
            };

            chrome.windows.update(windowId, { focused: _this.prefs.setFocusOnFirst });
        } else if (tabs) {
            chrome.windows.create({ url: links, focused: _this.prefs.setFocusOnFirst });
        }
    });
}
