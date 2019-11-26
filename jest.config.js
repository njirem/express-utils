'use strict';

module.exports = {
    clearMocks: true,
    restoreMocks: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: [
        'html',
        'text',
    ],
    testEnvironment: 'node',
    transform: {
        '^.+\\.ts?$': 'ts-jest',
    }
}