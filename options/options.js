const chromep = new ChromePromise();
let countdownClock;

function saveOptions() {
    let newTopics = {
        unreadOption: $("#unreadOption").val(),
        excludedTopics: $("#excludedTopics").val().trim().split("\n").filter(elem => {
            return elem.length > 0;
        })
    };

    let newTabs = {
        maxLinksOpen: parseInt($("#maxLinksOpen").val()),
        setFocusOnFirst: $("#setFocusOnFirst").is(':checked')
    }

    let newNotifs = {
        enabled: $("#notificationsEnabled").is(':checked'),
        audioVolume: $("#audioVolume").val() / 100.0,
        muteHourPeriod: parseInt($("#muteHourPeriod").val())
    }

    let newOther = {
        displayImages: $("#displayImages").is(':checked'),
        popupSensibility: parseInt($("#popupSensibility").val()),
        cleanDataOnLogout: $("#cleanDataOnLogout").is(':checked')
    }

    let promises = [];
    promises.push(Utils.save("topics", newTopics));
    promises.push(Utils.save("tabs", newTabs));
    promises.push(Utils.save("notifs", newNotifs));
    promises.push(Utils.save("other", newOther));

    Promise.all(promises).then(results => {
        displayMensagem("Opções Gravadas");
    });

    console.log(newTopics, newTabs, newNotifs, newOther);
}

function restoreOptions() {
    let topics = new TopicsManager();
    let notifs = new NotificationsManager();
    let tabs = new TabsManager();
    var other = {
        popupSensibility: 500,
        displayImages: true,
        cleanDataOnLogout: true
    };

    let promises = [];
    promises.push(Utils.load(topics, "topics"));
    promises.push(Utils.load(tabs, "tabs"));
    promises.push(Utils.load(notifs, "notifs"));
    promises.push(Utils.load(other, "other"));

    Promise.all(promises).then(results => {
        $("#unreadOption").val(topics.unreadOption);
        $("#excludedTopics").val(topics.excludedTopics.join('\n'));

        $("#maxLinksOpen").val(tabs.maxLinksOpen);
        $("#setFocusOnFirst").prop('checked', tabs.setFocusOnFirst);

        $("#notificationsEnabled").prop('checked', notifs.enabled);
        $("#audioVolume").val(notifs.audioVolume * 100);
        $("#muteHourPeriod").val(notifs.muteHourPeriod);

        $("#displayImages").prop('checked', other.displayImages);
        $("#popupSensibility").val(other.popupSensibility);
        $("#cleanDataOnLogout").prop('checked', other.cleanDataOnLogout);
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
