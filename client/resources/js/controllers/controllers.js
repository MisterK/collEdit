'use strict';

/**** Angular controllers ****/

angular.module('colledit.controllers', [])
    .controller('CollEditController', function($scope, pageElementsFactory, persistenceService, dataCfg, logService) {
        $scope.nextPageElementType = undefined;
        $scope.pageElements =  _.reduce(dataCfg.pageElementTypes, function(result, pageElementType) {
            result[pageElementType] = [];
            return result;
        }, {});
        $scope.selectedPageElement = undefined;
        $scope.pageElementProperties = {};
        $scope.textContentsInputDialogStyle = {
            display: 'none',
            top: '0px',
            left: '0px'
        };
        $scope.textContentsInput = '';

        $scope.setNextPageElementType = function(nextPageElementType) {
            $scope.nextPageElementType = nextPageElementType;
            var previouslySelectedElementType = clearPageElementSelection();
            requirePageElementsRefresh(previouslySelectedElementType);
        };

        $scope.handleBackgroundClick = function(clickCoordinates) {
            if (!angular.isDefined($scope.nextPageElementType)
                || !angular.isArray(clickCoordinates)
                || clickCoordinates.length < 2) {
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

        $scope.selectPageElement = function(pageElement) {
            $scope.selectedPageElement = pageElement;
            $scope.nextPageElementType = undefined;
            $scope.textContentsInputDialogStyle.display = 'none';
        };

        var clearPageElementSelection = function () {
            var previouslySelectedElementType = angular.isDefined($scope.selectedPageElement) ?
                $scope.selectedPageElement.pageElementType : undefined;
            $scope.selectedPageElement = undefined;
            $scope.textContentsInputDialogStyle.display = 'none';
            return previouslySelectedElementType;
        };

        $scope.isPageElementSelectedId = function(pageElementId) {
            return angular.isDefined($scope.selectedPageElement)
                && $scope.selectedPageElement.pageElementId == pageElementId;
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

        $scope.displayTextContentsInputDialog = function(pageElement) {
            pageElement = pageElement || $scope.selectedPageElement;
            if (angular.isDefined(pageElement)) {
                $scope.textContentsInputDialogStyle.display = 'block';
                $scope.textContentsInputDialogStyle.left = (pageElement.x - 100) + "px";
                $scope.textContentsInputDialogStyle.top = (pageElement.y + 20) + "px";
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
                $scope.textContentsInputDialogStyle.display = 'none';
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
        var pageElementSavedEventHandler = function(addedPageElement) {
            pageElementsFactory.augmentPageElement(addedPageElement);
            var indexOfAddedPageElement = _.findIndex($scope.pageElements[addedPageElement.pageElementType],
                function(pageElement) { return pageElement.pageElementId == addedPageElement.pageElementId; });
            if (indexOfAddedPageElement < 0) {
                logService.logDebug('Adding element "' + addedPageElement.pageElementId +
                    '" of type ' + addedPageElement.pageElementType + ' received from server');
                $scope.pageElements[addedPageElement.pageElementType].push(addedPageElement);
            } else {
                logService.logDebug('Updating element "' + addedPageElement.pageElementId +
                    '" of type ' + addedPageElement.pageElementType + ' received from server');
                $scope.pageElements[addedPageElement.pageElementType][indexOfAddedPageElement] = addedPageElement;
            }
        };
        var pageElementDeletedEventHandler = function(deletedPageElementId) {
            if (angular.isDefined(deletedPageElementId)) {
                logService.logDebug('Deleting element "' + deletedPageElementId +
                    '" received from server');
                _.forOwn($scope.pageElements, function(pageElementsForType) {
                    return _.remove(pageElementsForType, function(pageElement) {
                        return pageElement.pageElementId == deletedPageElementId;
                    }).length == 0;
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
        };
        var scopeApplyWrapper = function(eventHandlerCallback) {
          return function() {
              var passedArguments = arguments;
              $scope.$apply(function() {
                  eventHandlerCallback.apply(eventHandlerCallback, passedArguments);
              });
          };
        };
        var persistence = persistenceService.getPersistence(
            {'pageElementSaved': scopeApplyWrapper(pageElementSavedEventHandler),
                'pageElementDeleted': scopeApplyWrapper(pageElementDeletedEventHandler),
                'allPageElementsDeleted': scopeApplyWrapper(allPageElementsDeletedEventHandler)});

        //Initially get all locally-stored resources
        persistence.listPageElements(function(pageElements) {
            logService.logDebug('Listing all ' + pageElements.length + ' elements received from server');
            if (!angular.isArray(pageElements) || pageElements.length == 0) {
                return;
            }
            $scope.$apply(function() {
                _(pageElements).groupBy(function (pageElement) {
                    return pageElement.pageElementType;
                }).forEach(function (pageElementsByType, pageElementType) {
                        _.forEach(pageElementsByType, function (pageElement) {
                            pageElementsFactory.augmentPageElement(pageElement);
                            $scope.pageElements[pageElementType].push(pageElement);
                        });
                    });
            });
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