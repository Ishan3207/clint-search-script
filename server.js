const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration status endpoint
app.get('/api/config', (req, res) => {
  const envKey = process.env.GOOGLE_PLACES_API_KEY || '';
  res.json({
    hasEnvApiKey: envKey.trim().length > 0 && envKey !== 'your_google_places_api_key_here',
    defaultPort: PORT
  });
});

// Geocoding Helper: Converts text location (e.g., "Hyderabad", "Miami") to (lat, lon)
async function geocodeLocationText(locationText) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationText)}&format=json&limit=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'LeadFinderApp/1.0' }
  });
  if (!response.ok) {
    throw new Error(`Geocoding HTTP error ${response.status}`);
  }
  const data = await response.json();
  if (!data || data.length === 0) {
    throw new Error(`Location '${locationText}' could not be resolved.`);
  }
  return {
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
    displayName: data[0].display_name
  };
}

// Fetch OpenStreetMap Places (Uses Overpass API for deep scanning + Nominatim fallback)
async function fetchOsmPlaces(niche, locationText, latitude, longitude, radiusMeters, isUnlimited) {
  const overpassEndpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  const query = `
  [out:json][timeout:60];
  (
    node(around:${radiusMeters},${latitude},${longitude})["shop"];
    node(around:${radiusMeters},${latitude},${longitude})["craft"];
    node(around:${radiusMeters},${latitude},${longitude})["amenity"];
    node(around:${radiusMeters},${latitude},${longitude})["office"];
    node(around:${radiusMeters},${latitude},${longitude})["tourism"];
    way(around:${radiusMeters},${latitude},${longitude})["shop"];
    way(around:${radiusMeters},${latitude},${longitude})["craft"];
    way(around:${radiusMeters},${latitude},${longitude})["amenity"];
    way(around:${radiusMeters},${latitude},${longitude})["office"];
    way(around:${radiusMeters},${latitude},${longitude})["tourism"];
  );
  out tags center;
  `;

  for (const ep of overpassEndpoints) {
    try {
      const response = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'LeadFinderApp/1.0'
        },
        body: 'data=' + encodeURIComponent(query)
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.elements && data.elements.length > 0) {
          return data.elements;
        }
      }
    } catch (e) {
      // Try next mirror
    }
  }

  // Fallback to Nominatim POI search if Overpass mirror timeouts
  try {
    const searchQuery = locationText ? `${niche} in ${locationText}` : niche;
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&extratags=1&addressdetails=1&limit=100`;
    const response = await fetch(nomUrl, {
      headers: { 'User-Agent': 'LeadFinderApp/1.0' }
    });

    if (response.ok) {
      const nomData = await response.json();
      if (Array.isArray(nomData)) {
        return nomData.map(item => ({
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          tags: {
            name: item.name || (item.display_name ? item.display_name.split(',')[0] : ''),
            ...(item.extratags || {})
          },
          display_name: item.display_name
        }));
      }
    }
  } catch (err) {}

  return [];
}

// Helpers for extracting details
function extractOsmEmail(tags) {
  return tags.email || tags['contact:email'] || tags['email:contact'] || tags['contact:email_address'] || 'N/A';
}

function extractOsmSocial(tags) {
  const socials = [];
  const socialKeys = ['facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'whatsapp'];
  for (const s of socialKeys) {
    const val = tags[s] || tags[`contact:${s}`];
    if (val) {
      const cleanVal = val.startsWith('http') ? val : `https://${s}.com/${val.replace(/^@/, '')}`;
      socials.push(cleanVal);
    }
  }
  return socials.length > 0 ? socials.join('; ') : 'N/A';
}

