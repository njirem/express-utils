'use strict';
const { addOldNodeSupport, oldNodeVersion } = require('./compatibility');

if (oldNodeVersion) {
    addOldNodeSupport();
    module.exports = require('./dist/es5/index');
} else {
    module.exports = require('./dist/index');
}