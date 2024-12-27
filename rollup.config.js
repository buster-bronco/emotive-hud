const fsPromises = require("fs/promises");
const resolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const typescript = require("@rollup/plugin-typescript");
const scss = require("rollup-plugin-scss");
const copy = require("rollup-plugin-copy");
const json = require("@rollup/plugin-json");
require('dotenv').config();

const moduleVersion = process.env.MODULE_VERSION;
const githubProject = process.env.GH_PROJECT;
const githubTag = process.env.GH_TAG;
const foundryPath = process.env.FOUNDRY_VTT_PATH;
const isDev = process.env.NODE_ENV === 'development';

module.exports = {
  input: "src/ts/module.ts",
  output: {
    dir: "dist/scripts",
    entryFileNames: "module.js",
    format: "es",
    sourcemap: true,
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript(),
    json(),
    scss({
      input: "src/styles/style.scss",
      output: function(styles, styleNodes) {
        console.log("Styles:", styles ? "Has content" : "Empty");
        console.log("Writing to:", "dist/style.css");
        if (styles) {
          require('fs').writeFileSync("dist/style.css", styles);
        }
      },
      watch: ["src/styles/*.scss"]
    }),
    copy({
      targets: [
        { src: "src/languages", dest: "dist" },
        { src: "src/templates", dest: "dist" },
      ],
      hook: "writeBundle",
    }),
    updateModuleManifestPlugin(),
    {
      name: 'foundry-copy',
      closeBundle: async () => {  // Changed from writeBundle to closeBundle
        if (isDev && foundryPath) {
          try {
            await fsPromises.cp('dist', foundryPath, { 
              recursive: true,
              force: true
            });
            console.log(`Copied to Foundry modules directory: ${foundryPath}`);
          } catch (err) {
            console.error('Failed to copy to Foundry directory:', err);
          }
        }
      }
    },
  ],
};

// Custom plugin to update the module manifest
function updateModuleManifestPlugin() {
  return {
    name: "update-module-manifest",
    async writeBundle() {
      // Read the package.json file
      const packageContents = JSON.parse(
        await fsPromises.readFile("./package.json", "utf-8")
      );

      const version = moduleVersion || packageContents.version;

      // Read and update the module.json file
      const manifestContents = await fsPromises.readFile(
        "src/module.json",
        "utf-8"
      );
      const manifestJson = JSON.parse(manifestContents);
      manifestJson["version"] = version;

      if (githubProject) {
        const baseUrl = `https://github.com/${githubProject}/releases`;
        manifestJson["manifest"] = `${baseUrl}/latest/download/module.json`;

        if (githubTag) {
          manifestJson[
            "download"
          ] = `${baseUrl}/download/${githubTag}/module.zip`;
        }
      }

      // Write the updated module.json file to the dist directory
      await fsPromises.writeFile(
        "dist/module.json",
        JSON.stringify(manifestJson, null, 4)
      );
    },
  };
}