"use strict";

// Remove accents from strings
String.prototype.removeAccents = function () {
  return this
    .replace(/[áàãâä]/gi, "a")
    .replace(/[éè¨ê]/gi, "e")
    .replace(/[íìïî]/gi, "i")
    .replace(/[óòöôõ]/gi, "o")
    .replace(/[úùüû]/gi, "u")
    .replace(/[ç]/gi, "c")
    .replace(/[ñ]/gi, "n")
    .replace(/[^a-zA-Z0-9]/g, " ");
}

// Decode HTML entities using regex fallback
String.prototype.decodeEntities = function () {
  return this
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
}

// Extract user ID from HTML
var extractUserId = function (htmlData) {
  if (htmlData.includes('id="button_login"')) return 0;

  const reg = /\?user_id=(\d+)&/;
  const match = reg.exec(htmlData);
  if (match) return match[1];
  throw "User ID Not Found";
}

// Extract topic names
var extractTopicNames = function (htmlData) {
  const res = {};
  const reg = /<span id.*?topic=(\d+)\.0.*?">(.*?)<\/a>/g;
  let match;

  while ((match = reg.exec(htmlData))) {
    res[match[1]] = match[2].trim().decodeEntities();
  }

  return res;
}

// Extract board names using regex
var extractBoardNames = function (htmlData) {
  const res = {};
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(htmlData)) !== null) {
    const href = match[1];
    const text = match[2].trim().decodeEntities();
    const boardMatch = /board=(\d+)\.0$/.exec(href);
    if (boardMatch && text.length > 0) {
      res[boardMatch[1]] = text;
    }
  }

  return res;
}

// Extract last posters
var extractLastPosters = function (htmlData) {
  var res = {};

  var reg = /<span id.*topic=(\d+)\.0.*">(.*)<\/a>/g;
  var found;
  while ((found = reg.exec(htmlData))) {
    res[found[1]] = htmlData.substring(htmlData.indexOf(found[0])).match(/[\t ]{2,}(by|por).*">(.*)<\/a>/)[2].trim().decodeEntities();
  }

  return res;
}

// Extract unread topic links
var extractUnreadLinks = function (htmlData) {
  const links = extractAnchorHrefs(htmlData);
  return filterUnreadLinks(links);
};

// Extract all anchor hrefs
function extractAnchorHrefs(htmlData) {
  const res = [];
  const anchorRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["']/gi;
  let match;

  while ((match = anchorRegex.exec(htmlData)) !== null) {
    res.push(match[1]);
  }

  return res;
}

// Filter unread topic links
var filterUnreadLinks = function (linksList) {
  const res = {};

  for (let i = 0; i < linksList.length; i++) {
    if (linksList[i].includes("topicseen#new")) {
      const topicId = extractTopicID(linksList[i]);
      res[topicId] = linksList[i];
    }
  }

  return res;
};

// Extract topic ID from link
var extractTopicID = function (link) {
  const match = /topic=(\d+)/.exec(link);
  return match ? match[1] : 0;
};
