module.exports = {
    // 数据库连接
    db: process.env.DATABASE_URL || 'mysql://fd:123456@172.16.60.247:3306/wechat_message',
    dbEntitiesPath: ['src/entity/**/*.ts'],
    redis: {
        keyPrefix: '[zkboys]',
        port: 6379,
        host: '134.175.116.254',
        password: 'zkboys123',
        db: 0,
    },
};
