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
 * Loads presisted data to an object
 * @param {Object} destination object
 * @param {String} property to load
 * @return {Promise} ES6 Promise of Chrome's storage sync
 */
Utils.load = function(dest, key) {
    return chromep.storage.sync.get(key).then((item) => {
        if (!item[key]) return;
        Object.keys(item[key]).forEach(k => dest[k] = item[key][k]);
    });
}

/**
 * Presists properties (not starting with '_') of an object indexed by a key
 * @param {String} key to presist
 * @param {Object} source object
 * @return {Promise} ES6 Promise of Chrome's storage sync
 */
Utils.save = function(key, src) {
    let save = {};
    save[key] = {};
    Object.keys(src).forEach(prop => {
        if (prop.charAt(0) !== '_') {
            save[key][prop] = src[prop];
        }
    });

    return chromep.storage.sync.set(save);
}
