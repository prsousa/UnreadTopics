"use strict"

var TopicsManager = TopicsManager || function () {
    this._notifierOnTopicsChange = function () { };
    this._notifierOnLoadingChange = function () { };
    this._notifierOnLoginStatusChange = function (newStatus) { };
    this._lastUpdate = new Date(0).getTime();
    this._isLoading = false;

    this.forumURL = "http://lei-uminho.com/forum/";
    this.unreadOption = "unread;all;start=0";
    this.userId = 0;

    this.topicsDictionary = {};
    this.boardsDictionary = {};
    this.unreadTopics = [];
    this.unreadLinks = {};
    this.lastPosters = {};
    this.excludedTopics = [];
}

TopicsManager.prototype.setUnreadTopicsChangeListener = function (func) {
    this._notifierOnTopicsChange = func;
}

TopicsManager.prototype.setLoginStatusChangeListener = function (func) {
    this._notifierOnLoginStatusChange = func;
}

TopicsManager.prototype.setOnLoadingChangeListener = function (func) {
    this._notifierOnLoadingChange = func;
}

TopicsManager.prototype.isLoggedIn = function () {
    return this.userId > 0;
}

TopicsManager.prototype.clear = function () {
    this._lastUpdate = 0;
    this.topicsDictionary = {};
    this.boardsDictionary = {};
    this.unreadTopics = [];
    this.unreadLinks = {};
    this.lastPosters = {};
}

TopicsManager.prototype.setLoading = function (loadingState) {
    if (this._isLoading !== loadingState) {
        this._isLoading = loadingState;
        this._notifierOnLoadingChange();
    }
}

TopicsManager.prototype.isOutdated = function (minutes) {
    return ((new Date() - new Date(this._lastUpdate)) / 1000 / 60) > minutes;
}

TopicsManager.prototype.setUserId = function (userId) {
    if (this.userId != userId) {
        this.userId = userId;
        this._notifierOnLoginStatusChange(userId > 0);
    }
}

TopicsManager.prototype.setTopicRead = function (topicId) {
    let unreadPos = this.unreadTopics.indexOf(topicId);
    if (unreadPos >= 0) {
        this.unreadTopics.splice(unreadPos, 1);
        this._notifierOnTopicsChange();
    }
}

TopicsManager.prototype.getLocalUnreadTopics = function () {
    var res = [];

    for (let topicId of this.unreadTopics) {
        res.push({
            name: this.topicsDictionary[topicId],
            link: this.unreadLinks[topicId],
            lastPoster: this.lastPosters[topicId]
        });
    }

    return res;
}

TopicsManager.prototype.knownBoard = function (boardId) {
    return this.boardsDictionary[boardId] !== undefined;
}

TopicsManager.prototype.isExcluded = function (topicId) {
    return this.excludedTopics.indexOf(topicId) !== -1;
}

TopicsManager.prototype.searchTopicsByName = function (searchText) {
    let res = [];
    searchText = searchText.toLowerCase().removeAccents();

    Object.keys(this.topicsDictionary).forEach(topicId => {
        let topicName = this.topicsDictionary[topicId].toLowerCase().removeAccents();
        if (topicName.indexOf(searchText) !== -1) {
            res.push({
                id: topicId,
                name: this.topicsDictionary[topicId]
            });
        }
    });

    return res;
}

TopicsManager.prototype.receiveValidPost = function (postDetails) {
    let newUnreadTopics = false;

    if (this.knownBoard(postDetails.board) && postDetails.posterId != this.userId && !this.isExcluded(postDetails.topic)) {
        if (postDetails.currTopic == 0 || this.topicsDictionary[postDetails.topic] === undefined) {
            // new topic OR unknown topic name
            this.topicsDictionary[postDetails.topic] = postDetails.subject.trim().replace(/^Re: /gi, "");
        }

        this.lastPosters[postDetails.topic] = postDetails.posterName;

        if (this.unreadTopics.indexOf(postDetails.topic) === -1) {
            this.unreadTopics.push(postDetails.topic);
            newUnreadTopics = true;

            this._notifierOnTopicsChange();
        }
    }

    return newUnreadTopics;
}

TopicsManager.prototype.fetchUnread = function () {
    let _this = this;
    this.setLoading(true);
    return Utils.ajax({
        url: this.forumURL + "?action=" + this.unreadOption,
        timeout: 10 * 1000 // 10 second timeout
    }).then(function (htmlData) {
        if (htmlData.indexOf("login") === -1 && htmlData.indexOf("logout") === -1) {
            return Promise.reject("error::page");
        }

        let userId = extractUserId(htmlData)

        if (userId === 0) {
            _this.setUserId(userId);
            return Promise.reject("error::loggedout");
        }

        _this._lastUpdate = new Date().getTime();
        _this.setUserId(userId);

        let newUnreadTopics = false;

        let unreadLinks = extractUnreadLinks(htmlData);
        _this.excludedTopics.forEach(excludedTopic => {
            delete unreadLinks[excludedTopic]
        });
        
        Utils.extend(_this.unreadLinks, unreadLinks);
        Utils.extend(_this.lastPosters, extractLastPosters(htmlData));
        Utils.extend(_this.topicsDictionary, extractTopicNames(htmlData));
        Utils.extend(_this.boardsDictionary, extractBoardNames(htmlData));

        newUnreadTopics = !Utils.containsValues(_this.unreadTopics, Object.keys(unreadLinks));

        _this.unreadTopics = Object.keys(unreadLinks).reverse();
        _this._notifierOnTopicsChange();

        return newUnreadTopics;
    }).then(param => {
        _this.setLoading(false);
        return param;
    }).catch(param => {
        _this.setLoading(false);
        return Promise.reject(param);
    });
}

TopicsManager.prototype.seedFromHTML = function (htmlData) {
    Utils.extend(this.topicsDictionary, extractTopicNames(htmlData));
    Utils.extend(this.boardsDictionary, extractBoardNames(htmlData));
    try {
        this.setUserId(extractUserId(htmlData));
    } catch (e) { };
}
