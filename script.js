// Initialize map
const map = L.map('map', {zoomControl: false}).setView([50.0, 10.0], 4);

// Define individual tile layers
const standard = L.tileLayer('https://api.maptiler.com/maps/landscape/{z}/{x}/{y}.png?key=xiA386RVUkjH1twt2rjo', {
    attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a>',
    tileSize: 512,
    zoomOffset: -1,
    opacity: 1
});

const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19
});

const outdoor = L.tileLayer('https://api.maptiler.com/maps/outdoor/{z}/{x}/{y}.png?key=xiA386RVUkjH1twt2rjo', {
    attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a>',
    tileSize: 512,
    zoomOffset: -1,
    opacity: 1
});

const terrain = L.tileLayer('https://api.maptiler.com/maps/topo/{z}/{x}/{y}.png?key=xiA386RVUkjH1twt2rjo', {
    attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a>',
    tileSize: 512,
    zoomOffset: -1,
    opacity: 1
});

// Transparent labels-only layer (MapTiler)
const labelsOnly = L.tileLayer('https://api.maptiler.com/maps/toner/{z}/{x}/{y}.png?key=xiA386RVUkjH1twt2rjo', {
    attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a>',
    tileSize: 512,
    zoomOffset: -1,
    opacity: 1
});


// AltTerrain = Satellite + Standard + Labels
const altTerrain = L.layerGroup([satellite.setOpacity(1),labelsOnly.setOpacity(0.3)]);

// Define map layers for control
const mapLayers = {
    'Standard': standard,
    'Satellite': satellite,
    'Outdoor': outdoor,
    'Terrain': terrain,
    'Satellite': altTerrain
};

// Add the default layer
standard.addTo(map);

// Add layer control to the map
L.control.layers(mapLayers, null, {position: 'bottomleft'}).addTo(map);

// Add zoom control
L.control.zoom({
    position: 'bottomright'
}).addTo(map);



const orsApiKey = '5b3ce3597851110001cf6248f352a6458984400480f70d75375cdbad';

// First, replace your isochroneCache declaration

const isochroneCache = {};

