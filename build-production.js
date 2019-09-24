const zip = require("node-7z");
const path = require("path");
const { execSync } = require("child_process");  
const fs = require("fs");

async function main() {
    console.log("Packaging all platforms...");

    await execSync("npm run buildall", { stdio: "ignore" });

    console.log("Compressing...");

    let packedBuilds = await fs.readdirSync(path.join(__dirname, "build"));

    await packedBuilds.forEach(async build => {
        console.log(`Starting: ${build}`)
        await zip.add(path.join("build", `${build}.zip`), path.join("build", build), { deleteFilesAfter: true });
        console.log(`Finished: ${build}`);
    });

    console.log("Finished packaging & compressing")
}

main();