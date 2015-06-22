'use strict';

/**** D3-related angular services ****/

angular.module('colledit.d3AngularServices', [])
    /* Return the presentation layer configuration */
    .constant('presentationCfg', {
        'pageWidth': 800,
        'pageHeight': 600,
        'animations': {
            'pageElements': true,
            'singleElementDelay': 50,
            'longDuration': 1000,
            'shortDuration': 500,
            'veryLongDuration': 2000
        },
        'selectedPageElementColor': 'yellow'
    })
    /* Wrapper to the D3 singleton */
    .factory('d3Service', function($window) {
        if (!angular.isDefined($window.d3)) {
            throw "D3 library doesn't seem included in page"
        }
        return {d3: $window.d3};
    })
    /* Service to build and append D3 elements */
    .service('d3ComponentFactoryService', function() {
        var thisService = this;
        this.appendPageElementBasedOnType = function(pageElementType, d3Element) {
            var resultingD3Element;
            switch (pageElementType) {
                case 'svgText':
                    resultingD3Element = appendSVGTextPageElement(d3Element);
                    break;
                case 'svgCircle':
                    resultingD3Element = appendSVGCirclePageElement(d3Element);
                      break;
                case 'svgRect':
                    resultingD3Element = appendSVGRectanglePageElement(d3Element);
                      break;
                default :
                    resultingD3Element = appendPageElementOfUnknownType(d3Element);
            }
            resultingD3Element
                .attr('id', getter('pageElementId'));
            return thisService.updatePageElementBasedOnType(pageElementType, resultingD3Element);
        };

        this.updatePageElementBasedOnType = function(pageElementType, d3Element) {
            var resultingD3Element;
            switch (pageElementType) {
                case 'svgText':
                    resultingD3Element = updateSVGTextPageElement(d3Element);
                    break;
                case 'svgCircle':
                    resultingD3Element = updateSVGCirclePageElement(d3Element);
                    break;
                case 'svgRect':
                    resultingD3Element = updateSVGRectanglePageElement(d3Element);
                    break;
                default :
                    return d3Element;
            }
            return resultingD3Element;
        };

        var getter = function(propertyName) {
            return function(pageElement) { return pageElement[propertyName]; }
        };

        var appendSVGTextPageElement = function(d3Element) {
            return d3Element
                .append('text')
                .style('text-anchor', 'middle');
        };

        var updateSVGTextPageElement = function(d3Element) {
            return d3Element
                .attr('x', getter('x'))
                .attr('y', getter('y'))
                .text(getter('contents'))
                .style('font-size', getter('fontSize'))
                .style('font-style', getter('fontStyle'))
                .style('font-weight', getter('fontWeight'))
                .style('text-decoration', getter('textDecoration'));
        };

        var appendSVGCirclePageElement = function(d3Element) {
            return d3Element
                .append('circle');
        };

        var updateSVGCirclePageElement = function(d3Element) {
            return d3Element
                .attr('cx', getter('x'))
                .attr('cy', getter('y'))
                .attr('r', getter('radius'));
        };

        var appendSVGRectanglePageElement = function(d3Element) {
            return d3Element
                .append('rect');
        };

        var updateSVGRectanglePageElement = function(d3Element) {
            return d3Element
                .attr('x', getter('x'))
                .attr('y', getter('y'))
                .attr('width', getter('width'))
                .attr('height', getter('height'));
        };

        var appendPageElementOfUnknownType = function(d3Element) {
            return d3Element
                .append('unknown');
        };
    })
    /* Service to animate the adding and removing of D3 elements */
    .service('d3TransitionsService', function(presentationCfg) {
        this.fadeIn = function(d3Element, animate, delayFn) {
            if (!angular.isDefined(delayFn)) {
                delayFn = function() { return 0; };
            }
            if (animate) {
                return d3Element
                    .attr('opacity', 0)
                    .transition()
                        .attr('opacity', 1)
                        .duration(presentationCfg.animations.shortDuration)
                        .delay(delayFn);
            } else {
                return d3Element;
            }
        };

        this.fadeOutAndRemove = function(d3Element, animate, delayFn, removeElementAtEnd) {
            if (!angular.isDefined(removeElementAtEnd)) {
                removeElementAtEnd = true;
            }
            if (!angular.isDefined(delayFn)) {
                delayFn = function() { return 0; };
            }
            if (animate) {
                return d3Element
                    .attr('opacity', 1)
                    .transition()
                        .attr('opacity', 0)
                        .duration(presentationCfg.animations.shortDuration)
                        .delay(delayFn)
                        .each("end", function() {
                            if (removeElementAtEnd) {
                                d3.select(this).remove();
                            }
                        });
            } else {
                return d3Element.remove();
            }
        };
    });
