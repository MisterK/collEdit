'use strict';

/**** Common angular services ****/

angular.module('colledit.ioAngularServices', [])
    .service('serverCommunicationService', function($window) {
        this.getServerConnection = function() {
            return new ServerConnection();
        };

        function ServerConnection() {
            if (!(this instanceof ServerConnection)) return new ServerConnection();

            var socket = undefined;
            this.isConnected = false;

            this.connectToServerEventsWithListeners = function(registerEventHandlerDescriptors) {
                if (!angular.isDefined($window.io)) {
                    return this;
                }
                socket = $window.io.connect('', {
                    'force new connection': true,
                    query: undefined
                });
                _.forEach(registerEventHandlerDescriptors, function(eventHandlerFunction, eventType) {
                    socket.on(eventType, function(serverResponse) {
                        eventHandlerFunction(serverResponse);
                    });
                });
                this.isConnected = true;
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
                        (successCallback || _.noop)(response.pageElements);
                    } else {
                        (errorCallback || _.noop)(response.status, response.message);
                    }
                });
            };

            this.savePageElement = function(pageElement, successCallback, errorCallback) {
                emitEvent('savePageElement', pageElement, function(response) {
                    if (response.status == 200) {
                        (successCallback || _.noop)();
                    } else {
                        (errorCallback || _.noop)(response.status, response.message);
                    }
                });
            };

            this.deletePageElement = function(pageElement, successCallback, errorCallback) {
                emitEvent('deletePageElement', pageElement.pageElementId, function(response) {
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
