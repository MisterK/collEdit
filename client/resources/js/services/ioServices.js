'use strict';

/**** Common angular services ****/

angular.module('colledit.ioAngularServices', [])
    .service('serverCommunicationService', function($http, $window) {
        this.getServerConnection = function(registerEventHandlerDescriptors) {
            return new ServerConnection().connectToServerEventsWithListeners(registerEventHandlerDescriptors);
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
                _.forEach(registerEventHandlerDescriptors, function(eventHandlerDescriptor) {
                    var eventType = eventHandlerDescriptor[0];
                    var eventHandlerFunction = eventHandlerDescriptor[1];
                    socket.on(eventType, function (serverResponse) {
                        eventHandlerFunction(serverResponse);
                    });
                });
                this.isConnected = true;
                return this;
            };

            this.emitEvent = function(eventType, data) {
                socket.emit(eventType, data);
            };

            this.getPageElement = function(pageElementKey, successCallback, errorCallback) {
                $http.get('/pageElement/' + pageElementKey)
                    .success(successCallback || new Function())
                    .error(errorCallback || new Function());
            };

            this.listPageElements = function(successCallback, errorCallback) {
                $http.get('/pageElements')
                    .success(successCallback || new Function())
                    .error(errorCallback || new Function());
            };

            this.savePageElement = function(pageElement, successCallback, errorCallback) {
                $http.post('/pageElement', pageElement)
                    .success(successCallback || new Function())
                    .error(errorCallback || new Function());
            };

            this.deletePageElement = function(pageElement, successCallback, errorCallback) {
                $http.delete('/pageElement/' + pageElement.key)
                    .success(successCallback || new Function())
                    .error(errorCallback || new Function());
            };

            this.deleteAllPageElements = function(successCallback, errorCallback) {
                $http.delete('/pageElements')
                    .success(successCallback || new Function())
                    .error(errorCallback || new Function());
            };
        }
    });
