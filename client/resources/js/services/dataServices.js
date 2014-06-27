'use strict';

/**** Data-related angular services ****/

angular.module('colledit.dataAngularServices', [])
    /* Return the data management configuration */
    .constant('dataCfg', {
        'pageElements': {
            'defaultFill': 'black',
            'propertiesEnums': {
                'fill': ['black', 'red', 'blue', 'green'],
                'fontSize': ['10px', '12px', '14px', '16px'],
                'fontStyle': ['normal', 'italic', 'oblique'],
                'fontWeight': ['normal', 'bold', 'bolder', 'lighter'],
                'textDecoration': ['none', 'underline', 'overline', 'line-through', 'blink']
            },
            'propertiesDefaults': {
                'contents': 'Change me',
                'fontSize': '12px',
                'fontStyle': 'normal',
                'fontWeight': 'normal',
                'textDecoration': 'none',
                'radius': 20,
                'width': 40,
                'height': 20
            },
            sizeMultipliers: [0.5, 0.75, 1, 1.5, 2, 5]
        },
        pageElementTypes: ['svgText', 'svgCircle', 'svgRect']
    })
    .service('pageElementsFactory', function(dataCfg) {
        this.createPageElement = function(pageElementType, coordinates, params) {
            switch (pageElementType) {
                case 'svgText':
                    return new TextPageElement().init(coordinates, params);
                case 'svgCircle':
                    return new CirclePageElement().init(coordinates, params);
                case 'svgRect':
                    return new RectanglePageElement().init(coordinates, params);
            }
        };

        this.augmentPageElement = function(pageElement) {
            switch (pageElement.pageElementType) {
                case 'svgText':
                    _.mixin(pageElement, new TextPageElement);
                    break;
                case 'svgCircle':
                    _.mixin(pageElement, new CirclePageElement);
                    break;
                case 'svgRect':
                    _.mixin(pageElement, new RectanglePageElement);
                    break;

            }
        };

        var shiftInArray = function(array, currentValue) {
            var currentIndex = (_.findIndex(array, function(v) {return v == currentValue; }) || 0);
            return array[currentIndex < array.length -1 ? currentIndex + 1 : 0];
        };

        function PageElement() {
            this.fill = dataCfg.pageElements.defaultFill;
        }

        //TODO remove this
        PageElement.prototype.super_ = function(pageElementType, coordinates, params) {
            if (!angular.isDefined(params)) {
                params = {};
            }
            this.key = Math.round(Math.random() * 1000000);
            this.version = 0;
            this.pageElementType = pageElementType;
            this.x = coordinates[0];
            this.y = coordinates[1];
            this.togglableProperties = ['fill'];
            if (angular.isArray(params.togglableProperties)) {
                this.togglableProperties.push.apply(this.togglableProperties, params.togglableProperties);
            }
            this.isTextual = angular.isDefined(params.isTextual) ? params.isTextual : false;
            return this;
        };

        PageElement.prototype.toggleProperty = function(propertyName) {
            if (this.togglableProperties.indexOf(propertyName) < 0) {
                return;
            }
            if (angular.isArray(dataCfg.pageElements.propertiesEnums[propertyName])) {
                this[propertyName] = shiftInArray(dataCfg.pageElements.propertiesEnums[propertyName], this[propertyName]);
            } else {
                var defaultValue = dataCfg.pageElements.propertiesDefaults[propertyName];
                if (angular.isDefined(defaultValue)) {
                        this[propertyName] = shiftInArray(dataCfg.pageElements.sizeMultipliers,
                            Math.round(this[propertyName] / defaultValue)) * defaultValue;
                }
            }
        };

        function TextPageElement() {
            if (!(this instanceof TextPageElement)) return new TextPageElement();

            _.forEach(['contents', 'fontSize', 'fontStyle', 'fontWeight', 'textDecoration'],
                function(propertyName) {
                    this[propertyName] = dataCfg.pageElements.propertiesDefaults[propertyName];
                }, this);
        }

        TextPageElement.prototype = new PageElement;

        TextPageElement.prototype.init = function(coordinates, params) {
            params = _.extend({
                togglableProperties: ['fontSize', 'fontWeight', 'fontStyle', 'textDecoration'],
                isTextual: true
            }, params);
            this.super_('svgText', coordinates, params);
            return this;
        };

        TextPageElement.prototype.toggleSize = function() {
            this.toggleProperty('fontSize');
        };

        TextPageElement.prototype.changeTextContents = function(newContents) {
            this.contents = newContents;
        };

        function CirclePageElement() {
            if (!(this instanceof CirclePageElement)) return new CirclePageElement();

            this.radius = dataCfg.pageElements.propertiesDefaults['radius'];
        }

        CirclePageElement.prototype = new PageElement;

        CirclePageElement.prototype.init = function(coordinates, params) {
            params = _.extend({
                togglableProperties: ['radius']
            }, params);
            this.super_('svgCircle', coordinates, params);
            return this;
        };

        CirclePageElement.prototype.toggleSize = function() {
            this.toggleProperty('radius');
        };

        function RectanglePageElement() {
            if (!(this instanceof RectanglePageElement)) return new RectanglePageElement();

            this.width = dataCfg.pageElements.propertiesDefaults['width'];
            this.height = dataCfg.pageElements.propertiesDefaults['height'];
        }

        RectanglePageElement.prototype = new PageElement;

        RectanglePageElement.prototype.init = function(coordinates, params) {
            params = _.extend({
                togglableProperties: ['width', 'height']
            }, params);
            if (angular.isArray(coordinates) && coordinates.length >= 2) {
                coordinates[0] = coordinates[0] - this.width / 2;
                coordinates[1] = coordinates[1] - this.height / 2;
            }
            this.super_('svgRect', coordinates, params);
            return this;
        };

        RectanglePageElement.prototype.toggleSize = function() {
            this.toggleProperty('width');
            this.toggleProperty('height');
        };
    });