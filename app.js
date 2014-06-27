var port = 3000,
	express = require('express'),
    bodyParser = require('body-parser'),
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

app.use(bodyParser.json());

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/client/index.html');
});

app.use('/resources', express.static(__dirname + "/client/resources"));

var savePageElement = function(pageElementToSave) {
    pageElements[pageElementToSave.id] = pageElementToSave;
    return true;
};

var updatePageElement = function(pageElementToUpdate) {
    if (getPageElement(pageElementToUpdate.id)) {
        pageElements[pageElementToUpdate.id] = pageElementToUpdate;
        return true;
    }
    return false;
};

var deletePageElement = function(pageElementToDelete) {
    if (getPageElement(pageElementToDelete.id)) {
        delete pageElements[pageElementToDelete.id];
        return true;
    }
    return false;
};

var deleteAllPageElements = function() {
    for (var pageElement in getAllPageElements()) {
        if (!deletePageElement(pageElement.pageElementId)) {
            return false;
        }
    }
    return true;
};

var getAllPageElements = function() {
    return pageElements;
};

var getPageElement = function(pageElementId) {
    return getAllPageElements()[pageElementId];
};

/* SocketIO part*/

io.sockets.on('connection', function (socket) {
	socket.emit('allPageElements', getAllPageElements());

	socket.on('savePageElement', function (pageElementToSave) {
		if (savePageElement(pageElementToSave)) {
			io.sockets.emit('pageElementSaved', pageElementToSave);
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
app.get('/pageElements', function(req, res) {
    res.json(getAllPageElements());
});

app.get('/pageElement/:pageElementId', function(req, res) {
    res.json(getPageElement(req.params.pageElementId));
});

app.post('/pageElement', function(req, res) {
    var status = savePageElement(req.body) ? 200 : 400;
    res.send(status);
});

app.delete('/pageElement/:pageElementId', function(req, res) {
    var status = deletePageElement(req.params.pageElementId) ? 200 : 400;
    res.send(status);
});

app.delete('/pageElements', function(req, res) {
    var status = deleteAllPageElements() ? 200 : 400;
    res.send(status);
});

server.listen(port);