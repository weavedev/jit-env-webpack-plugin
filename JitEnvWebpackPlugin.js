const JitEnv = require('@weavedev/jit-env-snowpack-plugin/JitEnv');
const fs = require('fs');
const path = require('path');

// Try to load html-webpack-plugin for v4 and up
let HtmlWebpackPlugin = undefined;
try { HtmlWebpackPlugin = require('html-webpack-plugin') } catch (_) {}

const NAME = 'JitEnvWebpackPlugin';

const TARGET_DIR = path.resolve(process.cwd(), './node_modules/.jit-env-webpack-plugin-tmp');
const CANARY = path.resolve(TARGET_DIR, 'CANARY');

/**
 * Options for the jit-env-webpack-plugin
 * @typedef {Object} JitEnvWebpackPluginOptions
 * @property {string} [defaultEnv] a fallback env file to use
 * @property {string} [userEnv] the user's env path
 * @property {string} [emitTypes] emit a TypeScript types file based on defaultEnv
 * @property {string} [emitTypesPrefix] add something to the beginning of the emitTypes file (usefull to disable linters etc.)
 */

class JitEnvWebpackPlugin {
    /**
     * Create a plugin instance
     * @param {JitEnvWebpackPluginOptions} options 
     */
    constructor(options = {}) {
        this.jitEnv = new JitEnv(options, this.requestUpdate);
    }

    apply(compiler) {
        compiler.hooks.compilation.tap(NAME, (compilation) => {
            // Support html-webpack-plugin ^3.0.0
            if (compilation.hooks.htmlWebpackPluginAfterHtmlProcessing) {
                compilation.hooks.htmlWebpackPluginAfterHtmlProcessing.tapAsync(NAME, (data, next) => {
                    // Inject env or env target
                    data.html = this.jitEnv.transform(data.html);
                    next();
                });

                return;
            }
            
            // Support html-webpack-plugin ^4.0.0
            if (compilation && HtmlWebpackPlugin && HtmlWebpackPlugin.getHooks) {
                const beforeEmit = HtmlWebpackPlugin.getHooks(compilation).beforeEmit;

                if (beforeEmit) {
                    beforeEmit.tapAsync(NAME, (data, next) => {
                        // Inject env or env target
                        data.html = this.jitEnv.transform(data.html);
                        next(null, data);
                    });

                    return;
                }
            }

            throw new Error("Missing html-webpack-plugin or unsupported version");
        });

        // Create tmp dir
        if (!fs.existsSync(TARGET_DIR)) {
            fs.mkdirSync(TARGET_DIR, { recursive: true });
        }

        // Set canary function
        this.internalRequestUpdate = () => {
            fs.writeFileSync(CANARY, new Date().toISOString());
        }

        // Write canary
        this.internalRequestUpdate();

        // Watch canary
        compiler.hooks.afterCompile.tap(NAME, (compilation) => {
            compilation.fileDependencies.add(CANARY);
        });
    }

    internalRequestUpdate = () => {
        throw new Error(`internalRequestUpdate uninitialized`);
    }

    requestUpdate = () => {
        this.internalRequestUpdate();
    }
}

module.exports = JitEnvWebpackPlugin;
