let path = require('path')
let argv = require('yargs')
	.default('host', '127.0.0.1')
	.default('dir', path.resolve(process.cwd()))
	.argv
let net = require('net')
let JsonSocket = require('json-socket')
let chokidar = require('chokidar')

let common = require('./common.js')

require('songbird')


const PORT_TCP = 8099

let client = new JsonSocket(new net.Socket())

client.promise.connect(PORT_TCP, argv.host)
	.then(() => {console.log(`CONNECTED to http://${argv.host}:${PORT_TCP}`)})

client.promise.on('error').then(() => {}, err => {
	if (err.code === 'ECONNREFUSED') {
		console.log('Is the server running at ' + PORT_TCP + '?')

		setTimeout(function() {
			client.connect(PORT_TCP, argv.host, function(){
				console.log(`RETRY: CONNECTED to http://${argv.host}:${PORT_TCP}`)
			})
		}, 3000)

		console.log(`Waiting for 3 seconds before retrying port: ${PORT_TCP}`)
	}
})

client.on('message', function(message) {
	// create the paths relative to the client root directory
	let filePath = path.resolve(path.join(argv.dir, message.path))
	let dirPath = path.resolve(path.join(argv.dir, message.dirPath))

	switch(message.action) {
		case 'create':
			common.put(filePath, message.type === "dir", dirPath, message.contents)
			break
		case 'delete':
			common.delete(filePath, message.type === "dir")
			break
		case 'update':
			common.post(filePath, message.contents)
			break
		default:
			console.log('Invalid action')
	}
})

let watcher = chokidar.watch(argv.dir, {
  ignored: /[\/\\]\./,
  persistent: true
})
watcher
	.on('add', function(watchPath) { console.log('File', watchPath, 'has been added') })
	.on('change', function(watchPath) { console.log('File', watchPath, 'has been changed') })
	.on('unlink', function(watchPath) { console.log('File', watchPath, 'has been removed') })
	.on('addDir', function(watchPath) {
		console.log('Directory', watchPath, 'has been added')
		client.sendMessage('test')
	})

