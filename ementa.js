var hoje = new Date().setHours(0, 0, 0, 0);
// https://www.googleapis.com/calendar/v3/calendars/cfc0289d736db3a530d663a2a3e70d7f2da313eaebfa9e76718338f09a6175ae@group.calendar.google.com/events?singleEvents=true&timeMin=2023-11-29T00:00:00Z&orderBy=startTime&alwaysIncludeEmail=false&showDeleted=false&maxResults=250&key=AIzaSyBJd7mhA4xaW0qPZDpuexEwG_yBYPX-VA0
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

let ementaNormalID = "cfc0289d736db3a530d663a2a3e70d7f2da313eaebfa9e76718338f09a6175ae";

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
  var pagNormal =
    "https://www.googleapis.com/calendar/v3/calendars/" +
    ementaNormalID +
    "@group.calendar.google.com/events" +
    opts;

  $.get(pagNormal, function(ementas) {
    console.log("ementas");
    $.each(ementas.items, function(i, comer) {
      date = new Date(comer.start.dateTime);
      if (date.getHours() == 12){
        var ementa = comer.summary;
        var dia = new Date(comer.start.dateTime).setHours(0, 0, 0, 0);
        calendario[dia] = { almoco: ementa, jantar: "" };
      } else {
        var ementa = comer.summary;
        var dia = new Date(comer.start.dateTime).setHours(0, 0, 0, 0);
        if (calendario[dia]) {
          calendario[dia].jantar = ementa;
        }
      }
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
