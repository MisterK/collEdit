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
                return new $window.Lawnchair({adapter: 'dom'}, callback);
            }
        };
    })
    .service('localStorageService', function(lawnchairService) {
        var lawnchairStorage = lawnchairService.getLawnchairStorage(_.noop);

        this.savePageElement = function(pageElement, callback) {
            lawnchairStorage.save(pageElement, callback);
        };

        this.deletePageElement = function(pageElementToDeleteId, callback) {
            lawnchairStorage.remove(pageElementToDeleteId, callback);
        };

        this.listAllPageElements = function(callback) {
            return lawnchairStorage.all(callback);
        };

        this.deleteAllPageElements = function(callback) {
            //TODO This clears the storage, but not the browser's localStorage
            return lawnchairStorage.nuke(callback);
        };
    })
    .factory('persistenceService', function(serverCommunicationService, localStorageService, logService) {
        function Persistence(registerEventHandlerDescriptors) {
            var connection = serverCommunicationService.getServerConnection();
            var localElementsToBePersistedIds = [],
                localElementsToBeDeletedIds = [];

            var pageElementSavedEventHandler = function(serverResponse) {
                logService.logDebug('Persistence: Saving element "' + serverResponse.pageElementId +
                    '" of type ' + serverResponse.pageElementType + ' received from server');

                localStorageService.savePageElement(serverResponse);

                if (angular.isDefined(registerEventHandlerDescriptors['pageElementSaved'])) {
                    registerEventHandlerDescriptors['pageElementSaved'](serverResponse);
                }
            };

            var pageElementDeletedEventHandler = function(serverResponse) {
                logService.logDebug('Persistence: Deleting element "' + serverResponse + '" received from server');
                localStorageService.deletePageElement(serverResponse);

                if (angular.isDefined(registerEventHandlerDescriptors['pageElementDeleted'])) {
                    registerEventHandlerDescriptors['pageElementDeleted'](serverResponse);
                }
            };

            var allPageElementsDeletedEventHandler = function(serverResponse) {
                logService.logDebug('Persistence: Deleting all elements received from server');
                localStorageService.deleteAllPageElements();

                if (angular.isDefined(registerEventHandlerDescriptors['allPageElementsDeleted'])) {
                    registerEventHandlerDescriptors['allPageElementsDeleted'](serverResponse);
                }
            };

            connection.connectToServerEventsWithListeners(
                {'pageElementSaved': pageElementSavedEventHandler,
                    'pageElementDeleted': pageElementDeletedEventHandler,
                    'allPageElementsDeleted': allPageElementsDeletedEventHandler});

            this.listPageElements = function(callback) {
                if (connection.isConnected) {
                    connection.listPageElements(function(pageElements) {
                        logService.logDebug('Persistence: Listing all ' + pageElements.length +
                            ' elements received from server');
                        if (angular.isArray(pageElements)) {
                            _.forEach(pageElements, function(pageElement) {
                                localStorageService.savePageElement(pageElement);
                            });
                        }
                        //TODO determine here which elements are not known from the server yet and try to persist them
                        localStorageService.listAllPageElements(callback);
                    }, function() {
                        logService.logError('Persistence: Listing all elements received' +
                            ' from server failed, defaulting to local storage');
                        localStorageService.listAllPageElements(callback);
                    });
                } else {
                    logService.logDebug('Not connected, listing elements from local storage');
                    localStorageService.listAllPageElements(callback);
                }
            };

            this.savePageElement = function(pageElement, callback) {
                if (connection.isConnected && localElementsToBePersistedIds.indexOf(pageElement.pageElementId) < 0) {
                    connection.savePageElement(pageElement, undefined, function() {
                        logService.logDebug('Persistence: Saving element "' + pageElement.pageElementId +
                            '" of type ' + pageElement.pageElementType + ' has failed, storing it for later');
                        localElementsToBePersistedIds.push(pageElement.pageElementId);
                        localStorageService.savePageElement(pageElement, callback);
                    });
                } else {
                    if (localElementsToBePersistedIds.indexOf(pageElement.pageElementId) < 0) {
                        logService.logDebug('Persistence: Saving element "' + pageElement.pageElementId +
                            '" of type ' + pageElement.pageElementType + ', storing save for later');
                        localElementsToBePersistedIds.push(pageElement.pageElementId);
                    }
                    logService.logDebug('Persistence: Saving element "' + pageElement.pageElementId +
                        '" when not connected');
                    localStorageService.savePageElement(pageElement, callback);
                }
            };

            this.deletePageElement = function(pageElement, callback) {
                if (connection.isConnected && localElementsToBeDeletedIds.indexOf(pageElement.pageElementId) < 0) {
                    connection.deletePageElement(pageElement, undefined, function() {
                        logService.logDebug('Persistence: Deleting element "' + pageElement.pageElementId +
                            '" of type ' + pageElement.pageElementType + ' has failed, storing deletion for later');
                        localElementsToBeDeletedIds.push(pageElement.pageElementId);
                        localStorageService.deletePageElement(pageElement.pageElementId, callback);
                    });
                } else {
                    if (localElementsToBeDeletedIds.indexOf(pageElement.pageElementId) < 0) {
                        logService.logDebug('Persistence: Deleting element "' + pageElement.pageElementId +
                            '" of type ' + pageElement.pageElementType + ', storing deletion for later');
                        localElementsToBeDeletedIds.push(pageElement.pageElementId);
                    }
                    logService.logDebug('Persistence: Deleting element "' + pageElement.pageElementId +
                        '" when not connected');
                    localStorageService.deletePageElement(pageElement.pageElementId, callback);
                }
            };

            var deletingAllPageElementsAndStoringThemForLaterReconciliation = function() {
                localStorageService.listAllPageElements(function (pageElements) {
                    localElementsToBeDeletedIds.push.apply(
                        localElementsToBeDeletedIds, _.pluck(pageElements, 'pageElementId'));
                    localElementsToBeDeletedIds = _.uniq(localElementsToBeDeletedIds);
                });
                localStorageService.deleteAllPageElements(callback);
            };

            this.deleteAllPageElements = function(callback) {
                if (connection.isConnected) {
                    connection.deleteAllPageElements(undefined, function() {
                        logService.logDebug('Persistence: Deleting all elements has failed, storing deletions for later');
                        deletingAllPageElementsAndStoringThemForLaterReconciliation();
                    });
                } else {
                    logService.logDebug('Persistence: Deleting all elements when not connected, storing deletions for later');
                    deletingAllPageElementsAndStoringThemForLaterReconciliation();
                }
            };
        }

        return {
            'getPersistence': function(registerEventHandlerDescriptors) {
                return new Persistence(registerEventHandlerDescriptors);
            }
        }
    });