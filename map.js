// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
// Import D3 as an ES module
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Check that Mapbox GL JS is loaded
console.log("Mapbox GL JS Loaded:", mapboxgl);

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiYWFhZGl0MjQyIiwiYSI6ImNtN2U2Z3g0djBhbmwydHB2MHo2dXZobHEifQ.LJUwszKPm77TROig1a0Gmg'; // Make sure this is your actual token

// Step 5.2: Format time function
function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
  return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

// Step 5.3: Helper functions for filtering
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function computeStationTraffic(stations, trips) {
  // Compute departures
  const departures = d3.rollup(
    trips, 
    (v) => v.length, 
    (d) => d.start_station_id
  );

  // Compute arrivals
  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id
  );

  // Update each station
  return stations.map((station) => {
    let id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}

function filterTripsbyTime(trips, timeFilter) {
  return timeFilter === -1 
    ? trips // If no filter is applied (-1), return all trips
    : trips.filter((trip) => {
        // Convert trip start and end times to minutes since midnight
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);
        
        // Include trips that started or ended within 60 minutes of the selected time
        return (
          Math.abs(startedMinutes - timeFilter) <= 60 ||
          Math.abs(endedMinutes - timeFilter) <= 60
        );
    });
}

// Helper function to convert coordinates to pixel positions
function getCoords(station) {
  const point = new mapboxgl.LngLat(station.lon, station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // Boston coordinates [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18 // Maximum allowed zoom
});

// Define a common style for bike lanes
const bikeLayerStyle = {
  'line-color': '#32D400',  // A bright green using hex code
  'line-width': 3,
  'line-opacity': 0.6
};

// Wait for the map to load before adding data
map.on('load', async () => {
  // Add Boston bike lanes
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
  });

  map.addLayer({
    id: 'boston-bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: bikeLayerStyle
  });

  // Add Cambridge bike lanes
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: bikeLayerStyle
  });

  try {
    // Step 4.1: Fetch both stations and trips data
    const jsonUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    const csvUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
    
    const jsonData = await d3.json(jsonUrl);
    
    // Step 5.3: Parse dates in CSV data
    const trips = await d3.csv(
      csvUrl,
      (trip) => {
        trip.started_at = new Date(trip.started_at);
        trip.ended_at = new Date(trip.ended_at);
        return trip;
      },
    );
    
    console.log('Loaded JSON Data:', jsonData);
    console.log('Loaded CSV Data (first 5 rows):', trips.slice(0, 5));
    
    // Extract stations array
    let stations = jsonData.data.stations;
    
    // Compute station traffic
    stations = computeStationTraffic(stations, trips);
    
    console.log('Stations with traffic data:', stations);
    
    // Step 4.3: Create a square root scale for circle radius based on traffic
    const radiusScale = d3
      .scaleSqrt()
      .domain([0, d3.max(stations, (d) => d.totalTraffic)])
      .range([0, 25]);
    
    // Select the SVG element inside the map container
    const svg = d3.select('#map').select('svg');
    
    // Append circles to the SVG for each station with radius based on traffic
    const circles = svg.selectAll('circle')
      .data(stations, (d) => d.short_name)  // Add key function
      .enter()
      .append('circle')
      .attr('r', d => radiusScale(d.totalTraffic))  // Set radius based on traffic
      .attr('fill', 'steelblue')  // Circle fill color
      .attr('stroke', 'white')    // Circle border color
      .attr('stroke-width', 1)    // Circle border thickness
      .attr('opacity', 0.6)       // Circle opacity
      .each(function(d) {
        // Step 4.4: Add tooltip with traffic info
        d3.select(this)
          .append('title')
          .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
      });
    
    // Function to update circle positions when the map moves/zooms
    function updatePositions() {
      circles
        .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
        .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
    }
    
    // Initial position update when map loads
    updatePositions();
    
    // Reposition markers on map interactions
    map.on('move', updatePositions);     // Update during map movement
    map.on('zoom', updatePositions);     // Update during zooming
    map.on('resize', updatePositions);   // Update on window resize
    map.on('moveend', updatePositions);  // Final adjustment after movement ends
    
    // Step 5.2: Setup time slider
    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('selected-time');
    const anyTimeLabel = document.getElementById('any-time');
    
    // Step 5.3: Add update functions
    function updateScatterPlot(timeFilter) {
      // Get only the trips that match the selected time filter
      const filteredTrips = filterTripsbyTime(trips, timeFilter);
      
      // Recompute station traffic based on the filtered trips
      const filteredStations = computeStationTraffic(stations, filteredTrips);
      
      // Update the circle sizes depending on whether filtering is applied
      timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);
      
      // Update the scatterplot by adjusting the radius of circles
      circles
        .data(filteredStations, (d) => d.short_name)
        .join('circle') // Ensure the data is bound correctly
        .attr('r', (d) => radiusScale(d.totalTraffic)); // Update circle sizes
    }
    
    function updateTimeDisplay() {
      const timeFilter = Number(timeSlider.value); // Get slider value
    
      if (timeFilter === -1) {
        selectedTime.textContent = ''; // Clear time display
        anyTimeLabel.style.display = 'block'; // Show "(any time)"
      } else {
        selectedTime.textContent = formatTime(timeFilter); // Display formatted time
        anyTimeLabel.style.display = 'none'; // Hide "(any time)"
      }
      
      // Call updateScatterPlot to reflect the changes on the map
      updateScatterPlot(timeFilter);
    }
    
    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();
    
  } catch (error) {
    console.error('Error loading data:', error); // Handle errors
  }
});