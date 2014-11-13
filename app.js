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
    var result = true;
    _.forEach(_.values(getAllPageElements()), function(pageElement) {
        result = deletePageElement(pageElement.pageElementId);
        return result;
    });
    return result;
};

var getAllPageElements = function() {
    return pageElements;
};

var getPageElement = function(pageElementId) {
    return getAllPageElements()[pageElementId];
};

var log = function(message) {
    console.log(new Date().toLocaleTimeString() + ' - ' + message);
};

var logError = function(message) {
    console.error(new Date().toLocaleTimeString() + ' - ' + message);
};

var uuid = function () {
    var S4 = function () {
        return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
};

/*********** SocketIO part **************/

io.sockets.on('connection', function (socket) {
    var clientId = uuid();
    var logPrefix = 'Client ' + clientId + ' - ';
    log(logPrefix + 'Connected');

	socket.on('getAllPageElements', function (callback) {
        if (callback) {
            var pageElements = _.values(getAllPageElements());
            log(logPrefix + 'Listing all ' + pageElements.length + ' elements');
            callback({status: 200, pageElements: pageElements});
        }
	}).on('savePageElement', function (pageElementToSave, callback) {
        log(logPrefix + 'Saving pageElement "' + pageElementToSave.pageElementId +
            '" of type ' + pageElementToSave.pageElementType);
        var pageElementSaved = savePageElement(pageElementToSave);
        if (pageElementSaved) {
            log(logPrefix + 'Saved pageElement "' + pageElementToSave.pageElementId +
                '" of type ' + pageElementToSave.pageElementType);
			io.sockets.emit('pageElementSaved', pageElementToSave);
		}
        if (callback && pageElementSaved) {
            callback({status: 200});
        } else {
            logError('PageElement "' + pageElementToSave.pageElementId +
                '" of type ' + pageElementToSave.pageElementType + ' could not be saved');
            callback({status: 500, message: 'Page element could not be saved'});
        }
	})
	.on('deletePageElement', function (pageElementToDeleteId, callback) {
        log(logPrefix + 'Deleting pageElement "' + pageElementToDeleteId + '"');
        var pageElementDeleted = deletePageElement(pageElementToDeleteId);
        if (pageElementDeleted) {
            log(logPrefix + 'Deleted pageElement "' + pageElementToDeleteId + '"');
        } else {
            log('PageElement "' + pageElementToDeleteId + '" could not be deleted, as it was not found,'
                + ' but event still sent to clients as it could have been deleted while server was offline');
        }

        io.sockets.emit('pageElementDeleted', pageElementToDeleteId);

        if (callback) {
            callback({status: 200});
        }
	})
    .on('deleteAllPageElements', function (callback) {
        log(logPrefix + 'Deleting all pageElements');
        var allPageElementsDeleted = deleteAllPageElements();
        if (allPageElementsDeleted) {
            log(logPrefix + 'Deleted all pageElements');
            io.sockets.emit('allPageElementsDeleted');
        }
        if (callback && allPageElementsDeleted) {
            callback({status: 200});
        } else {
            logError('Some page elements could not be deleted');
            callback({status: 500, message: 'Some page elements could not be deleted'});
        }
    })
	.on('disconnect', function(){
        log(logPrefix + 'Disconnected');
    });
});

server.listen(port);