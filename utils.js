"use strict"

let Utils = {};

/**
 * Extends an object with the key/values of another one
 * @param {Object} container
 * @param {Object} newObject
 * @return {Bool} was container modified
 */
Utils.extend = function (container, newObject) {
    let containerChanged = false;

    for (let k in newObject) {
        if (container[k] !== newObject[k]) {
            container[k] = newObject[k];
            containerChanged = true;
        }
    }

    return containerChanged;
}

/**
 * Determines whether an array contains values
 * @param {Array} container
 * @param {Array} values
 * @return {Bool} containsValues
 */
Utils.containsValues = function (array, values) {
    for (let v of values) {
        if (array.indexOf(v) === -1) {
            return false;
        }
    }

    return true;
}

/**
 * Converts jQuery's ajax returning promise to the ES6 promise standard
 * @param {Object} ajax options
 * @return {Promise} ES6 Promise of $.ajax
 */
Utils.ajax = function (options) {
    return new Promise(function (resolve, reject) {
        $.ajax(options).done(resolve).fail(reject);
    });
}

/**
 * Delays Promise resolvement
 * @param {Integer} delay time in minutes
 * @return {Promise} ES6 Promise of a future event
 */
Utils.delay = function (minutes) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, minutes * 60 * 1000);
    });
}

/**
 * Keeps on retrying a function when it fails
 * @param {Function} function to (re)execute
 * @param {Integer} number of consecutive exceptions
 * @param {Integer} base delay, in minutes
 * @return {Promise} ES6 Promise of the successful call
 */
Utils.doRetry = function(fn, consecutiveExecep = 0, baseDelay = 5) {
    return fn().catch(reason => {
        console.log("Error Updating", reason);

        if (!navigator.onLine)
            baseDelay = 0.5;
        else if (reason.statusText === "timeout")
            baseDelay = 2;

        let delayTime = baseDelay * Math.min(10, Math.pow(1.4, consecutiveExecep));
        console.log("Retrying in ", delayTime, "minutes");
        return Utils.delay(delayTime).then(() => Utils.doRetry(fn, consecutiveExecep + 1));
    });
}

/**
 * Loads presisted data to an object
 * @param {Object} destination object
 * @param {Object} database resource
 * @return {Promise} ES6 Promise of resource's get
 */
Utils.load = function (dest, resource) {
    return resource.get(Object.keys(dest)).then(items => {
        Object.keys(items).forEach(k => dest[k] = items[k]);
    });
}

Utils.loadLocally = function (dest) {
    return Utils.load(dest, chromep.storage.local);
}

Utils.loadRemotely = function (dest) {
    return Utils.load(dest, chromep.storage.sync);
}

/**
 * Presists properties of an object
 * @param {Object} source object
 * @param {Object} database resource
 * @return {Promise} ES6 Promise of resource's set
 */
Utils.save = function (src, resource) {
    return resource.set(src);
}

Utils.saveLocally = function (src) {
    return Utils.save(src, chromep.storage.local);
}

Utils.saveRemotely = function (src) {
    return Utils.save(src, chromep.storage.sync);
}
