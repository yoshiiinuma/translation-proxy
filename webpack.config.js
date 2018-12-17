var path = require('path');
var nodeExternals = require('webpack-node-externals');

module.exports = {
  target: 'node',
  entry: "src/proxy.js",
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'server.js'
  },
  externals: [ nodeExternals() ],
  watch: false,
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
            plugins: ["@babel/transform-runtime"]
          }
        }
      }
    ]
  }
}
