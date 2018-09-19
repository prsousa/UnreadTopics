var hoje = new Date().setHours(0, 0, 0, 0);

const APIKey = "AIzaSyBJd7mhA4xaW0qPZDpuexEwG_yBYPX-VA0";
const diasSemana = [
  "Dom.",
  "Seg.",
  "Ter.",
  "Qua.",
  "Qui.",
  "Sex.",
  "Sab.",
  "Dom."
];

let ementaAlmocoID = "5ttsisforihpn2o3blhe3s4tlo";
let ementaJantarID = "uinm3kojaoe3llod88ma22o78s";

function getProximasEmentas(onComplete) {
  var datasProx = getDataProximaEmenta();
  const lastUpdate =
    new Date() -
    (localStorage["calendarioEmenta"]
      ? JSON.parse(localStorage["calendarioEmenta"]).data || 0
      : 0);

  if (datasProx.length === 0 && lastUpdate > 30 * 1000) {
    return getEmentas(function() {
      getProximasEmentas(onComplete);
    });
  }

  onComplete(datasProx);
}

function getDataProximaEmenta() {
  var res = [];

  if (localStorage["calendarioEmenta"]) {
    var calendario = JSON.parse(localStorage["calendarioEmenta"]);

    var datas = Object.keys(calendario);

    var i;
    for (i = 0; i < datas.length; i++) {
      var data = datas[i];
      if (data >= hoje) {
        res.push({
          ementaA: calendario[data].almoco,
          ementaJ: calendario[data].jantar,
          data: data
        });
      }
    }

    res.sort(function(a, b) {
      if (a.data < b.data) return -1;
      if (a.data > b.data) return 1;
      return 0;
    });
  }

  return res;
}

function getEmentas(onComplete) {
  var calendario = {};

  console.log("Actualizar Ementa");

  var m = new Date(hoje);
  var hojeTXT =
    m.getFullYear() +
    "-" +
    ("0" + (m.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + m.getDate()).slice(-2); // YYYY-MM-DD
  var opts =
    "?singleEvents=true&timeMin=" +
    hojeTXT +
    "T00:00:00Z&orderBy=startTime&alwaysIncludeEmail=false&showDeleted=false&maxResults=250&key=" +
    APIKey;
  var pagAlmoco =
    "https://www.googleapis.com/calendar/v3/calendars/" +
    ementaAlmocoID +
    "@group.calendar.google.com/events" +
    opts;
  var pagJantar =
    "https://www.googleapis.com/calendar/v3/calendars/" +
    ementaJantarID +
    "@group.calendar.google.com/events" +
    opts;

  $.get(pagAlmoco, function(dataAlmoco) {
    console.log("dataAlmoco");

    $.each(dataAlmoco.items, function(i, almoco) {
      var ementa = almoco.summary;
      var dia = new Date(almoco.start.dateTime).setHours(0, 0, 0, 0);
      calendario[dia] = { almoco: ementa, jantar: "" };
    });

    $.get(pagJantar, function(dataJantar) {
      $.each(dataJantar.items, function(i, jantar) {
        var ementa = jantar.summary;
        var dia = new Date(jantar.start.dateTime).setHours(0, 0, 0, 0);
        if (calendario[dia]) {
          calendario[dia].jantar = ementa;
        }
      });

      calendario["data"] = new Date().getTime();
      localStorage["calendarioEmenta"] = JSON.stringify(calendario);
      onComplete();
    });
  });
}

function dataToRelativeString(data) {
  var dif = data - hoje;
  var day = 1000 * 60 * 60 * 24;

  if (dif >= 0) {
    if (dif < day) return "Hoje";
    if (dif < 2 * day) return "Amanhã";
  }

  var d = new Date(data);

  if (dif > 0 && dif < 7 * day) {
    // se for nos próximos 7 dias
    return diasSemana[d.getDay()];
  }

  var month = d.getMonth() + 1;
  var day = d.getDate();
  return day + "/" + month;
}
