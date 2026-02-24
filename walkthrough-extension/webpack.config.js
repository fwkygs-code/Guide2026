const path = require('path');

module.exports = {
  entry: {
    background: './src/background/index.ts',
    content: './src/content/index.ts',
    overlay: './src/overlay/overlay-renderer.ts',
    spotlight: './src/overlay/spotlight-manager.ts',
    'step-ui': './src/overlay/step-ui-manager.ts',
    'session-controller': './src/content/session-controller.ts',
    'demo-walkthrough': './src/demo/walkthrough-definition.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    }
  },
  mode: 'development',
  devtool: 'source-map'
};
