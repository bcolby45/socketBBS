const Encore = require('@symfony/webpack-encore');

Encore
    // directory where compiled assets will be stored
    .setOutputPath('public/static/')
    // public path used by the web server to access the output path
    .setPublicPath('/static')

    /*
     * ENTRY CONFIG
     *
     * Add 1 entry for each "page" of your app
     * (including one that's included on every page - e.g. "app")
     *
     * Each entry will result in one JavaScript file (e.g. app.js)
     * and one CSS file (e.g. app.css) if you JavaScript imports CSS.
     */
    .addEntry('main', './static/javascript/main.js')
    .copyFiles({
        from: './static/assets',
        to: 'assets/[path][name].[ext]'
    })
    .cleanupOutputBeforeBuild()
    .enableSourceMaps(!Encore.isProduction())
    .disableSingleRuntimeChunk()
    .enablePostCssLoader()
    .enableVersioning()
    ;

module.exports = Encore.getWebpackConfig();