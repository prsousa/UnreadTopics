// Verificar se se está a ler a última página de um tópico para eventualemente o marcar como lido (icon)

var input = document.getElementsByName("last_msg");

var inReplyPage = window.location.toString().indexOf("action=post") >= 0;

if (input.length === 1 && !inReplyPage) {
    input = input[0];
    var lastPostID = input.value;

    if (document.getElementById("msg" + lastPostID)) {
        var topicID = document.getElementsByName("topic")[0].value;
        chrome.runtime.sendMessage({ "set-reading-last-page": topicID });
    }
}

// Send data to extension to be analysed
chrome.runtime.sendMessage({ "set-html": document.documentElement.outerHTML });

var displayPic = true;

chrome.runtime.sendMessage({ "get-embed-images": true }, function (msg) {
    displayPic = msg;
});


// SIDEBAR
if (!localStorage.bancoBlackListed)
    localStorage.bancoBlackListed = [];


jQuery.extend(jQuery.easing, {
    easeOutQuint: function (x, t, b, c, d, s) {
        t /= d;
        t--;
        return c * (t * t * t * t * t + 1) + b;
    }
});

function isURIImage(uri) {
    return (uri.match(/\.(jpg|gif|png|webm|gifv|jpg)$/) != null);
}

function displayPictures() {
    return displayPic;
}

function isURIX(uri, extension) {
    var extensionURI = uri.split('.').pop();
    return extensionURI == extension;
}

$("<div id='TPLS'><div id='topicosPLS'></div><div id='menuTPLS'></div></div>").appendTo($("body"));

$("<div class='followBox'></div>").appendTo($("body"));


$(".post a").mouseover(function (e) {
    if (isURIImage(this.href) && displayPictures()) {

        if (isURIX(this.href, 'webm')) {
            $('.followBox').html('<video controls="" autoplay="" name="media"><source src="' + this.href + '" type="video/webm"></video>');
        } else if (isURIX(this.href, 'gifv')) {

            var tokens = /https?:\/\/i\.imgur\.com\/([a-zA-Z0-9]+).gifv/.exec(this.href);

            if (tokens.length === 2) {
                var gifvID = tokens[1];
                $('.followBox').html('<video poster="https://i.imgur.com/' + gifvID + '.jpg" preload="auto" autoplay="autoplay" muted="muted" loop="loop" width="auto" height="auto"><source src="https://i.imgur.com/' + gifvID + '.mp4" type="video/mp4"></video>');
            } else {
                $('.followBox').html('(gifv) erro...');
            }

        } else {

            $('.followBox').html("<img src='http://" + Math.random() + "' />");
            var url = this.href;
            setTimeout(function () {
                $('.followBox').find('img').attr("src", url);
            }, 10);
        }
    }
});

$(".post a").mousemove(function (e) {
    if (isURIImage(this.href) && displayPictures()) {
        var screenWidth = $(window).width();
        var screenHeight = $(window).height();

        var boxWidth = $('.followBox').width();
        var boxHeight = $('.followBox').height();

        var boxX = e.pageX + 10;
        var boxY = e.pageY + 10;


        if (boxX - $(window).scrollLeft() + boxWidth > screenWidth - 20) {
            boxX -= boxX - $(window).scrollLeft() + boxWidth - screenWidth + 20;
        }

        if (boxY - $(window).scrollTop() + boxHeight > screenHeight - 20) {
            boxY -= boxY - $(window).scrollTop() + boxHeight - screenHeight + 20;
        }

        $('.followBox').css('left', boxX).css('top', boxY).css('display', 'block');
    }
});

$(".post a, .followBox").mouseout(function () {
    if (!$('.followBox').is(':hover')) {
        $('.followBox').css('display', 'none');
    }
});


$("#topicosPLS").on("mouseover", function (e) {
    e.preventDefault();

    if (!$(this).hasClass("open")) {
        openSidepage(function () {
            displayEmentas();
            getBancoTopicosPorLer();
            $("#menuTPLS #filtro").focus();
        });
    }
});


let closing = false;

$(document).mousemove(function (e) {
    if (closing) {
        let mouseX = e.pageX;
        let sidebarX = $("#TPLS").offset().left;
        let mouseXDistance = sidebarX - mouseX;
        const threshold = Math.min($(window).width() * 0.1, 200);

        if (mouseXDistance > threshold) {
            closeSidepage();
        }
    }
});

$("#TPLS").on("mouseleave", function (e) {
    e.preventDefault();
    closing = true;
});


function openSidepage(open) {
    open();

    $('#TPLS').animate({
        right: '0px'
    }, 700, 'easeOutQuint');

    $("#topicosPLS").addClass("open");
}


function closeSidepage() {
    // return;
    closing = false;
    $('#TPLS').animate({
        right: '-250px'
    }, 300, 'easeOutQuint', function () {
        $("#topicosPLS").removeClass("open");
    });
}



// Tópicos

var totalTopicos;

$("<input id='filtro' type='search' placeholder='Tópicos Por Ler...'>").appendTo("#menuTPLS");
$("<div id='actionLine'><div id='openSelected' class='botao'>Abrir Selecionados</div><div id='refreshTopics' class='botao'>↻</div></div>").appendTo("#menuTPLS");

function getSelectedTopicLinks() {
    var topicLinks = [];
    $("#topicosPorLer li.active").each(function () {
        let link = $(this).attr("data-topicLink");
        console.log(link);
        if (link) {
            topicLinks.push(link);
        }
    });

    return topicLinks;
}

