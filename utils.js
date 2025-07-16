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
 * Performs an AJAX request using native fetch API
 * @param {Object} options - { url, method, headers, data, dataType }
 * @return {Promise} ES6 Promise resolving to response data
 */
Utils.ajax = function (options) {
  const controller = new AbortController();
  const signal = controller.signal;

  const fetchOptions = {
    method: options.method || 'GET',
    headers: options.headers || {},
    signal: signal
  };

  if (options.data) {
    if (options.method === 'POST' || options.method === 'PUT') {
      fetchOptions.body = typeof options.data === 'string'
        ? options.data
        : JSON.stringify(options.data);

      if (!fetchOptions.headers['Content-Type']) {
        fetchOptions.headers['Content-Type'] = 'application/json';
      }
    }
  }

  // Set up timeout
  const timeout = options.timeout || 0;
  let timeoutId;
  if (timeout > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }

  return fetch(options.url, fetchOptions)
    .then(response => {
      if (timeoutId) clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      if (options.dataType === 'json') return response.json();
      if (options.dataType === 'text') return response.text();
      return response;
    })
    .catch(error => {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    });
};



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
