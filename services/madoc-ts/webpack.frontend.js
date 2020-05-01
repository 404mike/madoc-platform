module.exports = {
  mode: process.env.NODE_ENV,
  devtool: 'inline-source-map',
  output: {
    filename: 'bundle.js',
    pathinfo: false,
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: [
          {
            loader: require.resolve('ts-loader'),
            options: {
              transpileOnly: true,
              experimentalWatchApi: true,
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx'],
  },
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
  },
};
