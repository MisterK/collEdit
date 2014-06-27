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
        var lawnchairStorage = lawnchairService.getLawnchairStorage(
            function() { });

        this.savePageElement = function(pageElement, callback) {
            lawnchairStorage.save(pageElement, callback);
        };

        this.deletePageElement = function(pageElement, callback) {
            lawnchairStorage.remove(pageElement.key, callback);
        };

        this.getPageElement = function(pageElementKey, callback) {
            return lawnchairStorage.get(pageElementKey, callback);
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
            var localElementsToBePersistedKeys = [],
                localElementsToBeDeletedKeys = [];

            var updatePageElementEventHandler = function (serverResponse) {
                localStorageService.savePageElement(serverResponse.pageElement);

                if (angular.isDefined(registerEventHandlerDescriptors['updatePageElement'])) {
                    registerEventHandlerDescriptors['updatePageElement'](serverResponse);
                }
            };

            var deletePageElementEventHandler = function (serverResponse) {
                localStorageService.deletePageElement(serverResponse.pageElement);

                if (angular.isDefined(registerEventHandlerDescriptors['deletePageElement'])) {
                    registerEventHandlerDescriptors['deletePageElement'](serverResponse);
                }
            };

            connection.connectToServerEventsWithListeners(
                {'updatePageElement': updatePageElementEventHandler,
                    'deletePageElement': deletePageElementEventHandler});

            this.getPageElement = function (pageElementKey, callback) {
                if (connection.isConnected
                    && localElementsToBePersistedKeys.indexOf(pageElement.key) < 0
                    && localElementsToBeDeletedKeys.indexOf(pageElement.key) < 0) {
                    connection.getPageElement(pageElementKey, function (pageElement) {
                        localStorageService.savePageElement(pageElement);
                        callback(pageElement);
                    }, function (error) {
                        localStorageService.getPageElement(pageElementKey, callback);
                    });
                } else {
                    localStorageService.getPageElement(pageElementKey, callback);
                }
            };

            this.listPageElements = function (callback) {
                if (connection.isConnected) {
                    connection.listPageElements(function (pageElements) {
                        _.forEach(pageElements, function (pageElement) {
                            localStorageService.savePageElement(pageElement);
                        });
                        callback(pageElements);
                    }, function (error) {
                        localStorageService.listAllPageElements(callback);
                    });
                } else {
                    localStorageService.listAllPageElements(callback);
                }
            };

            this.savePageElement = function (pageElement, callback) {
                if (connection.isConnected && localElementsToBePersistedKeys.indexOf(pageElement.key) < 0) {
                    connection.savePageElement(pageElement, undefined, function (error) {
                        localElementsToBePersistedKeys.push(pageElement.key);
                    });
                }
                localStorageService.savePageElement(pageElement, callback);
            };

            this.deletePageElement = function (pageElement, callback) {
                if (connection.isConnected && localElementsToBeDeletedKeys.indexOf(pageElement.key) < 0) {
                    connection.deletePageElement(pageElement, undefined, function (error) {
                        localElementsToBeDeletedKeys.push(pageElement.key);
                    });
                }
                localStorageService.deletePageElement(pageElement, callback);
            };

            this.deleteAllPageElements = function (callback) {
                if (connection.isConnected) {
                    connection.deleteAllPageElements(undefined, function (error) {
                        localStorageService.listAllPageElements(function (pageElements) {
                            localElementsToBeDeletedKeys.push.apply(
                                localElementsToBeDeletedKeys, _.pluck(pageElements, 'key'));
                            localElementsToBeDeletedKeys = _.uniq(localElementsToBeDeletedKeys);
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