'use strict';

/**** Angular controllers ****/

angular.module('colledit.controllers', [])
    .controller('CollEditController', function($scope, pageElementsFactory, persistenceService, dataCfg) {
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
            $scope.clearPageElementSelection();
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
                $scope.selectPageElement(newPageElement);
                $scope.pageElements[newPageElement.pageElementType].push(newPageElement);
                persistPageElement(newPageElement);
            }
        };

        $scope.selectPageElement = function(pageElement) {
            $scope.selectedPageElement = pageElement;
            $scope.nextPageElementType = undefined;
            $scope.textContentsInputDialogStyle.display = 'none';
        };

        $scope.clearPageElementSelection = function () {
            $scope.selectedPageElement = undefined;
            $scope.textContentsInputDialogStyle.display = 'none';
            requirePageElementsRefresh();
        };

        $scope.isPageElementSelected = function(pageElement) {
            return $scope.selectedPageElement === pageElement;
        };

        $scope.isTextualPageElement = function(pageElement) {
            pageElement = pageElement || $scope.selectedPageElement;
            return angular.isDefined(pageElement) && pageElement.isTextual;
        };

        $scope.togglePageElementProperty = function(propertyName, pageElement) {
            pageElement = pageElement || $scope.selectedPageElement;
            if (angular.isDefined(pageElement)) {
                pageElement.toggleProperty(propertyName);
                pageElementUpdated(pageElement);
            }
        };

        $scope.togglePageElementSize = function(pageElement) {
            pageElement = pageElement || $scope.selectedPageElement;
            if (angular.isDefined(pageElement)
                && angular.isFunction(pageElement.toggleSize)) {
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
                pageElement.changeTextContents($scope.textContentsInput);
                pageElementUpdated(pageElement);
                $scope.textContentsInput = '';
                $scope.textContentsInputDialogStyle.display = 'none';
            }
        };

        $scope.deletePageElement = function(pageElement) {
            pageElement = pageElement || $scope.selectedPageElement;
            if (angular.isDefined(pageElement)) {
                $scope.pageElements[pageElement.pageElementType] =
                    _.pull($scope.pageElements[pageElement.pageElementType], pageElement);
                persistence.deletePageElement(pageElement);
                if (pageElement === $scope.selectedPageElement) {
                    $scope.selectedPageElement = undefined;
                }
            }
        };

        $scope.deleteAllPageElements = function() {
            _($scope.pageElements).values().forEach(function(pageElementsByType) {
                pageElementsByType.length = 0;
            });
            persistence.deleteAllPageElements();
        };

        //Setup persistence
        var updatePageElementEventHandler = function(addedPageElement) {
            var indexOfAddedPageElement = _.indexOf($scope.pageElements[addedPageElement.pageElementType],
                function(pageElement) { return pageElement.key == addedPageElement.key; });
            if (indexOfAddedPageElement < 0) {
                $scope.pageElements[addedPageElement.pageElementType].push(addedPageElement);
            } else {
                $scope.pageElements[addedPageElement.pageElementType][indexOfAddedPageElement] = addedPageElement;
                requirePageElementsRefresh(addedPageElement.pageElementType);
            }
        };
        var deletePageElementEventHandler = function(deletedPageElement) {
            if (angular.isDefined(deletedPageElement)) {
                $scope.deletePageElement(deletedPageElement);
            }
        };
        var persistence = persistenceService.getPersistence(
            {'updatePageElement': updatePageElementEventHandler,
                'deletePageElement': deletePageElementEventHandler});

        //Initially get all locally-stored resources
        persistence.listPageElements(function(pageElements) {
            if (!angular.isArray(pageElements) || pageElements.length == 0) {
                return;
            }
            _(pageElements).groupBy(function (pageElement) { return pageElement.pageElementType; })
                .forEach(function(pageElementsByType, pageElementType) {
                    _.forEach(pageElementsByType, function(pageElement) {
                        pageElementsFactory.augmentPageElement(pageElement);
                        $scope.pageElements[pageElementType].push(pageElement);
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