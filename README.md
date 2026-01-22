# Animated Arctic Tern Cesium Visualization

A Vite-powered CesiumJS visualization tracking the migration of an Arctic tern from the Sand Colony.The tracking data was filtered using a 300 km distance threshold to eliminate stationary clusters and identify key waypoints, which were then interpolated along Great Circle arcs to ensure a smooth flight trajectory during the animation. It renders a 3D globe, loads migration path data and a tern model from the public assets, and animates movement along the route. The app is configured for GitHub Pages deployment with a relative base path and a PowerShell deploy script that publishes the built dist output to the gh-pages branch.

Data: https://data.seabirdtracking.org/dataset/739

  Bird ID: ARTE_370

More on Arctic Terns: https://datazone.birdlife.org/species/factsheet/arctic-tern-sterna-paradisaea 
