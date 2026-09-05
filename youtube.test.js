const test = require('node:test');
const assert = require('node:assert/strict');

const { nextByteFromRange, optionalBoolean } = require('./youtube');

test('parses YouTube resumable upload ranges', () => {
	assert.equal(nextByteFromRange('bytes=0-1048575'), 1048576);
	assert.equal(nextByteFromRange(null), 0);
});

test('parses optional boolean configuration', () => {
	assert.equal(optionalBoolean('true'), true);
	assert.equal(optionalBoolean('false'), false);
	assert.equal(optionalBoolean(undefined), undefined);
});
