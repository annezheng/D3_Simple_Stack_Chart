const w = 1000;
const h = 500;

const margin = { top: 40, right: 80, bottom: 40, left: 40 };
const width = w - margin.left -margin.right;
const height = h - margin.top - margin.bottom;

const parseTime = d3.timeParse("%Y-%m");

const xScale = d3.scaleTime().range([0, width]);
const yScale = d3.scaleLinear().rangeRound([ height, 0 ]);

const xAxis = d3.axisBottom(xScale).tickFormat(d3.timeFormat('%b %Y'));
const yAxis = d3.axisRight(yScale).ticks(5);

// const color = d3.scaleOrdinal(d3.schemeDark2);

const TYPE_KEYS = ['HEV', 'PHEV', 'BEV', 'FCEV'];

const ALL_TYPE = 0; // all types of vehicles
const ONE_TYPE = 1; // one type of vehicles
const ONE_VEHICLE = 2; // one vehicle of one type

let viewState = 0; // track view state
let viewType; // track most recently viewed/clicked type: "HEV", "PHEV", "BEV", "FCEV", or undefined
let viewVehicle; // track most recently viewed/clicked vehicle

let typesDataset = [], thisTypeDataset = [], vehiclesDataset = [];
let backButton;
let typesStackData;

const svg = d3.select("#chartContainer")
              .append("svg")
              .attr("width", w)
              .attr("height", h)
              .append('g')
              .attr('transform', `translate(${margin.left}, ${margin.top})`);

const area = d3.area()
               .x(d => xScale(d.data.date))
               .y0(d => yScale(d[0]))
               .y1(d => yScale(d[1]));

d3.text("vehicle_sales_data.csv").then(data => {
  const rows = d3.csvParseRows(data);
  vehiclesDataset = parseVehiclesDataset(rows);
  typesDataset = parseTypesDataset(rows);
  generateTypesChart.call(svg, typesDataset);
  createBackButton();
});

// Parse data functions
function parseTypesDataset(rows) {
  const dataset = [];
  let type, sales;
  for (let i = 3; i < rows.length; i++) {
    dataset[i - 3] = {
      date: parseTime(rows[i][0]),
      HEV: 0,
      PHEV: 0,
      BEV: 0,
      FCEV: 0
    };
    for (let j = 1; j < rows[i].length; j++) {
      type = rows[2][j];
      sales = rows[i][j];
      if (sales) {
        sales = parseInt(sales);
      } else {
        sales = 0;
      }
      dataset[i - 3][type] += sales;
    }
  }
  return dataset;
}

function parseThisTypeDataset(typesDataset) {
  const dataset = [];
  for (var i = 0; i < typesDataset.length; i++) {
    dataset[i] = {
      date: typesDataset[i].date,
      HEV: 0,
      PHEV: 0,
      BEV: 0,
      FCEV: 0,
      [viewType]:	typesDataset[i][viewType]
    }
  }
  return dataset;
}

function parseVehiclesDataset(rows) {
  const dataset = [];
  let make, model, makeModel, type, sales;
  for (var i = 3; i < rows.length; i++) {
    dataset[i - 3] = {
      date: parseTime(rows[i][0])
    };
    for (var j = 1; j < rows[i].length; j++) {
      make = rows[0][j];  //'Make' from 1st row in CSV
      model	= rows[1][j];  //'Model' from 2nd row in CSV
      makeModel	= make + " " + model;  //'Make' + 'Model' will serve as our key
      type = rows[2][j];  //'Type' from 3rd row in CSV
      sales	= rows[i][j];  //Sales value for this vehicle and month
      if (sales) {
        sales = parseInt(sales);
      } else {
        sales = 0;
      }
      dataset[i - 3][makeModel] = {
        make: make,
        model: model,
        type: type,
        sales: sales
      };
    }
  };
  return dataset;
}

// Charts functions
function generateTypesChart(typesDataset) {
  typesStackData = d3.stack().keys(TYPE_KEYS)(typesDataset);

  xScale.domain(d3.extent(typesDataset, d => d.date));
  yScale.domain([0,
                d3.max(typesDataset, function(d) {
                  var sum = 0;
                  for (let i = 0; i < TYPE_KEYS.length; i++) {
                    sum += d[TYPE_KEYS[i]];
                  };
                  return sum;
                })
              ]).nice();
  drawAxis.call(this, xAxis, yAxis);

  this.append("g")
        .attr("id", "types")
        .selectAll('path')
        .data(typesStackData)
        .enter()
        .append("path")
          .attr("class", "area")
          .attr("opacity", 1)
          .attr("d", d => area(d))
          .attr("fill", function(d) {
            let color;
            switch (d.key) {
              case "HEV":
                color = 'rgb(127, 179, 213)';
                break;
              case "PHEV":
                color = 'rgb(52, 152, 219)';
                break;
              case "BEV":
                color = 'rgb(17, 122, 101 )';
                break;
              case "FCEV":
                color = d3.schemePaired[5];
                break;
            }
            return color;
          })
          .on('click', typeClicked)
          .append("title")
            .text( d => `Type: ${d.key}`);
}

