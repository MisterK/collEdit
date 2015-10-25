'use strict';

/**** Data-related angular services ****/

angular.module('colledit.dataAngularServices', [])
    /* Return the data management configuration */
    .constant('dataCfg', {
        'pageElements': {
            'defaultFill': 'black',
            'propertiesEnums': {
                'fill': ['black', 'red', 'blue', 'green'],
                'fontSize': ['12px', '14px', '18px', '24px'],
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
        pageElementTypes: ['svgText', 'svgCircle', 'svgRect'],
        togglePropertyValue: '__TOGGLE__'
    })
    .constant('doPageElementsIdsMatch', function(pageElementOrId1, pageElementOrId2) {
        var pageElementId1 = angular.isObject(pageElementOrId1) ? pageElementOrId1.pageElementId : pageElementOrId1;
        var pageElementId2 = angular.isObject(pageElementOrId2) ? pageElementOrId2.pageElementId : pageElementOrId2;
        return pageElementId1 === pageElementId2;
    })
    .service('pageElementsFactory', function(dataCfg) {
        this.createPageElement = function(pageElementType, coordinates, params) {
            switch (pageElementType) {
                case 'svgText':
                    return new TextPageElement(coordinates, params);
                case 'svgCircle':
                    return new CirclePageElement(coordinates, params);
                case 'svgRect':
                    return new RectanglePageElement(coordinates, params);
            }
        };

        var assignAndMixin = function(pageElement, typeObject) {
            _.assign(pageElement, typeObject, function(value, other) {
                return angular.isUndefined(value) && angular.isDefined(other) ? other : value;
            });
            _.mixin(pageElement, typeObject);
        };

        this.augmentPageElement = function(pageElement) {
            switch (pageElement.pageElementType) {
                case 'svgText':
                    assignAndMixin(pageElement, new TextPageElement());
                    break;
                case 'svgCircle':
                    assignAndMixin(pageElement, new CirclePageElement());
                    break;
                case 'svgRect':
                    assignAndMixin(pageElement, new RectanglePageElement());
                    break;
            }
        };

        var shiftInArray = function(array, currentValue) {
            var currentIndex = (_.findIndex(array, function(v) {return v == currentValue; }) || 0);
            return array[currentIndex < array.length -1 ? currentIndex + 1 : 0];
        };

        var uuid = function() {
            var s4 = function() {
                return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
            };
            return (s4()+s4()+"-"+s4()+"-"+s4()+"-"+s4()+"-"+s4()+s4()+s4());
        };

        var compose = function() { //Thanks to http://javascript.boxsheep.com/how-to-javascript/How-to-write-a-compose-function/
            var fn = arguments, origLength = fn.length;
            return function() {
                var thisObject = this, length = origLength;
                return (function recursion(arg) {
                    var newArgs = (arguments.length == 1 && angular.isArray(arguments[0]) ? arguments[0] : arguments);
                    return length ? recursion(fn[--length].apply(thisObject, newArgs)) : arg;
                }).apply(thisObject, arguments);
            };
        };

        var oooInherit = function(parentConstructorFn, preParentConstructionFn, postParentConstructionFn) {
            var childConstructorFn = compose(postParentConstructionFn, parentConstructorFn, preParentConstructionFn);
            childConstructorFn.prototype = _.create(parentConstructorFn.prototype, {'constructor': childConstructorFn});
            return childConstructorFn;
        };

        var PageElement = function(coordinates, params) {
            //Transient properties
            this.transientPropertiesNames = ['transientPropertiesNames', 'togglableProperties',
                'isTextual', 'aliasedProperties'];
            if (angular.isArray(params.transientPropertiesNames)) {
                this.transientPropertiesNames.push.apply(this.transientPropertiesNames, params.transientPropertiesNames);
            }
            this.togglableProperties = ['fill'];
            if (angular.isArray(params.togglableProperties)) {
                this.togglableProperties.push.apply(this.togglableProperties, params.togglableProperties);
            }
            this.isTextual = angular.isDefined(params.isTextual) ? params.isTextual : false;
            this.aliasedProperties = {};
            if (angular.isObject(params.aliasedProperties)) {
                this.aliasedProperties = _.extend(this.aliasedProperties, params.aliasedProperties);
            }

            if (!angular.isDefined(coordinates) || !angular.isDefined(params)) {
                return this;
            }

            this.pageElementId = uuid();
            this.key = this.pageElementId;
            this.version = 0;
            this.x = coordinates[0];
            this.y = coordinates[1];
            this.fill = dataCfg.pageElements.defaultFill;

            return this;
        };

        PageElement.prototype.updateProperty = function(originalPropertyName, propertyValue) {
            var propertiesToUpdate = angular.isArray(this.aliasedProperties[originalPropertyName])
                ? this.aliasedProperties[originalPropertyName] : [originalPropertyName];
            _.forEach(propertiesToUpdate, function(propertyName) {
                if (dataCfg.togglePropertyValue === propertyValue) {
                    this.toggleProperty(propertyName);
                } else {
                    //TODO validate it's an expected propertyName?
                    this[propertyName] = propertyValue;
                }
            }, this);
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

        PageElement.prototype.getPersistableObject = function() {
            return _.omit(this, this.transientPropertiesNames || []);
        };

        var TextPageElement = oooInherit(PageElement,
            function(coordinates, params) {
                this.pageElementType = 'svgText';

                var newParams = _.extend({
                    togglableProperties: ['fontSize', 'fontWeight', 'fontStyle', 'textDecoration'],
                    isTextual: true,
                    aliasedProperties: {'size': ['fontSize']}
                }, params);

                return [coordinates, newParams];
            },
            function() {
                _.forEach(['contents', 'fontSize', 'fontStyle', 'fontWeight', 'textDecoration'],
                    function(propertyName) {
                        this[propertyName] = dataCfg.pageElements.propertiesDefaults[propertyName];
                    }, this);

                this.centerX = this.x;
                this.centerY = this.y;

                return this;
            }
        );

        var CirclePageElement = oooInherit(PageElement,
            function(coordinates, params) {
                this.pageElementType = 'svgCircle';

                var newParams =_.extend({
                    togglableProperties: ['radius'],
                    aliasedProperties: {'size': ['radius']}
                }, params);

                return [coordinates, newParams];
            },
            function() {
                this.radius = dataCfg.pageElements.propertiesDefaults['radius'];
                this.centerX = this.x;
                this.centerY = this.y;

                return this;
            }
        );

        var RectanglePageElement = oooInherit(PageElement,
            function(coordinates, params) {
                this.pageElementType = 'svgRect';

                this.width = dataCfg.pageElements.propertiesDefaults['width'];
                this.height = dataCfg.pageElements.propertiesDefaults['height'];

                if (angular.isArray(coordinates) && coordinates.length >= 2) {
                    this.centerX = coordinates[0];
                    this.centerY = coordinates[1];
                    coordinates[0] = coordinates[0] - (this.width / 2);
                    coordinates[1] = coordinates[1] - (this.height / 2);
                }

                var newParams = _.extend({
                    togglableProperties: ['width', 'height'],
                    aliasedProperties: {'size': ['width', 'height']}
                }, params);

                return [coordinates, newParams];
            },
            function() {
                return this;
            }
        );
    });