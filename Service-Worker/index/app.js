/*!
 * storejs v1.0.16
 * Local storage localStorage package provides a simple API
 *
 * Copyright (c) 2017 kenny wang <wowohoo@qq.com>
 * https://github.com/jaywcjlove/_store.js
 *
 * Licensed under the MIT license.
 */
(function (f) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
      module.exports = f()
    // eslint-disable-next-line no-undef
    } else if (typeof define === 'function' && define.amd) {
      // eslint-disable-next-line no-undef
      define([], f)
    } else {
      var g
      if (typeof window !== 'undefined') {
        g = window
      } else if (typeof global !== 'undefined') {
        g = global
      } else if (typeof self !== 'undefined') {
        g = self
      } else {
        g = this
      }
      g._store = f()
    }
  })(function () {
    if (!window.localStorage) return
    var storage = window.localStorage; var _store
    // eslint-disable-next-line no-unused-vars
    var _api
    // eslint-disable-next-line camelcase
    var even_storage = function () {}
    function isJSON (obj) {
      return typeof obj === 'object' && Object.prototype.toString.call(obj).toLowerCase() === '[object object]' && !obj.length
    }
    function stringify (val) {
      return val === undefined || typeof val === 'function' ? val + '' : JSON.stringify(val)
    }
    function deserialize (value) {
      if (typeof value !== 'string') {
        return undefined
      }
      try {
        return JSON.parse(value)
      } catch (e) {
        return value || undefined
      }
    }
    function isFunction (value) {
      return {}.toString.call(value) === '[object Function]'
    }
    function isArray (value) {
      return value instanceof Array
    }
    function dealIncognito (storage) {
      var _KEY = '_Is_Incognit'; var _VALUE = 'yes'
      try {
        storage.setItem(_KEY, _VALUE)
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          var _nothing = function () {}
          // eslint-disable-next-line no-proto
          storage.__proto__ = {
            setItem: _nothing,
            getItem: _nothing,
            removeItem: _nothing,
            clear: _nothing
          }
        }
      } finally {
        if (storage.getItem(_KEY) === _VALUE) storage.removeItem(_KEY)
      }
      return storage
    }
    // deal QuotaExceededError if user use incognito mode in browser
    storage = dealIncognito(storage)
    function Store () {
      if (!(this instanceof Store)) {
        return new Store()
      }
    }
    // function dealIncognito (storage) {
    //   var _KEY = '_Is_Incognit', _VALUE = 'yes';
    //   try { storage.setItem(_KEY, _VALUE) }
    //   catch (e) {
    //     if (e.name === 'QuotaExceededError') {
    //       var _nothing = function () {};
    //       storage.__proto__ = { setItem: _nothing, getItem: _nothing, removeItem: _nothing, clear: _nothing };
    //     }
    //   }
    //   finally { if (storage.getItem(_KEY) === _VALUE) storage.removeItem(_KEY); }
    //   return storage;
    // }
    // // deal QuotaExceededError if user use incognito mode in browser
    // storage = dealIncognito(storage);
    Store.prototype = {
      set: function (key, val) {
        even_storage('set', key, val)
        if (key && !isJSON(key)) {
          storage.setItem(key, stringify(val))
        } else if (key && isJSON(key) && !val) {
          for (var a in key) this.set(a, key[a])
        }
        return this
      },
      get: function (key) {
        if (!key) {
          var ret = {}
          this.forEach(function (key, val) {
            ret[key] = val
          })
          return ret
        }
        if (key.charAt(0) === '?') {
          return this.has(key.substr(1))
        }
        return deserialize(storage.getItem(key))
      },
      clear: function () {
        this.forEach(function (key, val) {
          even_storage('clear', key, val)
        })
        storage.clear()
        return this
      },
      remove: function (key) {
        var val = this.get(key)
        storage.removeItem(key)
        even_storage('remove', key, val)
        return val
      },
      has: function (key) {
        return {}.hasOwnProperty.call(this.get(), key)
      },
      keys: function () {
        var d = []
        this.forEach(function (k, list) {
          d.push(k)
        })
        return d
      },
      size: function () {
        return this.keys().length
      },
      forEach: function (callback) {
        for (var i = 0; i < storage.length; i++) {
          var key = storage.key(i)
          if (callback(key, this.get(key)) === false) break
        }
        return this
      },
      search: function (str) {
        var arr = this.keys(); var dt = {}
        for (var i = 0; i < arr.length; i++) {
          if (arr[i].indexOf(str) > -1) dt[arr[i]] = this.get(arr[i])
        }
        return dt
      },
      onStorage: function (cb) {
        // eslint-disable-next-line camelcase
        if (cb && isFunction(cb)) even_storage = cb
        return this
      }
    }
    _store = function (key, data) {
      var argm = arguments; var _Store = Store(); var dt = null
      if (argm.length === 0) return _Store.get()
      if (argm.length === 1) {
        if (typeof key === 'string') return _Store.get(key)
        if (isJSON(key)) return _Store.set(key)
      }
      if (argm.length === 2 && typeof key === 'string') {
        if (!data) return _Store.remove(key)
        if (data && typeof data === 'string') return _Store.set(key, data)
        if (data && isFunction(data)) {
          dt = null
          dt = data(key, _Store.get(key))
          return dt ? _store.set(key, dt) : _store
        }
      }
      if (argm.length === 2 && isArray(key) && isFunction(data)) {
        for (var i = 0; i < key.length; i++) {
          dt = data(key[i], _Store.get(key[i]))
          _store.set(key[i], dt)
        }
        return _store
      }
    }
    for (var a in Store.prototype) _store[a] = Store.prototype[a]
    return _store
  })
  