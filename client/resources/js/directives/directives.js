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
        return {
            restrict: 'E',
            template: '<div class="colleditPageDiv"></div>',
            replace: true,
            link: function(scope, element) {
                var d3 = d3Service.d3;
                var svg = d3.select(element[0])
                    .append('svg')
                        .attr('class', 'colleditPageSvg')
                        .style('width', presentationCfg.pageWidth + 'px')
                        .style('height', presentationCfg.pageHeight + 'px');

                //Append SVG groups (warning: order is important)
                var backgroundGroup = svg.append("g").attr("id", "backgroundGroup");
                var pageElementsGroup = svg.append("g").attr("id", "pageElementsGroup");

                //Draw clickable background
                backgroundGroup
                    .append('rect')
                        .attr('class', 'clickableBackground')
                        .attr('width', presentationCfg.pageWidth)
                        .attr('height', presentationCfg.pageHeight)
                        .on('click', function() {
                            var container = this;
                            scope.$apply(function() {
                                scope.handleBackgroundClick(d3.mouse(container));
                            });
                        });

                //Draw page elements whenever needed, grouped by type
                _.forEach(dataCfg.pageElementTypes, function(pageElementType) {
                    scope.$watchCollection('pageElements["' + pageElementType + '"]', function(newValue) {
                        if (angular.isArray(newValue)) {
                            drawPageElements(pageElementType);
                        }
                    });
                });

                //TODO replace this by deep collection watch
                scope.$on('pageElementsRefresh', function(event, pageElementTypeToRefresh) {
                    drawPageElements(pageElementTypeToRefresh);
                });

                var drawPageElements = function(pageElementTypeToRefresh) {
                    var pageElementTypesToRefresh = angular.isDefined(pageElementTypeToRefresh) ?
                        [pageElementTypeToRefresh] : dataCfg.pageElementTypes;
                    _.forEach(pageElementTypesToRefresh, function(pageElementType) {
                        drawPageElementsOfType(pageElementType);
                    });
                };

                var drawPageElementsOfType = function(pageElementType) {
                    var pageElements = pageElementsGroup.selectAll(".pageElement." + pageElementType)
                        .data(scope.pageElements[pageElementType]);

                    d3TransitionsService.fadeIn(
                        d3ComponentFactoryService.appendPageElementBasedOnType(pageElementType,
                            pageElements.enter())
                            .attr('class', 'pageElement ' + pageElementType)
                            .on('click', function(d) {
                                scope.$apply(function() {
                                    scope.selectPageElement(d);
                                    reDrawPageElements();
                                });
                            }),
                        presentationCfg.animations.pageElements);

                    reDrawPageElements(pageElementType, pageElements);

                    d3TransitionsService.fadeOutAndRemove(pageElements.exit(),
                        presentationCfg.animations.pageElements);
                };

                var reDrawPageElements = function(pageElementTypeToRefresh, pageElements) {
                    var pageElementTypesToRefresh = angular.isDefined(pageElementTypeToRefresh) ?
                        [pageElementTypeToRefresh] : dataCfg.pageElementTypes;
                    _.forEach(pageElementTypesToRefresh, function(pageElementType) {
                        reDrawPageElementsOfType(pageElementType, pageElements);
                    });
                };

                var reDrawPageElementsOfType = function(pageElementType, pageElements) {
                    if (!angular.isDefined(pageElements)) {
                        pageElements = pageElementsGroup.selectAll(".pageElement." + pageElementType)
                            .data(scope.pageElements[pageElementType]);
                    }
                    d3ComponentFactoryService.updatePageElementBasedOnType(pageElementType, pageElements)
                        .style('fill', function(pageElement) {
                            return scope.isPageElementSelected(pageElement) ?
                                presentationCfg.selectedPageElementColor : pageElement.fill });
                };
            }
        }
    });