function generateThisTypeChart(thisTypeDataset) {
  const thisTypeStackData = d3.stack().keys(TYPE_KEYS)(thisTypeDataset);

  const paths = d3.selectAll("#types path")
                  .data(thisTypeStackData)
                  .classed("unclickable", "true");

  const areaTransitions = paths.transition()
                               .duration(1000)
                               .attr("d", d => area(d));

  yScale.domain([0,
      d3.max(thisTypeDataset, function(d) {
        let sum = 0;
        sum += d[viewType];
        return sum;
      })
  ]);

  areaTransitions.transition()
                .delay(200)
                .on("start", function() {
                  // update title label
                  d3.selectAll("g#label").remove();
                  svg.append("g")
                    .attr("id", "label")
                    .append('text')
                    .attr("y", 0 )
                    .attr("x",0)
                    .attr("transform", `translate(${width/2}, 0)`)
                    .style("text-anchor", "middle")
                    .text('Type: ' + viewType);

                  d3.select("g.y.axis")
                    .transition()
                    .duration(1000)
                    .call(yAxis);
                })
                .duration(1000)
                .attr("d", d => area(d))
                .transition()
                .on("start", function() {
                  d3.selectAll("g#vehicles path")
                    .attr("opacity", 1);
                })
                .duration(1000)
                .attr("opacity", 0)
                .on("end", function(d, i) {
                  if (i == 0) {
                    toggleBackButton();
                  }
                });

  generateVehiclesChart(vehiclesDataset);
}

function generateVehiclesChart(dataset) {
  const keys = Object.keys(dataset[0]).slice(1);
  const keysOfThisType = [];
  for (let i = 0; i < keys.length; i++) {
    if (dataset[0][keys[i]].type == viewType) {
      keysOfThisType.push(keys[i]);
    }
  }

  const stackData = d3.stack()
                      .keys(keysOfThisType)
                      .value(function value(d, key) {
                        return d[key].sales;
                      })(dataset);

  svg.append("g")
    .attr("id", "vehicles")
    .selectAll('path')
    .data(stackData)
    .enter()
    .append("path")
      .attr("class", "area")
      .attr("opacity", 0)
      .attr("d", d => area(d))
      .attr("fill", function(d, i) {
        const spread = 0.2;
        let startingPoint;
        switch (viewType) {
          case "HEV":
            startingPoint = 0.5;
            break;
          case "PHEV":
            startingPoint = 0.6;
            break;
          case "BEV":
            startingPoint = 0.7;
            break;
          case "FCEV":
            startingPoint = 0.3;
            break;
        }
        const numVehicles = keysOfThisType.length;
        //Get a value between 0.0 and 1.0
        const normalized = startingPoint + ((i / numVehicles) * spread);
        return d3.interpolatePuBuGn(normalized);
      })
      .on('click', vehicleClicked)
      .append("title")
        .text(d => `Model: ${d.key}`);
}

function drawAxis(xAxis, yAxis) {
  this.append("g")
      .attr("class", "x axis")
      .attr("transform", `translate(0, ${height})`)
      .call(xAxis); 

  this.append("g")
    .attr("class", "y axis")
    .attr("transform", `translate(${width}, 0)`)
    .call(yAxis);
}

// Clicked functions
function typeClicked(e, d) {
  // console.log('typeClicked > d', d);
  viewState++;
  viewType = d.key;
  thisTypeDataset = parseThisTypeDataset(typesDataset);
  generateThisTypeChart(thisTypeDataset);
}

function vehicleClicked (e, d) {
  viewState++;
  toggleBackButton();
  viewVehicle = d.key;

  //Fade out all other vehicle areas
  d3.selectAll("g#vehicles path")
    .classed("unclickable", "true")  //Prevent future clicks
    .filter(function(d) {
      if (d.key !== viewVehicle) {
        return true;
      }
    })
    .transition()
    .duration(1000)
    .attr("opacity", 0);

  //Define area generator that will be used just this one time
  var singleVehicleArea = d3.area()
                            .x(d => xScale(d.data.date))
                            .y0(d => yScale(0))
                            .y1(d => yScale(d.data[viewVehicle].sales));

  // console.log('this', this);
  var thisAreaTransition = d3.select(this)
                            .transition()
                            .delay(1000)
                            .duration(1000)
                            .attr("d", singleVehicleArea);

  yScale.domain([0, d3.max(vehiclesDataset, d => d[viewVehicle].sales)]);

  thisAreaTransition.transition()
                    .duration(1000)
                    .attr("d", singleVehicleArea)
                    .on("start", function() {
                      d3.select("g.axis.y")
                        .transition()
                        .duration(1000)
                        .call(yAxis);
                      
                      d3.selectAll("g#label").remove();
                        svg.append("g")
                          .attr("id", "label")
                          .append('text')
                          .attr("y", 0 )
                          .attr("x",0)
                          .attr("transform", `translate(${width/2}, 0)`)
                          .style("text-anchor", "middle")
                          .text(`Model: ${viewVehicle} (${viewType})`);
                    })
                    .on("end", function() {
                      d3.select(this).classed("unclickable", "false");
                      toggleBackButton();
                    });
}

