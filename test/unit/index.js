const { join } = require('path');

const test = require('ava');
const del = require('del');
const webpack = require('webpack');

const { getCompilerHooks, WebpackManifestPlugin } = require('../../lib');
const { compile, hashLiteral } = require('../helpers/unit');

const outputPath = join(__dirname, '../output/unit');

test.after(() => del(outputPath));

test('exports', async (t) => {
  t.truthy(getCompilerHooks);
  t.truthy(WebpackManifestPlugin);

  const compiler = {};
  const hooks = getCompilerHooks(compiler);
  t.snapshot(Object.keys(hooks));
  t.is(hooks, getCompilerHooks(compiler));
});

test('outputs a manifest of one file', async (t) => {
  const config = {
    context: __dirname,
    entry: '../fixtures/file.js',
    output: { path: join(outputPath, 'one-file') }
  };
  const { manifest } = await compile(config, t);

  t.truthy(manifest);
  t.deepEqual(manifest, { 'main.js': 'main.js' });
});

test('outputs a manifest of multiple files', async (t) => {
  const config = {
    context: __dirname,
    entry: {
      one: '../fixtures/file.js',
      two: '../fixtures/file-two.js'
    },
    output: { path: join(outputPath, 'multiple-files') }
  };
  const { manifest } = await compile(config, t);

  t.truthy(manifest);
  t.deepEqual(manifest, {
    'one.js': 'one.js',
    'two.js': 'two.js'
  });
});

test('works with hashes in the filename', async (t) => {
  const config = {
    context: __dirname,
    entry: {
      one: '../fixtures/file.js'
    },
    output: {
      filename: `[name].${hashLiteral}.js`,
      path: join(outputPath, 'hashes')
    }
  };
  const { manifest, stats } = await compile(config, t);

  t.deepEqual(manifest, { 'one.js': `one.${stats.hash}.js` });
});

test('works with source maps', async (t) => {
  const config = {
    context: __dirname,
    devtool: 'source-map',
    entry: {
      one: '../fixtures/file.js'
    },
    output: {
      filename: '[name].js',
      path: join(outputPath, 'source-maps')
    }
  };
  const { manifest } = await compile(config, t);

  t.deepEqual(manifest, {
    'one.js': 'one.js',
    'one.js.map': 'one.js.map'
  });
});

test('adds seed object custom attributes when provided', async (t) => {
  const config = {
    context: __dirname,
    entry: {
      one: '../fixtures/file.js'
    },
    output: {
      filename: '[name].js',
      path: join(outputPath, 'custom-attributes')
    }
  };
  const { manifest } = await compile(config, t, { seed: { test1: 'test2' } });

  t.deepEqual(manifest, {
    'one.js': 'one.js',
    test1: 'test2'
  });
});

test('combines manifests of multiple compilations', async (t) => {
  const config = [
    {
      context: __dirname,
      entry: {
        one: '../fixtures/file.js'
      },
      output: { path: join(outputPath, 'multiple-compilations') }
    },
    {
      context: __dirname,
      entry: {
        two: '../fixtures/file-two.js'
      },
      output: { path: join(outputPath, 'multiple-compilations') }
    }
  ];
  const { manifest } = await compile(config, t, { seed: {} });

  t.deepEqual(manifest, {
    'one.js': 'one.js',
    'two.js': 'two.js'
  });
});

test('outputs a manifest of no-js file', async (t) => {
  const config = {
    context: __dirname,
    entry: '../fixtures/file.txt',
    module: {
      rules: [
        {
          test: /\.(txt)/,
          use: [
            {
              loader: 'file-loader',
              options: {
                name: '[name].[ext]'
              }
            }
          ]
        }
      ]
    },
    output: { path: join(outputPath, 'no-js') }
  };
  const { manifest } = await compile(config, t);
  const expected = {
    'main.js': 'main.js',
    'file.txt': 'file.txt'
  };

  // Note: I believe this to be another bug in webpack v5 and cannot find a good workaround atm
  if (webpack.version.startsWith('5')) {
    expected['main.txt'] = 'file.txt';
  }

  t.truthy(manifest);
  t.deepEqual(manifest, expected);
});

test('make manifest available to other webpack plugins', async (t) => {
  const config = {
    context: __dirname,
    entry: '../fixtures/file.js',
    output: { path: join(outputPath, 'other-plugins') }
  };
  const { manifest, stats } = await compile(config, t);

  t.deepEqual(manifest, { 'main.js': 'main.js' });

  const asset = stats.compilation.assets['manifest.json'];

  try {
    t.deepEqual(JSON.parse(asset.source()), {
      'main.js': 'main.js'
    });
  } catch (e) {
    // webpack v5: Content and Map of this Source is not available (only size() is supported)
    t.pass();
  }
});
