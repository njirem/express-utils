'use strict';
const { addOldNodeSupport, oldNodeVersion } = require('./compatibility');

if (oldNodeVersion) {
    addOldNodeSupport();
    module.exports = require('./dist/es5');
} else {
    module.exports = require('./dist');
}
