'use strict';
const { addOldNodeSupport, oldNodeVersion } = require('./compatibility');

if (oldNodeVersion) {
    addOldNodeSupport();
}
