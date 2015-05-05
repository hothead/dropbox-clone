let fs = require('fs')
let path = require('path')
let express = require('express')
let morgan = require('morgan')
let nodeify = require('bluebird-nodeify')
let mime = require('mime-types')
let argv = require('yargs')
	.default('host', '127.0.0.1')
	.default('dir', path.resolve(process.cwd()))
	.argv
let net = require('net')
let JsonSocket = require('json-socket')
let bodyParser = require('body-parser')

let common = require('./common.js')

require('songbird')


const NODE_ENV = process.env.NODE_ENV
const PORT = process.env.PORT || 8000
const PORT_TCP = 8099
const ROOT_DIR = argv.dir



// TCP for server -> client
let server = net.createServer()
server.listen(PORT_TCP)
console.log(`LISTENING @ tcp://127.0.0.1:${PORT_TCP}`)

let connection = null
async ()=>{
	await server.on('connection', function(socket) {
		connection = new JsonSocket(socket)
	})
}().catch(e => console.log(e))



// HTTP server and routes
let app = express()
if (NODE_ENV === 'development') {
	app.use(morgan('dev'))
}
app.use(bodyParser.urlencoded({ extended: false }))
app.listen(PORT, ()=> console.log(`LISTENING @ http://127.0.0.1:${PORT}`))

app.get('*', setFileMeta, sendHeaders, (req, res) => {
	if (res.body) {
		res.json(res.body)
		return
	}

	fs.createReadStream(req.absFilePath).pipe(res)
})

app.head('*', setFileMeta, sendHeaders, (req, res) => res.end())

app.delete('*', setFileMeta, setDirDetails, (req, res, next) => {
	async ()=>{
		if (!req.stat) return res.status(400).send('Invalid path')

		await common.delete(req.absFilePath, req.isDir)
		if (res.statusCode === 200) {
			sendClientSyncMessage("delete", req)
		}
		res.end()
	}().catch(next)
})

app.post('*', setFileMeta, setDirDetails, (req, res, next) => {
	async ()=>{
		if (!req.stat) return res.status(405).send('File does not exist')
		// advanced functionality - for now display error when
		// attempting to update a directory
		if (req.isDir) return res.status(405).send('Path is a directory')

		// await fs.promise.truncate(req.filePath, 0)
		// req.pipe(fs.createWriteStream(req.filePath))
		await common.post(req.absFilePath, JSON.stringify(req.body))
		if (res.statusCode === 200) {
			sendClientSyncMessage("update", req)
		}
		res.end()
	}().catch(next)
})

app.put('*', setFileMeta, setDirDetails, (req, res, next) => {
	async ()=>{
		if (req.stat) return res.status(405).send('File exists')

		await common.put(req.absFilePath, req.isDir, req.absDirPath, JSON.stringify(req.body))
		if (res.statusCode === 200) {
			sendClientSyncMessage("create", req)
		}
		res.end()
	}().catch(err => console.log(err.stack)).catch(next)
})



function setDirDetails(req, res, next) {
	let absFilePath = req.absFilePath
	let endsWithSlash = absFilePath.charAt(absFilePath.length-1) === path.sep
	let hasExt = path.extname(absFilePath) !== ''
	req.isDir = endsWithSlash || !hasExt
	req.dirPath = req.isDir ? req.url : path.dirname(req.url)
	req.absDirPath = req.isDir ? absFilePath : path.dirname(absFilePath)
	next()
}

function setFileMeta(req, res, next) {
	req.absFilePath = path.resolve(path.join(ROOT_DIR, req.url))
	if (req.absFilePath.indexOf(ROOT_DIR) !== 0) {
		res.status(400).send('Invalid path')
		return
	}
	fs.promise.stat(req.absFilePath)
		.then(stat => {req.stat = stat}, () => {req.stat = null})
		.nodeify(next)
}

function sendHeaders(req, res, next) {
	nodeify(async ()=>{
		if (req.stat.isDirectory()) {
			let files = await fs.promise.readdir(req.absFilePath)
			res.body = JSON.stringify(files.length)
			res.setHeader('Content-Length', res.body.length)
			res.setHeader('Content-Type', 'application/json')
			return
		}

		res.setHeader('Content-Length', req.stat.size)
		let contentType = mime.contentType(path.extname(req.absFilePath))
		res.setHeader('Content-Type', contentType)
	}(), next)
}

function sendClientSyncMessage(action, req) {
	if (connection) {
		let message = {
			"action": action,
			"path": req.url,
			"dirPath": req.dirPath,
			"type": req.isDir ? "dir" : "file",
			"contents": JSON.stringify(req.body),
			"updated": Date.now()
		}
		connection.promise.sendMessage(message)
			.then(() => {console.log('Sent client update message')})
	} else {
		console.log('no connection to message')
	}
}
