'use strict';

const
  fs = require('fs')
, path = require('path')
;

const defaultEnvsFolder = 'envs';
let _defaultEnvID = null;

let _ = {
  //reset magicInstance, caches and persistence. for unit tests only!
  '_reset': function () {
    _defaultEnvID = null;
  },

  'rootPath': path.resolve(path.dirname(require.main.filename)),
  'envsPath': path.resolve(
    path.dirname(require.main.filename),
    defaultEnvsFolder
  ),
  'getConfigFilePath': function (id) {
    return path.resolve(_.envsPath, id);
  },
  'getDefaultPersistenceFilePath': function (id) {
    let configFileInfo = path.parse(id);
    let persistenceFileName = configFileInfo['name'] + '.persist.json';
    return path.resolve(_.envsPath, persistenceFileName);
  },
  'findMagicConfigFileID': function () {
    if (_defaultEnvID) { return _defaultEnvID; }
    let fileList = fs.readdirSync(_.envsPath);

    let envConfig;
    let envID = false;
    fileList.some((currentFile) => {
      if (path.extname(currentFile) !== '.json') { return false; }

      try {
        envConfig = _.loadReference(_.getConfigFilePath(currentFile));
      } catch (err) {
        if (SyntaxError && err instanceof SyntaxError) {
          //Use real debugging log here.
          /* console.log(
            'There is a syntax error in your config file "'+ currentFile +'": '+
            '"'+ err.message +'". This file is being ignored by AutoEnvConfig.'
          ); */
          return false;
        }
        throw err;
      }

      if (envConfig['_path'] === _.rootPath) {
        envID = path.basename(currentFile, '.json');
        return true;
      }
      return false;
    });

    _defaultEnvID = envID;
    return envID;
  },


  //Generic Helpers
  'objType': function (obj) {
    let t = typeof obj;
    if (t !== 'object') { return t; }
    let isArr = (obj instanceof Array);
    return (isArr) ? 'array' : 'object';
  },
  'supermerge': function (o1, o2) {
    let r = {}, k, v;
    for (k in o1) { r[k] = o1[k]; }
    for (k in o2) {
      v = o2[k];
      if (o1[k] && o1[k].constructor === Object && v.constructor === Object) {
        r[k] = _.supermerge(o1[k], v); //array + array = merge
      } else { r[k] = v; } //other combination = override
    } return r;
  },

  //Specific Helpers
  'hasKeyInSchema': function (key, schema) {
    if (typeof schema['# '+ key] !== 'undefined') { return '# '+ key; }
    if (typeof schema['? '+ key] !== 'undefined') { return '? '+ key; }
    return false;
  },
  'loadReference': function (filename) {
    if (path.extname(filename) === '') { filename += '.json'; }
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  },

  //DRY Helpers
  'getSilently': function (envConfig, key, returnParent) {
    let cur = envConfig;
    let parent = envConfig;
    let parts = key.split('.');

    let i = 0, n = parts.length;
    let nextKey;
    for (; i<n; i++) {
      nextKey = parts[i];
      parent = cur;
      cur = cur[nextKey];
      if (typeof cur === 'undefined') { return undefined; }
    }
    return (returnParent) ? parent : cur;
  }
};

module.exports = _;
