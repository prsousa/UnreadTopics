$(document).ready(function () {

  abreMenu();
  chrome.runtime.sendMessage({ "get-popup-sensibility": true }, function (
    sensibility
  ) {
    startProgress(sensibility || 400, () => {
      openUnreadTabs();
    });
  });
  $("#filtro").focus();
  $("#filtro").on("search keyup", function (event) {
    $("#progress").stop();

    var searchedString = $(this).val();
    filter(searchedString, "#resultadoPesquisa");
    $("#searchAnchor").attr(
      "href",
      "http://www.lei-uminho.com/forum/?action=search2&search=" + searchedString
    );
  });

  $("#search").click(function () {
    pesquisaForum($("#filtro").val());
  });

  $(".popupContainer").mouseover(function () {
    $("#progress").stop();
  });

  showEmentas();
});

function filter(value, container) {
  if (value) {
    $(container).slideDown("fast");
    $("#webAppButtons").hide();

    chrome.runtime.sendMessage({ "search-topics": value }, function (
      topicosPotenciais
    ) {
      $(container).html("");

      for (var i = 0; i < topicosPotenciais.length; i++) {
        $(container).append(
          htmlRowTopico(topicosPotenciais[i].name, topicosPotenciais[i].id)
        );
      }

      $("#search").show();
    });
  } else {
    $(container).hide();
    $("#search").hide();
    $("#webAppButtons").fadeIn();
  }
}

function htmlRowTopico(nomeTopico, idTopico) {
  return (
    '<li class="buttonRow">\
                <a href="http://www.lei-uminho.com/forum/?topic=' +
    idTopico +
    '.msg9999999#new" target="_blank" class="popupButton hover" title="' +
    nomeTopico +
    '">\
                    <img class="buttonIcon" src="/img/topic.svg" alt="mtLogo">\
                    <span>' +
    nomeTopico +
    "</span>\
                </a>\
            </li>"
  );
}

function startProgress(time, concluido) {
  $("#progress").animate({ width: "100%" }, time * 1.0, "linear", concluido);
}

function openUnreadTabs() {
  $("#result").show();

  $("#report")
    .show()
    .html("<hr />")
    .prepend("A Carregar...");

  chrome.runtime.sendMessage({ "open-unread-topics": true }, function (
    response
  ) {
    if (!response) return;

    chrome.runtime.sendMessage( {"print-msg": response});

    let msg = "";
    if (response.success && response.unreadTopics.length >= 0) {
      if (response.unreadTopics.length === 0) {
        msg = "Tópicos Todos Lidos";
      } else {
        let plural = response.unreadTopics.length > 1 ? "s" : "";
        msg =
          response.unreadTopics.length +
          " Tópico" +
          plural +
          " Aberto" +
          plural;
      }
    } else {
      if (response.msg &&
          typeof response.msg === "string" &&
          response.msg.indexOf("loggedout") !== -1) {
        msg = "Sem Sessão Iniciada";
      } else {
        msg = "Ocorreu Um Erro: " + (response.msg || "Desconhecido");
        console.log(response.msg);
      }
    }

    $("#report")
      .show()
      .html("<hr />")
      .prepend(msg);
  });
}

function abreMenu() {
  setIconNotifications();

  $("#configIcon").click(() => {
    chrome.runtime.sendMessage({ "open-config-page": true });
  });

  $("#topicosLer").click(() => {
    openUnreadTabs();
  });
  $("#notifications").click(toggleNofiticationState);

  $("#menu").show();
}

let postponeExpirationDate = 0;
let postponedUpdateInterval;
let currentNotificationState;

function updatePostponedCountdown() {
  let date_future = postponeExpirationDate;
  var date_now = new Date().getTime();

  if (date_now > date_future) {
    setIconNotifications();
    clearInterval(postponedUpdateInterval);
  }

  var seconds = Math.floor((date_future - date_now) / 1000);
  var minutes = Math.floor(seconds / 60);
  var hours = Math.floor(minutes / 60);

  minutes = minutes - hours * 60;
  seconds = seconds - hours * 60 * 60 - minutes * 60;

  var text =
    ("0" + hours).slice(-2) +
    ":" +
    ("0" + minutes).slice(-2) +
    ":" +
    ("0" + seconds).slice(-2);
  $("#postponedCountdown").text(text);
}

