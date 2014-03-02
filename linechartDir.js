'use strict';

var chartsModule = angular.module('charts.directives', []);

chartsModule.directive('ngLinechart', [function() {

    return {
        restrict: 'A',
        transclude: true,
        scope: {
            title: '@',
            uom: '@',
            ylabel: '@',
            xlabel: '@',
            yOffset: '@',
            topMargin: '@',
            rightMargin: '@',
            leftMargin: '@',
            bottomMargin: '@',
            lineStroke: '@',
            lineWidth: '@',
            areaStroke: '@',
            areaWidth: '@',
            areaFill: '@',
            focusFill: '@',
            focusStroke: '@',
            focusWidth: '@',
            animTime: '@',
            updateInterval: '@',
            loadDataFn: '&'
        },
        replace: true,
        template: '<div class="chart">' +
                    '<div class="chart-title">' +
                        '<p>{{title}}</p>' +
                    '</div>' +
                    '<div class="chart-area chart-loading"></div>' +
                  '</div>',
        controller: ['$scope', function($scope) {

            // Used to distinghish between first loading and updates
            $scope.firstLoading = true;
            $scope.firstView = true;
            $scope.bisectDate = d3.bisector(function(d) { return d.t; }).left;

            $scope.getData = function()
            {   
                $scope.loadDataFn()                             // Call the generic data retrieval function
                    .then(function(d) {

                        if(d === undefined || d == null || d.length == 0 || d[_.first( _.keys(d) )].length == 0)
                        {
                            $($scope.block).prepend('<div class="chart-error">No data</div>');
                        }
                        else
                        {
                            $scope.data = d[_.first(_.keys(d))];     // select the first object
                        }                        

                        // Disable the first loading animation
                        $($scope.block).removeClass('chart-loading');

                        // Disable the re-loading animation
                        setTimeout(function() {
                            $($scope.block).parent().find('.chart-title').removeClass('chart-reloading'); 
                        }, $scope.animTime);

                    }).catch(function(res) {
                        console.log('Error retrieving data for the directive');
                        $($scope.block).prepend('<div class="chart-error">No data</div>');
                    });
            }

            // Generates the y grid lines
            $scope.make_y_axis = function()
            {
                return d3.svg.axis()
                    .scale($scope.y)
                    .orient("left")
                    .ticks(6)
            }

            // Mouse movement handling
            $scope.mouseMove = function()
            {

                var x0 = $scope.x.invert(d3.mouse(this)[0]),
                    i = $scope.bisectDate($scope.data, x0, 1),
                    dl = $scope.data[i - 1],
                    dr = $scope.data[i],
                    d;
                // Check the consistency of the calculation
                if(dl !== undefined && dr !== undefined && 
                    i !== undefined && x0 !== undefined)
                {
                    d = x0 - dl.t > dr.t - x0 ? dr : dl;

                    // Move the highlighted point
                    var x_pos = $scope.x(d.t);
                    var val_pos = $scope.y(d.med);
                    $scope.focus.select('circle').attr('transform', 'translate(' + x_pos + ',' + val_pos + ')');
                    $scope.focus.select('line').attr('y1', val_pos);
                    $scope.focus.select('line').attr('transform', 'translate(' + x_pos + ',0)');
                    $scope.focus.select('text.ttip').attr('transform', 'translate(' + x_pos + ',' + val_pos + ')').text(d.med + ' ' + $scope.uom);
                    
                    // adjust text anchor depending on size and position to not overlap to the y axes
                    var timetip = $scope.focus.select('text.timetip');
                    timetip.attr('x', x_pos).text($scope.dateFormatter(d.t));
                    var l = $scope.focus.select('text.timetip').node().getComputedTextLength();
                    if((x_pos - l) <= 0) {
                        timetip.attr('text-anchor', 'start')
                            .attr('dx', '4px');
                    }
                    else {
                        timetip.attr('text-anchor', 'end')
                            .attr('dx', '-4px');
                    }
                }
            }

            $scope.startUpdate = function()
            {   
                $($scope.block).find('.chart-error').remove();
                
                // Starts the loading animation
                $($scope.block).parent().find('.chart-title').addClass('chart-reloading');
                // Reload data via AJAX
                $scope.getData();
                
                if($scope.firstLoading)
                    $scope.firstLoading = false;
            }

            $scope.redraw = function(animTime)
            {   
                if(animTime === undefined)
                    animTime = $scope.animTime;

                // Recalculate X Axis
                $scope.width = $($scope.block).width() - $scope.margin.left - $scope.margin.right;
                $scope.x = d3.time.scale().range([0, $scope.width]);

                $scope.xAxis = d3.svg.axis().scale($scope.x)
                .orient('bottom')
                .ticks(6)
                .tickSize(3)
                .outerTickSize(0)
                .tickFormat(d3.time.format('%H:%M'));

                // Scale the entire svg area
                d3.select($scope.block).select('svg')
                    .attr('width', $scope.width + $scope.margin.left + $scope.margin.right);

                // Scale the label positions
                d3.select($scope.block).select('.toptext')
                    .attr('x', ($scope.width / 2));

                d3.select($scope.block).select('.x-axis-label')
                    .attr('transform', 'translate(' + ($scope.width/2) + ',' + ($scope.height + $scope.margin.bottom) + ')')

                // Scale the range of the data
                $scope.x.domain(d3.extent($scope.data, function(d) { return d.t; }));
                $scope.y.domain([d3.min($scope.data, function(d) { return d.min; }) - $scope.yOffset, 
                          d3.max($scope.data, function(d) { return d.max; })]);

                var svg = d3.select($scope.block).transition();

                // Update the sensitive area
                svg.select('.overlay').transition()
                    .duration(animTime)
                    .attr('width', $scope.width);

                // Redraw min-max area
                svg.select('.area').transition()
                    .duration(animTime)
                    .attr('d', $scope.area($scope.data));

                // Redraw Value Line
                svg.select('.valueline').transition()
                    .duration(animTime)
                    .attr('d', $scope.valueline($scope.data));

                // Redraw Points
                var dots = d3.select($scope.block).selectAll('.chart-point')
                    .data($scope.data)
                    .attr('cx', function(d) { return $scope.x(d.t) })
                    .attr('cy', function(d) { return $scope.y(d.med) })
                    .style('opacity', 0);
                dots.enter().append('circle')
                    .attr('r', 2.5)
                    .attr('cx', function(d) { return $scope.x(d.t) })
                    .attr('cy', function(d) { return $scope.y(d.med) })
                    .attr('class', 'chart-point')
                    .style('opacity', 0)
                    .style('stroke', $scope.lineStroke);
                dots.exit().remove();
                svg.selectAll('.chart-point').transition()
                    .duration(animTime)
                    .style('opacity', 1);
                
                // Last reading on top
                svg.select('tspan.chart-last-value').transition()
                    .duration(animTime)
                    .text(_.last($scope.data).med + ' ' + $scope.uom + ' ');
                svg.select('tspan.chart-last-date').transition()
                    .duration(animTime)
                    .text('(' + $scope.dateFormatter(_.last($scope.data).t) + ')');
                
                // Redraw X Axis
                svg.select('g .x').transition()
                    .duration(animTime)
                    .call($scope.xAxis);

                // Redraw Y Axis
                svg.select('g .y').transition()
                    .duration(animTime)
                    .call($scope.yAxis);

                // Redraw Y grid
                svg.select("g .grid").transition()
                    .duration(animTime)
                    .call($scope.make_y_axis()
                        .tickSize(-$scope.width, 0, 0)
                        .tickFormat("")
                    );
            }

            // Configure the periodic chart update
            setInterval($scope.startUpdate, $scope.updateInterval);

            // Workaround: update the charts when the Dashboard view is first opened
            $scope.$on('navbarClick', function(e, data) {
                if(data !== undefined && data == 'dashboard' && $scope.firstView == true) {
                    setTimeout(function() { $scope.redraw(0); }, 0);
                    $scope.firstView = false;
                }
            });
        }],
        link: function(scope, element, opts, ctrl)
        {

            // Initialization
            scope.margin = {
                top: parseInt(scope.topMargin),
                right: parseInt(scope.rightMargin),
                bottom: parseInt(scope.bottomMargin),
                left: parseInt(scope.leftMargin)
            };
            scope.block = $(element[0]).find('.chart-area')[0];

            // input validation
            if(scope.block == null || scope.uom === undefined || scope.margin === undefined)
            {
                console.log('Unable to initialize chart. Missing parameters.');
                return;
            }

            scope.dateFormatter = d3.time.format('%d/%m/%y %H:%M:%S');

            scope.width = $(scope.block).width() - scope.margin.left - scope.margin.right;
            scope.height = $(scope.block).height() - scope.margin.top - scope.margin.bottom - 20; // 10 margin

            scope.x = d3.time.scale().range([0, scope.width]);
            scope.y = d3.scale.linear().range([scope.height, 0]);

            scope.xAxis = d3.svg.axis().scale(scope.x)
                .orient('bottom')
                .ticks(6)
                .tickSize(3)
                .outerTickSize(0)
                .tickFormat(d3.time.format('%H:%M'));

            scope.yAxis = d3.svg.axis().scale(scope.y)
                .orient('left')
                .ticks(6)
                .tickSize(3)
                .outerTickSize(0);

            scope.area = d3.svg.area()
                .interpolate('monotone')
                .x(function(d) { return scope.x(d.t); })
                .y0(function(d) { return scope.y(d.min) })
                .y1(function(d) { return scope.y(d.max) });

            scope.valueline = d3.svg.line()
                .interpolate('monotone')
                .x(function(d) { return scope.x(d.t); })
                .y(function(d) { return scope.y(d.med); });

            scope.svg =  d3.select(scope.block)
                .append('svg')
                    .attr('width', scope.width + scope.margin.left + scope.margin.right)
                    .attr('height', scope.height + scope.margin.top + scope.margin.bottom)
                .append('g')
                    .attr('transform', 'translate(' + scope.margin.left + ',' + scope.margin.top + ')');

            // Load data via AJAX
            scope.getData();

            scope.$watch('data', function(newdata)
            {
                if(newdata && newdata !== undefined && newdata != null && newdata.length > 0)
                {   
                    /* First chart drawing */
                    if(scope.firstLoading)
                    {
                        // Draw the chart
                        scope.x.domain(d3.extent(scope.data, function(d) { return d.t; }));
                        scope.y.domain([d3.min(scope.data, function(d) { return d.min; }) - scope.yOffset, 
                                  d3.max(scope.data, function(d) { return d.max; })]);

                        // Y axis lines
                        scope.svg.append("g")         
                            .attr("class", "grid")
                            .call(scope.make_y_axis()
                                .tickSize(-scope.width, 0, 0)
                                .tickFormat("")
                            )

                        // Draw background min-max area
                        scope.svg.append('path')
                            .datum(scope.data)
                            .attr('class', 'area')
                            .attr('d', scope.area)
                            .style('fill', scope.areaFill)
                            .style('stroke', scope.areaStroke)
                            .style('stroke-width', scope.areaWidth);

                        // Draw value line
                        scope.svg.append('path')
                            .attr('class', 'valueline')
                            .attr('d', scope.valueline(scope.data))
                            .style('stroke', scope.lineStroke)
                            .style('stroke-width', scope.lineWidth);

                        // X Axis
                        scope.svg.append('g')
                            .attr('class', 'x axis chart-axes-ticks')
                            .attr('transform', 'translate(0,' + scope.height + ')')
                            .call(scope.xAxis);

                        // Y Axis
                        scope.svg.append('g')
                            .attr('class', 'y axis chart-axes-ticks')
                            .call(scope.yAxis);

                        // X Axis label
                        scope.svg.append('text')
                            .attr('transform', 'translate(' + (scope.width/2) + ',' + (scope.height + scope.margin.bottom) + ')')
                            .attr('class', 'chart-axes-label x-axis-label')
                            .style('text-anchor', 'middle')
                            .text(scope.xlabel);

                        // Y Axis label
                        scope.svg.append('text')
                            .attr('transform', 'rotate(-90)')
                            .attr('y', 0 - scope.margin.left)
                            .attr('x', 0 - (scope.height / 2))
                            .attr('dy', '1em')
                            .attr('class', 'chart-axes-label')
                            .style('text-anchor', 'middle')
                            .text(scope.ylabel + ' ['+ scope.uom +']');

                        // Last reading on top
                        scope.toptext = scope.svg.append('text')
                            .attr('x', (scope.width / 2))
                            .attr('y', 0 - (scope.margin.top / 2))
                            .attr('class', 'toptext')
                            .attr('text-anchor', 'middle');
                        scope.toptext
                            .append('tspan')
                            .attr('class', 'chart-last-value')
                            .text(_.last(scope.data).med + ' ' + scope.uom + ' ');
                        scope.toptext
                            .append('tspan')
                            .attr('class', 'chart-last-date')
                            .text('(' + scope.dateFormatter(_.last(scope.data).t) + ')');

                        // Draw points
                        scope.svg.selectAll('circle')
                            .data(scope.data)
                        .enter().append('circle')
                            .attr('r', 2.5)
                            .attr('cx', function(d) { return scope.x(d.t) })
                            .attr('cy', function(d) { return scope.y(d.med) })
                            .attr('class', 'chart-point')
                            .style('stroke', scope.lineStroke);

                        // Focus elements shown on point highlighting
                        scope.focus = scope.svg.append('g')
                            .attr('class', 'focus')
                            .style('display', 'none');
                        scope.focus.append('line')
                            .attr('y1', scope.y(scope.yAxis.scale().domain()[0]))
                            .attr('y2', scope.y(scope.yAxis.scale().domain()[0]));
                        scope.focus.append('circle')
                            .attr('r', 5)
                            .style('fill', scope.focusFill)
                            .style('stroke', scope.focusStroke)
                            .style('stroke-width', scope.focusWidth);
                        scope.focus.append('text')
                            .attr('class', 'ttip')
                            .attr('dy', '-1.5em')
                            .attr('text-anchor', 'middle');
                        scope.focus.append('text')
                            .attr('class', 'timetip')
                            .attr('y', scope.height)
                            .attr('dy', '-6px');

                        // Transparent overlay on chart area to sense mouse events
                        scope.svg.append('rect')
                            .attr('class', 'overlay')
                            .attr('width', scope.width)
                            .attr('height', scope.height)
                            //.on('click', scope.startUpdate)
                            .on('mouseover', function() { scope.focus.style("display", null); })
                            .on('mouseout', function() { scope.focus.style("display", "none"); })
                            .on('mousemove', scope.mouseMove);
                    }
                    
                    /* Chart update */

                    else
                    {
                        scope.redraw();
                    }
                }
            });
        }
    }
}]);