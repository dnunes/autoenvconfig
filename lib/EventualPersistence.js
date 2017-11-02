const
  fs = require('fs')
, _ = require('./helpers')
;

class EventualPersistence {
  constructor(filePath, minPersistInterval) {
    if (minPersistInterval === null) { minPersistInterval = 120; }

    this._filePath = filePath;
    this._minPersistInterval = minPersistInterval;
    this._timeout = null;

    let persistedData = {};

    if (!fs.existsSync(filePath)) {
      this._tryCreate(filePath);
    } else {
      try {
        persistedData = _.loadReference(filePath);

      } catch (err) {
        persistedData = {};

        if (err.code === 'ENOENT') { //Missing file. Try to create it.
          this._tryCreate(filePath);
        } else if (SyntaxError && err instanceof SyntaxError) {
          //TODO: add option to ignore error and create a new file on error!
          //if (false) { //purge the file and write "{}" on it.
          //  persistedData = {};
          //}

          //Syntax error on persistence file. This should never happen.
          throw new Error(
            'There is a syntax error in your persistence file "'+ filePath +'". '+
            'Maybe it got corrupted? Please fix or purge it and try again. '+
            'Error message: "'+ err.message +'".'
          );

        } else { //Other errors
          throw new Error(
            'Unknown error while loading your persistence file "'+ filePath +'". '+
            'Error message: "'+ err.message +'".'
          );
        }
      }
    }

    this._persistedData = persistedData;
  }

  _tryCreate(filePath) {
    try {
      fs.writeFileSync(filePath, '{}');
    } catch (err) { //Couldn't create it. Invalid path/wrong permissions?
      throw new Error(
        'The persistence file "'+ filePath +'" does not exists and could '+
        'not be created: "'+ err.message +'". Check the path and permissions.'
      );
    }
    return true;
  }

  getPersistedData() { return this._persistedData; }

  _setDirty() {
    this._dirty = true;
    this._persist();
  }

  _persist() {
    //no need or already running
    if (!this._dirty || this._running) { return false; }
    //too early
    if (this._timeout) { return false; }

    this._dirty = false;
    this._running = true;
    this._writeToDisk();
    return true;
  }

  _writeToDisk() {
    let contents = JSON.stringify(this.getPersistedData());
    fs.writeFile(this._filePath, contents, (error) => {
      if (error) {
        return this._persistFailed();
      } else {
        return this._persistOK();
      }
    });
  }
  _persistOK() {
    this._running = false;
    return this._throttle();
  }
  _persistFailed() {
    this._dirty = true;
    this._running = false;
    return this._throttle();
  }

  _throttle() {
    this._timeout = setTimeout(
      this._throttleRelease.bind(this), this._minPersistInterval *1000
    );
  }
  _throttleRelease() {
    this._timeout = null;
    return this._persist();
  }

  update(key, value) {
    let cur = this._persistedData;
    let parts = key.split('.'), last = parts.pop();

    let i = 0, n = parts.length, nextKey;
    for (; i<n; i++) {
      nextKey = parts[i];
      if (typeof cur[nextKey] === 'undefined') { cur[nextKey] = {}; }
      cur = cur[nextKey];
    }

    if (cur[last] === value) { return false; }

    cur[last] = value;
    return this._setDirty();
  }
}

module.exports = EventualPersistence;
