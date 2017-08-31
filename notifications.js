"use strict"

var NotificationsManager = function () {
    this.prefs = {
        enabled: true,
        audioVolume: 0.5,
        muteHourPeriod: 2
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

NotificationsManager.prototype.playSound = function () {
    var audio = new Audio('/audio/all-eyes-on-me.ogg');
    audio.volume = this.prefs.audioVolume;
    audio.play();
}

NotificationsManager.prototype.clearTopicsNotifications = function () {
    return chromep.notifications.clear('unread');
}

NotificationsManager.prototype.notifyTopics = function (items) {
    if (this.isCurrentlyBlocked()) return false;
    if (!items || items.length === 0) return false;

    this.playSound();

    var postponePeriod = { title: "Não incomodar (" + this.prefs.muteHourPeriod + "h)", iconUrl: "/img/postpone.svg" };
    // var naoIncomodarUMBtn = { title: "Não incomodar aqui", iconUrl: "img/UM.png" };
    var buttonsToDisplay = [postponePeriod];

    var opt = {
        type: 'list',
        title: 'Fórum de LEI',
        message: 'Topicos por Ler',
        iconUrl: '/img/unreadNotification.svg',
        priority: 1,
        items: items,
        buttons: buttonsToDisplay,
        isClickable: true,
        contextMessage: items.length + " tópico" + (items.length > 1 ? 's' : '') + " por ler"
    };


    chromep.notifications.clear('unread').then(wasCleared => {
        chromep.notifications.create('unread', opt).then(id => {
            // clear on timeout?
        });
    });

    return true;
}

NotificationsManager.prototype.notifyUpdate = function (msg, newVersion, requireInt) {
    if (this.isCurrentlyBlocked()) return false;
    this.playSound();

    var opt = {
        type: 'basic',
        title: 'Extensão Atualizada',
        message: msg,
        iconUrl: '/img/updateNotification.svg',
        priority: 1,
        isClickable: true,
        contextMessage: newVersion,
        requireInteraction: requireInt
    };

    chromep.notifications.create('update', opt);

    return true;
}
