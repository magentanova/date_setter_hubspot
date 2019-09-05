module.exports = {
    exitOnAsyncError: promise => 
        promise.catch(e => {
            console.error(e.response.body || e.response) 
            process.exit(1)
        })
}