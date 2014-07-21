'use strict';

/**** Common angular services ****/

angular.module('colledit.ioAngularServices', [])
    .service('serverCommunicationService', function($http, $window) {
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

            this.emitEvent = function(eventType, data) {
                socket.emit(eventType, data);
            };

            this.getPageElement = function(pageElementId, successCallback, errorCallback) {
                $http.get('/pageElement/' + pageElementId)
                    .success(successCallback || _.noop)
                    .error(errorCallback || _.noop);
            };

            this.listPageElements = function(successCallback, errorCallback) {
                $http.get('/pageElements')
                    .success(successCallback || _.noop)
                    .error(errorCallback || _.noop);
            };

            this.savePageElement = function(pageElement, successCallback, errorCallback) {
                $http.post('/pageElement', pageElement)
                    .success(successCallback || _.noop)
                    .error(errorCallback || _.noop);
            };

            this.deletePageElement = function(pageElement, successCallback, errorCallback) {
                $http.delete('/pageElement/' + pageElement.pageElementId)
                    .success(successCallback || _.noop)
                    .error(errorCallback || _.noop);
            };

            this.deleteAllPageElements = function(successCallback, errorCallback) {
                $http.delete('/pageElements')
                    .success(successCallback || _.noop)
                    .error(errorCallback || _.noop);
            };
        }
    });
