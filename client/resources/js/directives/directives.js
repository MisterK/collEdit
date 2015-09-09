'use strict';

/**** Board directive ****/

angular.module('colledit.directives', [])
    /* Directive: colleditPage
     * Goal: Creates the main colleditPage graphics
     * Usage: <colledit-page></colledit-page>
     * Dependencies:
     *  - presentationCfg: to access the global presentation configuration
     *  - d3Service: to access the d3 library object
     *  - d3ComponentFactoryService: to create or update pageElements
     *  - d3TransitionsService: to trigger D3 transition animations
     * Description: Creates the main colleditPage with D3
     */
    .directive('colleditPage', function(presentationCfg, d3Service, d3ComponentFactoryService, d3TransitionsService) {
        var d3 = d3Service.d3;

        var createRootSvgElement = function(rootElement) {
            return d3.select(rootElement[0])
                .append('svg')
                .attr('class', 'colleditPageSvg')
                .style('width', presentationCfg.pageWidth + 'px')
                .style('height', presentationCfg.pageHeight + 'px');
        };

        var drawClickableBackground = function(svgRootElement, scope) {
            svgRootElement
                .append("g")
                    .attr("id", "backgroundGroup")
                .append('rect')
                    .attr('class', 'clickableBackground')
                    .attr('width', presentationCfg.pageWidth)
                    .attr('height', presentationCfg.pageHeight)
                    .on('click', function() {
                        scope.$apply(function() {
                            scope.handleBackgroundClick();
                        });
                    })
                    .on('dblclick', function() {
                        var container = this;
                        scope.$apply(function() {
                            scope.handleBackgroundDoubleClick(d3.mouse(container));
                        });
                    });
        };

        var drawPageElementsGroup = function(svgRootElement) {
            return svgRootElement.append("g").attr("id", "pageElementsGroup");
        };

        var getPageElementCssSelection = function(pageElementSelection) {
            var selectionByPageElementId = angular.isObject(pageElementSelection.pageElement)
                ? pageElementSelection.pageElement.pageElementId : pageElementSelection.pageElementId;
            if (angular.isString(selectionByPageElementId)) {
                return "[id='" + selectionByPageElementId + "']";
            } else if (angular.isString(pageElementSelection.pageElementType)) {
                return ".pageElement." + pageElementSelection.pageElementType;
            } else {
                return ".pageElement";
            }
        };

        function selectPageElements(pageElementsGroup, cssSelection, data) {
            return pageElementsGroup.selectAll(cssSelection)
                .data(data, function(d) { return d.pageElementId; });
        }

        var drawPageElements = function(scope, pageElementsGroup, cssSelection, data) {
            var pageElements = selectPageElements(pageElementsGroup, cssSelection, data).enter();

            d3TransitionsService.fadeIn(
                d3ComponentFactoryService.appendPageElementBasedOnType(pageElements, scope.isPageElementSelected)
                    .on('click', function(d) {
                        scope.$apply(function() {
                            scope.selectPageElementAndRefresh(d);
                        });
                    }),
                presentationCfg.animations.pageElements);
        };

        var reDrawPageElements = function(scope, pageElementsGroup, cssSelection, data) {
            var pageElements = selectPageElements(pageElementsGroup, cssSelection, data);

            d3ComponentFactoryService.updatePageElementBasedOnType(pageElements, scope.isPageElementSelected);
        };

        var removePageElements = function(scope, pageElementsGroup, cssSelection) {
            var pageElements = selectPageElements(pageElementsGroup, cssSelection, []).exit();

            d3TransitionsService.fadeOutAndRemove(pageElements, presentationCfg.animations.pageElements);
        };

        return {
            restrict: 'E',
            template: '<div class="colleditPageDiv"></div>',
            replace: true,
            link: function(scope, element) {
                var svgRootElement = createRootSvgElement(element);

                //Append SVG groups (warning: order is important)
                drawClickableBackground(svgRootElement, scope);
                var pageElementsGroup = drawPageElementsGroup(svgRootElement);

                scope.$on('pageElementAdded', function(event, pageElement) {
                    var cssSelection = getPageElementCssSelection({pageElement: pageElement});
                    var data = angular.isObject(pageElement) ? [pageElement] : scope.pageElements;
                    drawPageElements(scope, pageElementsGroup, cssSelection, data);
                });

                scope.$on('pageElementRefresh', function(event, pageElement) {
                    var cssSelection = getPageElementCssSelection({pageElement: pageElement});
                    var data = angular.isObject(pageElement) ? [pageElement] : scope.pageElements;
                    reDrawPageElements(scope, pageElementsGroup, cssSelection, data);
                });

                scope.$on('pageElementDeleted', function(event, pageElementId) {
                    var cssSelection = getPageElementCssSelection({pageElementId: pageElementId});
                    removePageElements(scope, pageElementsGroup, cssSelection);
                });
            }
        }
    })

    /* Directive: colleditModifyPageElementDialog
     * Goal: Creates the modify pageElement dialog
     * Usage: <colledit-modify-page-element-dialog selected-page-element="selectedPageElement" update-callback="updatePageElement(pageElement)" delete-callback="deletePageElement(pageElement)"></colledit-modify-page-element-dialog>
     * Params:
     * 		- selected-page-element (required): the selectedPageElement to update/delete.
     * 		- update-callback (required): the callback to call when the selectedPageElement is to be updated.
     * 		- delete-callback (required): the callback to call when the selectedPageElement is to be deleted.
     * Dependencies:
     *  - dataCfg: to access the global data configuration
     *  - logService: to log on pageElementUpdate
     * Description: Creates the modify pageElement dialog
     */
    .directive('colleditModifyPageElementDialog', function(dataCfg, logService) {
        return {
            restrict: 'E',
            templateUrl: 'modifyControlsDialogTemplate',
            replace: true,
            scope: {
                'selectedPageElement': '=',
                'updateCallback': '&',
                'deleteCallback': '&'
            },
            link: function(scope) {
                scope.modifyControlsDialogStyle = {
                    top: '0px',
                    left: '0px'
                };
                scope.textContentsInput = '';
                scope.displayDialog = false;

                scope.$watch('selectedPageElement', function(newValue, oldValue) {
                    scope.displayDialog = angular.isObject(newValue);
                    if (angular.isObject(newValue) && newValue !== oldValue) {
                        scope.modifyControlsDialogStyle.left = Math.max(0, newValue.centerX - 81) + "px";
                        scope.modifyControlsDialogStyle.top = (newValue.centerY + 20) + "px";
                        if (scope.isTextualPageElement(newValue)) {
                            scope.textContentsInput = newValue.contents;
                        }
                    } else if (!angular.isObject(newValue)) {
                        scope.textContentsInput = '';
                    }
                });

                scope.isTextualPageElement = function(pageElement) {
                    pageElement = pageElement || scope.selectedPageElement;
                    return angular.isObject(pageElement) && pageElement.isTextual;
                };

                var updateProperty = function(propertyName, propertyValue) {
                    scope.selectedPageElement.updateProperty(propertyName, propertyValue);
                    if (angular.isFunction(scope.updateCallback)) {
                        scope.updateCallback({pageElement: scope.selectedPageElement});
                    }
                };

                scope.togglePageElementProperty = function(propertyName) {
                    if (angular.isObject(scope.selectedPageElement)) {
                        logService.logDebug('Toggling property "' + propertyName + '" of element "' +
                            scope.selectedPageElement.pageElementId + '" of type ' +
                            scope.selectedPageElement.pageElementType);
                        updateProperty(propertyName, dataCfg.togglePropertyValue);
                    }
                };

                scope.updatePageElementProperty = function(propertyName, propertyValue) {
                    if (angular.isObject(scope.selectedPageElement)) {
                        logService.logDebug('Updating property "' + propertyName + '" to "' + propertyValue +
                            '" of element "' + scope.selectedPageElement.pageElementId + '" of type ' +
                            scope.selectedPageElement.pageElementType);
                        updateProperty(propertyName, propertyValue);
                    }
                };

                scope.deletePageElement = function() {
                    if (angular.isObject(scope.selectedPageElement)
                        && angular.isFunction(scope.deleteCallback)) {
                        logService.logDebug('Deleting element "' + scope.selectedPageElement.pageElementId +
                            '" of type ' + scope.selectedPageElement.pageElementType);
                        scope.deleteCallback({pageElement: scope.selectedPageElement});
                    }
                };
            }
        };
    })

    /* Directive: colleditAddPageElementDialog
     * Goal: Creates the add pageElement dialog
     * Usage: <colledit-add-page-element-dialog dialog-coordinates="addDialogCoordinates" add-callback="addPageElement(pageElementType, clickCoordinates, pageElementProperties)" delete-all-callback="deleteAllPageElements()"></colledit-add-page-element-dialog>
     * Params:
     * 		- dialog-coordinates (required): The coordinates of the click that originated the dialog display.
     * 		- add-callback (required): the callback to call when a pageElement is to be added.
     * 		- delete-all-callback (required): the callback to call when all pageElements are to be deleted.
     * Dependencies:
     *  - logService: to log on add or deleteAll operations
     * Description: Creates the add pageElement dialog
     */
    .directive('colleditAddPageElementDialog', function(logService) {
        return {
            restrict: 'E',
            templateUrl: 'addControlsDialogTemplate',
            replace: true,
            scope: {
                'dialogCoordinates': '=',
                'addCallback': '&',
                'deleteAllCallback': '&'
            },
            link: function(scope) {
                scope.displayDialog = false;
                scope.addControlsDialogStyle = {
                    top: '0px',
                    left: '0px'
                };
                scope.pageElementProperties = {};

                scope.$watch('dialogCoordinates', function(newValue, oldValue) {
                    if (angular.isArray(newValue) && newValue.length >= 2 && newValue !== oldValue) {
                        scope.addControlsDialogStyle.left = Math.max(0, newValue[0] - 150) + "px";
                        scope.addControlsDialogStyle.top = Math.max(0, newValue[1] - 30) + "px";
                        scope.displayDialog = true;
                    } else if (!angular.isArray(newValue) || newValue.length < 2) {
                        scope.displayDialog = false;
                    }
                });

                scope.addPageElementOfType = function(pageElementType) {
                    if (angular.isFunction(scope.addCallback)
                        && angular.isArray(scope.dialogCoordinates) && scope.dialogCoordinates.length >= 2) {
                        scope.addCallback({ pageElementType: pageElementType, clickCoordinates: scope.dialogCoordinates,
                                pageElementProperties: scope.pageElementProperties});
                    }
                };

                scope.deleteAllPageElements = function() {
                    if (angular.isFunction(scope.deleteAllCallback)) {
                        logService.logDebug('Deleting all elements');
                        scope.deleteAllCallback();
                    }
                }
            }
        };
    });
