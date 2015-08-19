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
    .service('d3ComponentFactoryService', function(presentationCfg) {
        var thisService = this;
        var elementTypeToTagNameMapping = {
            'svgText': 'text',
            'svgCircle': 'circle',
            'svgRect': 'rect'
        };

        this.appendPageElementBasedOnType = function(d3Element, isSelectedCallback) {
            var resultingD3Element = d3Element
                .append(function(pageElement) {
                    var tagName = elementTypeToTagNameMapping[pageElement.pageElementType] || 'unknown';
                    return document.createElementNS('http://www.w3.org/2000/svg', tagName);
                })
                .attr('id', getter('pageElementId'))
                .attr('class', function(pageElement) {
                    return 'pageElement ' + pageElement.pageElementType;
                });
            return thisService.updatePageElementBasedOnType(resultingD3Element, isSelectedCallback);
        };

        this.updatePageElementBasedOnType = function(d3Element, isSelectedCallback) {
            return d3Element.each(function(pageElement) {
                var thisElement = d3.select(this);
                switch (pageElement.pageElementType) {
                    case 'svgText':
                        thisElement = updateSVGTextPageElement(thisElement);
                        break;
                    case 'svgCircle':
                        thisElement = updateSVGCirclePageElement(thisElement);
                        break;
                    case 'svgRect':
                        thisElement = updateSVGRectanglePageElement(thisElement);
                        break;
                    default :
                        return d3Element;
                }
                return thisElement.style('fill', function(pageElement) {
                    return isSelectedCallback(pageElement) ? presentationCfg.selectedPageElementColor : pageElement.fill;
                });
            });
        };

        var getter = function(propertyName) {
            return function(pageElement) { return pageElement[propertyName]; }
        };

        var updateSVGTextPageElement = function(d3Element) {
            return d3Element
                .attr('x', getter('x'))
                .attr('y', getter('y'))
                .text(getter('contents'))
                .style('text-anchor', 'middle')
                .style('font-size', getter('fontSize'))
                .style('font-style', getter('fontStyle'))
                .style('font-weight', getter('fontWeight'))
                .style('text-decoration', getter('textDecoration'));
        };

        var updateSVGCirclePageElement = function(d3Element) {
            return d3Element
                .attr('cx', getter('x'))
                .attr('cy', getter('y'))
                .attr('r', getter('radius'));
        };

        var updateSVGRectanglePageElement = function(d3Element) {
            return d3Element
                .attr('x', getter('x'))
                .attr('y', getter('y'))
                .attr('width', getter('width'))
                .attr('height', getter('height'));
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