// Back button functions
function createBackButton() {
  backButton = svg.append("g")
                  .attr("id", "backButton")
                  .attr("opacity", 0)
                  .classed("unclickable", true)
                  .attr("transform", `translate(${xScale.range()[0]}, ${yScale.range()[1]-17})`);
  backButton.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 70)
            .attr("height", 30);
  backButton.append("text")
            .attr("x", 7)
            .attr("y", 20)
            .html("&larr; Back")
            .on('click', backButtonClicked);
}

function toggleBackButton() {
  let backButton = d3.select("#backButton");
  const hidden = backButton.classed("unclickable");
  if (hidden) {
    let buttonText = "&larr; Back to ";
    if (viewState == 1) {
      buttonText += "all types";
    } else if (viewState == 2) {
      buttonText += "all " + viewType + " vehicles";
    }
    backButton.select("text").html(buttonText);
    //Resize button depending on text width
    let rectWidth = Math.round(backButton.select("text").node().getBBox().width + 16);
    backButton.select("rect").attr("width", rectWidth);
    backButton.classed("unclickable", false)
              .transition()
              .duration(500)
              .attr("opacity", 1);
  } else {
    backButton.classed("unclickable", true)
              .transition()
              .duration(200)
              .attr("opacity", 0);
  }
}

function backButtonClicked() {
  toggleBackButton();

  if (viewState == ONE_TYPE) {
    //Go back to default all types view
    viewState--;
    //Re-bind type data and fade in types
    const typeAreaTransitions = d3.selectAll("g#types path")
                                  .data(typesStackData)
                                  .transition()
                                  .duration(250)
                                  .attr("opacity", 1)
                                  .on("end", function() {
                                    //Remove all vehicles once this fades in;
                                    //they will be recreated later as needed.
                                    d3.selectAll("g#vehicles path").remove();
                                  });

    //Set y scale back to original domain
    yScale.domain([0,
        d3.max(typesDataset, function(d) {
          var sum = 0;
          for (var i = 0; i < TYPE_KEYS.length; i++) {
            sum += d[TYPE_KEYS[i]];
          };
          return sum;
        })
    ]);
    //Transition type areas and y scale back into place
    typeAreaTransitions.transition()
                      .duration(1000)
                      .on("start", function() {
                        //Transition axis to new scale concurrently
                        d3.select("g.axis.y")
                          .transition()
                          .duration(1000)
                          .call(yAxis);
                      })
                      .attr("d", area)
                      .on("end", function() {
                        d3.select(this).classed("unclickable", false);
                        d3.selectAll("g#label").remove();
                      });
  } else if (viewState == ONE_VEHICLE) {
    //Go back to one type view with multiple vehicles
    viewState--; // 1 (one type of vehicles)						

    //Restore the old y scale
    yScale.domain([0,
        d3.max(thisTypeDataset, function(d) {
          let sum = 0;
          sum += d[viewType];
          return sum;
        })
    ]);

    //Transition the y axis and visible area back into place
    d3.selectAll("g#vehicles path")
      .transition()
      .on("start", function() {
        //Transition y axis to new scale concurrently
        d3.select("g.axis.y")
          .transition()
          .duration(1000)
          .call(yAxis);
      })
      .duration(1000)
      .attr("d", area)  //Effectively changes only the selected area
      .transition()
      .duration(1000)
      .attr("opacity", 1)  // reveal all vehicles
      .on("end", function(d, i) {
      //Restore clickability
      d3.select(this).classed("unclickable", false);
      //Reveal back button
      if (i == 0) {
        toggleBackButton();
      }

      d3.selectAll("g#label").remove();
      svg.append("g")
        .attr("id", "label")
        .append('text')
        .attr("y", 0 )
        .attr("x",0)
        .attr("transform", `translate(${width/2}, 0)`)
        .style("text-anchor", "middle")
        .text('Type: ' + viewType);
    });
  }
};