function extractOsmProfession(tags, defaultNiche) {
  const keys = ['craft', 'shop', 'amenity', 'office', 'type', 'category', 'tourism', 'building'];
  for (const k of keys) {
    if (tags[k] && tags[k] !== 'yes') {
      return tags[k].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }
  return defaultNiche.replace(/\b\w/g, l => l.toUpperCase());
}

function extractGoogleProfession(place, details, defaultNiche) {
  const types = details.types || place.types || [];
  for (const t of types) {
    if (t !== 'point_of_interest' && t !== 'establishment') {
      return t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }
  return defaultNiche.replace(/\b\w/g, l => l.toUpperCase());
}

// Helper for Google Places Nearby Search
async function fetchGooglePlacesNearby(apiKey, lat, lng, radius, keyword, pageToken) {
  let url = '';
  if (pageToken) {
    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${encodeURIComponent(pageToken)}&key=${encodeURIComponent(apiKey)}`;
  } else {
    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=${encodeURIComponent(keyword)}&key=${encodeURIComponent(apiKey)}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

// Helper for Google Place Details
async function fetchGooglePlaceDetails(apiKey, placeId) {
  const fields = [
    'name',
    'formatted_phone_number',
    'international_phone_number',
    'website',
    'formatted_address',
    'rating',
    'user_ratings_total',
    'url',
    'types',
    'business_status'
  ].join(',');

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${encodeURIComponent(apiKey)}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  return data.result || {};
}

// Server-Sent Events (SSE) Endpoint for live search streaming
app.get('/api/search-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const provider = req.query.provider || 'osm';
  const niche = req.query.niche || 'carpenter';
  const locationText = req.query.locationText || '';
  let latitude = parseFloat(req.query.latitude);
  let longitude = parseFloat(req.query.longitude);
  const radiusMeters = parseInt(req.query.radiusMeters, 10) || 10000;
  
  // FIX: Properly check if maxResults is specified as 0 (unlimited)
  const rawMax = req.query.maxResults;
  const maxResults = (rawMax !== undefined && rawMax !== '') ? parseInt(rawMax, 10) : 25;
  const isUnlimited = (maxResults === 0);

  const apiKey = req.query.apiKey || process.env.GOOGLE_PLACES_API_KEY;

  try {
    // Geocode location text if coordinates are omitted
    if (locationText.trim() && (isNaN(latitude) || isNaN(longitude))) {
      sendEvent('log', { message: `📍 Geocoding location: '${locationText}'...`, type: 'info' });
      const geo = await geocodeLocationText(locationText.trim());
      latitude = geo.latitude;
      longitude = geo.longitude;
      sendEvent('log', { message: `📍 Location resolved: ${geo.displayName} (${latitude}, ${longitude})`, type: 'success' });
    } else if (isNaN(latitude) || isNaN(longitude)) {
      latitude = 17.3850;
      longitude = 78.4867;
    }

    if (provider === 'osm') {
      // ==========================================
      // OPENSTREETMAP (100% FREE PROVIDER)
      // ==========================================
      sendEvent('log', { message: `🔍 [OpenStreetMap - FREE] Scanning for '${niche}' in '${locationText || 'target region'}' (${isUnlimited ? 'Unlimited' : 'Max ' + maxResults} leads)...`, type: 'info' });

      const elements = await fetchOsmPlaces(niche, locationText, latitude, longitude, radiusMeters, isUnlimited);
      sendEvent('log', { message: `📦 Downloaded ${elements.length} map items. Filtering leads lacking websites...`, type: 'info' });

      let leads = [];
      const nicheWords = niche.toLowerCase().split(/[\s,]+/).filter(Boolean);

      for (const elem of elements) {
        if (!isUnlimited && leads.length >= maxResults) {
          break;
        }

        const tags = elem.tags || {};
        const name = tags.name || (elem.display_name ? elem.display_name.split(',')[0] : '');
        if (!name) continue;

        // Loose Keyword Search across tags
        let matched = false;
        const searchKeys = ['name', 'shop', 'craft', 'amenity', 'office', 'description', 'type', 'category', 'building', 'tourism'];
        for (const k of searchKeys) {
          if (!tags[k]) continue;
          const tagVal = String(tags[k]).toLowerCase();
          for (const word of nicheWords) {
            if (tagVal.includes(word) || word.includes(tagVal)) {
              matched = true;
              break;
            }
          }
          if (matched) break;
        }

        // If direct POI search returned focused results, treat as matched
        if (elements.length > 0 && elements.length <= 100) {
          matched = true;
        }

        if (!matched) continue;

        // Qualification: Check website missing
        const website = tags.website || tags['contact:website'] || tags.url;
        if (!website) {
          const email = extractOsmEmail(tags);
          const socialLinks = extractOsmSocial(tags);
          const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || tags.mobile || 'N/A';
          const profession = extractOsmProfession(tags, niche);
          
          const addrParts = [
            tags['addr:housenumber'],
            tags['addr:street'],
            tags['addr:suburb'],
            tags['addr:city'],
            tags['addr:postcode']
          ];
          const address = addrParts.filter(Boolean).join(', ') || tags['addr:full'] || elem.display_name || 'N/A';
          
          const lat = elem.lat || (elem.center && elem.center.lat);
          const lon = elem.lon || (elem.center && elem.center.lon);
          const mapsLink = (lat && lon) ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` : 'N/A';

          const lead = {
            businessName: name,
            profession: profession,
            email: email,
            socialLinks: socialLinks,
            phoneLocal: phone,
            phoneIntl: phone,
            address: address,
            googleMapsLink: mapsLink,
            rating: 'N/A (OSM)',
            totalReviews: 'N/A'
          };

          leads.push(lead);
          sendEvent('lead', lead);
          sendEvent('log', { message: `✅ Lead #${leads.length} [${profession}] ${email !== 'N/A' ? '✉️ ' + email : ''}: ${lead.businessName}`, type: 'success' });
        }
      }

      sendEvent('log', { message: `🎉 Search complete! Discovered ${leads.length} qualified leads without websites.`, type: 'success' });
      sendEvent('complete', { totalLeads: leads.length });

    } else {
      // ==========================================
      // GOOGLE PLACES API (OPTIONAL PROVIDER)
      // ==========================================
      if (!apiKey || apiKey === 'your_google_places_api_key_here') {
        sendEvent('error', { message: 'Missing or invalid Google Places API key. Please switch to OpenStreetMap (Free) or enter a key.' });
        return res.end();
      }

      sendEvent('log', { message: `🔍 [Google Places] Searching for '${niche}' near (${latitude}, ${longitude}) within ${radiusMeters}m...`, type: 'info' });

      let leads = [];
      let nextPageToken = null;
      let pageCount = 0;

      while (true) {
        pageCount++;
        sendEvent('log', { message: `Fetching page #${pageCount} from Google Places API...`, type: 'info' });

        if (nextPageToken) {
          sendEvent('log', { message: 'Waiting 2 seconds for next page token...', type: 'info' });
          await new Promise(r => setTimeout(r, 2000));
        }

        const placesData = await fetchGooglePlacesNearby(apiKey, latitude, longitude, radiusMeters, niche, nextPageToken);

        if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
          const errorMsg = placesData.error_message || placesData.status || 'API Request failed';
          sendEvent('log', { message: `❌ Google Places Error: ${errorMsg}`, type: 'error' });
          sendEvent('error', { message: `Google Places API Error: ${errorMsg}` });
          return res.end();
        }

        const results = placesData.results || [];
        sendEvent('log', { message: `Received ${results.length} places on page #${pageCount}. Inspecting websites...`, type: 'info' });

        for (const place of results) {
          if (!isUnlimited && leads.length >= maxResults) {
            break;
          }

          const placeId = place.place_id;
          if (!placeId) continue;

          try {
            const details = await fetchGooglePlaceDetails(apiKey, placeId);

            if (details.business_status === 'CLOSED_PERMANENTLY') {
              continue;
            }

            if (!details.website) {
              const profession = extractGoogleProfession(place, details, niche);

              const lead = {
                businessName: details.name || 'N/A',
                profession: profession,
                email: 'N/A (Google API)',
                socialLinks: 'N/A (Google API)',
                phoneLocal: details.formatted_phone_number || 'N/A',
                phoneIntl: details.international_phone_number || 'N/A',
                address: details.formatted_address || 'N/A',
                googleMapsLink: details.url || 'N/A',
                rating: details.rating !== undefined ? details.rating : 'N/A',
                totalReviews: details.user_ratings_total !== undefined ? details.user_ratings_total : 0
              };

              leads.push(lead);
              sendEvent('lead', lead);
              sendEvent('log', { message: `✅ Lead #${leads.length} [${profession}]: ${lead.businessName}`, type: 'success' });
            }
          } catch (detailErr) {
            sendEvent('log', { message: `⚠️ Detail fetch warning for place ${placeId}: ${detailErr.message}`, type: 'warn' });
          }
        }

        nextPageToken = placesData.next_page_token;

        if ((!isUnlimited && leads.length >= maxResults) || !nextPageToken) {
          break;
        }
      }

      sendEvent('log', { message: `🎉 Search complete! Found ${leads.length} qualified leads without websites.`, type: 'success' });
      sendEvent('complete', { totalLeads: leads.length });
    }

  } catch (err) {
    sendEvent('log', { message: `❌ Search Error: ${err.message}`, type: 'error' });
    sendEvent('error', { message: err.message });
  } finally {
    res.end();
  }
});

const HOST = '127.0.0.1';

function startServer(portToTry) {
  const currentPort = parseInt(portToTry, 10);
  const server = app.listen(currentPort, HOST, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Clint Search Lead Finder running on http://${HOST}:${currentPort}`);
    console.log(`==================================================\n`);
  });

  server.on('error', (err) => {
    if ((err.code === 'EACCES' || err.code === 'EADDRINUSE') && currentPort < 5010) {
      console.log(`⚠️ Port ${currentPort} restricted/in use (${err.code}). Trying port ${currentPort + 1}...`);
      startServer(currentPort + 1);
    } else {
      console.error('❌ Server startup error:', err);
    }
  });
}

startServer(PORT);
