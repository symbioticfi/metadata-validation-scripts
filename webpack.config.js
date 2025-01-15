import path, {dirname} from "path";
import {fileURLToPath} from 'url';
import webpack from "webpack";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
    // Target environment
    target: 'node',

    // Entry file
    entry: './src/index.ts',

    // Output file configuration
    output: {
        filename: 'index.js', // Output filename
        path: path.resolve(__dirname, 'dist'), // Output directory
        libraryTarget: 'module', // ES module output
    },

    // Target ES module output
    experiments: {
        outputModule: true, // Required for ES module output in Webpack
    },

    // Module rules for loaders
    module: {
        rules: [
            // TypeScript loader
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            // JSON loader
            {
                test: /\.json$/,
                type: 'json', // Native JSON loader in Webpack
            },
        ],
    },

    // Resolve file extensions
    resolve: {
        extensions: ['.ts', '.js', '.json'],
    },

    // External modules (sharp)
    externals: {
        'sharp-linux-x64': 'zhopa',
        '@img/sharp-libvips-dev/include': '@img/sharp-libvips-dev/include',
        '@img/sharp-libvips-dev/cplusplus': '@img/sharp-libvips-dev/cplusplus',
        '@img/sharp-wasm32/versions': '@img/sharp-wasm32/versions',
        'sharp': 'commonjs sharp',
    },

    plugins: [
        new webpack.DefinePlugin({
            'process.env.SHARP_IGNORE_GLOBAL_LIBVIPS': JSON.stringify('1'), // Ensure local sharp binaries are used
        }),
    ],
    // plugins: [
    //     new CopyWebpackPlugin({
    //         patterns: [
    //             {
    //                 from: 'node_modules/sharp/vendor/linux-x64/*',
    //                 to: 'vendor/linux-x64/[name][ext]',
    //             },
    //         ],
    //     }),
    // ],

    // Mode
    mode: 'production', // or 'development' for debugging
};
