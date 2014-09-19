'use strict';

/**** Angular controllers ****/

angular.module('colledit.controllers', [])
    .controller('CollEditController', function($scope, pageElementsFactory, persistenceService, dataCfg, logService,
                                               doesPageElementIdMatch, arePageElementsIdsEqual) {
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
                $scope.selectPageElement(newPageElement);
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

        $scope.selectPageElement = function(pageElement) {
            $scope.selectedPageElement = pageElement;
            $scope.nextPageElementType = undefined;
            if ($scope.isTextualPageElement(pageElement)) {
                $scope.textContentsInput = pageElement.contents;
            }
            displayModifyControlsDialog(pageElement);
        };

        var clearPageElementSelection = function () {
            var previouslySelectedElementType = angular.isDefined($scope.selectedPageElement) ?
                $scope.selectedPageElement.pageElementType : undefined;
            $scope.selectedPageElement = undefined;
            $scope.textContentsInput = '';
            return previouslySelectedElementType;
        };

        function clearPageElementSelectionAndRefresh() {
            var previouslySelectedElementType = clearPageElementSelection();
            if (angular.isDefined(previouslySelectedElementType)) {
                requirePageElementsRefresh(previouslySelectedElementType);
            }
        }

        $scope.isPageElementSelectedId = function(pageElementId) {
            return angular.isDefined($scope.selectedPageElement)
                && doesPageElementIdMatch(pageElementId, $scope.selectedPageElement);
        };

        $scope.isPageElementSelected = function(pageElement) {
            return $scope.isPageElementSelectedId(pageElement.pageElementId);
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
        var pageElementSavedEventHandler = function(savedPageElement) {
            pageElementsFactory.augmentPageElement(savedPageElement);
            var matchSavedElementId = _.partial(arePageElementsIdsEqual, savedPageElement);
            var indexOfSavedPageElement = _.findIndex($scope.pageElements[savedPageElement.pageElementType],
                matchSavedElementId);
            if (indexOfSavedPageElement < 0) {
                logService.logDebug('Adding element "' + savedPageElement.pageElementId +
                    '" of type ' + savedPageElement.pageElementType + ' received from server');
                $scope.pageElements[savedPageElement.pageElementType].push(savedPageElement);
            } else {
                logService.logDebug('Updating element "' + savedPageElement.pageElementId +
                    '" of type ' + savedPageElement.pageElementType + ' received from server');
                $scope.pageElements[savedPageElement.pageElementType][indexOfSavedPageElement] = savedPageElement;
                if ($scope.isPageElementSelected(savedPageElement)) {
                    $scope.selectPageElement(savedPageElement); //Re-select it to update edit dialog
                }
            }
        };
        var pageElementDeletedEventHandler = function(deletedPageElementId) {
            if (angular.isDefined(deletedPageElementId)) {
                logService.logDebug('Deleting element "' + deletedPageElementId +
                    '" received from server');
                var matchDeletedElementId = _.partial(doesPageElementIdMatch, deletedPageElementId);
                _.forOwn($scope.pageElements, function(pageElementsForType) {
                    return _.remove(pageElementsForType, matchDeletedElementId).length == 0;
                });

                if ($scope.isPageElementSelectedId(deletedPageElementId)) {
                   clearPageElementSelection();
                }
            }
        };
        var allPageElementsDeletedEventHandler = function() {
            logService.logDebug('Deleting all elements received from server');
            _($scope.pageElements).values().forEach(function(pageElementsByType) {
                pageElementsByType.length = 0;
            });
            clearPageElementSelection();
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
                'allPageElementsDeleted': augmentWithScopeApplyWrapper(allPageElementsDeletedEventHandler)});

        //Initially get all locally-stored resources
        persistence.listPageElements(function(pageElements) {
            logService.logDebug('Listing all ' + pageElements.length + ' elements received from server');
            if (!angular.isArray(pageElements) || pageElements.length == 0) {
                return;
            }
            //TODO to remove? $scope.$apply(function() {
                _(pageElements).groupBy(function (pageElement) {
                    return pageElement.pageElementType;
                }).forEach(function (pageElementsByType, pageElementType) {
                        _.forEach(pageElementsByType, function (pageElement) {
                            pageElementsFactory.augmentPageElement(pageElement);
                            $scope.pageElements[pageElementType].push(pageElement);
                        });
                    });
            //});
        });

        var persistPageElement = function(pageElement) {
            persistence.savePageElement(pageElement);
        };

        var requirePageElementsRefresh = function(pageElementTypeToRefresh) {
            $scope.$broadcast('pageElementsRefresh', pageElementTypeToRefresh);
        };

        var pageElementUpdated = function(pageElement) {
            persistPageElement(pageElement);
            requirePageElementsRefresh(pageElement.pageElementType);
        };
    });