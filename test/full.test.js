/* global before, afterEach, after, describe, it */
'use strict';

const
  rewire = require('rewire')
, expect = require('chai').expect
, sinon = require('sinon')
;



//### Module to be tested
let AutoEnvConfig = rewire('../lib/AutoEnvConfig.js');



//### Setup, mocks and cleanup
const
  fs = require('fs')
, path = require('path');

let
  sandbox,
  AutoEnvConfigClass
;

let replaceFiles = {};

//# Setup
before(() => {
  let mockRootPath = __dirname;
  let mockSearchPath = path.resolve(mockRootPath, 'envs');

  let _ = AutoEnvConfig.__get__('_');
  AutoEnvConfigClass = AutoEnvConfig.__get__('AutoEnvConfig');
  _.rootPath = mockRootPath; //override search path
  _.envsPath = mockSearchPath; //override search path

  sandbox = sinon.sandbox.create();

  //This stub allows us to replace the path in the "magic.conf" file
  let origReadFileSync = fs.readFileSync;
  sandbox.stub(fs, 'readFileSync', function (filepath, encoding) {
    let pathparts = filepath.split(path.sep);
    let filename = pathparts.pop();
    if (replaceFiles[filename]) { //use invalid or different files for tests
      filename = replaceFiles[filename];
    }
    pathparts.push(filename);
    filepath = pathparts.join(path.sep);

    let content = origReadFileSync(filepath, encoding);
    //if it's the right file, let's replace the path to the current one
    if (filename == 'magic.json') {
      content = content.replace('%curpath%', JSON.stringify(mockRootPath));
    }
    return content;
  });
});

//# Reset on each test
afterEach(() => {
  AutoEnvConfig._reset();
  replaceFiles = {};
}); //reset autoInstance and cache

//# Cleanup
after(() => {
  sandbox.restore();
});



//### Tests :)
describe('Load Error Handling', function() {
  it('throws exception when no ".schema" is present', function () {
    replaceFiles = {'config.schema': 'dontexist.schema'};
    let expectedErrMessage = 'There is no "config.schema" file in your envs folder!';
    expect(AutoEnvConfig.load).to.throw(expectedErrMessage);
  });

  it('throws exception when ".schema" is invalid (parse error)', function () {
    replaceFiles = {'config.schema': 'config_parseError.schema'};
    let expectedErrMessage = 'There is a syntax error in your schema file ';
    expect(AutoEnvConfig.load).to.throw(expectedErrMessage);
  });

  it('throw exception when ".schema" have keys without required prefix', function () {
    replaceFiles = {'config.schema': 'config_noprefix.schema'};
    let expectedErrMessage = 'Schema key "deep.key.supported" doesn\'t have a required prefix!';
    expect(AutoEnvConfig.load).to.throw(expectedErrMessage);
  });

  it('throws exception when ".conf" is invalid (parse error)', function () {
    let fn = function () { AutoEnvConfig.load('env_parseError.json'); };
    let expectedErrMessage = 'There is a syntax error in your config file';
    expect(fn).to.throw(expectedErrMessage);
  });

  it('throws exception when ".conf" have properties not present in ".schema"', function () {
    let fn = function () { AutoEnvConfig.load('env_unexpectedProperty.json'); };
    let expectedErrMessage = 'Unexpected key "deep.key.unexpected" in current env config.';
    expect(fn).to.throw(expectedErrMessage);
  });

  it('throws exception when ".conf" does not have some required property', function () {
    let fn = function () { AutoEnvConfig.load('env_missingProperty.json'); };
    let expectedErrMessage = 'Required key "deep.key.supported" missing from your current env config!';
    expect(fn).to.throw(expectedErrMessage);
  });

  it('throws exception when ".conf" have a property with a type that does not match schema', function () {
    let fn = function () { AutoEnvConfig.load('env_typeMismatch.json'); };
    let expectedErrMessage = 'Env config key "deep.key" must be of type "object" ("string" found)';
    expect(fn).to.throw(expectedErrMessage);
  });

  it('magic "module.load()" returns false when there is no matching env path', function () {
    replaceFiles = {'magic.json': 'env1.json'};
    let magicInstance = AutoEnvConfig.load();
    expect(magicInstance).to.be.false;
  });

  it('".load" should use caches when called more than once even with "forceNew" flag', function () {
    AutoEnvConfig.load('', 'forceNew');
    AutoEnvConfig.load('', 'forceNew');
    AutoEnvConfig.load();
    expect(true).to.be.false;
  });
});


