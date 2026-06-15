# Whether

Whether is a Flask-based weather dashboard that combines Open-Meteo forecasts with a polished single-page frontend. It supports city search, reverse geocoding, geolocation, unit switching, hourly forecasts, and a 7-day outlook.

## Features

- Search locations by city or ZIP code with live suggestions
- Detect the current location through the browser geolocation API
- Show current conditions, feels-like temperature, humidity, wind, pressure, cloud cover, UV index, sunrise, and sunset
- Render hourly and daily forecasts from Open-Meteo
- Switch between Celsius and Fahrenheit
- Display weather-themed background animations based on conditions

## Tech Stack

- Backend: Flask, Requests
- Frontend: HTML, CSS, Vanilla JavaScript
- Weather data: Open-Meteo API
- Geocoding: Open-Meteo geocoding API and Nominatim reverse geocoding

## Project Structure

```text
main.py
requirements.txt
static/
  app.js
  style.css
templates/
  index.html
```

## Getting Started

1. Create and activate a Python environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run the Flask app:

```bash
python main.py
```

4. Open the app in your browser at `http://127.0.0.1:5000`.

## API Routes

- `GET /api/geocode?query=...` returns location suggestions
- `GET /api/reverse?latitude=...&longitude=...` resolves coordinates to a place name
- `GET /api/weather?latitude=...&longitude=...` returns current, hourly, and daily weather data

## Notes

- The app expects internet access because it proxies live weather and location services.
- Reverse geocoding uses a fixed User-Agent header for the Nominatim request.