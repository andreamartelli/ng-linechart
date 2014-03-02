# What's this?

A reusable Angular.js directive to draw awesome line charts with D3.
You don't need to dig into code and don't even need to know D3.js, since the directive is fully configurable.

# How to use it

* Use the directive in an HTML view and change the parameter's values to set axes, labels, colors, size, etc.
* Associate an Angular controller to the view
* You just need to define a function for data retrieval and put it into the *load-data-fn* parameter

## load-data-fn requirements


The attribute needs to be set as a function call.

The function has to return a promise (usual for $http based methods in Angular) wrapping an array of data points with this structure:

    [{
      min: 0, 
      med: 5,
      max: 10,
      t: new Date},
      ...
    ]