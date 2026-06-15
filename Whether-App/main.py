import os
from flask import Flask, request, jsonify, render_template
import requests

app = Flask(__name__)

# Route to serve the frontend UI
@app.route('/')
def index():
    return render_template('index.html')

# API Proxy for location search (Geocoding)
@app.route('/api/geocode')
def geocode():
    query = request.args.get('query', '').strip()
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {
        "name": query,
        "count": 5,
        "language": "en",
        "format": "json"
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Geocoding API request failed: {e}")
        return jsonify({'error': 'Failed to retrieve location search results'}), 502

# API Proxy for reverse geocoding
@app.route('/api/reverse')
def reverse_geocode():
    lat = request.args.get('latitude')
    lon = request.args.get('longitude')

    if not lat or not lon:
        return jsonify({'error': 'Latitude and longitude are required'}), 400

    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "accept-language": "en"
    }
    headers = {
        "User-Agent": "AeroCastWeatherApp/1.0"
    }

    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Reverse Geocoding API request failed: {e}")
        return jsonify({'error': 'Failed to retrieve location details'}), 502

# API Proxy for weather data
@app.route('/api/weather')
def weather():
    lat = request.args.get('latitude')
    lon = request.args.get('longitude')

    if not lat or not lon:
        return jsonify({'error': 'Latitude and longitude are required'}), 400

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "is_day",
            "precipitation",
            "rain",
            "showers",
            "snowfall",
            "weather_code",
            "cloud_cover",
            "pressure_msl",
            "wind_speed_10m",
            "wind_direction_10m"
        ],
        "hourly": [
            "temperature_2m",
            "relative_humidity_2m",
            "weather_code",
            "wind_speed_10m"
        ],
        "daily": [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "apparent_temperature_max",
            "apparent_temperature_min",
            "sunrise",
            "sunset",
            "uv_index_max",
            "wind_speed_10m_max",
            "precipitation_probability_max"
        ],
        "timezone": "auto"
    }

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Weather API request failed: {e}")
        return jsonify({'error': 'Failed to retrieve weather data'}), 502

if __name__ == '__main__':
    # Run server locally on port 5000
    app.run(host='127.0.0.1', port=5000, debug=True)
