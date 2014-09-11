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
            return lawnchairStorage.nuke(callback);
        };
    })
    .factory('persistenceService', function(serverCommunicationService, localStorageService, logService) {
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
                        //TODO determine here which updated elements are not updated yet from the server yet and try to update them
                        //TODO determine here which deleted elements are not deleted yet from the server yet and try to delete them
                        //TODO get list of deleted elements ids from the server and delete them here if necessary
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

            this.savePageElement = function(pageElement) {
                if (connection.isConnected && localElementsToBePersistedIds.indexOf(pageElement.pageElementId) < 0) {
                    connection.savePageElement(pageElement, undefined, function() {
                        logService.logDebug('Persistence: Saving element "' + pageElement.pageElementId +
                            '" of type ' + pageElement.pageElementType + ' has failed, storing it for later');
                        localElementsToBePersistedIds.push(pageElement.pageElementId);
                        localStorageService.savePageElement(pageElement,
                            getWrappedEventHandlerDescriptor('pageElementSaved'));
                    });
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
            }
            this.deletePageElement = function(pageElement) {
                if (connection.isConnected && localElementsToBeDeletedIds.indexOf(pageElement.pageElementId) < 0) {
                    connection.deletePageElement(pageElement, undefined, function() {
                        logService.logDebug('Persistence: Deleting element "' + pageElement.pageElementId +
                            '" of type ' + pageElement.pageElementType + ' has failed, storing deletion for later');
                        localElementsToBeDeletedIds.push(pageElement.pageElementId);
                        localStorageService.deletePageElement(pageElement.pageElementId,
                            deletePageElementWrapper(getWrappedEventHandlerDescriptor('pageElementDeleted'),
                                pageElement.pageElementId));
                    });
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