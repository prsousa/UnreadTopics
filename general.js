"use strict"

var GeneralManager = GeneralManager || function () {
    this.prefs = {
        popupSensibility: 500,
        displayImages: true,
        cleanDataOnLogout: false
    }
}

GeneralManager.prototype.save = function () {
    return Utils.saveRemotely(this.prefs);
}

GeneralManager.prototype.load = function () {
    return Utils.loadRemotely(this.prefs);
}
