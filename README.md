autoenvconfig
============
Environment config that Just Works™!

Stop worrying about the hassle of **loading environment config files everywhere**, **config files with missing entries** or **schemas that gets old when you forget to add a new config key to it**.

AutoEnvConfig was designed with simple but very powerful goals:

* **Blazing fast**: it caches everything it can, loads your files only once and check your schema on load, not on usage;
* **No extra configuration needed**: this package follows the idea of _convention over configuration_, so it keeps the required environment files to a minimum and there is nothing to thinker with before start using it;
* **Never out of sync**: when loading the environment configuration file, it checks the schema for *missing AND for extra keys*, alerting you when you are missing some key in your config or in your schema file;
* **Auto load the right config file**: you can set the root path of the project in the environment config file and it will load automatically.

Create your schema specifying optional and required keys (plus: it can contain default values, too!), setup your environment file with specific overrides and you're good to go.


## <a id="basicusage">Basic Usage</a>

There is just four steps needed to start using this package:

1. Create a folder named `envs` on your project's root;
2. Create a [`config.schema`](#sampleschema) file with your schema;
3. Create a [`ENVNAME.json`](#sampleenv) file for each environment with its specific configuration (where `ENVNAME` is whatever name you wish to use);
4. Load the package. It is ready to read your values.

In your code:

```javascript
const AutoEnvConfig = require('autoenvconfig');

let valueFromConfig = AutoEnvConfig.get('deep.key.supported'));
console.log(valueFromConfig); //"myValue"
```

## <a id="conventions">Conventions</a>

### <a id="magicload">Magic Loading</a>

For the magic load to happen, your [`config.schema`](#sampleschema) and [`ENVNAME.json`](#sampleenv) files must have a "path" key with the path of your project's root. It will find the correct environment checking this value by default. You can, however, safely ignore this convention and manually specify the file name.

### <a id="magicload">Schema and and Environment File formats</a>
The schema and environment config files are simple JSON files. The only limit for the _keys_ is the dot character ("`.`") which is forbidden (because it is used as a separator when loading), but I suggest you to limit your keys to alphanumeric chars for simplicity.

In the schema files, every key _MUST_ be prefixed with either `#` or `?`, indicating mandatory or optional key, respectively.


## <a id="samples">Sample Files</a>

### <a id="sampleschema">Sample config.schema</a>
```json
{
  "# id": "",
  "# envtype": "",
  "# path": "",

  "# requiredKey": "",
  "? deep": {
    "? key": {
      "# supported": "myValue",
      "? asWell": "otherValue"
    }
  }
}
```

You can have a required key inside an optional object (in this sample, the `supported` required key is inside optional `deep` and `key` objects), so that you can omit the whole object (it will use the defaults), but if it exists in the environment config file, it must contain at least these required keys.

### <a id="sampleenv">Sample ENVNAME.json</a>
```json
{
  "id": "dev",
  "envtype": "local",
  "path": "/home/dnunes/code/node/autoenvconfig",

  "requiredKey": "value"
}
```



## <a id="advancedusage">Advanced Usage</a>

You can override the default file and bypass the environment file search routine by calling the `load` method:
```javascript
//will load envs/other.json
AutoEnvConfig = require('autoenvconfig').load('other');
AutoEnvConfig.get('ket.in.other.file');
```

You can also load multiple configs if ever needed:
```javascript
AutoEnvConfig = require('autoenvconfig');

//load the right env based on "path" config value
let rightConfig = AutoEnvConfig.load();
rightConfig.get('key.in.right.file');

//load "envs/other.json"
let otherConfig = AutoEnvConfig.load('other');
otherConfig.get('key.in.other.file');

//load "envs/oneMore.json"
let oneMoreConfig = rightConfig .load('oneMore.json');
oneMoreConfig.get('key.in.onemore.file');
```
Note that you can call `load` directly on the package or on any `AutoEnvConfig` object returned by the `load` method.


## <a id="releaseh">Release History</a>

* 0.1.0 Initial release


## <a id="credits">Credits</a>

Created and maintained (with much ♡) by [diego nunes](http://dnunes.com)

Donations with Bitcoin to _1H6Z1xbq1Lh3zKhEnDBxHZgEjcFPPjkpKF_:

![1H6Z1xbq1Lh3zKhEnDBxHZgEjcFPPjkpKF](http://chart.apis.google.com/chart?cht=qr&chs=200x200&chl=bitcoin:1H6Z1xbq1Lh3zKhEnDBxHZgEjcFPPjkpKF)
