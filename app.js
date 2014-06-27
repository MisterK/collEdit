var port = 3000,
	express = require('express'),
    app = express(),
    server = require('http').createServer(app),
	io = require('socket.io').listen(server, { log: false }),
    _ = require('./client/resources/js/libs/lodash-v2.4.1'),
	pageElements = {};

_(process.argv)
	.map(function (arg) { return arg.indexOf('port=') == 0 ?
			arg.substring('port='.length, arg.length) : undefined })
	.filter(function(port) { return !_.isUndefined(port); })
	.at([0])
	.forEach(function(finalPort) { if (!_.isUndefined(finalPort)) port = finalPort; });
console.log('port ', port);

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/client/index.html');
});

app.use('/resources', express.static(__dirname + "/client/resources"));

var addPageElement = function(pageElementToAdd) {
    if (!pageElements[pageElementToAdd.id]) {
        pageElements[pageElementToAdd.id] = pageElementToAdd;
        return true;
    }
    return false;
};

var updatePageElement = function(pageElementToUpdate) {
    if (pageElements[pageElementToUpdate.id]) {
        pageElements[pageElementToUpdate.id] = pageElementToUpdate;
        return true;
    }
    return false;
};

var deletePageElement = function(pageElementToDelete) {
    if (pageElements[pageElementToDelete.id]) {
        delete pageElements[pageElementToDelete.id];
        return true;
    }
    return false;
};

/* SocketIO part*/

io.sockets.on('connection', function (socket) {
	socket.emit('allPageElements', pageElements);

	socket.on('addPageElement', function (pageElementToAdd) {
		if (addPageElement(pageElementToAdd)) {
			io.sockets.emit('pageElementAdded', pageElementToAdd);
		}
	})
	.on('updatePageElement', function (pageElementToUpdate) {
		if (updatePageElement(pageElementToUpdate)) {
			io.sockets.emit('pageElementUpdated', pageElementToUpdate);
		}
	})
	.on('deletePageElement', function (pageElementToDelete) {
		if (deletePageElement(pageElementToDelete)) {
			io.sockets.emit('pageElementDeleted', pageElementToDelete);
		}
	})
	.on('disconnect', function(){
        //TODO
    });
});

/* HTTP part */


server.listen(port);