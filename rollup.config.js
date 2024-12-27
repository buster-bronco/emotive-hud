const fsPromises = require("fs/promises");
const resolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const typescript = require("@rollup/plugin-typescript");
const scss = require("rollup-plugin-scss");
const copy = require("rollup-plugin-copy");
const json = require("@rollup/plugin-json");

const moduleVersion = process.env.MODULE_VERSION;
const githubProject = process.env.GH_PROJECT;
const githubTag = process.env.GH_TAG;

module.exports = {
  input: "src/ts/module.ts", // Your TypeScript entry point
  output: {
    dir: "dist/scripts", // Output directory
    entryFileNames: "module.js", // Output file name
    format: "es", // ES module format
    sourcemap: true, // Include source maps
  },
  plugins: [
    resolve(), // Resolve Node.js-style imports
    commonjs(), // Handle CommonJS modules
    typescript(), // Compile TypeScript files
    json(), // Add this plugin to handle JSON imports
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
      hook: "writeBundle", // Run this during the write phase
    }),
    updateModuleManifestPlugin(), // Custom plugin for manifest updates
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
