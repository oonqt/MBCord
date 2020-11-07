const zip = require("electron-installer-zip");
const rimraf = require("rimraf");
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const { execSync } = require("child_process");
const { prodBuilds } = require("./package.json");

const zipSync = promisify(zip);

(async () => {
    console.log("\nPackaging all platforms... \n");

    for(const build of prodBuilds) {
        console.log(`Packaging ${build}`)
        execSync(`npm run ${build}`, { stdio: "ignore" });
    }

    console.log("\nCompressing... \n");

    let packedBuilds = fs.readdirSync(path.join(__dirname, "build"));

    for(const build of packedBuilds) {
        console.log(`Compressing ${build}`);

        const buildPath = path.join("build", build);

        // problem code
        await zipSync({
            dir: buildPath,
            out: `${buildPath}.zip`
        });

        rimraf.sync(buildPath);
    }
})();