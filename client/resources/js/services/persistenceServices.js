'use strict';

/**** Lawnchair-related angular services ****/

angular.module('colledit.persistenceServices', [])
    /* Return the localStorage configuration */
    .constant('localStorageCfg', {
    })
    /* Wrapper to the lawnchair singleton */
    .factory('lawnchairService', function($window) {
        if (!angular.isDefined($window.Lawnchair)) {
            throw "Lawnchair library doesn't seem included in page"
        }
        return {
            'getLawnchairStorage': function(callback) {
                return new $window.Lawnchair(callback);
            }
        };
    })
    .service('localStorageService', function(lawnchairService) {
        var lawnchairStorage = lawnchairService.getLawnchairStorage(_.noop);

        this.savePageElement = function(pageElement, callback) {
            lawnchairStorage.save(pageElement, callback);
        };

        this.deletePageElement = function(pageElement, callback) {
            lawnchairStorage.remove(pageElement.pageElementId, callback);
        };

        this.getPageElement = function(pageElementId, callback) {
            return lawnchairStorage.get(pageElementId, callback);
        };

        this.listAllPageElements = function(callback) {
            return lawnchairStorage.all(callback);
        };

        this.deleteAllPageElements = function(callback) {
            //TODO This clears the storage, but not the browser's localStorage
            return lawnchairStorage.nuke(callback);
        };
    })
    .factory('persistenceService', function(serverCommunicationService, localStorageService) {
        function Persistence(registerEventHandlerDescriptors) {
            var connection = serverCommunicationService.getServerConnection();
            var localElementsToBePersistedIds = [],
                localElementsToBeDeletedIds = [];

            var pageElementSavedEventHandler = function(serverResponse) {
                localStorageService.savePageElement(serverResponse);

                if (angular.isDefined(registerEventHandlerDescriptors['pageElementSaved'])) {
                    registerEventHandlerDescriptors['pageElementSaved'](serverResponse);
                }
            };

            var pageElementDeletedEventHandler = function(serverResponse) {
                localStorageService.deletePageElement(serverResponse);

                if (angular.isDefined(registerEventHandlerDescriptors['pageElementDeleted'])) {
                    registerEventHandlerDescriptors['pageElementDeleted'](serverResponse);
                }
            };

            var allPageElementsDeletedEventHandler = function(serverResponse) {
                localStorageService.deleteAllPageElements();

                if (angular.isDefined(registerEventHandlerDescriptors['allPageElementsDeleted'])) {
                    registerEventHandlerDescriptors['allPageElementsDeleted'](serverResponse);
                }
            };

            connection.connectToServerEventsWithListeners(
                {'pageElementSaved': pageElementSavedEventHandler,
                    'pageElementDeleted': pageElementDeletedEventHandler,
                    'allPageElementsDeleted': allPageElementsDeletedEventHandler});

            this.getPageElement = function(pageElementId, callback) {
                if (connection.isConnected
                    && localElementsToBePersistedIds.indexOf(pageElement.pageElementId) < 0
                    && localElementsToBeDeletedIds.indexOf(pageElement.pageElementId) < 0) {
                    connection.getPageElement(pageElementId, function(pageElement) {
                        localStorageService.savePageElement(pageElement);
                        callback(pageElement);
                    }, function() {
                        localStorageService.getPageElement(pageElementId, callback);
                    });
                } else {
                    localStorageService.getPageElement(pageElementId, callback);
                }
            };

            this.listPageElements = function(callback) {
                if (connection.isConnected) {
                    connection.listPageElements(function(pageElements) {
                        if (angular.isArray(pageElements)) {
                            _.forEach(pageElements, function(pageElement) {
                                localStorageService.savePageElement(pageElement);
                            });
                        }
                        //TODO determine here which elements are not known from the server yet and try to persist them
                        localStorageService.listAllPageElements(callback);
                    }, function() {
                        localStorageService.listAllPageElements(callback);
                    });
                } else {
                    localStorageService.listAllPageElements(callback);
                }
            };

            this.savePageElement = function(pageElement, callback) {
                if (connection.isConnected && localElementsToBePersistedIds.indexOf(pageElement.pageElementId) < 0) {
                    connection.savePageElement(pageElement, undefined, function() {
                        localElementsToBePersistedIds.push(pageElement.pageElementId);
                    });
                }
                localStorageService.savePageElement(pageElement, callback);
            };

            this.deletePageElement = function(pageElement, callback) {
                if (connection.isConnected && localElementsToBeDeletedIds.indexOf(pageElement.pageElementId) < 0) {
                    connection.deletePageElement(pageElement, undefined, function() {
                        localElementsToBeDeletedIds.push(pageElement.pageElementId);
                    });
                }
                localStorageService.deletePageElement(pageElement, callback);
            };

            this.deleteAllPageElements = function(callback) {
                if (connection.isConnected) {
                    connection.deleteAllPageElements(undefined, function() {
                        localStorageService.listAllPageElements(function(pageElements) {
                            localElementsToBeDeletedIds.push.apply(
                                localElementsToBeDeletedIds, _.pluck(pageElements, 'pageElementId'));
                            localElementsToBeDeletedIds = _.uniq(localElementsToBeDeletedIds);
                        });
                    });
                }
                localStorageService.deleteAllPageElements(callback);
            };
        }

        return {
            'getPersistence': function(registerEventHandlerDescriptors) {
                return new Persistence(registerEventHandlerDescriptors);
            }
        }
    });