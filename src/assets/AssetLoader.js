const fs = require('fs');

module.exports = class AssetLoader {

    constructor(manifestFileSrc = null, entrypointsFileSrc = null) {
        this.manifest = this._loadJson(manifestFileSrc) || {};
        this.entrypoints = this._loadJson(entrypointsFileSrc) || {};
    }

    getFile(path, asHtml = false) {
        if (asHtml)
            return this.getFileHtml(path);

        const manifestPath = this._trimPath(path);

        return this.manifest[manifestPath];
    }

    getFileHtml(path) {
        const manifestPath = this._trimPath(path);
        const file = this.manifest[manifestPath];
        const extension = file.split('.').pop().toLowerCase();
        const uri = JSON.stringify(file);

        switch (extension) {
            case 'js':
                return `<script src=${uri}></script>`;
            case 'css':
                return `<link rel="stylesheet" href=${uri}>`;
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
                return `<img src=${uri} />`;
            default:
                throw new Error('Unkown file type');
        }
    }

    getAsset(name) {
        const { entrypoints } = this.entrypoints;

        if (!entrypoints)
            return null;

        const asset = entrypoints[name];

        if (!asset)
            return null;

        const {
            js = [],
            css = []
        } = asset;

        const cssAssets = css.map((src) => `<link rel="stylesheet" href=${JSON.stringify(src)}>`);
        const jsAssets = js.map((src) => `<script src=${JSON.stringify(src)}></script>`);

        return { css: cssAssets, js: jsAssets };
    }

    _trimPath(path = '') {
        return path.replace(/^\/+|\/+$/g, '');
    }

    _loadJson(jsonFilePath) {
        if (!jsonFilePath)
            return null;

        const rawData = fs.readFileSync(jsonFilePath);

        return JSON.parse(rawData);
    }
}