describe('Specific Loading', function() {
  it('should load <name> when using "module.load(name)"', function () {
    let specificInstance = AutoEnvConfig.load('env1');
    let specificKey      = specificInstance.get('requiredKey');

    expect(specificInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(specificKey).to.be.equal('value1');
  });

  it('should load <name> when using "module.load(name.json)"', function () {
    let specificInstance = AutoEnvConfig.load('env1.json');
    let specificKey      = specificInstance.get('requiredKey');

    expect(specificInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(specificKey).to.be.equal('value1');
  });

  it('should load <name> when using "instance.load(name)"', function () {
    let specificInstance1 = AutoEnvConfig.load('env1');
    let specificKey1      = specificInstance1.get('requiredKey');
    let specificInstance2 = specificInstance1.load('env2');
    let specificKey2      = specificInstance2.get('requiredKey');

    expect(specificInstance1).to.be.instanceof(AutoEnvConfigClass);
    expect(specificInstance2).to.be.instanceof(AutoEnvConfigClass);
    expect(specificInstance1).to.not.be.equal(specificInstance2);
    expect(specificKey1).to.be.equal('value1');
    expect(specificKey2).to.be.equal('value2');
  });
});


describe('Magic Loading', function() {
  it('should use <default> on magic "module.load()"', function () {
    let magicInstance = AutoEnvConfig.load();
    let magicKey      = magicInstance.get('requiredKey');

    expect(magicInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(magicKey).to.be.equal('magic');
  });

  it('should use <default> on magic "module.get"', function () {
    let magicKey = AutoEnvConfig.get('requiredKey');

    expect(magicKey).to.be.equal('magic');
  });

  it('should use <default> on magic "module.load()" after "module.load(name)"', function () {
    let specificInstance = AutoEnvConfig.load('env1');
    let specificKey      = specificInstance.get('requiredKey');
    let magicInstance    = AutoEnvConfig.load();
    let magicKey         = magicInstance.get('requiredKey');

    expect(magicInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(specificInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(magicInstance).to.not.be.equal(specificInstance);
    expect(specificKey).to.be.equal('value1');
    expect(magicKey).to.be.equal('magic');
  });

  it('should use <name> on magic "module.get" after "module.load(name)"', function () {
    let specificInstance = AutoEnvConfig.load('env1');
    let magicKey         = AutoEnvConfig.get("requiredKey");

    expect(specificInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(magicKey).to.be.equal('value1');
  });
});

describe('Magic Methods', function() {
  it('magic "module.has(key)" should return true when key is present', function () {
    let hasMagicKey = AutoEnvConfig.has('requiredKey');
    expect(hasMagicKey).to.be.true;
  });
  it('magic "module.has(key)" should return false when key is not present', function () {
    let hasMagicKey = AutoEnvConfig.has('nonexistentKey');
    expect(hasMagicKey).to.be.false;
  });
  it('magic "module.get(key)" should return value when key is present', function () {
    let magicKey = AutoEnvConfig.get('requiredKey');
    expect(magicKey).to.be.equal('magic');
  });
  it('magic "module.get(key)" should throw when key is not present', function () {
    let fn = function () { AutoEnvConfig.get('nonexistentKey'); };
    expect(fn).to.throw('Can\'t find key "nonexistentKey" on current env config ("magic.json") and there was no default on function call!');
  });
  it('magic "module.get(key, default)" should return value when default is supplied and key is present', function () {
    let magicKey = AutoEnvConfig.get('requiredKey', 'defaultValue');
    expect(magicKey).to.be.equal('magic');
  });
  it('magic "module.get(key, default)" should return default it is supplied and key is not present', function () {
    let magicKey = AutoEnvConfig.get('nonexistentKey', 'defaultValue');
    expect(magicKey).to.be.equal('defaultValue');
  });
});

describe('Instance Methods', function() {
  it('"instance.has(key)" should return true when key is present', function () {
    let magicInstance  = AutoEnvConfig.load();
    let hasInstanceKey = magicInstance.has('requiredKey');
    expect(magicInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(hasInstanceKey).to.be.true;
  });
  it('"instance.has(key)" should return false when key is not present', function () {
    let magicInstance  = AutoEnvConfig.load();
    let hasInstanceKey = magicInstance.has('nonexistentKey');
    expect(magicInstance).to.be.instanceof(AutoEnvConfigClass);
    expect(hasInstanceKey).to.be.false;
  });
  it('"instance.get(key)" should return value when key is present', function () {
    let magicInstance = AutoEnvConfig.load();
    let instanceKey   = magicInstance.get('requiredKey');
    expect(instanceKey).to.be.equal('magic');
  });
  it('"instance.get(key)" should throw when key is not present', function () {
    let magicInstance = AutoEnvConfig.load();
    let fn = function () { magicInstance.get('nonexistentKey'); };
    expect(fn).to.throw('Can\'t find key "nonexistentKey" on current env config ("magic.json") and there was no default on function call!');
  });
  it('"instance.get(key, default)" should return value when default is supplied and key is present', function () {
    let magicInstance = AutoEnvConfig.load();
    let instanceKey   = magicInstance.get('requiredKey', 'defaultValue');
    expect(instanceKey).to.be.equal('magic');
  });
  it('"instance.get(key, default)" should return default it is supplied and key is not present', function () {
    let magicInstance = AutoEnvConfig.load();
    let instanceKey   = magicInstance.get('nonexistentKey', 'defaultValue');
    expect(instanceKey).to.be.equal('defaultValue');
  });
});
