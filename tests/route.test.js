const path = require('node:path');
const _ = require('lodash');
const assert = require('node:assert').strict;
const { TestRunner } = require('@marianmeres/test-runner');
const { SimpleRoute } = require('../dist');

const suite = new TestRunner(path.basename(__filename));

const rpad = (s, len = 25) => (s += ' '.repeat(Math.max(0, len - s.length)));

// prettier-ignore
[
	// no match
	['/foo',                     '/bar',              null],
	['/foo',                     '',                  null],
	['/foo/[bar]',               '/foo',              null],
	['/[foo]/bar',               '/foo',              null],
	['/[foo]/[bar]',             '/foo',              null],
	// match no params (trailing separators are OK)
	['/',                        '',                  {}],
	['',                         '///',               {}],
	['foo',                      'foo',               {}],
	['//foo///bar.baz/',         'foo/bar.baz',       {}],
	['foo/bar/baz',              '//foo//bar/baz//',  {}],
	['#/foo//',                  '#/foo',             {}],
	// match with params
	['/[foo]',                   '/bar',              { foo: 'bar' }],
	['#/foo/[bar]',              '#/foo/bat',         { bar: 'bat' }],
	['#/[foo]/[bar]',            '#/baz/bat',         { foo: 'baz', bar: 'bat' }],
	['#/[foo]/bar',              '#/baz/bar',         { foo: 'baz' }],
	// params with regex constraint
	['/[id([0-9]+)]',            '/123',              { id: '123' }],
	['/[id(\\d-\\d)]',           '/1-2',              { id: '1-2' }],
	['/[id([0-9]+)]',            '/foo',              null],
	['/foo/[bar]/[id([0-9]+)]',  '/foo/baz/123',      { bar: 'baz', id: '123' }],
	['/foo/[id([0-9]+)]/[bar]',  '/foo/bar/baz',      null],
	// wrong regex - missing name...
	['/foo/[([0-9]+)]',          '/foo/123',          null],
	//
	['/[foo(bar)]/[baz]',         '/bar/bat',         { foo: 'bar', baz: 'bat' }],
	['/[foo(bar)]/[baz]',         '/baz/bat',         null],
	// url encoded segments and values
	['/foo/[id%20x]',             '/foo/12%203',      { 'id x': '12 3' }],
	// optional param
	['/foo?',                     '/',                {}],
	['/foo?',                     '/foo',             {}],
	['/foo?',                     '/bar',             null],
	['/foo/[bar]?',               '/foo',             {}],
	['/foo/[bar]?',               '/foo/bar',         { bar: 'bar' }],
	['/foo/[bar]?',               '/foo/bar/baz',     null],
	['/foo/[bar([0-9]+)]?',       '/foo',             {}],
	['/foo/[bar([0-9]+)]?',       '/foo/bar',         null],
	['/foo/[bar([0-9]+)]?',       '/foo/123',         { bar: '123' }],
	['/foo/[bar([0-9]+)]?',       '/foo/123/baz',     null],
	//
	['/foo/[bar]?/baz',           '/foo',             null],
	['/foo/[bar]?/baz',           '/foo/bar',         null], // !!! must not match
	['/foo/[bar]?/baz',           '/foo/baz',         null], // !!! must not match
	['/foo/[bar]?/baz',           '/foo/bar/baz',     { bar: 'bar' }],
	['/foo/[bar]?/[baz]?',        '/foo',             {}],
	['/foo/[bar]?/[baz]?',        '/foo/bar',         { bar: 'bar' }],
	['/foo/[bar]?/[baz]?',        '/foo/bar/baz',     { bar: 'bar', baz: 'baz' }],
	// spread params
	['/js/[...path]',             '/js/foo/bar/baz.js', { 'path': 'foo/bar/baz.js' }],
	['/js/[root]/[...path]',      '/js/foo/bar/baz.js', { 'root': 'foo', 'path': 'bar/baz.js' }],
	['/js/[...path]/[file]',      '/js/foo/bar/baz.js', { 'path': 'foo/bar', 'file': 'baz.js' }],
	['/[...path]/[file]',         '/foo/bar/baz.js',    { 'path': 'foo/bar', 'file': 'baz.js' }],
]
	.forEach(([route, input, expected, only]) => {
		suite[only ? 'only' : 'test'](
			`${rpad(route, 23)} -> ${rpad(input, 16)} => ${JSON.stringify(expected)}`,
			() => {
				const actual = new SimpleRoute(route).parse(input);
				assert(_.isEqual(actual, expected), JSON.stringify(actual));
			}
		)
	});

suite.test('query params parsing works and is enabled by default', () => {
	let actual = new SimpleRoute('/foo/[bar]').parse('/foo/bar?baz=ba%20t');
	assert(_.isEqual(actual, { bar: 'bar', baz: 'ba t' }), JSON.stringify(actual));

	// no match must still be no match
	actual = new SimpleRoute('/foo/[bar]').parse('/hoho?bar=bat');
	assert(_.isEqual(actual, null), JSON.stringify(actual));
});

suite.test('path params have priority over query params', () => {
	const actual = new SimpleRoute('/foo/[bar]').parse('/foo/bar?bar=bat');
	assert(_.isEqual(actual, { bar: 'bar' }), JSON.stringify(actual));
});

suite.test('query params parsing can be disabled', () => {
	let actual = new SimpleRoute('/foo/[bar]').parse('/foo/bar?baz=bat', false);
	assert(_.isEqual(actual, { bar: 'bar?baz=bat' }), JSON.stringify(actual));
	// note added slash
	actual = new SimpleRoute('/foo/[bar]').parse('/foo/bar/?baz=bat', false);
	assert(_.isEqual(actual, null), JSON.stringify(actual));
});

// prettier-ignore
suite.test('spread segment must not be optional', () => {
	assert.throws(() => new SimpleRoute('[...path]?'));
});

// prettier-ignore
suite.test('there can only be one spread segment', () => {
	assert.throws(() => new SimpleRoute('/foo/[...some]/bar/[...another]'));
});

//
if (require.main === module) {
	suite.run();
}

module.exports = suite;