function updateReportSelecionados() {
    var numeroSelecionados = getSelectedTopicLinks().length;
    $("#reportSelecionados").html(numeroSelecionados + "/" + totalTopicos);
}

$("#openSelected").on("click", function (e) {
    var topicLinks = getSelectedTopicLinks();

    if (topicLinks.length > 0) {
        chrome.runtime.sendMessage({ "open-links": topicLinks });
        setTimeout(() => {
            chrome.runtime.sendMessage({ "close-current-tab": true });
        }, 1500);
        closeSidepage();
    }
});

$("#refreshTopics").on("click", function (e) {
    chrome.runtime.sendMessage({ "fetch-unread-topics": true }, function (response) {
        if (response.success) {
            getBancoTopicosPorLer();
        }
    });
});


$("<ul id='topicosPorLer'></ul>").appendTo("#menuTPLS");
$("<div id='reportSelecionados'></div>").appendTo("#menuTPLS");
$("<div id='reportLastUpdate'></div>").appendTo("#menuTPLS");
$("<ul id='resultadoPesquisa' style='display: block;'></ul>").appendTo("#menuTPLS");

 Date.prototype.prettyDate = function() {
     let res = "há mais de 30 minutos";
     let diffSec = ( new Date() - this ) / 1000;

     if( diffSec < 10 ) res = "agora mesmo";
     else if( diffSec < 60 ) res = "há menos de um minuto atrás";
     else if( diffSec < (60 * 30) ) {
         let min = Math.floor(diffSec / 60);
         let plural = min > 1 ? "s" : "";
         res = `há ${min} minuto${plural} atrás`;
     }

     return res;
}

function getBancoTopicosPorLer() {
    chrome.runtime.sendMessage({ "get-unread-topics": true }, function (res) {
        let topicos = res.topics.filter( topico => topico.link );
        totalTopicos = topicos.length;

        $("ul#topicosPorLer").html("");
        //console.log(topicos);
        for (var i = 0; i < topicos.length; i++) {
            var linha = topicos[i].name + " <span class='autor'>" + topicos[i].lastPoster + "</span>";
            $("ul#topicosPorLer").append("<li data-topicLink='" + topicos[i].link + "'><div class='cont'>" + linha + "</div></li>");
        }

        $("#topicosPorLer li").first().addClass("active");
        updateReportSelecionados();
        $("#reportLastUpdate").text( new Date(res.lastUpdate).prettyDate() ) ;
    });
}

$('#topicosPorLer').on('click', 'li', function () {
    $(this).toggleClass("active");
    updateReportSelecionados();
});


$("#menuTPLS #filtro").on('search keyup', function (event) {
    filter(this, '#resultadoPesquisa');
});

function filter(by, container) {
    var value = $(by).val();

    if (value) {
        $("#topicosPorLer, #reportSelecionados, #reportLastUpdate").hide();
        $(container).fadeIn();
        chrome.runtime.sendMessage({ "search-topics": value }, function (topicosPotenciais) {
            $(container).html("");
            for (var i = 0; i < topicosPotenciais.length; i++) {
                $(container).append(htmlRowTopico(topicosPotenciais[i].name, topicosPotenciais[i].id));
            }
        });
    } else {
        $(container).hide();
        $("#topicosPorLer, #reportSelecionados, #reportLastUpdate").fadeIn();
    }
}

function htmlRowTopico(nomeTopico, idTopico) {
    return '<a href="http://lei-uminho.com/forum/?topic=' + idTopico + '.msg9999999#new" title="' + nomeTopico + '">\
                <li class="buttonRow">\
                    <span>' + nomeTopico + '</span>\
                </li>\
            </a>';
}





// Ementas


function getIdade(a) {
    return Math.abs(a - new Date().getTime()) / 1000;
}

function replacerAux(k, v) {
    if (v instanceof Array) {
        var o = {};
        for (var ind in v) {
            if (v.hasOwnProperty(ind)) {
                o[ind] = v[ind];
            }
        }
        return o;
    }
    return v;
}


var indexEmentaActual = 0;
var ementas;

$("<div id='ementa'><div title='Almoço' id='almoco'></div><div title='Jantar' id='jantar'></div><div class='head'><div class='botao' id='ant'><</div><div id='dia'></div><div class='botao' id='seg'>></div></div></div>").appendTo("#menuTPLS");

function displayEmentas() {
    getProximasEmentas(function (emnt) {
        ementas = emnt;
        if (!emnt.length) {
            $("#ementa").html("Sem Informação!");
        } else {
            indexEmentaActual = 0;

            if (ementas[0].data == new Date().setHours(0, 0, 0, 0) && new Date().getHours() > 20) { // se passa das 20h tentar mostrar ementa seguinte
                if (indexEmentaActual < ementas.length - 1)
                    indexEmentaActual++;
            }

            displayEmenta(indexEmentaActual);
        }
    });
}


$("#ementa #ant").click(function () {
    if (indexEmentaActual > 0)
        indexEmentaActual--;
    displayEmenta(indexEmentaActual);
});

$("#ementa #seg").click(function () {
    if (indexEmentaActual < ementas.length - 1)
        indexEmentaActual++;
    displayEmenta(indexEmentaActual);
});

function displayEmenta(offset) {
    var ementa = ementas[offset];

    $("#ementa #dia").html(dataToRelativeString(ementa.data * 1));
    $("#ementa #almoco").html(ementa.ementaA);
    $("#ementa #jantar").html(ementa.ementaJ);

    //$("#ementa").html(infoString);
}