// Add click handler to deselect markers when clicking on the map
map.on('click', function(e) {
    if (selectedMarker) {
        selectedMarker.setIcon(L.divIcon({
            className: 'permanent-marker',
            html: `<div style="background-color: rgba(93, 55, 55, 0.7); width: 6px; height: 6px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        }));
        selectedMarker = null;
    }
    // Find and remove all custom tooltips
    const tooltips = document.querySelectorAll('.plain-tooltip');
    tooltips.forEach(tooltip => {
        if (tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
        }
    });
    
    // Also clear marker references to tooltips
    permanentMarkers.forEach(marker => {
        if (marker._tooltip) {
            marker._tooltip = null;
        }
    });
});


// Store selected locations and their circles
const selectedLocations = [];
let circleGroups = [];

// Store permanent locations and their markers
let permanentLocations = [];
let permanentMarkers = [];

let selectedMarker = null;

// Store distance and color values
let distances = [
    { value: 100, color: '#8B5A2B', opacity: 0.15 },
    { value: 150, color: '#606C38', opacity: 0.15 }
];

// Function to find and display intersection areas
function displayIntersections(isochrones) {
    // Remove any existing intersection layers
    circleGroups.forEach(group => {
        group.getLayers().forEach(layer => {
            if (layer._intersectionLayer) {
                group.removeLayer(layer._intersectionLayer);
            }
        });
    });
    
    // We need at least 2 isochrones to have an intersection
    if (isochrones.length < 2) return;
    
    // Create a new group for all intersections
    const intersectionGroup = L.layerGroup().addTo(map);
    circleGroups.push(intersectionGroup);
    
    // Check every pair of isochrones
    for (let i = 0; i < isochrones.length - 1; i++) {
        for (let j = i + 1; j < isochrones.length; j++) {
            try {
                console.log(`Testing intersection between ${isochrones[i].name} and ${isochrones[j].name}`);
                console.log("GeoJSON 1:", isochrones[i].geoJSON);
                console.log("GeoJSON 2:", isochrones[j].geoJSON);
                
                // Try to find intersection using Turf.js
                const intersection = turf.intersect(isochrones[i].geoJSON, isochrones[j].geoJSON);
                
                if (intersection) {
                    console.log(`Found intersection between ${isochrones[i].name} and ${isochrones[j].name}:`, intersection);
                    
                    // Create a layer for this intersection
                    const intersectionLayer = L.geoJSON(intersection, {
                        style: {
                            color: '#000000',         // Black border 
                            fillColor: '#FF5500',     // Bright orange fill
                            fillOpacity: 0.3,         // More opaque than regular isochrones
                            weight: 2,
                            dashArray: '3, 5'         // Dashed line for distinction
                        }
                    }).addTo(intersectionGroup);
                    
                    // Add a popup showing which locations overlap here
                    intersectionLayer.bindPopup(`<div style="font-weight: bold;">Overlap Area</div>
                        <div>${isochrones[i].name} & ${isochrones[j].name}</div>
                        <div>${isochrones[i].radius} min & ${isochrones[j].radius} min</div>`);
                } else {
                    console.log(`No intersection found between ${isochrones[i].name} and ${isochrones[j].name}`);
                }
            } catch (error) {
                console.error(`Error finding intersection between ${isochrones[i].name} and ${isochrones[j].name}:`, error);
            }
        }
    }
    
    // Check for areas where all isochrones overlap (if 3+ isochrones)
    if (isochrones.length >= 3) {
        try {
            // Start with the first two
            let allIntersection = turf.intersect(isochrones[0].geoJSON, isochrones[1].geoJSON);
            
            // If we found an initial intersection, check against all others
            if (allIntersection) {
                let allOverlap = true;
                
                for (let i = 2; i < isochrones.length; i++) {
                    allIntersection = turf.intersect(allIntersection, isochrones[i].geoJSON);
                    
                    // If at any point we don't have an intersection, exit
                    if (!allIntersection) {
                        allOverlap = false;
                        break;
                    }
                }
                
                // If we found an area where all overlap
                if (allOverlap && allIntersection) {
                    console.log("Found area where ALL isochrones overlap!");
                    
                    // Create a special layer for this all-overlap area
                    const allOverlapLayer = L.geoJSON(allIntersection, {
                        style: {
                            color: '#FFFFFF',      // White border
                            fillColor: '#FF0000',  // Red fill  
                            fillOpacity: 0.5,      // More opaque
                            weight: 3
                        }
                    }).addTo(intersectionGroup);
                    
                    // Create a popup content with all location names
                    const locationNames = isochrones.map(iso => iso.name).join(', ');
                    allOverlapLayer.bindPopup(`<div style="font-weight: bold; color: #FF0000;">All Locations Overlap Here!</div>
                        <div>${locationNames}</div>`);
                }
            }
        } catch (error) {
            console.error("Error finding all-overlap area:", error);
        }
    }
}

// Add this new code after displayIntersections function

// Create container for the overlap list
let overlapsContainer;

// Initialize the overlaps panel
function initOverlapsPanel() {
    // Remove if already exists
    $('.overlaps-container').remove();
    
    // Create the container
    overlapsContainer = $('<div>').addClass('overlaps-container');
    const header = $('<div>').addClass('overlaps-header')
        .html('<h3>Locations in overlap</h3>');
    
    // Add a toggle for collapsing
    const toggleBtn = $('<button>')
        .addClass('overlaps-toggle')
        .html('<i class="fas fa-chevron-down"></i>');
    
    toggleBtn.on('click', function() {
        $('.overlaps-list').toggleClass('collapsed');
        $(this).find('i').toggleClass('fa-chevron-up fa-chevron-down');
    });
    
    header.append(toggleBtn);
    
    // Create the list container
    const listContainer = $('<div>').addClass('overlaps-list');
    const emptyMessage = $('<div>').addClass('empty-message')
        .text('No locations found in overlap areas');
    
    listContainer.append(emptyMessage);
    
    // Add to the DOM
    overlapsContainer.append(header, listContainer);
    $('body').append(overlapsContainer);
    
    return overlapsContainer;
}

// Function to find locations in overlap areas
function findLocationsInOverlaps(intersections) {
    // Only proceed if permanent locations are shown
    if (!$('#show-permanent').prop('checked') || permanentLocations.length === 0) {
        return [];
    }
    
    // Empty array to store locations in overlap
    const locationsInOverlap = [];
    
    // Check each permanent location
    permanentLocations.forEach(location => {
        if (!location.lat || !location.lng || !location.name) {
            return;
        }
        
        // Create a GeoJSON point for this location
        const point = turf.point([location.lng, location.lat]);
        
        // Check if this point is within any intersection
        for (const intersection of intersections) {
            try {
                if (turf.booleanPointInPolygon(point, intersection.polygon)) {
                    // Add to our results array with the intersection info
                    locationsInOverlap.push({
                        name: location.name,
                        lat: location.lat,
                        lng: location.lng,
                        intersectionName: intersection.name,
                        overlappingAreas: intersection.areas
                    });
                    
                    // Break the loop - we only need to know it's in at least one intersection
                    break;
                }
            } catch (error) {
                console.error("Error checking if point is in polygon:", error);
            }
        }
    });
    
    return locationsInOverlap;
}

// Function to update the overlap list display
function updateOverlapsList(locations) {
    // Make sure we have the container
    if (!overlapsContainer) {
        overlapsContainer = initOverlapsPanel();
    }
    
    // Get the list container
    const listContainer = $('.overlaps-list');
    
    // Clear existing items
    listContainer.empty();
    
    // If no locations or checkbox is unchecked, show empty message
    if (locations.length === 0 || !$('#show-permanent').prop('checked')) {
        const emptyMessage = $('<div>').addClass('empty-message')
            .text(
                !$('#show-permanent').prop('checked') 
                ? 'Enable location recommendations to see places in overlap areas' 
                : 'No locations found in overlap areas'
            );
        listContainer.append(emptyMessage);
        return;
    }
    
    // Group locations by intersection
    const groupedLocations = {};
    locations.forEach(loc => {
        if (!groupedLocations[loc.intersectionName]) {
            groupedLocations[loc.intersectionName] = [];
        }
        groupedLocations[loc.intersectionName].push(loc);
    });
    
    // Add sections for each intersection type
    Object.keys(groupedLocations).forEach(intersectionName => {
        const intersectionGroup = $('<div>').addClass('overlap-group');
        
        // Create a header for this group
        const groupHeader = $('<div>').addClass('overlap-group-header')
            .html(`<strong>${intersectionName}</strong> (${groupedLocations[intersectionName].length} locations)`);
        
        // Create the list of locations
        const locationsList = $('<ul>').addClass('overlap-locations-list');
        
        // Add each location to the list
        groupedLocations[intersectionName].forEach(loc => {
            const item = $('<li>').addClass('overlap-location-item');
            
            // Create the item content
            const itemContent = $('<div>').addClass('overlap-item-content');
            itemContent.text(loc.name);
            
            // Add a button to center the map on this location
            const centerBtn = $('<button>').addClass('center-location-btn')
                .html('<i class="fas fa-search-location"></i>')
                .attr('title', 'Center map on this location');
            
            centerBtn.on('click', function() {
                // Center map on this location
                map.setView([loc.lat, loc.lng], 13);
                
                // Find the corresponding marker
                const marker = permanentMarkers.find(m => {
                    const latlng = m.getLatLng();
                    return latlng.lat === loc.lat && latlng.lng === loc.lng;
                });
                
                // If found, show popup and highlight
                if (marker) {
                    // Reset previously selected marker if any
                    if (selectedMarker) {
                        selectedMarker.setIcon(L.divIcon({
                            className: 'permanent-marker',
                            html: `<div style="background-color: rgba(93,94,55,0.7); width: 6px; height: 6px; border-radius: 50%; border: 2px solid white;"></div>`,
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        }));
                    }
                    
                    // Set this as selected marker
                    selectedMarker = marker;
                    
                    // Change appearance to show it's selected
                    marker.setIcon(L.divIcon({
                        className: 'permanent-marker',
                        html: `<div style="background-color: #5D4037; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white;"></div>`,
                        iconSize: [26, 26],
                        iconAnchor: [13, 13]
                    }));
                    
                    // Open popup
                    marker.openPopup();
                }
            });
            
            item.append(itemContent, centerBtn);
            locationsList.append(item);
        });
        
        // Add to the group
        intersectionGroup.append(groupHeader, locationsList);
        
        // Add to the container
        listContainer.append(intersectionGroup);
    });
}

// Modify the displayIntersections function to track all intersections
function displayIntersections(isochrones) {
    // Remove any existing intersection layers
    circleGroups.forEach(group => {
        group.getLayers().forEach(layer => {
            if (layer._intersectionLayer) {
                group.removeLayer(layer._intersectionLayer);
            }
        });
    });
    
    // We need at least 2 isochrones to have an intersection
    if (isochrones.length < 2) {
        // If no intersections, update the overlaps list to be empty
        updateOverlapsList([]);
        return;
    }
    
    // Create a new group for all intersections
    const intersectionGroup = L.layerGroup().addTo(map);
    circleGroups.push(intersectionGroup);
    
    // Track all intersection polygons with metadata
    const allIntersections = [];
    
    // Check every pair of isochrones
    for (let i = 0; i < isochrones.length - 1; i++) {
        for (let j = i + 1; j < isochrones.length; j++) {
            try {
                console.log(`Testing intersection between ${isochrones[i].name} and ${isochrones[j].name}`);
                
                // Try to find intersection using Turf.js
                const intersection = turf.intersect(isochrones[i].geoJSON, isochrones[j].geoJSON);
                
                if (intersection) {
                    console.log(`Found intersection between ${isochrones[i].name} and ${isochrones[j].name}:`, intersection);
                    
                    // Create a layer for this intersection
                    const intersectionLayer = L.geoJSON(intersection, {
                        style: {
                            color: '#000000',         // Black border 
                            fillColor: '#FF5500',     // Bright orange fill
                            fillOpacity: 0.3,         // More opaque than regular isochrones
                            weight: 2,
                            dashArray: '3, 5'         // Dashed line for distinction
                        }
                    }).addTo(intersectionGroup);
                    
                    // Add a popup showing which locations overlap here
                    intersectionLayer.bindPopup(`<div style="font-weight: bold;">Overlap Area</div>
                        <div>${isochrones[i].name} & ${isochrones[j].name}</div>
                        <div>${isochrones[i].radius} min & ${isochrones[j].radius} min</div>`);
                    
                    // Add to our tracking array
                    allIntersections.push({
                        name: `Overlap between ${isochrones[i].name.split(',')[0]} & ${isochrones[j].name.split(',')[0]}`,
                        areas: [`${isochrones[i].name} (${isochrones[i].radius} min)`, 
                               `${isochrones[j].name} (${isochrones[j].radius} min)`],
                        polygon: intersection
                    });
                } else {
                    console.log(`No intersection found between ${isochrones[i].name} and ${isochrones[j].name}`);
                }
            } catch (error) {
                console.error(`Error finding intersection between ${isochrones[i].name} and ${isochrones[j].name}:`, error);
            }
        }
    }
    
    // Check for areas where all isochrones overlap (if 3+ isochrones)
    if (isochrones.length >= 3) {
        try {
            // Start with the first two
            let allIntersection = turf.intersect(isochrones[0].geoJSON, isochrones[1].geoJSON);
            
            // If we found an initial intersection, check against all others
            if (allIntersection) {
                let allOverlap = true;
                
                for (let i = 2; i < isochrones.length; i++) {
                    allIntersection = turf.intersect(allIntersection, isochrones[i].geoJSON);
                    
                    // If at any point we don't have an intersection, exit
                    if (!allIntersection) {
                        allOverlap = false;
                        break;
                    }
                }
                
                // If we found an area where all overlap
                if (allOverlap && allIntersection) {
                    console.log("Found area where ALL isochrones overlap!");
                    
                    // Create a special layer for this all-overlap area
                    const allOverlapLayer = L.geoJSON(allIntersection, {
                        style: {
                            color: '#FFFFFF',      // White border
                            fillColor: '#FF0000',  // Red fill  
                            fillOpacity: 0.5,      // More opaque
                            weight: 3
                        }
                    }).addTo(intersectionGroup);
                    
                    // Create a popup content with all location names
                    const locationNames = isochrones.map(iso => iso.name).join(', ');
                    allOverlapLayer.bindPopup(`<div style="font-weight: bold; color: #FF0000;">All Locations Overlap Here!</div>
                        <div>${locationNames}</div>`);
                    
                    // Add to our tracking array
                    allIntersections.push({
                        name: "All Locations Overlap",
                        areas: isochrones.map(iso => `${iso.name} (${iso.radius} min)`),
                        polygon: allIntersection
                    });
                }
            }
        } catch (error) {
            console.error("Error finding all-overlap area:", error);
        }
    }
    
    // Find locations in these intersections
    const locationsInOverlap = findLocationsInOverlaps(allIntersections);
    console.log("Found", locationsInOverlap.length, "locations in overlapped areas:", locationsInOverlap);
    
    // Update the UI with these locations
    updateOverlapsList(locationsInOverlap);
}

// Modify permanent locations display to update overlap list when toggled
function displayPermanentLocations() {
    // Only proceed if the checkbox is checked
    if (!$('#show-permanent').prop('checked')) {
        // If not checked, clear all permanent markers from map
        permanentMarkers.forEach(marker => map.removeLayer(marker));
        permanentMarkers = [];
        
        // Also update the overlaps list to show the disabled message
        updateOverlapsList([]);
        return;
    }
    
    // Rest of the function remains as is...
    // [Original function code]
    
    // After displaying markers, trigger an update of the overlaps list
    // by calling updateCircles
    updateCircles();
}

// Add initialization of the overlaps panel in the main initialization function
(async function() {
    try {
        permanentLocations = await loadPermanentLocations();
        displayPermanentLocations(); // Display permanent locations as pins
        
        // Initialize with a clean map
        updateCircles();
        
        // Create map legend
        createMapLegend();
        
        // Initialize the overlaps panel
        initOverlapsPanel();
        
        // Check if scroll indicator is needed
        checkScrollIndicator();
    } catch (error) {
        console.error("Error initializing application:", error);
        showStatus('Error initializing application. Some features may not work correctly.', 'error');
    }
})();

// Function to generate distinct colors for each location
function getColorForIndex(index) {
    // Define an array of distinct, visually pleasing colors
    const colors = [
        '#8B5A2B', // Brown (your original color)
        '#2B5A8B', // Blue
        '#5A8B2B', // Green
        '#8B2B5A', // Purple
        '#5A2B8B', // Violet
        '#2B8B5A', // Teal
        '#8B8B2B', // Olive
        '#2B2B8B', // Navy
        '#BB5A2B', // Rust
        '#2BBB5A'  // Mint
    ];
    
    // Return a color from the array, cycling if we have more locations than colors
    return colors[index % colors.length];
}


// Function to show status messages
function showStatus(message, type = 'success') {
    const statusEl = $('#status-message');
    statusEl.text(message);
    statusEl.removeClass('success error warning').addClass(type);
    statusEl.fadeIn();
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusEl.fadeOut();
    }, 5000);
}

// Create map legend function
function createMapLegend(isochroneData = []) {
    // Remove existing legend if any
    $('.map-legend').remove();
    
    // Get all locations that have coordinates and names
    const locations = [];
    let hasExtendedTimes = false;
    
    $('.location-input-group').each(function(index) {
        const input = $(this).find('.location-input');
        const radius = $(this).find('.radius-dropdown').val();
        const transportMode = $(this).find('.transport-mode-dropdown').val();
        const name = input.val();
        
        if (name) {
            locations.push({ 
                name: name,
                radius: radius || 60, // Default to 60 if not set
                transportMode: transportMode || 'driving',
                color: getColorForIndex(index)
            });
            
            // Check if any location has time > 60 minutes
            if (parseInt(radius) > 60) {
                hasExtendedTimes = true;
            }
        }
    });
    
    // Only create legend if we have locations
    if (locations.length === 0) return;
    
    // Create legend container
    const legend = $('<div>').addClass('map-legend');
    
    // Add title
    legend.append($('<div>').text('Locations').css({
        'font-weight': 'bold',
        'margin-bottom': '5px',
        'border-bottom': '1px solid #ccc',
        'padding-bottom': '3px'
    }));
    
    // Add legend items for each location
    locations.forEach(location => {
        const item = $('<div>').addClass('map-legend-item');
        const colorSpan = $('<span>')
            .addClass('map-legend-color')
            .css('background-color', location.color);
        
        // Include transport mode in the legend
        const transportIcon = getTransportIcon(location.transportMode);
        const textSpan = $('<span>').html(`<b>${location.name}</b> (${location.radius} min, ${transportIcon})`);
        
        item.append(colorSpan, textSpan);
        legend.append(item);
    });
    
    // Add intersection colors to the legend if we have multiple locations
    if (locations.length >= 2) {
        // Add a separator
        legend.append($('<div>').css({
            'margin-top': '10px',
            'margin-bottom': '5px',
            'border-bottom': '1px solid #ccc',
            'padding-bottom': '3px',
            'font-weight': 'bold'
        }).text('Overlapping Areas'));
        
        // Add intersection explanation
        const intersectionItem = $('<div>').addClass('map-legend-item');
        const intersectionColor = $('<span>')
            .addClass('map-legend-color')
            .css({
                'background-color': '#FF5500',
                'opacity': '0.3',
                'border': '1px solid #000000'
            });
        
        const intersectionText = $('<span>').html(`<b>Areas where 2 locations overlap</b>`);
        intersectionItem.append(intersectionColor, intersectionText);
        legend.append(intersectionItem);
        
        // Add all-overlap explanation if we have 3+ locations
        if (locations.length >= 3) {
            const allOverlapItem = $('<div>').addClass('map-legend-item');
            const allOverlapColor = $('<span>')
                .addClass('map-legend-color')
                .css({
                    'background-color': '#FF0000',
                    'opacity': '0.5',
                    'border': '1px solid #FFFFFF'
                });
            
            const allOverlapText = $('<span>').html(`<b>Areas where all locations overlap</b>`);
            allOverlapItem.append(allOverlapColor, allOverlapText);
            legend.append(allOverlapItem);
        }
    }
    
    // API limitation note if needed
    if (hasExtendedTimes) {
        legend.append($('<div>').html(`<medium><i>Note: Isochrones > 60 min are approximated due to API limits</i></small>`).css({
            'margin-top': '5px',
            'padding-top': '5px',
            'border-top': '1px dotted #ccc',
            'font-size': '11px',
            'color': '#fc0505'//'#856404'
        }));
    }
    
    // Ensure the legend is added to the map container
    $('#map').append(legend);
    console.log("Legend created with", locations.length, "locations");
}

// Helper function to get transport mode icon
function getTransportIcon(transportMode) {
    switch(transportMode) {
        case 'Driving':
            return '<i class="fas fa-car"></i>';
        case 'Walking+train':
            return '<i class="fas fa-walking"></i>+<i class="fas fa-train"></i>';
        case 'Walking':
            return '<i class="fas fa-walking"></i>';
        case 'Cycling':
            return '<i class="fas fa-bicycle"></i>';
        default:
            return transportMode;
    }
}

// Load permanent locations
async function loadPermanentLocations() {
    try {
        const response = await fetch('permanent-locations.json');
        if (!response.ok) {
            console.error('Could not load permanent locations');
            showStatus('Could not load permanent locations. Using only user-added locations.', 'error');
            return [];
        }
        const locations = await response.json();
        console.log('Loaded', locations.length, 'permanent locations');
        return locations;
    } catch (error) {
        console.error('Error loading permanent locations:', error);
        showStatus('Error loading permanent locations. Using only user-added locations.', 'error');
        return [];
    }
}

// Function to display permanent locations as pins
function displayPermanentLocations() {
    // Only proceed if the checkbox is checked
    if (!$('#show-permanent').prop('checked')) {
        // If not checked, clear all permanent markers from map
        permanentMarkers.forEach(marker => map.removeLayer(marker));
        permanentMarkers = [];
        return;
    }
    
    // Clear any existing permanent markers
    permanentMarkers.forEach(marker => map.removeLayer(marker));
    permanentMarkers = [];
    
    // Add markers for permanent locations
    permanentLocations.forEach(location => {
        if (!location.lat || !location.lng || !location.name) {
            console.warn("Invalid permanent location data:", location);
            return;
        }
        
        const latLng = [location.lat, location.lng];
        
        // Inside the forEach loop in displayPermanentLocations()
        // Inside the displayPermanentLocations() function where markers are created
        const marker = L.marker(latLng, {
            icon: L.divIcon({
                className: 'permanent-marker',
                html: `<div style="background-color: rgba(116, 11, 11, 0.7); width: 6px; height: 6px; border-radius: 50%; border: 2px solid white;"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        });

        // Add hover functionality
        marker.on('mouseover', function(e) {
            // Create a custom tooltip div instead of using Leaflet's built-in tooltip
            const tooltip = L.DomUtil.create('div', 'plain-tooltip');
            tooltip.innerHTML = location.name;
            
            // Position it above the marker
            const pos = map.latLngToLayerPoint(this.getLatLng());
            tooltip.style.position = 'absolute';
            tooltip.style.left = `${pos.x}px`;
            tooltip.style.top = `${pos.y - 35}px`; // Offset above the point
            
            // Add to map container
            map.getContainer().appendChild(tooltip);
            
            // Store reference for removal
            this._tooltip = tooltip;
        });
        
        marker.on('mouseout', function(e) {
            // Remove custom tooltip with a slight delay to prevent flicker
            // when moving between markers
            setTimeout(() => {
                if (this._tooltip && this._tooltip.parentNode) {
                    this._tooltip.parentNode.removeChild(this._tooltip);
                    this._tooltip = null;
                }
            }, 20);
        });
        
        // Update tooltip position on map move/zoom
        map.on('moveend', function() {
            // Update positions of any visible tooltips
            permanentMarkers.forEach(marker => {
                if (marker._tooltip) {
                    const pos = map.latLngToLayerPoint(marker.getLatLng());
                    marker._tooltip.style.left = `${pos.x}px`;
                    marker._tooltip.style.top = `${pos.y - 20}px`;
                }
            });
        });
        // Add popup with location name
        //marker.bindPopup(location.name);
        marker.bindPopup("<strong>" + location.name + "</strong><br>" + location.fact, {
            className: 'custom-popup'
        });

        // Add click handler directly to the marker
        marker.on('click', function(e) {
            // Stop propagation to prevent map click from firing
            L.DomEvent.stopPropagation(e);
            
            console.log("Marker clicked:", location.name);
            
            // Reset previously selected marker if any
            if (selectedMarker) {
                selectedMarker.setIcon(L.divIcon({
                    className: 'permanent-marker',
                    html: `<div style="background-color: rgba(93,94,55,0.7); width: 6px; height: 6px; border-radius: 50%; border: 2px solid white;"></div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                }));
            }
            
            // Set this as selected marker
            selectedMarker = marker;
            
            // Change appearance to show it's selected
            marker.setIcon(L.divIcon({
                className: 'permanent-marker',
                html: `<div style="background-color: #5D4037; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white;"></div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13]
            }));
            
            // Prevent the map's click handler from firing
            return false;
        });

        // Add to map
        marker.addTo(map);
        permanentMarkers.push(marker);
        
        // Add popup with location name
        // marker.bindPopup(location.name);
        marker.bindPopup("<strong>" + location.name + "</strong><br>" + location.fact, {
            className: 'custom-popup'
        });
        
        // Add to map
        marker.addTo(map);
        permanentMarkers.push(marker);
        
        console.log("Added permanent location pin:", location.name, location.lat, location.lng);
    });
}

// Initialize distance inputs
$('#distance1').val(distances[0].value);
$('#distance2').val(distances[1].value);

// Function to search locations using Nominatim API
async function searchLocations(query) {
    if (query.length < 3) return []; // Require at least 3 characters
    
    try {
        // Show loading indicator if we add one
        // $('.loading-indicator').show();
        
        // Add a random parameter to avoid caching issues
        const timestamp = new Date().getTime();
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1&countrycodes=&namedetails=1&accept-language=en&_=${timestamp}`, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Map Radius Circles Website' // It's good practice to identify your application
            }
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        console.log("API returned:", data.length, "results");
        
        // Format the results to match our expected structure
        return data.map(place => ({
            name: place.display_name,
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lon),
            type: place.type,
            importance: place.importance
        }));
    } catch (error) {
        console.error("Error fetching locations:", error);
        showStatus('Error searching for locations. Please try again.', 'error');
        return [];
    } finally {
        // Hide loading indicator if we add one
        // $('.loading-indicator').hide();
    }
}

// Function to filter locations based on input
async function filterLocations(input) {
    if (input.length < 3) return [];
    
    try {
        const results = await searchLocations(input);
        console.log("Search returned:", results.length, "locations");
        return results;
    } catch (error) {
        console.error("Error searching locations:", error);
        return [];
    }
}

// Add this debug function near the top of your script
function logCacheStats() {
    const keys = Object.keys(isochroneCache);
    console.log(`Cache contains ${keys.length} isochrones:`);
    keys.forEach(key => {
        const [lng, lat, minutes] = key.split('|');
        console.log(`- Location [${lng}, ${lat}] at ${minutes} minutes`);
    });
}

// Function to show dropdown suggestions
function showSuggestions(inputElement, suggestions) {
    const dropdown = $(inputElement).siblings('.dropdown');
    dropdown.empty();
    
    if (suggestions.length > 0) {
        console.log("Found suggestions:", suggestions.length);
        suggestions.forEach(place => {
            // Format display name
            const displayText = place.name;
            
            const item = $('<div>').addClass('dropdown-item').text(displayText);
            item.on('click', function() {
                $(inputElement).val(place.name);
                // Store the coordinates with the input
                $(inputElement).data('lat', place.lat);
                $(inputElement).data('lng', place.lng);
                dropdown.hide();
                // Trigger circle update immediately after selection
                updateCircles();
            });
            dropdown.append(item);
        });
        dropdown.show();
    } else {
        dropdown.hide();
    }
}

// Function to draw circles
async function drawCircles() {
    // Clear existing circles
    circleGroups.forEach(group => map.removeLayer(group));
    circleGroups = [];
    
    // Get all locations that have coordinates
    const locations = [];
    $('.location-input-group').each(function() {
        const input = $(this).find('.location-input');
        const radius = parseInt($(this).find('.radius-dropdown').val());
        const lat = input.data('lat');
        const lng = input.data('lng');
        const name = input.val();
        
        if (lat && lng && name) {
            locations.push({ 
                name, 
                lat, 
                lng,
                radius: radius || 100 // Default to 100 if not set
            });
            console.log("Added location:", name, lat, lng, "with radius:", radius);
        }
    });
    
    console.log("Drawing isochrones for", locations.length, "locations");
    
    // Create bounds object
    const bounds = L.latLngBounds();
    
    // Draw isochrones for each location
    for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        const latLng = [location.lat, location.lng];
        
        // Get a unique color for this location
        const locationColor = getColorForIndex(i);
        
        // Create a group for this location's isochrone
        const locationGroup = L.layerGroup();
        
        // Add marker
        const marker = L.marker(latLng).addTo(locationGroup);
        marker.bindPopup(`<div style="color: ${locationColor}; font-weight: bold;">${location.name}</div>`);

        try {
            // Fetch isochrone from OpenRouteService
            const radiusValue = location.radius;
            const isochroneData = await fetchIsochrone(location.lng, location.lat, radiusValue);
            
            if (isochroneData && isochroneData.features && isochroneData.features.length > 0) {
                // Convert GeoJSON to Leaflet layer with the unique color
                const isochroneLayer = L.geoJSON(isochroneData, {
                    style: {
                        color: locationColor,
                        fillColor: locationColor,
                        fillOpacity: 0.15,
                        weight: 2
                    }
                }).addTo(locationGroup);
                
                // Extend bounds with this isochrone
                isochroneLayer.eachLayer(layer => {
                    bounds.extend(layer.getBounds());
                });
            } else {
                // Fallback to a circle if isochrone fails
                console.warn("Isochrone data missing for", location.name, "- falling back to circle");
                const circle = L.circle(latLng, {
                    radius: radiusValue * 1000, // Convert km to meters
                    color: locationColor,
                    fillColor: locationColor,
                    fillOpacity: 0.15,
                    weight: 2
                }).addTo(locationGroup);
                
                bounds.extend(circle.getBounds());
            }
        } catch (error) {
            console.error("Error fetching isochrone:", error);
            // Fallback to a circle if isochrone fails
            const circle = L.circle(latLng, {
                radius: location.radius * 1000, // Convert km to meters
                color: locationColor,
                fillColor: locationColor,
                fillOpacity: 0.15,
                weight: 2
            }).addTo(locationGroup);
            
            bounds.extend(circle.getBounds());
        }
        
        // Add to map
        locationGroup.addTo(map);
        circleGroups.push(locationGroup);
    }
    
    // If there are locations, fit map to show all isochrones
    if (locations.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] });
    }
    createMapLegend(isochroneData);
}

// Function to fetch isochrone from OpenRouteService
async function fetchIsochrone(lng, lat, rangeInMinutes, transportMode = 'driving') {
    try {
        // Create a normalized key for consistent cache lookup
        const normLng = parseFloat(lng).toFixed(6);
        const normLat = parseFloat(lat).toFixed(6);
        const normMinutes = parseInt(rangeInMinutes);
        const cacheKey = `${normLng}|${normLat}|${normMinutes}|${transportMode}`; // Add transport mode to cache key
        
        console.log(`Looking for cache entry: ${cacheKey}`);
        
        // Check if we have this entry in cache
        if (cacheKey in isochroneCache) {
            console.log(`Cache hit for: ${cacheKey}`);
            const cachedData = isochroneCache[cacheKey];
            return cachedData;
        }
        
        // If not in cache, fetch from API
        console.log(`Cache miss for: ${cacheKey}, fetching from API...`);
        
        // For public transit/train, use Geoapify
        if (transportMode === 'walking+train') {
            console.log('Using Geoapify API for train isochrones');
            showStatus(`Fetching train isochrone for ${normMinutes} minutes...`, 'success');
            
            // Geoapify API call
            const response = await fetch(
                `https://api.geoapify.com/v1/isoline?lat=${normLat}&lon=${normLng}&type=time&mode=transit&range=${normMinutes*60}&details=elevation&format=geojson&apiKey=${geoapifyApiKey}`
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Geoapify API error: ${errorText}`);
                throw new Error(`Geoapify API returned status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Geoapify API returned data:", data);
            
            // Format as needed to match the expected structure in your app
            // Geoapify returns data in a slightly different format than Mapbox
            const formattedData = {
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        properties: {
                            contour: normMinutes,
                            transportMode: "walking+train"
                        },
                        geometry: data.features[0].geometry
                    }
                ]
            };
            
            // Store in cache
            isochroneCache[cacheKey] = formattedData;
            console.log(`Stored Geoapify entry in cache: ${cacheKey}`);
            logCacheStats();
            
            return formattedData;
        } else {
            // For other transport modes, use Mapbox as before
            const mapboxToken = 'pk.eyJ1IjoiYWRpNDEzIiwiYSI6ImNtOXJreGh3ZDFuMDcya3NlNGFidzdpZHcifQ.xd6nrhpBNgH1Gt-b44wAaQ';
            
            // Mapbox API has a limit of 60 minutes
            const apiMinutes = Math.min(Math.round(normMinutes), 60);
            
            // Show appropriate status message based on requested time and transport mode
            if (normMinutes > 60) {
                showStatus(`Fetching approximated ${normMinutes} min ${transportMode} isochrone (API limit: 60 min)...`, 'warning');
            } else {
                showStatus(`Fetching new ${transportMode} isochrone for ${normMinutes} minutes...`, 'success');
            }
            
            // Adjust the API endpoint based on transport mode
            const response = await fetch(
                `https://api.mapbox.com/isochrone/v1/mapbox/${transportMode}/${normLng},${normLat}?contours_minutes=${apiMinutes}&polygons=true&access_token=${mapboxToken}`
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Mapbox API error: ${errorText}`);
                throw new Error(`Mapbox API returned status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("API returned data:", data);
            
            // If requested minutes is greater than API limit, scale the isochrone
            if (normMinutes > 60 && data.features && data.features.length > 0) {
                console.log(`Scaling isochrone from ${apiMinutes} to ${normMinutes} minutes`);
                
                // Scale factor based on requested minutes vs API minutes
                const scaleFactor = normMinutes / apiMinutes * Math.sqrt(normMinutes / apiMinutes); //Math.sqrt(
                
                // Clone the data to avoid modifying the original
                const scaledData = JSON.parse(JSON.stringify(data));
                
                // Center coordinates as floats
                const centerLng = parseFloat(normLng);
                const centerLat = parseFloat(normLat);
                
                // Scale the coordinates of the polygon
                if (scaledData.features[0].geometry && 
                    scaledData.features[0].geometry.coordinates && 
                    scaledData.features[0].geometry.coordinates.length > 0) {
                    
                    // For each ring in the polygon
                    scaledData.features[0].geometry.coordinates.forEach((ring, ringIndex) => {
                        // For each coordinate in the ring
                        ring.forEach((coord, coordIndex) => {
                            // Get original coordinates as floats
                            const originalLng = parseFloat(coord[0]);
                            const originalLat = parseFloat(coord[1]);
                            
                            // Calculate vector from center to point
                            const dx = originalLng - centerLng;
                            const dy = originalLat - centerLat;
                            
                            // Scale the vector (using square root of time ratio for distance scaling)
                            const scaledX = centerLng + (dx * scaleFactor);
                            const scaledY = centerLat + (dy * scaleFactor);
                            
                            // Replace with scaled coordinates
                            scaledData.features[0].geometry.coordinates[ringIndex][coordIndex] = [scaledX, scaledY];
                        });
                    });
                }
                
                // Update properties to reflect the actual minutes
                if (scaledData.features[0].properties) {
                    scaledData.features[0].properties.contour = normMinutes;
                }
                
                // Store the scaled data in cache
                isochroneCache[cacheKey] = scaledData;
                console.log(`Stored scaled entry in cache: ${cacheKey}`);
                logCacheStats();
                
                return scaledData;
            }
            
            // For regular minutes (≤ 60), store the data as is
            const clonedData = JSON.parse(JSON.stringify(data));
            isochroneCache[cacheKey] = clonedData;
            console.log(`Stored new entry in cache: ${cacheKey}`);
            logCacheStats();
            
            return clonedData;
        }
    } catch (error) {
        console.error("Error fetching isochrone:", error);
        showStatus(`Error: ${error.message}`, 'error');
        return null;
    }
}

