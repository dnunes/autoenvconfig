'use strict';

const
  fs = require('fs')
, path = require('path')
;

let autoInstance = null;
let _ = {
  'ensureAutoInstance': function (instance) {
    if (autoInstance) { return; }
    autoInstance = instance || publicFuncs.load();
  },

  'configPath': path.resolve(path.dirname(require.main.filename), 'envs'),
  'getConfigFile': function (id) {
    return path.resolve(_.configPath, id);
  },

  'getSchema': function (name) {
    if (!name) { name = 'config'; }
    let schemaPath = _.getConfigFile(name +'.schema');
    let schema;
    try {
      schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    } catch (err) {
      if (~err.message.toLowerCase().indexOf('cannot find')) {
        throw new Error(
          'There is no "'+ name +'.schema" file in your envs folder!'
        );
      } else if (SyntaxError && err instanceof SyntaxError) {
        throw new Error(
          'There is a syntax error in your schema file "'+ schemaPath +'": '+
          '"'+ err.message +'". Please fix it and try again.'
        );
      }
      throw err;
    }
    if (!schema) { throw new Error('No "'+ name +'.schema" found!'); }
    return schema;
  },
  'hasKeyInSchema': function (key, schema) {
    if (typeof(schema['# '+ key]) != 'undefined') { return '# '+ key; }
    if (typeof(schema['? '+ key]) != 'undefined') { return '? '+ key; }
    return false;
  },

  'getCleanSchema': function (schema, prefix) {
    let key, val, prefixedEnvKey, clean = {};
    for (key in schema) { val = schema[key];
      prefixedEnvKey = prefix + key;
      if (key.substring(0, 2) != '# ' && key.substring(0, 2) != '? ') {
        throw new Error(
          'Schema key "'+ prefixedEnvKey +'" doesn\'t have a required prefix!'
        );
      }

      let isArr = (val instanceof Array);
      let isObj = (val instanceof Object);
      if (isObj && !isArr) {
        val = _.getCleanSchema(val, key + '.');
      }
      clean[key.substring(2)] = val;
    }
    return clean;
  },

  'objType': function (obj) {
    let t = typeof(obj);
    if (t != 'object') { return t; }
    let isArr = (obj instanceof Array);
    return (isArr) ? 'array' : 'object';
  },
  'validateConfig': function (schema, envConfig) {
    _.checkUnexpectedKeys(envConfig, schema);
    _.checkMissingOrWrongKeys(envConfig, schema);
    return true;
  },
  'checkUnexpectedKeys': function (envConfig, schema, prefix) {
    //For friendly output
    if (!prefix) { prefix = ''; }

    let envKey, schemaKey, prefixedEnvKey, val;
    for (envKey in envConfig) { //check each config key
      schemaKey = _.hasKeyInSchema(envKey, schema);
      prefixedEnvKey = prefix + envKey;
      //Checking unexpected keys
      if (!schemaKey) {
        throw new Error(
          'Invalid key "'+ prefixedEnvKey +'" in current env config.'
        );
      }
      //Going deeper in recursion
      val = envConfig[envKey];
      let isArr = (val instanceof Array);
      let isObj = (val instanceof Object);
      if (isObj && !isArr) {
        _.checkUnexpectedKeys(val, schema[schemaKey], prefixedEnvKey +'.');
      }
    }
    return true;
  },
  'checkMissingOrWrongKeys': function (envConfig, schema, prefix) {
    let schemaKey, envKey, schemaVal, envVal, isOptional, isPresent;
    let prefixedEnvKey, schemaType, envType, isArr, isObj;

    for (schemaKey in schema) { //check each schema config key
      envKey = schemaKey.substr(2);
      schemaVal = schema[schemaKey];
      envVal = envConfig[envKey];
      isOptional = schemaKey.substr(0, 1) == '?';
      isPresent = (typeof(envVal) != 'undefined');
      //For friendly output
      if (!prefix) { prefix = ''; }
      prefixedEnvKey = prefix + envKey;
      //Checking required keys
      if (!isPresent) {
        if (isOptional) { continue; }
        throw new Error(
          'Required key "'+ prefixedEnvKey +'" missing '+
          'from your current env config!'
        );
      }
      //Checking types
      schemaType = _.objType(schemaVal);
      envType = _.objType(envVal);
      if (schemaType != envType) {
        throw new Error(
          'Env config key "'+ prefixedEnvKey +'" must be of '+
          'type "'+ schemaType +'" ("'+ envType +'" found)'
        );
      }
      //Going deeper in recursion
      isArr = (schemaVal instanceof Array);
      isObj = (schemaVal instanceof Object);
      if (isObj && !isArr) {
        _.checkMissingOrWrongKeys(envVal, schemaVal, prefixedEnvKey +'.');
      }
    }
    return true;
  },

 'supermerge': function (o1, o2) { let r = {}, k, v;
    for (k in o1) { r[k] = o1[k]; }
    for (k in o2) { v = o2[k];
      if (o1[k] && o1[k].constructor === Object && v.constructor === Object) {
        r[k] = _.supermerge(o1[k], v); //array + array = merge
      } else { r[k] = v; } //other combination = override
    } return r;
  }
};

let cache = {};
let publicFuncs = {
  'load': function (envID, forceNew) {
    if (!envID) { envID = ''; }
    if (!forceNew && cache[envID]) { return cache[envID]; }

    let envConfig = false;
    let saveAsDefault = false;

    if (!envID) {
      let rootPath = path.dirname(require.main.filename);
      let fileList = fs.readdirSync(_.configPath);

      let match = fileList.some((currentFile) => {
        if (path.extname(currentFile) != '.json') { return false; }

        envConfig = require(_.getConfigFile(currentFile));
        if (envConfig.path == rootPath) {
          envID = currentFile;
          return true;
        }
      });
      if (!match) { return false; }
      saveAsDefault = true;
    }
    let envConfigObj = new EnvConfig(envID);
    if (!forceNew) {
      cache[envID] = envConfigObj;
    }
    if (saveAsDefault) {
      cache[''] = envConfigObj;
    }
    _.ensureAutoInstance(envConfigObj);
    if (!autoInstance) { autoInstance = envConfigObj; }
    return envConfigObj;
  },

  'has': function (key) { _.ensureAutoInstance();
    return autoInstance.has(key);
  },
  'get': function (key, def) { _.ensureAutoInstance();
    return autoInstance.get(key, def);
  }
};


class EnvConfig {
  load(file) { return publicFuncs.load(file); }

  constructor(id) {
    this.id = id;
    let currentEnvFile = require(_.getConfigFile(id));

    let schema = _.getSchema();
    _.validateConfig(schema, currentEnvFile);
    let defaultData = _.getCleanSchema(schema);
    this.currentConfig = _.supermerge(defaultData, currentEnvFile);
  }

  has(key) {
    let toRet = this.currentConfig;
    let parts = key.split('.');
    let i, cur;
    for (i in parts) {
      cur = parts[i];
      toRet = toRet[cur];
      if (typeof(toRet) == 'undefined') {
        return false;
      }
    }
    return true;
  }
  get(key, def) {
    let toRet = this.currentConfig;
    let parts = key.split('.');
    let i, cur;
    for (i in parts) {
      cur = parts[i];
      toRet = toRet[cur];
      if (typeof(toRet) == 'undefined') {
        if (typeof(def) != 'undefined') { return def; }
        throw new Error(
          'Can\'t find key "'+ key +'" on current env config ("'+ this.id +'")!'
        );
      }
    }
    return toRet;
  }
}

module.exports = publicFuncs;
