"use strict"

let GCMManager = {};

GCMManager.pushRegistrationId = function (userId, registrationId) {
    return Utils.ajax({
        url: "http://topicosporler.tk/gcm.php",
        method: 'POST',
        data: { id_member: userId, registrationId: registrationId }
    });
}

GCMManager.register = function (userId, fcmServerId) {
    return chromep.gcm.register([fcmServerId]).then(registrationId => {
        return GCMManager.pushRegistrationId(userId, registrationId);
    });
}
