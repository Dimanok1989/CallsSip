const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {

    entry: {
        sip: './src/index.ts',
    },

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
    },

    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx']
    },

    // devtool: 'source-map',
  
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'awesome-typescript-loader'
            },
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader'
                ],
            },
        ]
    },

    plugins: [
        new MiniCssExtractPlugin({
            filename: "[name].css"
        })
    ]

};