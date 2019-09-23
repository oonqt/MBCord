module.exports = () => {
    return !process.mainModule.filename.indexOf("app.asar");
}