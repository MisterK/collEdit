var port = 3000,
	express = require('express'),
    bodyParser = require('body-parser'),
    app = express(),
    server = require('http').createServer(app),
	io = require('socket.io').listen(server, { log: false }),
    _ = require('./client/resources/js/libs/lodash-v2.4.1'),
	pageElements = {};

//Read server port from input args
_(process.argv)
	.map(function (arg) { return arg.indexOf('port=') == 0 ?
			arg.substring('port='.length, arg.length) : undefined })
	.filter(function(port) { return !_.isUndefined(port); })
	.at([0])
	.forEach(function(finalPort) { if (!_.isUndefined(finalPort)) port = finalPort; });
console.log('port ', port);

//Request and responses body as JSON
app.use(bodyParser.json());

//Server main page
app.get('/', function (req, res) {
    res.sendfile(__dirname + '/client/index.html');
});

//Serve resources
app.use('/resources', express.static(__dirname + "/client/resources"));

/************** Data management functions **************/

var savePageElement = function(pageElementToSave) {
    pageElements[pageElementToSave.pageElementId] = pageElementToSave;
    return true;
};

var deletePageElement = function(pageElementToDeleteId) {
    if (getPageElement(pageElementToDeleteId)) {
        delete pageElements[pageElementToDeleteId];
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

/*********** SocketIO part **************/

io.sockets.on('connection', function (socket) {
	socket.emit('allPageElements', _.values(getAllPageElements()));

	socket.on('savePageElement', function (pageElementToSave) {
		if (savePageElement(pageElementToSave)) {
			io.sockets.emit('pageElementSaved', pageElementToSave);
		}
	})
	.on('deletePageElement', function (pageElementToDelete) {
		if (deletePageElement(pageElementToDelete.pageElementId)) {
			io.sockets.emit('pageElementDeleted', pageElementToDelete);
		}
	})
    .on('deleteAllPageElements', function () {
        if (deleteAllPageElements()) {
            io.sockets.emit('allPageElementsDeleted', pageElementToDelete);
        }
    })
	.on('disconnect', function(){
        //TODO
    });
});

/*************** HTTP part ***************/

app.get('/pageElements', function(req, res) {
    res.json(_.values(getAllPageElements()));
});

app.get('/pageElement/:pageElementId', function(req, res) {
    res.json(getPageElement(req.params.pageElementId));
});

app.post('/pageElement', function(req, res) {
    var pageElementToSave = req.body;
    var pageElementSaved = savePageElement(pageElementToSave);
    if (pageElementSaved) {
        io.sockets.emit('pageElementSaved', pageElementToSave);
    }
    res.send(pageElementSaved ? 200 : 400);
});

app.delete('/pageElement/:pageElementId', function(req, res) {
    var pageElementToDeleteId = req.params.pageElementId;
    var pageElementDeleted = deletePageElement(pageElementToDeleteId);
    if (pageElementDeleted) {
        io.sockets.emit('pageElementDeleted', pageElementToDeleteId);
    }
    res.send(pageElementDeleted ? 200 : 400);
});

app.delete('/pageElements', function(req, res) {
    var allPageElementsDeleted = deleteAllPageElements();
    if (allPageElementsDeleted) {
        io.sockets.emit('allPageElementsDeleted');
    }
    res.send(allPageElementsDeleted ? 200 : 400);
});

server.listen(port);