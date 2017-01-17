"use strict"

String.prototype.removeAccents = function(){
 return this
         .replace(/[áàãâä]/gi,"a")
         .replace(/[éè¨ê]/gi,"e")
         .replace(/[íìïî]/gi,"i")
         .replace(/[óòöôõ]/gi,"o")
         .replace(/[úùüû]/gi, "u")
         .replace(/[ç]/gi, "c")
         .replace(/[ñ]/gi, "n")
         .replace(/[^a-zA-Z0-9]/g," ");
}

String.prototype.decodeEntities = function () {
    var elem = document.createElement('textarea');
    elem.innerHTML = this;
    return elem.value;
};

var extractUserId = function (htmlData) {
    if (htmlData.indexOf('id="button_login"') !== -1) return 0;

    var reg = /\?user_id=(\d+)&/g;
    let found;
    if ((found = reg.exec(htmlData))) {
        return found[1];
    } else {
        throw "User ID Not Found";
    }
}

var extractTopicNames = function (htmlData) {
    var res = {};

    var reg = /<span id.*topic=(\d+)\.0.*">(.*)<\/a>/g;
    var found;
    while ((found = reg.exec(htmlData))) {
        res[found[1]] = found[2].trim().decodeEntities();
    }

    return res;
}

var extractBoardNames = function (htmlData) {
    var res = {};

    var container = document.createElement("p");
    container.innerHTML = htmlData;
    var anchors = container.getElementsByTagName("a");

    for (var i = 0; i < anchors.length; i++) {
        let reg = /board=(\d+)\.0$/g;
        let tokens;
        if ((tokens = reg.exec(anchors[i].href))) {
            let boardName = anchors[i].textContent.decodeEntities().trim();
            if (boardName.length > 0) {
                res[tokens[1]] = boardName;
            }
        }
    }

    return res;
}

var extractLastPosters = function (htmlData) {
    var res = {};

    var reg = /<span id.*topic=(\d+)\.0.*">(.*)<\/a>/g;
    var found;
    while ((found = reg.exec(htmlData))) {
        res[found[1]] = htmlData.substring(htmlData.indexOf(found[0])).match(/[\t ]{2,}(by|por).*">(.*)<\/a>/)[2].trim().decodeEntities();
    }

    return res;
}

var extractUnreadLinks = function (htmlData) {
    var links = extractAnchorHrefs(htmlData);
    return filterUnreadLinks(links);
}

var extractAnchorHrefs = function (htmlData) {
    var res = [];

    var container = document.createElement("p");
    container.innerHTML = htmlData;
    var anchors = container.getElementsByTagName("a");

    for (var i = 0; i < anchors.length; i++) {
        var href = anchors[i].href;
        res.push(href);
    }

    return res;
}

var filterUnreadLinks = function (linksList) {
    var res = {};

    for (var i = 0; i < linksList.length; i++) {
        if (linksList[i].indexOf("topicseen#new") !== -1) {
            var topicId = extractTopicID(linksList[i]);
            res[topicId] = linksList[i];
        }
    }

    return res;
}

var extractTopicID = function (link) {
    var matches = link.match(/topic=(\d+)/);
    if (matches === null)
        return 0;

    return matches[1];
}
