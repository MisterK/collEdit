'use strict';

/**** Board directive ****/

angular.module('colledit.directives', [])
    /* Directive: colleditPage
     * Goal: Creates the main colleditPage graphics
     * Usage: <colledit-page></colledit-page>
     * Dependencies:
     *  - d3Service: to access the d3 library object
     * Description: Creates the main colleditPage with D3
     */
    .directive('colleditPage', function(presentationCfg, dataCfg, d3Service,
                                        d3ComponentFactoryService, d3TransitionsService) {
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
                    .on('click', function () {
                        var container = this;
                        scope.$apply(function () {
                            scope.handleBackgroundClick(d3.mouse(container));
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
                .data(data, function (d) { return d.pageElementId; });
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
    });
