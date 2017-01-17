"use strict"

let GCMManager = {};
GCMManager.registered = false;

GCMManager.isRegistered = function () {
    return this.registered;
}

GCMManager.pushRegistrationId = function (userId, registrationId) {
    console.log(registrationId);

    return Utils.ajax({
        url: "http://topicosporler.tk/gcm.php",
        method: 'POST',
        data: { id_member: userId, registrationId: registrationId }
    }).then(data => {
        return GCMManager.registered = true;
    });
}

GCMManager.register = function (userId, fcmServerId) {
    GCMManager.registered = false;
    return chromep.gcm.register([fcmServerId]).then(registrationId => {
        return GCMManager.pushRegistrationId(userId, registrationId);
    });
}
