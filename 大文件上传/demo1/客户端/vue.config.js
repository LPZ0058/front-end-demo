module.exports = {
    lintOnSave: false,
    devServer: {
        port: '8060',
        proxy: {
            '/': {
                target: 'http://127.0.0.1:8888',
                changeOrigin: true
            }
        }
    }
};