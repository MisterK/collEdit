'use strict';

/**** Common angular services ****/

angular.module('colledit.ioAngularServices', [])
    .service('serverCommunicationService', function($window, logService) {
        this.getServerConnection = function() {
            return new ServerConnection();
        };

        function ServerConnection() {
            if (!(this instanceof ServerConnection)) return new ServerConnection();

            var socket = undefined;
            var thisConnection = this;
            this.isConnected = false;

            this.connectToServerEventsWithListeners = function(registerEventHandlerDescriptors,
                                                                internalEventHandlerDescriptors) {
                if (!angular.isDefined($window.io)) {
                    return this;
                }
                socket = $window.io.connect('', {
                    'force new connection': true,
                    'connect timeout': 5000,
                    query: undefined
                });
                _.forEach(registerEventHandlerDescriptors, function(eventHandlerFunction, eventType) {
                    socket.on(eventType, function(serverResponse) {
                        eventHandlerFunction(serverResponse);
                    });
                });
                var triggerConnectedToServerCallback = function() {
                    if (angular.isFunction(internalEventHandlerDescriptors['connectedToServer'])) {
                        internalEventHandlerDescriptors['connectedToServer']();
                    }
                };
                socket.on('connect', function() {
                    logService.log('Connected to server');
                    thisConnection.isConnected = true;
                    triggerConnectedToServerCallback();
                });
                socket.on('connect_error', function(error) {
                    logService.logError('Could not connect to server "' + error + '", will retry soon');
                    thisConnection.isConnected = false;
                });
                socket.on('connect_timeout', function(timeout) {
                    logService.logError('Connection to server timed out after ' + timeout + ', will retry soon');
                    thisConnection.isConnected = false;
                });
                socket.on('reconnect', function(attempt) {
                    logService.log('Re-connected to server after ' + attempt + ' attempts');
                    thisConnection.isConnected = true;
                    triggerConnectedToServerCallback();
                });
                socket.on('reconnect_failed', function() {
                    logService.logError('Could not re-connect to server, will retry soon');
                    thisConnection.isConnected = false;
                });
                socket.on('disconnect', function (reason) {
                  logService.logError('Disconnect from server "' + reason + '"');
                  thisConnection.isConnected = false;
                });
                socket.on('error', function (error) {
                  logService.logError('Error from server "' + error + '"');
                });

                return this;
            };

            var emitEvent = function(eventType, data, callback) {
                if (angular.isDefined(data)) {
                    socket.emit(eventType, data, callback);
                } else {
                    socket.emit(eventType, callback);
                }
            };

            this.listPageElements = function(successCallback, errorCallback) {
                emitEvent('getAllPageElements', undefined, function(response) {
                    if (response.status == 200) {
                        (successCallback || _.noop)(response.pageElements, response.deletedElementIds);
                    } else {
                        (errorCallback || _.noop)(response.status, response.message);
                    }
                });
            };

            this.savePageElement = function(pageElement, successCallback, errorCallback) {
                emitEvent('savePageElement',
                    angular.isFunction(pageElement.getPersistableObject) ? pageElement.getPersistableObject() : pageElement,
                    function(response) {
                        if (response.status == 200) {
                            (successCallback || _.noop)();
                        } else {
                            (errorCallback || _.noop)(response.status, response.message);
                        }
                });
            };

            this.deletePageElement = function(pageElementId, successCallback, errorCallback) {
                emitEvent('deletePageElement', pageElementId, function(response) {
                    if (response.status == 200) {
                        (successCallback || _.noop)();
                    } else {
                        (errorCallback || _.noop)(response.status, response.message);
                    }
                });
            };

            this.deleteAllPageElements = function(successCallback, errorCallback) {
                emitEvent('deleteAllPageElements', undefined, function(response) {
                    if (response.status == 200) {
                        (successCallback || _.noop)();
                    } else {
                        (errorCallback || _.noop)(response.status, response.message);
                    }
                });
            };
        }
    });
