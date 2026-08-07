import os
import time
import json
import urllib.request
import urllib.parse
import googlemaps
import pandas as pd

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def geocode_location_text(location_text: str):
    """
    Converts a human-readable location text into (latitude, longitude) using OSM Nominatim.
    """
    url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(location_text)}&format=json&limit=1"
    req = urllib.request.Request(url, headers={'User-Agent': 'LeadFinder/1.0'})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data:
                return float(data[0]['lat']), float(data[0]['lon']), data[0].get('display_name', location_text)
    except Exception as e:
        print(f"⚠️ Geocoding error: {e}")
    return None, None, location_text


def extract_osm_email(tags: dict) -> str:
    return tags.get("email") or tags.get("contact:email") or tags.get("email:contact") or tags.get("contact:email_address") or "N/A"


def extract_osm_social(tags: dict) -> str:
    socials = []
    for s in ['facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'whatsapp']:
        val = tags.get(s) or tags.get(f"contact:{s}")
        if val:
            clean_val = val if val.startswith("http") else f"https://{s}.com/{val.lstrip('@')}"
            socials.append(clean_val)
    return "; ".join(socials) if socials else "N/A"


def extract_osm_profession(tags: dict, default_niche: str) -> str:
    keys = ['craft', 'shop', 'amenity', 'office', 'type', 'category', 'tourism', 'building']
    for k in keys:
        val = tags.get(k)
        if val and val != 'yes':
            return val.replace('_', ' ').title()
    return default_niche.title()


def find_leads_osm(
    niche: str = "carpenter",
    location_text: str = "Hyderabad",
    latitude: float = None,
    longitude: float = None,
    radius_meters: int = 10000,
    max_results: int = 0,  # 0 = unlimited
    output_csv: str = "leads_no_website_free.csv"
):
    """
    Searches for local businesses without websites using OpenStreetMap (100% Free).
    Extracts emails, social media links, profession, phone numbers, and addresses.
    """
    is_unlimited = (max_results == 0 or max_results is None)

    if (latitude is None or longitude is None) and location_text:
        print(f"📍 Resolving location text: '{location_text}'...")
        lat, lon, display_name = geocode_location_text(location_text)
        if lat is not None and lon is not None:
            latitude, longitude = lat, lon
            print(f"📍 Location resolved: {display_name} ({latitude}, {longitude})")
        else:
            latitude, longitude = 17.3850, 78.4867

    print(f"🔍 [OpenStreetMap - FREE] Searching for '{niche}' around ({latitude}, {longitude}) within {radius_meters}m ({'Unlimited' if is_unlimited else 'Max ' + str(max_results)} leads)...")

    overpass_url = "https://overpass-api.de/api/interpreter"
    query = f"""
    [out:json][timeout:60];
    (
      node(around:{radius_meters},{latitude},{longitude})["shop"];
      node(around:{radius_meters},{latitude},{longitude})["craft"];
      node(around:{radius_meters},{latitude},{longitude})["amenity"];
      node(around:{radius_meters},{latitude},{longitude})["office"];
      way(around:{radius_meters},{latitude},{longitude})["shop"];
      way(around:{radius_meters},{latitude},{longitude})["craft"];
      way(around:{radius_meters},{latitude},{longitude})["amenity"];
      way(around:{radius_meters},{latitude},{longitude})["office"];
    );
    out tags center;
    """

    try:
        req = urllib.request.Request(
            overpass_url,
            data=f"data={urllib.parse.quote(query)}".encode('utf-8'),
            headers={'User-Agent': 'LeadFinder/1.0'}
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"❌ OpenStreetMap Overpass API Error: {e}")
        return []

    elements = data.get("elements", [])
    print(f"📦 Downloaded {len(elements)} map items. Loose matching for '{niche}'...")

    leads = []
    niche_words = [w.lower() for w in niche.split() if w]

    for elem in elements:
        if not is_unlimited and len(leads) >= max_results:
            break

        tags = elem.get("tags", {})
        name = tags.get("name", "")
        if not name:
            continue

        # Loose Keyword Search
        matched = False
        search_keys = ["name", "shop", "craft", "amenity", "office", "description", "building", "tourism"]
        for k in search_keys:
            val = tags.get(k, "").lower()
            if not val:
                continue
            for word in niche_words:
                if word in val or val in word:
                    matched = True
                    break
            if matched:
                break

        if not matched:
            continue

        # Qualification: Check website missing
        website = tags.get("website") or tags.get("contact:website") or tags.get("url")
        if not website:
            email = extract_osm_email(tags)
            social_links = extract_osm_social(tags)
            phone = tags.get("phone") or tags.get("contact:phone") or tags.get("contact:mobile") or tags.get("mobile") or "N/A"
            profession = extract_osm_profession(tags, niche)
            
            addr_parts = [
                tags.get("addr:housenumber"),
                tags.get("addr:street"),
                tags.get("addr:suburb"),
                tags.get("addr:city"),
                tags.get("addr:postcode")
            ]
            address = ", ".join([p for p in addr_parts if p]) or tags.get("addr:full", "N/A")
            
            lat = elem.get("lat") or (elem.get("center", {}).get("lat"))
            lon = elem.get("lon") or (elem.get("center", {}).get("lon"))
            maps_link = f"https://www.google.com/maps/search/?api=1&query={lat},{lon}" if lat and lon else "N/A"

            lead_data = {
                'Business Name': name,
                'Profession / Category': profession,
                'Email': email,
                'Social Media Links': social_links,
                'Phone (Local)': phone,
                'Phone (Intl)': phone,
                'Address': address,
                'Google Maps Link': maps_link,
                'Rating': 'N/A (OSM)',
                'Total Reviews': 'N/A'
            }
            leads.append(lead_data)
            print(f"  ✅ Lead #{len(leads)} [{profession}] {'✉️ ' + email if email != 'N/A' else ''}: {name}")

    if leads:
        df = pd.DataFrame(leads)
        df.to_csv(output_csv, index=False, encoding='utf-8')
        print(f"\n🎉 Done! Saved {len(leads)} leads without websites to '{output_csv}'.")
    else:
        print("\n⚠️ No qualified leads found matching your criteria.")

    return leads


if __name__ == "__main__":
    NICHE = "carpenter"
    LOCATION_TEXT = "Hyderabad"
    RADIUS_IN_METERS = 10000
    MAX_RESULTS = 0  # Unlimited

    find_leads_osm(
        niche=NICHE,
        location_text=LOCATION_TEXT,
        radius_meters=RADIUS_IN_METERS,
        max_results=MAX_RESULTS,
        output_csv="no_website_leads_free.csv"
    )