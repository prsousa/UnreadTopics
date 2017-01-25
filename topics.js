"use strict"

var TopicsManager = TopicsManager || function () {
    this.notifierOnTopicsChange = function () { };
    this.notifierOnLoadingChange = function () { };
    this.notifierOnLoginStatusChange = function (newStatus) { };
    this.lastUpdate = new Date(0).getTime();
    this.isLoading = false;

    this.prefs = {
        forumURL: "http://lei-uminho.com/forum/",
        unreadOption: "unread;all;start=0",
        excludedTopics: []
    };

    this.db = {
        userId: 0,
        topicsDictionary: {},
        boardsDictionary: {},
        unreadTopics: [],
        unreadLinks: {},
        lastPosters: {}
    }
}

TopicsManager.prototype.save = function () {
    return Promise.all([
        Utils.saveLocally(this.db),
        Utils.saveRemotely(this.prefs)
    ]);
}

TopicsManager.prototype.load = function () {
    return Promise.all([
        Utils.loadLocally(this.db),
        Utils.loadRemotely(this.prefs)
    ]);
}

TopicsManager.prototype.setUnreadTopicsChangeListener = function (func) {
    this.notifierOnTopicsChange = func;
}

TopicsManager.prototype.setLoginStatusChangeListener = function (func) {
    this.notifierOnLoginStatusChange = func;
}

TopicsManager.prototype.setOnLoadingChangeListener = function (func) {
    this.notifierOnLoadingChange = func;
}

TopicsManager.prototype.isLoggedIn = function () {
    return this.db.userId > 0;
}

TopicsManager.prototype.clear = function () {
    this.lastUpdate = 0;
    this.db.topicsDictionary = {};
    this.db.boardsDictionary = {};
    this.db.unreadTopics = [];
    this.db.unreadLinks = {};
    this.db.lastPosters = {};
}

TopicsManager.prototype.setLoading = function (loadingState) {
    if (this.isLoading !== loadingState) {
        this.isLoading = loadingState;
        this.notifierOnLoadingChange();
    }
}

TopicsManager.prototype.isOutdated = function (minutes) {
    return ((new Date() - new Date(this.lastUpdate)) / 1000 / 60) > minutes;
}

TopicsManager.prototype.setUserId = function (userId) {
    if (this.db.userId != userId) {
        this.db.userId = userId;
        this.notifierOnLoginStatusChange(userId > 0);
    }
}

TopicsManager.prototype.setTopicRead = function (topicId) {
    let unreadPos = this.db.unreadTopics.indexOf(topicId);
    if (unreadPos >= 0) {
        this.db.unreadTopics.splice(unreadPos, 1);
        delete this.db.unreadLinks[topicId];
        delete this.db.lastPosters[topicId];
        
        this.notifierOnTopicsChange();
    }
}

TopicsManager.prototype.getLocalUnreadTopics = function () {
    var res = [];

    for (let topicId of this.db.unreadTopics) {
        res.push({
            name: this.db.topicsDictionary[topicId],
            link: this.db.unreadLinks[topicId],
            lastPoster: this.db.lastPosters[topicId]
        });
    }

    return res;
}

TopicsManager.prototype.knownBoard = function (boardId) {
    return this.db.boardsDictionary[boardId] !== undefined;
}

TopicsManager.prototype.isExcluded = function (topicId) {
    return this.prefs.excludedTopics.indexOf(topicId) !== -1;
}

TopicsManager.prototype.searchTopicsByName = function (searchText) {
    let res = [];
    searchText = searchText.toLowerCase().removeAccents();

    Object.keys(this.db.topicsDictionary).forEach(topicId => {
        let topicName = this.db.topicsDictionary[topicId].toLowerCase().removeAccents();
        if (topicName.indexOf(searchText) !== -1) {
            res.push({
                id: topicId,
                name: this.db.topicsDictionary[topicId]
            });
        }
    });

    return res;
}

TopicsManager.prototype.postIsValid = function (postDetails) {
    return this.knownBoard(postDetails.board)
        && postDetails.posterId != this.db.userId
        && !this.isExcluded(postDetails.topic)
        && postDetails.timestamp > (this.lastUpdate / 1000);
}

TopicsManager.prototype.receiveValidPost = function (postDetails) {
    let newUnreadTopics = false;

    if (this.postIsValid(postDetails)) {
        if (postDetails.currTopic == 0 || this.db.topicsDictionary[postDetails.topic] === undefined) {
            // new topic OR unknown topic name
            this.db.topicsDictionary[postDetails.topic] = postDetails.subject.trim().replace(/^Re: /gi, "");
        }

        this.db.lastPosters[postDetails.topic] = postDetails.posterName;

        if (this.db.unreadTopics.indexOf(postDetails.topic) === -1) {
            this.db.unreadTopics.push(postDetails.topic);
            newUnreadTopics = true;

            this.notifierOnTopicsChange();
        }
    }

    return newUnreadTopics;
}

TopicsManager.prototype.fetchUnread = function () {
    if( this.isLoading ) return Promise.reject("already-fetching");
    let _this = this;
    this.setLoading(true);

    let fetchPromise = Utils.ajax({
        url: this.prefs.forumURL + "?action=" + this.prefs.unreadOption,
        timeout: 10 * 1000 // 10 second timeout
    }).then(function (htmlData) {
        if (htmlData.indexOf("login") === -1 && htmlData.indexOf("logout") === -1) {
            return Promise.reject("server");
        }

        let userId = extractUserId(htmlData)

        if (userId === 0) {
            _this.setUserId(userId);
            return Promise.reject("loggedout");
        }

        _this.lastUpdate = new Date().getTime();
        _this.setUserId(userId);

        let unreadLinks = extractUnreadLinks(htmlData);
        _this.prefs.excludedTopics.forEach(excludedTopic => {
            delete unreadLinks[excludedTopic]
        });

        _this.db.unreadLinks = unreadLinks;
        _this.db.lastPosters = extractLastPosters(htmlData);
        Utils.extend(_this.db.topicsDictionary, extractTopicNames(htmlData));
        Utils.extend(_this.db.boardsDictionary, extractBoardNames(htmlData));

        let newUnreadTopics = !Utils.containsValues(_this.db.unreadTopics, Object.keys(unreadLinks));

        _this.db.unreadTopics = Object.keys(unreadLinks).reverse();
        _this.notifierOnTopicsChange();

        return newUnreadTopics;
    });

    fetchPromise.then(param => {
        _this.setLoading(false);
    }).catch(param => {
        _this.setLoading(false);
    });

    return fetchPromise;
}

TopicsManager.prototype.seedFromHTML = function (htmlData) {
    Utils.extend(this.db.topicsDictionary, extractTopicNames(htmlData));
    Utils.extend(this.db.boardsDictionary, extractBoardNames(htmlData));
    try {
        this.setUserId(extractUserId(htmlData));
    } catch (e) { };
}
