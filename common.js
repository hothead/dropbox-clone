let fs = require('fs')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')

require('songbird')

// delete the file at filePath
module.exports.delete = function(filePath, isDir) {
	if (isDir) {
		rimraf.promise(filePath)
			.then(() => {console.log('Directory deleted')})
	} else {
		fs.promise.unlink(filePath)
			.then(() => {console.log('File deleted')},
				err => {console.log(err.stack)})
	}
}

// update given filePath and new content
module.exports.post = function(filePath, content) {
	fs.promise.truncate(filePath, 0)
		.then(() => {fs.promise.writeFile(filePath, content)
			.then(() => {console.log('File updated')})})
}

// create the file given dirPath, filePath and content
module.exports.put = function (filePath, isDir, dirPath, content) {
	mkdirp.promise(dirPath)

	if (!isDir) {
		fs.promise.writeFile(filePath, content)
			.then(() => {console.log('File created')})
	}
}