function setIconNotifications() {
  $("#notificationsDisabledIcon, #postponedCountdown").hide();
  chrome.runtime.sendMessage({ "get-notifications-state": true }, function (
    notificationsState
  ) {
    currentNotificationState = notificationsState;

    if (!notificationsState.enabled) {
      $("#notificationsDisabledIcon").show();
    } else if (notificationsState.currentlyBlocked) {
      $("#postponedCountdown").show();
      postponeExpirationDate = notificationsState.muttedUntil;

      clearInterval(postponedUpdateInterval);
      updatePostponedCountdown();
      postponedUpdateInterval = setInterval(updatePostponedCountdown, 1000);
    } else {
      clearInterval(postponedUpdateInterval);
    }
  });
}

function toggleNofiticationState() {
  if (
    !currentNotificationState.enabled ||
    currentNotificationState.currentlyBlocked
  ) {
    chrome.runtime.sendMessage({
      "set-notifications-enabled": !currentNotificationState.enabled
    });
  } else {
    chrome.runtime.sendMessage({ "postpone-notifications-period": true });
  }

  setTimeout(setIconNotifications, 50);
}

// Ementas

var indexEmentaActual = 0;
var ementas = [];
var timerEmentas;
function ementaSeguinte() {
  if (indexEmentaActual < ementas.length - 1) {
    indexEmentaActual++;
    showEmenta();
  }
}

function ementaAnterior() {
  if (indexEmentaActual > 0) {
    indexEmentaActual--;
    showEmenta();
  }
}

function showEmenta() {
  clearTimeout(timerEmentas);
  var ementa = ementas[indexEmentaActual];
  toggleEverySeconds(
    5,
    { ementa: ementa.ementaA, momento: "almoço" },
    { ementa: ementa.ementaJ, momento: "jantar" }
  );
  $("#dataCont").html(dataToRelativeString(ementa.data * 1).toLowerCase());
  ementaArrowStates();
}

function ementaArrowStates() {
  if (indexEmentaActual >= ementas.length - 1) {
    $("#ementa #controladoresEmenta #upEmenta").addClass("inactive");
  } else {
    $("#ementa #controladoresEmenta #upEmenta").removeClass("inactive");
  }

  if (indexEmentaActual <= 0) {
    $("#ementa #controladoresEmenta #downEmenta").addClass("inactive");
  } else {
    $("#ementa #controladoresEmenta #downEmenta").removeClass("inactive");
  }
}

function showEmentas() {
  $("#ementa")
    .mouseover(function () {
      $("#ementa #iconEmenta").hide();
      $("#ementa #controladoresEmenta").show();
    })
    .mouseout(function () {
      $("#ementa #iconEmenta").show();
      $("#ementa #controladoresEmenta").hide();
    });
  $("#upEmenta").click(ementaSeguinte);
  $("#downEmenta").click(ementaAnterior);
  $("#ementaCont > span").html("<i>A Carregar...</i>");
  $("#dataCont, #momentoCont").text("-");
  $("#ementa").show();
  getProximasEmentas(function (emnt) {
    ementas = emnt;
    
    if (!ementas.length) {
      $("#ementaCont > span").html("<i>Sem Informação</i>");
      ementaArrowStates();
    } else {
      indexEmentaActual = 0;

      if (
        ementas[0].data == new Date().setHours(0, 0, 0, 0) &&
        new Date().getHours() > 20
      ) {
        // se passa das 20h tentar mostrar ementa seguinte
        if (indexEmentaActual < ementas.length - 1) indexEmentaActual++;
      }
      showEmenta();
    }
  });
}

function toggleEverySeconds(segs, a, b) {
  $("#ementaCont > span").fadeOut(300, function () {
    $(this).text(a.ementa);
    $(this).attr("title", a.ementa);
    $(this).fadeIn(200);
  });

  $("#momentoCont").text(a.momento);
  timerEmentas = setTimeout(toggleEverySeconds, segs * 1000, segs, b, a);
}
