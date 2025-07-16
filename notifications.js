"use strict"

var NotificationsManager = function () {
    this.prefs = {
        enabled: true,
        audioVolume: 0.5,
        muteHourPeriod: 1,
        updateNotificationMinutePeriod: 30
    };

    this.db = {
        currentIP: "",
        muteWhileHere: false,
        muteUntil: 0
    }
}

NotificationsManager.prototype.save = function () {
    return Promise.all([
        Utils.saveLocally(this.db),
        Utils.saveRemotely(this.prefs)
    ]);
}

NotificationsManager.prototype.load = function () {
    return Promise.all([
        Utils.loadLocally(this.db),
        Utils.loadRemotely(this.prefs)
    ]);
}

NotificationsManager.prototype.isCurrentlyBlocked = function () {
    return !this.prefs.enabled || this.db.muteWhileHere || this.db.muteUntil - new Date().getTime() > 0;
}

NotificationsManager.prototype.getCurrentState = function () {
    return {
        currentlyBlocked: this.isCurrentlyBlocked(),
        enabled: this.prefs.enabled,
        audioVolume: this.prefs.audioVolume,
        muttedUntil: this.db.muteUntil
    }
}

NotificationsManager.prototype.postponeHourPeriod = function () {
    this.db.muteUntil = new Date().getTime() + this.prefs.muteHourPeriod * 60 * 60 * 1000;
}

NotificationsManager.prototype.setEnabled = function (enabled) {
    this.prefs.enabled = enabled;
    this.db.muteUntil = 0;
}

// Create the offscreen document if it doesn't already exist
async function createOffscreen() {
    if (await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'play notification sound'
    });
}

NotificationsManager.prototype.playSound = async function () {
    const source = '/audio/all-eyes-on-me.ogg'; // Path to the audio file
    const volume = this.prefs.audioVolume;

    await createOffscreen();
    await chrome.runtime.sendMessage({ play: { source, volume } });
}

NotificationsManager.prototype.clearTopicsNotifications = function () {
    return chrome.notifications.clear('unread');
}

NotificationsManager.prototype.notifyTopics = function (items) {
    if (this.isCurrentlyBlocked()) return false;
    if (!items || items.length === 0) return false;

    return chrome.notifications.getPermissionLevel().then(level => {
        if (level !== "granted") return Promise.reject(false);
        return chrome.notifications.clear('unread');
    }).then(wasCleared => {
        var postponePeriod = { title: "Não incomodar (" + this.prefs.muteHourPeriod + "h)", iconUrl: '/img/icon/icon.png' };
        // var naoIncomodarUMBtn = { title: "Não incomodar aqui", iconUrl: "img/UM.png" };
        var buttonsToDisplay = [postponePeriod];

        var opt = {
            type: 'list',
            title: 'Fórum de LEI',
            message: 'Topicos por Ler',
            iconUrl: '/img/icon/icon.png',
            priority: 1,
            items: items,
            buttons: buttonsToDisplay,
            isClickable: true,
            contextMessage: items.length + " tópico" + (items.length > 1 ? 's' : '') + " por ler"
        };

        return chrome.notifications.create('unread', opt);
    }).then(notificationId => {
        this.playSound();
        // clear on timeout?
        return true;
    }).catch(err => false);
}

NotificationsManager.prototype.notifyUpdate = function (msg, newVersion, requireInt) {
    if (this.isCurrentlyBlocked()) return false;

    var opt = {
        type: 'basic',
        title: 'Extensão Atualizada',
        message: msg,
        iconUrl: "img/icon/icon.png",
        priority: 1,
        isClickable: true,
        contextMessage: newVersion,
        requireInteraction: requireInt
    };
    
    chrome.notifications.create('update', opt).then(() => {
        this.playSound();
        return true;
    }).catch(err => {
        console.error("Failed to show notification:", err);
        return false;
    });
}
