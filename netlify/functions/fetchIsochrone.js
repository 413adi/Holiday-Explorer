// netlify/functions/fetchIsochrone.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  const mapboxToken = process.env.MAPBOX_TOKEN;
  
  const { lng, lat, rangeInMinutes, transportMode } = JSON.parse(event.body);

  const normLng = parseFloat(lng).toFixed(6);
  const normLat = parseFloat(lat).toFixed(6);
  const normMinutes = parseInt(rangeInMinutes);
  const cacheKey = `${normLng}|${normLat}|${normMinutes}|${transportMode}`;

  // Mapbox API request
  const apiMinutes = Math.min(Math.round(normMinutes), 60);
  
  const response = await fetch(
    `https://api.mapbox.com/isochrone/v1/mapbox/${transportMode}/${normLng},${normLat}?contours_minutes=${apiMinutes}&polygons=true&access_token=${mapboxToken}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Mapbox API error: ${errorText}` }),
    };
  }

  const data = await response.json();
  return {
    statusCode: 200,
    body: JSON.stringify(data),
  };
};