async function fetchIsochrone1(lng, lat, rangeInMinutes) {
    try {
        // Create a cache key
        const cacheKey = `${lng}_${lat}_${rangeInMinutes}`;
        
        // Check if we have this isochrone in cache
        if (isochroneCache[cacheKey]) {
            console.log("Using cached isochrone for", cacheKey);
            return isochroneCache[cacheKey];
        }
        
        // Show loading indicator
        showLoadingOverlay(true, `Calculating ${rangeInMinutes} min travel time...`);
        
        // Rest of your function remains unchanged...
        const minutes = Math.min(Math.round(rangeInMinutes), 120);
        
        const response = await fetch(`https://api.openrouteservice.org/v2/isochrones/driving-car`, {
            method: 'POST',
            headers: {
                'Authorization': orsApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                locations: [[lng, lat]],
                range: [minutes * 60],
                attributes: ['area', 'reachfactor'],
                range_type: 'time'
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenRouteService API returned status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Cache the result
        isochroneCache[cacheKey] = data;
        
        return data;
    } catch (error) {
        console.error("Error fetching isochrone from OpenRouteService:", error);
        showStatus('Error fetching isochrone data. Falling back to circles.', 'error');
        return null;
    } finally {
        showLoadingOverlay(false);
    }
}
// Function to update circles when inputs change
async function updateCircles() {
    // Clear existing circles immediately
    circleGroups.forEach(group => map.removeLayer(group));
    circleGroups = [];
    
    // Get all locations that have coordinates
    const locations = [];
    $('.location-input-group').each(function() {
        const input = $(this).find('.location-input');
        const radius = parseInt($(this).find('.radius-dropdown').val());
        const transportMode = $(this).find('.transport-mode-dropdown').val();
        const lat = input.data('lat');
        const lng = input.data('lng');
        const name = input.val();
        
        if (lat && lng && name) {
            locations.push({ 
                name, 
                lat, 
                lng,
                radius: radius || 100, // Default to 100 if not set
                transportMode: transportMode || 'driving' // Default to driving if not set
            });
        }
    });
    
    // If no locations found, exit early
    if (locations.length === 0) return;
    
    // Create bounds object and array to store isochrone data
    const bounds = L.latLngBounds();
    const isochroneData = [];
    
    // Show loading status
    showStatus('Calculating travel times...', 'success');
    
    // Draw isochrones for each location with unique colors
    for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        const latLng = [location.lat, location.lng];
        const locationColor = getColorForIndex(i);
        
        const locationGroup = L.layerGroup();
        const redIcon = L.icon({
            iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -30],
            shadowSize: [41, 41]
        });
        
        const marker = L.marker(latLng, { icon: redIcon }).addTo(locationGroup);
        
        // const marker = L.marker(latLng).addTo(locationGroup);
        marker.bindPopup(`<div style="color: ${locationColor}; font-weight: bold;">${location.name}</div>
                        <div>Transport: ${location.transportMode}</div>`);
        
        try {
            // Fetch isochrone from the API with transport mode
            const radiusValue = location.radius;
            console.log(`Fetching isochrone for ${location.name} with radius ${radiusValue} minutes and mode ${location.transportMode}`);
            const fetchedData = await fetchIsochrone(location.lng, location.lat, radiusValue, location.transportMode);
            
            if (fetchedData && fetchedData.features && fetchedData.features.length > 0) {
                console.log(`Got isochrone data for ${location.name}:`, fetchedData);
                
                // Convert GeoJSON to Leaflet layer with the unique color
                const isochroneLayer = L.geoJSON(fetchedData, {
                    style: {
                        color: locationColor,
                        fillColor: locationColor,
                        fillOpacity: 0.15,
                        weight: 2
                    }
                }).addTo(locationGroup);
                
                // Store the GeoJSON for intersection detection (create a fresh copy)
                const geoJSONFeature = JSON.parse(JSON.stringify(fetchedData.features[0]));
                
                isochroneData.push({
                    name: location.name,
                    radius: radiusValue,
                    transportMode: location.transportMode,
                    geoJSON: geoJSONFeature,
                    color: locationColor
                });
                
                console.log(`Added isochrone data for ${location.name} to intersection detection`);
                
                // Extend bounds with this isochrone
                isochroneLayer.eachLayer(layer => {
                    bounds.extend(layer.getBounds());
                });
            } else {
                // Fallback to a circle if isochrone fails
                console.warn(`No isochrone data received for ${location.name} - using circle fallback`);
                
                // Convert time to approximate distance in kilometers
                // Different speeds for different transport modes
                let speed = 60; // km/h for driving
                if (location.transportMode === 'walking') speed = 5;
                else if (location.transportMode === 'cycling') speed = 15;
                else if (location.transportMode === 'walking+train') speed = 45;
                
                const distanceKm = (location.radius / 60) * speed;
                const circleRadiusMeters = distanceKm * 1000;
                
                // Create circle
                const circle = L.circle(latLng, {
                    radius: circleRadiusMeters,
                    color: locationColor,
                    fillColor: locationColor,
                    fillOpacity: 0.15,
                    weight: 2
                }).addTo(map);  // Add directly to map first
                
                // Then add to the location group
                circle.addTo(locationGroup);
                
                // Now extend bounds safely
                try {
                    const circleBounds = circle.getBounds();
                    bounds.extend(circleBounds);
                } catch (error) {
                    console.warn("Could not get bounds for circle:", error);
                    // Fallback: extend bounds with just the center point
                    bounds.extend(latLng);
                }
            }
        } catch (error) {
            console.error(`Error processing isochrone for ${location.name}:`, error);
            // Implement the same fallback circle code here...
        }
        
        locationGroup.addTo(map);
        circleGroups.push(locationGroup);
    }
    
    // Process intersections after all isochrones are created
    if (isochroneData.length >= 2) {
        displayIntersections(isochroneData);
    }
    
    // Fit the map to these bounds immediately after drawing
    map.fitBounds(bounds, { padding: [30, 30] });
    
    // Update status and legend
    showStatus('Travel times calculated successfully!', 'success');
    createMapLegend(isochroneData);
    logCacheStats();
}

// Setup input event listeners
function setupInputListeners(inputElement) {
    // Debounce function to prevent too many API calls
    let debounceTimeout;
    
    // Input change event
    $(inputElement).on('input', async function() {
        const value = $(this).val();
        
        // Clear previous timeout
        clearTimeout(debounceTimeout);
        
        // Set new timeout
        debounceTimeout = setTimeout(async () => {
            if (value.length >= 3) {
                const suggestions = await filterLocations(value);
                showSuggestions(inputElement, suggestions);
            } else {
                $(inputElement).siblings('.dropdown').hide();
            }
        }, 300); // 300ms debounce time
    });
    
    // Focus event
    $(inputElement).on('focus', async function() {
        const value = $(this).val();
        if (value.length >= 3) {
            const suggestions = await filterLocations(value);
            showSuggestions(this, suggestions);
        }
    });
    
    // Blur event (close dropdown when clicking outside)
    $(inputElement).on('blur', function() {
        // Delayed to allow click on dropdown item
        setTimeout(() => {
            $(this).siblings('.dropdown').hide();
            // Update circles after selection is complete
            updateCircles();
        }, 200);
    });
}
// Add change handler for the initial radius dropdown
$('.radius-dropdown').on('change', function() {
    updateCircles();
});

// Add this near your other event handlers
$('.transport-mode-dropdown').on('change', function() {
    updateCircles();
    createMapLegend();
});

// Function to add a new location input field
function addLocationInput() {
    // Clone the first input group to ensure consistency
    const firstInputGroup = $('.location-input-group').first();
    const newInputGroup = firstInputGroup.clone();
    
    // Clear values and data from the cloned inputs
    const newInput = newInputGroup.find('.location-input');
    newInput.val('');
    newInput.removeData('lat');
    newInput.removeData('lng');
    
    // Reset dropdowns to default values
    newInputGroup.find('.radius-dropdown').val('60');
    newInputGroup.find('.transport-mode-dropdown').val('driving');
    
    // Clear the dropdown
    newInputGroup.find('.dropdown').empty().hide();
    
    // Change the add button to a remove button for the new group
    const addButton = newInputGroup.find('.add-location-btn');
    if (addButton.length) {
        addButton.removeClass('add-location-btn').addClass('remove-location-btn').text('-');
    } else {
        // If no add button exists, add a remove button
        const removeBtn = $('<button>').addClass('remove-location-btn').text('-');
        newInputGroup.append(removeBtn);
    }
    
    // Remove any existing remove button before adding a new one
    newInputGroup.find('.remove-location-btn').off('click').on('click', function() {
        newInputGroup.remove();
        updateCircles();
        createMapLegend();
    });
    
    // Setup event listeners for the new input
    setupInputListeners(newInput);
    
    // Add change handlers for dropdowns
    newInputGroup.find('.radius-dropdown').on('change', function() {
        updateCircles();
        createMapLegend();
    });
    
    newInputGroup.find('.transport-mode-dropdown').on('change', function() {
        updateCircles();
        createMapLegend();
    });
    
    // Also ensure we update when a new location is selected
    newInput.on('change', function() {
        if ($(this).data('lat') && $(this).data('lng')) {
            updateCircles();
        }
    });

    // Add to DOM
    $('#location-inputs').append(newInputGroup);
}

// Setup initial input
setupInputListeners($('.location-input').first());

// Add location button handler
$('.add-location-btn').on('click', addLocationInput);

// Handle show/hide permanent locations
$('#show-permanent').on('change', function() {
    displayPermanentLocations();
});

$('#clear-cache-btn').on('click', function() {
    // Clear all entries by recreating the object
    Object.keys(isochroneCache).forEach(key => {
        delete isochroneCache[key];
    });
    console.log("Cache cleared!");
    showStatus("Isochrone cache cleared. New data will be fetched on next update.", "success");
    updateCircles();
});

// Handle scroll behavior in controls
function checkScrollIndicator() {
    const distance2Input = $('#distance2');
    const controlsContainer = $('.controls');
    
    // Only show the scroll indicator if the Distance 2 input is not fully visible
    function checkInputVisibility() {
        // Check if Distance 2 input exists
        if (distance2Input.length === 0) {
            $('.scroll-indicator').hide();
            return;
        }
        
        const inputBottom = distance2Input.offset().top + distance2Input.outerHeight();
        const containerBottom = controlsContainer.offset().top + controlsContainer.height();
        
        // If the input is partially or fully below the visible area
        if (inputBottom > containerBottom) {
            $('.scroll-indicator').show();
        } else {
            $('.scroll-indicator').hide();
        }
    }
    
    // Initial check
    checkInputVisibility();
    
    // Recheck when scrolling
    $('.controls').on('scroll', function() {
        checkInputVisibility();
    });
    
    // Recheck on window resize
    $(window).on('resize', function() {
        checkInputVisibility();
    });
}

// Load permanent locations and initialize
(async function() {
    try {
        permanentLocations = await loadPermanentLocations();
        displayPermanentLocations(); // Display permanent locations as pins
        
        // Initialize with a clean map
        updateCircles();
        
        // Create map legend
        createMapLegend();
        
        // Check if scroll indicator is needed
        checkScrollIndicator();
    } catch (error) {
        console.error("Error initializing application:", error);
        showStatus('Error initializing application. Some features may not work correctly.', 'error');
    }
})();

// Optional: Add handler to close dropdowns when clicking outside
$(document).on('click', function(e) {
    if (!$(e.target).closest('.location-input-group').length) {
        $('.dropdown').hide();
    }
});

// Handle resize events to ensure map takes proper space
$(window).on('resize', function() {
    map.invalidateSize();
});
// Setup toggle functionality for the controls section

(function setupToggleControls() {
    // Wrap the content
    $('.location-inputs, .add-location-btn, .distance-customization, .scroll-indicator').wrapAll('<div class="controls-content"></div>');
    
    // Add click handler for the toggle button
    $('#toggle-controls').on('click', function() {
        // Toggle button appearance
        $(this).toggleClass('collapsed');
        
        // Toggle content visibility
        $('.controls-content').toggleClass('collapsed');
        
        // Give the map time to adjust and redraw
        setTimeout(() => {
            map.invalidateSize();
        }, 350);
    });
})();

// Initialize EmailJS
(function() {
    // Replace with your Email.js public key
    emailjs.init("dbgYcsV7hHmyqHhsK");
})();

// Set up recommendation box functionality
function initRecommendationBox() {
    // Set up toggle functionality
    $('.recommendation-toggle').on('click', function() {
        $('.recommendation-content').toggleClass('collapsed');
        $(this).find('i').toggleClass('fa-chevron-up fa-chevron-up');
    });
    
    // Set up send functionality
    $('#send-recommendation').on('click', function() {
        const recommendation = $('#recommendation-text').val().trim();
        if (!recommendation) {
            $('#recommendation-status')
                .removeClass('success')
                .addClass('error')
                .text('Please enter a recommendation')
                .show();
            return;
        }
        
        sendRecommendation(recommendation);
    });
}

// Function to send recommendation via Email.js
function sendRecommendation(recommendation) {
    // Show sending state
    const button = $('#send-recommendation');
    const originalText = button.text();
    button.text('Sending...').prop('disabled', true);
    
    // Prepare template parameters
    const templateParams = {
        name: "Map User", // Default name or you could add a name input field
        recommendation: recommendation,
        timestamp: new Date().toLocaleString()
    };
    
    // Send email using EmailJS
    // Replace with your Email.js service ID and template ID
    emailjs.send("service_4uho4ea", "template_fa0wk4y", templateParams)
        .then(function(response) {
            console.log("Email sent successfully!", response);
            showRecommendationSuccess();
        })
        .catch(function(error) {
            console.error("Email sending failed:", error);
            showRecommendationError("Failed to send recommendation. Please try again.");
        })
        .finally(function() {
            button.text(originalText).prop('disabled', false);
        });
}

// Show success message for recommendation
function showRecommendationSuccess() {
    $('#recommendation-status')
        .removeClass('error')
        .addClass('success')
        .text('Thank you! Your recommendation has been sent.')
        .show();
    
    // Clear the textarea
    $('#recommendation-text').val('');
    
    // Hide message after 5 seconds
    setTimeout(() => {
        $('#recommendation-status').fadeOut();
    }, 5000);
}

// Show error message for recommendation
function showRecommendationError(message) {
    $('#recommendation-status')
        .removeClass('success')
        .addClass('error')
        .text(message)
        .show();
    
    // Hide message after 5 seconds
    setTimeout(() => {
        $('#recommendation-status').fadeOut();
    }, 5000);
}

// Call init function when document is ready
$(document).ready(function() {
    initRecommendationBox();
});

// JavaScript for recommendation box toggle
document.addEventListener('DOMContentLoaded', function() {
    // Get recommendation toggle button and box
    const recommendationToggle = document.querySelector('.recommendation-toggle');
    const recommendationBox = document.querySelector('.recommendation-box');
    const recommendationContent = document.querySelector('.recommendation-content');
    
    if (recommendationToggle && recommendationBox && recommendationContent) {
        // Add click event to toggle button
        recommendationToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle the collapsed class on both box and content
            recommendationBox.classList.toggle('collapsed');
            recommendationContent.classList.toggle('collapsed');
        });
        
        // Also allow clicking the header to toggle (similar to overlaps container)
        const recommendationHeader = document.querySelector('.recommendation-header');
        if (recommendationHeader) {
            recommendationHeader.addEventListener('click', function(e) {
                // Don't trigger if clicking the toggle button itself
                if (e.target !== recommendationToggle && !recommendationToggle.contains(e.target)) {
                    recommendationBox.classList.toggle('collapsed');
                    recommendationContent.classList.toggle('collapsed');
                }
            });
        }
    }
});

map.on('zoom move viewreset', function() {
    // Update positions of any visible tooltips
    permanentMarkers.forEach(marker => {
        if (marker._tooltip) {
            const pos = map.latLngToLayerPoint(marker.getLatLng());
            marker._tooltip.style.left = `${pos.x}px`;
            marker._tooltip.style.top = `${pos.y - 35}px`;
        }
    });
});