'use strict';

/**** Angular controllers ****/

angular.module('colledit.controllers', [])
    .controller('CollEditController', function($scope, pageElementsFactory, persistenceService, dataCfg, logService,
                                               doPageElementsIdsMatch) {
        $scope.nextPageElementType = undefined;
        $scope.pageElements =  _.reduce(dataCfg.pageElementTypes, function(result, pageElementType) {
            result[pageElementType] = [];
            return result;
        }, {});
        $scope.selectedPageElement = undefined;
        $scope.pageElementProperties = {};
        $scope.modifyControlsDialogStyle = {
            top: '0px',
            left: '0px'
        };
        $scope.textContentsInput = '';

        $scope.setNextPageElementType = function(nextPageElementType) {
            $scope.nextPageElementType = nextPageElementType;
            clearPageElementSelectionAndRefresh();
        };

        $scope.handleBackgroundClick = function(clickCoordinates) {
            if (!angular.isDefined($scope.nextPageElementType)
                || !angular.isArray(clickCoordinates)
                || clickCoordinates.length < 2) {
                clearPageElementSelectionAndRefresh();
                return;
            }
            var newPageElement = pageElementsFactory.createPageElement(
                    $scope.nextPageElementType,
                    clickCoordinates,
                    $scope.pageElementProperties);
            if (angular.isDefined(newPageElement)) {
                logService.logDebug('Created element "' + newPageElement.pageElementId +
                    '" of type ' + newPageElement.pageElementType);
                selectPageElement(newPageElement);
                persistPageElement(newPageElement);
            }
        };

        var displayModifyControlsDialog = function(pageElement) {
            pageElement = pageElement || $scope.selectedPageElement;
            if (angular.isDefined(pageElement)) {
                $scope.modifyControlsDialogStyle.left = (pageElement.centerX - 81) + "px";
                $scope.modifyControlsDialogStyle.top = (pageElement.centerY + 20) + "px";
            }
        };

        var selectPageElement = function(pageElement) {
            clearPageElementSelectionAndRefresh();
            $scope.selectedPageElement = pageElement;
            $scope.nextPageElementType = undefined;
            if ($scope.isTextualPageElement(pageElement)) {
                $scope.textContentsInput = pageElement.contents;
            }
            displayModifyControlsDialog(pageElement);
        };

        $scope.selectPageElementAndRefresh = function(pageElement) {
            selectPageElement(pageElement);
            requirePageElementDisplayRefresh(pageElement);
        };

        var clearPageElementSelection = function() {
            var previouslySelectedElement = angular.isObject($scope.selectedPageElement) ?
                $scope.selectedPageElement : undefined;
            $scope.selectedPageElement = undefined;
            $scope.textContentsInput = '';
            return previouslySelectedElement;
        };

        var clearPageElementSelectionAndRefresh = function() {
            var previouslySelectedElement = clearPageElementSelection();
            if (angular.isObject(previouslySelectedElement)) {
                requirePageElementDisplayRefresh(previouslySelectedElement);
            }
        };

        var isPageElementSelectedId = function(pageElementId) {
            return angular.isDefined($scope.selectedPageElement)
                && doPageElementsIdsMatch(pageElementId, $scope.selectedPageElement);
        };

        $scope.isPageElementSelected = function(pageElement) {
            return isPageElementSelectedId(pageElement.pageElementId);
        };

        $scope.isTextualPageElement = function(pageElement) {
            pageElement = pageElement || $scope.selectedPageElement;
            return angular.isDefined(pageElement) && pageElement.isTextual;
        };

        $scope.togglePageElementProperty = function(propertyName, pageElement) {
            pageElement = pageElement || $scope.selectedPageElement;
            if (angular.isDefined(pageElement)) {
                logService.logDebug('Toggling property "' + propertyName + '" of element "' +
                    pageElement.pageElementId + '" of type ' + pageElement.pageElementType);
                pageElement.toggleProperty(propertyName);
                pageElementUpdated(pageElement);
            }
        };

        $scope.togglePageElementSize = function(pageElement) {
            pageElement = pageElement || $scope.selectedPageElement;
            if (angular.isDefined(pageElement)
                && angular.isFunction(pageElement.toggleSize)) {
                logService.logDebug('Toggling size of element "' + pageElement.pageElementId +
                    '" of type ' + pageElement.pageElementType);
                pageElement.toggleSize();
                pageElementUpdated(pageElement);
            }
        };

        $scope.changeTextPageElementsContents = function(pageElement) {
            pageElement = pageElement || $scope.selectedPageElement;
            if (angular.isDefined(pageElement) && angular.isDefined($scope.textContentsInput)
                && angular.isFunction(pageElement.changeTextContents)) {
                logService.logDebug('Changing text contents of element "' + pageElement.pageElementId +
                    '" of type ' + pageElement.pageElementType);
                pageElement.changeTextContents($scope.textContentsInput);
                pageElementUpdated(pageElement);
                $scope.textContentsInput = '';
            }
        };

        $scope.deletePageElement = function(pageElement) {
            pageElement = pageElement || $scope.selectedPageElement;
            if (angular.isDefined(pageElement)) {
                logService.logDebug('Deleting element "' + pageElement.pageElementId +
                    '" of type ' + pageElement.pageElementType);
                persistence.deletePageElement(pageElement);
            }
        };

        $scope.deleteAllPageElements = function() {
            logService.logDebug('Deleting all elements');
            persistence.deleteAllPageElements();
        };

        //Setup persistence
        var pageElementSavedEventHandler = function(savedPageElement, requireDisplayRefresh) {
            pageElementsFactory.augmentPageElement(savedPageElement);
            var matchSavedElementId = _.partial(doPageElementsIdsMatch, savedPageElement);
            var indexOfSavedPageElement = _.findIndex($scope.pageElements[savedPageElement.pageElementType],
                matchSavedElementId);
            if (indexOfSavedPageElement < 0) {
                logService.logDebug('Adding element "' + savedPageElement.pageElementId +
                    '" of type ' + savedPageElement.pageElementType + ' received from server');
                $scope.pageElements[savedPageElement.pageElementType].push(savedPageElement);
                if (requireDisplayRefresh !== false) {
                    requirePageElementDisplayAdding(savedPageElement);
                }
            } else {
                logService.logDebug('Updating element "' + savedPageElement.pageElementId +
                    '" of type ' + savedPageElement.pageElementType + ' received from server');
                $scope.pageElements[savedPageElement.pageElementType][indexOfSavedPageElement] = savedPageElement;
                if ($scope.isPageElementSelected(savedPageElement)) {
                    selectPageElement(savedPageElement); //Re-select it to update edit dialog
                }
                if (requireDisplayRefresh !== false) {
                    requirePageElementDisplayRefresh(savedPageElement);
                }
            }
        };
        var pageElementDeletedEventHandler = function(deletedPageElementId) {
            if (angular.isDefined(deletedPageElementId)) {
                logService.logDebug('Deleting element "' + deletedPageElementId +
                    '" received from server');
                var matchDeletedElementId = _.partial(doPageElementsIdsMatch, deletedPageElementId);
                _.forOwn($scope.pageElements, function(pageElementsForType) {
                    var wasFound = _.remove(pageElementsForType, matchDeletedElementId).length > 0;
                    if (wasFound) {
                        requirePageElementDisplayRemoval(deletedPageElementId);
                    }
                    return !wasFound;
                });

                if (isPageElementSelectedId(deletedPageElementId)) {
                   clearPageElementSelection();
                }
            }
        };
        var allPageElementsDeletedEventHandler = function() {
            logService.logDebug('Deleting all elements received from server');
            _($scope.pageElements).values().forEach(function(pageElementsByType) {
                pageElementsByType.length = 0;
            });
            requireAllPageElementsDisplayRemoval();
            clearPageElementSelection();
        };
        var allPageElementsListedEventHandler = function(pageElements) {
             if (!angular.isArray(pageElements) || pageElements.length == 0) {
                logService.logDebug('No page elements received from server or local storage');
                 return;
             }
             logService.logDebug('Listing all ' + pageElements.length +
                ' elements received from server or local storage');
             _(pageElements).forEach(function(pageElement) {
                 pageElementSavedEventHandler(pageElement, false);
             });
            requireAllPageElementsDisplayAdding();
         };
        var augmentWithScopeApplyWrapper = function(eventHandlerCallback) {
          eventHandlerCallback.scopeApplyWrapper = function() {
              var passedArguments = arguments;
              $scope.$apply(function() {
                  eventHandlerCallback.apply(eventHandlerCallback, passedArguments);
              });
          };
          return eventHandlerCallback;
        };
        var persistence = persistenceService.getPersistence(
            {'pageElementSaved': augmentWithScopeApplyWrapper(pageElementSavedEventHandler),
                'pageElementDeleted': augmentWithScopeApplyWrapper(pageElementDeletedEventHandler),
                'allPageElementsDeleted': augmentWithScopeApplyWrapper(allPageElementsDeletedEventHandler),
                'allPageElementsListed': augmentWithScopeApplyWrapper(allPageElementsListedEventHandler)});

        var persistPageElement = function(pageElement) {
            persistence.savePageElement(pageElement);
        };

        var requirePageElementDisplayAdding = function(pageElementToAdd) {
            $scope.$broadcast('pageElementAdded', pageElementToAdd);
        };

        var requireAllPageElementsDisplayAdding = function() {
            requirePageElementDisplayAdding();
        };

        var requirePageElementDisplayRefresh = function(pageElementToRefresh) {
            $scope.$broadcast('pageElementRefresh', pageElementToRefresh);
        };

        var requireAllPageElementsDisplayRemoval = function() {
            requirePageElementDisplayRemoval();
        };

        var requirePageElementDisplayRemoval = function(deletedPageElementId) {
            $scope.$broadcast('pageElementDeleted', deletedPageElementId);
        };

        var pageElementUpdated = function(pageElement) {
            persistPageElement(pageElement);
            requirePageElementDisplayRefresh(pageElement);
        };
    });