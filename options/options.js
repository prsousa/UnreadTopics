const chromep = new ChromePromise();

function saveOptions() {
  let newTopicsPrefs = {
    forumURL: $("#forumURL").val(),
    unreadOption: $("#unreadOption").val(),
    excludedTopics: $("#excludedTopics")
      .val()
      .trim()
      .split("\n")
      .map(topicId => {
        return parseInt(topicId);
      })
      .filter(topicId => {
        return topicId;
      })
  };

  let newTabsPrefs = {
    setFocusOnFirst: $("#setFocusOnFirst").is(":checked"),
    maxLinksOpen: parseInt($("#maxLinksOpen").val())
  };

  let newNotifsPrefs = {
    enabled: $("#notificationsEnabled").is(":checked"),
    audioVolume: $("#audioVolume").val() / 100.0,
    muteHourPeriod: parseInt($("#muteHourPeriod").val()),
    updateNotificationMinutePeriod: parseInt($("#updateNotificationMinutePeriod").val())
  };

  let newOtherPrefs = {
    vegetariano: $("#vegetariano").is(":checked"),
    displayImages: $("#displayImages").is(":checked"),
    popupSensibility: parseInt($("#popupSensibility").val()),
    cleanDataOnLogout: $("#cleanDataOnLogout").is(":checked")
  };

  Promise.all([
    Utils.saveRemotely(newTopicsPrefs),
    Utils.saveRemotely(newTabsPrefs),
    Utils.saveRemotely(newNotifsPrefs),
    Utils.saveRemotely(newOtherPrefs)
  ]).then(results => {
    displayMensagem("Opções Gravadas");
    refreshExtensionData();
    restoreOptions();
  });

  console.log(newTopicsPrefs, newTabsPrefs, newNotifsPrefs, newOtherPrefs);
}

function restoreOptions() {
  let topics = new TopicsManager();
  let notifs = new NotificationsManager();
  let tabs = new TabsManager();
  let other = new GeneralManager();

  let promises = [topics.load(), tabs.load(), notifs.load(), other.load()];

  Promise.all(promises).then(results => {
    $("#forumURL").val(topics.prefs.forumURL);
    $("#unreadOption").val(topics.prefs.unreadOption);
    $("#excludedTopics").val(topics.prefs.excludedTopics.join("\n"));

    $("#maxLinksOpen").val(tabs.prefs.maxLinksOpen);
    $("#setFocusOnFirst").prop("checked", tabs.prefs.setFocusOnFirst);

    $("#notificationsEnabled").prop("checked", notifs.prefs.enabled);
    $("#audioVolume").val(notifs.prefs.audioVolume * 100);
    $("#muteHourPeriod").val(notifs.prefs.muteHourPeriod);
    $("#updateNotificationMinutePeriod").val(notifs.prefs.updateNotificationMinutePeriod);

    $("#vegetariano").prop("checked", other.prefs.vegetariano);
    $("#displayImages").prop("checked", other.prefs.displayImages);
    $("#popupSensibility").val(other.prefs.popupSensibility);
    $("#cleanDataOnLogout").prop("checked", other.prefs.cleanDataOnLogout);
  });
}

function displayMensagem(msg) {
  $("#mensagem #msgTxt").text(msg);
  $("#mensagem")
    .fadeIn()
    .delay(1000)
    .fadeOut();
}

function refreshExtensionData() {
  chrome.runtime.sendMessage({ reload: true });
  localStorage.removeItem("calendarioEmenta");
}

document.addEventListener("DOMContentLoaded", function() {
  let extensionVersion = chrome.runtime.getManifest().version;
  $("#currentVersion").text(`(${extensionVersion})`);

  $("tr:odd").addClass("odd");

  document.querySelector("#opcoes").addEventListener("submit", function(evt) {
    evt.preventDefault();
    saveOptions();
  });

  restoreOptions();
});

chrome.commands.getAll(function(cmds) {
  for (var i = 0; i < cmds.length; i++) {
    var elem = document.getElementById(cmds[i].name);

    if (elem) {
      elem.innerHTML = cmds[i].shortcut;
    }
  }
});
