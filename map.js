import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

console.log("Mapbox GL JS Loaded:", mapboxgl);

mapboxgl.accessToken = 'pk.eyJ1IjoiYWFhZGl0MjQyIiwiYSI6ImNtN2U2Z3g0djBhbmwydHB2MHo2dXZobHEifQ.LJUwszKPm77TROig1a0Gmg';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027], 
  zoom: 12, 
  minZoom: 5, 
  maxZoom: 18 
});