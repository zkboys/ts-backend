const isDevMode = process.env.NODE_ENV === 'development';

module.exports = {
    port: +process.env.PORT || 3000,
    host: '0.0.0.0',
    pageSize: 30,
    proxy: false,
    unsplashClientId: '',
    debugLogging: isDevMode,
    dbsslconn: !isDevMode,
    cronJobExpression: '0 * * * *',
    blackList: {
        projects: [],
        ips: [],
    },
    rateLimit: {
        max: 1000,
        duration: 1000,
    },
    jwt: {
        expire: '14 days',
        secret: process.env.JWT_SECRET || 'shared-secret',
    },
    upload: {
        types: [
            '.jpg',
            '.jpeg',
            '.png',
            '.gif',
            '.json',
            '.yml',
            '.yaml',
        ],
        size: 5242880,
        dir: '../public/upload',
        expire: {
            types: [
                '.json',
                '.yml',
                '.yaml',
            ],
            day: -1,
        },
    },
    ldap: {
        server: '',
        bindDN: '',
        password: '',
        filter: {
            base: '',
            attributeName: '',
        },
    },
    fe: {
        copyright: '',
        storageNamespace: 'easy-mock_',
        timeout: 25000,
        publicPath: '/dist/',
    },
};
