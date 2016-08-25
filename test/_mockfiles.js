'use strict';

const path = require('path');

module.exports = {
  'config.schema':
`{
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
}`,

  'env1.json':
`{
  "id": "env1",
  "envtype": "staging",
  "path": "/some/random/path1",

  "requiredKey": "value1"
}`,

  'magic.json':
`{
  "id": "magic",
  "envtype": "local",
  "path": `+ JSON.stringify(path.dirname(require.main.filename)) +`,

  "requiredKey": "magic"
}`,


  'env2.json':
`{
  "id": "env2",
  "envtype": "production",
  "path": "/some/random/path2",

  "requiredKey": "value2"
}`


};


