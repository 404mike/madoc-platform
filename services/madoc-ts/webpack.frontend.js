module.exports = {
  mode: 'production',
  output: {
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: [
          {
            loader: require.resolve('ts-loader'),
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
