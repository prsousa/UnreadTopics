"use strict"

var NotificationsManager = function () {
    this.enabled = true;
    this.muteWhileHere = false;
    this.currentIP = "";
    this.muteHourPeriod = 2;
    this.muteUntil = 0;
    this.audioVolume = 0.5;
}

NotificationsManager.prototype.isCurrentlyBlocked = function () {
    return !this.enabled || this.muteWhileHere || this.muteUntil - new Date().getTime() > 0;
}

NotificationsManager.prototype.getCurrentState = function () {
    return {
        currentlyBlocked: this.isCurrentlyBlocked(),
        enabled: this.enabled,
        muttedUntil: this.muteUntil,
        audioVolume: this.audioVolume
    }
}

NotificationsManager.prototype.postponeHourPeriod = function () {
    this.muteUntil = new Date().getTime() + this.muteHourPeriod * 60 * 60 * 1000;
}

NotificationsManager.prototype.setEnabled = function (enabled) {
    this.enabled = enabled;
    this.muteUntil = 0;
}

NotificationsManager.prototype.playSound = function () {
    var audio = new Audio('/audio/all-eyes-on-me.ogg');
    audio.volume = this.audioVolume;
    audio.play();
}

NotificationsManager.prototype.notifyTopics = function (items) {
    if (this.isCurrentlyBlocked()) return false;

    this.playSound();

    var postponePeriod = { title: "Não incomodar (" + this.muteHourPeriod + "h)", iconUrl: "/img/postpone.svg" };
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

NotificationsManager.prototype.notifyUpdate = function (msg, newVersion) {
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
        requireInteraction: true
    };

    chromep.notifications.create('update', opt);

    return true;
}
