'use strict';

/**** Angular controllers ****/

angular.module('colledit.controllers', [])
    .controller('CollEditController', function($scope, pageElementsFactory, persistenceService, logService,
                                               doPageElementsIdsMatch) {
        $scope.pageElements = [];
        $scope.selectedPageElement = undefined;
        $scope.addDialogCoordinates = undefined;

        var hideAddDialog = function() {
            $scope.addDialogCoordinates = undefined;
        };

        $scope.handleBackgroundClick = function() {
            clearPageElementSelectionAndRefresh();
            hideAddDialog();
        };

        $scope.handleBackgroundDoubleClick = function(clickCoordinates) {
            if (angular.isArray(clickCoordinates) && clickCoordinates.length >= 2) {
                $scope.addDialogCoordinates = clickCoordinates;
            }
            clearPageElementSelectionAndRefresh();
        };

        var selectPageElement = function(pageElement) {
            clearPageElementSelectionAndRefresh();
            $scope.selectedPageElement = pageElement;
            hideAddDialog();
        };

        $scope.selectPageElementAndRefresh = function(pageElement) {
            selectPageElement(pageElement);
            requirePageElementDisplayRefresh(pageElement);
        };

        var clearPageElementSelection = function() {
            var previouslySelectedElement = angular.isObject($scope.selectedPageElement) ?
                $scope.selectedPageElement : undefined;
            $scope.selectedPageElement = undefined;
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

        $scope.addPageElement = function(pageElementType, clickCoordinates, pageElementProperties) {
            var newPageElement = pageElementsFactory.createPageElement(
                pageElementType, clickCoordinates, pageElementProperties || {});
            if (angular.isDefined(newPageElement)) {
                logService.logDebug('Created element "' + newPageElement.pageElementId +
                    '" of type ' + newPageElement.pageElementType);
                persistPageElement(newPageElement);
                selectPageElement(newPageElement);
            }
        };

        $scope.updatePageElement = function(pageElement) {
            if (angular.isDefined(pageElement)) {
                persistPageElement(pageElement);
                requirePageElementDisplayRefresh(pageElement);
            }
        };

        $scope.deletePageElement = function(pageElement) {
            if (angular.isDefined(pageElement)) {
                persistence.deletePageElement(pageElement);
            }
        };

        $scope.deleteAllPageElements = function() {
            persistence.deleteAllPageElements();
            hideAddDialog();
        };

        //Setup persistence
        var pageElementSavedEventHandler = function(savedPageElement, requireDisplayRefresh) {
            pageElementsFactory.augmentPageElement(savedPageElement);
            var matchSavedElementId = _.partial(doPageElementsIdsMatch, savedPageElement);
            var indexOfSavedPageElement = _.findIndex($scope.pageElements, matchSavedElementId);
            if (indexOfSavedPageElement < 0) {
                logService.logDebug('Adding element "' + savedPageElement.pageElementId +
                    '" of type ' + savedPageElement.pageElementType + ' received from server');
                $scope.pageElements.push(savedPageElement);
                if (requireDisplayRefresh !== false) {
                    requirePageElementDisplayAdding(savedPageElement);
                }
            } else {
                logService.logDebug('Updating element "' + savedPageElement.pageElementId +
                    '" of type ' + savedPageElement.pageElementType + ' received from server');
                $scope.pageElements[indexOfSavedPageElement] = savedPageElement;
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
                if (_.remove($scope.pageElements, matchDeletedElementId).length > 0) {
                    requirePageElementDisplayRemoval(deletedPageElementId);
                }
                if (isPageElementSelectedId(deletedPageElementId)) {
                    clearPageElementSelection();
                }
            }
        };
        var allPageElementsDeletedEventHandler = function() {
            logService.logDebug('Deleting all elements received from server');
            $scope.pageElements.length = 0;
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
    });