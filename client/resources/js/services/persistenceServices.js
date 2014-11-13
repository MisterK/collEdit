'use strict';

/**** Lawnchair-related angular services ****/

angular.module('colledit.persistenceServices', [])
    /* Return the persistence configuration */
    .constant('persistenceCfg', {
        'persistPageElementsOutOfSyncRefreshTime': 5000,
        'deletePageElementsOutOfSyncRefreshTime': 5000
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

        this.getPageElement = function(pageElementId, callback) {
            lawnchairStorage.get(pageElementId, callback);
        };

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
            return lawnchairStorage.nuke(callback);
        };
    })
    .factory('persistenceService', function(persistenceCfg, serverCommunicationService, localStorageService,
                                            logService, doPageElementsIdsMatch) {
        function Persistence(registerEventHandlerDescriptors) {
            var connection = serverCommunicationService.getServerConnection();
            var localElementsToBePersistedIds = [],
                localElementsToBeDeletedIds = [];

            var getWrappedEventHandlerDescriptor = function(eventHandlerDescriptorKey) {
                var eventHandlerDescriptor = registerEventHandlerDescriptors[eventHandlerDescriptorKey];
                if (angular.isDefined(eventHandlerDescriptor)) {
                    if (angular.isDefined(eventHandlerDescriptor.scopeApplyWrapper)) {
                        return eventHandlerDescriptor.scopeApplyWrapper;
                    } else {
                        return eventHandlerDescriptor;
                    }
                }
            };

            var executeWrappedEventHandlerDescriptor = function(eventHandlerDescriptorKey, serverResponse) {
                var wrappedEventHandlerDescriptor = getWrappedEventHandlerDescriptor(eventHandlerDescriptorKey);
                if (angular.isDefined(wrappedEventHandlerDescriptor)) {
                    wrappedEventHandlerDescriptor(serverResponse);
                }
            };

            var pageElementSavedEventHandler = function(serverResponse) {
                logService.logDebug('Persistence: Saving element "' + serverResponse.pageElementId +
                    '" of type ' + serverResponse.pageElementType + ' received from server');

                localStorageService.savePageElement(serverResponse);

                executeWrappedEventHandlerDescriptor('pageElementSaved', serverResponse);
            };

            var pageElementDeletedEventHandler = function(serverResponse) {
                logService.logDebug('Persistence: Deleting element "' + serverResponse + '" received from server');
                localStorageService.deletePageElement(serverResponse);

                executeWrappedEventHandlerDescriptor('pageElementDeleted', serverResponse);
            };

            var allPageElementsDeletedEventHandler = function(serverResponse) {
                logService.logDebug('Persistence: Deleting all elements received from server');
                localStorageService.deleteAllPageElements();

                executeWrappedEventHandlerDescriptor('allPageElementsDeleted', serverResponse);
            };

            connection.connectToServerEventsWithListeners(
                {'pageElementSaved': pageElementSavedEventHandler,
                    'pageElementDeleted': pageElementDeletedEventHandler,
                    'allPageElementsDeleted': allPageElementsDeletedEventHandler});

            var persistPageElementsOutOfSync = function() {
                if (connection.isConnected && localElementsToBePersistedIds.length > 0) {
                    logService.logDebug('Persistence: Sending save requests to server for elements out of sync');
                    _.forEach(localElementsToBePersistedIds, function(localElementToBePersistedId) {
                        localStorageService.getPageElement(localElementToBePersistedId, function(localElementToBePersisted) {
                            if (angular.isDefined(localElementToBePersisted) && localElementToBePersisted != null) {
                                savePageElementInServer(localElementToBePersisted, false);
                            } else {
                                var matchElementToPersist = _.partial(doPageElementsIdsMatch, localElementToBePersistedId);
                                _.remove(localElementsToBePersistedIds, matchElementToPersist);
                            }
                        });
                    });
                }
            };
            setInterval(persistPageElementsOutOfSync, persistenceCfg.persistPageElementsOutOfSyncRefreshTime);

            var deletePageElementsOutOfSync = function() {
                if (connection.isConnected && localElementsToBeDeletedIds.length > 0) {
                    logService.logDebug('Persistence: Sending delete requests to server for elements out of sync');
                    _.forEach(localElementsToBeDeletedIds, function(localElementToBeDeletedId) {
                        deletePageElementInServer(localElementToBeDeletedId, false);
                    });
                }
            };
            setInterval(deletePageElementsOutOfSync, persistenceCfg.deletePageElementsOutOfSyncRefreshTime);

            this.listPageElements = function(callback) {
                if (connection.isConnected) {
                    connection.listPageElements(function(serverPageElements) {
                        logService.logDebug('Persistence: Listing all ' + serverPageElements.length +
                            ' elements received from server');
                        if (angular.isArray(serverPageElements)) {
                            _.forEach(serverPageElements, function(serverPageElement) {
                                if (localElementsToBeDeletedIds.indexOf(serverPageElement.pageElementId) < 0) {
                                    localStorageService.savePageElement(serverPageElement);
                                }
                            });
                        }
                        //TODO When implemented in the server, get list of deleted elements ids from the server and schedule them for deletion, or remove them from localElementsToBePersistedIds
                        localStorageService.listAllPageElements(function(localPageElements) {
                            _.forEach(localPageElements, function(localPageElement) {
                                var matchLocalElementId = _.partial(doPageElementsIdsMatch, localPageElement);
                                if (!angular.isDefined(_.find(serverPageElements, matchLocalElementId))
                                    && localElementsToBePersistedIds.indexOf(localPageElement.pageElementId) < 0) {
                                    //Determine here which elements are not known from the server yet, and schedule them for persistence
                                    localElementsToBePersistedIds.push(localPageElement.pageElementId);
                                }
                                //TODO When versioning implemented, determine here which updated elements are not updated yet from the server yet and schedule them for persistence
                            });
                            (callback || _.noop)(localPageElements);
                        });
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

            var savePageElementInServer = function(pageElementToSave, storeLocallyOnFailure) {
                connection.savePageElement(pageElementToSave, function() {
                    var matchElementToSave = _.partial(doPageElementsIdsMatch, pageElementToSave);
                    _.remove(localElementsToBePersistedIds, matchElementToSave);
                }, function() {
                    if (storeLocallyOnFailure) {
                        logService.logDebug('Persistence: Saving element "' + pageElement.pageElementId +
                            '" of type ' + pageElement.pageElementType + ' has failed, storing it for later');
                        localElementsToBePersistedIds.push(pageElement.pageElementId);
                        localStorageService.savePageElement(pageElement,
                            getWrappedEventHandlerDescriptor('pageElementSaved'));
                    }
                });
            };
            this.savePageElement = function(pageElement) {
                if (connection.isConnected && localElementsToBePersistedIds.indexOf(pageElement.pageElementId) < 0) {
                    savePageElementInServer(pageElement, true);
                } else {
                    if (localElementsToBePersistedIds.indexOf(pageElement.pageElementId) < 0) {
                        logService.logDebug('Persistence: Saving element "' + pageElement.pageElementId +
                            '" of type ' + pageElement.pageElementType + ', storing save for later');
                        localElementsToBePersistedIds.push(pageElement.pageElementId);
                    }
                    logService.logDebug('Persistence: Saving element "' + pageElement.pageElementId +
                        '" when not connected');
                    localStorageService.savePageElement(pageElement,
                        registerEventHandlerDescriptors['pageElementSaved']);
                }
            };

            var deletePageElementWrapper = function(callback, deletedPageElementId) {
                return function() {
                    if (angular.isDefined(callback)) {
                        callback(deletedPageElementId);
                    }
                }
            };

            var deletePageElementInServer = function(pageElementToDeleteId, storeLocallyOnFailure) {
                connection.deletePageElement(pageElementToDeleteId, function() {
                    var matchElementToDeleteId = _.partial(doPageElementsIdsMatch, pageElementToDeleteId);
                    _.remove(localElementsToBeDeletedIds, matchElementToDeleteId);
                }, function() {
                    if (storeLocallyOnFailure) {
                        logService.logDebug('Persistence: Deleting element "' + pageElementToDeleteId +
                            ' has failed, storing deletion for later');
                        localElementsToBeDeletedIds.push(pageElementToDeleteId);
                        localStorageService.deletePageElement(pageElementToDeleteId,
                            deletePageElementWrapper(getWrappedEventHandlerDescriptor('pageElementDeleted'),
                                pageElementToDeleteId));
                    }
                });
            };
            this.deletePageElement = function(pageElement) {
                if (connection.isConnected && localElementsToBeDeletedIds.indexOf(pageElement.pageElementId) < 0) {
                    deletePageElementInServer(pageElement.pageElementId, true);
                } else {
                    if (localElementsToBeDeletedIds.indexOf(pageElement.pageElementId) < 0) {
                        logService.logDebug('Persistence: Deleting element "' + pageElement.pageElementId +
                            '" of type ' + pageElement.pageElementType + ', storing deletion for later');
                        localElementsToBeDeletedIds.push(pageElement.pageElementId);
                    }
                    logService.logDebug('Persistence: Deleting element "' + pageElement.pageElementId +
                        '" when not connected');
                    localStorageService.deletePageElement(pageElement.pageElementId,
                        deletePageElementWrapper(registerEventHandlerDescriptors['pageElementDeleted'],
                            pageElement.pageElementId));
                }
                //Remove for elements to be persisted anyway
                var matchElementToDelete = _.partial(doPageElementsIdsMatch, pageElement);
                _.remove(localElementsToBePersistedIds, matchElementToDelete);
            };

            var deletingAllPageElementsAndStoringThemForLaterReconciliation = function(callback) {
                localStorageService.listAllPageElements(function (pageElements) {
                    localElementsToBeDeletedIds.push.apply(
                        localElementsToBeDeletedIds, _.pluck(pageElements, 'pageElementId'));
                    localElementsToBeDeletedIds = _.uniq(localElementsToBeDeletedIds);
                });
                localStorageService.deleteAllPageElements(callback);
            };

            this.deleteAllPageElements = function() {
                if (connection.isConnected) {
                    connection.deleteAllPageElements(undefined, function() {
                        logService.logDebug('Persistence: Deleting all elements has failed, storing deletions for later');
                        deletingAllPageElementsAndStoringThemForLaterReconciliation(
                            getWrappedEventHandlerDescriptor('allPageElementsDeleted'));
                    });
                } else {
                    logService.logDebug('Persistence: Deleting all elements when not connected, storing deletions for later');
                    deletingAllPageElementsAndStoringThemForLaterReconciliation(
                        registerEventHandlerDescriptors['allPageElementsDeleted']);
                }
            };
        }

        return {
            'getPersistence': function(registerEventHandlerDescriptors) {
                return new Persistence(registerEventHandlerDescriptors);
            }
        }
    });