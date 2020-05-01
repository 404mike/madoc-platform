module.exports = {
    stories: ['../stories/**/*.stories.tsx'],
    addons: [
        '@storybook/addon-knobs'
    ],
    webpackFinal: async config => {
        config.module.rules.push({
            test: /\.(ts|tsx)$/,
            use: [
                {
                    loader: require.resolve('ts-loader'),
                    options: {
                        transpileOnly: true,
                        experimentalWatchApi: true,
                    }
                },
            ],
        });

        config.optimization.removeAvailableModules = false;
        config.optimization.removeEmptyChunks = false;
        config.optimization.splitChunks = false;

        config.resolve.extensions.push('.ts', '.tsx');
        return config;
    },
};
