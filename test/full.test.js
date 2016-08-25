/* global describe, it, before, after, afterEach */
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
//# Setup
before(() => {
  let mockFiles = require('./_mockfiles.js');
  let mockSearchPath = '/testing/envs';

  let _ = AutoEnvConfig.__get__('_');
  AutoEnvConfigClass = AutoEnvConfig.__get__('AutoEnvConfig');
  _.envsPath = mockSearchPath; //override search path

  sandbox = sinon.sandbox.create();

  //Returning a fixed "file list" for the "envs" folder
  sandbox.stub(fs, 'readdirSync', function (path) {
    if (path != mockSearchPath) {
      throw new Error('ReaddirSync called with an invalid search path');
    }
    return [
      'config.schema', 'someenv.invalid', 'env1.json', 'magic.json', 'env3.json'
    ];
  });

  //Loading schema and env config JSON files
  sandbox.stub(_, 'loadAndParseJSON', function (filepath) {
    let filename = filepath.split(path.sep).pop();
    let fileContent = mockFiles[filename];
    return JSON.parse(fileContent);
  });
});

//# Reset on each test
afterEach(() => AutoEnvConfig._reset()); //reset autoInstance and cache

//# Cleanup
after(() => {
  sandbox.restore();
});



//### Tests :)
describe('Error Handling', function() {
  it('throw exception when no ".schema" is present');
  it('throw exception when ".schema" is invalid');
  it('throw exception when ".schema" have keys without required prefix');
  it('throw exception when ".conf" have properties not present in ".schema"');
  it('throw exception when ".conf" does not have some required property');
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
    let specificInstance2 = specificInstance1.load('env2.json');
    let specificKey2      = specificInstance2.get('requiredKey');

    expect(specificInstance1).to.be.instanceof(AutoEnvConfigClass);
    expect(specificInstance2).to.be.instanceof(AutoEnvConfigClass);
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
  it('magic "module.has" should return true when key is present');
  it('magic "module.has" should return false when key is not present');

  it('magic "module.get" should return value when key is present');
  it('magic "module.get" should throw when key is not present');
});

describe('Instance Methods', function() {
  it('"instance.has" should return true when key is present');
  it('"instance.has" should return false when key is not present');

  it('"instance.get" should return value when key is present');
  it('"instance.get" should throw when key is not present');
});
