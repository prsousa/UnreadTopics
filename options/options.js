const chromep = new ChromePromise();
let countdownClock;

function saveOptions() {
    let newTopicsPrefs = {
        unreadOption: $("#unreadOption").val(),
        excludedTopics: $("#excludedTopics").val().trim().split("\n").filter(elem => {
            return elem.length > 0;
        })
    };

    let newTabsPrefs = {
        setFocusOnFirst: $("#setFocusOnFirst").is(':checked'),
        maxLinksOpen: parseInt($("#maxLinksOpen").val())
    }

    let newNotifsPrefs = {
        enabled: $("#notificationsEnabled").is(':checked'),
        audioVolume: $("#audioVolume").val() / 100.0,
        muteHourPeriod: parseInt($("#muteHourPeriod").val())
    }

    let newOtherPrefs = {
        displayImages: $("#displayImages").is(':checked'),
        popupSensibility: parseInt($("#popupSensibility").val()),
        cleanDataOnLogout: $("#cleanDataOnLogout").is(':checked')
    }

    Promise.all([
        Utils.saveRemotely(newTopicsPrefs),
        Utils.saveRemotely(newTabsPrefs),
        Utils.saveRemotely(newNotifsPrefs),
        Utils.saveRemotely(newOtherPrefs)
    ]).then(results => {
        displayMensagem("Opções Gravadas");
    });

    console.log(newTopicsPrefs, newTabsPrefs, newNotifsPrefs, newOtherPrefs);
}

function restoreOptions() {
    let topics = new TopicsManager();
    let notifs = new NotificationsManager();
    let tabs = new TabsManager();
    let other = new GeneralManager();

    let promises = [
        topics.load(),
        tabs.load(),
        notifs.load(),
        other.load()
    ];

    Promise.all(promises).then(results => {
        $("#unreadOption").val(topics.prefs.unreadOption);
        $("#excludedTopics").val(topics.prefs.excludedTopics.join('\n'));

        $("#maxLinksOpen").val(tabs.prefs.maxLinksOpen);
        $("#setFocusOnFirst").prop('checked', tabs.prefs.setFocusOnFirst);

        $("#notificationsEnabled").prop('checked', notifs.prefs.enabled);
        $("#audioVolume").val(notifs.prefs.audioVolume * 100);
        $("#muteHourPeriod").val(notifs.prefs.muteHourPeriod);

        $("#displayImages").prop('checked', other.prefs.displayImages);
        $("#popupSensibility").val(other.prefs.popupSensibility);
        $("#cleanDataOnLogout").prop('checked', other.prefs.cleanDataOnLogout);
    });
}

function countdown(n, update, done) {
    if (n === 0) {
        done();
    } else {
        update(n - 1);
        countdownClock = setTimeout(countdown, 1000, n - 1, update, done);
    }
}

function displayMensagem(msg) {
    $("#mensagem #msgTxt").text(msg);
    $("#mensagem").fadeIn();

    $("#restartExtensionLink").focus();

    clearTimeout(countdownClock);
    countdown(5, (n) => {
        $("#countdownTime").text(n + 1);
    }, refreshExtensionDataAndDismissMessageAndReload);
}

function refreshExtensionDataAndDismissMessageAndReload() {
    $("#mensagem").fadeOut();
    refreshExtensionData();
    restoreOptions();
}

function refreshExtensionData() {
    chrome.runtime.sendMessage({ "reload": true });
}

document.addEventListener('DOMContentLoaded', function () {
    let extensionVersion = chrome.runtime.getManifest().version;
    $("#currentVersion").text(`(${extensionVersion})`)

    $("tr:odd").addClass("odd");
    $("#restartExtensionLink").click(refreshExtensionDataAndDismissMessageAndReload);

    document.querySelector('#opcoes').addEventListener('submit', function (evt) {
        evt.preventDefault();
        saveOptions();
    });

    restoreOptions();
});

chrome.commands.getAll(function (cmds) {
    for (var i = 0; i < cmds.length; i++) {
        var elem = document.getElementById(cmds[i].name);

        if (elem) {
            elem.innerHTML = cmds[i].shortcut;
        }
    }
});
